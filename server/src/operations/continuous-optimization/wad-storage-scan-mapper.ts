import { AssessmentErrorItemType } from '../../routes/types/continuous-optimization.types';
import { AssessmentStatus } from '../../utils/continous-optimization-consts';
import {
    DriftAssessmentItem,
    ResourceOptimizationStatus,
    ResourceScanRecord,
    WAD_FILESYSTEM_RESOURCE_TYPE,
    WadScanContext,
    WadScanResultRecord
} from '../../utils/wad-consts';
import getLogger from '../../utils/logger';

const logger = getLogger();

function toScanResultRecord(
    ctx: WadScanContext,
    driftAssessmentItem: DriftAssessmentItem,
    prefixedConfigurationId: string
): WadScanResultRecord {
    const { resourceType, assessmentDetails } = driftAssessmentItem;
    const { taskId, requestId, accountId, serviceId, filesystemId, credentialsId, region, workload } = ctx;
    logger.info('Mapping drift to WAD scan record', {
        accountId,
        credentialsId,
        region,
        taskId,
        requestId,
        serviceId,
        filesystemId,
        workload
    });

    return {
        taskId,
        requestId,
        accountId,
        serviceId,
        completedAt: Date.now(),
        configurationId: prefixedConfigurationId,
        parentResource: {
            id: filesystemId,
            name: '',
            type: WAD_FILESYSTEM_RESOURCE_TYPE,
            region,
            credentialsIds: [credentialsId]
        },
        resources: (assessmentDetails ?? []).map(
            ({ id, name, currentValue, recommendedValue, status, svmName }): ResourceScanRecord => ({
                id,
                type: resourceType ?? '',
                name,
                optimizationStatus:
                    status === AssessmentStatus.OPTIMIZED
                        ? ResourceOptimizationStatus.OPTIMIZED
                        : ResourceOptimizationStatus.NOT_OPTIMIZED,
                isDismissed: false,
                metadata: {
                    recommended: recommendedValue,
                    current: currentValue,
                    parameterName: prefixedConfigurationId,
                    workload,
                    ...(svmName !== undefined && { svmName })
                }
            })
        )
    };
}

async function mapDriftToWadScanRecords(
    ctx: WadScanContext,
    assessmentData: (DriftAssessmentItem | AssessmentErrorItemType)[]
): Promise<WadScanResultRecord[]> {
    const { serviceId, configurationIds, accountId, credentialsId, region } = ctx;
    logger.info('Mapping drift to WAD scan records', { accountId, credentialsId, region });
    return assessmentData.flatMap(item => {
        const prefixedConfigurationId = `${serviceId}-${item.id}`;
        if ('errorMessage' in item || !configurationIds.includes(prefixedConfigurationId)) {
            return [];
        }
        return [toScanResultRecord(ctx, item, prefixedConfigurationId)];
    });
}

export { mapDriftToWadScanRecords };
