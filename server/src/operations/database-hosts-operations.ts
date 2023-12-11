import { resource } from '@prisma/client';
import { DescribeInstancesCommandOutput } from '@aws-sdk/client-ec2';
import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import { GetTagsCommandOutput } from '@aws-sdk/client-cost-explorer';
import { ConnectionStatus } from '@aws-sdk/client-ssm';
import { listResources } from '../lib/database/db';
import {
    DatabaseHostSummaryResponseType,
    DatabaseHostSummaryListResponseType,
    PerformanceResponseType,
    TopologyResponseType,
    ProtectionResponseType,
    StorageResponseType,
    UsageCostResponseType
} from '../routes/types/database-hosts.types';
import { describeInstance, getAmis } from '../lib/aws/ec2';
import { describeFSxN } from '../lib/aws/fsx';
import { PricingServiceRequestType, PricingServiceResponseType } from '../routes/types/pricing.types';

import calculatePrice from './aws/pricing-operations';
import {
    DatabaseHostsQueryFields,
    HttpErrorCodes,
    RESOURCESTYPE,
    ServerState,
    SERVER_TYPE_MAPPING,
    STANDALONE,
    FCI,
    AWS_REGIONS,
    SQL_STD,
    SQL_ENT,
    PRICING,
    WLMDB_COST_ALLOCATION_TAG
} from '../utils/consts';
import getLogger from '../utils/logger';
import {
    getServerIOLatency,
    getServerState,
    getNativeSQLProtection,
    getDatabasesCount
} from './workloads/mssql/mssql-operations';
import { getStorageDataUsingSSM, isAWSBackupEnabled, getOntapVolumesSnapshotCount } from './aws/fsx-operations';
import { Metadata, ResourceDetails } from '../utils/common-types';
import { calculateBilling, getCostExplorerTimeRange } from './aws/cost-explorer-operations';
import { getTagsfromCostExplorer } from '../lib/aws/cost-explorer';
import { getSSMConnectionStatus } from './aws/ssm-operations';

const logger = getLogger();

interface Topology {
    activeNodeInstanceId: string;
    activeNodeInstanceName: string;
    standbyNodeInstanceId?: string;
    standbyNodeInstanceName?: string;
    sqlDeploymentType?: string;
    fileSystemType?: string;
}

type VolumeSpaceRecord = {
    uuid: string;
    name: string;
    efficiency: {
        space_savings: {
            total: number;
            total_percent: number;
        };
    };
    space: {
        size: number;
        used: number;
    };
};

type EstimationEc2Type = {
    resourceType: string;
    sqlSoftwareType: string;
};

type EstimationFSxType = {
    storageCapacity: number;
    throughput: number;
    iops: number;
    deploymentOption: string;
};

async function getTopology(
    accountId: string,
    region: string,
    resourceId: string,
    resourceData: resource,
    additionalFields?: { [key: string]: boolean }
): Promise<TopologyResponseType> {
    logger.info('Fetching topology data', accountId, region, resourceId, resourceData);

    if (isEmpty(resourceData)) {
        throw createError(
            HttpErrorCodes.NOT_FOUND,
            `No data found for resource ${resourceId} in account ${accountId}.`
        );
    }

    const { resource_type: resourceType, co_relation_id: fileSystemId, metadata } = resourceData;
    const { credentialsId } = metadata as { credentialsId: string };

    let topologyData: TopologyResponseType = {
        region,
        serverType: resourceType,
        serverInstallationMode: '',
        fileSystemId: fileSystemId!,
        fileSystemType: '',
        vpcId: undefined,
        ec2Details: []
    };

    let activeNodeInstanceId: string;
    let standbyNodeInstanceId;
    let activeNodeInstanceName: string;
    let standbyNodeInstanceName;
    let sqlDeploymentType;
    let fileSystemType;
    if (!isEmpty(metadata)) {
        ({
            activeNodeInstanceId,
            activeNodeInstanceName,
            standbyNodeInstanceId,
            standbyNodeInstanceName,
            sqlDeploymentType,
            fileSystemType
        } = metadata as unknown as Topology);

        let vpcId;
        if (additionalFields?.vpc) {
            try {
                const fsxInfo = await describeFSxN(credentialsId, region, { FileSystemIds: [fileSystemId!] });
                vpcId = fsxInfo?.FileSystems?.[0].VpcId;
            } catch (error) {
                logger.error(`Error while fetching vpc details for fsx. Error: ${error}`);
            }
        }

        // Fetch topology data
        topologyData = {
            region: AWS_REGIONS.has(region) ? AWS_REGIONS.get(region)! : region,
            serverType: SERVER_TYPE_MAPPING.get(resourceType)!,
            serverInstallationMode: sqlDeploymentType !== undefined ? sqlDeploymentType : '',
            fileSystemType: fileSystemType !== undefined ? fileSystemType : '',
            fileSystemId: fileSystemId!,
            ...(vpcId && { vpcId }),
            ec2Details: [{ id: activeNodeInstanceId!, name: activeNodeInstanceName!, ebsVolumeId: '' }]
        };
        if (standbyNodeInstanceId) {
            topologyData.ec2Details.push({
                id: standbyNodeInstanceId!,
                name: standbyNodeInstanceName!,
                ebsVolumeId: ''
            });
        }
    }
    return topologyData;
}

async function getStorageData(resourceDetail: ResourceDetails): Promise<StorageResponseType | undefined> {
    logger.info('Getting storage data:', { resourceDetail });

    try {
        const { region, co_relation_id: fileSystemId, metadata } = resourceDetail;

        const { credentialsId, activeNodeInstanceId, standbyNodeInstanceId, fsxSecret } = metadata as {
            credentialsId: string;
            activeNodeInstanceId: string;
            standbyNodeInstanceId: string;
            fsxSecret: string;
        };

        // DeploymentID is same as AWS CloudFormation stack name.  We retrieve
        // deploymentID from the fsxSecret, which has an additional '-fsx'
        // suffix to stack name (e.g., WLMDB-SqlFciStack-1698992271319-fsx).
        //     ONTAP tags have '_' instead of '-' in the stack name.  So we
        // tune tag accordingly with replaceAll.
        const deploymentId = fsxSecret?.replace('-fsx', '')?.replaceAll('-', '_');

        const info = await getStorageDataUsingSSM(
            credentialsId,
            region!,
            fileSystemId!,
            fsxSecret,
            'storage/volumes',
            `tiering.object_tags="wlmDeploymentId=${deploymentId}"`,
            'fields=efficiency.space_savings.total,efficiency.space_savings.total_percent,space.size,space.used',
            activeNodeInstanceId,
            standbyNodeInstanceId
        );

        logger.info(`Storage data for volumes with deploymentId ${deploymentId}:`, info);

        let totalSize = 0;
        let totalUsed = 0;
        let totalSpaceSavings = 0;
        info?.records?.forEach(({ efficiency, space }: VolumeSpaceRecord) => {
            const { size, used } = space;
            const { total } = efficiency.space_savings;

            totalSize += size;
            totalUsed += used;
            totalSpaceSavings += total;
        });

        return {
            size: totalSize,
            used: totalUsed,
            spaceSavings: totalSpaceSavings
        };
    } catch (error) {
        logger.error('Error while getting storage savings for resource', resourceDetail, JSON.stringify(error));
        let { message } = error as { message: string };
        if (message?.toLocaleLowerCase().includes('ThrottlingException: Rate exceeded'.toLowerCase())) {
            message += '. Retry the operation.';
            throw createError(HttpErrorCodes.SERVICE_UNAVAILABLE, message);
        }
    }
}

async function getProtectionStatus(resourceDetail: ResourceDetails): Promise<ProtectionResponseType | undefined> {
    logger.info('Get protection status', { resourceDetail });

    const { resource_id: resourceId, region, co_relation_id: fileSystemId, metadata } = resourceDetail;

    const { credentialsId } = metadata as Metadata;

    try {
        const [awsBackup, ontapProtection, nativeSqlProtection] = await Promise.all([
            isAWSBackupEnabled(credentialsId, region!, fileSystemId!, metadata as Metadata),
            getOntapVolumesSnapshotCount(credentialsId, region!, fileSystemId!, metadata as Metadata),
            getNativeSQLProtection(resourceId)
        ]);

        return {
            isAwsBackUpEnabled: Boolean(awsBackup),
            isFsxOntapSnapshotsEnabled: Boolean(ontapProtection),
            isSqlNativeEnabled: Boolean(nativeSqlProtection)
        };
    } catch (error) {
        logger.error('Error while getting protection status', resourceDetail, error);
    }
}

async function getBillingOrPriceEstimation(resourceDetail: ResourceDetails) {
    logger.info('Get AWS resources billing or cost data:', resourceDetail);

    const [billingResponse, pricingResponse] = await Promise.all([
        getBilling(resourceDetail).catch(error => {
            logger.error('Failed to get billing data for resource: :', JSON.stringify(error)); // Do not throw error here as we need to call getUsageEstimationData
        }),
        getUsageEstimationData(resourceDetail).catch(error => {
            logger.error('Failed to get pricing estimation data for resource:', JSON.stringify(error));
            throw error;
        })
    ]);

    return billingResponse || pricingResponse;
}

async function getBilling(resourceDetail: ResourceDetails) {
    logger.info('Get AWS resources billing data:', resourceDetail);
    try {
        const { region, co_relation_id: fileSystemId, metadata } = resourceDetail;
        const { credentialsId, activeNodeInstanceId, standbyNodeInstanceId } = metadata as {
            credentialsId: string;
            activeNodeInstanceId: string;
            standbyNodeInstanceId: string;
        };
        // We need to check here if wlmdb-cost-resource cost allocation tag is activated at account level or not
        let tagsResponse: GetTagsCommandOutput;
        try {
            const [startTimeFormat, currenTimeFormat] = getCostExplorerTimeRange();
            tagsResponse = await getTagsfromCostExplorer(region!, {
                TimePeriod: {
                    Start: startTimeFormat,
                    End: currenTimeFormat
                }
            });
            logger.debug('Cost allocation tag response', tagsResponse);
        } catch (error) {
            logger.error('Error while reteriving cost allocation tag');
            throw error;
        }

        if (tagsResponse.Tags?.includes(WLMDB_COST_ALLOCATION_TAG)) {
            const billingResponse: UsageCostResponseType = await calculateBilling(
                credentialsId,
                region!,
                fileSystemId!,
                activeNodeInstanceId,
                standbyNodeInstanceId
            );

            return {
                compute: billingResponse?.compute,
                storage: billingResponse?.storage,
                connectivity: billingResponse?.connectivity || 0,
                others: 0, // TODO: to be calculated for other resources such as ActiveDiretory, Secrets etc.
                estimationType: billingResponse?.estimationType
            };
        }
        throw new Error(
            `Calcaulation of  Billing data has failed as cost allocation tag ${WLMDB_COST_ALLOCATION_TAG} is not activated`
        );
    } catch (error) {
        logger.error('Failed to get billing data for resource:', resourceDetail, JSON.stringify(error));
        throw error;
    }
}

async function getUsageEstimationData(resourceDetail: ResourceDetails) {
    logger.info('Get AWS resources estimation data:', resourceDetail);

    try {
        const { region, co_relation_id: fileSystemId, metadata } = resourceDetail;
        const { credentialsId, sqlDeploymentType, activeNodeInstanceId } = metadata as {
            credentialsId: string;
            sqlDeploymentType: string;
            activeNodeInstanceId: string;
        };

        const [ec2ResourceInfo, fsxResourceInfo] = await Promise.all([
            getEc2ResourceInfo(credentialsId, region!, activeNodeInstanceId),
            getFsxResourceInfo(credentialsId, region!, fileSystemId!)
        ]);

        const pricingRequest: PricingServiceRequestType = {
            compute: {
                regionCode: region!,
                instanceType: ec2ResourceInfo.resourceType,
                sqlDeploymentMode: sqlDeploymentType.toLowerCase() === FCI ? FCI : STANDALONE,
                sqlSoftwareType: ec2ResourceInfo.sqlSoftwareType
            },
            storage: {
                regionCode: region!,
                storageCapacity: fsxResourceInfo.storageCapacity,
                throughput: fsxResourceInfo.throughput,
                iops: fsxResourceInfo.iops,
                deploymentOption: fsxResourceInfo.deploymentOption,
                diskSize: 0 // As we are calculating post deployment cost usage, we don't need disk size, we can use storageCapacity instead.
            },
            vpc: {
                regionCode: region!
            }
        };

        const pricingResponse: PricingServiceResponseType = await calculatePrice(
            credentialsId,
            pricingRequest.compute,
            pricingRequest.storage,
            pricingRequest.vpc
        );
        return {
            compute: pricingResponse?.compute || 0,
            storage: (pricingResponse?.storage?.capacity || 0) + (pricingResponse?.storage?.throughput || 0),
            connectivity: pricingResponse?.vpc || 0,
            others: 0, // TODO: to be calculated for other resources such as ActiveDiretory, Secrets etc.
            estimationType: PRICING
        };
    } catch (error) {
        logger.error('Failed to get resources estimation data for resource:', resourceDetail, JSON.stringify(error));
        throw error;
    }
}

async function getEc2ResourceInfo(
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string
): Promise<EstimationEc2Type> {
    logger.info('Getting EC2 resource info:', { credentialsId, region, activeNodeInstanceId });

    const ec2Info: DescribeInstancesCommandOutput = await describeInstance(credentialsId, region!, {
        InstanceIds: [activeNodeInstanceId]
    });
    logger.info('Estimation info for EC2:', ec2Info);
    const resourceType = ec2Info?.Reservations?.[0].Instances?.[0].InstanceType;
    const imageId = ec2Info?.Reservations?.[0].Instances?.[0].ImageId;

    const amiInfo = await getAmis(credentialsId, region, { ImageIds: [imageId!] });
    logger.info('Estimation info for AMI:', amiInfo);
    const sqlPlatform = amiInfo?.Images?.[0].PlatformDetails;

    let sqlSoftwareType: string = SQL_STD; // Let's 'Windows with SQL Server Standard' be default
    if (sqlPlatform === 'Windows with SQL Server Enterprise') {
        sqlSoftwareType = SQL_ENT;
    }

    return {
        resourceType: resourceType!,
        sqlSoftwareType
    };
}

async function getFsxResourceInfo(
    credentialsId: string,
    region: string,
    filesystemId: string
): Promise<EstimationFSxType> {
    logger.info('Getting FSxN resource info:', { credentialsId, region, filesystemId });

    const fsxInfo = await describeFSxN(credentialsId, region, { FileSystemIds: [filesystemId] });
    logger.info('Estimation info for FSxN:', fsxInfo);

    const storageCapacity = fsxInfo?.FileSystems?.[0].StorageCapacity || 0;
    const throughput = fsxInfo?.FileSystems?.[0].OntapConfiguration?.ThroughputCapacity;
    const iops = fsxInfo?.FileSystems?.[0].OntapConfiguration?.DiskIopsConfiguration?.Iops;
    const deploymentOption = fsxInfo?.FileSystems?.[0].OntapConfiguration?.DeploymentType;

    return { storageCapacity, throughput: throughput!, iops: iops!, deploymentOption: deploymentOption! };
}

async function getDatabaseHostsSummary(
    accountId: string,
    fields?: string
): Promise<DatabaseHostSummaryListResponseType> {
    logger.info('Fetching all database hosts deployed in account ', accountId, fields);

    const resourceDetails = await listResources(accountId);

    if (isEmpty(resourceDetails)) {
        logger.error(`No successfully deployed database hosts found for account ${accountId}.`);
        return { count: 0, items: [], nextToken: '' };
    }

    let fieldsValues: Array<string> = [];

    if (fields) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    }

    const getPerformance = fieldsValues?.includes(DatabaseHostsQueryFields.PERFORMANCE);
    const getStorageSavings = fieldsValues?.includes(DatabaseHostsQueryFields.STORAGE);
    const getProtection = fieldsValues?.includes(DatabaseHostsQueryFields.PROTECTION);
    const getUsageEstimation = fieldsValues?.includes(DatabaseHostsQueryFields.USAGE_ESTIMATION.toLocaleLowerCase());
    const additionalFields = {
        vpc: Boolean(getUsageEstimation)
    };

    const databaseHosts: DatabaseHostSummaryResponseType[] = [];
    try {
        await Promise.all(
            resourceDetails
                .filter(resourceDetail => resourceDetail.resource_type !== RESOURCESTYPE.FSX)
                .map(async resourceDetail => {
                    const { resource_id: resourceId, resource_name: resourceName, region, metadata } = resourceDetail;

                    let { credentialsId, activeNodeInstanceId, standbyNodeInstanceId } =
                        metadata as unknown as Metadata;

                    // Check SSM Connection status
                    let skipDueToSSMConnectionError = false;
                    let connectionStatus = await getSSMConnectionStatus(credentialsId, region!, activeNodeInstanceId);
                    if (connectionStatus.Status === ConnectionStatus.NOT_CONNECTED) {
                        let errorMessage = `SSM connection to node ${activeNodeInstanceId} has failed.`;
                        if (standbyNodeInstanceId) {
                            connectionStatus = await getSSMConnectionStatus(
                                credentialsId,
                                region!,
                                standbyNodeInstanceId
                            );
                            if (connectionStatus.Status === ConnectionStatus.NOT_CONNECTED) {
                                errorMessage = `SSM connection to nodes ${activeNodeInstanceId} and ${standbyNodeInstanceId} has failed.`;
                                logger.error(errorMessage);
                                skipDueToSSMConnectionError = true;
                            } else {
                                // Swap active with standby if connection to active is not successful and standby is successful
                                [activeNodeInstanceId, standbyNodeInstanceId] = [
                                    standbyNodeInstanceId,
                                    activeNodeInstanceId
                                ];
                            }
                        }
                        logger.error(errorMessage);
                        skipDueToSSMConnectionError = true;
                    }

                    let serverStatus: string = ServerState.DOWN;
                    let dbCount;
                    let topologyData: TopologyResponseType;
                    let performanceData: PerformanceResponseType | undefined;
                    let storageData: StorageResponseType | undefined;
                    let protectionData: ProtectionResponseType | undefined;
                    let usageEstimationData: UsageCostResponseType | undefined;
                    const activeNodeId = activeNodeInstanceId;
                    const standbyNodeId = standbyNodeInstanceId;

                    [
                        serverStatus,
                        dbCount,
                        topologyData,
                        performanceData,
                        storageData,
                        protectionData,
                        usageEstimationData
                    ] = await Promise.all(
                        [
                            ...(!skipDueToSSMConnectionError ? [getServerState(resourceId)] : [Promise.resolve()]), // Fetch server status
                            ...(!skipDueToSSMConnectionError
                                ? [getDatabasesCount(credentialsId, region!, activeNodeId, standbyNodeId)]
                                : [Promise.resolve()]),
                            getTopology(accountId, region!, resourceId, resourceDetail, additionalFields), // Fetch topology data
                            ...(!skipDueToSSMConnectionError && getPerformance
                                ? [getServerIOLatency(resourceId)]
                                : [Promise.resolve()]), // Fetch io latency data
                            ...(!skipDueToSSMConnectionError && getStorageSavings
                                ? [getStorageData(resourceDetail)]
                                : [Promise.resolve()]), // Fetch storage savings data
                            ...(!skipDueToSSMConnectionError && getProtection
                                ? [getProtectionStatus(resourceDetail)]
                                : [Promise.resolve()]), // Fetch protection status
                            ...(getUsageEstimation
                                ? [getBillingOrPriceEstimation(resourceDetail)]
                                : [Promise.resolve()]) // Fetch billing or pricing estimate data
                        ].map(p => p.catch(error => logger.error(`Error while fetching data: ${error}.`)))
                    );

                    databaseHosts.push({
                        id: resourceId,
                        name: resourceName || '',
                        status: serverStatus?.toLowerCase() === 'running' ? ServerState.UP : ServerState.DOWN,
                        databaseCount: dbCount?.totalCount || 0,
                        topology: topologyData!,
                        ...(performanceData && { performance: performanceData }),
                        ...(storageData && { storage: storageData }),
                        ...(protectionData && { protection: protectionData }),
                        ...(usageEstimationData && { estimatedUsageCost: usageEstimationData })
                    });
                })
        );
    } catch (error) {
        logger.error(`Error while fetching database hosts details ${accountId}, ${error}`);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Error while fetching database hosts details ${accountId}, ${error}`
        );
    }

    logger.debug('Database hosts details', databaseHosts);

    return { count: databaseHosts.length, items: databaseHosts, nextToken: '' };
}

export default getDatabaseHostsSummary;
