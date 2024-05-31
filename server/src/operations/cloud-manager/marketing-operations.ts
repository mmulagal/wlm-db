import createError from 'http-errors';
import { compact, isEmpty } from 'lodash-es';
import { getHostAndSqlServerInfo } from '../discover-operations';
import { FileSystemTypes, HttpErrorCodes, SqlServerDeploymentModel, HOURS_IN_MONTH } from '../../utils/consts';
import getLogger from '../../utils/logger';
import getStorageSavings from '../../lib/cloud-manager/marketing';
import {
    ComputeLicenseHourlyCostType,
    StorageSavingsMetricsCalculationsResponseType,
    StorageSavingsRequestBodyType,
    StorageSavingsResponseType
} from '../../routes/types/storage-savings.types';
import { camelizeKeys, convertToBytes } from '../../utils/utils';
import { DiscoverResponseInfoType, SqlServerInstanceInfoType } from '../../routes/types/discover.types';
import { getInstanceDetailsByPrivateIp } from '../aws/ec2-operations';
import { getSqlInstancePricingDetails } from '../aws/pricing-operations';

const logger = getLogger();

function getMonthlyCloneCountFromFrequency(cloneRefreshFrequency: string) {
    const cloneRefreshFrequencyLowerCase = cloneRefreshFrequency.toLowerCase();
    return cloneRefreshFrequencyLowerCase === 'daily' ? 30 : cloneRefreshFrequencyLowerCase === 'weekly' ? 4 : 1;
}

function retrieveSpecificVolumeTypeVolumeIdsFromSqlServerInstances(
    type: string,
    sqlServerInstances: SqlServerInstanceInfoType[]
) {
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

async function getAoagPartnerNodeDetails(
    accountId: string,
    credentialsId: string,
    region: string,
    nodeInstanceId: string,
    nodeIps: string[]
) {
    const aoagClusterNodeDetails = (await getInstanceDetailsByPrivateIp(credentialsId, region, nodeIps)) || [];
    const [secondaryNodeInstanceId] = aoagClusterNodeDetails
        .filter(node => node.ec2InstanceId !== nodeInstanceId)
        .map(node => node.ec2InstanceId); // considering only 2 nodes in the cluster; primary node is already considered so getting host details of secondary node

    const {
        items: [secondaryNodeDetails]
    } = await getHostAndSqlServerInfo(accountId, credentialsId, region, undefined, undefined, [
        secondaryNodeInstanceId
    ]);

    return secondaryNodeDetails;
}

async function identifyAoagVolumes(
    accountId: string,
    credentialsId: string,
    region: string,
    nodeInstanceId: string,
    nodeIps: string[],
    nodeSqlServerInstances: SqlServerInstanceInfoType[],
    nodeEbsVolumeIds: string[]
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

    const partnerNodeDetails = await getAoagPartnerNodeDetails(
        accountId,
        credentialsId,
        region,
        nodeInstanceId,
        nodeIps
    );

    const partnerSqlServerInstances = partnerNodeDetails?.sqlServerInstances || [];
    const partnerNodeEbsVolumeIds = retrieveSpecificVolumeTypeVolumeIdsFromSqlServerInstances(
        FileSystemTypes.EBS,
        partnerSqlServerInstances
    );

    const uniquePartnerNodeSqlServerInstances =
        partnerSqlServerInstances?.filter(
            partnerSqlServerInstance =>
                !nodeSqlServerInstances?.some(
                    sqlServerInstance => partnerSqlServerInstance.sqlServerName !== sqlServerInstance.sqlServerName
                )
        ) || [];
    const uniqueSqlHostEbsVolumeIdsPartnerNode = retrieveSpecificVolumeTypeVolumeIdsFromSqlServerInstances(
        FileSystemTypes.EBS,
        uniquePartnerNodeSqlServerInstances
    );
    const allEbsVolumeIds = nodeEbsVolumeIds.concat(...partnerNodeEbsVolumeIds);
    const uniqueHostVolumeIds = nodeEbsVolumeIds.concat(...uniqueSqlHostEbsVolumeIdsPartnerNode);
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
        const { compute, license } = await retrieveComputeAndLicenseHourlyCost(region, nodeDetails);
        const partnerNodeDetails = await getAoagPartnerNodeDetails(
            accountId,
            credentialsId,
            region,
            nodeInstanceId,
            nodeIps
        );
        const { compute: partnerNodeComputeDetails, license: partnerNodeLicenseDetails } =
            await retrieveComputeAndLicenseHourlyCost(region, partnerNodeDetails);

        const { allEbsVolumeIds, uniqueHostVolumeIds } = await identifyAoagVolumes(
            accountId,
            credentialsId,
            region,
            nodeInstanceId,
            nodeIps,
            sqlServerInstances,
            nodeEbsVolumeIds
        );

        // Consider all EBS volumes for storage, iops and throughput calculation
        const { ebs: allEbsDetails } = await getStorageSavings(
            accountId,
            credentialsId,
            region,
            getMarketingApiRequestBody(allEbsVolumeIds, params)
        );

        // Consider only volumes associated with unique database in primary and secondary node for snapshot calculation and to draw a storage savings comparison with FSXn

        const {
            ebs,
            fsx,
            fsx_calculation: fsxCalculationData
        } = await getStorageSavings(
            accountId,
            credentialsId,
            region,
            getMarketingApiRequestBody(uniqueHostVolumeIds, params)
        );

        const instanceType = `${compute.existing.instanceType},${partnerNodeComputeDetails.existing.instanceType}`;
        const computeMonthlyPrice =
            compute?.existing?.computeHourlyPrice && partnerNodeComputeDetails.existing.computeHourlyPrice
                ? compute.existing.computeHourlyPrice +
                  partnerNodeComputeDetails.existing.computeHourlyPrice * HOURS_IN_MONTH
                : undefined;

        const licenseType = `${license?.existing?.licenseType},${partnerNodeLicenseDetails.existing.licenseType}`;
        const licenseMonthlyPrice =
            license?.existing?.licenseHourlyPrice && partnerNodeLicenseDetails.existing.licenseHourlyPrice
                ? license.existing.licenseHourlyPrice +
                  partnerNodeLicenseDetails.existing.licenseHourlyPrice * HOURS_IN_MONTH
                : undefined;

        return {
            compute: {
                existing: {
                    instanceType,
                    computeMonthlyPrice
                },
                recommended: {
                    instanceType,
                    computeMonthlyPrice
                }
            },
            license: {
                existing: {
                    licenseType,
                    licenseMonthlyPrice
                },
                recommended: {
                    licenseType,
                    licenseMonthlyPrice
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
                    computeMonthlyPrice! +
                    licenseMonthlyPrice!,
                recommended: fsx.total + computeMonthlyPrice! + licenseMonthlyPrice!
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
    currentNodeComputeLicenseDetails: ComputeLicenseHourlyCostType
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
        const partnerNodeDetails = await getAoagPartnerNodeDetails(
            accountId,
            credentialsId,
            region,
            nodeInstanceId,
            nodeIps
        );

        const partnerNodeComputeLicenseDetails = partnerNodeDetails
            ? await retrieveComputeAndLicenseHourlyCost(region, partnerNodeDetails)
            : undefined;
        const nodesComputeLicenseDetails = partnerNodeComputeLicenseDetails
            ? [currentNodeComputeLicenseDetails, partnerNodeComputeLicenseDetails]
            : [currentNodeComputeLicenseDetails];

        const { allEbsVolumeIds, uniqueHostVolumeIds } = await identifyAoagVolumes(
            accountId,
            credentialsId,
            region,
            nodeInstanceId,
            nodeIps,
            sqlServerInstances,
            nodeEbsVolumeIds
        );

        // Consider all EBS volumes for storage, iops and throughput calculation
        const { ebsCalculation } = await formatStorageSavingsCalculationMetrics(
            accountId,
            credentialsId,
            region,
            allEbsVolumeIds,
            params,
            nodesComputeLicenseDetails
        );

        // Consider only volumes associated with unique database in primary and secondary node for snapshot calculation and to draw a storage savings comparison with FSXn
        const {
            recommendedComputeCalculation,
            recommendedLicenseCalculation,
            existingComputeCalculation,
            existingLicenseCalculation,
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
            nodesComputeLicenseDetails
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
        'Unable to get AOAG storage savings metrics as no SQL Server instances or partner node details found for the provided AOAG configuration'
    );
}

function getMarketingApiRequestBody(ebsVolumeIds: string[], params: StorageSavingsRequestBodyType) {
    const { snapshotFrequency, clonedCopiesCount, cloneRefreshFrequency, monthlyChangeRatePercentage } = params || {};

    const monthlyCloneCount = getMonthlyCloneCountFromFrequency(cloneRefreshFrequency);
    return {
        useCase: 'Low-latency',
        volumeIds: ebsVolumeIds,
        includeSnapshots: false,
        deploymentType: 'Single',
        snapshots: {
            snapshotFreq: snapshotFrequency,
            snapshotPercentageChange: monthlyChangeRatePercentage
        },
        clones: {
            monthlyCloneNumber: clonedCopiesCount > 0 ? monthlyCloneCount : 0,
            changeRate: monthlyChangeRatePercentage,
            numberOfCloneEnvs: clonedCopiesCount > 0 ? clonedCopiesCount : 0,
            ssdStorage: 100,
            savings: 0
        }
    };
}

function handleMarketingApiFsxCalculationObject(fsxCalculationData: any) {
    logger.debug('Handling marketing FSx calculation object', fsxCalculationData);
    const fsxCalculationObject = camelizeKeys(fsxCalculationData);
    const { totalStorageCapacity, effectiveCapacity, ssdTierReqCapacity, capacityPoolTier, monthlySnapshotCapacity } =
        fsxCalculationObject;
    const capacities = [
        { totalStorageCapacity },
        { effectiveCapacity },
        { ssdTierReqCapacity },
        { capacityPoolTier },
        { monthlySnapshotCapacity }
    ];

    capacities.forEach(capacity => {
        const [key] = Object.keys(capacity);
        const { size, unit } = (capacity as any)[key] as { size: number; unit: string };
        fsxCalculationObject[`${key}`] = convertToBytes(size, unit);
    });

    return fsxCalculationObject;
}

async function retrieveComputeAndLicenseMonthlyCost(region: string, ec2HostDetails: any) {
    logger.info('Retrieving compute and license monthly cost', { region, ec2HostDetails });

    const { compute, license } = await retrieveComputeAndLicenseHourlyCost(region, ec2HostDetails);
    const { instanceType, computeHourlyPrice } = compute.existing;
    const computeMonthlyPrice = computeHourlyPrice ? computeHourlyPrice * HOURS_IN_MONTH : undefined;

    const { licenseType, licenseHourlyPrice } = license.existing;
    const licenseMonthlyPrice = licenseHourlyPrice ? licenseHourlyPrice * HOURS_IN_MONTH : undefined;

    return {
        compute: {
            existing: {
                instanceType,
                computeMonthlyPrice
            },
            recommended: {
                instanceType,
                computeMonthlyPrice
            }
        },
        license: {
            existing: {
                licenseType,
                licenseMonthlyPrice
            },
            recommended: {
                licenseType,
                licenseMonthlyPrice
            }
        }
    };
}

async function retrieveComputeAndLicenseHourlyCost(
    region: string,
    ec2HostDetails: any
): Promise<ComputeLicenseHourlyCostType> {
    logger.info('Retrieving compute and license hourly cost', { region, ec2HostDetails });

    const [{ sqlServerEdition }] = ec2HostDetails.sqlServerInstances || [];
    const existingInstanceType = ec2HostDetails.ec2InstanceType;
    const existingInstanceTypePricingDetails = await getSqlInstancePricingDetails(
        region,
        existingInstanceType,
        'windows'
        // ec2HostDetails.ec2UsageOperation // use usage operation as a filter when supporting other OS; edition has a value like `Enterprise Evaluation Edition (64-bit)` does not narrow down operating system
    );
    const existingSqlServerEditionLowerCase = sqlServerEdition?.toLowerCase();
    const existingLicenseType = existingSqlServerEditionLowerCase?.includes('enterprise')
        ? 'SQL Ent'
        : existingSqlServerEditionLowerCase?.includes('web')
        ? 'SQL Web'
        : 'SQL Std';

    const existingcomputeHourlyPrice = existingInstanceTypePricingDetails?.[existingLicenseType]?.pricePerUnit
        ? existingInstanceTypePricingDetails[existingLicenseType].pricePerUnit
        : undefined;
    const existingcomputeHourlyPriceWithoutLicense = existingInstanceTypePricingDetails?.NA?.pricePerUnit
        ? existingInstanceTypePricingDetails.NA.pricePerUnit
        : undefined;

    const existingLicensePrice =
        existingcomputeHourlyPrice && existingcomputeHourlyPriceWithoutLicense
            ? existingcomputeHourlyPrice - existingcomputeHourlyPriceWithoutLicense
            : 0;

    return {
        compute: {
            existing: {
                instanceType: existingInstanceType,
                computeHourlyPrice: existingcomputeHourlyPriceWithoutLicense,
                instanceHourlyPrice: existingcomputeHourlyPrice // inclusive of license
            },
            recommended: {
                instanceType: existingInstanceType,
                computeHourlyPrice: existingcomputeHourlyPriceWithoutLicense,
                instanceHourlyPrice: existingcomputeHourlyPrice
            }
        },
        license: {
            existing: {
                sqlServerEdition,
                licenseType: existingLicenseType,
                licenseHourlyPrice: existingLicensePrice,
                licenseIncluded: !!(existingLicensePrice && existingLicensePrice > 0)
            },
            recommended: {
                sqlServerEdition,
                licenseType: existingLicenseType,
                licenseHourlyPrice: existingLicensePrice,
                licenseIncluded: !!(existingLicensePrice && existingLicensePrice > 0)
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

    const ebsVolumeIds = retrieveSpecificVolumeTypeVolumeIdsFromSqlServerInstances(
        FileSystemTypes.EBS,
        sqlServerInstances
    );

    if (!ebsVolumeIds.length) {
        throw createError(HttpErrorCodes.NOT_FOUND, `No EBS volumes found for the provided instance: ${instanceId}`);
    }

    const [{ sqlServerDeploymentType, nodeIps }] = ec2HostDetails?.sqlServerInstances || [];
    if (nodeIps && !isEmpty(nodeIps) && sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT) {
        return aoagStorageSavingsCalculations(accountId, credentialsId, region, ebsVolumeIds, params, ec2HostDetails);
    }

    const { compute, license } = await retrieveComputeAndLicenseMonthlyCost(region, ec2HostDetails);

    const {
        ebs,
        fsx,
        fsx_calculation: fsxCalculationData
    } = await getStorageSavings(accountId, credentialsId, region, getMarketingApiRequestBody(ebsVolumeIds, params));

    const existingComputeLicensePrice =
        compute?.existing?.computeMonthlyPrice && license?.existing?.licenseMonthlyPrice
            ? compute.existing.computeMonthlyPrice + license.existing.licenseMonthlyPrice
            : 0;
    const recommendedComputeLicensePrice =
        compute?.recommended?.computeMonthlyPrice && license?.recommended?.licenseMonthlyPrice
            ? compute.recommended.computeMonthlyPrice + license.recommended.licenseMonthlyPrice
            : 0;
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

async function formatStorageSavingsCalculationMetrics(
    accountId: string,
    credentialsId: string,
    region: string,
    ebsVolumeIds: string[],
    params: StorageSavingsRequestBodyType,
    nodesComputeLicenseDetails: ComputeLicenseHourlyCostType[]
) {
    logger.debug('Formatting storage savings calculation metrics', {
        accountId,
        credentialsId,
        region,
        ebsVolumeIds,
        params
    });
    const totalMonthlyClonedCopiesCount =
        params.clonedCopiesCount > 0 ? getMonthlyCloneCountFromFrequency(params.cloneRefreshFrequency) : 0;

    const {
        ebs: { capacity, iops, throughput },
        fsx_cost_calculation_no_snapshot: {
            desiredStorageCapacityGB: { size: desiredStorageCapacitySize, unit: desiredStorageCapacityUnit },
            numberOfVolumes,
            FSXnCapacityPrice: { price: fsxnCapacityPriceWithoutSnapshot, unit: fsxnCapacityUnitWithoutSnapshot },
            percentageOfDataOnSSDStorage,
            maxSSDTierSizeGB: { size: maxSsdTierSize, unit: maxSsdTierSizeUnit },
            throughputCapacity: suggestedFsxnThroughputCapacity,
            maxThroughput,
            FSXnThroughputPrice: fsxnThroughputPrice,
            provisionedSSDIOPS: provisionedSsdIops,
            includedIOPS: includedIops,
            maxSSDIOPS: maxSsdIops,
            EBSCapacity: { size: ebsCapacity, unit: ebsCapacityUnit },
            percentageOfDataOnSSDStorage: percentageDataSsdStorage,
            savingsFromCompressionAndDeduplication: savingsCd,
            storageSavingsFromCompressionAndDeduplication: { size: ssCDSize, unit: ssCDUnit },
            effectiveStorageCapacityForFSxForONTAP: { size: effStorageCapacityFsxn, unit: effStorageCapacityFsxnUnit },
            SSDStorageGBPerMonth: {
                size: ssdStorageGBPerMonthSizeWithoutSnapshot,
                unit: ssdStorageGBPerMonthUnitWithoutSnapshot
            },
            effectiveFSXnSSD: { size: effectiveFSXnSSDSize, unit: effectiveFSXnSSDUnit },
            SSDMonthlyCost: ssdMonthlyCostWithoutSnapshot,
            totalMonthlyCostForFSxSSD: totalMonthlyCostForFSxSsdWithoutSnapshot,
            ratioAfterSavings: ratioAfterSavingsWithohutSnapshot,
            dataOnCapacityPoolStorageFactor: dataOnCapacityPoolStorageFactorWithoutSnapshot,
            capacityPoolStorage: {
                size: capacityPoolStorageWithoutSnapshotSize,
                unit: capacityPoolStorageWithoutSnapshotUnit
            },
            capacityMonthlyCost: capacityMonthlyCostWithoutSnapshot,
            totalMonthlyCostForCapacity: totalMonthlyCostForCapacityWithoutSnapshot,
            totalMonthlyStorageCharge,
            minFileSystemsNumForStorage,
            minFileSystemsForThroughputCapacity,
            minFileSystemsRequiredForSSDIOPS: minFileSystemsNumForSsdIops,
            requiredNumOfFSx_fractional: requiredNumOfFsxFractional,
            requiredNumOfFSx_roundUp: requiredNumOfFsx,
            minThroughputCapacityRequired,
            provisionedThroughputCapacity,
            totalMonthlyCostFSXnThroughputCapacity: totalMonthlyFsxnThroughputCapacityCost,
            includedSSDIOPS: includedSsdIops,
            additionalSSDIOPS: additionalSsdIops,
            billedAdditionalSSDIOPS: billedAdditionalSsdIops,
            additionalBilledCostForSSDIOPS: additionalBilledCostForSsdIops,
            totalThroughputIOPSRequestsChargeMonthly: totalThroughputAndIopsMonthly,
            FSXnIOPSPrice
        },
        fsx_snapshot_cost_calculation: {
            FSXnSSDPrice: { price: fsxnSsdPrice, unit: fsxnSsdPriceUnit },
            FSXnCapacityPrice: { price: fsxnCapacityPrice, unit: fsxnCapacityPriceUnit },
            desiredSnapshotStorageCapacityGB: {
                size: desiredSnapshotStorageCapacityGBSize,
                unit: desiredSnapshotStorageCapacityGBUnit
            },
            dataOnSSDStoragePercentage,
            savingsFromCompressionAndDeduplication,
            storageSavingsFromCompressionAndDeduplication: {
                size: storageSavingsFromCompressionAndDeduplicationSize,
                unit: storageSavingsFromCompressionAndDeduplicationUnit
            },
            effectiveStorageCapacityForFSxForONTAP: {
                size: effectiveStorageCapacityForFSxForONTAPSize,
                unit: effectiveStorageCapacityForFSxForONTAPUnit
            },
            SSDSnapshotStorageGBPerMonth: { size: ssdStorageGBPerMonthSize, unit: ssdStorageGBPerMonthUnit },
            SSDMonthlyCost: ssdMonthlyCost,
            totalSnapshotMonthlyCostForFSxSSD: totalSnapshotMonthlyCostForFsxSsd,
            ratioAfterSavings,
            snapshotDataOnCapacityPoolStorageFactor,
            capacityPoolStorage: { size: capacityPoolStorageSize, unit: capacityPoolStorageUnit },
            capacityMonthlyCost,
            totalMonthlyCostForCapacity,
            totalSnapshotMonthlyCost
        },
        ebs_cost_calculation: {
            instanceAvgDuration,
            EBSCapacityPrice: { price: ebsCapacityPrice, unit: ebsCapacityPriceUnit },
            numberOfVolumes: ebsNumberOfVolumes,
            storageAmountPerVol: { size: storageAmountPerVolSize, unit: storageAmountPerVolUnit },
            totalInstanceHours,
            EBSInstanceMonth: ebsInstanceMonth,
            EBSStorageCost: ebsStorageCost,
            billableIops,
            totalBillableIops,
            EBSIopsCost: ebsIopsCost,
            billableMBps: billableMbps,
            billableThroughputMBps: billableThroughputMbps,
            billableThroughputGBps: billableThroughputGbps,
            EBSThroughputCost: ebsThroughputCost,
            totalSnapshot: totalSnapshots,
            initialSnapshotCost,
            monthlyCostPerSnapshot,
            discountForPartialStorageMonth,
            incrementalSnapshotCost,
            totalSnapshotCost,
            totalEBSSnapshotCost: totalEbsSnapshotCost,
            ebsSnapshotCost,
            AWSEBSTotalCostMonthly: ebsTotalCostMonthly
        },
        fsx_clone_cost_calculation: {
            desiredStorageCapacityGB: { size: cloneDesiredStorageCapacityGB, unit: cloneDesiredStorageCapacityGBUnit },
            percentageOfDataOnSSDStorage: percentageOfDataOnSSDStorageClone,
            savingsFromCompressionAndDeduplication: savingsFromCompressionAndDeduplicationClone,
            storageSavingsFromCompressionAndDeduplication: {
                size: cloneStorageSavingsFromCompressionAndDeduplication,
                unit: cloneStorageSavingsFromCompressionAndDeduplicationUnit
            },
            effectiveStorageCapacityForFSxForONTAP: {
                size: cloneEffectiveStorageCapacityForFSxForONTAP,
                unit: cloneEffectiveStorageCapacityForFSxForONTAPUnit
            },
            FSXnSSDPrice: { price: fsxnSsdClonePrice, unit: fsxnSsdClonePriceUnit },
            SSDCloneStorageGBPerMonth: { size: cloneSSDStorageGBPerMonth, unit: cloneSSDStorageGBPerMonthUnit },
            SSDStorageGBPerMonth: { size: totalSsdStorageGBPerMonthSize, unit: totalSsdStorageGBPerMonthUnit },
            SSDMonthlyCost,
            totalCloneMonthlyCost
        }
    } = await getStorageSavings(accountId, credentialsId, region, getMarketingApiRequestBody(ebsVolumeIds, params));
    return {
        recommendedComputeCalculation: nodesComputeLicenseDetails.map(node => node.compute.recommended),
        recommendedLicenseCalculation: nodesComputeLicenseDetails.map(node => node.license.recommended),
        existingComputeCalculation: nodesComputeLicenseDetails.map(node => node.compute.existing),
        existingLicenseCalculation: nodesComputeLicenseDetails.map(node => node.license.existing),
        fsxOntapCalculation: {
            numberOfVolumes,
            percentageOfDataOnSSDStorage,
            fsxnCapacityPrice: { price: fsxnCapacityPriceWithoutSnapshot, unit: fsxnCapacityUnitWithoutSnapshot },
            maxSsdTierSize: convertToBytes(maxSsdTierSize, maxSsdTierSizeUnit) || 0,
            suggestedFsxnThroughputCapacity,
            maxThroughput,
            fsxnThroughputPrice,
            provisionedSsdIops,
            includedIops,
            maxSsdIops,
            fsxnStoragePrice: {
                price: fsxnSsdPrice,
                unit: fsxnSsdPriceUnit
            },
            desiredStorageCapacity: convertToBytes(desiredStorageCapacitySize, desiredStorageCapacityUnit) || 0,
            ebsCapacity: convertToBytes(ebsCapacity, ebsCapacityUnit) || 0,
            percentageOfDataOnSsdStorage: percentageDataSsdStorage,
            savingsFromCompressionAndDeduplication: savingsCd,
            storageSavingsFromCompressionAndDeduplication: convertToBytes(ssCDSize, ssCDUnit) || 0,
            effectiveFsxnStorageCapacity: convertToBytes(effStorageCapacityFsxn, effStorageCapacityFsxnUnit) || 0,
            ssdStoragePerMonth:
                convertToBytes(ssdStorageGBPerMonthSizeWithoutSnapshot, ssdStorageGBPerMonthUnitWithoutSnapshot) || 0,
            greaterOfSsdAndMinAllowedSsd: convertToBytes(effectiveFSXnSSDSize, effectiveFSXnSSDUnit) || 0,
            ssdMonthlyCost: ssdMonthlyCostWithoutSnapshot,
            totalMonthlyCostForFSxSsd: totalMonthlyCostForFSxSsdWithoutSnapshot,
            ratioAfterSavings: ratioAfterSavingsWithohutSnapshot,
            dataOnCapacityPoolStorageFactor: dataOnCapacityPoolStorageFactorWithoutSnapshot,
            capacityPoolStorage:
                convertToBytes(capacityPoolStorageWithoutSnapshotSize, capacityPoolStorageWithoutSnapshotUnit) || 0,
            capacityMonthlyCost: capacityMonthlyCostWithoutSnapshot,
            totalMonthlyCostForCapacity: totalMonthlyCostForCapacityWithoutSnapshot,
            totalMonthlyStorageCharge,
            minFileSystemsNumForStorage,
            minFileSystemsNumForThroughputCapacity: minFileSystemsForThroughputCapacity,
            minFileSystemsNumForSsdIops,
            requiredNumOfFsxFractional,
            requiredNumOfFsx,
            minThroughputCapacityRequired,
            provisionedThroughputCapacity,
            totalMonthlyFsxnThroughputCapacityCost,
            includedSsdIops,
            additionalSsdIops,
            billedAdditionalSsdIops,
            additionalBilledCostForSsdIops,
            totalThroughputAndIopsMonthly,
            fsxnIopsPrice: FSXnIOPSPrice
        },
        fsxOntapSnapshotCalculation: {
            fsxnSsdPrice: { price: fsxnSsdPrice, unit: fsxnSsdPriceUnit },
            fsxnCapacityPrice: { price: fsxnCapacityPrice, unit: fsxnCapacityPriceUnit },

            desiredStorageCapacity:
                convertToBytes(desiredSnapshotStorageCapacityGBSize, desiredSnapshotStorageCapacityGBUnit) || 0,
            percentageOfDataOnSsdStorage: dataOnSSDStoragePercentage,
            savingsFromCompressionAndDeduplication,
            storageSavingsFromCompressionAndDeduplication:
                convertToBytes(
                    storageSavingsFromCompressionAndDeduplicationSize,
                    storageSavingsFromCompressionAndDeduplicationUnit
                ) || 0,
            effectiveFsxnStorageCapacity:
                convertToBytes(
                    effectiveStorageCapacityForFSxForONTAPSize,
                    effectiveStorageCapacityForFSxForONTAPUnit
                ) || 0,
            ssdStoragePerMonth: convertToBytes(ssdStorageGBPerMonthSize, ssdStorageGBPerMonthUnit) || 0,
            ssdMonthlyCost,
            totalSnapshotMonthlyCostForFsxSsd,
            ratioAfterSavings,
            dataOnCapacityPoolStorageFactor: snapshotDataOnCapacityPoolStorageFactor,
            capacityPoolStorage: convertToBytes(capacityPoolStorageSize, capacityPoolStorageUnit) || 0,
            capacityMonthlyCost,
            totalMonthlyCostForCapacity,
            totalSnapshotMonthlyCost
        },
        ebsCalculation: {
            numberOfVolumes: ebsNumberOfVolumes,
            instanceAvgDuration,
            hoursInAMonth: HOURS_IN_MONTH, // (365 * 24) / 12
            ebsCapacityPrice: { price: ebsCapacityPrice, unit: ebsCapacityPriceUnit },
            storageAmountPerVol: convertToBytes(storageAmountPerVolSize, storageAmountPerVolUnit) || 0,
            totalInstanceHours,
            ebsInstanceMonth,
            ebsStorageCost,
            billableIops,
            totalBillableIops,
            ebsIopsCost,
            billableMbps,
            billableThroughputMbps,
            billableThroughputGbps,
            ebsThroughputCost,
            ebsTotalCostMonthly
        },
        fsxCloneCalculation: {
            cloneRefreshFrequency: params.cloneRefreshFrequency,
            monthlyChangeRatePercentage: params.monthlyChangeRatePercentage,
            clonedCopiesCount: params.clonedCopiesCount,
            changeRateBetweenClones:
                totalMonthlyClonedCopiesCount > 0
                    ? params.monthlyChangeRatePercentage / totalMonthlyClonedCopiesCount
                    : 0,
            totalFsxnCapacity: convertToBytes(totalSsdStorageGBPerMonthSize, totalSsdStorageGBPerMonthUnit) || 0,
            numberOfClonesInAMonth: totalMonthlyClonedCopiesCount,
            fsxnSsdPrice: { price: fsxnSsdClonePrice, unit: fsxnSsdClonePriceUnit },
            desiredStorageCapacity:
                convertToBytes(cloneDesiredStorageCapacityGB, cloneDesiredStorageCapacityGBUnit) || 0,
            percentageOfDataOnSsdStorage: percentageOfDataOnSSDStorageClone,
            savingsFromCompressionAndDeduplication: savingsFromCompressionAndDeduplicationClone,
            storageSavingsFromCompressionAndDeduplication:
                convertToBytes(
                    cloneStorageSavingsFromCompressionAndDeduplication,
                    cloneStorageSavingsFromCompressionAndDeduplicationUnit
                ) || 0,
            effectiveFsxnStorageCapacity:
                convertToBytes(
                    cloneEffectiveStorageCapacityForFSxForONTAP,
                    cloneEffectiveStorageCapacityForFSxForONTAPUnit
                ) || 0,
            ssdStoragePerMonth: convertToBytes(cloneSSDStorageGBPerMonth, cloneSSDStorageGBPerMonthUnit) || 0,
            ssdMonthlyCost: SSDMonthlyCost,
            totalCloneMonthlyCost
        },
        ebsCloneCalculation: {
            clonedCopiesCount: params.clonedCopiesCount,
            capacity,
            iops,
            throughput,
            totalCloneMonthlyCost: params.clonedCopiesCount * (capacity + iops + throughput)
        },
        ebsSnapshotCalculation: {
            ebsInstanceMonth,
            totalSnapshots,
            initialSnapshotCost,
            monthlyCostPerSnapshot,
            discountForPartialStorageMonth,
            incrementalSnapshotCost,
            totalSnapshotCost,
            totalEbsSnapshotCost,
            ebsSnapshotCost
        }
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
    const ebsVolumeIds = compact(
        sqlServerInstances?.flatMap(server =>
            server?.storage?.filter(storage => storage.type === 'EBS').map(storage => storage.id)
        )
    );

    const [{ sqlServerDeploymentType, nodeIps }] = ec2HostDetails?.sqlServerInstances || [];
    const currentNodeComputeLicenseDetails = await retrieveComputeAndLicenseHourlyCost(region, ec2HostDetails);
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
    return formatStorageSavingsCalculationMetrics(accountId, credentialsId, region, ebsVolumeIds, params, [
        currentNodeComputeLicenseDetails
    ]);
}

export { performStorageSavingsCalculations, getStorageSavingsCalculationMetrics, getMarketingApiRequestBody };
