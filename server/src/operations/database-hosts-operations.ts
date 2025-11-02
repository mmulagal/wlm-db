import { STORAGE_TYPE } from '@prisma/client';
import { DescribeInstancesCommandOutput, DeviceType, Volume } from '@aws-sdk/client-ec2';
import createError from 'http-errors';
import { compact, isEmpty, omit } from 'lodash-es';
import throat from 'throat';
import { ConnectionStatus } from '@aws-sdk/client-ssm';
import { listResources } from '../lib/database/db';
import {
    ProtectionPerStorageTypeResponseType,
    UsageCostResponseType,
    DatabasesListResponseType,
    DatabaseHostSummaryForMultiInstanceResponseType,
    DatabaseHostInstanceSummaryResponseType
} from '../routes/types/database-hosts.types';
import { describeInstance, describeVolumes, getAmis } from '../lib/aws/ec2';
import { describeFSx, describeFSxStorageVirtualMachines } from '../lib/aws/fsx';
import { PricingServiceRequestType, PricingServiceResponseType } from '../routes/types/pricing.types';

import { calculatePrice } from './aws/pricing-operations';
import {
    DatabaseHostsQueryFields,
    HttpErrorCodes,
    ServerState,
    STANDALONE,
    FCI,
    SQL_STD,
    SQL_ENT,
    MSSQL_DATABASE_TYPES,
    PRICING,
    WLMDB_COST_ALLOCATION_TAG,
    SqlServerDeploymentModel,
    CUSTOM,
    SQL_WEB,
    VERSION_2_0,
    V2_API_PAGE_SIZE,
    NOT_AVAILABLE,
    ONLINE,
    OFFLINE,
    SQL_SERVICE_STATE,
    UNKNOWN,
    WIN_SQL_EC2_USAGE_OPERATION,
    EBS_ROOT_VOLUME,
    DatabaseTypes,
    MSSQL_DATABASE_INSTANCE_INDEX_MAPPING,
    DEFAULT_INSTANCE_NAME,
    MSSQL_SYSTEM_DATABASES,
    PGSQL_DEFAULT_INSTANCE_NAME,
    CUSTOM_SSM_EXECUTION_TIMEOUT,
    RESOURCESTYPE
} from '../utils/consts';
import getLogger from '../utils/logger';
import {
    getNativeSQLProtection,
    getPerformanceMetrics,
    getDataBasesSummary,
    getNativeSQLBackedupDatabases,
    getActiveSqlNode,
    getServerDetails,
    getAllResourceUtilisationDetails,
    getDatabasesCount,
    getActiveNodeAndInstanceDetails,
    getMssqlStorageDataFromOntap
} from './workloads/mssql/mssql-operations';
import {
    isFsxnAwsBackupEnabled,
    getOntapVolumesSnapshotCount,
    getCostAllocationTagFsxResource,
    isFsxwAwsBackupEnabled,
    getMappedOntapVolumes,
    isInstanceAppConsistentBackupEnabled
} from './aws/fsx-operations';
import {
    DatabaseInstance,
    InstanceDetails,
    MappedOnTapVolumeResponse,
    Metadata,
    ResourceDetails,
    UserDatabase,
    VolumeRecord
} from '../utils/common-types';
import { getBillByResourceIds, getCostAllocationTags } from './aws/cost-explorer-operations';
import {
    getCostAllocationTagEC2Resource,
    getInstanceDetailsByPrivateIp,
    isEbsAwsBackupEnabled
} from './aws/ec2-operations';
import { getSqlInstanceUtilizationAndPerformance } from './aws/cloud-watch-operations';
import { assessMssqlServerPerformance, determineStorageType, formatDuration, IS_DEMO_FLOW } from '../utils/utils';
import { callSsmExecution, getSSMConnectionStatus } from './aws/ssm-operations';
import { CLUSTER_NETWORK_IP_INFO_PS1 } from './workloads/mssql/discover-consts';
import { getPgSqlDatabaseInstancesDetails, getPgSqlDatabaseInstancesSummary } from './workloads/pgsql/pgsql-operations';
import { getDatabaseInstanceTopology } from '../utils/sql-utils';
import { AssessmentCategories } from '../utils/continous-optimization-consts';
import { paginateListInstanceConfigData } from './database/instance-config-operations';
import {
    getOracleDatabaseInstancesDetails,
    getOracleDatabaseInstancesSummary
} from './workloads/oracle/oracle-operations';
import { trendGraphCreateScriptForMssql } from './workloads/mssql/ssm-script-utils';
import { trendGraphCreateScriptForOracle } from './workloads/oracle/oracle-ssm-script-utils';
import { getPaginatedDatabaseInstances, getResources, populateDbInstances } from './database/database-operations';
import { SSM_RUN_SHELL_SCRIPT_DOC } from './workloads/pgsql/const';
import {
    BackupType,
    checkAllTrue,
    checkKey,
    DATABASE_HOSTS_INDEX_MAPPING_V2,
    DatabaseDetails,
    EstimationEbsType,
    EstimationEc2Type,
    EstimationFSxType,
    getEbsResourceInfo,
    getNodeTopology,
    getStorageData
} from './database-hosts-util';

const logger = getLogger();

async function getUniqueCrrDetails(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId?: string
) {
    logger.info('Getting unique CRR details:', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId
    });

    const { items: crrConfigData } = await paginateListInstanceConfigData({
        accountId,
        region,
        credentialsId,
        resourceId: databaseHostId,
        databaseInstanceId,
        configDataType: AssessmentCategories.CRR
    });

    const uniqueCrrConfigData = Object.values(
        crrConfigData.reduce((acc: Record<string, any>, entry: any) => {
            const { database_instance_id: instanceId, last_updated: lastUpdated } = entry;
            if (!acc[instanceId] || new Date(acc[instanceId].updated_at) < new Date(lastUpdated)) {
                acc[instanceId] = entry;
            }
            return acc;
        }, {})
    );

    return uniqueCrrConfigData;
}

async function getProtectionStatus(
    activeNodeInstanceId: string,
    instanceName: string | undefined,
    resourceDetail?: ResourceDetails,
    databaseInstances?: DatabaseInstance[],
    version?: string,
    isSqlAuth: boolean = false
): Promise<ProtectionPerStorageTypeResponseType | ProtectionPerStorageTypeResponseType[] | undefined> {
    logger.info('Get protection status', { resourceId: resourceDetail?.resource_id, instanceName });

    if (!databaseInstances || isEmpty(databaseInstances) || version !== VERSION_2_0) {
        logger.info(
            'No database instance details found or version not 2.0, returning empty storage data. version:',
            version
        );
        return;
    }

    const [
        { database_instance_id: id, fsxn_ids: fsxnId, region, credentials_id: credentialsId, fsxwId, ebsVolumeIds }
    ] = databaseInstances;

    if (!region || !credentialsId) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Region or credentials id is not found for resource ${id}. region: ${region}, credentils Id:  ${credentialsId}`
        );
    }

    const instanceNames = databaseInstances?.map(instance => instance.database_instance_name) || [];
    try {
        const [nativeSqlProtection, protectionResponse, fsxwBackup, ebsBackup] = await Promise.all([
            getNativeSQLProtection(credentialsId, region, activeNodeInstanceId, instanceNames, isSqlAuth),
            fsxnId
                ? getProtectionDetails(
                      credentialsId,
                      region,
                      fsxnId,
                      true,
                      activeNodeInstanceId,
                      databaseInstances,
                      isSqlAuth
                  )
                : Promise.resolve(),
            fsxwId ? isFsxwAwsBackupEnabled(credentialsId, region, fsxwId) : Promise.resolve(),
            ebsVolumeIds ? isEbsAwsBackupEnabled(credentialsId, region, ebsVolumeIds) : Promise.resolve() // returns true if backup is enabled on any of the ebs ID associated with the resource; revisit this to return information for each ebs
        ]);

        const { awsBackup = {}, ontapBackup = {}, crrBackup = {} } = protectionResponse || {};

        const commonResult = instanceNames.reduce((acc, instName) => {
            acc[instName] = {
                isAwsBackupEnabled: {
                    fsxn: IS_DEMO_FLOW
                        ? true
                        : awsBackup[instName]?.volumeDBMapWithBackupFlag &&
                          typeof awsBackup[instName]?.volumeDBMapWithBackupFlag === 'object'
                        ? checkAllTrue(awsBackup[instName]?.volumeDBMapWithBackupFlag)
                        : false,
                    fsxw: Boolean(fsxwBackup),
                    ebs: Boolean(ebsBackup)
                },
                isFsxOntapSnapshotsEnabled: IS_DEMO_FLOW ? true : checkAllTrue(ontapBackup[instName]),
                isCRREnabled: IS_DEMO_FLOW ? true : checkAllTrue(crrBackup[instName]),
                isAppConsistentBackupEnabled:
                    IS_DEMO_FLOW || checkAllTrue(protectionResponse?.isAppConsistentBackupEnabled[instName] ?? {})
            };
            return acc;
        }, {} as Record<string, any>);

        return instanceNames.map(iName => {
            const nativeBackupCount = nativeSqlProtection?.[iName]?.backupCount;
            return {
                isSqlNativeEnabled: Boolean(nativeBackupCount),
                protectedDatabases: Number.isNaN(Number(nativeBackupCount)) ? 0 : Number(nativeBackupCount),
                isAwsBackupEnabled: commonResult[iName]?.isAwsBackupEnabled ?? { fsxn: 'N/A', fsxw: false, ebs: false },
                isFsxOntapSnapshotsEnabled: commonResult[iName]?.isFsxOntapSnapshotsEnabled ?? 'N/A',
                isAppConsistentBackupEnabled: commonResult[iName]?.isAppConsistentBackupEnabled ?? 'N/A',
                isCRREnabled: commonResult[iName]?.isCRREnabled ?? 'N/A'
            };
        });
    } catch (error) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Error while getting protection status: ${resourceDetail} ${error}`
        );
    }
}

async function getBillingOrPriceEstimation(
    resourceDetail: ResourceDetails,
    activeNodeInstanceId?: string,
    isManagedResource?: boolean
) {
    logger.info('Get AWS resources billing or cost data:', {
        resourceId: resourceDetail?.resource_id,
        activeNodeInstanceId,
        isManagedResource
    });
    const promises = [];
    if (isManagedResource) {
        promises.push(
            getBilling(resourceDetail).catch(error => {
                logger.error('Failed to get billing data for resource: :', JSON.stringify(error));
            })
        );
    }
    if (activeNodeInstanceId) {
        promises.push(
            getUsageEstimationData(resourceDetail, activeNodeInstanceId).catch(error => {
                logger.error('Failed to get pricing estimation data for resource:', JSON.stringify(error));
            })
        );
    } else {
        promises.push(Promise.resolve());
    }

    const [billingResponse, pricingResponse] = await Promise.allSettled(promises);

    return billingResponse.status === 'fulfilled'
        ? billingResponse.value
        : pricingResponse.status === 'fulfilled'
        ? pricingResponse.value
        : undefined;
}

async function getBilling(resourceDetail: ResourceDetails) {
    logger.info('Get AWS resources billing data:', { resourceId: resourceDetail?.resource_id });
    try {
        await populateDbInstances(resourceDetail);
        const { region, credentials_id: credentialsId, metadata, database_instances: dbInstances } = resourceDetail;
        let fsxIds = dbInstances?.map(dbInstance => dbInstance.fsxn_ids);
        fsxIds = [...new Set(fsxIds?.flat())];
        const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;
        // Need to validate before proceeding for billing
        await validationForCostExplorer(resourceDetail);
        const resourceGroupsById = new Map<string, string[]>();
        resourceGroupsById.set(resourceDetail.resource_id, [
            node1InstanceId,
            ...(node2InstanceId ? [node2InstanceId] : []),
            ...(fsxIds || [])
        ]);

        const billsByResourceIds = await getBillByResourceIds(credentialsId, region!, resourceGroupsById);
        const billingResponse: UsageCostResponseType = billsByResourceIds.get(resourceDetail.resource_id);

        return {
            compute: billingResponse?.compute,
            storage: billingResponse?.storage,
            connectivity: billingResponse?.connectivity || 0,
            others: 0, // TODO: to be calculated for other resources such as ActiveDiretory, Secrets etc.
            estimationType: billingResponse?.estimationType
        };
    } catch (error) {
        logger.error('Failed to get billing data for resource:', resourceDetail.resource_id, error);
        throw error;
    }
}

async function validationForCostExplorer(resourceDetail: ResourceDetails) {
    logger.info('Validating prerequiste for Cost explorer for billing of resources');

    // 1.  We need to check if wlmdb-cost-resource cost allocation tag is activated at account level or not
    const { credentials_id: credentialsId, region } = resourceDetail;
    const tagsResponse = await getCostAllocationTags(credentialsId, region!);
    if (!tagsResponse?.Tags?.includes(WLMDB_COST_ALLOCATION_TAG)) {
        throw new Error(
            `Calcaulation of  Billing data has failed as cost allocation tag ${WLMDB_COST_ALLOCATION_TAG} is not activated at account level`
        );
    }

    // 2. Validate cost allocation tag is at resource level or not
    const [ec2Resources, fsxResources] = await Promise.all([
        getCostAllocationTagEC2Resource(resourceDetail),
        getCostAllocationTagFsxResource(resourceDetail)
    ]);
    // fsxResources has all tag attached to the that filesystem, so we need to find if cost allocation tag is attached or not
    if (!ec2Resources?.Tags?.length && !fsxResources?.find(tag => tag?.Key === WLMDB_COST_ALLOCATION_TAG)) {
        throw new Error(
            `Calcaulation of Billing data has failed as cost allocation tag ${WLMDB_COST_ALLOCATION_TAG} is not attached to resource ${resourceDetail.resource_id}`
        );
    }
}

async function getUsageEstimationData(resourceDetail: ResourceDetails, activeNodeInstanceId: string) {
    logger.info('Get AWS resources estimation data:', {
        resourceId: resourceDetail?.resource_id,
        activeNodeInstanceId
    });

    try {
        const { region, credentials_id: credentialsId, metadata, ebsVolumeIds, fsxwId } = resourceDetail;
        const { sqlDeploymentType } = metadata as unknown as Metadata;

        if (!region) {
            throw new Error('Unable to fetch usage estimation data as region is not available');
        }

        const fsxnIds = resourceDetail.database_instances?.flatMap(f => (f.fsxn_ids ? [f.fsxn_ids] : []));
        const fsxwIds = fsxwId
            ? [fsxwId]
            : resourceDetail.database_instances?.flatMap(f => (f.fsxwId ? [f.fsxwId] : []));

        const [ec2Info, fsxnInfo, ebsInfo, fsxwInfo] = await Promise.all([
            getEc2ResourceInfo(credentialsId, region, activeNodeInstanceId),
            ...(fsxnIds && !isEmpty(fsxnIds)
                ? [getFsxResourceInfo(credentialsId, region, [...new Set(fsxnIds!)])]
                : [Promise.resolve()]),
            ...(ebsVolumeIds && !isEmpty(ebsVolumeIds)
                ? [getEbsResourceInfo(credentialsId, region, ebsVolumeIds, resourceDetail?.database_instances)]
                : [Promise.resolve()]),
            ...(fsxwIds && !isEmpty(fsxwIds)
                ? [getFsxResourceInfo(credentialsId, region, [...new Set(fsxwIds!)])]
                : [Promise.resolve()])
        ]);

        const ec2ResourceInfo = ec2Info as EstimationEc2Type;
        const fsxnResourceInfo = fsxnInfo as EstimationFSxType;
        let ebsResourceInfo = ebsInfo as EstimationEbsType;
        const fsxwResourceInfo = fsxwInfo as EstimationFSxType;

        if (ec2ResourceInfo.rootVolumeId) {
            const rootVolume = {
                id: ec2ResourceInfo.rootVolumeId as string,
                size: ec2ResourceInfo.size as number,
                volumeType: ec2ResourceInfo.volumeType as string
            };

            ebsResourceInfo = isEmpty(ebsResourceInfo) ? [rootVolume] : [...ebsResourceInfo, rootVolume];
        }

        const pricingRequest: PricingServiceRequestType = {
            compute: {
                regionCode: region!,
                instanceType: ec2ResourceInfo.resourceType,
                sqlDeploymentMode: sqlDeploymentType?.toLowerCase() === FCI ? FCI : STANDALONE,
                sqlSoftwareType: ec2ResourceInfo.sqlSoftwareType
            },
            ...(fsxnResourceInfo && {
                fsxnStorage: {
                    regionCode: region!,
                    fsxnResourceInfo: fsxnResourceInfo || []
                }
            }),
            ...(ebsResourceInfo && {
                ebsStorage: {
                    regionCode: region!,
                    ebsResourceInfo: ebsResourceInfo || []
                }
            }),
            vpc: {
                regionCode: region!
            },
            ...(fsxwResourceInfo && {
                fsxwStorage: {
                    regionCode: region!,
                    fsxwResourceInfo: fsxwResourceInfo || []
                }
            })
        };

        const pricingResponse: PricingServiceResponseType = await calculatePrice(
            pricingRequest.compute,
            pricingRequest.fsxnStorage,
            pricingRequest.vpc,
            pricingRequest.ebsStorage,
            pricingRequest.fsxwStorage
        );

        const ebsBreakdownByVolumeType = pricingResponse.ebsStorage?.ebsBreakdownByVolumeType.filter(
            e => !e.id?.includes(EBS_ROOT_VOLUME)
        );

        return {
            compute: pricingResponse?.compute || 0,
            storage: {
                fsxn: pricingResponse?.fsxnStorage?.fsxStorageCost,
                fsxw: pricingResponse?.fsxwStorage?.fsxwStorageCost,
                ebs: pricingResponse.ebsStorage?.ebsStorageCost,
                ebsBreakdownByVolumeType: isEmpty(ebsBreakdownByVolumeType) ? undefined : ebsBreakdownByVolumeType,
                fsxnBreakDownById: pricingResponse?.fsxnStorage?.fsxnCostBreakdownById.map(id => ({
                    ...id,
                    size: id.size!.total
                })),
                fsxwBreakDownById: pricingResponse?.fsxwStorage?.fsxwCostBreakdownById
            },
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

    const ec2Info: DescribeInstancesCommandOutput = await describeInstance(
        credentialsId,
        region!,
        {
            InstanceIds: [activeNodeInstanceId]
        },
        { useCache: true }
    );
    const { Reservations: [{ Instances: [instance] = [] } = {}] = [] } = ec2Info;
    let getRootVolumePromise = Promise.resolve({});
    if (instance.RootDeviceType === DeviceType.ebs) {
        const rootEbsVolume = instance.BlockDeviceMappings?.find(
            ({ DeviceName }) => DeviceName === instance.RootDeviceName
        );
        if (rootEbsVolume) {
            const rootVolumeId = rootEbsVolume.Ebs?.VolumeId;
            if (rootVolumeId) {
                getRootVolumePromise = describeVolumes(
                    credentialsId,
                    region,
                    { VolumeIds: [rootVolumeId] },
                    {
                        useCache: true
                    }
                );
            }
        }
    }
    const [amiInfo, volumes] = await Promise.all([
        getAmis(credentialsId, region, { ImageIds: [instance.ImageId!] }, { useCache: true }),
        getRootVolumePromise
    ]);
    logger.debug('Estimation info for AMI:', amiInfo);

    const { Images: [{ PlatformDetails: sqlPlatform = '' } = {}] = [] } = amiInfo;

    let sqlSoftwareType: string;

    switch (sqlPlatform) {
        case 'Windows with SQL Server Standard':
            sqlSoftwareType = SQL_STD;
            break;
        case 'Windows with SQL Server Enterprise':
            sqlSoftwareType = SQL_ENT;
            break;
        case 'Windows with SQL Server Web':
            sqlSoftwareType = SQL_WEB;
            break;
        default:
            sqlSoftwareType = CUSTOM;
    }

    const [rootVolume] = (volumes as { Volumes: Volume[] }).Volumes || [];
    return {
        resourceType: instance.InstanceType!,
        sqlSoftwareType,
        ...(rootVolume && {
            rootVolumeId: `${EBS_ROOT_VOLUME}1`,
            size: rootVolume.Size!,
            volumeType: rootVolume.VolumeType!
        })
    };
}

async function getFsxResourceInfo(
    credentialsId: string,
    region: string,
    filesystemIds: string[]
): Promise<EstimationFSxType> {
    logger.info('Getting FSx resource info:', { credentialsId, region, filesystemIds });

    const fsxInfo = await describeFSx(credentialsId, region, { FileSystemIds: filesystemIds }, undefined, {
        useCache: true
    });

    const filesystems = fsxInfo?.FileSystems || [];
    const response = filesystems.map(
        ({ FileSystemId, StorageCapacity, OntapConfiguration, StorageType, WindowsConfiguration }) => {
            const storageCapacity = StorageCapacity || 0;
            const throughput = OntapConfiguration?.ThroughputCapacity || WindowsConfiguration?.ThroughputCapacity;
            const iops =
                OntapConfiguration?.DiskIopsConfiguration?.Iops ||
                WindowsConfiguration?.DiskIopsConfiguration?.Iops ||
                0;
            const deploymentOption = OntapConfiguration?.DeploymentType || WindowsConfiguration?.DeploymentType;

            return {
                id: FileSystemId!,
                storageCapacity,
                throughput: throughput!,
                iops: iops!,
                deploymentOption: deploymentOption!,
                storageType: StorageType!
            };
        }
    );

    return response;
}

async function getDatabaseHostsSummaryV2(
    accountId: string,
    awsRegion: string,
    customerCredentialsId: string,
    fields?: string,
    nextToken?: string,
    vpcId?: string,
    fsxId?: string,
    pageSize?: number,
    databaseType: string = DatabaseTypes.MS_SQL_SERVER
) {
    logger.info(
        'Fetching all database hosts deployed in account ',
        accountId,
        fields,
        nextToken,
        awsRegion,
        customerCredentialsId,
        vpcId,
        fsxId,
        pageSize
    );

    const apiPageSize = pageSize || V2_API_PAGE_SIZE;

    const resourceDetails = await listResources({
        accountId,
        credentialIds: customerCredentialsId,
        region: awsRegion,
        resourceType: databaseType,
        fsxId,
        pageSize: apiPageSize,
        nextToken,
        includeDatabaseInstances: true
    });

    if (isEmpty(resourceDetails)) {
        logger.info(`No successfully deployed database hosts found for account ${accountId}.`);
        return { count: 0, items: [], nextToken: '' };
    }

    const resourcesMap: Map<string, ResourceDetails> = new Map(resourceDetails.map(r => [r.resource_id, r]));
    const managedInstancesMap: Map<string, DatabaseInstance[]> = new Map(
        resourceDetails.map(r => [r.resource_id, (r as any)?.database_instances?.flat()])
    );

    managedInstancesMap.forEach((value: DatabaseInstance[], key) => {
        if (value && value.length > 0) {
            value.forEach((instance: DatabaseInstance) => {
                instance.resource = resourcesMap.get(key) ?? ({} as ResourceDetails);
            });
        }
    });

    const databaseHosts: DatabaseHostSummaryForMultiInstanceResponseType[] = [];
    try {
        await Promise.all(
            resourceDetails.map(async resourceDetail => {
                const { resource_id: resourceId } = resourceDetail;

                const databaseHostDetails: any = await getDatabaseHostSummaryV2(
                    accountId,
                    resourceId,
                    customerCredentialsId,
                    awsRegion,
                    fields,
                    resourceDetail,
                    managedInstancesMap.get(resourceId)
                );
                databaseHosts.push(databaseHostDetails);
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

    return {
        count: databaseHosts.length,
        items: databaseHosts,
        nextToken: resourceDetails?.length === apiPageSize ? resourceDetails[resourceDetails.length - 1].id : undefined
    };
}

function getDatabaseInstancesDetails(
    credentialsId: string,
    region: string,
    instancesManaged: DatabaseInstance[],
    resourceId: string,
    instanceDetails?: InstanceDetails[] | undefined
) {
    logger.info('Getting database Instances details for resource', {
        credentialsId,
        region,
        instancesManagedLength: instancesManaged.length,
        resourceId
    });
    const managedInstancesName = instancesManaged.map((item: DatabaseInstance) => ({
        instanceName: item.database_instance_name,
        isDefault: item.is_default,
        instanceState: ServerState.DOWN,
        isManaged: true,
        databaseInstanceId: item.database_instance_id
    }));

    const existingInstanceNames = new Set(instanceDetails?.map(({ instanceName }) => instanceName));
    const updatedInstanceDetails = [
        ...(instanceDetails ?? []).map(({ instanceName, instanceState, isDefault, sqlAuthEnabled }) => {
            const managedInstance = managedInstancesName.find(
                ({ instanceName: managedInstanceName }) => managedInstanceName === instanceName
            );
            const isManaged = Boolean(managedInstance);
            const updatedInstanceState =
                instanceState === SQL_SERVICE_STATE.RUNNING ? ServerState.UP : ServerState.DOWN;
            const databaseInstanceId = managedInstance?.databaseInstanceId;

            return {
                instanceName,
                instanceState: updatedInstanceState,
                isDefault,
                databaseInstanceId,
                sqlAuthEnabled,
                ...(managedInstancesName.length > 0 && { isManaged })
            };
        }),
        ...managedInstancesName.filter(({ instanceName }) => !existingInstanceNames.has(instanceName))
    ];
    logger.debug('Database instances details', updatedInstanceDetails);
    return updatedInstanceDetails;
}

async function getDatabaseHostSummaryV2(
    accountId: string,
    databaseHostId: string,
    customerCredentialsId: string,
    awsRegion: string,
    fields?: string,
    resourceDetail?: ResourceDetails,
    instancesManaged: DatabaseInstance[] = [],
    isManagedResource: boolean = true
) {
    logger.info('Fetching details about a database host ', accountId, databaseHostId, fields, isManagedResource);
    if (isEmpty(resourceDetail)) {
        [resourceDetail] = await listResources({
            accountId,
            resourceId: databaseHostId,
            credentialIds: customerCredentialsId,
            region: awsRegion,
            includeDatabaseInstances: true
        });

        if (isEmpty(resourceDetail)) {
            const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.NOT_FOUND, `${errorMessage}`);
        }
    }

    const {
        resource_id: resourceId,
        resource_name: resourceName,
        region,
        credentials_id: credentialsId,
        metadata,
        ec2UsageOperation,
        resource_type: resourceType
    } = resourceDetail;

    let fieldsValues: Array<string> = [];

    if (fields) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    }

    const shouldQueryNodeTopology = fieldsValues?.includes(DatabaseHostsQueryFields.NODE_TOPOLOGY.toLowerCase());
    const getUsageEstimation = fieldsValues?.includes(DatabaseHostsQueryFields.USAGE_ESTIMATION.toLowerCase());
    const getProtection = fieldsValues?.includes(DatabaseHostsQueryFields.PROTECTION);

    if (instancesManaged && isEmpty(instancesManaged)) {
        if (resourceDetail.database_instances && !isEmpty(resourceDetail.database_instances)) {
            instancesManaged = resourceDetail.database_instances.map(instance => ({
                ...instance,
                resource: resourceDetail
            }));
        } else {
            const dbInstancesResult = await getPaginatedDatabaseInstances(accountId, {
                resourceId,
                credentialsId,
                region
            });
            instancesManaged = Array.isArray(dbInstancesResult)
                ? dbInstancesResult.filter((item: DatabaseInstance) => item && item.database_instance_id)
                : (dbInstancesResult.items ?? []).filter((item: DatabaseInstance) => item && item.database_instance_id);
        }
    }

    if (IS_DEMO_FLOW) {
        instancesManaged.map(instance => {
            const hostResourceName = resourceDetail?.resource_name || '';

            if (!instance.is_default) {
                instance.database_instance_name = instance.database_instance_name.replace(hostResourceName, '');
            }
            return instance;
        });
    }

    const uniqueCrrConfigData = getProtection
        ? await getUniqueCrrDetails(accountId, credentialsId, region!, resourceId)
        : [];

    // Update the database instances detail to include storage type as FSXN
    instancesManaged = instancesManaged.map(instance => {
        const crrConfig = uniqueCrrConfigData.find(
            (config: any) => config.database_instance_id === instance.database_instance_id
        );

        return {
            ...instance,
            storage_type: determineStorageType(instance),
            crrConfigData: crrConfig?.config_data ? crrConfig.config_data : undefined
        };
    });
    const errormessages: { [index: string]: string } = {};
    const { node1InstanceId, node2InstanceId, sqlDeploymentType } = metadata as unknown as Metadata;
    if (!credentialsId || !region) {
        const error = `Credentials ID or region is not available for resource ${resourceId} in account ${accountId}.`;
        logger.error(error);
        throw createError(HttpErrorCodes.FAILED_DEPENDENCY, error);
    }

    const activeSqlNodeResult = await getActiveSqlNode(credentialsId, region, {
        node1InstanceId,
        node2InstanceId,
        resourceId,
        accountId,
        resourceType: resourceType as DatabaseTypes,
        sqlDeploymentType: sqlDeploymentType as SqlServerDeploymentModel
    });
    let { ssmConnectionStatus, activeNodeInstanceId, standbyNodeInstanceId, instancesDetails } = activeSqlNodeResult;
    // fqdn and ipAddress may not exist on all return types, so use optional chaining
    const { fqdn, ipAddress, clusterName } = activeSqlNodeResult as any;
    const databaseHostDetails: DatabaseHostSummaryForMultiInstanceResponseType = {
        id: resourceId,
        name: resourceName || '',
        databaseHostStatus: activeNodeInstanceId ? ONLINE : instancesDetails ? OFFLINE : UNKNOWN,
        ssmStatus: ssmConnectionStatus || NOT_AVAILABLE
    };

    let nodeTopology: any;
    let usageEstimationData: any;
    let databaseInstancesDetail: any;

    try {
        if (credentialsId && region) {
            if (IS_DEMO_FLOW) {
                const hostResourceName = resourceDetail?.resource_name || '';
                instancesDetails = instancesDetails!
                    .filter((instance: { instanceName: string | (string | null)[] }) => {
                        if (instance.instanceName.includes('$')) {
                            return true; // Exclude instances with '$' from filtering
                        }
                        return (
                            instance.instanceName.includes(hostResourceName) ||
                            instance.instanceName === DEFAULT_INSTANCE_NAME ||
                            instance.instanceName === PGSQL_DEFAULT_INSTANCE_NAME
                        );
                    })
                    .map((instance: { instanceName: { replace: (arg0: string | null, arg1: string) => any } }) => ({
                        ...instance,
                        instanceName: instance.instanceName.replace(resourceName, '')
                    }));
            }

            databaseInstancesDetail =
                resourceType === DatabaseTypes.PG_SQL
                    ? getPgSqlDatabaseInstancesDetails(
                          credentialsId,
                          region,
                          instancesManaged,
                          resourceId,
                          instancesDetails?.map((instance: any) => ({
                              ...instance,
                              isManaged: instance.isManaged ?? true
                          }))
                      )
                    : resourceType === DatabaseTypes.ORACLE
                    ? getOracleDatabaseInstancesDetails(
                          credentialsId,
                          region,
                          instancesManaged,
                          resourceId,
                          instancesDetails?.map((instance: any) => ({
                              ...instance,
                              isManaged: instance.isManaged ?? true
                          }))
                      )
                    : getDatabaseInstancesDetails(
                          credentialsId,
                          region,
                          instancesManaged,
                          resourceId,
                          instancesDetails
                      );

            databaseHostDetails.databaseInstanceDetails = databaseInstancesDetail;
            const promises = [];

            if (shouldQueryNodeTopology) {
                promises.push(
                    getNodeTopology(
                        accountId,
                        region,
                        resourceId,
                        resourceDetail,
                        activeNodeInstanceId || node1InstanceId,
                        standbyNodeInstanceId || node2InstanceId,
                        fqdn,
                        ipAddress,
                        clusterName
                    ).catch(error => {
                        logger.error(`Error while fetching data: ${error}.`);
                        if (DATABASE_HOSTS_INDEX_MAPPING_V2[promises.length - 1]) {
                            errormessages[DATABASE_HOSTS_INDEX_MAPPING_V2[promises.length - 1]] = JSON.stringify(error);
                        }
                    })
                );
            } else {
                promises.push(Promise.resolve());
            }
            resourceDetail.database_instances = instancesManaged;
            if (getUsageEstimation && activeNodeInstanceId) {
                promises.push(
                    getBillingOrPriceEstimation(resourceDetail, activeNodeInstanceId, isManagedResource).catch(
                        error => {
                            logger.error(`Error while fetching data: ${error}.`);
                            if (DATABASE_HOSTS_INDEX_MAPPING_V2[promises.length - 1]) {
                                errormessages[DATABASE_HOSTS_INDEX_MAPPING_V2[promises.length - 1]] =
                                    JSON.stringify(error);
                            }
                        }
                    )
                );
            } else {
                promises.push(Promise.resolve());
            }

            let instanceResults: any;

            if (activeNodeInstanceId && databaseInstancesDetail.length > 0 && credentialsId && region) {
                let runningDatabaseInstances: DatabaseInstance[] = [];
                if (isManagedResource) {
                    runningDatabaseInstances = instancesManaged.filter(resource =>
                        databaseInstancesDetail.some(
                            (instance: InstanceDetails) =>
                                instance.instanceState === ServerState.UP &&
                                (instance.instanceName === resource.database_instance_name ||
                                    (resourceType === DatabaseTypes.PG_SQL &&
                                        resourceId === resource?.resource?.resource_id) ||
                                    (resourceType === DatabaseTypes.ORACLE &&
                                        resourceId === resource?.resource?.resource_id))
                        )
                    );
                } else {
                    runningDatabaseInstances =
                        resourceDetail.database_instances?.filter(
                            instance => instance?.instanceState?.toUpperCase() === 'RUNNING'
                        ) ?? [];
                }

                runningDatabaseInstances = runningDatabaseInstances.map(resource => ({
                    ...resource,
                    sqlAuthEnabled: databaseInstancesDetail.find(
                        ({ instanceName }: { instanceName: string }) => instanceName === resource.database_instance_name
                    )?.sqlAuthEnabled
                }));

                if (runningDatabaseInstances.length > 0) {
                    if (resourceType === DatabaseTypes.PG_SQL) {
                        promises.push(
                            getPgSqlDatabaseInstancesSummary(
                                accountId,
                                credentialsId,
                                activeNodeInstanceId!,
                                region,
                                runningDatabaseInstances,
                                fields
                            )
                        );
                    } else if (resourceType === DatabaseTypes.ORACLE) {
                        promises.push(
                            getOracleDatabaseInstancesSummary(
                                accountId,
                                credentialsId,
                                activeNodeInstanceId!,
                                region,
                                runningDatabaseInstances,
                                fields,
                                resourceDetail
                            )
                        );
                    } else {
                        promises.push(
                            getDatabaseInstancesSummary(
                                accountId,
                                credentialsId,
                                activeNodeInstanceId!,
                                region,
                                runningDatabaseInstances,
                                databaseHostId,
                                fields,
                                resourceDetail,
                                undefined
                            )
                        );
                    }
                } else {
                    promises.push(Promise.resolve());
                }
            }
            [nodeTopology, usageEstimationData, instanceResults] = await Promise.all(promises);

            databaseHostDetails.ssmStatus = ssmConnectionStatus || NOT_AVAILABLE;

            if (getUsageEstimation && usageEstimationData) {
                databaseHostDetails.ebsResourceInfo = usageEstimationData?.storage?.ebsBreakdownByVolumeType;
                databaseHostDetails.fsxnResourceInfo = usageEstimationData?.storage?.fsxnBreakDownById;
                databaseHostDetails.fsxwResourceInfo = usageEstimationData?.storage?.fsxwBreakDownById;
                databaseHostDetails.estimatedUsageCost = usageEstimationData;

                // Aggregate FSxN storage
                let totalFsxnSize = 0;
                databaseHostDetails.fsxnResourceInfo?.forEach(resource => {
                    totalFsxnSize += resource.size!;
                });

                // Aggregate FSxW storage
                let totalFsxwSize = 0;
                databaseHostDetails.fsxwResourceInfo?.forEach(resource => {
                    totalFsxwSize += resource.size!;
                });

                // Aggregate EBS storage
                let totalEbsSize = 0;
                databaseHostDetails.ebsResourceInfo?.forEach(resource => {
                    totalEbsSize += resource.size!;
                });

                databaseHostDetails.storageAllocation = { fsxn: totalFsxnSize, fsxw: totalFsxwSize, ebs: totalEbsSize };
            }
            if (resourceType === DatabaseTypes.ORACLE && instanceResults?.length > 0) {
                databaseHostDetails.platform = instanceResults.find((d: DatabaseHostInstanceSummaryResponseType) =>
                    Boolean(d?.platform)
                )?.platform;
                instanceResults = instanceResults.map((d: DatabaseHostInstanceSummaryResponseType) =>
                    omit(d, 'platform')
                );
            }

            if (shouldQueryNodeTopology && nodeTopology && nodeTopology.ec2Details.length > 0) {
                databaseHostDetails.nodeTopology = nodeTopology;
            }

            databaseHostDetails.databaseInstanceDetails = databaseInstancesDetail;

            databaseHostDetails.databaseInstancesSummary = instanceResults;

            // ClusterNodeDetails is used in TCO
            if (resourceDetail?.clusterNodeDetails && resourceDetail?.clusterNodeDetails?.length > 0) {
                databaseHostDetails.clusterNodeDetails = resourceDetail?.clusterNodeDetails;
            }
        }
    } catch (error) {
        logger.error(`Error while fetching database hosts details ${accountId}, ${error}`);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Error while fetching database hosts details ${accountId}, ${error}`
        );
    }
    databaseHostDetails.sqlLicenseIncluded = WIN_SQL_EC2_USAGE_OPERATION.includes(ec2UsageOperation!) || false;
    databaseHostDetails.name = databaseHostDetails?.name?.toLowerCase();
    databaseHostDetails.databaseInstancesSummary?.forEach((instance: DatabaseHostInstanceSummaryResponseType) => {
        instance.databaseInstanceName = instance?.databaseInstanceName?.toLowerCase();
    });
    return databaseHostDetails;
}

async function getDatabaseHostInstanceSummary(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    fields?: string
) {
    logger.info('Fetching details about a database host instance ', accountId, databaseHostId, databaseInstanceId);

    const { activeNodeInstanceId, newDatabaseInstanceDetails, standbyNodeInstanceId } = await getInstanceDetails(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId
    );
    const [resourceDetails] = newDatabaseInstanceDetails.resource
        ? [newDatabaseInstanceDetails.resource]
        : await listResources({
              accountId,
              resourceId: databaseHostId,
              credentialIds: credentialsId,
              region,
              includeDatabaseInstances: true
          });

    const [databaseInstanceSummary] = await getDatabaseInstancesSummary(
        accountId,
        credentialsId,
        activeNodeInstanceId,
        region,
        [newDatabaseInstanceDetails],
        databaseHostId,
        fields,
        resourceDetails,
        standbyNodeInstanceId
    );
    logger.debug('Database host instance details', databaseInstanceSummary);
    return databaseInstanceSummary;
}

async function getDatabasesV2(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    fields?: string
): Promise<DatabasesListResponseType> {
    logger.info('Getting v2 database list', accountId, region, databaseHostId, databaseInstanceId, fields);

    const { activeNodeInstanceId, newDatabaseInstanceDetails } = await getInstanceDetails(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId
    );
    const {
        database_instance_name: savedInstanceName,
        fsxn_ids: fileSystemId,
        sqlAuthEnabled
    } = newDatabaseInstanceDetails;

    let fieldsValues: Array<string> = [];

    if (fields) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    }

    const getProtection = fieldsValues?.includes(DatabaseHostsQueryFields.PROTECTION);

    const uniqueCrrConfigData = getProtection
        ? await getUniqueCrrDetails(accountId, credentialsId, region!, databaseHostId, databaseInstanceId)
        : [];
    // Attach CRR config data if available
    if (uniqueCrrConfigData?.length) {
        newDatabaseInstanceDetails.crrConfigData = uniqueCrrConfigData[0]?.config_data;
    }

    try {
        const response = await getDatabaseDetails(
            accountId,
            region,
            credentialsId,
            databaseHostId,
            fileSystemId,
            getProtection,
            [newDatabaseInstanceDetails],
            activeNodeInstanceId,
            sqlAuthEnabled
        );
        logger.debug('Database list response', response);
        const databases = response[savedInstanceName] || [];
        return { count: databases.length, items: databases };
    } catch (error) {
        const errorMessage = `Error while fetching database details for host ${databaseHostId} in account ${accountId} , ${error}`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `${errorMessage}`);
    }
}

function fetchCrrBackupDetails(instanceDetails: DatabaseInstance[], volumeRecords: VolumeRecord[], volumeDBMap: any) {
    logger.info('Fetching CRR backup details', {
        instanceNames: instanceDetails.map(instance => instance?.database_instance_name),
        volumeRecordsLength: volumeRecords?.length
    });
    if (isEmpty(instanceDetails)) {
        logger.warn('Instance details array is empty. Returning an empty mapping.');
        return [];
    }
    const [{ crrConfigData: { crrDetails } = {} }] = instanceDetails;
    const crrMapping = Object.entries(volumeDBMap).map(([, dbMap]: [string, any]) => {
        const { databaseName, ontapVolumeuuid: volumeUuid } = dbMap;
        const { name: volumeNameFromVolumeRecords } = volumeRecords.find(vr => vr.uuid === volumeUuid) || {};
        const crrDetail = Array.isArray(crrDetails)
            ? crrDetails.find(({ volumeName }: { volumeName: string }) => volumeName === volumeNameFromVolumeRecords)
            : undefined;
        return {
            databaseName,
            isCRREnabled: crrDetail ? crrDetail.isCRREnabled : null
        };
    });

    return crrMapping;
}

async function getProtectionDetails(
    credentialsId: string,
    region: string,
    fileSystemId: string,
    isSystemDatabase: boolean = false,
    activeNodeInstanceId?: string,
    instanceDetails?: DatabaseInstance[],
    isSqlAuthEnabled = false
): Promise<{
    awsBackup: Record<string, BackupType>;
    ontapBackup: Record<string, BackupType>;
    crrBackup: Record<string, BackupType>;
    isAppConsistentBackupEnabled: Record<string, BackupType>;
}> {
    logger.info('Getting Proteciton details', {
        credentialsId,
        region,
        fileSystemId,
        activeNodeInstanceId
    });

    const instanceOntapDetails = (
        await Promise.all(
            (instanceDetails || []).map(instance => getInstanceOntapDetails(instance, credentialsId, region))
        )
    ).reduce((acc, curr) => ({ ...acc, ...curr }), {});

    logger.debug('instanceOntapDetails', instanceOntapDetails);
    // Getting the map between database name and associated volume uuid
    const instanceVolumeMapping = ((await getMappedOntapVolumes(
        credentialsId,
        region,
        fileSystemId,
        isSystemDatabase,
        activeNodeInstanceId,
        instanceDetails?.map(instance => instance.database_instance_name),
        isSqlAuthEnabled,
        false,
        undefined,
        undefined,
        undefined,
        instanceOntapDetails
    )) as MappedOnTapVolumeResponse[]) || [{ volumeRecords: [], volumeDBMap: {} }];

    const volumeRecords = Object.fromEntries(
        Object.entries(instanceVolumeMapping).map(([instanceName, data]) => [instanceName, data?.volumeRecords || []])
    );

    const volumeDBMap = Object.fromEntries(
        Object.entries(instanceVolumeMapping).map(([instanceName, data]) => [instanceName, data?.volumeDBMap || {}])
    );

    const volumeUuids = Object.fromEntries(
        Object.entries(instanceVolumeMapping).map(([instanceName, data]) => [
            instanceName,
            (data?.volumeRecords || []).map(volume => volume.uuid as string)
        ])
    );

    const awsBackup: Record<string, BackupType> = {};
    const ontapBackup: Record<string, BackupType> = {};
    const crrBackup: Record<string, BackupType> = {};
    const isAppConsistentBackupEnabled: Record<string, BackupType> = {};

    await Promise.all(
        Object.entries(instanceVolumeMapping).map(async ([instanceName]) => {
            const [awsBackupInstance, ontapBackupInstance, crrBackupInstance, databaseAppConsistentBackupMap] =
                await Promise.all([
                    isFsxnAwsBackupEnabled(
                        credentialsId,
                        region,
                        fileSystemId,
                        volumeUuids[instanceName],
                        volumeDBMap[instanceName],
                        activeNodeInstanceId
                    ),
                    getOntapVolumesSnapshotCount(
                        credentialsId,
                        region,
                        fileSystemId,
                        volumeRecords[instanceName],
                        volumeDBMap[instanceName]
                    ),
                    fetchCrrBackupDetails(
                        instanceDetails?.filter(instance => instance.database_instance_name === instanceName) || [],
                        volumeRecords[instanceName],
                        volumeDBMap[instanceName]
                    ),
                    isInstanceAppConsistentBackupEnabled(
                        credentialsId,
                        region,
                        fileSystemId,
                        volumeUuids[instanceName],
                        volumeDBMap[instanceName],
                        activeNodeInstanceId!
                    )
                ]);

            awsBackup[instanceName] = {
                ...awsBackupInstance,
                volumeUuidsInBackups: Boolean(awsBackupInstance?.volumeUuidsInBackups)
            };
            ontapBackup[instanceName] = ontapBackupInstance || {};
            crrBackup[instanceName] = crrBackupInstance.reduce(
                (acc: BackupType, item: { databaseName: string; isCRREnabled: boolean | null }) => {
                    acc[item.databaseName] = item.isCRREnabled === null ? false : item.isCRREnabled;
                    return acc;
                },
                {}
            );
            isAppConsistentBackupEnabled[instanceName] = { ...databaseAppConsistentBackupMap };
        })
    );

    return { awsBackup, ontapBackup, crrBackup, isAppConsistentBackupEnabled };
}

async function getInstanceOntapDetails(
    instance: DatabaseInstance,
    credentialsId: string,
    region: string
): Promise<Record<string, { fsxId: string; svmUuid: string | undefined }>> {
    const [fsxId] = instance?.fsxn_ids?.split(',') || [];
    const { StorageVirtualMachines: svms = [] } = await describeFSxStorageVirtualMachines(
        credentialsId,
        region,
        [fsxId],
        { useCache: true }
    );
    const instanceLevelSvm = svms.find(
        svm => svm?.StorageVirtualMachineId === (instance.fsx_svm_id as Record<string, string>)[fsxId]
    );
    return {
        [instance.database_instance_name]: {
            fsxId,
            svmUuid: instanceLevelSvm?.UUID
        }
    };
}

async function getInstanceDetails(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    resource?: ResourceDetails,
    dbInstanceDetails?: DatabaseInstance
) {
    logger.info('Getting instance details', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId
    });

    let resourceDetails = resource;
    let instanceDetails = dbInstanceDetails;

    // If either resource or databaseInstanceDetails is empty, make both DB calls
    if (isEmpty(resource) || isEmpty(dbInstanceDetails)) {
        const instanceResult = await getPaginatedDatabaseInstances(accountId, {
            resourceId: databaseHostId,
            credentialsId,
            databaseInstanceId,
            region,
            shouldIncludeResource: true
        });
        const instances = Array.isArray(instanceResult) ? instanceResult : instanceResult.items;
        [instanceDetails] = instances;
        resourceDetails = instanceDetails?.resource;
    }

    if (isEmpty(resourceDetails) || isEmpty(instanceDetails)) {
        const errorMessage = `No database host by id ${databaseHostId} or instance by instance id ${databaseInstanceId} for ${accountId} is found.`;
        logger.warn(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    // Update the database instance details to include storage type as FSXN
    const databaseInstanceDetails = {
        ...instanceDetails,
        storage_type: STORAGE_TYPE.FSXN,
        isManaged: true
    };

    const activeNodeResponse = await getActiveNodeAndInstanceDetails(
        accountId,
        credentialsId,
        region,
        resourceDetails,
        databaseInstanceDetails as unknown as DatabaseInstance
    );
    const { nodeId: activeNodeInstanceId, matchingInstance, standbyNodeInstanceId } = activeNodeResponse;
    const { instanceName, instanceState, sqlAuthEnabled = false } = matchingInstance;
    if (instanceState !== SQL_SERVICE_STATE.RUNNING) {
        const errorMessage = `Instance id ${databaseInstanceId} is not running on host ${databaseHostId}.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }
    const newDatabaseInstanceDetails = {
        ...databaseInstanceDetails,
        instanceName,
        instanceState,
        sqlAuthEnabled
    } as unknown as DatabaseInstance;

    return {
        activeNodeInstanceId,
        newDatabaseInstanceDetails,
        standbyNodeInstanceId,
        cloudProviderAccountId: resourceDetails?.cloud_provider_account_id,
        resourceName: resourceDetails?.resource_name
    };
}

async function getDatabaseDetails(
    accountId: string,
    region: string,
    credentialsId: string,
    databaseHostId: string,
    fileSystemId: string,
    getProtection: boolean,
    databaseInstances: DatabaseInstance[],
    activeNodeInstanceId?: string,
    sqlAuthEnabled?: boolean
) {
    logger.info('Getting database details', {
        accountId,
        region,
        credentialsId,
        databaseHostId,
        fileSystemId,
        activeNodeInstanceId,
        getProtection,
        sqlAuthEnabled,
        databaseInstancesLength: databaseInstances.length
    });
    try {
        const newinstanceNames = databaseInstances.map(instance => instance.database_instance_name);
        const [
            { databases } = { databases: [] },
            backedupDatabases,
            { awsBackup = [], ontapBackup = [], crrBackup = [], isAppConsistentBackupEnabled = [] } = {}
        ] = await Promise.all(
            [
                getDataBasesSummary(
                    databaseHostId,
                    activeNodeInstanceId!,
                    sqlAuthEnabled,
                    accountId,
                    credentialsId,
                    newinstanceNames
                ),
                ...(getProtection
                    ? [
                          getNativeSQLBackedupDatabases(
                              databaseHostId,
                              activeNodeInstanceId,
                              newinstanceNames,
                              sqlAuthEnabled,
                              accountId,
                              credentialsId
                          )
                      ]
                    : [Promise.resolve()]), // Fetch native sql protection status
                ...(activeNodeInstanceId && getProtection
                    ? [
                          getProtectionDetails(
                              credentialsId,
                              region,
                              fileSystemId,
                              false,
                              activeNodeInstanceId,
                              databaseInstances,
                              sqlAuthEnabled
                          )
                      ]
                    : [Promise.resolve()]) // Fetch protection status
            ].map(p =>
                p.catch(error => {
                    logger.error(`Error while fetching database details: ${error?.message}.`);
                })
            )
        );

        const response = Object.entries(databases).reduce((acc, [instName, dbs]) => {
            if (Array.isArray(dbs)) {
                acc[instName] = (dbs as DatabaseDetails[]).map(
                    (database: DatabaseDetails): UserDatabase => ({
                        name: database.databaseName,
                        size: database.databaseSize,
                        status: database.databaseStatus,
                        collation: database.collationName ?? '',
                        type: MSSQL_SYSTEM_DATABASES.includes(database?.databaseName?.toLowerCase())
                            ? MSSQL_DATABASE_TYPES.SYSTEM
                            : MSSQL_DATABASE_TYPES.USER,
                        ...(getProtection && {
                            protection: {
                                isAwsBackupEnabled: {
                                    fsxn: IS_DEMO_FLOW
                                        ? true
                                        : checkKey(
                                              awsBackup[instName]?.volumeDBMapWithBackupFlag,
                                              database.databaseName
                                          ),
                                    fsxw: false,
                                    ebs: false
                                },
                                isFsxOntapSnapshotsEnabled: IS_DEMO_FLOW
                                    ? true
                                    : checkKey(ontapBackup[instName], database.databaseName),
                                isSqlNativeEnabled:
                                    backedupDatabases?.[instName] && backedupDatabases?.[instName].includes('error')
                                        ? false
                                        : Boolean(
                                              backedupDatabases?.[instName] &&
                                                  backedupDatabases[instName]?.find(
                                                      (e: { backedupDatabases: string }) =>
                                                          e.backedupDatabases === database.databaseName
                                                  )
                                          ),
                                isCRREnabled: IS_DEMO_FLOW
                                    ? true
                                    : checkKey(crrBackup[instName], database.databaseName),
                                isAppConsistentBackupEnabled:
                                    IS_DEMO_FLOW ||
                                    checkKey(isAppConsistentBackupEnabled[instName], database.databaseName)
                            }
                        })
                    })
                );
            } else {
                logger.error(
                    `Error while fetching database details for instance ${instName} for account ${accountId} for credentials ${credentialsId} in region ${region}.`
                );
            }
            return acc;
        }, {} as Record<string, any[]>);

        if (IS_DEMO_FLOW) {
            const defaultResponse = response[DEFAULT_INSTANCE_NAME];
            databaseInstances!.forEach((databaseInstance: DatabaseInstance, index) => {
                const instanceName = newinstanceNames[index];
                const { metadata } = databaseInstance;

                const { userDatabase = [] } = metadata as unknown as Metadata;

                response[instanceName] = [...defaultResponse, ...userDatabase];
            });
        }
        return response;
    } catch (error: any) {
        const errorMessage = error.message;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `${errorMessage}`);
    }
}

async function getDatabaseInstancesSummary(
    accountId: string,
    credentialsId: string,
    activeNodeInstanceId: string,
    region: string,
    databaseInstances: DatabaseInstance[],
    databaseHostId: string,
    fields?: string,
    resourceDetails?: ResourceDetails,
    standbyNodeInstanceId?: string
    /*
    resource detail is used to fetch node Topology for host its optional in instance summary
    as its returned at host level for database-hosts api(inventory) and
    at instance level for database-instances api (resource page)
    */
) {
    logger.info('Fetching summary of database instance', {
        accountId,
        credentialsId,
        activeNodeInstanceId,
        region,
        databaseInstancesLength: databaseInstances.length,
        fields,
        resourceId: resourceDetails?.resource_id,
        standbyNodeInstanceId
    });

    let fieldsValues: Array<string> = [];

    if (fields) {
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    }
    const shouldQueryDatabasesWithProtection = fieldsValues?.includes(
        DatabaseHostsQueryFields.DATABASES_WITH_PROTECTION.toLowerCase()
    );
    const shouldQueryDatabasesWithoutProtection = fieldsValues?.includes(
        DatabaseHostsQueryFields.DATABASES.toLowerCase()
    );
    const shouldQueryServerDetails = fieldsValues?.includes(DatabaseHostsQueryFields.SERVER_DETAILS.toLowerCase());
    const shouldQueryDatabaseTopology = fieldsValues?.includes(
        DatabaseHostsQueryFields.DATABASE_INSTANCE_TOPOLOGY.toLowerCase()
    );
    const getPerformance = fieldsValues?.includes(DatabaseHostsQueryFields.PERFORMANCE);
    const getStorageSavings = fieldsValues?.includes(DatabaseHostsQueryFields.STORAGE);
    const getResourceutilization = fieldsValues?.includes(DatabaseHostsQueryFields.RESOURCE_UTILIZATION.toLowerCase());
    const getProtection = fieldsValues?.includes(DatabaseHostsQueryFields.PROTECTION);
    const getDbCount = fieldsValues?.includes(DatabaseHostsQueryFields.DB_COUNT.toLowerCase());
    const shouldQueryNodeTopology = fieldsValues?.includes(DatabaseHostsQueryFields.NODE_TOPOLOGY.toLowerCase());

    let serverDetails: any;
    let databaseInstancetopologyData: any;
    let performanceData: any;
    let storageData: any;
    let resourceUtilizationData: any;
    let protectionData: any;
    let databasesCount: any;
    let nodeTopologyData: any;
    let ontapStorageSavings: any;
    let databases: Record<string, any[]>;
    let resourceTrendsData: any;
    const errormessages: { [index: string]: string } = {};

    const instanceNames = databaseInstances.map((instance: DatabaseInstance) => instance.database_instance_name);
    let isSqlAuthEnabled = false;
    if (
        shouldQueryServerDetails ||
        getPerformance ||
        getProtection ||
        getResourceutilization ||
        getDbCount ||
        shouldQueryDatabasesWithProtection ||
        shouldQueryDatabasesWithoutProtection
    ) {
        // const instances = await determineSqlAuthEnabled(accountId, credentialsId, activeNodeInstanceId, region, databaseInstances);
        isSqlAuthEnabled = IS_DEMO_FLOW
            ? isSqlAuthEnabled
            : databaseInstances.some((instance: any) => instance.sqlAuthEnabled);
    }
    const shouldGetStorageSavingsFromOntap = databaseInstances.some(i => i.isManaged && !IS_DEMO_FLOW);
    const fsxIds = resourceDetails?.database_instances?.map((instance: DatabaseInstance) => instance.fsxn_ids);

    try {
        [
            serverDetails,
            databaseInstancetopologyData,
            performanceData,
            storageData,
            protectionData,
            resourceUtilizationData,
            databasesCount,
            nodeTopologyData,
            ontapStorageSavings,
            databases,
            resourceTrendsData
        ] = await Promise.all(
            [
                ...(shouldQueryServerDetails
                    ? [getServerDetails(credentialsId, region, activeNodeInstanceId, instanceNames, isSqlAuthEnabled)]
                    : [Promise.resolve()]), // Fetch server metadata
                ...(shouldQueryDatabaseTopology
                    ? [
                          Promise.all(
                              databaseInstances.map(dbInstance =>
                                  getDatabaseInstanceTopology(
                                      accountId,
                                      credentialsId,
                                      region,
                                      activeNodeInstanceId,
                                      dbInstance
                                  )
                              )
                          )
                      ]
                    : [Promise.resolve()]),
                ...(getPerformance
                    ? [
                          getPerformanceMetrics(
                              credentialsId,
                              region,
                              activeNodeInstanceId,
                              instanceNames,
                              isSqlAuthEnabled
                          )
                      ]
                    : [Promise.resolve()]), // Fetch io latency data
                ...(getStorageSavings
                    ? [Promise.all(databaseInstances.map(dbInstance => getStorageData(undefined, dbInstance, true)))]
                    : [Promise.resolve()]), // Fetch storage savings data
                ...(getProtection && !shouldQueryDatabasesWithProtection
                    ? [
                          getProtectionStatus(
                              activeNodeInstanceId,
                              undefined,
                              undefined,
                              databaseInstances,
                              VERSION_2_0,
                              isSqlAuthEnabled
                          )
                      ]
                    : [Promise.resolve()]), // Fetch protection status
                ...(getResourceutilization
                    ? [
                          getAllResourceUtilisationDetails(
                              credentialsId,
                              region,
                              activeNodeInstanceId,
                              instanceNames,
                              isSqlAuthEnabled
                          )
                      ]
                    : [Promise.resolve()]),
                ...(getDbCount
                    ? [getDatabasesCount(credentialsId, region, activeNodeInstanceId, instanceNames, isSqlAuthEnabled)]
                    : [Promise.resolve()]),
                ...(shouldQueryNodeTopology && resourceDetails
                    ? [
                          getNodeTopology(
                              accountId,
                              region,
                              '',
                              resourceDetails,
                              activeNodeInstanceId,
                              standbyNodeInstanceId
                          )
                      ]
                    : [Promise.resolve()]),
                ...(getStorageSavings && shouldGetStorageSavingsFromOntap
                    ? [getMssqlStorageDataFromOntap(activeNodeInstanceId, databaseInstances, isSqlAuthEnabled)]
                    : [Promise.resolve()]),
                ...(shouldQueryDatabasesWithProtection || shouldQueryDatabasesWithoutProtection
                    ? [
                          getDatabaseDetails(
                              accountId,
                              region,
                              credentialsId,
                              databaseHostId!,
                              fsxIds ? fsxIds[0] : '',
                              shouldQueryDatabasesWithProtection,
                              databaseInstances,
                              activeNodeInstanceId,
                              isSqlAuthEnabled
                          )
                      ]
                    : [Promise.resolve()]),
                ...(getResourceutilization || getPerformance
                    ? [
                          getSqlInstanceUtilizationAndPerformance(
                              accountId,
                              region,
                              credentialsId,
                              databaseHostId,
                              databaseInstances.map(instance => instance.database_instance_name)
                          )
                      ]
                    : [Promise.resolve()])
            ].map((p, index) =>
                p.catch(error => {
                    if (MSSQL_DATABASE_INSTANCE_INDEX_MAPPING[index]) {
                        errormessages[MSSQL_DATABASE_INSTANCE_INDEX_MAPPING[index]] = JSON.stringify(error);
                    }
                    logger.error(`Error while fetching data: ${error}.`);
                })
            )
        );
    } catch (error) {
        logger.error(`Error while fetching database instance summary ${accountId}, ${error}`);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Error while fetching database instance summary ${accountId}, ${error}`
        );
    }

    return databaseInstances.map((databaseInstance: DatabaseInstance, index) => {
        const instanceName = instanceNames?.[index];
        const {
            database_instance_id: databaseInstanceId,
            database_instance_name: savedDatabaseInstanceName,
            metadata,
            created_time: creationDate,
            database_deployment_type: databaseDeploymentType
        } = databaseInstance;

        const { userDatabase = [] } = metadata as unknown as Metadata;

        const databaseInstanceDetails: DatabaseHostInstanceSummaryResponseType = {
            databaseInstanceId,
            databaseInstanceName: savedDatabaseInstanceName?.toLowerCase(),
            status: ''
        };

        databaseInstanceDetails.status = ServerState.UP;
        const instanceServerDetails = serverDetails?.[instanceName];
        if (shouldQueryServerDetails && instanceServerDetails) {
            if (
                IS_DEMO_FLOW &&
                databaseInstancetopologyData &&
                databaseInstancetopologyData[index].serverInstallationMode === 'Standalone'
            ) {
                instanceServerDetails.nodeNames = [instanceServerDetails.nodeNames[0]];
                delete instanceServerDetails.clusterName;
            }
            instanceServerDetails.creationDate = creationDate ? Date.parse(creationDate.toString()) : '';
            databaseInstanceDetails.databaseServer = instanceServerDetails;
        }

        if (IS_DEMO_FLOW && databasesCount && getDbCount && databasesCount?.[instanceName]?.[index]?.totalCount) {
            databasesCount[instanceName][index].totalCount += userDatabase.length;
        }

        const [instanceDbCount] = databasesCount?.[instanceName] ?? [];
        if (getDbCount && instanceDbCount) {
            databaseInstanceDetails.databaseCount = instanceDbCount?.totalCount || 0;
        }

        if (shouldQueryNodeTopology && nodeTopologyData) {
            databaseInstanceDetails.nodeTopology = nodeTopologyData;
        }

        databaseInstanceDetails.databaseInstanceTopology = databaseInstancetopologyData?.[index];
        const instancePerformanceData = performanceData?.[instanceName];
        databaseInstanceDetails.performance = getPerformance
            ? { assessment: instancePerformanceData?.assessment, rwMetrics: instancePerformanceData! }
            : {};
        databaseInstanceDetails.storage = storageData?.[index];
        databaseInstanceDetails.sqlServerDeploymentType = databaseDeploymentType || '';

        if (getPerformance && performanceData?.[instanceName]) {
            databaseInstanceDetails.performance = {
                assessment: instancePerformanceData?.assessment,
                rwMetrics: instancePerformanceData!
            };
        }
        // Need to maintain old qurey for instances API when CW metrics are not available

        if (resourceTrendsData?.[instanceName] && getPerformance) {
            const instanceResourceTrendsData = resourceTrendsData?.[instanceName] || {};
            if (instanceResourceTrendsData.serverIOLatency.length > 0) {
                const { serverIoLatency, assessment } = assessMssqlServerPerformance(
                    instanceResourceTrendsData.serverIOLatency
                );
                databaseInstanceDetails.performance = {
                    assessment,
                    rwMetrics: {
                        latency: {
                            read: instanceResourceTrendsData.readLatency,
                            write: instanceResourceTrendsData.writeLatency,
                            serverIo: serverIoLatency
                        },
                        iops: {
                            read: instanceResourceTrendsData.readIops,
                            write: instanceResourceTrendsData.writeIops
                        },
                        throughput: {
                            read: instanceResourceTrendsData.readThroughput,
                            write: instanceResourceTrendsData.writeThroughput
                        }
                    }
                };
            }
        }

        const instanceResourceUtilizationData = resourceUtilizationData?.[instanceName];
        if (getResourceutilization) {
            databaseInstanceDetails.resourceUtilization = {
                ...(instanceResourceUtilizationData && {
                    memory: instanceResourceUtilizationData.memoryUtilization ?? {},
                    disk: instanceResourceUtilizationData.diskUtilization ?? {}
                }),
                cpu: resourceTrendsData?.[instanceName]?.cpuUsed ?? []
            };
        }

        if (getProtection && protectionData) {
            databaseInstanceDetails.protection = protectionData?.[index];
        }

        if (shouldQueryDatabasesWithProtection && getProtection && databases?.[instanceName]) {
            let isSqlNativeEnabled: string | boolean = 'N/A';
            let isFsxOntapSnapshotsEnabled: string | boolean = 'N/A';
            let isAppConsistentBackupEnabled: string | boolean | undefined = 'N/A';
            const isAwsBackupEnabled: { fsxn: string | boolean } = {
                fsxn: 'N/A'
            };
            let protectedDatabases = 0;

            databases?.[instanceName].forEach(
                (database: {
                    protection: {
                        isSqlNativeEnabled: any;
                        isFsxOntapSnapshotsEnabled: any;
                        isAwsBackupEnabled: { fsxn: any };
                        isAppConsistentBackupEnabled?: boolean | string;
                    };
                }) => {
                    if (database.protection.isSqlNativeEnabled === true) {
                        isSqlNativeEnabled = true;
                        protectedDatabases += 1;
                    } else if (database.protection.isSqlNativeEnabled === false && isSqlNativeEnabled !== true) {
                        isSqlNativeEnabled = false;
                    }
                    if (database.protection.isFsxOntapSnapshotsEnabled === true) {
                        isFsxOntapSnapshotsEnabled = true;
                    } else if (
                        database.protection.isFsxOntapSnapshotsEnabled === false &&
                        isFsxOntapSnapshotsEnabled !== true
                    ) {
                        isFsxOntapSnapshotsEnabled = false;
                    }
                    if (database.protection.isAwsBackupEnabled.fsxn === true) {
                        isAwsBackupEnabled.fsxn = true;
                    } else if (
                        database.protection.isAwsBackupEnabled.fsxn === false &&
                        isAwsBackupEnabled.fsxn !== true
                    ) {
                        isAwsBackupEnabled.fsxn = false;
                    }
                    if (
                        database.protection.isAppConsistentBackupEnabled === false ||
                        database.protection.isAppConsistentBackupEnabled === 'N/A'
                    ) {
                        isAppConsistentBackupEnabled = false;
                    } else {
                        isAppConsistentBackupEnabled =
                            isAppConsistentBackupEnabled && database.protection.isAppConsistentBackupEnabled;
                    }
                }
            );
            if (!protectionData) {
                protectionData = {};
            }
            protectionData = {
                isSqlNativeEnabled,
                isFsxOntapSnapshotsEnabled,
                isAwsBackupEnabled,
                protectedDatabases,
                isAppConsistentBackupEnabled
            };
            databaseInstanceDetails.protection = protectionData;
        }

        if (!isEmpty(errormessages)) {
            databaseInstanceDetails.errors = errormessages;
        }

        if (databaseInstanceDetails.storage && ontapStorageSavings?.[instanceName]) {
            databaseInstanceDetails.storage.fsxn = {
                ...ontapStorageSavings[instanceName],
                protocol: databaseInstance.storage_protocol ? databaseInstance.storage_protocol.split(',') : []
            };
        }
        if (
            databases?.[instanceName] &&
            (shouldQueryDatabasesWithProtection || shouldQueryDatabasesWithoutProtection)
        ) {
            databaseInstanceDetails.databases = databases[instanceName];
        }
        return databaseInstanceDetails;
    });
}

/* Util function to return all cluster node datails given database host ID or one of the instance IDs in the cluster */
async function getAllClusterNodeDetails(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId?: string,
    node1InstanceId?: string
) {
    const ssmComment = 'Getting all cluster node details';
    logger.info(ssmComment, {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        node1InstanceId
    });

    if (!node1InstanceId && !databaseHostId) {
        logger.warn('databaseHostId or nodeInstanceId is missing');
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            'Atleast one node instance ID of database host ID is required to fetch all cluster node details'
        );
    }

    if (!node1InstanceId) {
        const [{ metadata = {} } = {}] =
            (await listResources({
                accountId,
                resourceId: databaseHostId,
                credentialIds: credentialsId,
                region,
                selectKeys: ['metadata']
            })) || [];
        ({ node1InstanceId } = metadata as unknown as Metadata);
    }

    const clusterNetworkIpDetails = await callSsmExecution(
        credentialsId,
        region,
        CLUSTER_NETWORK_IP_INFO_PS1,
        node1InstanceId,
        ssmComment,
        accountId
    );
    const clusterNetworkIpDetailsJson: { clusterNetworkIps: string[] } = JSON.parse(clusterNetworkIpDetails);
    const { clusterNetworkIps } = clusterNetworkIpDetailsJson;
    const clusterNodeDetails = await getInstanceDetailsByPrivateIp(credentialsId, region, clusterNetworkIps, {
        useCache: true
    });
    return compact(
        clusterNodeDetails.map(({ ec2InstanceId, ec2InstanceName }) => ({ ec2InstanceId, ec2InstanceName }))
    );
}

async function triggerInstancePerformanceAssessment(initiatedBy: string) {
    logger.info('Trigger instance performance assessment for all hosts', { initiatedBy });

    let nextToken: string | undefined;
    const PAGE_SIZE = 50;
    let batchNumber = 1;
    let totalProcessed = 0;
    const startTime = Date.now();
    const processedResourceIds = new Set<string>();

    do {
        logger.info(`Processing batch ${batchNumber}`, {
            nextToken,
            memoryUsage: process?.memoryUsage()
        });

        try {
            // This await is intentional: we process each page sequentially to avoid high memory usage and ensure order.
            // Using await in the loop is appropriate here because each page must be processed before fetching the next.
            // eslint-disable-next-line no-await-in-loop
            const response = await getResources({
                resourceType: [RESOURCESTYPE.MSSQL, RESOURCESTYPE.ORACLE],
                pageSize: PAGE_SIZE,
                nextToken,
                includeDatabaseInstances: true
            });

            const { items: batchManagedResources, nextToken: newNextToken } = response;

            if (isEmpty(batchManagedResources)) {
                logger.info('No more managed database hosts found. Processing completed.');
                break;
            }

            logger.info(`Processing ${batchManagedResources.length} resources in batch ${batchNumber}`);

            if (batchManagedResources.length > 0) {
                try {
                    // Process current batch following the old logic pattern
                    // eslint-disable-next-line no-await-in-loop
                    const processedCount = await processResourcesBatch(
                        batchManagedResources,
                        batchNumber,
                        processedResourceIds
                    );
                    totalProcessed += processedCount;
                } catch (batchError) {
                    logger.error(`Error processing resources batch ${batchNumber}:`, batchError);
                }
            }

            nextToken = newNextToken;
            batchNumber += 1;
        } catch (error: any) {
            logger.error(`Error processing batch ${batchNumber}:`, error);
            // Continue with next batch instead of breaking completely
            nextToken = undefined; // This will exit the loop
        }
    } while (nextToken);

    const duration = Date.now() - startTime;
    logger.info(
        `Instance performance assessment completed successfully. Total resources processed: ${totalProcessed}, Total batches: ${
            batchNumber - 1
        }, Duration: ${formatDuration(duration)}`
    );
}

async function processResourcesBatch(
    resources: ResourceDetails[],
    batchNumber: number,
    processedResourceIds: Set<string>
): Promise<number> {
    logger.info(`Processing ${resources.length} resources in batch ${batchNumber}`);

    // Remove duplicate resources within current batch and across all processed batches
    const seenInBatch = new Set<string>();
    const uniqueResources = resources.filter((resource: ResourceDetails) => {
        const resourceId = resource.resource_id;
        if (processedResourceIds.has(resourceId) || seenInBatch.has(resourceId)) {
            return false;
        }
        seenInBatch.add(resourceId);
        return true;
    });

    if (uniqueResources.length === 0) {
        logger.info(`No new resources to process in batch ${batchNumber}`);
        return 0;
    }

    logger.info(`Processing ${uniqueResources.length} unique resources in batch ${batchNumber}`);

    await Promise.all(
        uniqueResources.map(
            throat(1, async (resource: ResourceDetails) => {
                const {
                    metadata,
                    resource_id: databaseHostId,
                    resource_type: resourceType,
                    region,
                    credentials_id: credentialsId,
                    account_id: accountId,
                    database_instances: dbInstances
                } = resource;

                try {
                    await processResourceNodes(
                        accountId,
                        credentialsId,
                        region!,
                        databaseHostId,
                        metadata,
                        batchNumber,
                        resourceType as RESOURCESTYPE,
                        dbInstances?.map(dbInstance => dbInstance.database_instance_name) || []
                    );

                    // Mark as processed after successful processing
                    processedResourceIds.add(resource.resource_id);
                } catch (error: any) {
                    logger.error('Error while triggering performance assessment for resource', {
                        accountId,
                        credentialsId,
                        region,
                        databaseHostId,
                        batchNumber,
                        error: error.message
                    });
                    // Continue processing other resources even if one fails
                }
            })
        )
    );

    logger.info(`Completed processing ${uniqueResources.length} resources in batch ${batchNumber}`);
    return uniqueResources.length;
}

async function processResourceNodes(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    metadata: any,
    batchNumber: number,
    resourceType: RESOURCESTYPE,
    dbInstanceNames: string[] = []
) {
    logger.info('Processing resource metadata for performance assessment', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        batchNumber
    });

    try {
        const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;
        const nodeIds = node2InstanceId ? [node1InstanceId, node2InstanceId] : [node1InstanceId];

        await Promise.all(
            nodeIds.map(
                throat(2, async nodeId => {
                    try {
                        const connectionStatus = await getSSMConnectionStatus(credentialsId, region, nodeId, accountId);

                        if (connectionStatus.Status === ConnectionStatus.CONNECTED) {
                            logger.info('Triggering instance performance assessment for', {
                                accountId,
                                credentialsId,
                                region,
                                databaseHostId,
                                nodeId,
                                batchNumber
                            });

                            let command: string[] = [];
                            if (resourceType === RESOURCESTYPE.MSSQL) {
                                command = [trendGraphCreateScriptForMssql(databaseHostId, nodeId)];
                            } else {
                                dbInstanceNames.forEach(dbSid =>
                                    command.push(trendGraphCreateScriptForOracle(dbSid, nodeId))
                                );
                            }
                            const ssmComment = `Triggering instance performance assessment for account ${accountId}, database host ${databaseHostId}`;

                            await callSsmExecution(
                                credentialsId,
                                region,
                                command,
                                nodeId,
                                ssmComment,
                                accountId,
                                true,
                                CUSTOM_SSM_EXECUTION_TIMEOUT,
                                false,
                                SSM_RUN_SHELL_SCRIPT_DOC
                            );

                            logger.info('Successfully triggered performance assessment for node', {
                                accountId,
                                credentialsId,
                                region,
                                databaseHostId,
                                nodeId,
                                batchNumber
                            });
                        } else {
                            logger.warn('SSM connection not established for node', {
                                accountId,
                                region,
                                nodeId,
                                connectionStatus: connectionStatus.Status,
                                batchNumber
                            });
                        }
                    } catch (error: any) {
                        logger.error('Error while triggering performance assessment for node', {
                            accountId,
                            credentialsId,
                            region,
                            databaseHostId,
                            nodeId,
                            batchNumber,
                            error: error.message
                        });
                        // Continue processing other nodes even if one fails
                    }
                })
            )
        );
    } catch (error: any) {
        logger.error('Error processing resource metadata', {
            accountId,
            credentialsId,
            region,
            databaseHostId,
            batchNumber,
            error: error.message
        });
        throw error;
    }
}

export {
    getDatabaseHostsSummaryV2,
    getDatabaseHostSummaryV2,
    getDatabaseHostInstanceSummary,
    getDatabasesV2,
    getInstanceDetails,
    getAllClusterNodeDetails,
    getInstanceOntapDetails,
    getEc2ResourceInfo,
    isInstanceAppConsistentBackupEnabled,
    triggerInstancePerformanceAssessment
};
