import throat from 'throat';
import getLogger from '../../utils/logger';
import {
    FixRequestMessage,
    ScanRequestMessage,
    TaskStatus,
    WAD_SERVICE_ID,
    WadConfigurationEntry,
    WadScanContext,
    WadScanResultRecord
} from '../../utils/wad-consts';
import { publishFixResult, publishFixStatus, publishScanResult, publishScanStatus } from './publishers';
import { buildEc2FsxRelationship } from '../cloud-manager/tagging-service-operations';
import {
    collectOntapAssessmentData,
    FsxStorageCollectionResult
} from '../continuous-optimization/ontap-proxy-collector';
import { StorageAssessment as MssqlStorageAssessment } from '../../utils/common-types';
import { StorageAssessment as OracleStorageAssessment } from '../continuous-optimization/oracle/common-types';
import { getMssqlStorageResourceScan } from '../continuous-optimization/mssql/assessment-operations';
import { getOracleStorageResourceScan } from '../continuous-optimization/oracle/assessment-operations';
import { applyOntapStorageFix } from '../continuous-optimization/ontap-storage-fix-operations';

const logger = getLogger();

/**
 * WAD storage note: the downstream `setResult` call is a plain Redis SET EX, so sending two
 * entries with the same (configurationId + parentResource.id) causes a full overwrite of the
 * earlier entry. Merge all resources under a single entry per key before publishing to avoid
 * silently losing data.
 */
function mergeConfigurations(configs: WadConfigurationEntry[]): WadConfigurationEntry[] {
    const map = new Map<string, WadConfigurationEntry>();
    for (const entry of configs) {
        const key = `${entry.parentResource.accountId}:${entry.parentResource.credentialsIds.join(',')}:${
            entry.parentResource.region
        }:${entry.parentResource.id}:${entry.configurationId}`;
        const existing = map.get(key);
        if (existing) {
            existing.resources.push(...entry.resources);
        } else {
            map.set(key, { ...entry, resources: [...entry.resources] });
        }
    }
    return [...map.values()];
}

type WorkloadScanFn = (
    ctx: WadScanContext,
    storageAssessment: FsxStorageCollectionResult['storageAssessment']
) => Promise<WadScanResultRecord>;

const WORKLOAD_SCAN_FNS: Record<string, WorkloadScanFn> = {
    mssql: (ctx, storageAssessment) => getMssqlStorageResourceScan(ctx, storageAssessment as MssqlStorageAssessment),
    oracle: (ctx, storageAssessment) => getOracleStorageResourceScan(ctx, storageAssessment as OracleStorageAssessment)
};

/**
 * Handles an inbound ScanRequestMessage from WAD Manager.
 * For each credentialsId × region pair, discovers FSx filesystems via callWlmHosts,
 * collects ONTAP inventory, and publishes per-(parentResource × configurationId) results.
 */
async function handleScanRequest(req: ScanRequestMessage): Promise<void> {
    const { taskId, requestId, accountId, regions, credentialsIds, configurationIds } = req;
    const baseStatus = { taskId, requestId, accountId, serviceId: WAD_SERVICE_ID };

    logger.info('WAD: handling scan request', { taskId, accountId, regions, credentialsIds, configurationIds });

    try {
        const baseCtx = { ...baseStatus, configurationIds };
        const pairs = credentialsIds.flatMap(credentialsId => regions.map(region => ({ credentialsId, region })));

        const settled = await Promise.allSettled(
            pairs.map(({ credentialsId, region }) =>
                throat(3, async () => {
                    const relationship = await buildEc2FsxRelationship(accountId, credentialsId, region);
                    const storageAssessments = await collectOntapAssessmentData(accountId, relationship);
                    const pairConfigs: WadConfigurationEntry[] = [];

                    for (const { workloadType, fileSystemId, storageAssessment } of storageAssessments) {
                        const scanFn = WORKLOAD_SCAN_FNS[workloadType];
                        if (scanFn) {
                            // eslint-disable-next-line no-await-in-loop
                            const { configurations } = await scanFn(
                                {
                                    ...baseCtx,
                                    credentialsId,
                                    region,
                                    filesystemId: fileSystemId,
                                    workload: workloadType
                                },
                                storageAssessment
                            );
                            pairConfigs.push(...configurations);
                        }
                    }

                    return pairConfigs;
                })()
            )
        );

        // Log + collect every failed pair individually; none of them are silently dropped.
        const allConfigurations: WadConfigurationEntry[] = [];
        const errors: string[] = [];
        for (const [i, result] of settled.entries()) {
            if (result.status === 'rejected') {
                const { credentialsId, region } = pairs[i];
                const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
                logger.error('WAD: scan failed for credentials/region pair', {
                    taskId,
                    credentialsId,
                    region,
                    message
                });
                errors.push(`${credentialsId}/${region}: ${message}`);
            } else {
                allConfigurations.push(...result.value);
            }
        }

        if (allConfigurations.length > 0) {
            const scanRecord = {
                taskId,
                requestId,
                accountId,
                serviceId: WAD_SERVICE_ID,
                completedAt: Date.now(),
                configurations: mergeConfigurations(allConfigurations)
            };
            logger.info('WAD: published scan result', { scanRecord }); // to be removed
            publishScanResult(scanRecord);
        }

        publishScanStatus({
            ...baseStatus,
            updatedAt: Date.now(),
            ...(errors.length === 0
                ? { status: TaskStatus.COMPLETED }
                : {
                      status: TaskStatus.FAILED,
                      errorMessage: `${errors.length}/${pairs.length} pair(s) failed: ${errors.join('; ')}`
                  })
        });
    } catch (err) {
        logger.error('WAD: scan request failed', { taskId, err });
        publishScanStatus({
            ...baseStatus,
            updatedAt: Date.now(),
            status: TaskStatus.FAILED,
            errorMessage: err instanceof Error ? err.message : String(err)
        });
    }
}

/**
 * Handles an inbound FixRequestMessage from WAD Manager.
 * Applies per-resource fix logic then publishes result + final status.
 */
async function handleFixRequest(req: FixRequestMessage): Promise<void> {
    const { taskId, requestId, accountId, configurationId, parentResource, resourceIds } = req;
    const baseResult = {
        taskId,
        requestId,
        accountId,
        serviceId: WAD_SERVICE_ID,
        configurationId,
        parentResourceId: parentResource.id
    };

    logger.info('WAD: handling fix request', { taskId, configurationId, resourceCount: resourceIds.length });

    try {
        const resourceResults = await applyOntapStorageFix({
            accountId,
            fsxId: parentResource.id,
            region: parentResource.region,
            svmName: (req.metadata?.svmName as string | undefined) ?? '',
            configurationId: configurationId.replace(`${WAD_SERVICE_ID}-`, ''),
            resourceIds,
            value: req.metadata?.value as string | undefined
        });

        publishFixResult({ ...baseResult, resourceResults, reportedAt: Date.now() });
        publishFixStatus({ ...baseResult, updatedAt: Date.now(), status: TaskStatus.COMPLETED });
    } catch (err) {
        logger.error('WAD: fix request failed', { taskId, configurationId, err });
        publishFixStatus({
            ...baseResult,
            updatedAt: Date.now(),
            status: TaskStatus.FAILED,
            errorMessage: err instanceof Error ? err.message : String(err)
        });
    }
}

export { handleScanRequest, handleFixRequest };
