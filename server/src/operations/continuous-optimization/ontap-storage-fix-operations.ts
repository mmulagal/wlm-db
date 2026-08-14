import { flatten, map } from 'lodash-es';
import throat from 'throat';
import { callOntapAndPollJob } from '../../lib/ontap/ontap-gateway';
import getLogger from '../../utils/logger';
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

interface OntapStorageFixParams {
    accountId: string;
    credentialsId: string;
    fsxId: string;
    region: string;
    svmName: string;
    configurationId: string;
    resourceIds: string[];
    value?: string;
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

async function applyOntapStorageFix(params: OntapStorageFixParams) {
    const {
        accountId,
        credentialsId,
        fsxId,
        region,
        svmName,
        configurationId,
        resourceIds,
        value = '',
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

                const usesRestFix = REST_FIX_CONFIG_KEYS.has(configKey);
                const apiKey = usesRestFix ? `${configKey}_REST` : configKey;
                const apiFn = OptimizeStorageApiData[apiKey as keyof typeof OptimizeStorageApiData];
                const { api, body, type } = apiFn(value || undefined);
                const path = `api${api}`;

                try {
                    await callOntapAndPollJob({
                        accountId,
                        credentialsId,
                        region,
                        fsxId: normalizedFsxId,
                        path,
                        method: 'PATCH',
                        query: buildOntapFixSearchParams(type, svmName, ids, configKey, value, usesRestFix),
                        body
                    });
                    return populateFixResultMetadata(
                        map(ids, id => ({ resourceId: id, success: true })),
                        configurationId,
                        workload as string
                    );
                } catch (err) {
                    const failureReason = err instanceof Error ? err.message : String(err);
                    logger.error('ONTAP PATCH failed', {
                        accountId,
                        cfgId,
                        fsxId: normalizedFsxId,
                        failureReason,
                        err
                    });
                    return map(ids, id => ({ resourceId: id, success: false, failureReason }));
                }
            })
        )
    );

    return flatten(results);
}

export { applyOntapStorageFix };
