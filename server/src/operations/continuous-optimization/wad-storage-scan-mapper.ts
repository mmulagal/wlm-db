import { AssessmentErrorItemType } from '../../routes/types/continuous-optimization.types';
import { AssessmentStatus } from '../../utils/continous-optimization-consts';
import {
    DriftAssessmentItem,
    ResourceOptimizationStatus,
    WadConfigurationEntry,
    WadResourceEntry,
    WadScanContext,
    WadScanResultRecord,
    WAD_FILESYSTEM_RESOURCE_TYPE
} from '../../utils/wad-consts';
import getLogger from '../../utils/logger';

const logger = getLogger();

function toConfigurationEntry(
    ctx: WadScanContext,
    driftAssessmentItem: DriftAssessmentItem,
    prefixedConfigurationId: string
): WadConfigurationEntry {
    const { resourceType, assessmentDetails } = driftAssessmentItem;
    const { taskId, requestId, accountId, serviceId, filesystemId, credentialsId, region, workload } = ctx;
    logger.info('Mapping drift to WAD configuration entry', {
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
        configurationId: prefixedConfigurationId,
        parentResource: {
            id: filesystemId,
            name: filesystemId,
            type: WAD_FILESYSTEM_RESOURCE_TYPE,
            accountId,
            region,
            credentialsIds: [credentialsId]
        },
        resources: (assessmentDetails ?? []).map(
            ({ id, name, status, svmName, metadata }): WadResourceEntry => ({
                resource: {
                    id,
                    type: resourceType ?? '',
                    name,
                    metadata: {
                        workload,
                        components: metadata?.components ?? [],
                        ...(svmName !== undefined && { svmName })
                    }
                },
                status:
                    status === AssessmentStatus.OPTIMIZED
                        ? ResourceOptimizationStatus.OPTIMIZED
                        : ResourceOptimizationStatus.NOT_OPTIMIZED
            })
        )
    };
}

async function mapDriftToWadScanRecords(
    ctx: WadScanContext,
    assessmentData: (DriftAssessmentItem | AssessmentErrorItemType)[]
): Promise<WadScanResultRecord> {
    const { taskId, requestId, accountId, serviceId, configurationIds, credentialsId, region } = ctx;
    logger.info('Mapping drift to WAD scan record', { accountId, credentialsId, region });

    const configurations = assessmentData.flatMap(item => {
        const prefixedConfigurationId = `${serviceId}-${item.id}`;
        if ('errorMessage' in item || !configurationIds.includes(prefixedConfigurationId)) {
            return [];
        }
        return [toConfigurationEntry(ctx, item, prefixedConfigurationId)];
    });

    return {
        taskId,
        requestId,
        accountId,
        serviceId,
        completedAt: Date.now(),
        configurations
    };
}

export { mapDriftToWadScanRecords };
