import throat from 'throat';
import { AssessmentItemType } from '../../routes/types/continuous-optimization.types';
import { AssessmentStatus, MIN_OPTIMIZED_HEADROOM_PERCENTAGE } from '../../utils/continous-optimization-consts';
import { DriftAssessmentDetail, FixResourceResult } from '../../utils/wad-consts';
import { calculateFsxStorageCapacityForHeadroomOptimization } from '../../utils/utils';
import { RESOURCESTYPE } from '../../utils/consts';
import { GoldenConfigEntry } from './assessment-utils';
import type { OneTimeWADHeadroomData } from '../../utils/common-types';
import getLogger from '../../utils/logger';
import { describeFSx, updateFsxCapacity } from '../../lib/aws/fsx';
import { collectOntapHeadroomData } from './ontap-proxy-collector';
import { MSSQL_GOLDEN_CONFIG } from './mssql/golden-config';
import ORACLE_GOLDEN_CONFIG from './oracle/golden-config';

const logger = getLogger();

type HeadroomDriftResult = AssessmentItemType & { assessmentDetails: DriftAssessmentDetail[] };

interface WadHeadroomFixParams {
    accountId: string;
    credentialsId: string;
    region: string;
    fileSystemIds: string[];
    workload?: string;
    isSimulated?: boolean;
}

function calculateWADHeadroomDrift(
    fsxFileSystemId: string,
    headroomData: OneTimeWADHeadroomData,
    goldenConfig: GoldenConfigEntry | undefined,
    workloadType: RESOURCESTYPE.MSSQL | RESOURCESTYPE.ORACLE,
    fsxFileSystemName?: string
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
            name: fsxFileSystemName || fsxFileSystemId,
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

async function applyWadHeadroomFix({
    accountId,
    credentialsId,
    region,
    fileSystemIds,
    workload,
    isSimulated
}: WadHeadroomFixParams): Promise<FixResourceResult[]> {
    logger.info('WAD headroom: applying fix', {
        accountId,
        credentialsId,
        region,
        fileSystemIds,
        workload,
        isSimulated
    });

    if (!workload) {
        logger.error('WAD headroom: Skipping fix as workload is empty', { fileSystemIds, workload });
        return [
            {
                resourceId: fileSystemIds.join(','),
                success: false,
                failureReason: 'Unable to fix headroom as workload is empty'
            }
        ];
    }
    const workloadType = workload === 'mssql' ? RESOURCESTYPE.MSSQL : RESOURCESTYPE.ORACLE;
    return Promise.all(
        fileSystemIds.map(
            throat(3, async (fileSystemId: string) => {
                if (isSimulated) {
                    logger.info('WAD headroom: simulated fix, skipping capacity update', {
                        fileSystemId,
                        workload
                    });
                    return { resourceId: fileSystemId, success: true };
                }

                try {
                    const headroomData = await collectOntapHeadroomData(accountId, fileSystemId, region, credentialsId);
                    if (!headroomData) {
                        throw new Error('Unable to collect storage headroom data for this file system.');
                    }

                    const goldenConfigs = workload === 'mssql' ? MSSQL_GOLDEN_CONFIG : ORACLE_GOLDEN_CONFIG;
                    const goldenConfig = goldenConfigs.find(config => config.id === 'headroom');

                    const drift = calculateWADHeadroomDrift(fileSystemId, headroomData, goldenConfig, workloadType);
                    if (!drift) {
                        throw new Error('Unable to assess file system headroom. Try again later.');
                    }

                    const { recommendedSizeInGib, status } = drift;
                    if (status === AssessmentStatus.UNDER_PROVISIONED && recommendedSizeInGib) {
                        const fsxInfo = await describeFSx(
                            credentialsId,
                            region,
                            { FileSystemIds: [fileSystemId] },
                            accountId,
                            { useCache: false }
                        );
                        const [fileSystem = {}] = fsxInfo.FileSystems ?? [];
                        const existingFsxStorageCapacityGiB = fileSystem.StorageCapacity;
                        if (existingFsxStorageCapacityGiB && existingFsxStorageCapacityGiB < recommendedSizeInGib) {
                            await updateFsxCapacity(
                                credentialsId,
                                region,
                                accountId,
                                fileSystemId,
                                recommendedSizeInGib
                            );
                        } else {
                            throw new Error(
                                `Capacity already meets the recommended size, no update required for ${fileSystemId}.`
                            );
                        }
                    } else if (status === AssessmentStatus.OVER_PROVISIONED) {
                        throw new Error(
                            `File system headroom is over-provisioned. Capacity decrease is not automated for ${fileSystemId}.`
                        );
                    } else {
                        throw new Error(
                            `File system headroom is already optimized. No capacity increase required for ${fileSystemId}.`
                        );
                    }

                    logger.info('WAD headroom: fix completed', { fileSystemId, workloadType, status });
                    return { resourceId: fileSystemId, success: true };
                } catch (error) {
                    logger.error('WAD headroom: fix failed', { fileSystemId, workloadType, error });
                    return {
                        resourceId: fileSystemId,
                        success: false,
                        failureReason: `Unable to optimize file system headroom. Reason: ${
                            error instanceof Error ? error.message : String(error)
                        }`
                    };
                }
            })
        )
    );
}

export { applyWadHeadroomFix, calculateWADHeadroomDrift };
