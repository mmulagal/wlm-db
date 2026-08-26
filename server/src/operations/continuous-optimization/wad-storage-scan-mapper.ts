import { AssessmentErrorItemType } from '../../routes/types/continuous-optimization.types';
import { ASSESSMENT_RESOURCE_TYPE, AssessmentStatus } from '../../utils/continous-optimization-consts';
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

const COMPONENT_RESOURCE_TYPES = new Set([
    ASSESSMENT_RESOURCE_TYPE.VOLUME,
    ASSESSMENT_RESOURCE_TYPE.LUN,
    ASSESSMENT_RESOURCE_TYPE.VOLUME_OR_LUN
]);

function toConfigurationEntry(
    ctx: WadScanContext,
    driftAssessmentItem: DriftAssessmentItem,
    prefixedConfigurationId: string
): WadConfigurationEntry {
    const { resourceType, assessmentDetails } = driftAssessmentItem;
    const {
        taskId,
        requestId,
        accountId,
        serviceId,
        filesystemId,
        fsxName,
        credentialsId,
        region,
        workload,
        fsxVolumeIdByUuid
    } = ctx;
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
            name: fsxName ?? filesystemId,
            type: WAD_FILESYSTEM_RESOURCE_TYPE,
            accountId,
            region,
            credentialsIds: [credentialsId]
        },
        resources: (assessmentDetails ?? []).map(({ id, name, status, svmName, metadata }): WadResourceEntry => {
            const fsxVolumeId = fsxVolumeIdByUuid?.[id];
            const components = metadata?.components ?? [];
            return {
                resource: {
                    id: fsxVolumeId ?? id,
                    type: resourceType ?? '',
                    name,
                    metadata: {
                        workload,
                        components: COMPONENT_RESOURCE_TYPES.has(resourceType ?? '')
                            ? components.map(component => ({ ...component, id }))
                            : components,
                        ...(svmName !== undefined && { svmName })
                    }
                },
                status:
                    status === AssessmentStatus.OPTIMIZED
                        ? ResourceOptimizationStatus.OPTIMIZED
                        : ResourceOptimizationStatus.NOT_OPTIMIZED
            };
        })
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
        if (
            'errorMessage' in item ||
            (configurationIds?.length && !configurationIds.includes(prefixedConfigurationId))
        ) {
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
