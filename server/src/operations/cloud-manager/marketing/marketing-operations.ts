import { isEmpty } from 'lodash-es';
import getLogger from '../../../utils/logger';
import { getEbsManualModeStorageSavings, getFsxwManualModeStorageSavings } from '../../../lib/cloud-manager/marketing';
import {
    EbsCloneCalculationType,
    EBSCostCalculationRespType,
    EbsCostCalculationType,
    EbsSnapshotCalculationType,
    ManualStorageSavingsRequestBodyType,
    StorageSavingsCalculationsMetricsType,
    StorageSavingsRequestBodyType
} from '../../../routes/types/storage-savings.types';
import { camelizeKeys, convertToBytes, isMultiAzDeployment } from '../../../utils/utils';
import {
    EbsVolumeTypesCalculation,
    FsxCalculation,
    FsxNoSnapshotCalculation,
    ManualModeComparisionResponse,
    ManualModeEbsComparisonV2Response,
    ManualModeFsxwComparisonResponse
} from '../../../utils/marketing-types';
import {
    deriveFsxCostCalculation,
    derivePropertiesBasedOnDeploymentType,
    formatEbsCalculationObject,
    invokeMarketingApi
} from './marketing-operations-utils';
import {
    getEbsMarketingApiManualModeRequestBody,
    getFsxwMarketingApiManualModeRequestBody
} from './marketing-request-utils';

const logger = getLogger();

/* eslint-disable camelcase */

function handleMarketingApiFsxCalculationObject(
    fsxCalculationData: FsxCalculation,
    fsxCalculationDataNoSnapshot?: FsxNoSnapshotCalculation
) {
    logger.debug('Handling marketing FSx calculation object', fsxCalculationData);

    const fsxCalculationObject = camelizeKeys(fsxCalculationData);
    const { totalStorageCapacity, effectiveCapacity, ssdTierReqCapacity, capacityPoolTier, monthlySnapshotCapacity } =
        fsxCalculationObject;
    const { desiredStorageCapacityGB: desiredStorageCapacity, EBSCapacity: ebsCapacity } =
        fsxCalculationDataNoSnapshot || {};

    const capacities = [
        { totalStorageCapacity },
        { effectiveCapacity },
        { ssdTierReqCapacity },
        { capacityPoolTier },
        { monthlySnapshotCapacity },
        { desiredStorageCapacity },
        { ebsCapacity }
    ];

    capacities.forEach(capacity => {
        const [key] = Object.keys(capacity);
        const { size, unit } = (capacity as any)[key] as { size: number; unit: string };
        fsxCalculationObject[`${key}`] = convertToBytes(size, unit);
    });

    return fsxCalculationObject;
}

// Snapshot and clone calculations are derived from primary instance only.
async function derivePrimaryInstanceEbsCostCalculation(
    ebsResults: EbsVolumeTypesCalculation,
    clonedCopiesCount: number,
    monthlyChangeRatePercentage: number
) {
    logger.info('Deriving primary instance EBS cost calculation', {
        ebsResults,
        clonedCopiesCount,
        monthlyChangeRatePercentage
    });

    const { gp2, gp3, io1, io2, st1 } = ebsResults || {};
    const ebsCalculationBreakdown = {
        ...(gp2 && {
            gp2: formatEbsCalculationObject(
                gp2.ebs,
                gp2.ebs_cost_calculation,
                clonedCopiesCount,
                monthlyChangeRatePercentage
            )
        }),
        ...(gp3 && {
            gp3: formatEbsCalculationObject(
                gp3.ebs,
                gp3.ebs_cost_calculation,
                clonedCopiesCount,
                monthlyChangeRatePercentage
            )
        }),
        ...(io1 && {
            io1: formatEbsCalculationObject(
                io1.ebs,
                io1.ebs_cost_calculation,
                clonedCopiesCount,
                monthlyChangeRatePercentage
            )
        }),
        ...(io2 && {
            io2: formatEbsCalculationObject(
                io2.ebs,
                io2.ebs_cost_calculation,
                clonedCopiesCount,
                monthlyChangeRatePercentage
            )
        }),
        ...(st1 && {
            st1: formatEbsCalculationObject(
                st1.ebs,
                st1.ebs_cost_calculation,
                clonedCopiesCount,
                monthlyChangeRatePercentage
            )
        })
    };

    const ebsCalculation: { [key: string]: EbsCostCalculationType } = {};
    const ebsCloneCalculation: { [key: string]: EbsCloneCalculationType } = {};
    const ebsSnapshotCalculation: { [key: string]: EbsSnapshotCalculationType } = {};
    Object.entries(ebsCalculationBreakdown).forEach(([key, value]) => {
        ebsCalculation[key] = value.ebsCostCalculation;
    });

    Object.entries(ebsCalculationBreakdown).forEach(([key, value]) => {
        ebsCloneCalculation[key] = value.ebsCloneCalculation;
    });

    Object.entries(ebsCalculationBreakdown).forEach(([key, value]) => {
        if (value.ebsSnapshotCalculation.totalSnapshotCost > 0) {
            ebsSnapshotCalculation[key] = value.ebsSnapshotCalculation;
        }
    });

    return {
        ebsCloneCalculation,
        ebsSnapshotCalculation
    };
}

async function formatManualStorageSavingsCalculationMetrics(
    accountId: string,
    region: string,
    params: ManualStorageSavingsRequestBodyType
): Promise<StorageSavingsCalculationsMetricsType> {
    logger.info('Formatting manual storage savings calculation metrics', { accountId, region, params });

    if (params.ec2Instances[0].volumes) {
        const ebsMarketingRequestBody = getEbsMarketingApiManualModeRequestBody(region, params);

        const { primaryInstanceVolumes: primaryVolumes, secondaryInstanceVolumes: secondaryVolumes } =
            ebsMarketingRequestBody;
        let ebsMarketingRequestBodyWithPrimaryVolumes;
        if (!isEmpty(secondaryVolumes)) {
            // If there are secondary volumes, create a request body with only primary volumes to get snapshot and clone calculations
            ebsMarketingRequestBodyWithPrimaryVolumes = {
                ...ebsMarketingRequestBody,
                volumes: primaryVolumes
            };
        }

        const [allVolumesPromise, primaryVolumesPromise] = await Promise.all([
            getEbsManualModeStorageSavings<ManualModeEbsComparisonV2Response>(accountId, ebsMarketingRequestBody),
            ebsMarketingRequestBodyWithPrimaryVolumes
                ? getEbsManualModeStorageSavings<ManualModeEbsComparisonV2Response>(
                      accountId,
                      ebsMarketingRequestBodyWithPrimaryVolumes
                  )
                : Promise.resolve({} as ManualModeEbsComparisonV2Response)
        ]);

        const {
            ebsResults: allEbsResults,
            fsx_calculation,
            fsx_clone_cost_calculation,
            fsx_cost_calculation_no_snapshot,
            fsx_snapshot_cost_calculation,
            fsx_optimized,
            fsx_optimized_single,
            fsx,
            ebsTotal
        } = allVolumesPromise;

        // Get primary volumes response for snapshot and clone calculations
        const { ebsResults } = primaryVolumesPromise;

        const { ebsSnapshotCalculation, ebsCloneCalculation } = await derivePrimaryInstanceEbsCostCalculation(
            isEmpty(ebsResults) ? allEbsResults : ebsResults, // If primary volumes response is empty, use all volumes response; this can happen if there are no secondary volumes i.e in case of Standalone deployment
            params.clonedCopiesCount,
            params.monthlyChangeRatePercentage
        );

        const { gp2: gp2Raw, gp3: gp3Raw, io2: io2Raw, st1: st1Raw, io1: io1Raw } = allEbsResults || {};

        const ebsCalculationBreakdown = {
            ...(gp2Raw && {
                gp2: formatEbsCalculationObject(
                    gp2Raw.ebs,
                    gp2Raw.ebs_cost_calculation,
                    params.clonedCopiesCount,
                    params.monthlyChangeRatePercentage
                )
            }),
            ...(gp3Raw && {
                gp3: formatEbsCalculationObject(
                    gp3Raw.ebs,
                    gp3Raw.ebs_cost_calculation,
                    params.clonedCopiesCount,
                    params.monthlyChangeRatePercentage
                )
            }),
            ...(io2Raw && {
                io2: formatEbsCalculationObject(
                    io2Raw.ebs,
                    io2Raw.ebs_cost_calculation,
                    params.clonedCopiesCount,
                    params.monthlyChangeRatePercentage
                )
            }),
            ...(st1Raw && {
                st1: formatEbsCalculationObject(
                    st1Raw.ebs,
                    st1Raw.ebs_cost_calculation,
                    params.clonedCopiesCount,
                    params.monthlyChangeRatePercentage
                )
            }),
            ...(io1Raw && {
                io1: formatEbsCalculationObject(
                    io1Raw.ebs,
                    io1Raw.ebs_cost_calculation,
                    params.clonedCopiesCount,
                    params.monthlyChangeRatePercentage
                )
            })
        };

        const allVolumesEbsCalculation: EBSCostCalculationRespType = {
            ...(!isEmpty(ebsCalculationBreakdown.gp2?.ebsCostCalculation) && {
                gp2: ebsCalculationBreakdown.gp2.ebsCostCalculation
            }),
            ...(!isEmpty(ebsCalculationBreakdown.gp3?.ebsCostCalculation) && {
                gp3: ebsCalculationBreakdown.gp3.ebsCostCalculation
            }),
            ...(!isEmpty(ebsCalculationBreakdown.io2?.ebsCostCalculation) && {
                io2: ebsCalculationBreakdown.io2.ebsCostCalculation
            }),
            ...(!isEmpty(ebsCalculationBreakdown.st1?.ebsCostCalculation) && {
                st1: ebsCalculationBreakdown.st1.ebsCostCalculation
            }),
            ...(!isEmpty(ebsCalculationBreakdown.io1?.ebsCostCalculation) && {
                io1: ebsCalculationBreakdown.io1.ebsCostCalculation
            })
        };

        const reqObject = {
            clonedCopiesCount: params.clonedCopiesCount,
            monthlyChangeRatePercentage: params.monthlyChangeRatePercentage,
            snapshotFrequency: params.snapshotFrequency
        };

        // Build final response with merged FSx calculations
        let finalResponse: StorageSavingsCalculationsMetricsType = {
            ebs: ebsTotal,
            ebsCalculation: allVolumesEbsCalculation,
            ebsCloneCalculation,
            ebsSnapshotCalculation
        };

        const fsxCalculations = {
            fsx_calculation,
            fsx_cost_calculation_no_snapshot,
            fsx_snapshot_cost_calculation,
            fsx_clone_cost_calculation,
            fsx_optimized,
            fsx_optimized_single,
            fsx
        };

        const deploymentType = params.sqlServerDeploymentType;
        if (isMultiAzDeployment(deploymentType)) {
            finalResponse = {
                ...finalResponse,
                multi: derivePropertiesBasedOnDeploymentType(fsxCalculations, reqObject)
            };
        } else {
            finalResponse = {
                ...finalResponse,
                single: derivePropertiesBasedOnDeploymentType(fsxCalculations, reqObject)
            };
        }

        return finalResponse;
    }

    const fsxwMarketingRequestBody = getFsxwMarketingApiManualModeRequestBody(region, params);
    if (!fsxwMarketingRequestBody) {
        throw new Error('FSxW Marketing API request body could not be generated');
    }
    const resp = await getFsxwManualModeStorageSavings<ManualModeComparisionResponse>(
        accountId,
        fsxwMarketingRequestBody
    );

    const {
        fsxw,
        fsxw_cost_calculation,
        fsx_cost_calculation_no_snapshot,
        fsx_snapshot_cost_calculation,
        fsx_calculation,
        fsx_clone_cost_calculation
    } = resp as ManualModeFsxwComparisonResponse;
    const { fsxwCalculation, fsxwCloneCalculation, fsxwSnapshotCalculation } = deriveFsxCostCalculation(
        fsxw,
        fsxw_cost_calculation,
        params.clonedCopiesCount,
        params.monthlyChangeRatePercentage
    );

    const depType = params.ec2Instances[0].fsxw?.deploymentType || 'single';

    logger.info('Deployment type while formatManualStorageSavingsCalculationMetrics', depType);

    return {
        ...(depType.toLowerCase() === 'single' && {
            single: derivePropertiesBasedOnDeploymentType(
                {
                    fsx_calculation,
                    fsx_cost_calculation_no_snapshot,
                    fsx_snapshot_cost_calculation,
                    fsx_clone_cost_calculation
                },
                params
            )
        }),
        ...(depType.toLowerCase() === 'multi' && {
            multi: derivePropertiesBasedOnDeploymentType(
                {
                    fsx_calculation,
                    fsx_cost_calculation_no_snapshot,
                    fsx_snapshot_cost_calculation,
                    fsx_clone_cost_calculation
                },
                params
            )
        }),
        fsxwCalculation,
        fsxwCloneCalculation,
        fsxwSnapshotCalculation
    };
}

async function formatStorageSavingsCalculationMetrics(
    accountId: string,
    credentialsId: string,
    region: string,
    ebsVolumeIds: string[],
    params: StorageSavingsRequestBodyType,
    sqlServerDeploymentType: string,
    instanceIds?: string[],
    fileSystemsIds?: string[]
): Promise<StorageSavingsCalculationsMetricsType> {
    logger.debug('Formatting storage savings calculation metrics', {
        accountId,
        credentialsId,
        region,
        ebsVolumeIds,
        params,
        instanceIds
    });

    const {
        ebsClassification: { gp2, gp3, io1, st1, io2 } = {},
        ebs,
        single,
        multi,
        fsx,
        fsxw,
        fsxOptimized,
        fsxOptimizedSingle
    } = await invokeMarketingApi(
        accountId,
        credentialsId,
        region,
        sqlServerDeploymentType,
        ebsVolumeIds,
        params,
        instanceIds,
        fileSystemsIds
    );

    if (fileSystemsIds && fileSystemsIds.length > 0) {
        const fsxwCostCalculation = single?.fsxw_cost_calculation || multi?.fsxw_cost_calculation;
        let fsxwCalculation;
        let fsxwCloneCalculation;
        let fsxwSnapshotCalculation;
        if (fsxw && fsxwCostCalculation) {
            ({ fsxwCalculation, fsxwCloneCalculation, fsxwSnapshotCalculation } = deriveFsxCostCalculation(
                fsxw,
                fsxwCostCalculation,
                params.clonedCopiesCount,
                params.monthlyChangeRatePercentage
            ));
        }
        return {
            ...(single && { single: derivePropertiesBasedOnDeploymentType(single, params) }),
            ...(multi && { multi: derivePropertiesBasedOnDeploymentType(multi, params) }),
            fsxwCalculation,
            fsxwCloneCalculation,
            fsxwSnapshotCalculation,
            fsx,
            fsxw
        };
    }

    const ebsCalculationBreakdown = {
        ...(gp2 && {
            gp2: formatEbsCalculationObject(
                gp2.ebs,
                gp2.ebs_cost_calculation,
                params.clonedCopiesCount,
                params.monthlyChangeRatePercentage
            )
        }),
        ...(gp3 && {
            gp3: formatEbsCalculationObject(
                gp3.ebs,
                gp3.ebs_cost_calculation,
                params.clonedCopiesCount,
                params.monthlyChangeRatePercentage
            )
        }),
        ...(io1 && {
            io1: formatEbsCalculationObject(
                io1.ebs,
                io1.ebs_cost_calculation,
                params.clonedCopiesCount,
                params.monthlyChangeRatePercentage
            )
        }),
        ...(io2 && {
            io2: formatEbsCalculationObject(
                io2.ebs,
                io2.ebs_cost_calculation,
                params.clonedCopiesCount,
                params.monthlyChangeRatePercentage
            )
        }),
        ...(st1 && {
            st1: formatEbsCalculationObject(
                st1.ebs,
                st1.ebs_cost_calculation,
                params.clonedCopiesCount,
                params.monthlyChangeRatePercentage
            )
        })
    };

    const ebsCalculation: { [key: string]: EbsCostCalculationType } = {};
    const ebsCloneCalculation: { [key: string]: EbsCloneCalculationType } = {};
    const ebsSnapshotCalculation: { [key: string]: EbsSnapshotCalculationType } = {};
    Object.entries(ebsCalculationBreakdown).forEach(([key, value]) => {
        ebsCalculation[key] = value.ebsCostCalculation;
    });

    Object.entries(ebsCalculationBreakdown).forEach(([key, value]) => {
        ebsCloneCalculation[key] = value.ebsCloneCalculation;
    });

    Object.entries(ebsCalculationBreakdown).forEach(([key, value]) => {
        ebsSnapshotCalculation[key] = value.ebsSnapshotCalculation;
    });

    return {
        ...(single && { single: derivePropertiesBasedOnDeploymentType(single, params) }),
        ...(multi && { multi: derivePropertiesBasedOnDeploymentType(multi, params) }),
        ...(fsxOptimizedSingle && {
            fsxOptimizedSingle: derivePropertiesBasedOnDeploymentType(fsxOptimizedSingle, params)
        }),
        ebs,
        ebsCalculation,
        ebsCloneCalculation,
        ebsSnapshotCalculation,
        fsx,
        fsxOptimized
    };
}

export {
    handleMarketingApiFsxCalculationObject,
    formatManualStorageSavingsCalculationMetrics,
    formatStorageSavingsCalculationMetrics
};
