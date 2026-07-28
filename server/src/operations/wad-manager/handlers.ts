import throat from 'throat';
import getLogger from '../../utils/logger';
import {
    FixRequestMessage,
    ScanRequestMessage,
    ScanTrigger,
    TaskStatus,
    WAD_SERVICE_ID,
    WadConfigurationEntry,
    WadScanContext,
    WadScanResultRecord
} from '../../utils/wad-consts';
import { buildSimulatedWadScanConfigurations } from '../../utils/demo-utils/demoMockdata';
import { createTrackerTask, getTrackerTask, updateTrackerTaskStatus } from '../../lib/cloud-manager/tracker';
import { publishFixResult, publishFixStatus, publishScanResult, publishScanStatus } from './publishers';
import { buildEc2FsxRelationship } from '../cloud-manager/tagging-service-operations';
import {
    collectOntapAssessmentData,
    FsxStorageCollectionResult,
    AggregateHeadroomData,
    WadSnapcenterData
} from '../continuous-optimization/ontap-proxy-collector';
import { StorageAssessment as MssqlStorageAssessment, TrackerTaskStatus } from '../../utils/common-types';
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
    storageAssessment: FsxStorageCollectionResult['storageAssessment'],
    headroomData?: AggregateHeadroomData,
    snapcenterData?: WadSnapcenterData
) => Promise<WadScanResultRecord>;

const WORKLOAD_SCAN_FNS: Record<string, WorkloadScanFn> = {
    mssql: (ctx, storageAssessment, headroomData, snapcenterData) =>
        getMssqlStorageResourceScan(ctx, storageAssessment as MssqlStorageAssessment, headroomData, snapcenterData),
    oracle: (ctx, storageAssessment, headroomData, snapcenterData) =>
        getOracleStorageResourceScan(ctx, storageAssessment as OracleStorageAssessment, headroomData, snapcenterData)
};

/**
 * Handles an inbound ScanRequestMessage from WAD Manager.
 * For each credentialsId × region pair, discovers FSx filesystems via callWlmHosts,
 * collects ONTAP inventory, and publishes per-(parentResource × configurationId) results.
 */
async function handleScanRequest(req: ScanRequestMessage): Promise<void> {
    const {
        taskId,
        requestId,
        accountId,
        regions,
        credentialsIds,
        configurationIds,
        triggerMode,
        trackerParentTaskId,
        isSimulated
    } = req;
    const baseStatus = { taskId, requestId, accountId, serviceId: WAD_SERVICE_ID };

    const actionName =
        triggerMode === ScanTrigger.MANUAL
            ? 'Manual well-architected analysis for databases'
            : 'Scheduled well-architected analysis for Databases';

    logger.info('WAD: handling scan request', {
        taskId,
        accountId,
        regions,
        credentialsIds,
        configurationIds,
        triggerMode,
        isSimulated
    });

    if (isSimulated) {
        logger.info('WAD: handling simulated scan request', {
            taskId,
            accountId,
            regions,
            credentialsIds,
            configurationIds
        });
        const scanTask = trackerParentTaskId
            ? await createTrackerTask(accountId, {
                  parentTaskId: trackerParentTaskId,
                  status: TrackerTaskStatus.PENDING,
                  actionName,
                  resourceId: accountId,
                  resourceName: accountId
              })
            : undefined;
        const configurations = buildSimulatedWadScanConfigurations(req);
        if (configurations.length > 0) {
            publishScanResult({
                ...baseStatus,
                completedAt: Date.now(),
                configurations
            });
        }
        publishScanStatus({ ...baseStatus, updatedAt: Date.now(), status: TaskStatus.COMPLETED });
        updateTrackerTaskStatus(accountId, scanTask?.id ?? '', { status: TrackerTaskStatus.SUCCESS });
        return;
    }

    const scanTask = trackerParentTaskId
        ? await createTrackerTask(accountId, {
              parentTaskId: trackerParentTaskId,
              status: TrackerTaskStatus.PENDING,
              actionName,
              resourceId: accountId,
              resourceName: accountId
          })
        : undefined;
    const scanTaskId = scanTask?.id ?? '';
    let status: TaskStatus = TaskStatus.COMPLETED;
    let errorMessage = '';
    try {
        logger.info('WAD: handling scan request', { taskId, accountId, regions, credentialsIds, configurationIds });

        const baseCtx = { ...baseStatus, configurationIds };
        const pairs = credentialsIds.flatMap(credentialsId => regions.map(region => ({ credentialsId, region })));

        const settled = await Promise.allSettled(
            pairs.map(({ credentialsId, region }) =>
                throat(3, async () => {
                    const relationship = await buildEc2FsxRelationship(accountId, credentialsId, region);
                    const allAssessments = await collectOntapAssessmentData(accountId, relationship, scanTaskId);
                    // One scan per filesystem+workload, even if multiple EC2s share the same FSx.
                    const storageAssessments = [
                        ...new Map(allAssessments.map(a => [`${a.fileSystemId}:${a.workloadType}`, a])).values()
                    ];
                    const pairConfigs: WadConfigurationEntry[] = [];

                    for (const {
                        workloadType,
                        fileSystemId,
                        storageAssessment,
                        headroomData,
                        snapcenterData
                    } of storageAssessments) {
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
                                storageAssessment,
                                headroomData,
                                snapcenterData
                            );
                            pairConfigs.push(...configurations);
                        }
                    }

                    return pairConfigs;
                })()
            )
        );

        // Log + collect every failed pair individually; none of them are silently dropped.
        const errors: string[] = [];
        const allConfigurations: WadConfigurationEntry[] = [];
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

            publishScanResult(scanRecord);
        }

        status = errors.length === 0 ? TaskStatus.COMPLETED : TaskStatus.FAILED;
        errorMessage = `${errors.length}/${pairs.length} pair(s) failed: ${errors.join('; ')}`;
    } catch (err) {
        logger.error('WAD: scan request failed', { taskId, err });
        status = TaskStatus.FAILED;
        errorMessage = err instanceof Error ? err.message : String(err);
    } finally {
        publishScanStatus({
            ...baseStatus,
            updatedAt: Date.now(),
            status,
            errorMessage
        });
        updateTrackerTaskStatus(accountId, scanTaskId, {
            status: status === TaskStatus.COMPLETED ? TrackerTaskStatus.SUCCESS : TrackerTaskStatus.FAILURE,
            ...(status === TaskStatus.FAILED && { failureReason: [errorMessage] })
        });
    }
}

/**
 * Handles an inbound FixRequestMessage from WAD Manager.
 * Applies per-resource fix logic then publishes result + final status.
 */
async function handleFixRequest(req: FixRequestMessage): Promise<void> {
    const {
        taskId,
        requestId,
        accountId,
        configurationId,
        parentResource,
        resourceIds,
        trackerParentTaskId,
        isSimulated,
        metadata
    } = req;
    const baseResult = {
        taskId,
        requestId,
        accountId,
        serviceId: WAD_SERVICE_ID,
        configurationId,
        parentResourceId: parentResource.id
    };

    logger.info('WAD: handling fix request', {
        taskId,
        configurationId,
        resourceCount: resourceIds?.length,
        isSimulated
    });
    const actionName = `Databases well-architected fix for ${configurationId}`;
    const actionDescription = `Fixing ${resourceIds?.length} resource(s)`;
    if (req.isSimulated) {
        const fixTask = trackerParentTaskId
            ? await createTrackerTask(accountId, {
                  parentTaskId: trackerParentTaskId,
                  status: TrackerTaskStatus.PENDING,
                  actionName,
                  actionDescription,
                  resourceId: resourceIds.join(','),
                  resourceName: resourceIds.join(',')
              })
            : undefined;
        publishFixResult({
            ...baseResult,
            resourceResults: (resourceIds ?? []).map(resourceId => ({ resourceId, success: true })),
            reportedAt: Date.now()
        });
        publishFixStatus({ ...baseResult, updatedAt: Date.now(), status: TaskStatus.COMPLETED });
        updateTrackerTaskStatus(accountId, fixTask?.id ?? '', { status: TrackerTaskStatus.SUCCESS });
        return;
    }

    const { status: existingStatus } =
        (trackerParentTaskId ? await getTrackerTask(accountId, trackerParentTaskId) : undefined) ?? {};

    if (existingStatus === TrackerTaskStatus.SUCCESS || existingStatus === TrackerTaskStatus.FAILURE) {
        logger.info('WAD: fix request already resolved, skipping', { taskId, status: existingStatus });
        publishFixStatus({
            ...baseResult,
            updatedAt: Date.now(),
            status: existingStatus === TrackerTaskStatus.SUCCESS ? TaskStatus.COMPLETED : TaskStatus.FAILED
        });
        return;
    }

    const fixTask = await createTrackerTask(accountId, {
        parentTaskId: trackerParentTaskId,
        status: TrackerTaskStatus.PENDING,
        actionName,
        actionDescription,
        resourceId: resourceIds.join(','),
        resourceName: resourceIds.join(',')
    });

    let status = TrackerTaskStatus.SUCCESS;
    let errorMessage = '';
    try {
        const resourceResults = await applyOntapStorageFix({
            accountId,
            fsxId: parentResource.id,
            region: parentResource.region,
            svmName: (metadata?.svmName as string | undefined) ?? '',
            configurationId: configurationId.replace(`${WAD_SERVICE_ID}-`, ''),
            resourceIds,
            value: metadata?.value as string | undefined
        });

        publishFixResult({ ...baseResult, resourceResults, reportedAt: Date.now() });

        const failedResults = resourceResults.filter(({ success }) => !success);
        if (failedResults.length > 0) {
            status = TrackerTaskStatus.FAILURE;
            errorMessage = failedResults
                .map(({ resourceId, failureReason: reason }) => `${resourceId}: ${reason ?? 'Unknown error'}`)
                .join('; ');
        }
    } catch (err) {
        logger.error('WAD: fix request failed', { taskId, configurationId, err });
        errorMessage = err instanceof Error ? err.message : String(err);
        status = TrackerTaskStatus.FAILURE;
    } finally {
        publishFixStatus({
            ...baseResult,
            updatedAt: Date.now(),
            ...(status === TrackerTaskStatus.SUCCESS
                ? { status: TaskStatus.COMPLETED }
                : { status: TaskStatus.FAILED, errorMessage })
        });
        updateTrackerTaskStatus(accountId, fixTask?.id ?? '', {
            status,
            ...(status === TrackerTaskStatus.FAILURE && { failureReason: [errorMessage] })
        });
    }
}

export { handleScanRequest, handleFixRequest };
