import { AssessmentItemType } from '../../routes/types/continuous-optimization.types';
import { AssessmentStatus, MIN_OPTIMIZED_HEADROOM_PERCENTAGE } from '../../utils/continous-optimization-consts';
import { DriftAssessmentDetail } from '../../utils/wad-consts';
import { calculateFsxStorageCapacityForHeadroomOptimization } from '../../utils/utils';
import { RESOURCESTYPE } from '../../utils/consts';
import { GoldenConfigEntry } from './assessment-utils';
import type { OneTimeWADHeadroomData } from '../../utils/common-types';
import getLogger from '../../utils/logger';

const logger = getLogger();

type HeadroomDriftResult = AssessmentItemType & { assessmentDetails: DriftAssessmentDetail[] };

function calculateWADHeadroomDrift(
    fsxFileSystemId: string,
    headroomData: OneTimeWADHeadroomData,
    goldenConfig: GoldenConfigEntry | undefined,
    workloadType: RESOURCESTYPE.MSSQL | RESOURCESTYPE.ORACLE
): HeadroomDriftResult | undefined {
    logger.info('WAD headroom: calculating drift', { workloadType, fsxFileSystemId });

    if (!goldenConfig) {
        logger.warn('WAD headroom: golden config not found', { workloadType });
        return undefined;
    }

    const { ssdStorageCapacityInBytes, storageUsedInBytes, headroomPercent } = headroomData;

    if (!ssdStorageCapacityInBytes || headroomPercent === undefined) {
        logger.warn('WAD headroom: data not available, skipping assessment', { workloadType, fsxFileSystemId });
        return undefined;
    }

    const minOptimizedHeadroomPercent = MIN_OPTIMIZED_HEADROOM_PERCENTAGE[workloadType];
    const minSsdStorageCapacityInBytes = 1024 * 1024 * 1024 * 1024;

    let status: AssessmentStatus;
    if (headroomPercent < minOptimizedHeadroomPercent) {
        status = AssessmentStatus.UNDER_PROVISIONED;
    } else if (headroomPercent > 50 && ssdStorageCapacityInBytes > minSsdStorageCapacityInBytes) {
        // Over-provisioned only when capacity exceeds 1 TiB; smaller filesystems are considered optimized
        status = AssessmentStatus.OVER_PROVISIONED;
    } else {
        status = AssessmentStatus.OPTIMIZED;
    }

    let recommendedSizeInGib = 0;
    if (status !== AssessmentStatus.OPTIMIZED && storageUsedInBytes) {
        recommendedSizeInGib = calculateFsxStorageCapacityForHeadroomOptimization(
            storageUsedInBytes,
            ssdStorageCapacityInBytes,
            workloadType
        );
    }

    const assessmentDetails: DriftAssessmentDetail[] = [
        {
            id: fsxFileSystemId,
            name: fsxFileSystemId,
            status,
            metadata: {
                components: [
                    {
                        parameter: 'headroom',
                        current: `${headroomPercent}%`,
                        recommended: `${minOptimizedHeadroomPercent}%`,
                        status
                    }
                ]
            }
        }
    ];

    const result = {
        ...goldenConfig,
        recommended: `${minOptimizedHeadroomPercent}%`,
        status,
        current: `${headroomPercent}%`,
        recommendedSizeInGib,
        objectsInViolation: status !== AssessmentStatus.OPTIMIZED ? [fsxFileSystemId] : [],
        totalObjectsAssessed: 1,
        totalObjectsInViolation: status !== AssessmentStatus.OPTIMIZED ? 1 : 0,
        assessmentDetails
    };

    logger.info('WAD headroom: drift calculated', {
        workloadType,
        fsxFileSystemId,
        headroomPercent,
        status,
        recommendedSizeInGib
    });

    return result;
}

export { calculateWADHeadroomDrift };
