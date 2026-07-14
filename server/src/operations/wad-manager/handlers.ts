import { flatMap, map } from 'lodash-es';
import throat from 'throat';
import getLogger from '../../utils/logger';
import {
    FixRequestMessage,
    ScanRequestMessage,
    TaskStatus,
    WAD_SERVICE_ID,
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

type WorkloadScanFn = (
    ctx: WadScanContext,
    storageAssessment: FsxStorageCollectionResult['storageAssessment']
) => Promise<WadScanResultRecord[]>;

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
        const pairs = flatMap(credentialsIds, credentialsId => map(regions, region => ({ credentialsId, region })));

        const settled = await Promise.allSettled(
            pairs.map(({ credentialsId, region }) =>
                throat(3, async () => {
                    const relationship = await buildEc2FsxRelationship(accountId, credentialsId, region);
                    const storageAssessments = await collectOntapAssessmentData(accountId, relationship);

                    for (const { workloadType, fileSystemId, storageAssessment } of storageAssessments) {
                        const scanFn = WORKLOAD_SCAN_FNS[workloadType];
                        if (scanFn) {
                            // eslint-disable-next-line no-await-in-loop
                            const scanRecords = await scanFn(
                                {
                                    ...baseCtx,
                                    credentialsId,
                                    region,
                                    filesystemId: fileSystemId,
                                    workload: workloadType
                                },
                                storageAssessment
                            );
                            scanRecords.forEach(publishScanResult);
                        }
                    }
                })()
            )
        );

        // Log + collect every failed pair individually; none of them are silently dropped.
        const errors = settled.reduce<string[]>((acc, result, i) => {
            if (result.status !== 'rejected') {
                return acc;
            }
            const { credentialsId, region } = pairs[i];
            const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
            logger.error('WAD: scan failed for credentials/region pair', { taskId, credentialsId, region, message });
            return [...acc, `${credentialsId}/${region}: ${message}`];
        }, []);

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

        publishFixResult({
            taskId,
            requestId,
            accountId,
            serviceId: WAD_SERVICE_ID,
            configurationId,
            parentResourceId: parentResource.id,
            resourceResults,
            reportedAt: Date.now()
        });

        publishFixStatus({
            taskId,
            requestId,
            accountId,
            serviceId: WAD_SERVICE_ID,
            configurationId,
            parentResourceId: parentResource.id,
            updatedAt: Date.now(),
            status: TaskStatus.COMPLETED
        });
    } catch (err) {
        logger.error('WAD: fix request failed', { taskId, configurationId, err });
        publishFixStatus({
            taskId,
            requestId,
            accountId,
            serviceId: WAD_SERVICE_ID,
            configurationId,
            parentResourceId: parentResource.id,
            updatedAt: Date.now(),
            status: TaskStatus.FAILED,
            errorMessage: err instanceof Error ? err.message : String(err)
        });
    }
}

export { handleScanRequest, handleFixRequest };
