import createError from 'http-errors';
import { compact, isEmpty, partition, uniq } from 'lodash-es';
import { getHostAndSqlServerInfo } from './discover-operations';
import { FileSystemTypes, HOURS_IN_MONTH, HttpErrorCodes, SqlServerDeploymentModel } from '../utils/consts';
import {
    BulkStorageSavingsCalculationsMetricsResponseType,
    BulkStorageSavingsRequestBodyType,
    BulkStorageSavingsResponseType,
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
    handleMarketingApiFsxCalculationObject
} from './cloud-manager/marketing/marketing-operations';
import getLogger from '../utils/logger';
import { fsxStorageCapacityBreakdown, getMonthlyPriceFromHourlyPrice, isMultiAzDeployment } from '../utils/utils';
import { DiscoverResponseInfoType, SqlServerInstanceInfoType } from '../routes/types/discover.types';
import { getInstanceDetailsByPrivateIp } from './aws/ec2-operations';
import { getSqlInstanceLicenseRecommendations, manualModeComputeLicenseDetails } from './recommendation-operations';
import { getEbsManualModeStorageSavings, getFsxwManualModeStorageSavings } from '../lib/cloud-manager/marketing';
import {
    ManualModeEbsComparisonV2Response,
    ManualModeFsxwComparisonResponse,
    StorageSummary
} from '../utils/marketing-types';
import { invokeMarketingApi } from './cloud-manager/marketing/marketing-operations-utils';
import {
    getEbsMarketingApiManualModeRequestBody,
    getFsxwMarketingApiManualModeRequestBody
} from './cloud-manager/marketing/marketing-request-utils';

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

function getExistingAndRecommendedComputeAndLicense(computeAndLicenseCostList: ComputeLicenseCostType[]) {
    return computeAndLicenseCostList.reduce(
        (acc, curr) => {
            acc.existingComputeLicensePrice += Number(curr.compute.existing?.instanceMonthlyPrice || 0);
            acc.recommendedComputeLicensePrice += Number(curr.compute.recommended?.instanceMonthlyPrice || 0);
            return acc;
        },
        {
            existingComputeLicensePrice: 0,
            recommendedComputeLicensePrice: 0
        }
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

function identifyAoagVolumes(
    nodeSqlServerInstances: SqlServerInstanceInfoType[],
    nodeEbsVolumeIds: string[],
    partnerNodesDetails: DiscoverResponseInfoType[]
) {
    logger.info('Identifying AOAG volumes', {
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
    instanceId?: string,
    isBulk = false
) {
    logger.info('Performing AOAG storage savings calculations', {
        accountId,
        credentialsId,
        region,
        nodeEbsVolumeIds,
        params,
        instanceId,
        isBulk
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
            params.monthlySqlByolCost
        ); // retrieves compute and license cost for all nodes in the AOAG cluster

        const { allEbsVolumeIds, uniqueHostVolumeIds } = identifyAoagVolumes(
            sqlServerInstances,
            nodeEbsVolumeIds,
            partnerNodeDetails
        );

        if (isBulk) {
            return {
                allNodesComputeLicenseDetails,
                allEbsVolumeIds,
                uniqueHostVolumeIds
            };
        }

        const [{ ebs: allEbsDetails }, { ebs, fsx, single, multi, fsxOptimized, fsxOptimizedSingle }] =
            await Promise.all([
                invokeMarketingApi(
                    accountId,
                    credentialsId,
                    region,
                    SqlServerDeploymentModel.SQL_AOAG_SHORT,
                    allEbsVolumeIds, // Consider all EBS volumes for storage, iops and throughput calculation
                    params,
                    [instanceId ?? '']
                ),
                invokeMarketingApi(
                    accountId,
                    credentialsId,
                    region,
                    SqlServerDeploymentModel.SQL_AOAG_SHORT,
                    uniqueHostVolumeIds, // Consider only volumes associated with unique database in primary and partner node for snapshot calculation and to draw a storage savings comparison with FSXn
                    params,
                    [instanceId ?? '']
                )
            ]);

        // existing compute and license details
        const allNodesExistingComputePrice = allNodesComputeLicenseDetails.compute.existing.computeHourlyPrice;
        const existingComputeMonthlyPrice = getMonthlyPriceFromHourlyPrice(allNodesExistingComputePrice || 0);
        const allNodesExistingLicensePrice = allNodesComputeLicenseDetails.license.existing.licenseHourlyPrice;
        const existingLicenseMonthlyPrice = getMonthlyPriceFromHourlyPrice(allNodesExistingLicensePrice || 0);

        const { compute, license, deploymentType, hostname } = allNodesComputeLicenseDetails;

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
        const fsxOptimizedSingleFsxCalculationData = fsxOptimizedSingle?.fsx_calculation
            ? handleMarketingApiFsxCalculationObject(
                  fsxOptimizedSingle.fsx_calculation,
                  fsxOptimizedSingle.fsx_cost_calculation_no_snapshot
              )
            : undefined;
        return {
            compute: { ...compute, deploymentType, hostname },
            license: { ...license, deploymentType, hostname },
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
                recommended: fsx.total + recommendedComputeMonthlyPrice! + recommendedLicenseMonthlyPrice!,
                ...(fsxOptimized && {
                    optimized:
                        (fsxOptimized as StorageSummary).total +
                        recommendedComputeMonthlyPrice! +
                        recommendedLicenseMonthlyPrice!
                })
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
            }),
            ...(fsxOptimizedSingleFsxCalculationData && {
                fsxOptimizedSingle: {
                    fsxCalculation: fsxOptimizedSingleFsxCalculationData,
                    fsxBreakdown: fsxStorageCapacityBreakdown(
                        fsxOptimizedSingleFsxCalculationData.totalStorageCapacity,
                        SqlServerDeploymentModel.SQL_AOAG_SHORT
                    )
                }
            }),
            ...(fsxOptimized && { fsxOptimized })
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
    const { sqlServerInstances } = nodeDetails;
    const [{ nodeIps }] = sqlServerInstances || [];
    if (sqlServerInstances !== undefined && nodeIps && nodeIps.length > 0) {
        const {
            compute: { existing: existingComputeCalculation, recommended: recommendedComputeCalculation },
            license: { existing: existingLicenseCalculation, recommended: recommendedLicenseCalculation },
            hostname,
            deploymentType
        } = currentNodeComputeLicenseDetails;

        const { allEbsVolumeIds, uniqueHostVolumeIds } = identifyAoagVolumes(
            sqlServerInstances,
            nodeEbsVolumeIds,
            partnerNodeDetails
        );

        // Consider all EBS volumes for storage, iops and throughput calculation
        const {
            ebs,
            fsx,
            fsxOptimized,
            ebsCalculation: allVolumesEbsCalculation
        } = await formatStorageSavingsCalculationMetrics(
            accountId,
            credentialsId,
            region,
            allEbsVolumeIds,
            params,
            SqlServerDeploymentModel.SQL_AOAG_SHORT,
            [instanceId ?? '']
        );
        // Consider only volumes associated with unique database in primary and partner nodes for snapshot calculation and to draw a storage savings comparison with FSXn
        const {
            single,
            multi,
            fsxOptimizedSingle,
            ebsCloneCalculation: uniqueVolumesEbsCloneCalculation,
            ebsSnapshotCalculation: uniqueVolumesEbsSnapshotCalculation
        } = await formatStorageSavingsCalculationMetrics(
            accountId,
            credentialsId,
            region,
            uniqueHostVolumeIds,
            params,
            SqlServerDeploymentModel.SQL_AOAG_SHORT,
            [instanceId ?? '']
        );
        const existingComputeLicensePrice = Number(existingComputeCalculation?.instanceMonthlyPrice || 0);
        const recommendedComputeLicensePrice = Number(recommendedComputeCalculation?.instanceMonthlyPrice || 0);

        return {
            recommendedComputeCalculation: { ...recommendedComputeCalculation, hostname, deploymentType },
            recommendedLicenseCalculation: { ...recommendedLicenseCalculation, hostname, deploymentType },
            existingComputeCalculation: { ...existingComputeCalculation, hostname, deploymentType },
            existingLicenseCalculation: { ...existingLicenseCalculation, hostname, deploymentType },
            ebsCalculation: allVolumesEbsCalculation,
            single,
            multi,
            ...(fsxOptimizedSingle && { fsxOptimizedSingle }),
            ebsCloneCalculation: uniqueVolumesEbsCloneCalculation,
            ebsSnapshotCalculation: uniqueVolumesEbsSnapshotCalculation,
            totalSummary: {
                existing: ebs ? ebs.total + existingComputeLicensePrice : existingComputeLicensePrice,
                recommended: fsx ? fsx.total + recommendedComputeLicensePrice : recommendedComputeLicensePrice,
                ...(fsxOptimized && {
                    optimized: (fsxOptimized as StorageSummary).total + recommendedComputeLicensePrice
                })
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

    const [{ windowsOsVersion, sqlServerDeploymentType, sqlServerName }] = ec2HostDetails.sqlServerInstances || [];

    return {
        ec2InstanceId,
        ec2InstanceType,
        deploymentType: sqlServerDeploymentType,
        hostname: sqlServerName,
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
    instanceIds: string[],
    params: StorageSavingsRequestBodyType | BulkStorageSavingsRequestBodyType
) {
    logger.info('Performing storage savings calculations ', { accountId, credentialsId, region, instanceIds, params });

    const { items: ec2HostDetails } = await getHostAndSqlServerInfo(
        accountId,
        credentialsId,
        region,
        undefined,
        undefined,
        instanceIds
    );

    const sqlServerInstances = compact((ec2HostDetails || []).flatMap(item => item?.sqlServerInstances) || []);
    const fsxwInstances = sqlServerInstances?.filter(sqlServerInstance =>
        sqlServerInstance?.storage?.some(storage => storage.type === FileSystemTypes.FSXW)
    );
    const isBulk = (params as BulkStorageSavingsRequestBodyType).bulk;
    const hostsMap = new Map(
        isBulk
            ? (params as BulkStorageSavingsRequestBodyType).hosts?.map(host => [
                  host.ec2InstanceId,
                  host.monthlySqlByolCost
              ])
            : []
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
                `No FSXW instances found for the provided instance: ${instanceIds.join(', ')}`
            );
        }

        const marketingPromise = invokeMarketingApi(
            accountId,
            credentialsId,
            region,
            sqlServerDeploymentType!,
            [],
            params,
            instanceIds,
            fileSystemsIds
        );
        const recommendationPromise = Promise.all(
            ec2HostDetails.map(hostDetail =>
                retrieveComputeAndLicenseCost(accountId, credentialsId, region, hostDetail, undefined, true)
            )
        );
        const [computeAndLicenseCostList, { fsx, single, multi, fsxw, fsxOptimizedSingle, fsxOptimized }] =
            await Promise.all([recommendationPromise, marketingPromise]);

        const { existingComputeLicensePrice, recommendedComputeLicensePrice } =
            getExistingAndRecommendedComputeAndLicense(computeAndLicenseCostList);

        const singleFsxCalculationData = single?.fsx_calculation
            ? handleMarketingApiFsxCalculationObject(single.fsx_calculation, single.fsx_cost_calculation_no_snapshot)
            : undefined;

        const multiFsxCalculationData = multi?.fsx_calculation
            ? handleMarketingApiFsxCalculationObject(multi.fsx_calculation, multi.fsx_cost_calculation_no_snapshot)
            : undefined;

        const [{ compute, license, deploymentType, hostname } = {}] = computeAndLicenseCostList;
        return {
            compute: isBulk
                ? computeAndLicenseCostList.map(item => ({
                      ...item.compute,
                      deploymentType: item.deploymentType,
                      hostname: item.hostname
                  }))
                : {
                      ...compute,
                      deploymentType,
                      hostname
                  },
            license: isBulk
                ? computeAndLicenseCostList.map(item => ({
                      ...item.license,
                      deploymentType: item.deploymentType,
                      hostname: item.hostname
                  }))
                : {
                      ...license,
                      deploymentType,
                      hostname
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
        throw createError(
            HttpErrorCodes.NOT_FOUND,
            `No EBS volumes found for the provided instance: ${instanceIds.join(', ')}`
        );
    }

    const isAoag = sqlServerInstances.some(
        ({ sqlServerDeploymentType }) => sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT
    );
    const isFci = sqlServerInstances.some(
        ({ sqlServerDeploymentType }) => sqlServerDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT
    );
    const sqlServerDeploymentType = isAoag
        ? SqlServerDeploymentModel.SQL_AOAG_SHORT
        : isFci
        ? SqlServerDeploymentModel.SQL_FCI_SHORT
        : SqlServerDeploymentModel.SQL_STANDALONE_SHORT;

    if (isAoag) {
        if (isBulk) {
            return mixOfAoagAndNonAoagStorageSavingsCalculations(
                accountId,
                credentialsId,
                region,
                params,
                ec2HostDetails,
                instanceIds
            );
        }
        return aoagStorageSavingsCalculations(
            accountId,
            credentialsId,
            region,
            ebsVolumeIds,
            params,
            ec2HostDetails[0],
            instanceIds[0]
        );
    }

    const recommendationPromise = Promise.allSettled(
        ec2HostDetails.map(host =>
            retrieveComputeAndLicenseCost(accountId, credentialsId, region, host, hostsMap.get(host.ec2InstanceId))
        )
    ).then(results => results.filter(result => result.status === 'fulfilled').map(result => result.value));
    const marketingPromise = invokeMarketingApi(
        accountId,
        credentialsId,
        region,
        sqlServerDeploymentType,
        ebsVolumeIds,
        params,
        instanceIds
    );

    const [computeAndLicenseCostList, { ebs, fsx, single, multi, fsxOptimizedSingle, fsxOptimized }] =
        await Promise.all([recommendationPromise, marketingPromise]);

    const { existingComputeLicensePrice, recommendedComputeLicensePrice } =
        getExistingAndRecommendedComputeAndLicense(computeAndLicenseCostList);

    const singleFsxCalculationData = single?.fsx_calculation
        ? handleMarketingApiFsxCalculationObject(single.fsx_calculation, single.fsx_cost_calculation_no_snapshot)
        : undefined;
    const multiFsxCalculationData = multi?.fsx_calculation
        ? handleMarketingApiFsxCalculationObject(multi.fsx_calculation, multi.fsx_cost_calculation_no_snapshot)
        : undefined;
    const fsxOptimizedSingleFsxCalculationData = fsxOptimizedSingle?.fsx_calculation
        ? handleMarketingApiFsxCalculationObject(
              fsxOptimizedSingle.fsx_calculation,
              fsxOptimizedSingle.fsx_cost_calculation_no_snapshot
          )
        : undefined;
    const [{ compute, license, deploymentType, hostname } = {}] = computeAndLicenseCostList;
    return {
        compute: isBulk
            ? computeAndLicenseCostList.map(item => ({
                  ...item.compute,
                  deploymentType: item.deploymentType,
                  hostname: item.hostname
              }))
            : {
                  ...compute,
                  deploymentType,
                  hostname
              },
        license: isBulk
            ? computeAndLicenseCostList.map(item => ({
                  ...item.license,
                  deploymentType: item.deploymentType,
                  hostname: item.hostname
              }))
            : {
                  ...license,
                  deploymentType,
                  hostname
              },
        ebs,
        fsx,
        ...(fsxOptimized && { fsxOptimized }),
        totalSummary: {
            existing: Number(ebs?.total || 0) + existingComputeLicensePrice,
            recommended: fsx.total + recommendedComputeLicensePrice,
            ...(fsxOptimized && {
                optimized: (fsxOptimized as StorageSummary).total + recommendedComputeLicensePrice
            })
        },
        ...(singleFsxCalculationData && {
            single: {
                fsxCalculation: singleFsxCalculationData,
                fsxBreakdown: fsxStorageCapacityBreakdown(
                    singleFsxCalculationData.totalStorageCapacity,
                    sqlServerDeploymentType
                )
            }
        }),
        ...(multiFsxCalculationData && {
            multi: {
                fsxCalculation: multiFsxCalculationData,
                fsxBreakdown: fsxStorageCapacityBreakdown(
                    multiFsxCalculationData.totalStorageCapacity,
                    sqlServerDeploymentType
                )
            }
        }),
        ...(fsxOptimizedSingleFsxCalculationData && {
            fsxOptimizedSingle: {
                fsxCalculation: fsxOptimizedSingleFsxCalculationData,
                fsxBreakdown: fsxStorageCapacityBreakdown(
                    fsxOptimizedSingleFsxCalculationData.totalStorageCapacity,
                    sqlServerDeploymentType
                )
            }
        })
    };
}

async function getStorageSavingsCalculationMetrics(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceIds: string[],
    params: StorageSavingsRequestBodyType | BulkStorageSavingsRequestBodyType
): Promise<any> {
    logger.info('Getting storage savings calculation metrics ', {
        accountId,
        credentialsId,
        region,
        instanceIds,
        params
    });

    const { items: ec2HostDetails } = await getHostAndSqlServerInfo(
        accountId,
        credentialsId,
        region,
        undefined,
        undefined,
        instanceIds
    );

    const sqlServerInstances = compact((ec2HostDetails || []).flatMap(item => item?.sqlServerInstances) || []);
    const fsxwInstances = sqlServerInstances?.filter(sqlServerInstance =>
        sqlServerInstance?.storage?.some(storage => storage.type === FileSystemTypes.FSXW)
    );
    const isBulk = (params as BulkStorageSavingsRequestBodyType).bulk;
    const hostsMap = new Map(
        isBulk
            ? (params as BulkStorageSavingsRequestBodyType).hosts?.map(host => [
                  host.ec2InstanceId,
                  host.monthlySqlByolCost
              ])
            : []
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
                `No FSXW instances found for the provided instance: ${instanceIds.join()}`
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
                instanceIds,
                fileSystemsIds
            );

        const computeAndLicenseCostList = await Promise.all(
            ec2HostDetails.map(host =>
                retrieveComputeAndLicenseCost(accountId, credentialsId, region, host, undefined, true)
            )
        );

        const { existingComputeLicensePrice, recommendedComputeLicensePrice } =
            getExistingAndRecommendedComputeAndLicense(computeAndLicenseCostList);
        const [{ compute, license, deploymentType, hostname } = {}] = computeAndLicenseCostList;

        return {
            recommendedComputeCalculation: isBulk
                ? computeAndLicenseCostList.map(item => ({
                      hostname: item.hostname,
                      deploymentType: item.deploymentType,
                      ...item.compute.recommended
                  }))
                : {
                      ...compute?.recommended,
                      deploymentType,
                      hostname
                  },
            recommendedLicenseCalculation: isBulk
                ? computeAndLicenseCostList.map(item => ({
                      hostname: item.hostname,
                      deploymentType: item.deploymentType,
                      ...item.license.recommended
                  }))
                : {
                      ...license?.recommended,
                      deploymentType,
                      hostname
                  },
            existingComputeCalculation: isBulk
                ? computeAndLicenseCostList.map(item => ({
                      hostname: item.hostname,
                      deploymentType: item.deploymentType,
                      ...item.compute.existing
                  }))
                : {
                      ...compute?.existing,
                      deploymentType,
                      hostname
                  },
            existingLicenseCalculation: isBulk
                ? computeAndLicenseCostList.map(item => ({
                      hostname: item.hostname,
                      deploymentType: item.deploymentType,
                      ...item.license.existing
                  }))
                : {
                      ...license?.existing,
                      deploymentType,
                      hostname
                  },
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
        throw createError(
            HttpErrorCodes.NOT_FOUND,
            `No EBS volumes found for the provided instance: ${instanceIds.join(', ')}`
        );
    }

    const isAoag = sqlServerInstances.some(
        ({ sqlServerDeploymentType }) => sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT
    );
    const isFci = sqlServerInstances.some(
        ({ sqlServerDeploymentType }) => sqlServerDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT
    );
    const sqlServerDeploymentType = isAoag
        ? SqlServerDeploymentModel.SQL_AOAG_SHORT
        : isFci
        ? SqlServerDeploymentModel.SQL_FCI_SHORT
        : SqlServerDeploymentModel.SQL_STANDALONE_SHORT;

    const nodeIps = compact(sqlServerInstances.flatMap(server => server?.nodeIps || []));
    if (!isEmpty(nodeIps) && isAoag) {
        const [partnerNodesList, currentNodeComputeLicenseDetailsList] = await Promise.all([
            Promise.all(
                instanceIds.map(async instanceId =>
                    getAoagPartnerNodesDetails(accountId, credentialsId, region, instanceId, nodeIps)
                )
            ),
            Promise.allSettled(
                ec2HostDetails.map(host =>
                    retrieveComputeAndLicenseCost(
                        accountId,
                        credentialsId,
                        region,
                        host,
                        hostsMap.get(host.ec2InstanceId) || params.monthlySqlByolCost
                    )
                )
            ).then(results => results.filter(result => result.status === 'fulfilled').map(result => result.value))
        ]);
        const partnerNodeDetails = compact(partnerNodesList.flatMap(result => result.items || []));

        if (isBulk) {
            return mixOfAoagAndNonAoagStorageSavingsMetrics(
                accountId,
                credentialsId,
                region,
                params,
                ec2HostDetails,
                currentNodeComputeLicenseDetailsList,
                partnerNodeDetails,
                instanceIds
            );
        }
        return aoagStorageSavingsMetrics(
            accountId,
            credentialsId,
            region,
            ebsVolumeIds,
            params,
            ec2HostDetails[0],
            currentNodeComputeLicenseDetailsList[0],
            partnerNodeDetails,
            instanceIds[0]
        );
    }

    const computeAndLicenseCostList = await Promise.allSettled(
        ec2HostDetails.map(host =>
            retrieveComputeAndLicenseCost(
                accountId,
                credentialsId,
                region,
                host,
                hostsMap.get(host.ec2InstanceId) || params.monthlySqlByolCost
            )
        )
    ).then(results => results.filter(result => result.status === 'fulfilled').map(result => result.value));

    const {
        ebs,
        ebsCalculation,
        ebsCloneCalculation,
        ebsSnapshotCalculation,
        single,
        multi,
        fsx,
        fsxOptimizedSingle,
        fsxOptimized
    } = await formatStorageSavingsCalculationMetrics(
        accountId,
        credentialsId,
        region,
        ebsVolumeIds,
        params,
        sqlServerDeploymentType,
        instanceIds
    );

    const { existingComputeLicensePrice, recommendedComputeLicensePrice } =
        getExistingAndRecommendedComputeAndLicense(computeAndLicenseCostList);
    const [{ compute, license, deploymentType, hostname } = {}] = computeAndLicenseCostList;

    return {
        recommendedComputeCalculation: isBulk
            ? computeAndLicenseCostList.map(item => ({
                  hostname: item.hostname,
                  deploymentType: item.deploymentType,
                  ...item.compute.recommended
              }))
            : {
                  ...compute?.recommended,
                  deploymentType,
                  hostname
              },
        recommendedLicenseCalculation: isBulk
            ? computeAndLicenseCostList.map(item => ({
                  hostname: item.hostname,
                  deploymentType: item.deploymentType,
                  ...item.license.recommended
              }))
            : {
                  ...license?.recommended,
                  deploymentType,
                  hostname
              },
        existingComputeCalculation: isBulk
            ? computeAndLicenseCostList.map(item => ({
                  hostname: item.hostname,
                  deploymentType: item.deploymentType,
                  ...item.compute.existing
              }))
            : {
                  ...compute?.existing,
                  deploymentType,
                  hostname
              },
        existingLicenseCalculation: isBulk
            ? computeAndLicenseCostList.map(item => ({
                  hostname: item.hostname,
                  deploymentType: item.deploymentType,
                  ...item.license.existing
              }))
            : {
                  ...license?.existing,
                  deploymentType,
                  hostname
              },
        ebsCalculation,
        ebsCloneCalculation,
        ebsSnapshotCalculation,
        single,
        multi,
        ...(fsxOptimizedSingle && { fsxOptimizedSingle }),
        totalSummary: {
            existing: ebs ? ebs.total + existingComputeLicensePrice : existingComputeLicensePrice,
            recommended: fsx ? fsx.total + recommendedComputeLicensePrice : recommendedComputeLicensePrice,
            ...(fsxOptimized && { optimized: (fsxOptimized as StorageSummary).total + recommendedComputeLicensePrice })
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
    if (!isEmpty(params?.ec2Instances[0]?.volumes)) {
        // EBS flow
        return handleEbsWorkflow(accountId, region, params, nodeCount, isOnpremTcoFlow);
    }
    return handleFsxwWorkflow(region, params, accountId, nodeCount);
}

async function handleEbsWorkflow(
    accountId: string,
    region: string,
    params: ManualStorageSavingsRequestBodyType,
    nodeCount: number,
    isOnpremTcoFlow: boolean
) {
    logger.info('Handling EBS workflow for manual mode storage savings calculation', {
        accountId,
        region,
        params,
        nodeCount,
        isOnpremTcoFlow
    });

    const { sqlServerDeploymentType } = params;
    const ebsMarketingRequestBody = getEbsMarketingApiManualModeRequestBody(region, params);

    const {
        ebsTotal,
        fsx,
        fsx_calculation: fsxCalculation,
        fsx_cost_calculation_no_snapshot: fsxCostCalculationNoSnapshot
    } = await getEbsManualModeStorageSavings<ManualModeEbsComparisonV2Response>(accountId, ebsMarketingRequestBody);
    const { compute, license } = await manualModeComputeLicenseDetails(region, params, nodeCount, isOnpremTcoFlow);

    const isMultiAz = isMultiAzDeployment(sqlServerDeploymentType);

    const fsxCalculationData = handleMarketingApiFsxCalculationObject(fsxCalculation, fsxCostCalculationNoSnapshot);

    return {
        compute,
        license,
        ebs: ebsTotal,
        fsx,
        ...(!isMultiAz && {
            single: {
                fsxCalculation: fsxCalculationData,
                fsxBreakdown: fsxStorageCapacityBreakdown(
                    fsxCalculationData.totalStorageCapacity,
                    sqlServerDeploymentType!
                )
            }
        }),
        ...(isMultiAz && {
            multi: {
                fsxCalculation: fsxCalculationData,
                fsxBreakdown: fsxStorageCapacityBreakdown(
                    fsxCalculationData.totalStorageCapacity,
                    sqlServerDeploymentType!
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

async function handleFsxwWorkflow(
    region: string,
    params: ManualStorageSavingsRequestBodyType,
    accountId: string,
    nodeCount: number
) {
    const fsxwMarketingRequestBody = getFsxwMarketingApiManualModeRequestBody(region, params);
    if (!fsxwMarketingRequestBody) {
        throw createError(
            HttpErrorCodes.NOT_FOUND,
            'No FSxW configuration found for the provided manual mode parameters. Please ensure that the request includes valid FSxW configuration details such as file system type, storage capacity, and deployment type.'
        );
    }
    const resp = await getFsxwManualModeStorageSavings<ManualModeFsxwComparisonResponse>(
        accountId,
        fsxwMarketingRequestBody
    );

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
            [isMultiAzDeployment(params.sqlServerDeploymentType) ? 'multi' : 'single']: {
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

function returnAoagStorageSavingsResponse({
    compute,
    license,
    existingComputeMonthlyPrice,
    existingLicenseMonthlyPrice,
    recommendedComputeMonthlyPrice,
    recommendedLicenseMonthlyPrice,
    allEbsCapacityDetails,
    uniqueEbsCapacityDetails
}: {
    compute: ComputeLicenseCostType['compute'] | ComputeLicenseCostType['compute'][];
    license: ComputeLicenseCostType['license'] | ComputeLicenseCostType['license'][];
    existingComputeMonthlyPrice?: number;
    existingLicenseMonthlyPrice?: number;
    recommendedComputeMonthlyPrice?: number;
    recommendedLicenseMonthlyPrice?: number;
    allEbsCapacityDetails: any;
    uniqueEbsCapacityDetails: any;
}): Promise<BulkStorageSavingsResponseType> {
    logger.info('Returning AOAG storage savings response', {
        compute,
        license,
        existingComputeMonthlyPrice,
        existingLicenseMonthlyPrice,
        recommendedComputeMonthlyPrice,
        recommendedLicenseMonthlyPrice,
        allEbsCapacityDetails,
        uniqueEbsCapacityDetails
    });

    const { ebs: allEbsDetails } = allEbsCapacityDetails;
    const { ebs, fsx, single, multi, fsxOptimized, fsxOptimizedSingle } = uniqueEbsCapacityDetails;

    const singleFsxCalculationData = single?.fsx_calculation
        ? handleMarketingApiFsxCalculationObject(single.fsx_calculation, single.fsx_cost_calculation_no_snapshot)
        : undefined;
    const multiFsxCalculationData = multi?.fsx_calculation
        ? handleMarketingApiFsxCalculationObject(multi.fsx_calculation, multi.fsx_cost_calculation_no_snapshot)
        : undefined;
    const fsxOptimizedSingleFsxCalculationData = fsxOptimizedSingle?.fsx_calculation
        ? handleMarketingApiFsxCalculationObject(
              fsxOptimizedSingle.fsx_calculation,
              fsxOptimizedSingle.fsx_cost_calculation_no_snapshot
          )
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
            recommended: fsx.total + recommendedComputeMonthlyPrice! + recommendedLicenseMonthlyPrice!,
            ...(fsxOptimized && {
                optimized:
                    (fsxOptimized as StorageSummary).total +
                    recommendedComputeMonthlyPrice! +
                    recommendedLicenseMonthlyPrice!
            })
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
        }),
        ...(fsxOptimizedSingleFsxCalculationData && {
            fsxOptimizedSingle: {
                fsxCalculation: fsxOptimizedSingleFsxCalculationData,
                fsxBreakdown: fsxStorageCapacityBreakdown(
                    fsxOptimizedSingleFsxCalculationData.totalStorageCapacity,
                    SqlServerDeploymentModel.SQL_AOAG_SHORT
                )
            }
        }),
        ...(fsxOptimized && { fsxOptimized })
    };
}

async function mixOfAoagAndNonAoagStorageSavingsCalculations(
    accountId: string,
    credentialsId: string,
    region: string,
    params: StorageSavingsRequestBodyType,
    nodeDetailsList: DiscoverResponseInfoType[],
    instanceIds?: string[]
): Promise<BulkStorageSavingsResponseType> {
    logger.info('Performing AOAG storage savings calculations', {
        accountId,
        credentialsId,
        region,
        params,
        instanceIds
    });

    const sqlServerInstances = compact((nodeDetailsList || []).flatMap(item => item?.sqlServerInstances) || []);
    const aoagClusterNodeDetails = compact(
        nodeDetailsList.filter(node =>
            node?.sqlServerInstances?.some(
                server => server.sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT
            )
        )
    );
    const aoagInstancesIdList = compact(aoagClusterNodeDetails.map(node => node?.ec2InstanceId));

    const nonAoagClusterNodeDetails = compact(
        nodeDetailsList.filter(node =>
            node?.sqlServerInstances?.every(
                server => server.sqlServerDeploymentType !== SqlServerDeploymentModel.SQL_AOAG_SHORT
            )
        )
    );
    const [aoagServerInstances, nonAoagServerInstances] = partition(sqlServerInstances, {
        sqlServerDeploymentType: SqlServerDeploymentModel.SQL_AOAG_SHORT
    });
    const aoagNodeEbsVolumeIds = fetchSqlVolumeIdsByType(FileSystemTypes.EBS, aoagServerInstances);
    const nonAoagNodeEbsVolumeIds = fetchSqlVolumeIdsByType(FileSystemTypes.EBS, nonAoagServerInstances);

    let aoagNodesComputeAndLicenseDetailsPromise: Promise<
        {
            allNodesComputeLicenseDetails: ComputeLicenseCostType;
            allEbsVolumeIds: string[];
            uniqueHostVolumeIds: string[];
        }[]
    > = Promise.resolve([]);
    const instanceIdBYOLMap = new Map(
        (params as BulkStorageSavingsRequestBodyType).hosts?.map(host => [host.ec2InstanceId, host.monthlySqlByolCost])
    );
    if (aoagClusterNodeDetails && !isEmpty(aoagClusterNodeDetails)) {
        aoagNodesComputeAndLicenseDetailsPromise = Promise.allSettled(
            aoagClusterNodeDetails.map((node, index) =>
                aoagStorageSavingsCalculations(
                    accountId,
                    credentialsId,
                    region,
                    aoagNodeEbsVolumeIds,
                    {
                        ...params,
                        monthlySqlByolCost: instanceIdBYOLMap.get(node.ec2InstanceId) ?? params.monthlySqlByolCost
                    },
                    node,
                    aoagInstancesIdList[index],
                    true
                )
            )
        ).then(results => results.filter(result => result.status === 'fulfilled').map(result => result.value));
    }

    let nonAoagNodesComputeAndLicenseDetailsPromise: Promise<ComputeLicenseCostType[]> = Promise.resolve([]);
    if (nonAoagClusterNodeDetails && !isEmpty(nonAoagClusterNodeDetails)) {
        nonAoagNodesComputeAndLicenseDetailsPromise = Promise.allSettled(
            nonAoagClusterNodeDetails.map(node =>
                retrieveComputeAndLicenseCost(
                    accountId,
                    credentialsId,
                    region,
                    node,
                    instanceIdBYOLMap.get(node.ec2InstanceId)
                )
            )
        ).then(results => results.filter(result => result.status === 'fulfilled').map(result => result.value));
    }

    const [aoagNodesDetails, nonAoagNodesComputeAndLicenseDetails] = await Promise.all([
        aoagNodesComputeAndLicenseDetailsPromise,
        nonAoagNodesComputeAndLicenseDetailsPromise
    ]);

    const aoagNodesComputeAndLicenseDetails = aoagNodesDetails.map(node => node.allNodesComputeLicenseDetails);
    const allEbsVolumeIds = uniq([
        ...aoagNodesDetails.flatMap(node => node.allEbsVolumeIds),
        ...nonAoagNodeEbsVolumeIds
    ]);
    const uniqueHostVolumeIds = uniq([
        ...aoagNodesDetails.flatMap(node => node.uniqueHostVolumeIds),
        ...nonAoagNodeEbsVolumeIds
    ]);
    const [allEbsCapacityDetails, uniqueEbsCapacityDetails] = await Promise.all([
        invokeMarketingApi(
            accountId,
            credentialsId,
            region,
            SqlServerDeploymentModel.SQL_AOAG_SHORT,
            allEbsVolumeIds, // Consider all EBS volumes for storage, iops and throughput calculation
            params,
            instanceIds
        ),
        invokeMarketingApi(
            accountId,
            credentialsId,
            region,
            SqlServerDeploymentModel.SQL_AOAG_SHORT,
            uniqueHostVolumeIds, // Consider only volumes associated with unique database in primary and partner node for snapshot calculation and to draw a storage savings comparison with FSXn
            params,
            instanceIds
        )
    ]);

    const compute = [
        ...aoagNodesComputeAndLicenseDetails.map(node => ({
            deploymentType: node.deploymentType,
            hostname: node.hostname,
            ...node.compute
        })),
        ...nonAoagNodesComputeAndLicenseDetails.map(node => ({
            deploymentType: node.deploymentType,
            hostname: node.hostname,
            ...node.compute
        }))
    ];
    const license = [
        ...aoagNodesComputeAndLicenseDetails.map(node => ({
            deploymentType: node.deploymentType,
            hostname: node.hostname,
            ...node.license
        })),
        ...nonAoagNodesComputeAndLicenseDetails.map(node => ({
            deploymentType: node.deploymentType,
            hostname: node.hostname,
            ...node.license
        }))
    ];

    // existing compute and license details
    const allNodesExistingComputePrice = compute.reduce(
        (acc, curr) => acc + (curr.existing.computeHourlyPrice || 0),
        0
    );
    const existingComputeMonthlyPrice = getMonthlyPriceFromHourlyPrice(allNodesExistingComputePrice || 0);
    const allNodesExistingLicensePrice = license.reduce(
        (acc, curr) => acc + (curr.existing.licenseHourlyPrice || 0),
        0
    );
    const existingLicenseMonthlyPrice = getMonthlyPriceFromHourlyPrice(allNodesExistingLicensePrice || 0);

    // recommended compute and license details
    const allNodesRecommendedComputePrice = compute.reduce(
        (acc, curr) => acc + (curr.recommended.computeHourlyPrice || 0),
        0
    );
    const recommendedComputeMonthlyPrice = getMonthlyPriceFromHourlyPrice(allNodesRecommendedComputePrice || 0);
    const allNodesRecommendedLicensePrice = license.reduce(
        (acc, curr) => acc + (curr.recommended.licenseHourlyPrice || 0),
        0
    );
    const recommendedLicenseMonthlyPrice = getMonthlyPriceFromHourlyPrice(allNodesRecommendedLicensePrice || 0);

    return returnAoagStorageSavingsResponse({
        compute,
        license,
        existingComputeMonthlyPrice,
        existingLicenseMonthlyPrice,
        recommendedComputeMonthlyPrice,
        recommendedLicenseMonthlyPrice,
        allEbsCapacityDetails,
        uniqueEbsCapacityDetails
    });
}

async function mixOfAoagAndNonAoagStorageSavingsMetrics(
    accountId: string,
    credentialsId: string,
    region: string,
    params: StorageSavingsRequestBodyType,
    nodeDetailsList: DiscoverResponseInfoType[],
    currentNodeComputeLicenseDetails: ComputeLicenseCostType[],
    partnerNodeDetails: DiscoverResponseInfoType[],
    instanceIds?: string[]
): Promise<BulkStorageSavingsCalculationsMetricsResponseType> {
    logger.info('Performing AOAG storage savings metrics', {
        accountId,
        credentialsId,
        region,
        params
    });
    const sqlServerInstances = compact((nodeDetailsList || []).flatMap(item => item?.sqlServerInstances) || []);

    const [aoagServerInstances, nonAoagServerInstances] = partition(sqlServerInstances, {
        sqlServerDeploymentType: SqlServerDeploymentModel.SQL_AOAG_SHORT
    });
    const aoagNodeEbsVolumeIds = fetchSqlVolumeIdsByType(FileSystemTypes.EBS, aoagServerInstances);
    const nonAoagNodeEbsVolumeIds = fetchSqlVolumeIdsByType(FileSystemTypes.EBS, nonAoagServerInstances);

    const { allEbsVolumeIds, uniqueHostVolumeIds } = identifyAoagVolumes(
        aoagServerInstances,
        aoagNodeEbsVolumeIds,
        partnerNodeDetails
    );

    const {
        ebs,
        fsx,
        fsxOptimized,
        ebsCalculation: allVolumesEbsCalculation
    } = await formatStorageSavingsCalculationMetrics(
        accountId,
        credentialsId,
        region,
        [...allEbsVolumeIds, ...nonAoagNodeEbsVolumeIds],
        params,
        SqlServerDeploymentModel.SQL_AOAG_SHORT,
        instanceIds
    );
    // Consider only volumes associated with unique database in primary and partner nodes for snapshot calculation and to draw a storage savings comparison with FSXn
    const {
        single,
        multi,
        fsxOptimizedSingle,
        ebsCloneCalculation: uniqueVolumesEbsCloneCalculation,
        ebsSnapshotCalculation: uniqueVolumesEbsSnapshotCalculation
    } = await formatStorageSavingsCalculationMetrics(
        accountId,
        credentialsId,
        region,
        [...uniqueHostVolumeIds, ...nonAoagNodeEbsVolumeIds],
        params,
        SqlServerDeploymentModel.SQL_AOAG_SHORT,
        instanceIds
    );
    const { existingComputeLicensePrice, recommendedComputeLicensePrice } = getExistingAndRecommendedComputeAndLicense(
        currentNodeComputeLicenseDetails
    );

    return {
        recommendedComputeCalculation: currentNodeComputeLicenseDetails.map(
            ({ compute: { recommended }, hostname, deploymentType }) => ({ ...recommended, hostname, deploymentType })
        ),
        recommendedLicenseCalculation: currentNodeComputeLicenseDetails.map(
            ({ license: { recommended }, hostname, deploymentType }) => ({ ...recommended, hostname, deploymentType })
        ),
        existingComputeCalculation: currentNodeComputeLicenseDetails.map(
            ({ compute: { existing }, hostname, deploymentType }) => ({ ...existing, hostname, deploymentType })
        ),
        existingLicenseCalculation: currentNodeComputeLicenseDetails.map(
            ({ license: { existing }, hostname, deploymentType }) => ({ ...existing, hostname, deploymentType })
        ),
        ebsCalculation: allVolumesEbsCalculation,
        single,
        multi,
        ...(fsxOptimizedSingle && { fsxOptimizedSingle }),
        ebsCloneCalculation: uniqueVolumesEbsCloneCalculation,
        ebsSnapshotCalculation: uniqueVolumesEbsSnapshotCalculation,
        totalSummary: {
            existing: ebs ? ebs.total + existingComputeLicensePrice : existingComputeLicensePrice,
            recommended: fsx ? fsx.total + recommendedComputeLicensePrice : recommendedComputeLicensePrice,
            ...(fsxOptimized && {
                optimized: (fsxOptimized as StorageSummary).total + recommendedComputeLicensePrice
            })
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
