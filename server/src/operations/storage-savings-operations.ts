import createError from 'http-errors';
import { compact, isEmpty } from 'lodash-es';
import { getHostAndSqlServerInfo } from './discover-operations';
import { FileSystemTypes, HOURS_IN_MONTH, HttpErrorCodes, SqlServerDeploymentModel } from '../utils/consts';
import {
    ComputeLicenseCostType,
    EBSCloneCostCalculationRespType,
    EBSCostCalculationRespType,
    EBSSnapshotCalculationRespType,
    FsxCalculationRespType,
    FsxwCalculationRespType,
    FsxwCloneCalculationRespType,
    FsxwSnapshotCalculationRespType,
    ManualStorageSavingsRequestBodyType,
    StorageSavingsMetricsCalculationsResponseType,
    StorageSavingsRequestBodyType
} from '../routes/types/storage-savings.types';
import {
    formatManualStorageSavingsCalculationMetrics,
    formatStorageSavingsCalculationMetrics,
    getMarketingApiManualModeRequestBody,
    handleMarketingApiFsxCalculationObject,
    invokeMarketingApi
} from './cloud-manager/marketing-operations';
import getLogger from '../utils/logger';
import { fsxStorageCapacityBreakdown, getMonthlyPriceFromHourlyPrice } from '../utils/utils';
import { DiscoverResponseInfoType, SqlServerInstanceInfoType } from '../routes/types/discover.types';
import { getInstanceDetailsByPrivateIp } from './aws/ec2-operations';
import { getSqlInstanceLicenseRecommendations, manualModeComputeLicenseDetails } from './recommendation-operations';
import { getManualModeStorageSavings } from '../lib/cloud-manager/marketing';
import {
    ManualModeEbsComparisonResponse,
    ManualModeFsxwComparisonResponse,
    ManualModeMarketingRequestBody,
    StorageSummary
} from '../utils/marketing-types';

const logger = getLogger();

interface CalculationResponse {
    ebsCalculation?: EBSCostCalculationRespType;
    ebsCloneCalculation?: EBSCloneCostCalculationRespType;
    ebsSnapshotCalculation?: EBSSnapshotCalculationRespType;
    single: FsxCalculationRespType;
    multi: FsxCalculationRespType;
    fsxwCalculation?: FsxwCalculationRespType;
    fsxwSnapshotCalculation?: FsxwSnapshotCalculationRespType;
    fsxwCloneCalculation?: FsxwCloneCalculationRespType;
    ebs?: StorageSummary;
    fsx?: StorageSummary;
    fsxw?: StorageSummary;
}
function fetchSqlVolumeIdsByType(type: string, sqlServerInstances: SqlServerInstanceInfoType[]) {
    logger.debug('Retrieving specific volume type volume ids from sql server instances', { type, sqlServerInstances });

    if (!sqlServerInstances) {
        return [];
    }
    return compact(
        sqlServerInstances?.flatMap(server =>
            server?.storage?.filter(storage => storage.type === type).map(storage => storage.id)
        )
    );
}

async function getAoagPartnerNodesDetails(
    accountId: string,
    credentialsId: string,
    region: string,
    nodeInstanceId: string,
    nodeIps: string[]
) {
    logger.info('Getting AOAG partner node details', { accountId, credentialsId, region, nodeInstanceId, nodeIps });

    const aoagClusterNodeDetails = (await getInstanceDetailsByPrivateIp(credentialsId, region, nodeIps)) || [];

    const partnerNodeInstanceIds = aoagClusterNodeDetails
        .filter(node => node.ec2InstanceId !== nodeInstanceId)
        .map(node => node.ec2InstanceId);

    const partneNodeInstanceDetails = await getHostAndSqlServerInfo(
        accountId,
        credentialsId,
        region,
        undefined,
        undefined,
        partnerNodeInstanceIds
    );
    return partneNodeInstanceDetails;
}

async function identifyAoagVolumes(
    accountId: string,
    credentialsId: string,
    region: string,
    nodeInstanceId: string,
    nodeIps: string[],
    nodeSqlServerInstances: SqlServerInstanceInfoType[],
    nodeEbsVolumeIds: string[],
    partnerNodesDetails: DiscoverResponseInfoType[]
) {
    logger.info('Identifying AOAG volumes', {
        accountId,
        credentialsId,
        region,
        nodeInstanceId,
        nodeIps,
        nodeSqlServerInstances,
        nodeEbsVolumeIds
    });

    let allEbsVolumeIds: string[] = nodeEbsVolumeIds;
    let uniqueHostVolumeIds: string[] = nodeEbsVolumeIds;
    partnerNodesDetails.forEach(({ sqlServerInstances }) => {
        const partnerSqlServerInstances = sqlServerInstances || [];
        const partnerNodeEbsVolumeIds = fetchSqlVolumeIdsByType(FileSystemTypes.EBS, partnerSqlServerInstances);

        const uniquePartnerNodeSqlServerInstances =
            partnerSqlServerInstances?.filter(
                partnerSqlServerInstance =>
                    !nodeSqlServerInstances?.some(
                        sqlServerInstance => partnerSqlServerInstance.sqlServerName !== sqlServerInstance.sqlServerName
                    )
            ) || [];
        const uniqueSqlHostEbsVolumeIdsPartnerNode = fetchSqlVolumeIdsByType(
            FileSystemTypes.EBS,
            uniquePartnerNodeSqlServerInstances
        );
        allEbsVolumeIds = allEbsVolumeIds.concat(...partnerNodeEbsVolumeIds);
        uniqueHostVolumeIds = uniqueHostVolumeIds.concat(...uniqueSqlHostEbsVolumeIdsPartnerNode);
    });

    return { allEbsVolumeIds, uniqueHostVolumeIds };
}

async function aoagStorageSavingsCalculations(
    accountId: string,
    credentialsId: string,
    region: string,
    nodeEbsVolumeIds: string[],
    params: StorageSavingsRequestBodyType,
    nodeDetails: DiscoverResponseInfoType,
    instanceId?: string
) {
    logger.info('Performing AOAG storage savings calculations', {
        accountId,
        credentialsId,
        region,
        nodeEbsVolumeIds,
        params,
        instanceId
    });

    const { ec2InstanceId: nodeInstanceId, sqlServerInstances } = nodeDetails;
    const [{ nodeIps }] = sqlServerInstances || [];
    if (sqlServerInstances !== undefined && nodeIps && nodeIps.length > 0) {
        const { items: partnerNodeDetails } = await getAoagPartnerNodesDetails(
            accountId,
            credentialsId,
            region,
            nodeInstanceId,
            nodeIps
        );

        const allNodesComputeLicenseDetails = await retrieveComputeAndLicenseCost(
            accountId,
            credentialsId,
            region,
            nodeDetails,
            params.monthlySqlByolCost,
            partnerNodeDetails
        ); // retrieves compute and license cost for all nodes in the AOAG cluster

        const { allEbsVolumeIds, uniqueHostVolumeIds } = await identifyAoagVolumes(
            accountId,
            credentialsId,
            region,
            nodeInstanceId,
            nodeIps,
            sqlServerInstances,
            nodeEbsVolumeIds,
            partnerNodeDetails
        );

        const [{ ebs: allEbsDetails }, { ebs, fsx, single, multi }] = await Promise.all([
            invokeMarketingApi(
                accountId,
                credentialsId,
                region,
                SqlServerDeploymentModel.SQL_AOAG_SHORT,
                allEbsVolumeIds, // Consider all EBS volumes for storage, iops and throughput calculation
                params,
                instanceId
            ),
            invokeMarketingApi(
                accountId,
                credentialsId,
                region,
                SqlServerDeploymentModel.SQL_AOAG_SHORT,
                uniqueHostVolumeIds, // Consider only volumes associated with unique database in primary and partner node for snapshot calculation and to draw a storage savings comparison with FSXn
                params,
                instanceId
            )
        ]);

        // existing compute and license details
        const allNodesExistingComputePrice = allNodesComputeLicenseDetails.compute.existing.computeHourlyPrice;
        const existingComputeMonthlyPrice = getMonthlyPriceFromHourlyPrice(allNodesExistingComputePrice || 0);
        const allNodesExistingLicensePrice = allNodesComputeLicenseDetails.license.existing.licenseHourlyPrice;
        const existingLicenseMonthlyPrice = getMonthlyPriceFromHourlyPrice(allNodesExistingLicensePrice || 0);

        const { compute, license } = allNodesComputeLicenseDetails;

        // recommended compute and license details
        const allNodesRecommendedComputePrice = allNodesComputeLicenseDetails.compute.recommended.computeHourlyPrice;
        const recommendedComputeMonthlyPrice = getMonthlyPriceFromHourlyPrice(allNodesRecommendedComputePrice || 0);
        const allNodesRecommendedLicensePrice = allNodesComputeLicenseDetails.license.recommended.licenseHourlyPrice;
        const recommendedLicenseMonthlyPrice = getMonthlyPriceFromHourlyPrice(allNodesRecommendedLicensePrice || 0);

        const singleFsxCalculationData = single?.fsx_calculation
            ? handleMarketingApiFsxCalculationObject(single.fsx_calculation, single.fsx_cost_calculation_no_snapshot)
            : undefined;
        const multiFsxCalculationData = multi?.fsx_calculation
            ? handleMarketingApiFsxCalculationObject(multi.fsx_calculation, multi.fsx_cost_calculation_no_snapshot)
            : undefined;
        return {
            compute,
            license,
            ebs: {
                iops: allEbsDetails?.iops,
                throughput: allEbsDetails?.throughput,
                capacity: allEbsDetails?.capacity,
                clones: ebs?.clones,
                snapshots: ebs?.snapshots,
                total:
                    allEbsDetails && ebs
                        ? allEbsDetails.iops +
                          allEbsDetails.throughput +
                          allEbsDetails.capacity +
                          ebs.clones +
                          ebs.snapshots
                        : 0
            },
            fsx,
            totalSummary: {
                existing:
                    allEbsDetails && ebs
                        ? allEbsDetails.iops +
                          allEbsDetails.throughput +
                          allEbsDetails.capacity +
                          ebs.clones +
                          ebs.snapshots +
                          existingComputeMonthlyPrice! +
                          existingLicenseMonthlyPrice!
                        : 0,
                recommended: fsx.total + recommendedComputeMonthlyPrice! + recommendedLicenseMonthlyPrice!
            },
            ...(singleFsxCalculationData && {
                single: {
                    fsxCalculation: singleFsxCalculationData,
                    fsxBreakdown: fsxStorageCapacityBreakdown(
                        singleFsxCalculationData.totalStorageCapacity,
                        SqlServerDeploymentModel.SQL_AOAG_SHORT
                    )
                }
            }),
            ...(multiFsxCalculationData && {
                multi: {
                    fsxCalculation: multiFsxCalculationData,
                    fsxBreakdown: fsxStorageCapacityBreakdown(
                        multiFsxCalculationData.totalStorageCapacity,
                        SqlServerDeploymentModel.SQL_AOAG_SHORT
                    )
                }
            })
        };
    }
    throw createError(
        HttpErrorCodes.NOT_FOUND,
        'No SQL Server instances or partner node details found for the provided AOAG configuration'
    );
}

async function aoagStorageSavingsMetrics(
    accountId: string,
    credentialsId: string,
    region: string,
    nodeEbsVolumeIds: string[],
    params: StorageSavingsRequestBodyType,
    nodeDetails: DiscoverResponseInfoType,
    currentNodeComputeLicenseDetails: ComputeLicenseCostType,
    partnerNodeDetails: DiscoverResponseInfoType[],
    instanceId?: string
) {
    logger.info('Performing AOAG storage savings metrics calculation ', {
        accountId,
        credentialsId,
        region,
        nodeEbsVolumeIds,
        params,
        nodeDetails,
        instanceId
    });
    const { ec2InstanceId: nodeInstanceId, sqlServerInstances } = nodeDetails;
    const [{ nodeIps }] = sqlServerInstances || [];
    if (sqlServerInstances !== undefined && nodeIps && nodeIps.length > 0) {
        const {
            compute: { existing: existingComputeCalculation, recommended: recommendedComputeCalculation },
            license: { existing: existingLicenseCalculation, recommended: recommendedLicenseCalculation }
        } = currentNodeComputeLicenseDetails;

        const { allEbsVolumeIds, uniqueHostVolumeIds } = await identifyAoagVolumes(
            accountId,
            credentialsId,
            region,
            nodeInstanceId,
            nodeIps,
            sqlServerInstances,
            nodeEbsVolumeIds,
            partnerNodeDetails
        );

        // Consider all EBS volumes for storage, iops and throughput calculation
        const {
            ebs,
            fsx,
            ebsCalculation: allVolumesEbsCalculation
        } = await formatStorageSavingsCalculationMetrics(
            accountId,
            credentialsId,
            region,
            allEbsVolumeIds,
            params,
            SqlServerDeploymentModel.SQL_AOAG_SHORT,
            instanceId
        );
        // Consider only volumes associated with unique database in primary and partner nodes for snapshot calculation and to draw a storage savings comparison with FSXn
        const {
            single,
            multi,
            ebsCloneCalculation: uniqueVolumesEbsCloneCalculation,
            ebsSnapshotCalculation: uniqueVolumesEbsSnapshotCalculation
        } = await formatStorageSavingsCalculationMetrics(
            accountId,
            credentialsId,
            region,
            uniqueHostVolumeIds,
            params,
            SqlServerDeploymentModel.SQL_AOAG_SHORT,
            instanceId
        );
        const existingComputeLicensePrice = Number(existingComputeCalculation?.instanceMonthlyPrice || 0);
        const recommendedComputeLicensePrice = Number(recommendedComputeCalculation?.instanceMonthlyPrice || 0);

        return {
            recommendedComputeCalculation,
            recommendedLicenseCalculation,
            existingComputeCalculation,
            existingLicenseCalculation,
            ebsCalculation: allVolumesEbsCalculation,
            single,
            multi,
            ebsCloneCalculation: uniqueVolumesEbsCloneCalculation,
            ebsSnapshotCalculation: uniqueVolumesEbsSnapshotCalculation,
            totalSummary: {
                existing: ebs ? ebs.total + existingComputeLicensePrice : existingComputeLicensePrice,
                recommended: fsx ? fsx.total + recommendedComputeLicensePrice : recommendedComputeLicensePrice
            }
        };
    }
    throw createError(
        HttpErrorCodes.NOT_FOUND,
        'Unable to get AOAG storage savings metrics as no SQL Server instances or partner nodes details found for the provided AOAG configuration'
    );
}

async function retrieveComputeAndLicenseCost(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2HostDetails: DiscoverResponseInfoType,
    monthlySqlByolCost?: number,
    partnerNodeDetails?: DiscoverResponseInfoType[],
    isFsxwCalcs: boolean = false
): Promise<ComputeLicenseCostType> {
    logger.info('Retrieving compute and license cost', { accountId, credentialsId, region, ec2HostDetails });

    const { ec2InstanceId, ec2InstanceType } = ec2HostDetails;
    const response = await getSqlInstanceLicenseRecommendations(
        accountId,
        credentialsId,
        region,
        ec2HostDetails,
        monthlySqlByolCost,
        partnerNodeDetails,
        isFsxwCalcs
    );
    const {
        existingCompute: {
            finding: eFinding,
            baseInstancePrice: eBasePrice,
            price: ePrice,
            instanceType: eInstanceType,
            machineDetails: eMachineDetails
        },
        existingLicense: { finding: eLicenseFinding, sqlServerEdition: eSqlServerEdition, price: eLicensePrice },
        recommendedCompute: {
            message: computeMessage,
            baseInstancePrice: rBasePrice,
            price: rPrice,
            instanceType: rInstanceType,
            machineDetails: rMachineDetails,
            recommendationOptions
        },
        recommendedLicense: { message: licenseMessage, sqlServerEdition: rSqlServerEdition, price: rLicensePrice }
    } = response;

    const [{ windowsOsVersion }] = ec2HostDetails.sqlServerInstances || [];

    return {
        ec2InstanceId,
        ec2InstanceType,
        compute: {
            existing: {
                instanceType: eInstanceType,
                finding: eFinding,
                windowsOsVersion,
                computeHourlyPrice: eBasePrice,
                computeMonthlyPrice: eBasePrice ? getMonthlyPriceFromHourlyPrice(eBasePrice) : undefined,
                instanceMonthlyPrice: ePrice ? getMonthlyPriceFromHourlyPrice(ePrice) : undefined,
                hoursInMonth: HOURS_IN_MONTH,
                machineDetails: eMachineDetails
            },
            recommended: {
                instanceType: rInstanceType,
                windowsOsVersion,
                computeHourlyPrice: rBasePrice,
                computeMonthlyPrice: rBasePrice ? getMonthlyPriceFromHourlyPrice(rBasePrice) : undefined,
                instanceMonthlyPrice: rPrice // inclusive of license
                    ? getMonthlyPriceFromHourlyPrice(rPrice)
                    : undefined,
                hoursInMonth: HOURS_IN_MONTH,
                message: computeMessage,
                machineDetails: rMachineDetails,
                recommendationOptions
            }
        },
        license: {
            existing: {
                finding: eLicenseFinding,
                sqlServerEdition: eSqlServerEdition,
                licenseHourlyPrice: eLicensePrice,
                licenseIncluded: !!(eLicensePrice && eLicensePrice > 0),
                licenseMonthlyPrice:
                    eLicensePrice !== undefined && eLicensePrice >= 0
                        ? getMonthlyPriceFromHourlyPrice(eLicensePrice)
                        : undefined,
                hoursInMonth: HOURS_IN_MONTH
            },
            recommended: {
                sqlServerEdition: rSqlServerEdition,
                licenseHourlyPrice: rLicensePrice,
                licenseIncluded: !!(rLicensePrice && rLicensePrice > 0),
                licenseMonthlyPrice:
                    rLicensePrice !== undefined && rLicensePrice >= 0
                        ? getMonthlyPriceFromHourlyPrice(rLicensePrice)
                        : undefined,
                hoursInMonth: HOURS_IN_MONTH,
                message: licenseMessage
            }
        }
    };
}

async function performStorageSavingsCalculations(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    params: StorageSavingsRequestBodyType
) {
    logger.info('Performing storage savings calculations ', { accountId, credentialsId, region, instanceId, params });

    const {
        items: [ec2HostDetails]
    } = await getHostAndSqlServerInfo(accountId, credentialsId, region, undefined, undefined, [instanceId]);

    const sqlServerInstances = ec2HostDetails?.sqlServerInstances || [];
    const fsxwInstances = sqlServerInstances?.filter(sqlServerInstance =>
        sqlServerInstance?.storage?.some(storage => storage.type === FileSystemTypes.FSXW)
    );
    if (fsxwInstances && fsxwInstances.length > 0) {
        const [{ sqlServerDeploymentType }] = fsxwInstances;

        if (sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT) {
            throw createError(
                HttpErrorCodes.BAD_REQUEST,
                'FSXW Storage savings calculations for AOAG deployments are not supported'
            );
        }

        const fileSystemsIds = compact(
            fsxwInstances.flatMap(fsxwInstance =>
                fsxwInstance.storage?.flatMap(storage => (storage.type === FileSystemTypes.FSXW ? [storage.id] : []))
            )
        );

        if (!fileSystemsIds.length) {
            throw createError(
                HttpErrorCodes.NOT_FOUND,
                `No FSXW instances found for the provided instance: ${instanceId}`
            );
        }

        const marketingPromise = invokeMarketingApi(
            accountId,
            credentialsId,
            region,
            sqlServerDeploymentType!,
            [],
            params,
            instanceId,
            fileSystemsIds
        );
        const recommendationPromise = retrieveComputeAndLicenseCost(
            accountId,
            credentialsId,
            region,
            ec2HostDetails,
            undefined,
            undefined,
            true
        );
        const [{ compute, license }, { fsx, single, multi, fsxw, fsxOptimizedSingle, fsxOptimized }] =
            await Promise.all([recommendationPromise, marketingPromise]);

        const existingComputeLicensePrice = Number(compute?.existing?.instanceMonthlyPrice || 0);
        const recommendedComputeLicensePrice = Number(compute?.recommended?.instanceMonthlyPrice || 0);

        const singleFsxCalculationData = single?.fsx_calculation
            ? handleMarketingApiFsxCalculationObject(single.fsx_calculation, single.fsx_cost_calculation_no_snapshot)
            : undefined;

        const multiFsxCalculationData = multi?.fsx_calculation
            ? handleMarketingApiFsxCalculationObject(multi.fsx_calculation, multi.fsx_cost_calculation_no_snapshot)
            : undefined;

        return {
            compute,
            license,
            ...(singleFsxCalculationData && {
                single: {
                    fsxCalculation: singleFsxCalculationData,
                    fsxBreakdown: fsxStorageCapacityBreakdown(
                        singleFsxCalculationData.totalStorageCapacity,
                        sqlServerDeploymentType!
                    )
                }
            }),
            ...(multiFsxCalculationData && {
                multi: {
                    fsxCalculation: multiFsxCalculationData,
                    fsxBreakdown: fsxStorageCapacityBreakdown(
                        multiFsxCalculationData.totalStorageCapacity,
                        sqlServerDeploymentType!
                    )
                }
            }),
            fsx,
            fsxw,
            ...(fsxOptimizedSingle && { fsxOptimizedSingle }),
            ...(fsxOptimized && { fsxOptimized }),
            totalSummary: {
                existing: fsxw ? fsxw.total + existingComputeLicensePrice : existingComputeLicensePrice,
                recommended: fsx.total + recommendedComputeLicensePrice // recommendedComputeLicensePrice is inclusive of recommended License price (for fsxw recommended compute price remains same as existing, but recommended license price can vary)
            }
        };
    }

    const ebsVolumeIds = fetchSqlVolumeIdsByType(FileSystemTypes.EBS, sqlServerInstances);

    if (!ebsVolumeIds.length) {
        throw createError(HttpErrorCodes.NOT_FOUND, `No EBS volumes found for the provided instance: ${instanceId}`);
    }

    const [{ sqlServerDeploymentType, nodeIps }] = ec2HostDetails?.sqlServerInstances || [];
    if (nodeIps && !isEmpty(nodeIps) && sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT) {
        return aoagStorageSavingsCalculations(
            accountId,
            credentialsId,
            region,
            ebsVolumeIds,
            params,
            ec2HostDetails,
            instanceId
        );
    }

    const recommendationPromise = retrieveComputeAndLicenseCost(
        accountId,
        credentialsId,
        region,
        ec2HostDetails,
        params.monthlySqlByolCost
    );
    const marketingPromise = invokeMarketingApi(
        accountId,
        credentialsId,
        region,
        sqlServerDeploymentType!,
        ebsVolumeIds,
        params,
        instanceId
    );

    const [{ compute, license }, { ebs, fsx, single, multi, fsxOptimizedSingle, fsxOptimized }] = await Promise.all([
        recommendationPromise,
        marketingPromise
    ]);

    const existingComputeLicensePrice = compute?.existing?.instanceMonthlyPrice || 0;
    const recommendedComputeLicensePrice = compute?.recommended?.instanceMonthlyPrice || 0;

    const singleFsxCalculationData = single?.fsx_calculation
        ? handleMarketingApiFsxCalculationObject(single.fsx_calculation, single.fsx_cost_calculation_no_snapshot)
        : undefined;
    const multiFsxCalculationData = multi?.fsx_calculation
        ? handleMarketingApiFsxCalculationObject(multi.fsx_calculation, multi.fsx_cost_calculation_no_snapshot)
        : undefined;
    return {
        compute,
        license,
        ebs,
        fsx,
        ...(fsxOptimizedSingle && { fsxOptimizedSingle }),
        ...(fsxOptimized && { fsxOptimized }),
        totalSummary: {
            existing: Number(ebs?.total || 0) + existingComputeLicensePrice,
            recommended: fsx.total + recommendedComputeLicensePrice
        },
        ...(singleFsxCalculationData && {
            single: {
                fsxCalculation: singleFsxCalculationData,
                fsxBreakdown: fsxStorageCapacityBreakdown(
                    singleFsxCalculationData.totalStorageCapacity,
                    sqlServerDeploymentType!
                )
            }
        }),
        ...(multiFsxCalculationData && {
            multi: {
                fsxCalculation: multiFsxCalculationData,
                fsxBreakdown: fsxStorageCapacityBreakdown(
                    multiFsxCalculationData.totalStorageCapacity,
                    sqlServerDeploymentType!
                )
            }
        })
    };
}

async function getStorageSavingsCalculationMetrics(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    params: StorageSavingsRequestBodyType
): Promise<StorageSavingsMetricsCalculationsResponseType> {
    logger.info('Getting storage savings calculation metrics ', {
        accountId,
        credentialsId,
        region,
        instanceId,
        params
    });

    const {
        items: [ec2HostDetails]
    } = await getHostAndSqlServerInfo(accountId, credentialsId, region, undefined, undefined, [instanceId]);

    const sqlServerInstances = ec2HostDetails?.sqlServerInstances || [];
    const fsxwInstances = sqlServerInstances?.filter(sqlServerInstance =>
        sqlServerInstance?.storage?.some(storage => storage.type === FileSystemTypes.FSXW)
    );
    if (fsxwInstances && fsxwInstances.length > 0) {
        const [{ sqlServerDeploymentType }] = fsxwInstances;

        if (sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT) {
            throw createError(
                HttpErrorCodes.BAD_REQUEST,
                'FSXW Storage savings calculations for AOAG deployments are not supported'
            );
        }

        const fileSystemsIds = compact(
            fsxwInstances.flatMap(fsxwInstance =>
                fsxwInstance.storage?.flatMap(storage => (storage.type === FileSystemTypes.FSXW ? [storage.id] : []))
            )
        );

        if (!fileSystemsIds.length) {
            throw createError(
                HttpErrorCodes.NOT_FOUND,
                `No FSXW instances found for the provided instance: ${instanceId}`
            );
        }
        const { single, multi, fsxwCalculation, fsxwCloneCalculation, fsxwSnapshotCalculation, fsx, fsxw } =
            await formatStorageSavingsCalculationMetrics(
                accountId,
                credentialsId,
                region,
                [],
                params,
                sqlServerDeploymentType!,
                instanceId,
                fileSystemsIds
            );

        const {
            compute: { existing: existingComputeCalculation, recommended: recommendedComputeCalculation },
            license: { existing: existingLicenseCalculation, recommended: recommendedLicenseCalculation }
        } = await retrieveComputeAndLicenseCost(
            accountId,
            credentialsId,
            region,
            ec2HostDetails,
            undefined,
            undefined,
            true
        );

        const existingComputeLicensePrice = Number(existingComputeCalculation?.instanceMonthlyPrice || 0);
        const recommendedComputeLicensePrice = Number(recommendedComputeCalculation?.instanceMonthlyPrice || 0);

        return {
            recommendedComputeCalculation,
            recommendedLicenseCalculation,
            existingComputeCalculation,
            existingLicenseCalculation,
            single,
            multi,
            fsxwCalculation,
            fsxwCloneCalculation,
            fsxwSnapshotCalculation,
            totalSummary: {
                existing: fsxw ? fsxw.total + existingComputeLicensePrice : existingComputeLicensePrice,
                recommended: fsx ? fsx.total + recommendedComputeLicensePrice : recommendedComputeLicensePrice
            }
        };
    }

    const ebsVolumeIds = fetchSqlVolumeIdsByType(FileSystemTypes.EBS, sqlServerInstances);
    if (!ebsVolumeIds.length) {
        throw createError(HttpErrorCodes.NOT_FOUND, `No EBS volumes found for the provided instance: ${instanceId}`);
    }

    const [{ sqlServerDeploymentType, nodeIps }] = ec2HostDetails?.sqlServerInstances || [];

    if (nodeIps && !isEmpty(nodeIps) && sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT) {
        const { items: partnerNodeDetails } = await getAoagPartnerNodesDetails(
            accountId,
            credentialsId,
            region,
            instanceId,
            nodeIps
        );
        const currentNodeComputeLicenseDetails = await retrieveComputeAndLicenseCost(
            accountId,
            credentialsId,
            region,
            ec2HostDetails,
            params.monthlySqlByolCost,
            partnerNodeDetails
        );
        return aoagStorageSavingsMetrics(
            accountId,
            credentialsId,
            region,
            ebsVolumeIds,
            params,
            ec2HostDetails,
            currentNodeComputeLicenseDetails,
            partnerNodeDetails,
            instanceId
        );
    }

    const currentNodeComputeLicenseDetails = await retrieveComputeAndLicenseCost(
        accountId,
        credentialsId,
        region,
        ec2HostDetails,
        params.monthlySqlByolCost
    );

    const {
        compute: { existing: existingComputeCalculation, recommended: recommendedComputeCalculation },
        license: { existing: existingLicenseCalculation, recommended: recommendedLicenseCalculation }
    } = currentNodeComputeLicenseDetails;
    const { ebs, ebsCalculation, ebsCloneCalculation, ebsSnapshotCalculation, single, multi, fsx, fsxOptimizedSingle } =
        await formatStorageSavingsCalculationMetrics(
            accountId,
            credentialsId,
            region,
            ebsVolumeIds,
            params,
            sqlServerDeploymentType!,
            instanceId
        );

    const existingComputeLicensePrice = Number(existingComputeCalculation?.instanceMonthlyPrice || 0);
    const recommendedComputeLicensePrice = Number(recommendedComputeCalculation?.instanceMonthlyPrice || 0);

    return {
        recommendedComputeCalculation,
        recommendedLicenseCalculation,
        existingComputeCalculation,
        existingLicenseCalculation,
        ebsCalculation,
        ebsCloneCalculation,
        ebsSnapshotCalculation,
        single,
        multi,
        ...(fsxOptimizedSingle && { fsxOptimizedSingle }),
        totalSummary: {
            existing: ebs ? ebs.total + existingComputeLicensePrice : existingComputeLicensePrice,
            recommended: fsx ? fsx.total + recommendedComputeLicensePrice : recommendedComputeLicensePrice
        }
    };
}

async function performManualModeStorageSavingsCalculations(
    accountId: string,
    region: string,
    params: ManualStorageSavingsRequestBodyType,
    nodeCount: number = 2,
    isOnpremTcoFlow: boolean = false
) {
    logger.info('Getting manual mode storage savings calculations ', {
        accountId,
        region,
        params,
        nodeCount,
        isOnpremTcoFlow
    });
    const marketingRequestBody = getMarketingApiManualModeRequestBody(region, params) as ManualModeMarketingRequestBody;

    if (marketingRequestBody?.instances) {
        // EBS flow
        const { ebsTotal, fsx, single, multi } = await getManualModeStorageSavings<ManualModeEbsComparisonResponse>(
            accountId,
            marketingRequestBody
        );

        const { compute, license } = await manualModeComputeLicenseDetails(region, params, nodeCount, isOnpremTcoFlow);

        const singleFsxCalculationData = single?.fsx_calculation
            ? handleMarketingApiFsxCalculationObject(single.fsx_calculation, single.fsx_cost_calculation_no_snapshot)
            : undefined;
        const multiFsxCalculationData = multi?.fsx_calculation
            ? handleMarketingApiFsxCalculationObject(multi.fsx_calculation, multi.fsx_cost_calculation_no_snapshot)
            : undefined;

        return {
            compute,
            license,
            ebs: ebsTotal,
            fsx,
            ...(singleFsxCalculationData && {
                single: {
                    fsxCalculation: singleFsxCalculationData,
                    fsxBreakdown: fsxStorageCapacityBreakdown(
                        singleFsxCalculationData.totalStorageCapacity,
                        params.sqlServerDeploymentType!
                    )
                }
            }),
            ...(multiFsxCalculationData && {
                multi: {
                    fsxCalculation: multiFsxCalculationData,
                    fsxBreakdown: fsxStorageCapacityBreakdown(
                        multiFsxCalculationData.totalStorageCapacity,
                        params.sqlServerDeploymentType!
                    )
                }
            }),
            totalSummary: {
                existing:
                    Number(ebsTotal.total || 0) +
                    Number(compute?.existing?.computeMonthlyPrice || 0) +
                    Number(license?.existing?.licenseMonthlyPrice || 0),
                recommended:
                    fsx.total +
                    Number(compute?.recommended?.computeMonthlyPrice || 0) +
                    Number(license?.recommended?.licenseMonthlyPrice || 0)
            }
        };
    }
    // EBS flow ends

    // FSXw flow
    const resp = await getManualModeStorageSavings<ManualModeFsxwComparisonResponse>(accountId, marketingRequestBody);

    const {
        fsx_calculation: fsxCalculation,
        fsx_cost_calculation_no_snapshot: fsxCalculationDataNoSnapshot,
        fsx,
        fsxw
    } = resp;
    const fsxCalculationData = fsxCalculation
        ? handleMarketingApiFsxCalculationObject(fsxCalculation, fsxCalculationDataNoSnapshot)
        : undefined;

    const { compute, license } = await manualModeComputeLicenseDetails(region, params, nodeCount);

    return {
        compute,
        license,
        fsx,
        fsxw,
        ...(fsxCalculationData && {
            [params.sqlServerDeploymentType === 'FCI' ? 'multi' : 'single']: {
                fsxCalculation: fsxCalculationData,
                fsxBreakdown: fsxStorageCapacityBreakdown(
                    fsxCalculationData.totalStorageCapacity,
                    params.sqlServerDeploymentType!
                )
            }
        }),
        totalSummary: {
            existing:
                Number(fsxw.total || 0) +
                Number(compute?.existing?.computeMonthlyPrice || 0) +
                Number(license?.existing?.licenseMonthlyPrice || 0),
            recommended:
                fsx.total +
                Number(compute?.recommended?.computeMonthlyPrice || 0) +
                Number(license?.recommended?.licenseMonthlyPrice || 0)
        }
    };
    // FSXw flow ends
}

async function getManualModeStorageSavingsCalculationMetrics(
    accountId: string,
    region: string,
    params: ManualStorageSavingsRequestBodyType,
    nodeCount: number = 2,
    isOnpremTcoFlow: boolean = false
): Promise<StorageSavingsMetricsCalculationsResponseType> {
    logger.info('Getting manual mode storage savings calculation metrics ', {
        accountId,
        region,
        params,
        nodeCount,
        isOnpremTcoFlow
    });

    const { compute, license } = await manualModeComputeLicenseDetails(region, params, nodeCount, isOnpremTcoFlow);

    const resp = await formatManualStorageSavingsCalculationMetrics(accountId, region, params);

    if (params.ec2Instances[0].fsxw) {
        const { single, multi, fsxwCalculation, fsxwCloneCalculation, fsxwSnapshotCalculation, fsx, fsxw } =
            resp as CalculationResponse;
        return {
            recommendedComputeCalculation: compute.recommended,
            recommendedLicenseCalculation: license.recommended,
            existingComputeCalculation: compute.existing,
            existingLicenseCalculation: license.existing,
            ...(single && { single }),
            ...(multi && { multi }),
            fsxwCalculation,
            fsxwCloneCalculation,
            fsxwSnapshotCalculation,
            totalSummary: {
                existing:
                    Number(fsxw?.total || 0) +
                    Number(compute?.existing?.computeMonthlyPrice || 0) +
                    Number(license?.existing?.licenseMonthlyPrice || 0),
                recommended:
                    Number(fsx?.total || 0) +
                    Number(compute?.recommended?.computeMonthlyPrice || 0) +
                    Number(license?.recommended?.licenseMonthlyPrice || 0)
            }
        };
    }

    const { ebsCalculation, ebsCloneCalculation, ebsSnapshotCalculation, single, multi, ebs, fsx } =
        resp as CalculationResponse;
    return {
        recommendedComputeCalculation: compute.recommended,
        recommendedLicenseCalculation: license.recommended,
        existingComputeCalculation: compute.existing,
        existingLicenseCalculation: license.existing,
        ebsCalculation,
        ebsCloneCalculation,
        ebsSnapshotCalculation,
        ...(single && { single }),
        ...(multi && { multi }),
        totalSummary: {
            existing:
                Number(ebs?.total || 0) +
                Number(compute?.existing?.computeMonthlyPrice || 0) +
                Number(license?.existing?.licenseMonthlyPrice || 0),
            recommended:
                Number(fsx?.total || 0) +
                Number(compute?.recommended?.computeMonthlyPrice || 0) +
                Number(license?.recommended?.licenseMonthlyPrice || 0)
        }
    };
}

export {
    getAoagPartnerNodesDetails,
    performStorageSavingsCalculations,
    getStorageSavingsCalculationMetrics,
    performManualModeStorageSavingsCalculations,
    getManualModeStorageSavingsCalculationMetrics
};
