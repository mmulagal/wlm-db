import createError from 'http-errors';
import { compact, isEmpty } from 'lodash-es';
import { getHostAndSqlServerInfo } from './discover-operations';
import { FileSystemTypes, HOURS_IN_MONTH, HttpErrorCodes, SqlServerDeploymentModel } from '../utils/consts';
import {
    ComputeLicenseCostType,
    StorageSavingsMetricsCalculationsResponseType,
    StorageSavingsRequestBodyType,
    StorageSavingsResponseType
} from '../routes/types/storage-savings.types';
import {
    formatStorageSavingsCalculationMetrics,
    handleMarketingApiFsxCalculationObject,
    invokeMarketingApi
} from './cloud-manager/marketing-operations';
import getLogger from '../utils/logger';
import { getMonthlyPriceFromHourlyPrice } from '../utils/utils';
import { DiscoverResponseInfoType, SqlServerInstanceInfoType } from '../routes/types/discover.types';
import { getInstanceDetailsByPrivateIp } from './aws/ec2-operations';
import getSqlInstanceLicenseRecommendations from './recommendation-operations';

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
    nodeDetails: DiscoverResponseInfoType
) {
    logger.info('Performing AOAG storage savings calculations', {
        accountId,
        credentialsId,
        region,
        nodeEbsVolumeIds,
        params
    });

    const { ec2InstanceId: nodeInstanceId, sqlServerInstances } = nodeDetails;
    const [{ nodeIps }] = sqlServerInstances || [];
    if (sqlServerInstances !== undefined && nodeIps && nodeIps.length > 0) {
        const currentNodeComputeLicenseDetails = await retrieveComputeAndLicenseCost(accountId, credentialsId, region, [
            nodeDetails
        ]);
        const { items: partnerNodeDetails } = await getAoagPartnerNodesDetails(
            accountId,
            credentialsId,
            region,
            nodeInstanceId,
            nodeIps
        );
        const [partnerNodeComputeLicenseDetails, { allEbsVolumeIds, uniqueHostVolumeIds }] = await Promise.all([
            retrieveComputeAndLicenseCost(accountId, credentialsId, region, partnerNodeDetails),
            identifyAoagVolumes(
                accountId,
                credentialsId,
                region,
                nodeInstanceId,
                nodeIps,
                sqlServerInstances,
                nodeEbsVolumeIds,
                partnerNodeDetails
            )
        ]);

        const [{ ebs: allEbsDetails }, { ebs, fsx, fsx_calculation: fsxCalculationData }] = await Promise.all([
            invokeMarketingApi(
                accountId,
                credentialsId,
                region,
                SqlServerDeploymentModel.SQL_AOAG_SHORT,
                allEbsVolumeIds, // Consider all EBS volumes for storage, iops and throughput calculation
                params
            ),
            invokeMarketingApi(
                accountId,
                credentialsId,
                region,
                SqlServerDeploymentModel.SQL_AOAG_SHORT,
                uniqueHostVolumeIds, // Consider only volumes associated with unique database in primary and partner node for snapshot calculation and to draw a storage savings comparison with FSXn
                params
            )
        ]);

        const allNodesComputeLicenseDetails = currentNodeComputeLicenseDetails.concat(partnerNodeComputeLicenseDetails);
        const instanceType = `${allNodesComputeLicenseDetails
            .map((node: { ec2InstanceType: any }) => node.ec2InstanceType)
            .join(',')}`;

        const allNodesExistingComputePrice = allNodesComputeLicenseDetails.reduce(
            (
                acc,
                {
                    compute: {
                        existing: { computeHourlyPrice }
                    }
                }
            ) => {
                acc += computeHourlyPrice || 0;
                return acc;
            },
            0
        );

        const existingComputeMonthlyPrice = getMonthlyPriceFromHourlyPrice(allNodesExistingComputePrice);

        const existingSqlServerLicenseEdition = `${allNodesComputeLicenseDetails
            .map(
                ({
                    license: {
                        existing: { sqlServerEdition: eSqlServerEdition }
                    }
                }) => eSqlServerEdition
            )
            .join(',')}`;

        const allNodesExistingLicensePrice = allNodesComputeLicenseDetails.reduce(
            (
                acc,
                {
                    license: {
                        existing: { licenseHourlyPrice }
                    }
                }
            ) => {
                acc += licenseHourlyPrice || 0;
                return acc;
            },
            0
        );
        const existingLicenseMonthlyPrice = getMonthlyPriceFromHourlyPrice(allNodesExistingLicensePrice);

        const allNodesRecommendedComputePrice = allNodesComputeLicenseDetails.reduce(
            (
                acc,
                {
                    compute: {
                        recommended: { computeHourlyPrice }
                    }
                }
            ) => {
                acc += computeHourlyPrice || 0;
                return acc;
            },
            0
        );
        const recommendedComputeMonthlyPrice = getMonthlyPriceFromHourlyPrice(allNodesRecommendedComputePrice);

        const recommendedSqlServerLicenseEdition = `${allNodesComputeLicenseDetails
            .map(
                ({
                    license: {
                        recommended: { sqlServerEdition: rSqlServerEdition }
                    }
                }) => rSqlServerEdition
            )
            .join(',')}`;
        const allNodesRecommendedLicensePrice = allNodesComputeLicenseDetails.reduce(
            (
                acc,
                {
                    license: {
                        recommended: { licenseHourlyPrice }
                    }
                }
            ) => {
                acc += licenseHourlyPrice || 0;
                return acc;
            },
            0
        );
        const recommendedLicenseMonthlyPrice = getMonthlyPriceFromHourlyPrice(allNodesRecommendedLicensePrice);

        const [
            {
                compute: {
                    recommended: { message: recommendedComputeMessage }
                }
            },
            {
                license: {
                    recommended: { message: recommendedLicenseMessage }
                }
            }
        ] = allNodesComputeLicenseDetails;
        return {
            compute: {
                existing: {
                    instanceType,
                    computeMonthlyPrice: existingComputeMonthlyPrice
                },
                recommended: {
                    instanceType,
                    computeMonthlyPrice: recommendedComputeMonthlyPrice,
                    message: recommendedComputeMessage
                }
            },
            license: {
                existing: {
                    sqlServerEdition: existingSqlServerLicenseEdition,
                    licenseMonthlyPrice: existingLicenseMonthlyPrice
                },
                recommended: {
                    sqlServerEdition: recommendedSqlServerLicenseEdition,
                    licenseMonthlyPrice: recommendedLicenseMonthlyPrice,
                    message: recommendedLicenseMessage
                }
            },
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
            fsxCalculation: handleMarketingApiFsxCalculationObject(fsxCalculationData)
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
    currentNodeComputeLicenseDetails: ComputeLicenseCostType
) {
    logger.info('Performing AOAG storage savings calculations', {
        accountId,
        credentialsId,
        region,
        nodeEbsVolumeIds,
        params,
        nodeDetails
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

        const partnerNodeComputeLicenseDetails = partnerNodeDetails
            ? await retrieveComputeAndLicenseCost(accountId, credentialsId, region, partnerNodeDetails)
            : undefined;

        const allNodesComputeLicenseDetails = partnerNodeComputeLicenseDetails
            ? [currentNodeComputeLicenseDetails, ...partnerNodeComputeLicenseDetails]
            : [currentNodeComputeLicenseDetails];

        const {
            recommendedComputeCalculation,
            recommendedLicenseCalculation,
            existingComputeCalculation,
            existingLicenseCalculation
        } = formatRecommendations(allNodesComputeLicenseDetails);

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
        const { ebsCalculation } = await formatStorageSavingsCalculationMetrics(
            accountId,
            credentialsId,
            region,
            allEbsVolumeIds,
            params,
            SqlServerDeploymentModel.SQL_AOAG_SHORT
        );

        // Consider only volumes associated with unique database in primary and partner nodes for snapshot calculation and to draw a storage savings comparison with FSXn
        const {
            fsxOntapCalculation,
            fsxOntapSnapshotCalculation,
            fsxCloneCalculation,
            ebsCloneCalculation,
            ebsSnapshotCalculation
        } = await formatStorageSavingsCalculationMetrics(
            accountId,
            credentialsId,
            region,
            uniqueHostVolumeIds,
            params,
            SqlServerDeploymentModel.SQL_AOAG_SHORT
        );
        return {
            recommendedComputeCalculation,
            recommendedLicenseCalculation,
            existingComputeCalculation,
            existingLicenseCalculation,
            ebsCalculation,
            fsxOntapCalculation,
            fsxOntapSnapshotCalculation,
            fsxCloneCalculation,
            ebsCloneCalculation,
            ebsSnapshotCalculation
        };
    }
    throw createError(
        HttpErrorCodes.NOT_FOUND,
        'Unable to get AOAG storage savings metrics as no SQL Server instances or partner nodes details found for the provided AOAG configuration'
    );
}

function formatRecommendations(nodesComputeLicenseDetails: ComputeLicenseCostType[]) {
    const recommendedComputeCalculation = compact(nodesComputeLicenseDetails.map(node => node.compute?.recommended));
    const recommendedLicenseCalculation = compact(nodesComputeLicenseDetails.map(node => node.license?.recommended));
    const existingComputeCalculation = compact(nodesComputeLicenseDetails.map(node => node.compute?.existing));
    const existingLicenseCalculation = compact(nodesComputeLicenseDetails.map(node => node.license?.existing));

    return {
        recommendedComputeCalculation,
        recommendedLicenseCalculation,
        existingComputeCalculation,
        existingLicenseCalculation
    };
}

async function retrieveComputeAndLicenseCost(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2HostDetailsList: DiscoverResponseInfoType[]
): Promise<ComputeLicenseCostType[]> {
    logger.info('Retrieving compute and license cost', { accountId, credentialsId, region, ec2HostDetailsList });
    return Promise.all(
        ec2HostDetailsList.map(async ec2HostDetails => {
            const {
                existingCompute: { price: ePrice = undefined, baseInstancePrice: eBasePrice = undefined } = {},
                existingLicense: { price: eLicensePrice = undefined } = {},
                recommendedCompute: {
                    instanceType: rInstanceType = '',
                    price: rPrice = undefined,
                    baseInstancePrice: rBasePrice = undefined,
                    message: computeMessage = undefined
                } = {},
                recommendedLicense: {
                    sqlServerEdition: rSqlServerEdition = undefined,
                    price: rLicensePrice = undefined,
                    message: licenseMessage = undefined
                } = {}
            } = (await getSqlInstanceLicenseRecommendations(accountId, credentialsId, region, ec2HostDetails)) || {};
            const [{ sqlServerEdition }] = ec2HostDetails.sqlServerInstances || [];
            const existingInstanceType = ec2HostDetails.ec2InstanceType;

            return {
                ec2InstanceId: ec2HostDetails.ec2InstanceId,
                ec2InstanceType: ec2HostDetails.ec2InstanceType,
                compute: {
                    existing: {
                        instanceType: existingInstanceType,
                        computeHourlyPrice: eBasePrice,
                        computeMonthlyPrice: eBasePrice ? getMonthlyPriceFromHourlyPrice(eBasePrice) : undefined,
                        instanceMonthlyPrice: ePrice ? getMonthlyPriceFromHourlyPrice(ePrice) : undefined,
                        hoursInMonth: HOURS_IN_MONTH
                    },
                    recommended: {
                        instanceType: rInstanceType,
                        computeHourlyPrice: rBasePrice,
                        computeMonthlyPrice: rBasePrice ? getMonthlyPriceFromHourlyPrice(rBasePrice) : undefined,
                        instanceMonthlyPrice: rPrice // inclusive of license
                            ? getMonthlyPriceFromHourlyPrice(rPrice)
                            : undefined,
                        hoursInMonth: HOURS_IN_MONTH,
                        message: computeMessage
                    }
                },
                license: {
                    existing: {
                        sqlServerEdition,
                        licenseHourlyPrice: eLicensePrice,
                        licenseIncluded: !!(eLicensePrice && eLicensePrice > 0),
                        licenseMonthlyPrice: eLicensePrice ? getMonthlyPriceFromHourlyPrice(eLicensePrice) : undefined,
                        hoursInMonth: HOURS_IN_MONTH
                    },
                    recommended: {
                        sqlServerEdition: rSqlServerEdition,
                        licenseHourlyPrice: rLicensePrice,
                        licenseIncluded: !!(rLicensePrice && rLicensePrice > 0),
                        licenseMonthlyPrice: rLicensePrice ? getMonthlyPriceFromHourlyPrice(rLicensePrice) : undefined,
                        hoursInMonth: HOURS_IN_MONTH,
                        message: licenseMessage
                    }
                }
            };
        })
    );
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
        return aoagStorageSavingsCalculations(accountId, credentialsId, region, ebsVolumeIds, params, ec2HostDetails);
    }

    const recommendationPromise = retrieveComputeAndLicenseCost(accountId, credentialsId, region, [ec2HostDetails]);
    const marketingPromise = invokeMarketingApi(
        accountId,
        credentialsId,
        region,
        sqlServerDeploymentType!,
        ebsVolumeIds,
        params
    );

    const [[{ compute, license }], { ebs, fsx, fsx_calculation: fsxCalculationData }] = await Promise.all([
        recommendationPromise,
        marketingPromise
    ]);

    const existingComputeLicensePrice = compute?.existing?.instanceMonthlyPrice || 0;
    const recommendedComputeLicensePrice = compute?.recommended?.instanceMonthlyPrice || 0;
    return {
        compute,
        license,
        ebs,
        fsx,
        totalSummary: {
            existing: ebs.total + existingComputeLicensePrice,
            recommended: fsx.total + recommendedComputeLicensePrice
        },
        fsxCalculation: handleMarketingApiFsxCalculationObject(fsxCalculationData)
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
    const [currentNodeComputeLicenseDetails] = await retrieveComputeAndLicenseCost(accountId, credentialsId, region, [
        ec2HostDetails
    ]);
    if (nodeIps && !isEmpty(nodeIps) && sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT) {
        return aoagStorageSavingsMetrics(
            accountId,
            credentialsId,
            region,
            ebsVolumeIds,
            params,
            ec2HostDetails,
            currentNodeComputeLicenseDetails
        );
    }

    const {
        recommendedComputeCalculation,
        recommendedLicenseCalculation,
        existingComputeCalculation,
        existingLicenseCalculation
    } = formatRecommendations([currentNodeComputeLicenseDetails]);
    const {
        ebsCalculation,
        ebsCloneCalculation,
        ebsSnapshotCalculation,
        fsxOntapCalculation,
        fsxCloneCalculation,
        fsxOntapSnapshotCalculation
    } = await formatStorageSavingsCalculationMetrics(
        accountId,
        credentialsId,
        region,
        ebsVolumeIds,
        params,
        sqlServerDeploymentType!
    );

    return {
        recommendedComputeCalculation,
        recommendedLicenseCalculation,
        existingComputeCalculation,
        existingLicenseCalculation,
        ebsCalculation,
        ebsCloneCalculation,
        ebsSnapshotCalculation,
        fsxOntapCalculation,
        fsxCloneCalculation,
        fsxOntapSnapshotCalculation
    };
}

export { performStorageSavingsCalculations, getStorageSavingsCalculationMetrics };
