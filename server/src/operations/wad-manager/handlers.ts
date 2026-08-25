import throat from 'throat';
import getLogger from '../../utils/logger';
import {
    FixRequestMessage,
    FixResourceResult,
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
import { getFsxVolumeDetails } from '../aws/fsx-operations';
import { applyWadHeadroomFix } from '../continuous-optimization/wad-headroom-utils';

const logger = getLogger();
const FSX_VOLUME_ID_PREFIX = 'fsvol-';

/**
 * WAD storage note: the downstream `setResult` call is a plain Redis SET EX, so sending two
 * entries with the same (configurationId + parentResource.id) causes a full overwrite of the
 * earlier entry. Merge all resources under a single entry per key before publishing to avoid
 * silently losing data.
 *
 * Within a merged entry, the same underlying resource can be reported more than once (e.g. an
 * EC2 shared across scan pairs, or a resource re-scanned for the same workload). Dedupe on
 * (filesystemId, configurationId, workloadType, resourceId) so each resource appears once.
 */
function mergeConfigurations(configs: WadConfigurationEntry[]): WadConfigurationEntry[] {
    const merged = new Map<string, { entry: WadConfigurationEntry; resourceKeys: Set<string> }>();

    for (const { parentResource, configurationId, resources } of configs) {
        const { accountId, credentialsIds, region, id } = parentResource;
        const entryKey = `${accountId}:${credentialsIds.join(',')}:${region}:${id}:${configurationId}`;
        const group = merged.get(entryKey) ?? {
            entry: { parentResource, configurationId, resources: [] },
            resourceKeys: new Set<string>()
        };
        merged.set(entryKey, group);

        for (const resourceEntry of resources) {
            const {
                resource: { id: resourceId, metadata }
            } = resourceEntry;
            const resourceKey = `${metadata?.workload ?? ''}:${resourceId}`;
            if (!group.resourceKeys.has(resourceKey)) {
                group.resourceKeys.add(resourceKey);
                group.entry.resources.push(resourceEntry);
            }
        }
    }

    return [...merged.values()].map(({ entry }) => {
        const { configurationId, resources } = entry;
        if (configurationId !== `${WAD_SERVICE_ID}-headroom`) {
            return entry;
        }
        const mssqlIds = new Set(
            resources.flatMap(({ resource: { id: resourceId, metadata } }) =>
                metadata?.workload === 'mssql' ? [resourceId] : []
            )
        );
        return {
            ...entry,
            resources: resources.filter(
                ({ resource: { id: resourceId, metadata } }) =>
                    metadata?.workload !== 'oracle' || !mssqlIds.has(resourceId)
            )
        };
    });
}

async function resolveFixResourceIds(
    accountId: string,
    credentialsId: string,
    region: string,
    fileSystemId: string,
    resourceIds: string[],
    isSimulated?: boolean
) {
    const fsxVolumeIds = isSimulated ? [] : resourceIds.filter(id => id.startsWith(FSX_VOLUME_ID_PREFIX));
    const volumes =
        fsxVolumeIds.length > 0
            ? await getFsxVolumeDetails(credentialsId, region, fileSystemId, fsxVolumeIds, accountId, {
                  useCache: false
              })
            : [];
    const ontapUuidByFsxVolumeId = new Map(
        volumes.flatMap(({ VolumeId, OntapConfiguration: { UUID } = {} }) =>
            VolumeId && UUID ? [[VolumeId, UUID] as const] : []
        )
    );

    const unresolvedResourceIds = fsxVolumeIds.filter(id => !ontapUuidByFsxVolumeId.has(id));
    const resourceIdByOntapId = new Map(
        resourceIds
            .filter(id => !unresolvedResourceIds.includes(id))
            .map(id => [ontapUuidByFsxVolumeId.get(id) ?? id, id] as const)
    );

    return { resourceIdByOntapId, unresolvedResourceIds };
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
            ? await createTrackerTask(
                  accountId,
                  {
                      parentTaskId: trackerParentTaskId,
                      status: TrackerTaskStatus.PENDING,
                      actionName,
                      resourceId: accountId,
                      resourceName: accountId
                  },
                  isSimulated
              )
            : undefined;
        const configurations = buildSimulatedWadScanConfigurations(req);
        if (configurations.length > 0) {
            publishScanResult({
                ...baseStatus,
                completedAt: Date.now(),
                configurations
            });
        }
        publishScanStatus({
            ...baseStatus,
            updatedAt: Date.now(),
            status: TaskStatus.COMPLETED,
            hasFailedTasks: false
        });
        updateTrackerTaskStatus(accountId, scanTask?.id ?? '', { status: TrackerTaskStatus.SUCCESS }, isSimulated);
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
                    const storageAssessments = await collectOntapAssessmentData(
                        accountId,
                        credentialsId,
                        relationship,
                        scanTaskId
                    );
                    const ontapUuidToFsxVolumeId = new Map(
                        relationship.ec2s.flatMap(({ fsxs }) =>
                            fsxs.flatMap(({ volumes }) =>
                                volumes.map(({ volumeUuid, fsxVolumeId }) => [volumeUuid, fsxVolumeId] as const)
                            )
                        )
                    );
                    const pairConfigs: WadConfigurationEntry[] = [];

                    for (const {
                        workloadType,
                        fileSystemId,
                        fsxName,
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
                                    fsxName,
                                    workload: workloadType,
                                    ontapUuidToFsxVolumeId
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
            errorMessage,
            hasFailedTasks: status === TaskStatus.FAILED
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

    const { status: existingStatus } =
        (trackerParentTaskId ? await getTrackerTask(accountId, trackerParentTaskId, isSimulated) : undefined) ?? {};

    if (existingStatus === TrackerTaskStatus.SUCCESS || existingStatus === TrackerTaskStatus.FAILURE) {
        logger.info('WAD: fix request already resolved, skipping', { taskId, status: existingStatus });
        publishFixStatus({
            ...baseResult,
            updatedAt: Date.now(),
            status: existingStatus === TrackerTaskStatus.SUCCESS ? TaskStatus.COMPLETED : TaskStatus.FAILED,
            hasFailedTasks: existingStatus === TrackerTaskStatus.FAILURE
        });
        return;
    }

    const fixTask = await createTrackerTask(
        accountId,
        {
            parentTaskId: trackerParentTaskId,
            status: TrackerTaskStatus.PENDING,
            actionName,
            actionDescription,
            resourceId: resourceIds.join(','),
            resourceName: resourceIds.join(',')
        },
        isSimulated
    );

    let status = TrackerTaskStatus.SUCCESS;
    let errorMessage = '';
    try {
        const credentialsId = parentResource.credentialsIds[0];
        let resourceResults: FixResourceResult[];

        if (configurationId === `${WAD_SERVICE_ID}-headroom`) {
            resourceResults = await applyWadHeadroomFix({
                accountId,
                credentialsId,
                region: parentResource.region,
                fileSystemIds: resourceIds,
                workload: metadata?.workload as string,
                isSimulated
            });
        } else {
            const { resourceIdByOntapId, unresolvedResourceIds } = await resolveFixResourceIds(
                accountId,
                credentialsId,
                parentResource.region,
                parentResource.id,
                resourceIds,
                isSimulated
            );

            const ontapResourceResults =
                resourceIdByOntapId.size > 0
                    ? await applyOntapStorageFix({
                          accountId,
                          credentialsId,
                          fsxId: parentResource.id,
                          region: parentResource.region,
                          svmName: (metadata?.svmName as string | undefined) ?? '',
                          configurationId: configurationId.replace(`${WAD_SERVICE_ID}-`, ''),
                          resourceIds: [...resourceIdByOntapId.keys()],
                          value: metadata?.value as string | undefined,
                          workload: metadata?.workload as string,
                          isSimulated,
                          useRest: true
                      })
                    : [];
            resourceResults = [
                ...ontapResourceResults.map(({ resourceId, ...result }) => ({
                    ...result,
                    resourceId: resourceIdByOntapId.get(resourceId) ?? resourceId
                })),
                ...unresolvedResourceIds.map(resourceId => ({
                    resourceId,
                    success: false,
                    failureReason: 'Unable to resolve ONTAP uuid for FSx volume'
                }))
            ];
        }

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
                : { status: TaskStatus.FAILED, errorMessage }),
            hasFailedTasks: status === TrackerTaskStatus.FAILURE
        });
        updateTrackerTaskStatus(
            accountId,
            fixTask?.id ?? '',
            {
                status,
                ...(status === TrackerTaskStatus.FAILURE && { failureReason: [errorMessage] })
            },
            isSimulated
        );
    }
}

export { handleScanRequest, handleFixRequest };
