import createError from 'http-errors';
import { cloneDeep, compact, isEmpty } from 'lodash-es';
import { getHostAndSqlServerInfo } from './discover-operations';
import { FINDING, FileSystemTypes, HOURS_IN_MONTH, HttpErrorCodes, SqlServerDeploymentModel } from '../utils/consts';
import {
    ComputeDetailsType,
    ComputeLicenseCostType,
    LicenseDetailsType,
    ManualStorageSavingsRequestBodyType,
    StorageSavingsMetricsCalculationsResponseType,
    StorageSavingsRequestBodyType,
    StorageSavingsResponseType
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
import getSqlInstanceLicenseRecommendations from './recommendation-operations';
import { ManualModeMarketingRequestBody, getManualModeStorageSavings } from '../lib/cloud-manager/marketing';
import { deriveInstanceCountPricingDetails, getPricingByLicenseType } from './aws/pricing-operations';
import { ManualModeEbsComparisonResponse, ManualModeFsxwComparisonResponse } from '../routes/types/marketing.types';

const logger = getLogger();

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
            ? handleMarketingApiFsxCalculationObject(single.fsx_calculation)
            : undefined;
        const multiFsxCalculationData = multi?.fsx_calculation
            ? handleMarketingApiFsxCalculationObject(multi.fsx_calculation)
            : undefined;
        return {
            compute,
            license,
            ebs: {
                iops: allEbsDetails.iops,
                throughput: allEbsDetails.throughput,
                capacity: allEbsDetails.capacity,
                clones: ebs.clones,
                snapshots: ebs.snapshots,
                total:
                    allEbsDetails.iops + allEbsDetails.throughput + allEbsDetails.capacity + ebs.clones + ebs.snapshots
            },
            fsx,
            totalSummary: {
                existing:
                    allEbsDetails.iops +
                    allEbsDetails.throughput +
                    allEbsDetails.capacity +
                    ebs.clones +
                    ebs.snapshots +
                    existingComputeMonthlyPrice! +
                    existingLicenseMonthlyPrice!,
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
        const { ebsCalculation: allVolumesEbsCalculation } = await formatStorageSavingsCalculationMetrics(
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

        return {
            recommendedComputeCalculation,
            recommendedLicenseCalculation,
            existingComputeCalculation,
            existingLicenseCalculation,
            ebsCalculation: allVolumesEbsCalculation,
            single,
            multi,
            ebsCloneCalculation: uniqueVolumesEbsCloneCalculation,
            ebsSnapshotCalculation: uniqueVolumesEbsSnapshotCalculation
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
    partnerNodeDetails?: DiscoverResponseInfoType[]
): Promise<ComputeLicenseCostType> {
    logger.info('Retrieving compute and license cost', { accountId, credentialsId, region, ec2HostDetails });

    const { ec2InstanceId, ec2InstanceType } = ec2HostDetails;
    const response = await getSqlInstanceLicenseRecommendations(
        accountId,
        credentialsId,
        region,
        ec2HostDetails,
        partnerNodeDetails
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
): Promise<StorageSavingsResponseType> {
    logger.info('Performing storage savings calculations ', { accountId, credentialsId, region, instanceId, params });

    const {
        items: [ec2HostDetails]
    } = await getHostAndSqlServerInfo(accountId, credentialsId, region, undefined, undefined, [instanceId]);

    const sqlServerInstances = ec2HostDetails?.sqlServerInstances || [];

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

    const recommendationPromise = retrieveComputeAndLicenseCost(accountId, credentialsId, region, ec2HostDetails);
    const marketingPromise = invokeMarketingApi(
        accountId,
        credentialsId,
        region,
        sqlServerDeploymentType!,
        ebsVolumeIds,
        params,
        instanceId
    );

    const [{ compute, license }, { ebs, fsx, single, multi }] = await Promise.all([
        recommendationPromise,
        marketingPromise
    ]);

    const existingComputeLicensePrice = compute?.existing?.instanceMonthlyPrice || 0;
    const recommendedComputeLicensePrice = compute?.recommended?.instanceMonthlyPrice || 0;

    const singleFsxCalculationData = single?.fsx_calculation
        ? handleMarketingApiFsxCalculationObject(single.fsx_calculation)
        : undefined;
    const multiFsxCalculationData = multi?.fsx_calculation
        ? handleMarketingApiFsxCalculationObject(multi.fsx_calculation)
        : undefined;
    return {
        compute,
        license,
        ebs,
        fsx,
        totalSummary: {
            existing: ebs.total || 0 + existingComputeLicensePrice,
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
        ec2HostDetails
    );

    const {
        compute: { existing: existingComputeCalculation, recommended: recommendedComputeCalculation },
        license: { existing: existingLicenseCalculation, recommended: recommendedLicenseCalculation }
    } = currentNodeComputeLicenseDetails;
    const { ebsCalculation, ebsCloneCalculation, ebsSnapshotCalculation, single, multi } =
        await formatStorageSavingsCalculationMetrics(
            accountId,
            credentialsId,
            region,
            ebsVolumeIds,
            params,
            sqlServerDeploymentType!,
            instanceId
        );

    return {
        recommendedComputeCalculation,
        recommendedLicenseCalculation,
        existingComputeCalculation,
        existingLicenseCalculation,
        ebsCalculation,
        ebsCloneCalculation,
        ebsSnapshotCalculation,
        single,
        multi
    };
}

function handleManualModeRecommendations(
    sqlServerDeploymentType: string,
    sqlServerEdition: string,
    monthlySqlByolCost: number,
    existingComputeDetails: ComputeDetailsType,
    existingLicenseDetails: LicenseDetailsType,
    existingInstanceTypePricingDetails: Map<
        string,
        { count: number; pricingDetails: { [preInstalledSw: string]: { pricePerUnit: number; unit: string } } }
    >,
    awsInstanceLicenseMonthlyPrice?: number
) {
    logger.info('Handling manual mode recommendations ', {
        sqlServerDeploymentType,
        sqlServerEdition,
        monthlySqlByolCost,
        existingComputeDetails,
        existingLicenseDetails,
        existingInstanceTypePricingDetails,
        awsInstanceLicenseMonthlyPrice
    });
    const existingInstanceHourlyPriceWithoutLicense = getPricingByLicenseType('NA', existingInstanceTypePricingDetails);

    const recommendedLicenseDetails = cloneDeep(existingLicenseDetails);
    recommendedLicenseDetails.finding = undefined;

    const recommendedComputeDetails = cloneDeep(existingComputeDetails);
    recommendedComputeDetails.finding = undefined;
    if (
        SqlServerDeploymentModel.SQL_AOAG_SHORT === sqlServerDeploymentType &&
        sqlServerEdition?.toLowerCase().includes('enterprise')
    ) {
        // As per requirement DBS-2753: Downgrade Enterprise to Standard could be suggested in case of AOAG config.
        const instanceHourlyPrice = getPricingByLicenseType('SQL Std', existingInstanceTypePricingDetails);
        awsInstanceLicenseMonthlyPrice =
            instanceHourlyPrice && existingInstanceHourlyPriceWithoutLicense
                ? (instanceHourlyPrice - existingInstanceHourlyPriceWithoutLicense) * HOURS_IN_MONTH
                : undefined;
        recommendedComputeDetails.instanceHourlyPrice = instanceHourlyPrice;
        recommendedComputeDetails.instanceMonthlyPrice = instanceHourlyPrice
            ? getMonthlyPriceFromHourlyPrice(instanceHourlyPrice)
            : undefined;

        const licenseHourlyPrice =
            instanceHourlyPrice && existingInstanceHourlyPriceWithoutLicense
                ? instanceHourlyPrice - existingInstanceHourlyPriceWithoutLicense
                : undefined;
        recommendedLicenseDetails.licenseHourlyPrice = licenseHourlyPrice;
        recommendedLicenseDetails.licenseMonthlyPrice = licenseHourlyPrice
            ? getMonthlyPriceFromHourlyPrice(licenseHourlyPrice)
            : undefined;
        recommendedLicenseDetails.licenseIncluded = true;
        recommendedLicenseDetails.sqlServerEdition = 'Standard Edition';
        recommendedLicenseDetails.message =
            'Downgrade Enterprise Edition to Standard Edition if you are not using any of the enterprise features';
    }

    // As per requirement DBS-2753 : In case of BYOL License, please suggest the equivalent license included cost, in case it's cheaper than the BYOL cost mentioned. otherwise, do not compare SQL License costs and mention N/A in the cost breakdown.
    if (monthlySqlByolCost && monthlySqlByolCost > 0) {
        if (awsInstanceLicenseMonthlyPrice && monthlySqlByolCost > awsInstanceLicenseMonthlyPrice) {
            recommendedLicenseDetails.licenseHourlyPrice = awsInstanceLicenseMonthlyPrice / HOURS_IN_MONTH;
            recommendedLicenseDetails.licenseMonthlyPrice = awsInstanceLicenseMonthlyPrice;
            recommendedLicenseDetails.licenseIncluded = true;
            recommendedLicenseDetails.message = 'License included cost from AWS is cheaper than the BYOL cost';
        } else {
            recommendedLicenseDetails.licenseHourlyPrice = undefined;
            recommendedLicenseDetails.licenseIncluded = false;
            recommendedLicenseDetails.message = 'We could not find a cheaper license included cost';
        }
    }

    return { recommendedComputeDetails, recommendedLicenseDetails };
}

async function manualModeComputeLicenseDetails(region: string, params: ManualStorageSavingsRequestBodyType) {
    logger.info('Getting manual mode compute and license details ', { region, params });

    const { sqlServerDeploymentType, sqlServerEdition, monthlySqlByolCost, ec2Instances } = params;

    const instanceTypes = ec2Instances.map(instance => instance.ec2InstanceType);

    const existingInstanceTypesPricingDetails = await deriveInstanceCountPricingDetails(instanceTypes, region);

    const existingInstanceHourlyPriceWithoutLicense = getPricingByLicenseType(
        'NA',
        existingInstanceTypesPricingDetails
    );

    const existingComputePrice = existingInstanceHourlyPriceWithoutLicense;

    let existingInstanceHourlyPrice = existingInstanceHourlyPriceWithoutLicense;
    let existingLicensePrice: number | undefined;

    const existingSqlServerEditionLowerCase = sqlServerEdition?.toLowerCase();

    let awsInstanceLicenseMonthlyPrice;

    let existingLicenseType = 'NA';
    if (
        existingSqlServerEditionLowerCase &&
        ((existingSqlServerEditionLowerCase.includes('enterprise') &&
            !existingSqlServerEditionLowerCase.includes('evaluation')) ||
            existingSqlServerEditionLowerCase.includes('web') ||
            existingSqlServerEditionLowerCase.includes('standard'))
    ) {
        existingLicenseType = existingSqlServerEditionLowerCase?.includes('enterprise')
            ? 'SQL Ent'
            : existingSqlServerEditionLowerCase?.includes('web')
            ? 'SQL Web'
            : 'SQL Std';

        existingInstanceHourlyPrice = getPricingByLicenseType(existingLicenseType, existingInstanceTypesPricingDetails);

        awsInstanceLicenseMonthlyPrice =
            existingInstanceHourlyPrice && existingInstanceHourlyPriceWithoutLicense
                ? (existingInstanceHourlyPrice - existingInstanceHourlyPriceWithoutLicense) * HOURS_IN_MONTH
                : undefined;
        existingLicensePrice =
            monthlySqlByolCost && monthlySqlByolCost > 0
                ? monthlySqlByolCost / HOURS_IN_MONTH
                : existingInstanceHourlyPrice && existingInstanceHourlyPriceWithoutLicense
                ? existingInstanceHourlyPrice - existingInstanceHourlyPriceWithoutLicense
                : undefined;
    }

    const licenseIncluded =
        monthlySqlByolCost && monthlySqlByolCost > 0 ? false : !!(existingLicensePrice && existingLicensePrice > 0);

    const computeDetails = {
        instanceType: instanceTypes.join(', '),
        finding: undefined,
        windowsOsVersion: undefined,
        computeHourlyPrice: existingComputePrice,
        computeMonthlyPrice: existingComputePrice ? getMonthlyPriceFromHourlyPrice(existingComputePrice) : undefined,
        instanceMonthlyPrice: existingInstanceHourlyPrice
            ? getMonthlyPriceFromHourlyPrice(existingInstanceHourlyPrice)
            : undefined,
        hoursInMonth: HOURS_IN_MONTH,
        message: undefined,
        machineDetails: instanceTypes.map(instanceType => {
            const pricingDetails = existingInstanceTypesPricingDetails.get(instanceType);
            const { pricePerUnit: priceWithoutLicense } = pricingDetails?.pricingDetails.NA || {};
            const { pricePerUnit: priceWithLicense } = pricingDetails?.pricingDetails[existingLicenseType] || {};
            const computeMonthlyPrice = getMonthlyPriceFromHourlyPrice(priceWithoutLicense);
            const instanceMonthlyPrice = getMonthlyPriceFromHourlyPrice(priceWithLicense);
            return {
                instanceType,
                price: priceWithLicense,
                basePrice: priceWithoutLicense,
                computeMonthlyPrice,
                instanceMonthlyPrice,
                licenseMonthlyPrice: getMonthlyPriceFromHourlyPrice(existingLicensePrice),
                hoursInMonth: HOURS_IN_MONTH,
                licenseIncluded
            };
        })
    };

    const licenseDetails = {
        finding:
            monthlySqlByolCost && awsInstanceLicenseMonthlyPrice && monthlySqlByolCost > awsInstanceLicenseMonthlyPrice
                ? FINDING.NOT_OPTIMIZED
                : undefined,
        licenseHourlyPrice: existingLicensePrice,
        licenseIncluded,
        licenseMonthlyPrice:
            existingLicensePrice && existingLicensePrice >= 0
                ? existingLicensePrice * HOURS_IN_MONTH
                : existingLicensePrice,
        hoursInMonth: HOURS_IN_MONTH,
        sqlServerEdition
    };

    const { recommendedComputeDetails, recommendedLicenseDetails } = handleManualModeRecommendations(
        sqlServerDeploymentType!,
        sqlServerEdition!,
        monthlySqlByolCost!,
        computeDetails,
        licenseDetails,
        existingInstanceTypesPricingDetails,
        awsInstanceLicenseMonthlyPrice!
    );

    return {
        compute: {
            existing: computeDetails,
            recommended: recommendedComputeDetails
        },
        license: {
            existing: licenseDetails,
            recommended: recommendedLicenseDetails
        }
    };
}

async function performManualModeStorageSavingsCalculations(
    accountId: string,
    region: string,
    params: ManualStorageSavingsRequestBodyType
) {
    logger.info('Getting manual mode storage savings calculations ', {
        accountId,
        region,
        params
    });
    const marketingRequestBody = getMarketingApiManualModeRequestBody(region, params) as ManualModeMarketingRequestBody;

    if (marketingRequestBody?.instances) {
        const { ebsTotal, fsx, single, multi } = await getManualModeStorageSavings<ManualModeEbsComparisonResponse>(
            accountId,
            marketingRequestBody
        );

        const { compute, license } = await manualModeComputeLicenseDetails(region, params);

        const singleFsxCalculationData = single?.fsx_calculation
            ? handleMarketingApiFsxCalculationObject(single.fsx_calculation)
            : undefined;
        const multiFsxCalculationData = multi?.fsx_calculation
            ? handleMarketingApiFsxCalculationObject(multi.fsx_calculation)
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

    const resp = await getManualModeStorageSavings<ManualModeFsxwComparisonResponse>(accountId, marketingRequestBody);

    const { fsx_calculation: fsxCalculation, fsx, fsxw } = resp;
    const fsxCalculationData = fsxCalculation ? handleMarketingApiFsxCalculationObject(fsxCalculation) : undefined;

    const { compute, license } = await manualModeComputeLicenseDetails(region, params);

    return {
        compute,
        license,
        fsx,
        fsxw,
        ...(fsxCalculationData && {
            fsxCalculation: fsxCalculationData,
            fsxBreakdown: fsxStorageCapacityBreakdown(
                fsxCalculationData.totalStorageCapacity,
                params.sqlServerDeploymentType!
            )
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
}

async function getManualModeStorageSavingsCalculationMetrics(
    accountId: string,
    region: string,
    params: ManualStorageSavingsRequestBodyType
): Promise<StorageSavingsMetricsCalculationsResponseType> {
    logger.info('Getting manual mode storage savings calculation metrics ', {
        accountId,
        region,
        params
    });

    const { compute, license } = await manualModeComputeLicenseDetails(region, params);

    const { ebsCalculation, ebsCloneCalculation, ebsSnapshotCalculation, single, multi } =
        await formatManualStorageSavingsCalculationMetrics(accountId, region, params);

    return {
        recommendedComputeCalculation: compute.recommended,
        recommendedLicenseCalculation: license.recommended,
        existingComputeCalculation: compute.existing,
        existingLicenseCalculation: license.existing,
        ebsCalculation,
        ebsCloneCalculation,
        ebsSnapshotCalculation,
        ...(single && { single }),
        ...(multi && { multi })
    };
}

export {
    performStorageSavingsCalculations,
    getStorageSavingsCalculationMetrics,
    performManualModeStorageSavingsCalculations,
    getManualModeStorageSavingsCalculationMetrics
};
