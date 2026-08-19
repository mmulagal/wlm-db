import createError from 'http-errors';
import { flatten, map } from 'lodash-es';
import throat from 'throat';
import {
    buildOntapProxyBase,
    callOntapAndPollJob,
    collectAllOntapRecords,
    OntapVolumeRecord
} from '../../lib/ontap/ontap-gateway';
import { getOntapVolumeEfficiency, promoteVolumeEfficiency } from './ontap-operations';
import { HttpErrorCodes, RESOURCESTYPE } from '../../utils/consts';
import getLogger from '../../utils/logger';
import { sleep } from '../../utils/utils';
import {
    AssessmentStatus,
    COMBINED_OPTIMIZE_DESCRIPTORS,
    LUN,
    LUN_PATH_PATTERN,
    OptimizeStorageApiData,
    OptimizeStorageConfigs,
    QUERY_PARAMS,
    isCombinedOptimizeConfig
} from '../../utils/continous-optimization-consts';
import { FixResourceResult, WAD_SERVICE_ID } from '../../utils/wad-consts';
import { MSSQL_GOLDEN_CONFIG } from './mssql/golden-config';
import ORACLE_GOLDEN_CONFIG from './oracle/golden-config';

const logger = getLogger();

const CONFIG_KEY_BY_ID: Record<string, string> = Object.fromEntries(
    Object.entries(OptimizeStorageConfigs).map(([key, value]) => [value, key])
);

const REST_FIX_CONFIG_KEYS = new Set([
    'THIN_PROVISIONING',
    'FRACTIONAL_RESERVE',
    'SPACE_RESERVATION',
    'SPACE_ALLOCATION'
]);

// Oracle's per-volume `objectsToOptimize` are ONTAP volume *names* (see Oracle assessment code),
// while THIN_PROVISIONING/FRACTIONAL_RESERVE's REST variant filters `api/storage/volumes` by
// `uuid` (see buildOntapFixSearchParams). Keep Oracle on the name-based private-CLI path for these
// two configs instead of silently matching zero records; MSSQL supplies UUIDs and keeps using REST.
const REST_FIX_ORACLE_UNSUPPORTED_CONFIG_KEYS = new Set(['THIN_PROVISIONING', 'FRACTIONAL_RESERVE']);

const EFFICIENCY_RETRY_CONFIG_KEYS = new Set(['COMPRESSION', 'DEDUPLICATION', 'COMPACTION']);
const DEPRIORITIZED_EFFICIENCY_CODE = '6881332';
const DEPRIORITIZED_EFFICIENCY_SIGNATURE = 'Cannot perform efficiency operations on deprioritized volume';

function isDeprioritizedEfficiencyError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return message.includes(DEPRIORITIZED_EFFICIENCY_CODE) || message.includes(DEPRIORITIZED_EFFICIENCY_SIGNATURE);
}

const PENDING_EFFICIENCY_OPERATION_SIGNATURE = 'operation is currently pending';
const PENDING_OPERATION_MAX_ATTEMPTS = 3;
const PENDING_OPERATION_RETRY_INTERVAL_MS = 10_000; // matches ONTAP_JOB_POLL_DEFAULT_INTERVAL_MS's cadence in ontap-gateway.ts

/**
 * Retries `sendPatch` a bounded number of times when ONTAP reports the target volume has a
 * pending background operation, waiting {@link PENDING_OPERATION_RETRY_INTERVAL_MS} between
 * attempts. Any other error is rethrown immediately; exhausting all attempts throws a clear
 * timeout error instead of the raw ONTAP message.
 */
async function retryOnPendingOperation<T>(sendPatch: () => Promise<T>): Promise<T> {
    let attempt = 0;
    do {
        attempt += 1;
        try {
            // eslint-disable-next-line no-await-in-loop
            return await sendPatch();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (!message.toLowerCase().includes(PENDING_EFFICIENCY_OPERATION_SIGNATURE)) {
                throw err;
            }
            if (attempt < PENDING_OPERATION_MAX_ATTEMPTS) {
                logger.info('ONTAP operation currently pending on target volume; waiting before retry', {
                    attempt,
                    maxAttempts: PENDING_OPERATION_MAX_ATTEMPTS
                });
                // eslint-disable-next-line no-await-in-loop
                await sleep(PENDING_OPERATION_RETRY_INTERVAL_MS);
            }
        }
    } while (attempt < PENDING_OPERATION_MAX_ATTEMPTS);

    throw createError(
        HttpErrorCodes.INTERNAL_SERVER_ERROR,
        `Pending ONTAP operation on the target volume did not clear after ${PENDING_OPERATION_MAX_ATTEMPTS} attempts; blocked the storage fix`
    );
}

interface OntapStorageFixParams {
    accountId: string;
    credentialsId: string;
    fsxId: string;
    region: string;
    svmName: string;
    configurationId: string;
    resourceIds: string[];
    value?: string;
    resourceType?: RESOURCESTYPE;
    workload?: string;
    isSimulated?: boolean;
}

function populateFixResultMetadata(
    resourceResults: FixResourceResult[],
    configurationId: string,
    workload: string
): FixResourceResult[] {
    const goldenConfig =
        workload === 'mssql' ? MSSQL_GOLDEN_CONFIG : workload === 'oracle' ? ORACLE_GOLDEN_CONFIG : undefined;
    const configuration = goldenConfig?.find(({ id }) => id === configurationId.replace(`${WAD_SERVICE_ID}-`, ''));
    if (!configuration) {
        return resourceResults;
    }

    const isThinProvision = configuration.id === OptimizeStorageConfigs.THIN_PROVISIONING;

    const components = (
        configuration.components ?? [
            { parameter: configuration.id, value: configuration.value ?? configuration.recommended ?? '' }
        ]
    ).map(({ parameter, name, value }) => {
        const optimizedValue = isThinProvision ? 'enabled' : String(value);
        return {
            parameter: name ?? parameter,
            current: optimizedValue,
            recommended: optimizedValue,
            status: AssessmentStatus.OPTIMIZED
        };
    });

    return resourceResults.map(result => (result.success ? { ...result, metadata: { components } } : result));
}

function buildOntapFixSearchParams(
    type: string,
    svmName: string,
    resourceIds: string[],
    configKey: string,
    value: string,
    usesRestFix: boolean
): Record<string, string | number | boolean> {
    if (usesRestFix) {
        if (['THIN_PROVISIONING', 'FRACTIONAL_RESERVE'].includes(configKey)) {
            return { uuid: resourceIds.join('|') };
        }
        return { name: resourceIds.join('|') };
    }
    if (
        ['DEDUPLICATION', 'COMPACTION', 'EXPORT_POLICY'].includes(configKey) ||
        (value === 'none' && configKey === 'COMPRESSION')
    ) {
        return { svm: svmName, name: resourceIds.join('|') };
    }
    if (configKey === 'NFS_ROOTONLY') {
        return { vserver: svmName };
    }
    const queryParamKey = QUERY_PARAMS[type as keyof typeof QUERY_PARAMS] ?? type;
    return { vserver: svmName, [queryParamKey]: resourceIds.join(',') };
}

async function applyOntapStorageFix(params: OntapStorageFixParams): Promise<FixResourceResult[]> {
    const {
        accountId,
        credentialsId,
        fsxId,
        region,
        svmName,
        configurationId,
        resourceIds,
        value = '',
        resourceType = RESOURCESTYPE.MSSQL,
        workload,
        isSimulated
    } = params;
    const normalizedFsxId = fsxId.split(',')[0].trim();

    logger.info('Applying ONTAP storage fix via gateway', {
        accountId,
        fsxId: normalizedFsxId,
        configurationId,
        resourceCount: resourceIds.length,
        workload,
        isSimulated
    });

    if (isSimulated) {
        return populateFixResultMetadata(
            map(resourceIds, id => ({ resourceId: id, success: true })),
            configurationId,
            workload as string
        );
    }

    const configs = isCombinedOptimizeConfig(configurationId)
        ? COMBINED_OPTIMIZE_DESCRIPTORS[configurationId].components
              .map(({ configKey, source }) => ({
                  configurationId: configKey,
                  resourceIds: resourceIds.filter(id => LUN_PATH_PATTERN.test(id) === (source === LUN))
              }))
              .filter(({ resourceIds: ids }) => ids.length > 0)
        : [{ configurationId, resourceIds }];

    const results = await Promise.all(
        configs.map(
            throat(3, async ({ configurationId: cfgId, resourceIds: ids }) => {
                const configKey = CONFIG_KEY_BY_ID[cfgId];
                if (!configKey) {
                    logger.warn('Unsupported configurationId', { cfgId });
                    return map(ids, id => ({
                        resourceId: id,
                        success: false,
                        failureReason: `Unsupported configurationId: ${cfgId}`
                    }));
                }

                let compliantResults: FixResourceResult[] = [];
                let targetIds = ids;
                if (EFFICIENCY_RETRY_CONFIG_KEYS.has(configKey) && value === 'none' && ids.length > 0) {
                    const efficiencyBase = buildOntapProxyBase(accountId, normalizedFsxId, region);
                    const volumes = await collectAllOntapRecords<OntapVolumeRecord>(
                        efficiencyBase,
                        'api/storage/volumes',
                        { svm: svmName, name: ids.join('|'), fields: 'efficiency' }
                    );
                    const alreadyDisabled = new Set(
                        volumes.filter(volume => volume.efficiency?.state === 'disabled').map(volume => volume.name)
                    );
                    compliantResults = ids
                        .filter(id => alreadyDisabled.has(id))
                        .map(id => ({ resourceId: id, success: true }));
                    targetIds = ids.filter(id => !alreadyDisabled.has(id));
                    if (targetIds.length === 0) {
                        logger.info('All targeted volumes already have efficiency disabled; skipping ONTAP PATCH', {
                            accountId,
                            cfgId,
                            fsxId: normalizedFsxId,
                            ids
                        });
                        return compliantResults;
                    }
                }

                const usesRestFix =
                    REST_FIX_CONFIG_KEYS.has(configKey) &&
                    !(resourceType === RESOURCESTYPE.ORACLE && REST_FIX_ORACLE_UNSUPPORTED_CONFIG_KEYS.has(configKey));
                const apiKey = usesRestFix ? `${configKey}_REST` : configKey;
                const apiFn = OptimizeStorageApiData[apiKey as keyof typeof OptimizeStorageApiData];
                const { api, body, type } =
                    configKey === 'TIERING_MINIMUM_COOLING_DAYS'
                        ? (apiFn as (typeof OptimizeStorageApiData)['TIERING_MINIMUM_COOLING_DAYS'])(
                              value || undefined,
                              'auto'
                          )
                        : configKey === 'TIERING_POLICY'
                        ? (apiFn as (typeof OptimizeStorageApiData)['TIERING_POLICY'])(value || undefined, null)
                        : apiFn(value || undefined);
                const path = `api${api}`;
                const query = buildOntapFixSearchParams(type, svmName, targetIds, configKey, value, usesRestFix);

                const sendPatch = () =>
                    retryOnPendingOperation(() =>
                        callOntapAndPollJob({
                            accountId,
                            credentialsId,
                            region,
                            fsxId: normalizedFsxId,
                            path,
                            method: 'PATCH',
                            query,
                            body
                        })
                    );

                try {
                    await sendPatch();
                    return [...compliantResults, ...map(targetIds, id => ({ resourceId: id, success: true }))];
                } catch (err) {
                    if (EFFICIENCY_RETRY_CONFIG_KEYS.has(configKey) && isDeprioritizedEfficiencyError(err)) {
                        logger.info('Detected deprioritized-volume efficiency error; attempting recovery', {
                            accountId,
                            cfgId,
                            fsxId: normalizedFsxId,
                            ids: targetIds
                        });
                        const base = buildOntapProxyBase(accountId, normalizedFsxId, region);
                        let promotedAll = true;
                        // Sequential: stop at the first promote/verify failure instead of continuing to
                        // promote further volumes that the subsequent retried PATCH wouldn't reach anyway.
                        for (const id of targetIds) {
                            try {
                                // eslint-disable-next-line no-await-in-loop
                                await promoteVolumeEfficiency(base, svmName, id);
                                // eslint-disable-next-line no-await-in-loop
                                const verified = await getOntapVolumeEfficiency(base, svmName, id);
                                if (!verified) {
                                    promotedAll = false;
                                    break;
                                }
                            } catch (promoteErr) {
                                logger.warn('Promote/verify failed during efficiency recovery', {
                                    accountId,
                                    id,
                                    promoteErr
                                });
                                promotedAll = false;
                                break;
                            }
                        }

                        if (promotedAll) {
                            logger.info('Promote succeeded; retrying the original PATCH', { accountId, cfgId });
                            try {
                                await sendPatch();
                                return [
                                    ...compliantResults,
                                    ...map(targetIds, id => ({ resourceId: id, success: true }))
                                ];
                            } catch (retryErr) {
                                const failureReason = retryErr instanceof Error ? retryErr.message : String(retryErr);
                                logger.error('ONTAP PATCH retry after efficiency promote failed', {
                                    accountId,
                                    cfgId,
                                    fsxId: normalizedFsxId,
                                    failureReason,
                                    err: retryErr
                                });
                                return [
                                    ...compliantResults,
                                    ...map(targetIds, id => ({ resourceId: id, success: false, failureReason }))
                                ];
                            }
                        }
                        logger.info('Promote/verify failed; not retrying original request.', { accountId, cfgId });
                    }

                    const failureReason = err instanceof Error ? err.message : String(err);
                    logger.error('ONTAP PATCH failed', {
                        accountId,
                        cfgId,
                        fsxId: normalizedFsxId,
                        failureReason,
                        err
                    });
                    return [
                        ...compliantResults,
                        ...map(targetIds, id => ({ resourceId: id, success: false, failureReason }))
                    ];
                }
            })
        )
    );

    return populateFixResultMetadata(flatten(results), configurationId, workload as string);
}

export { applyOntapStorageFix };
