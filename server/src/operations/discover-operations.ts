import createError from 'http-errors';
import config from 'config';
import randomize from 'randomatic';

import { STORAGE_TYPE, JOBSTATUS, JOBTYPE } from '@prisma/client';
import { FileSystemType } from '@aws-sdk/client-fsx';
import { compact, uniqBy, isEmpty, cloneDeep, uniq, isArray } from 'lodash-es';
import {
    DescribeInstancesCommandInput,
    Filter,
    InstanceBlockDeviceMapping,
    InstanceStateName,
    Vpc
} from '@aws-sdk/client-ec2';
import { CommandInvocationStatus, ConnectionStatus, SendCommandCommandInput } from '@aws-sdk/client-ssm';
import throat from 'throat';
import { stringify, parse } from 'flatted';
import {
    describeInstancesWithPagination,
    paginateDescribeEbsVolumes,
    paginatedDescribeSubnets,
    paginatedDescribeVpcs
} from '../lib/aws/ec2';
import {
    compressSsmCommand,
    coerceBooleanFromLooseTrue,
    decompressSSMResponse,
    generateHash,
    getArtifactsRegionBucketName,
    getArtifactsBucketRegion,
    getEc2Hostname,
    getFsxNameFromTags,
    getRedisConnection,
    getResourceNameFromTags,
    IS_DEMO_FLOW,
    isRedisConnected,
    isValidProp,
    retryWithDelay,
    sleep,
    sqlResponseParsing,
    summarizeFirstLevel
} from '../utils/utils';
import {
    getEc2SqlParameters,
    callSsmExecution,
    getSSMConnectionStatus,
    pollCommandStatus,
    getSSMConnectionStatusByInstanceIds,
    executeSSMDocumentMultipleInstances,
    extractSsmResponse
} from './aws/ssm-operations';
import { registerJob, updateJobDetails, getJobs } from './database/job-operations';
import { UpdateJobRecordType } from '../routes/types/jobs.types';

import {
    CloudProviders,
    HttpErrorCodes,
    RESOURCESTYPE,
    SqlServerDeploymentModel,
    STORAGE_PROTOCOLS,
    RESOURCE_PREPARE_JOB_TIMEOUT_MINUTES,
    DatabaseTypes,
    OFFLINE,
    NOT_AVAILABLE,
    PREPARE_PSMODULES_RELATIVE_PATH,
    SINGLE_AZ,
    HA,
    PGSQL_DEFAULT_INSTANCE_NAME,
    CLOUDWATCH_LOG_GROUP_FOR_SSM_RESPONSE,
    STANDALONE,
    ORACLE_INSTANCE_STATE,
    SSM_COMMAND_RUNTIMES,
    DEMO_ENTERPRISE_INSTANCES
} from '../utils/consts';
import {
    SQL_SERVER_VERSION_TO_YEAR,
    HOST_AND_SQL_INFO_PS1,
    INSTALL_WF_POWERSHELL_PREREQS_PS1,
    FAILURE_INFO,
    FEATURE_PREPREQUISITES
} from './workloads/mssql/discover-consts';
import { sendSSMCommand } from '../lib/aws/ssm';
import {
    REQUIRED_PS_MODULES_FOR_MANAGEMENT,
    SSM_RUN_POWERSHELL_SCRIPT_DOC,
    AOAG_ROLE_PRIMARY,
    AOAG_ROLE_SECONDARY,
    SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION
} from './workloads/mssql/const';
import { NodeDetails, ResourceDetails, MultipleCommandSsmResponse } from '../utils/common-types';
import {
    DiscoverMsSqlResponseBodyType,
    SqlServerInstanceInfoType,
    DiscoverResponseInfoType,
    DiscoverPgSqlResponseType,
    DiscoverPgSqlResponseBodyType,
    DiscoverOracleResponseType,
    DiscoverOracleInstanceType,
    DiscoverOracleResponseBodyType,
    PgSqlServerInstaceType
} from '../routes/types/discover.types';
import getLogger from '../utils/logger';
import { describeFSxFileSystems, describeFSxStorageVirtualMachines } from '../lib/aws/fsx';
import { returnInventorydata } from '../utils/demo-utils/demoDefaultUtils';
import { getDatabaseHostSummaryV2 } from './database-hosts-operations';
import { preSignedUrl } from '../lib/aws/s3';
import { getAmazonLinux2023AmiList, getInstanceDetailsByPrivateIp } from './aws/ec2-operations';
import { DatabaseHostSummaryForMultiInstanceResponseType } from '../routes/types/database-hosts.types';
import { copyScriptsToHost } from './resource-operations';
import { discoverPgsqlHosts } from './workloads/pgsql/pgsql-discover-scripts';
import { discoverOracleHosts } from './workloads/oracle/oracle-discover-scripts';
import { OracleDeploymentTenacy, SSM_RUN_SHELL_SCRIPT_DOC } from './workloads/oracle/consts';
import { OracleDataguardDiscoveryDetailsType } from './workloads/oracle/common-types';

const { getPreSignedUrl } = preSignedUrl;
const logger = getLogger();
const NO_PGSQL = 'no_pgsql';
interface SsmTargetsInfo {
    ec2InstanceId: string;
    ec2InstanceName: string;
    ec2InstanceType: string;
    ec2UsageOperation: string;
    ssmState: string;
    ebsVolumeIDs: (string | undefined)[] | undefined;
    vpc?: {
        id?: string;
        name?: string;
        cidrBlock?: string;
    };
}

interface FsxServerConfig {
    deploymentType: string | undefined;
    subnetIds: string[] | undefined;
    fileSystemStorageType?: string;
    fileSystemName?: string;
}

interface FSxInfo {
    fsxId: string;
    svmId?: string;
    type?: string;
}

interface OracleInstanceStorageInfo {
    isAsmManaged: string;
    mountIP?: string;
    mountPoint?: string;
    protocol: string;
    volumeId?: string;
}

type DiscoveredEc2InstanceType = (DiscoverPgSqlResponseType | DiscoverOracleResponseType) & {
    error?: string;
    ebsVolumeIDs: (string | undefined)[] | undefined;
    ebsVolumes?: (InstanceBlockDeviceMapping | undefined)[] | undefined;
};

const MINIMUM_SQL_SERVER_SUPPORTED = 2016;
const PREPARE_EC2_RERUN_DURATION: number = 20; // in minutes
const TEN_MINUTES = 10 * 60 * 1000;

async function getHostAndSqlServerInfo(
    accountId: string,
    credentialsId: string,
    region: string,
    pageSize?: number,
    nextToken?: string,
    instances: string[] = []
): Promise<DiscoverMsSqlResponseBodyType> {
    logger.info('Get host and SQL Server info:', { accountId, credentialsId, region, nextToken, instances });
    if (IS_DEMO_FLOW) {
        return (await returnInventorydata(
            accountId,
            region,
            credentialsId,
            DatabaseTypes.MS_SQL_SERVER,
            instances
        )) as unknown as DiscoverMsSqlResponseBodyType;
    }
    const filters: Filter[] = [{ Name: 'platform', Values: ['windows'] }];
    const { ec2Instances: ssmTargets, NextToken } = await discoverEc2Instances(
        accountId,
        credentialsId,
        region,
        filters,
        pageSize,
        nextToken,
        instances,
        DatabaseTypes.MS_SQL_SERVER
    );

    const ssmConnectedEc2ResponseInfo: DiscoverResponseInfoType[] = [];
    // Since it isn't possible to get SQL Server details for EC2 without
    // SSM connectivity, the attribute 'sqlServerInstances' will not be
    // available for those hosts in API response.
    const ssmNotConnectedEc2ResponseInfo: DiscoverResponseInfoType[] = ssmTargets.filter(
        (target: SsmTargetsInfo) => target.ssmState === ConnectionStatus.NOT_CONNECTED
    );

    const ssmConnectedNodes = ssmTargets.filter(
        (target: SsmTargetsInfo) => target.ssmState === ConnectionStatus.CONNECTED
    );
    const redisClient = getRedisConnection();
    if (ssmConnectedNodes?.length > 0) {
        // Reading from cache only for /instances and TCO APIs
        if (isRedisConnected(redisClient) && !isEmpty(instances)) {
            const cachedResponses = compact(
                await Promise.all(
                    instances.map(async instance => {
                        const cacheKey = generateHash(stringify({ instance, region, credentialsId }));
                        const cachedResponse = await redisClient.get(cacheKey);
                        if (cachedResponse) {
                            return parse(cachedResponse);
                        }
                    })
                )
            );
            if (!isEmpty(cachedResponses) && cachedResponses.length === instances.length) {
                return {
                    count: cachedResponses.length,
                    items: cachedResponses
                };
            }
            // TODO: Handle partial cache hits, currently if any miss, we go for full discovery, which is not optimal.
        }

        // Start SSM command and AWS API calls in parallel for better performance
        const [commandId, fsxList, svmList, subnetList, ebsVolumeList] = await Promise.all([
            makeSsmCall(
                credentialsId,
                region,
                HOST_AND_SQL_INFO_PS1,
                ssmConnectedNodes.map((target: SsmTargetsInfo) => target.ec2InstanceId),
                accountId
            ),
            describeFSxFileSystems(credentialsId, region, { useCache: true }),
            describeFSxStorageVirtualMachines(credentialsId, region, undefined, { useCache: true }),
            paginatedDescribeSubnets(credentialsId, region, {}, { useCache: true }),
            paginateDescribeEbsVolumes(
                credentialsId,
                region,
                {
                    Filters: [
                        {
                            Name: 'attachment.instance-id',
                            Values: ssmConnectedNodes.map(target => target.ec2InstanceId)
                        }
                    ]
                },
                undefined,
                { useCache: true }
            )
        ]);

        const endPointIpWithFsxInfo = new Map<string, FSxInfo>();
        const fsIdWithFsxInfo = new Map<string, FsxServerConfig>();
        svmList.StorageVirtualMachines?.forEach(async elem => {
            const fsId = elem.FileSystemId;
            elem?.Endpoints?.Iscsi?.IpAddresses?.forEach(async ip => {
                endPointIpWithFsxInfo.set(ip, {
                    fsxId: fsId!,
                    svmId: elem.StorageVirtualMachineId!,
                    type: FileSystemType.ONTAP
                });
            });

            elem?.Endpoints?.Smb?.IpAddresses?.forEach(async ip => {
                endPointIpWithFsxInfo.set(ip, {
                    fsxId: fsId!,
                    svmId: elem.StorageVirtualMachineId!,
                    type: FileSystemType.ONTAP
                });
            });
            if (elem?.Endpoints?.Smb?.DNSName) {
                endPointIpWithFsxInfo.set(elem?.Endpoints?.Smb?.DNSName, {
                    fsxId: fsId!,
                    svmId: elem.StorageVirtualMachineId!,
                    type: FileSystemType.ONTAP
                });
            }
        });

        // Fetch windows mount points from FSxW
        fsxList
            .filter(fsx => fsx.FileSystemType === FileSystemType.WINDOWS)
            .forEach(fsx => {
                endPointIpWithFsxInfo.set(`${fsx.WindowsConfiguration?.RemoteAdministrationEndpoint}`, {
                    fsxId: fsx.FileSystemId!,
                    type: FileSystemType.WINDOWS
                });
                endPointIpWithFsxInfo.set(`${fsx.WindowsConfiguration?.PreferredFileServerIp}`, {
                    fsxId: fsx.FileSystemId!,
                    type: FileSystemType.WINDOWS
                });
                endPointIpWithFsxInfo.set(`${fsx.DNSName!}`, {
                    fsxId: fsx.FileSystemId!,
                    type: FileSystemType.WINDOWS
                });
                fsx.WindowsConfiguration?.Aliases?.forEach(alias =>
                    endPointIpWithFsxInfo.set(`${alias.Name}`, {
                        fsxId: fsx.FileSystemId!,
                        type: FileSystemType.WINDOWS
                    })
                );
            });

        fsxList.forEach(({ FileSystemId, OntapConfiguration, WindowsConfiguration, SubnetIds, StorageType, Tags }) => {
            if (FileSystemId) {
                fsIdWithFsxInfo.set(FileSystemId, {
                    deploymentType: isEmpty(OntapConfiguration)
                        ? WindowsConfiguration?.DeploymentType
                        : OntapConfiguration?.DeploymentType,
                    subnetIds: SubnetIds,
                    fileSystemStorageType: StorageType,
                    fileSystemName: getFsxNameFromTags(Tags)
                });
            }
        });

        const subnetListMap = new Map(subnetList?.map(subnet => [subnet.SubnetId, subnet.AvailabilityZone]));
        const ebsVolumeToAvailabilityZoneMap = new Map(ebsVolumeList?.map(vol => [vol.VolumeId, vol.AvailabilityZone]));

        // PowerShell execution would take some time, so we wait for a second before triggering polling.
        //
        // NOTE:
        //  Getting FSx filesystems and SVMs will take some time, which could serve the
        // purpose of sleep() below.  Since PowerShell script takes some time to complete,
        // sleeping for a second would help us get the results in first SSM poll itself.
        // If run time performance is needed, this is one possible candidate for purge.
        await sleep(1000);

        await Promise.all(
            ssmConnectedNodes.map(
                throat(pageSize || 10, async (target: SsmTargetsInfo) => {
                    let dbInfo: SqlServerInstanceInfoType[] = [];
                    dbInfo = await getHostAndSqlInfoFromPsOutput(
                        credentialsId,
                        region,
                        target,
                        commandId!,
                        endPointIpWithFsxInfo,
                        fsIdWithFsxInfo,
                        subnetListMap,
                        ebsVolumeToAvailabilityZoneMap
                    );

                    if (dbInfo.length) {
                        dbInfo.forEach(sqlServerInstanceInfo => {
                            sqlServerInstanceInfo.sqlServerName = sqlServerInstanceInfo?.sqlServerName?.toLowerCase();
                        });
                        ssmConnectedEc2ResponseInfo.push({
                            ec2InstanceId: target.ec2InstanceId,
                            ec2InstanceType: target.ec2InstanceType,
                            ec2InstanceName: target.ec2InstanceName,
                            ec2UsageOperation: target.ec2UsageOperation,
                            ssmState: target.ssmState,
                            sqlServerInstances: dbInfo,
                            vpc: target.vpc
                        });
                    }
                })
            )
        );

        if (isRedisConnected(redisClient)) {
            await Promise.all(
                ssmConnectedEc2ResponseInfo.map(async item => {
                    const cacheKey = generateHash(stringify({ instance: item.ec2InstanceId, region, credentialsId }));
                    if (!isEmpty(item?.sqlServerInstances)) {
                        // only cache if sqlServerInstances is present
                        await redisClient.set(cacheKey, stringify(item), 'PX', TEN_MINUTES); // Cache for 10 minutes
                    }
                })
            );
        }
    }

    return {
        count: (ssmNotConnectedEc2ResponseInfo?.length || 0) + (ssmConnectedEc2ResponseInfo?.length || 0),
        nextToken: NextToken as string,
        items: [...ssmNotConnectedEc2ResponseInfo, ...ssmConnectedEc2ResponseInfo]
    };
}

async function getHostAndSqlInfoFromPsOutput(
    credentialsId: string,
    region: string,
    ssmTarget: SsmTargetsInfo,
    commandId: string,
    endPointIpWithFsxInfo: Map<string, FSxInfo>,
    fsIdWithFsxInfo: Map<string, FsxServerConfig>,
    subnetListMap: Map<string | undefined, string | undefined>,
    ebsVolumeToAvailabilityZoneMap: Map<string | undefined, string | undefined>
): Promise<SqlServerInstanceInfoType[]> {
    logger.info('Get host and SQL server details from PowerShell output', {
        credentialsId,
        region,
        ssmTarget,
        commandId,
        endPointIpWithFsxInfo,
        fsIdWithFsxInfo,
        subnetListMap
    });
    const commandInvocationParam = {
        CommandId: commandId,
        InstanceId: ssmTarget.ec2InstanceId
    };

    let api1StartTime;
    let api1EndTime;

    api1StartTime = performance.now();

    let ssmResponse;
    try {
        ssmResponse = await pollCommandStatus(credentialsId, region, commandInvocationParam);
    } catch (error) {
        const errorMessage = `Error fetching command status: ${error} on node ${ssmTarget.ec2InstanceId} for command Id ${commandId}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }

    if (ssmResponse?.StandardErrorContent) {
        logger.error('Failed to collect info using SSM. Reason: ', ssmResponse?.StandardErrorContent);

        // When the EC2 instance is restarted/shutdown/terminated, we get the message compared
        // in the if condition.  Since any further processing for the EC2 isn't possible in
        // such cases, we refrain from throwing.
        if (!ssmResponse?.StandardErrorContent?.includes('failed to run commands: exit status 1')) {
            throw createError(
                HttpErrorCodes.INTERNAL_SERVER_ERROR,
                `Failed to get details from EC2 instance ${ssmTarget.ec2InstanceId}. Reason: ${ssmResponse?.StandardErrorContent}`
            );
        }
    }
    if (ssmResponse.Status === CommandInvocationStatus.TIMED_OUT) {
        logger.error(`SSM command ${commandId} execution timed out on node ${ssmTarget.ec2InstanceId}`);
    }

    api1EndTime = performance.now();
    logger.info(
        `API1Performance: pollCommandStatus time for target ${ssmTarget.ec2InstanceId}: ${
            api1EndTime - api1StartTime
        }ms`
    );

    const ssmTargetSqlServerInstancesInfo: SqlServerInstanceInfoType[] = [];

    try {
        const powerShellScriptOutput = await decompressSSMResponse(ssmResponse?.StandardOutputContent || '');

        if (powerShellScriptOutput.length > 0) {
            if (powerShellScriptOutput?.includes('failureInfo')) {
                logger.error(
                    `Issues found while discovering SQL Server details in EC2 ${ssmTarget.ec2InstanceId}:`,
                    powerShellScriptOutput
                );
            }

            let responseInJson = JSON.parse(powerShellScriptOutput);

            if (!Array.isArray(responseInJson)) {
                responseInJson = [responseInJson];
            }

            responseInJson.forEach((item: { [key: string]: any }) => {
                try {
                    if (item.hasOwnProperty('windowsClusterNodes')) {
                        item.windowsClusterNodes = JSON.parse(item.windowsClusterNodes);
                        item.windowsClusterNodes = item.windowsClusterNodes ?? [];
                        // DBS-3941 fix
                        if (!isArray(item.windowsClusterNodes)) {
                            item.windowsClusterNodes = [item.windowsClusterNodes];
                        }
                        item.nodeIps = item.windowsClusterNodes
                            .filter((node: any) => node && node.Address)
                            .map(({ Address }: { Address: string }) => Address);
                    }
                } catch (error) {
                    logger.error('Error parsing windowsClusterNodes:', error);
                }
            });

            // Pre-resolve AOAG node IPs to EC2 details ONCE to maximize cache hits
            let aoagIpToInstanceId = new Map<string, string>();
            let aoagIpToInstanceName = new Map<string, string>();
            try {
                const allAoagIps: string[] = uniq(
                    compact(
                        (responseInJson as Array<Record<string, unknown>>)
                            .filter(
                                item =>
                                    (item as any)?.sqlServerDeploymentType ===
                                        SqlServerDeploymentModel.SQL_AOAG_SHORT && Array.isArray((item as any)?.nodeIps)
                            )
                            .flatMap(item => ((item as any).nodeIps as string[]) || [])
                    ) as string[]
                );
                if (allAoagIps.length > 0) {
                    const clusterNodeDetails =
                        (await getInstanceDetailsByPrivateIp(credentialsId, region, allAoagIps, {
                            useCache: true
                        })) || [];
                    const idPairs = clusterNodeDetails
                        .filter(node => node.ec2InstancePrivateIpAddress && node.ec2InstanceId)
                        .map(
                            node =>
                                [node.ec2InstancePrivateIpAddress as string, node.ec2InstanceId as string] as [
                                    string,
                                    string
                                ]
                        );
                    const namePairs = clusterNodeDetails
                        .filter(node => node.ec2InstancePrivateIpAddress && node.ec2InstanceName)
                        .map(
                            node =>
                                [node.ec2InstancePrivateIpAddress as string, node.ec2InstanceName as string] as [
                                    string,
                                    string
                                ]
                        );
                    aoagIpToInstanceId = new Map<string, string>(idPairs);
                    aoagIpToInstanceName = new Map<string, string>(namePairs);
                }
            } catch (e) {
                logger.warn('Failed to pre-resolve AOAG node IPs to EC2 details', e);
            }

            for (const sqlServerInstanceInfo of responseInJson) {
                // If an SQL Server version is unknown, default to 2015, which
                // causes no data to be returned for the SQL Server instance.
                const sqlServerProductYear =
                    SQL_SERVER_VERSION_TO_YEAR.get(sqlServerInstanceInfo?.sqlServerMajorVersion) || 2015;
                if (sqlServerProductYear >= MINIMUM_SQL_SERVER_SUPPORTED) {
                    api1StartTime = performance.now();
                    const storageTypes = [];
                    const deploymentTypes = [];
                    const ebsVolumeIDs = ssmTarget.ebsVolumeIDs?.map(elem => elem?.replace('-', ''));

                    let driveInfo = isEmpty(sqlServerInstanceInfo?.sqlServerInstanceStorageInfo)
                        ? []
                        : JSON.parse(sqlServerInstanceInfo?.sqlServerInstanceStorageInfo);

                    if (!Array.isArray(driveInfo)) {
                        driveInfo = [driveInfo];
                    }

                    for (const di of driveInfo) {
                        let ebsVolumeId = ebsVolumeIDs?.find(elem => di?.SerialNumberOrScsiTarget?.includes(elem));
                        const volIdRegex = /^(vol)([a-zA-Z0-9]+)/; // volumeId derived from SerialNumberOrScsiTarget is of the format,vol012ab34ed, but, AWS ebs volume IDs are always in vol-012ab34ed format, so we need to convert it to the correct format.
                        if (ebsVolumeId) {
                            ebsVolumeId = volIdRegex.test(ebsVolumeId)
                                ? ebsVolumeId.replace(volIdRegex, '$1-$2')
                                : ebsVolumeId;
                            storageTypes.push({
                                type: STORAGE_TYPE.EBS,
                                id: ebsVolumeId
                            });
                            const ebsAvailabilityZone = ebsVolumeToAvailabilityZoneMap.get(ebsVolumeId);
                            deploymentTypes.push({
                                ...(ebsAvailabilityZone && {
                                    zones: [ebsAvailabilityZone],
                                    type: SINGLE_AZ,
                                    storageType: STORAGE_TYPE.EBS
                                })
                            });
                        } else if (endPointIpWithFsxInfo.has(di?.SerialNumberOrScsiTarget)) {
                            const { fsxId, svmId } = endPointIpWithFsxInfo.get(di?.SerialNumberOrScsiTarget)!;

                            const { deploymentType, subnetIds, fileSystemStorageType, fileSystemName } =
                                fsIdWithFsxInfo.get(fsxId!) || {};

                            storageTypes.push({
                                type: STORAGE_TYPE.FSXN,
                                id: fsxId!,
                                svmId,
                                protocol: STORAGE_PROTOCOLS.ISCSI,
                                fileSystemStorageType,
                                fileSystemName
                            });

                            deploymentTypes.push({
                                type: deploymentType,
                                zones: compact(subnetIds?.map(subnetId => subnetListMap.get(subnetId))),
                                ids: subnetIds?.join(),
                                storageType: STORAGE_TYPE.FSXN
                            });
                        } else {
                            // SMB shares
                            //
                            // IF FSxW,
                            // Match get-smbmapping with FSxW (RemoteAdministrationEndpoint and PreferredFileServerIp)
                            // let fsxEndpoints = ['ip', 'fsxid]
                            // SerialNumberOrScsiTarget = ['ip', 'fsxid']
                            //
                            // If FSxN over SMB, Match get-smbmapping with SVM ip/fqdn

                            const fsxEndpoints = Array.from(endPointIpWithFsxInfo.keys());
                            const targets = di?.SmbSharePath ? di.SmbSharePath.toLowerCase() : '';
                            const matchedEndpoint = fsxEndpoints.find(value => targets.includes(value.toLowerCase()));

                            if (matchedEndpoint) {
                                const {
                                    type: fsxType,
                                    fsxId,
                                    svmId
                                } = endPointIpWithFsxInfo.get(matchedEndpoint) || {};
                                const { fileSystemStorageType, fileSystemName } = fsIdWithFsxInfo.get(fsxId!) || {};
                                if (fsxType === FileSystemType.WINDOWS) {
                                    storageTypes.push({
                                        type: STORAGE_TYPE.FSXW,
                                        id: fsxId,
                                        protocol: STORAGE_PROTOCOLS.SMB,
                                        fileSystemStorageType,
                                        fileSystemName
                                    });
                                } else {
                                    storageTypes.push({
                                        type: STORAGE_TYPE.FSXN,
                                        id: fsxId,
                                        svmId,
                                        protocol: STORAGE_PROTOCOLS.SMB,
                                        fileSystemStorageType,
                                        fileSystemName
                                    });
                                }

                                const { deploymentType, subnetIds } = fsIdWithFsxInfo.get(fsxId!) || {};
                                deploymentTypes.push({
                                    type: deploymentType,
                                    zones: compact(subnetIds?.map(subnetId => subnetListMap.get(subnetId))),
                                    ids: subnetIds?.join(),
                                    storageType: fileSystemStorageType
                                });
                            }
                        }
                    }

                    api1EndTime = performance.now();
                    logger.info(
                        `API1Performance: Time taken to parse PowerShell script output: ${
                            api1EndTime - api1StartTime
                        }ms`
                    );

                    let {
                        sqlServerVersion,
                        sqlServerName,
                        sqlServerEngineEdition,
                        sqlServerEdition,
                        serverGuid,
                        sqlServerNodes,
                        nodeIps,
                        sqlServerInstance,
                        sqlServerState,
                        isDefaultInstance,
                        windowsAuthentication,
                        sqlServerAuthentication,
                        windowsDomainUserAuthentication,
                        scriptExecutionTime,
                        databaseCount,
                        failureInfo,
                        sqlServerDeploymentType,
                        baseDeploymentType,
                        windowsOsVersion,
                        windowsClusterName,
                        windowsClusterNodes,
                        sqlPermissions,
                        availablePsModules,
                        isSqlCmdAvailable,
                        aoagDetails,
                        fciOwnerNodes
                    } = sqlServerInstanceInfo;
                    logger.info(
                        `API1Performance: Time taken to execute PowerShell script for instance ${sqlServerInstance}: ${scriptExecutionTime}ms`
                    );

                    if (!Array.isArray(sqlServerNodes)) {
                        sqlServerNodes = [sqlServerNodes];
                    }

                    const featureReadiness = Object.entries(FEATURE_PREPREQUISITES).reduce((acc, [key, value]) => {
                        acc[key.toLowerCase()] = {
                            missingSqlPermissions:
                                // If SQL Server is stopped, we cannot check permissions. In FCI case instance will be down on standby node
                                sqlServerState === 'Stopped'
                                    ? []
                                    : isEmpty(sqlPermissions)
                                    ? value.SQL_PERMISSIONS
                                    : value.SQL_PERMISSIONS.filter(x => !sqlPermissions.includes(x)),

                            missingModules: isEmpty(availablePsModules)
                                ? value.MODULES
                                : value.MODULES.filter(x => !availablePsModules.includes(x))
                        };
                        return acc;
                    }, {} as Record<string, { missingSqlPermissions: string[]; missingModules: string[] }>);

                    const manageReadiness = {
                        missingSqlCmd: !isSqlCmdAvailable,
                        ...featureReadiness
                    };

                    // VIEW ANY DEFINITION and VIEW SERVER STATE are minimum prerequisites for all
                    // management operations. If either is missing, the Windows login connected but
                    // lacks sufficient permissions, so Windows authentication should not be considered available.
                    if (
                        windowsAuthentication &&
                        Object.values(featureReadiness).some(
                            r =>
                                r.missingSqlPermissions.includes('VIEW ANY DEFINITION') ||
                                r.missingSqlPermissions.includes('VIEW SERVER STATE')
                        )
                    ) {
                        windowsAuthentication = false;
                    }

                    // Build AOAG node→EC2 mapping when applicable (use pre-fetched maps)
                    let aoagClusterNodeDetails:
                        | Array<{ node?: string; ip?: string; ec2InstanceId?: string; ec2InstanceName?: string }>
                        | undefined;
                    if (
                        sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT &&
                        Array.isArray(nodeIps) &&
                        nodeIps.length
                    ) {
                        try {
                            const clusterNodes = isArray(windowsClusterNodes) ? windowsClusterNodes : [];

                            // For FCI+AOAG: aoagClusterNodeDetails.node should be the FCI virtual names (replica names)
                            let aoagDetailsForMapping = aoagDetails;
                            if (isArray(aoagDetails)) {
                                aoagDetailsForMapping =
                                    aoagDetails.find((item: any) => item && typeof item === 'object') || {};
                            }
                            // Extract unique replica names from all availability groups
                            const replicaNames = new Set<string>();
                            if (aoagDetailsForMapping?.availabilityGroups) {
                                aoagDetailsForMapping.availabilityGroups.forEach((ag: any) => {
                                    ag.replicas?.forEach((replica: any) => {
                                        if (replica.replica) {
                                            replicaNames.add(replica.replica);
                                        }
                                    });
                                });
                            }

                            // Build aoagClusterNodeDetails from replica names
                            // For both FCI and Standalone AOAG with named instances,
                            // replica name format can be "HOSTNAME\INSTANCENAME" or just "HOSTNAME"
                            aoagClusterNodeDetails = [];

                            // Build a map of hostname (lowercase) -> cluster node for efficient lookup
                            const hostnameToClusterNode = new Map<string, any>();
                            clusterNodes.forEach((cn: any) => {
                                if (cn?.Node) {
                                    hostnameToClusterNode.set(cn.Node.toLowerCase(), cn);
                                }
                            });

                            replicaNames.forEach(replicaName => {
                                // For named instances, replica name format is "HOSTNAME\INSTANCENAME" or "FCINAME\INSTANCENAME"
                                // Extract just the hostname/FCI name for Windows Cluster node lookup
                                const hostnameForLookup = replicaName.includes('\\')
                                    ? replicaName.split('\\')[0].toLowerCase()
                                    : replicaName.toLowerCase();

                                // Find matching cluster node by hostname
                                let matchingClusterNode = hostnameToClusterNode.get(hostnameForLookup);

                                // For FCI AOAG: replica names are FCI virtual names (e.g., XFCI012)
                                // which won't match physical cluster node names (e.g., XFCI1, XFCI2)
                                // Use fciOwnerNodes (FCI virtual name → active physical node) for accurate mapping
                                if (!matchingClusterNode && baseDeploymentType === 'FCI') {
                                    const fciOwnerNodeMap =
                                        fciOwnerNodes &&
                                        typeof fciOwnerNodes === 'object' &&
                                        !Array.isArray(fciOwnerNodes)
                                            ? (fciOwnerNodes as unknown as Record<string, string>)
                                            : {};

                                    const replicaHost = replicaName.includes('\\')
                                        ? replicaName.split('\\')[0]
                                        : replicaName;

                                    // Look up active physical node for this FCI (case-insensitive)
                                    const activeNode = Object.entries(fciOwnerNodeMap).find(
                                        ([fciName]) => fciName.toLowerCase() === replicaHost.toLowerCase()
                                    )?.[1] as string | undefined;

                                    if (activeNode) {
                                        matchingClusterNode = hostnameToClusterNode.get(activeNode.toLowerCase());
                                    }
                                }

                                if (
                                    matchingClusterNode?.Address &&
                                    aoagIpToInstanceId.has(matchingClusterNode.Address)
                                ) {
                                    const nodeIp = matchingClusterNode.Address;
                                    aoagClusterNodeDetails!.push({
                                        node: replicaName,
                                        ip: nodeIp,
                                        ec2InstanceId: aoagIpToInstanceId.get(nodeIp),
                                        ec2InstanceName: aoagIpToInstanceName.get(nodeIp)
                                    });
                                } else {
                                    // Fallback: add replica without EC2 mapping
                                    aoagClusterNodeDetails!.push({
                                        node: replicaName
                                    });
                                }
                            });

                            // If no replicas found but we have cluster nodes, use them as fallback
                            if (aoagClusterNodeDetails.length === 0 && clusterNodes.length > 0) {
                                aoagClusterNodeDetails = clusterNodes.map((node: any) => ({
                                    node: node?.Node,
                                    ip: node?.Address,
                                    ec2InstanceId: node?.Address ? aoagIpToInstanceId.get(node.Address) : undefined,
                                    ec2InstanceName: node?.Address ? aoagIpToInstanceName.get(node.Address) : undefined
                                }));
                            }
                        } catch (e) {
                            logger.warn('Failed to build aoagClusterNodeDetails', e);
                        }
                    }

                    let processedAoagDetails = aoagDetails;
                    if (sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT && aoagDetails) {
                        // Handle case where aoagDetails is an array (from PowerShell JSON serialization)
                        let aoagDetailsObj = aoagDetails;
                        if (isArray(aoagDetails)) {
                            aoagDetailsObj = aoagDetails.find((item: any) => item && typeof item === 'object') || {};
                        }
                        processedAoagDetails = { ...aoagDetailsObj };

                        if (baseDeploymentType) {
                            processedAoagDetails.baseDeploymentType = baseDeploymentType;
                        }

                        if (processedAoagDetails.serverInfo) {
                            let serverInfoObj = processedAoagDetails.serverInfo;
                            if (typeof serverInfoObj === 'string') {
                                try {
                                    serverInfoObj = JSON.parse(serverInfoObj);
                                } catch {
                                    serverInfoObj = {};
                                }
                            }
                            const { serverName, isHadrEnabled } = serverInfoObj;
                            processedAoagDetails.serverInfo = {
                                ...(serverName && { serverName }),
                                ...(isHadrEnabled !== undefined && { isHadrEnabled })
                            };
                        }

                        // Normalize role field for replicas missing it (common when queried from secondary)
                        // When querying from SECONDARY, remote replicas don't have role_desc from DMV
                        // We derive role from primaryReplica: if replica matches primaryReplica -> PRIMARY, else SECONDARY
                        if (
                            processedAoagDetails.availabilityGroups &&
                            isArray(processedAoagDetails.availabilityGroups)
                        ) {
                            // Filter out AGs with null/empty agName (broken AOAG query results)
                            processedAoagDetails.availabilityGroups = processedAoagDetails.availabilityGroups
                                .filter((ag: any) => ag.agName)
                                .map((ag: any) => {
                                    const { primaryReplica, replicas, ...restAg } = ag;
                                    if (replicas && isArray(replicas)) {
                                        const normalizedReplicas = replicas
                                            .filter((r: any) => r.replica)
                                            .map((replica: any) => {
                                                const { role, replica: replicaName, ...restReplica } = replica;
                                                return {
                                                    replica: replicaName,
                                                    // Derive role if missing: PRIMARY if matches primaryReplica, else SECONDARY
                                                    role:
                                                        role ||
                                                        (replicaName === primaryReplica
                                                            ? AOAG_ROLE_PRIMARY
                                                            : AOAG_ROLE_SECONDARY),
                                                    ...restReplica
                                                };
                                            });
                                        return { ...restAg, primaryReplica, replicas: normalizedReplicas };
                                    }
                                    return ag;
                                });
                            // If all AGs were filtered out, discard aoagDetails entirely
                            if (processedAoagDetails.availabilityGroups.length === 0) {
                                processedAoagDetails = undefined;
                            }
                        }
                    }

                    ssmTargetSqlServerInstancesInfo.push({
                        sqlServerVersion,
                        ...(sqlServerName && { sqlServerName }),
                        sqlServerNodes: compact(sqlServerNodes),
                        nodeIps: compact(nodeIps),
                        sqlServerDeploymentType,
                        sqlServerInstance,
                        sqlServerState,
                        sqlServerProductYear,
                        ...(sqlServerEngineEdition && { sqlServerEngineEdition: Number(sqlServerEngineEdition) }),
                        ...(sqlServerEdition && { sqlServerEdition }),
                        ...(serverGuid && { serverGuid }),
                        isDefaultInstance,
                        ...(failureInfo && { failureInfo }),
                        windowsAuthentication,
                        windowsOsVersion:
                            windowsOsVersion.match(/(Microsoft Windows Server \d+)/)[1] || windowsOsVersion,
                        sqlServerAuthentication,
                        windowsDomainUserAuthentication,
                        storage: compact(uniqBy(storageTypes, v => [v.id, v.svmId, v.protocol].join())),
                        deploymentTypes: compact(
                            uniqBy(deploymentTypes, 'ids').map(({ type, zones, storageType }) => ({
                                type,
                                zones,
                                storageType
                            }))
                        ),
                        ...(databaseCount && { databaseCount }),
                        ...(windowsClusterName && { windowsClusterName }),
                        ...(windowsClusterNodes && { windowsClusterNodes }),
                        ...(manageReadiness && { manageReadiness }),
                        ...(sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT &&
                            processedAoagDetails && { aoagDetails: processedAoagDetails }),
                        ...(sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT &&
                            aoagClusterNodeDetails &&
                            aoagClusterNodeDetails.length && { aoagClusterNodeDetails })
                    });
                }
            }
        }
    } catch (error) {
        logger.error(
            `Failed to process the SQL Server instance details for host ${ssmTarget.ec2InstanceId}. Reason: ${error}.`
        );
    }

    return ssmTargetSqlServerInstancesInfo;
}

async function makeSsmCall(
    credentialsId: string,
    region: string,
    commands: string[],
    targets: string[],
    accountId: string
): Promise<string | undefined> {
    logger.info('Discovery makeSsmCall():', credentialsId, region, targets, accountId);

    let params: SendCommandCommandInput = {
        DocumentName: SSM_RUN_POWERSHELL_SCRIPT_DOC,
        DocumentVersion: SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION,
        Targets: [
            {
                Key: 'InstanceIds',
                Values: targets
            }
        ],
        Parameters: {
            executionTimeout: [config.get<string>('ssm.execution-timeout')],
            commands
        },
        Comment: 'Discover SQL Server instances',
        CloudWatchOutputConfig: {
            CloudWatchLogGroupName: CLOUDWATCH_LOG_GROUP_FOR_SSM_RESPONSE,
            CloudWatchOutputEnabled: true
        }
    };

    params = compressSsmCommand(params);

    let commandId;
    try {
        commandId = await sendSSMCommand(credentialsId, region, params, accountId);
        logger.info(`SSM command ID is ${commandId} for discovery call`);
    } catch (error) {
        logger.error(`Failed to start EC2 instance information retrieval using sendSSMCommand. Reason: ${error}`);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Failed to start information retrieval from EC2 instances. Reason: ${error}`
        );
    }
    return commandId;
}

async function fetchUnmanagedHostsInformationV2(
    accountId: string,
    credentialsId: string,
    region: string,
    instances: string[] = [],
    fields?: string
) {
    logger.info('Fetching unmanaged hosts information:', { accountId, credentialsId, region, instances, fields });

    // Modified implementation to fetch SQL Server instance details for EC2 instances with underlying storage details. The code now accepts instances ID array instead of object with ec2InstanceId and storageType. If there are multiple sql instances in an ec2 instance, the code will return multiple resource details for the same ec2 instance. Every item in resourceDetailsList is an ec2 instance - sql instance pair with storage type.

    const { items: ec2HostDetails } = await getHostAndSqlServerInfo(
        accountId,
        credentialsId,
        region,
        undefined,
        undefined,
        instances
    );
    const resourceDetailsList: ResourceDetails[] = [];

    const errorInstances: DatabaseHostSummaryForMultiInstanceResponseType[] = [];

    await Promise.all(
        ec2HostDetails?.map(async ec2Instance => {
            const [{ nodeIps, sqlServerDeploymentType }] = ec2Instance?.sqlServerInstances || [{}];
            let clusterNodeDetails: NodeDetails[] = [];
            if (
                (sqlServerDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT ||
                    sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT) &&
                nodeIps
            ) {
                clusterNodeDetails =
                    (await getInstanceDetailsByPrivateIp(credentialsId, region, nodeIps, { useCache: true })) || [];
            }
            const resourceDetails: ResourceDetails = {
                id: null,
                account_id: accountId,
                resource_id: ec2Instance.ec2InstanceId,
                resource_type: RESOURCESTYPE.MSSQL,
                resource_name: ec2Instance.ec2InstanceName || ec2Instance.ec2InstanceId,
                cloud_provider_name: CloudProviders.AWS,
                cloud_provider_account_id: null,
                region,
                credentials_id: credentialsId,
                metadata: {
                    creationDate: Date.now(),
                    node1InstanceId: ec2Instance.ec2InstanceId
                },
                clusterNodeDetails,
                database_instances: [],
                co_relation_id: null,
                ebsVolumeIds: [],
                ec2UsageOperation: ec2Instance.ec2UsageOperation
            };
            const clonedResourceDetails = cloneDeep(resourceDetails);

            if (ec2Instance?.sqlServerInstances && ec2Instance?.sqlServerInstances.length > 0) {
                ec2Instance?.sqlServerInstances?.forEach(sqlServerInstance => {
                    // skipping this loop as we are only considering the first running sql instance in the ec2 instance. This needs to be enabled when we support multiple sql instances in an ec2 instance.
                    const { storage } = sqlServerInstance;
                    let ebsVolumeIds: string[] | undefined = [];
                    let fsxwId: string | undefined;
                    let fsxnId: string | undefined;
                    let fsxSvmId: string | undefined;
                    storage?.forEach(({ type, id, svmId }) => {
                        // if there are multiple entries in storage for the same type then only the last entry will be considered. For eg: if the same sql instance has fsxn-1 and fsxn-2, then only fsxn-2 will be considered. Such a scenario occurs when system dbs use one storage and user dbs use another storage. The reason for this limitation currently is wlmdb resources are not expecting multiple co-relation ids for the same resource.
                        // If the storage is of different type, then both will be considered while calculating protection and storage savings details.
                        ebsVolumeIds = type === STORAGE_TYPE.EBS ? ebsVolumeIds?.concat(id) : ebsVolumeIds;
                        fsxwId = type === STORAGE_TYPE.FSXW ? id : fsxwId;
                        if (type === STORAGE_TYPE.FSXN) {
                            ({ id: fsxnId, svmId: fsxSvmId } = { id, svmId });
                        }
                    });

                    resourceDetails.ebsVolumeIds = resourceDetails.ebsVolumeIds?.concat(ebsVolumeIds);

                    resourceDetails.database_instances?.push({
                        database_instance_id: sqlServerInstance.serverGuid || '',
                        database_instance_name: sqlServerInstance.sqlServerInstance,
                        database_type: RESOURCESTYPE.MSSQL,
                        is_default: sqlServerInstance.isDefaultInstance,
                        instanceState: sqlServerInstance.sqlServerState,
                        region,
                        credentials_id: credentialsId,
                        metadata: { userDatabase: [] },
                        fsxn_ids: fsxnId || '',
                        fsx_svm_id: fsxSvmId || '',
                        fsxwId: fsxwId || '',
                        ebsVolumeIds,
                        database_deployment_type: sqlServerInstance.sqlServerDeploymentType,
                        storage_type: fsxnId
                            ? STORAGE_TYPE.FSXN
                            : fsxwId
                            ? STORAGE_TYPE.FSXW
                            : ebsVolumeIds.length > 0
                            ? STORAGE_TYPE.EBS
                            : NOT_AVAILABLE,
                        resource: clonedResourceDetails
                    });
                });
                resourceDetailsList.push(resourceDetails);
            } else {
                errorInstances.push({
                    id: ec2Instance.ec2InstanceId,
                    name: ec2Instance.ec2InstanceId,
                    databaseHostStatus: OFFLINE,
                    errors: 'No active SQL Server instances found',
                    ssmStatus: ''
                });
            }
        })
    );

    let response = await Promise.all(
        resourceDetailsList.map(async resourceDetail =>
            getDatabaseHostSummaryV2(
                accountId,
                resourceDetail.resource_id,
                credentialsId,
                region,
                fields ||
                    'serverDetails,nodeTopology,performance,usageEstimation,storage,protection,instanceDetails,databaseInstanceTopology',
                resourceDetail,
                undefined,
                false // unmanaged host,
            )
        )
    );

    if (IS_DEMO_FLOW && instances.some(id => DEMO_ENTERPRISE_INSTANCES.includes(id))) {
        // In demo flow update the sql edition for specific instance
        response = response.map(item => {
            if (item?.databaseInstancesSummary) {
                item.databaseInstancesSummary = item.databaseInstancesSummary.map(instance => {
                    if (instance?.databaseServer) {
                        instance.databaseServer.serverEdition = 'Enterprise Edition (64-bit)';
                    }
                    return instance;
                });
            }
            return item;
        });
    }

    if (errorInstances.length > 0) {
        response = response.concat(errorInstances);
    }
    return {
        count: response.length,
        items: response
    };
}

async function prepareForManage(accountId: string, credentialsId: string, region: string, ec2InstanceId: string) {
    logger.info('Prepare given EC2 for manage by Workload Factory:', {
        accountId,
        credentialsId,
        region,
        ec2InstanceId
    });

    const ssmState = await getSSMConnectionStatus(credentialsId, region, ec2InstanceId);
    if (ssmState.Status === ConnectionStatus.NOT_CONNECTED) {
        throw createError(
            HttpErrorCodes.SERVICE_UNAVAILABLE,
            `Unable to prepare instance '${ec2InstanceId}' for management. Reason: no SSM connectivity.`
        );
    }

    const hostname = await callSsmExecution({
        credentialsId,
        region,
        commands: ['hostname'],
        ec2InstanceId,
        comment: 'Get hostname',
        accountId
    });
    const hostnameMessage: string = isEmpty(hostname) ? '' : `with hostname '${hostname?.trim()}' `;

    // Check if any job is already running for the same purpose.
    const jobFilterParams = {
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: ec2InstanceId,
        typeFilter: JOBTYPE.PREPARE_RESOURCE,
        credentialsId,
        region
    };
    const {
        items: [job]
    } = await getJobs(accountId, jobFilterParams);
    if (job) {
        const timeDifferenceInMilliseconds = Math.abs(Date.now() - job.startTime);
        const timeDifferenceInMinutes = Math.floor(timeDifferenceInMilliseconds / (1000 * 60));

        // As of now, PowerShell module installation is finishing
        // in about 8-10 minutes.  Let's wait for double that time
        // to accomodate busy systems.
        if (timeDifferenceInMinutes <= PREPARE_EC2_RERUN_DURATION) {
            throw createError(
                HttpErrorCodes.CONFLICT,
                `Preparation of ${ec2InstanceId} for management by Workload Factory is already in progress with job ID ${job.id}.`
            );
        }
    }

    // Create the parent job for EC2 preparation
    const { id: parentJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.PREPARE_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: ec2InstanceId,
        name: `Prepare EC2 '${ec2InstanceId}' ${hostnameMessage}for management`,
        startTime: Date.now(),
        description: `Prepare EC2 '${ec2InstanceId}' ${hostnameMessage}for management by Workload Factory database operations`
    });

    performPrepareTasks(accountId, credentialsId, region, ec2InstanceId, parentJobId);

    return parentJobId;
}

async function performPrepareTasks(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    parentJobId: string
) {
    logger.info('Perform tasks to prepare EC2 for management: ', {
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        parentJobId
    });

    const psResponse = await preparePsModulesForManage(accountId, credentialsId, region, ec2InstanceId, parentJobId);

    await updateJobDetails(accountId, parentJobId, {
        status: psResponse,
        endTime: Date.now()
    });
}

async function prepareDbScriptsForManage(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    parentJobId: string
) {
    logger.info(`Prepare database scripts for managing ${ec2InstanceId}`, {
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        parentJobId
    });

    let jobStatusRecord: UpdateJobRecordType;

    const { id: childJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.PREPARE_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: ec2InstanceId,
        name: 'Copy artifacts for database operations.',
        parentJobId,
        description: 'Copy artifacts required for Workload Factory database operations.',
        startTime: Date.now()
    });

    try {
        const copyScriptResponse = await copyScriptsToHost(accountId, credentialsId, region, ec2InstanceId);

        logger.debug(`Response for copy scripts using PowerShell for ${ec2InstanceId}: ${copyScriptResponse}`);

        if (copyScriptResponse?.includes('failureInfo')) {
            const responseInJson = JSON.parse(copyScriptResponse);
            logger.error(
                `Unable to prepare instance '${ec2InstanceId}'. Reason: failed to copy database operation artifacts. Error: ${copyScriptResponse}`
            );

            jobStatusRecord = {
                status: JOBSTATUS.FAILED,
                endTime: Date.now(),
                error: responseInJson.failureInfo
            };
        } else {
            jobStatusRecord = {
                status: JOBSTATUS.COMPLETED,
                endTime: Date.now()
            };
        }
    } catch (errorInfo: any) {
        logger.error('SSM execution failed while copying database artifacts. Reason: ', errorInfo.message);
        jobStatusRecord = {
            status: JOBSTATUS.FAILED,
            endTime: Date.now(),
            error: errorInfo.message as string
        };
    }
    await updateJobDetails(accountId, childJobId, jobStatusRecord);

    return jobStatusRecord.status;
}

async function preparePsModulesForManage(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    parentJobId: string
) {
    logger.info(`Prepare database scripts for managing ${ec2InstanceId}`, {
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        parentJobId
    });

    let jobStatusRecord: UpdateJobRecordType;

    const { id: childJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.PREPARE_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: ec2InstanceId,
        name: 'Install PowerShell modules',
        parentJobId,
        description: 'Install PowerShell modules required for Workload Factory database operations',
        startTime: Date.now()
    });

    try {
        // Get signed url for dependent-packages.zip to install the ps modules
        const artifactsRegion = getArtifactsBucketRegion(region);
        const bucketname = getArtifactsRegionBucketName(region);
        const copyPSModuleS3SignedUrl = await getPreSignedUrl(
            artifactsRegion,
            bucketname,
            PREPARE_PSMODULES_RELATIVE_PATH
        );

        const ssmPsModuleInstallResponse = await retryWithDelay(
            callSsmExecution.bind(null, {
                credentialsId,
                region,
                commands: INSTALL_WF_POWERSHELL_PREREQS_PS1(
                    REQUIRED_PS_MODULES_FOR_MANAGEMENT,
                    copyPSModuleS3SignedUrl
                ),
                ec2InstanceId,
                comment: 'Install PowerShell modules',
                accountId,
                executionTimeout: (RESOURCE_PREPARE_JOB_TIMEOUT_MINUTES * 60).toString()
            })
        );
        logger.debug(`Response for PowerShell module installation for ${ec2InstanceId}: ${ssmPsModuleInstallResponse}`);

        if (ssmPsModuleInstallResponse?.includes(FAILURE_INFO)) {
            const responseInJson = JSON.parse(ssmPsModuleInstallResponse);
            const failureInfo = responseInJson[FAILURE_INFO];
            logger.error(
                `Unable to prepare instance '${ec2InstanceId}. Reason: Failed to install PowerShell modules. Error: ${failureInfo}`
            );

            jobStatusRecord = {
                status: JOBSTATUS.FAILED,
                endTime: Date.now(),
                error: failureInfo
            };
        } else {
            jobStatusRecord = {
                status: JOBSTATUS.COMPLETED,
                endTime: Date.now()
            };
        }
    } catch (errorInfo: any) {
        logger.error('SSM execution failed while installing PowerShell modules. Reason: ', errorInfo.message);
        jobStatusRecord = {
            status: JOBSTATUS.FAILED,
            endTime: Date.now(),
            error: errorInfo.message as string
        };
    }

    await updateJobDetails(accountId, childJobId, jobStatusRecord);

    return jobStatusRecord.status;
}

async function discoverEc2Instances(
    accountId: string,
    credentialsId: string,
    region: string,
    filters: Filter[] = [],
    pageSize?: number,
    nextToken?: string,
    ec2InstanceIds: string[] = [],
    discoveryDbType: DatabaseTypes = DatabaseTypes.MS_SQL_SERVER
) {
    logger.info('Discover EC2 resources', { accountId, credentialsId, region, pageSize, nextToken });

    const describeInstanceParams: DescribeInstancesCommandInput = {
        Filters: [
            { Name: 'architecture', Values: ['x86_64'] },
            { Name: 'instance-state-name', Values: [InstanceStateName.running] }
        ]
    };

    if (filters.length) {
        describeInstanceParams.Filters?.push(...filters);
    }

    // For use cases, where info for specific EC2s is needed
    if (ec2InstanceIds.length > 0) {
        describeInstanceParams.Filters?.push({ Name: 'instance-id', Values: ec2InstanceIds });
    }

    const [[reservations, NextToken], vpcs] = await Promise.all([
        describeInstancesWithPagination(credentialsId, region, describeInstanceParams, pageSize, nextToken, {
            useCache: true
        }),
        paginatedDescribeVpcs(credentialsId, region, {}, { useCache: true })
    ]);

    const vpcNames = new Map(vpcs?.map(({ Tags, VpcId }: Vpc) => [VpcId, getResourceNameFromTags(Tags)]));
    const vpcCidrs = new Map(vpcs?.map(({ CidrBlock, VpcId }: Vpc) => [VpcId, CidrBlock]));

    const ec2InstanceList = compact(
        Array.isArray(reservations) ? reservations.flatMap(reservation => reservation.Instances) : []
    );

    if (!ec2InstanceList.length) {
        return { ec2Instances: [], NextToken };
    }

    const ssmConnectionMap = await getSSMConnectionStatusByInstanceIds(
        credentialsId,
        region,
        compact(ec2InstanceList.map(({ InstanceId }) => InstanceId))
    );

    let ec2Instances = ec2InstanceList?.map(ec2Instance => {
        const name = getEc2Hostname(discoveryDbType, ec2Instance?.Tags);
        return {
            ec2InstanceId: IS_DEMO_FLOW ? `i-${randomize('0', 8)}` : ec2Instance?.InstanceId || '',
            ec2InstanceType: ec2Instance?.InstanceType || '',
            ec2InstanceName: name || '',
            ...(ec2Instance?.PrivateIpAddress ? { ec2InstancePrivateIpAddress: ec2Instance.PrivateIpAddress } : {}),
            ec2HostName: ec2Instance?.PrivateDnsName || '',
            ec2UsageOperation: ec2Instance?.UsageOperation || '',
            ssmState: ssmConnectionMap.get(ec2Instance?.InstanceId) || ConnectionStatus.NOT_CONNECTED,
            ebsVolumeIDs: ec2Instance?.BlockDeviceMappings?.map(bdm => bdm?.Ebs?.VolumeId),
            ebsVolumes: ec2Instance?.BlockDeviceMappings,
            vpc: {
                ...(ec2Instance?.VpcId && { id: ec2Instance?.VpcId }),
                ...(vpcNames.has(ec2Instance?.VpcId) && { name: vpcNames.get(ec2Instance?.VpcId) }),
                ...(vpcCidrs.has(ec2Instance?.VpcId) && { cidrBlock: vpcCidrs.get(ec2Instance?.VpcId) })
            },
            error: undefined,
            platform: ec2Instance?.PlatformDetails || ''
        };
    });

    if (IS_DEMO_FLOW) {
        ec2Instances = ec2Instances.filter(
            ec2InstanceDetails => ec2InstanceDetails.ssmState === ConnectionStatus.CONNECTED
        );
    }
    return { ec2Instances, NextToken };
}

async function discoverPgSqlResources(
    accountId: string,
    credentialsId: string,
    region: string,
    pageSize?: number,
    nextToken?: string,
    ec2InstanceIds: string[] = []
): Promise<DiscoverPgSqlResponseBodyType> {
    logger.info('Discover PostgreSQL resources', {
        accountId,
        credentialsId,
        region,
        pageSize,
        nextToken,
        ec2InstanceIds
    });

    const al2023ImageIdList = compact(await getAmazonLinux2023AmiList(credentialsId, region));

    const filters = [
        { Name: 'platform-details', Values: ['Linux/UNIX'] },
        ...(!isEmpty(al2023ImageIdList) ? [{ Name: 'image-id', Values: al2023ImageIdList }] : [])
    ];
    const { ec2Instances, NextToken } = await discoverEc2Instances(
        accountId,
        credentialsId,
        region,
        filters,
        pageSize,
        nextToken,
        ec2InstanceIds,
        DatabaseTypes.PG_SQL
    );

    logger.debug('Discovered PostgreSQL resources', { ec2Instances, NextToken });

    const ssmNotConnectedEc2Instances: DiscoveredEc2InstanceType[] = ec2Instances.filter(
        ({ ssmState }) => ssmState === ConnectionStatus.NOT_CONNECTED
    );
    const ssmConnectedEc2Instances = ec2Instances.filter(
        ({ ssmState }) => ssmState === ConnectionStatus.CONNECTED
    ) as DiscoveredEc2InstanceType[];

    const ssmCommandInput: SendCommandCommandInput = {
        DocumentName: SSM_RUN_SHELL_SCRIPT_DOC,
        InstanceIds: compact(ssmConnectedEc2Instances.map(target => target?.ec2InstanceId)),
        Comment: 'Discover PostgreSQL resources',
        Parameters: {
            commands: [discoverPgsqlHosts],
            executionTimeout: [config.get<string>('ssm.execution-timeout')]
        }
    };

    let instancesWithSsmResponse: DiscoverPgSqlResponseType[] = [];

    try {
        const {
            ssmResponseMap,
            endPointIpWithFsxInfo,
            fsIdWithFsxInfo,
            subnetListMap,
            ebsVolumeToAvailabilityZoneMap
        } = await fetchFsxResourceMappings(
            accountId,
            credentialsId,
            region,
            ssmCommandInput,
            ssmConnectedEc2Instances,
            pageSize
        );

        instancesWithSsmResponse = compact(
            await Promise.all(
                ssmConnectedEc2Instances.map(async ec2Instance => {
                    const ssmResponse = ssmResponseMap.get(ec2Instance.ec2InstanceId);
                    const output = ssmResponse?.output;
                    const error = ssmResponse?.error;
                    if (error) {
                        return {
                            ...ec2Instance,
                            error
                        };
                    }

                    let parsedResponse;
                    try {
                        parsedResponse = sqlResponseParsing(output || '{}');
                        const {
                            version,
                            nfs_ip_address: nfsIpAddress,
                            ebs_volume: ebsVolume,
                            status,
                            hostname,
                            nfs_mount_point: nfsMountPoint,
                            postgres_server: pgSqlServer,
                            database_count: databaseCount,
                            deployment_type: deploymentType,
                            replica_info: replicaInfo,
                            replica_type: replicaType,
                            primary_host: primaryHostIp,
                            server_instance_id: serverInstanceId,
                            default_auth: defaultAuth,
                            error: discoverScriptError
                        } = parsedResponse;

                        if (status === NO_PGSQL) {
                            logger.warn('PostgreSQL server not found', {
                                ec2InstanceId: ec2Instance.ec2InstanceId,
                                discoverScriptError
                            });
                            return;
                        }

                        const pgsqlServerInstance: PgSqlServerInstaceType = {
                            pgsqlServerVersion: isValidProp(version) ? version : undefined,
                            pgsqlServerState: isValidProp(status) ? status : undefined,
                            pgsqlServerName: getPgSqlHostName(hostname, pgSqlServer),
                            pgsqlServerDeploymentType: isValidProp(deploymentType) ? deploymentType : undefined,
                            databaseCount: isValidProp(databaseCount) ? databaseCount : 0,
                            pgsqlServerInstanceId: isValidProp(serverInstanceId) ? serverInstanceId : undefined,
                            defaultAuth: isValidProp(defaultAuth) ? !defaultAuth : false,
                            ...(deploymentType === HA && {
                                isPrimary: replicaType === 'primary',
                                primaryNode: await getPrimaryHostDetails(credentialsId, region, primaryHostIp),
                                nodes: await getReplicaNodes(credentialsId, region, replicaInfo, replicaType)
                            })
                        };

                        pgsqlServerInstance.storage = getDiscoveredPgSqlStorageDetails(
                            ec2Instance.ebsVolumes!,
                            endPointIpWithFsxInfo,
                            fsIdWithFsxInfo,
                            subnetListMap,
                            ebsVolumeToAvailabilityZoneMap,
                            nfsIpAddress,
                            ebsVolume,
                            nfsMountPoint
                        );

                        return {
                            ...ec2Instance,
                            pgsqlServerInstances: [pgsqlServerInstance]
                        };
                    } catch (err: unknown) {
                        logger.warn('Failed to parse SSM response', { error: err });
                        ec2Instance.error = err as string;
                        return {
                            ...ec2Instance,
                            error: `Failed to parse SSM response: ${err}`
                        };
                    }
                })
            )
        );
    } catch (error: any) {
        logger.error('Failed to discover PostgreSQL resources', { error: error.message });
    }

    return {
        count: (ssmNotConnectedEc2Instances?.length ?? 0) + (instancesWithSsmResponse?.length ?? 0),
        items: [...ssmNotConnectedEc2Instances, ...instancesWithSsmResponse],
        nextToken: NextToken as string
    };
}

function getDiscoveredPgSqlStorageDetails(
    ebsVolumes: (InstanceBlockDeviceMapping | undefined)[],
    endPointIpWithFsxInfo: Map<string, FSxInfo>,
    fsIdWithFsxInfo: Map<string, FsxServerConfig>,
    subnetListMap: Map<string, string>,
    ebsVolumeToAvailabilityZoneMap: Map<string, string>,
    nfsIpAddress: string,
    ebsVolume: string,
    nfsMountPoint?: string
) {
    logger.debug('getDiscoveredPgSqlStorageDetails', {
        ebsVolumes,
        endPointIpWithFsxInfo,
        fsIdWithFsxInfo,
        subnetListMap,
        ebsVolumeToAvailabilityZoneMap,
        nfsIpAddress,
        ebsVolume,
        nfsMountPoint
    });

    const ebsVolumeId = getEbsVolumeId(ebsVolumes, ebsVolume);
    const storageTypes = [];
    if (ebsVolumeId) {
        const ebsAvailabilityZone = ebsVolumeToAvailabilityZoneMap.get(ebsVolumeId);
        storageTypes.push({
            type: STORAGE_TYPE.EBS,
            id: ebsVolumeId,
            deploymentType: SINGLE_AZ,
            ...(ebsAvailabilityZone && { zone: ebsAvailabilityZone })
        });
    } else if (nfsIpAddress && endPointIpWithFsxInfo.has(nfsIpAddress)) {
        const { fsxId, svmId } = endPointIpWithFsxInfo.get(nfsIpAddress)!;
        const { deploymentType, subnetIds, fileSystemStorageType } = fsIdWithFsxInfo.get(fsxId!) || {};

        storageTypes.push({
            type: STORAGE_TYPE.FSXN,
            id: fsxId!,
            svmId,
            protocol: STORAGE_PROTOCOLS.NFS,
            fileSystemStorageType,
            deploymentType,
            zones: compact(subnetIds?.map((subnetId: string) => subnetListMap.get(subnetId))),
            subnetIdString: subnetIds?.join(),
            nfsMountPoint
        });
    }

    return compact(
        uniqBy(storageTypes, v => [v.id, v.svmId, v.protocol, v.subnetIdString].join()).map(v => {
            const { subnetIdString, ...rest } = v;
            logger.debug('subnet string', subnetIdString);
            return rest;
        })
    );
}

function getEbsVolumeId(ebsVolumeIDs: (InstanceBlockDeviceMapping | undefined)[], ebsVolume: string) {
    logger.debug('getEbsVolumeId', { ebsVolumeIDs, ebsVolume });
    if (isValidProp(ebsVolume)) {
        if (/vol-\w+/.test(ebsVolume)) {
            return ebsVolumeIDs?.find(elem => elem?.Ebs?.VolumeId === ebsVolume)?.Ebs?.VolumeId;
        }
        const ebsVolumeId = ebsVolumeIDs?.find(elem => ebsVolume?.includes(elem?.DeviceName || ''))?.Ebs?.VolumeId;
        if (ebsVolumeId) {
            return ebsVolumeId;
        }
    }
}

async function getPrimaryHostDetails(credentialsId: string, region: string, primaryHostIp: string) {
    logger.info('Get primary host details', { credentialsId, region, primaryHostIp });
    if (isValidProp(primaryHostIp)) {
        const [hostDetails] = await getInstanceDetailsByPrivateIp(credentialsId, region, [primaryHostIp], {
            useCache: true
        });
        return hostDetails;
    }
}

async function getReplicaNodes(
    credentialsId: string,
    region: string,
    replicaInfo: Record<string, string>[],
    replicaType: string
) {
    logger.info('Get replica nodes', { credentialsId, region, replicaInfo, replicaType });
    if (replicaType === 'primary' && isValidProp(replicaInfo as unknown as string)) {
        return getInstanceDetailsByPrivateIp(
            credentialsId,
            region,
            replicaInfo.map((info: Record<string, string>) => info.client_addr),
            { useCache: true }
        );
    }
}

function getPgSqlHostName(hostname: string, pgSqlServer: string) {
    if (isValidProp(pgSqlServer) && (pgSqlServer === 'localhost' || pgSqlServer === '*') && isValidProp(hostname)) {
        return hostname;
    }

    return pgSqlServer;
}

// Get pgsql resource details
async function getPgSqlResourceDetails(
    accountId: string,
    credentialsId: string,
    region: string,
    instancesString: string,
    fields?: string
) {
    logger.info('Get PostgreSQL resource details', { accountId, credentialsId, region, instancesString, fields });
    const instances = Array.isArray(instancesString) ? instancesString : instancesString?.split(',');
    const { items: ec2Instances } = await discoverPgSqlResources(
        accountId,
        credentialsId,
        region,
        undefined,
        undefined,
        instances
    );

    const errorInstances: DatabaseHostSummaryForMultiInstanceResponseType[] = [];

    const resourceDetailsList: ResourceDetails[] = ec2Instances?.map(ec2Instance => {
        const resourceDetails: ResourceDetails = {
            id: null,
            account_id: accountId,
            resource_id: ec2Instance.ec2InstanceId,
            resource_type: RESOURCESTYPE.PGSQL,
            resource_name: ec2Instance.ec2InstanceName || ec2Instance.ec2InstanceId,
            cloud_provider_name: CloudProviders.AWS,
            cloud_provider_account_id: null,
            region,
            credentials_id: credentialsId,
            metadata: {
                creationDate: Date.now(),
                node1InstanceId: ec2Instance.ec2InstanceId
            },
            clusterNodeDetails: ec2Instance?.pgsqlServerInstances?.[0]?.nodes || [],
            database_instances: [],
            co_relation_id: null,
            ebsVolumeIds: [],
            ec2UsageOperation: ec2Instance.ec2UsageOperation
        };
        const clonedResourceDetails = cloneDeep(resourceDetails);

        for (const pgsqlServerInstance of ec2Instance?.pgsqlServerInstances || []) {
            const { storage } = pgsqlServerInstance;
            let ebsVolumeIds: string[] | undefined = [];
            let fsxnId: string | undefined;
            storage?.forEach(({ type, id }: { type: string; id: string }) => {
                // if there are multiple entries in storage for the same type then only the last entry will be considered. For eg: if the same sql instance has fsxn-1 and fsxn-2, then only fsxn-2 will be considered. Such a scenario occurs when system dbs use one storage and user dbs use another storage. The reason for this limitation currently is wlmdb resources are not expecting multiple co-relation ids for the same resource.
                // If the storage is of different type, then both will be considered while calculating protection and storage savings details.
                ebsVolumeIds = type === STORAGE_TYPE.EBS ? ebsVolumeIds?.concat(id) : ebsVolumeIds;
                fsxnId = type === STORAGE_TYPE.FSXN ? id : fsxnId;
            });

            resourceDetails.ebsVolumeIds = resourceDetails.ebsVolumeIds?.concat(ebsVolumeIds);

            resourceDetails.database_instances?.push({
                database_instance_id: pgsqlServerInstance.pgsqlServerInstanceId || '',
                database_instance_name: pgsqlServerInstance.pgsqlServerInstanceName || PGSQL_DEFAULT_INSTANCE_NAME,
                database_type: RESOURCESTYPE.PGSQL,
                is_default: true,
                instanceState: pgsqlServerInstance.pgsqlServerState,
                region,
                credentials_id: credentialsId,
                metadata: { userDatabase: [] },
                fsxn_ids: fsxnId || '',
                ebsVolumeIds,
                database_deployment_type: pgsqlServerInstance.pgsqlServerDeploymentType,
                storage_type: fsxnId ? STORAGE_TYPE.FSXN : ebsVolumeIds.length > 0 ? STORAGE_TYPE.EBS : NOT_AVAILABLE,
                resource: clonedResourceDetails
            });
        }
        return resourceDetails;
    });

    let response = await Promise.all(
        resourceDetailsList.map(async resourceDetail =>
            getDatabaseHostSummaryV2(
                accountId,
                resourceDetail.resource_id,
                credentialsId,
                region,
                fields ||
                    'serverDetails,nodeTopology,performance,usageEstimation,storage,protection,instanceDetails,databaseInstanceTopology',
                resourceDetail,
                undefined,
                false // unmanaged host,
            )
        )
    );

    if (IS_DEMO_FLOW) {
        response.forEach((item, index) => {
            item.id = instances[index];
        });
    }
    if (errorInstances.length > 0) {
        response = response.concat(errorInstances);
    }
    return {
        count: response.length,
        items: response
    };
}

function getDiscoveredOracleInstancesStorageDetails(
    ebsVolumeIDs: (string | undefined)[],
    endPointIpWithFsxInfo: Map<string, FSxInfo>,
    fsIdWithFsxInfo: Map<string, FsxServerConfig>,
    subnetListMap: Map<string, string>,
    ebsVolumeToAvailabilityZoneMap: Map<string, string>,
    oracleInstanceStorageDetails: OracleInstanceStorageInfo[]
) {
    logger.info('Get discovered oracle instances storage details', {
        ebsVolumeIDs,
        endPointIpWithFsxInfo,
        fsIdWithFsxInfo,
        subnetListMap,
        ebsVolumeToAvailabilityZoneMap,
        oracleInstanceStorageDetails: summarizeFirstLevel(oracleInstanceStorageDetails)
    });

    const storageTypes = [];
    for (const oracleStorage of oracleInstanceStorageDetails) {
        const { volumeId, isAsmManaged } = oracleStorage;

        if (volumeId && ebsVolumeIDs.includes(volumeId)) {
            const ebsAvailabilityZone = ebsVolumeToAvailabilityZoneMap.get(volumeId);
            storageTypes.push({
                type: STORAGE_TYPE.EBS,
                id: volumeId,
                deploymentType: SINGLE_AZ,
                isAsmManaged,
                ...(ebsAvailabilityZone && { zones: [ebsAvailabilityZone] })
            });
        }
    }

    const oracleStorageFsxMap = new Map();
    for (const oracleStorage of oracleInstanceStorageDetails) {
        const { mountIP, mountPoint, protocol } = oracleStorage;
        if (oracleStorageFsxMap.has(mountIP)) {
            oracleStorageFsxMap.get(mountIP).push({ mountPoint, protocol });
        } else {
            oracleStorageFsxMap.set(mountIP, [{ mountPoint, protocol }]);
        }
    }

    for (const [mountIP, mountDetails] of oracleStorageFsxMap.entries()) {
        const fsxInfo = endPointIpWithFsxInfo.get(mountIP);
        if (fsxInfo) {
            const { fsxId, svmId } = fsxInfo;
            const { deploymentType, subnetIds, fileSystemStorageType, fileSystemName } =
                fsIdWithFsxInfo.get(fsxId!) || {};
            const uniqueMountDetails = mountDetails
                .reduce((acc: any[], current: any) => {
                    const currentItem = JSON.stringify(current);
                    const exists = acc.some(item => JSON.stringify(item) === currentItem);
                    if (!exists) {
                        acc.push(current);
                    }
                    return acc;
                }, [])
                .map((detail: any) => ({ ...detail, mountIp: mountIP }));
            storageTypes.push({
                type: STORAGE_TYPE.FSXN,
                id: fsxId!,
                svmId,
                fileSystemStorageType,
                fileSystemName,
                deploymentType,
                zones: compact(subnetIds?.map((subnetId: string) => subnetListMap.get(subnetId))),
                subnetIdString: subnetIds?.join(),
                mountDetails: uniqueMountDetails
            });
        }
    }
    return compact(
        uniqBy(storageTypes, v => [v.id, v.svmId, v.subnetIdString].join()).map(v => {
            const { subnetIdString, ...rest } = v;
            logger.debug('subnet string', subnetIdString);
            return rest;
        })
    );
}

async function discoverOracleResources(
    accountId: string,
    credentialsId: string,
    region: string,
    pageSize?: number,
    nextToken?: string,
    ec2InstanceIds: string[] = []
): Promise<DiscoverOracleResponseBodyType> {
    logger.info('Discover Oracle resources', {
        accountId,
        credentialsId,
        region,
        pageSize,
        nextToken,
        ec2InstanceIds
    });

    if (IS_DEMO_FLOW) {
        return (await returnInventorydata(
            accountId,
            region,
            credentialsId,
            DatabaseTypes.ORACLE,
            ec2InstanceIds
        )) as unknown as DiscoverOracleResponseBodyType;
    }

    const filters = [
        {
            Name: 'platform-details',
            Values: ['Red Hat Enterprise Linux*', 'SUSE Linux*']
        },
        { Name: 'instance-state-name', Values: ['running'] }
    ];

    const { ec2Instances, NextToken } = await discoverEc2Instances(
        accountId,
        credentialsId,
        region,
        filters,
        pageSize,
        nextToken,
        ec2InstanceIds,
        DatabaseTypes.ORACLE
    );

    const ssmNotConnectedEc2Instances: DiscoveredEc2InstanceType[] = ec2Instances.filter(
        ({ ssmState }) => ssmState === ConnectionStatus.NOT_CONNECTED
    );
    const ssmConnectedEc2Instances = ec2Instances.filter(
        ({ ssmState }) => ssmState === ConnectionStatus.CONNECTED
    ) as DiscoveredEc2InstanceType[];

    const ssmCommandInput: SendCommandCommandInput = {
        DocumentName: SSM_RUN_SHELL_SCRIPT_DOC,
        InstanceIds: compact(ssmConnectedEc2Instances.map(target => target?.ec2InstanceId)),
        Comment: 'Discover Oracle resources',
        Parameters: {
            commands: [discoverOracleHosts],
            executionTimeout: [config.get<string>('ssm.execution-timeout')]
        }
    };

    const instancesWithSsmResponse: DiscoverOracleResponseType[] = [];

    try {
        const {
            ssmResponseMap,
            endPointIpWithFsxInfo,
            fsIdWithFsxInfo,
            subnetListMap,
            ebsVolumeToAvailabilityZoneMap
        } = await fetchFsxResourceMappings(
            accountId,
            credentialsId,
            region,
            ssmCommandInput,
            ssmConnectedEc2Instances,
            pageSize
        );

        await Promise.all(
            ssmConnectedEc2Instances.map(
                throat(10, async ec2Instance => {
                    const ssmResponse = ssmResponseMap.get(ec2Instance.ec2InstanceId);
                    const { output, error } = ssmResponse || {};
                    if (error) {
                        ec2Instance.error = error;
                        return instancesWithSsmResponse.push(ec2Instance);
                    }
                    let parsedResponse;
                    try {
                        parsedResponse = sqlResponseParsing(output || '{}');
                        logger.debug('Parsed SSM ORACLE response', { parsedResponse });
                        const { hostname, dbInstances } = parsedResponse;
                        if (!parsedResponse || !Array.isArray(dbInstances) || dbInstances.length === 0) {
                            return;
                        }
                        ec2Instance = {
                            ...ec2Instance,
                            oracleServerDeploymentType: 'Standalone'
                        };

                        const { oracle: ec2OracleParameters, asm: ec2AsmParameters } = await getEc2SqlParameters(
                            credentialsId,
                            region,
                            ec2Instance.ec2InstanceId
                        );

                        const databaseInstanceDetails: DiscoverOracleInstanceType[] = [];
                        // Parsed Response : an array of objects for each database Instance
                        for (const dbInstance of dbInstances) {
                            const {
                                error: dbInstanceError,
                                instance_details: {
                                    instance_id: instanceId,
                                    instance_name: instanceName,
                                    version,
                                    instance_state: instanceState,
                                    is_rac_enabled: isRacEnabledRaw
                                },
                                database_details: databaseDetails,
                                storage_details: instanceStorageDetails,
                                is_default_auth: isDefaultAuthentication,
                                modules_availability: modulesAvailability,
                                missing_permissions: missingPermissions,
                                remediation_missing_permissions: remediationMissingPermissions,
                                isDataguardDeployed: isDataGuardDeployed,
                                dataguard_details: dataguardDetails
                            } = dbInstance;

                            if (dbInstanceError) {
                                logger.error('Error in discovering database instance', {
                                    ec2InstanceId: ec2Instance.ec2InstanceId,
                                    instanceId,
                                    dbInstanceError
                                });
                            }
                            const { isAwsCliInstalled, isJqInstalled, isPythonInstalled } = modulesAvailability || {};

                            const isOracleAuth =
                                ec2OracleParameters?.some(
                                    (obj: { oracleinstancename: string; username: string; password: string }) =>
                                        obj.oracleinstancename === instanceName
                                ) || false;

                            const isAsmAuth =
                                ec2AsmParameters?.some(
                                    (obj: { oracleinstancename: string; username: string; password: string }) =>
                                        obj.oracleinstancename === instanceName
                                ) || false;

                            let databaseInfo: {
                                databaseId?: string;
                                name?: string;
                                openMode?: string;
                                isCDB?: string;
                                error?: string;
                            } = {};

                            let isCDB;
                            if (databaseDetails.hasOwnProperty('error')) {
                                databaseInfo.error = databaseDetails.error;
                            } else {
                                const { database_id: databaseId, name, open_mode: openMode } = databaseDetails;
                                ({ is_cdb: isCDB } = databaseDetails);
                                databaseInfo = { databaseId, name, openMode, isCDB };
                            }
                            const pluggableDatabases = [];
                            const isContainerDbInstance = isCDB === 'YES';
                            if (isContainerDbInstance) {
                                for (const pluggableDatabase of dbInstance.pdb_database_details) {
                                    const { pdb_id: pdbId, pdb_name: pdbName, status: pdbStatus } = pluggableDatabase;
                                    pluggableDatabases.push({
                                        pdbId,
                                        pdbName,
                                        pdbStatus
                                    });
                                }
                            }

                            const flattenedInstanceStorageDetails: [] = instanceStorageDetails.flat();
                            const isInstanceStorageAsmManaged = flattenedInstanceStorageDetails.some(
                                (storage: { isAsmManaged: string }) => storage.isAsmManaged === 'true'
                            );
                            const storageDetails = getDiscoveredOracleInstancesStorageDetails(
                                ec2Instance.ebsVolumeIDs!,
                                endPointIpWithFsxInfo,
                                fsIdWithFsxInfo,
                                subnetListMap,
                                ebsVolumeToAvailabilityZoneMap,
                                flattenedInstanceStorageDetails
                            );

                            const missingModules = [
                                isAwsCliInstalled === 'false' ? 'awsCli' : null,
                                isJqInstalled === 'false' ? 'jq' : null,
                                isPythonInstalled === 'false' ? 'python' : null
                            ].filter(Boolean) as string[];

                            if (isDataGuardDeployed && dataguardDetails) {
                                const privateIps: string[] = (
                                    dataguardDetails as OracleDataguardDiscoveryDetailsType
                                )?.associatedHosts?.map(host => host.hostIp) as string[];
                                if (privateIps && privateIps.length > 0) {
                                    // eslint-disable-next-line no-await-in-loop
                                    const hostDetails = await getInstanceDetailsByPrivateIp(
                                        credentialsId,
                                        region,
                                        privateIps,
                                        { useCache: true }
                                    );
                                    logger.debug(hostDetails);
                                    dataguardDetails.associatedHosts = (
                                        dataguardDetails as OracleDataguardDiscoveryDetailsType
                                    )?.associatedHosts?.map(host => {
                                        const matchedHost = hostDetails.find(
                                            ec2detail => ec2detail.ec2InstancePrivateIpAddress === host.hostIp
                                        );
                                        return {
                                            sidName: host.sidName,
                                            serviceName: host.serviceName || host.sidName,
                                            role: host.role,
                                            listenerPort: host.listenerPort,
                                            hostIp: host.hostIp,
                                            ec2InstanceId: matchedHost ? matchedHost.ec2InstanceId : undefined
                                        };
                                    });
                                }
                            }

                            const isRacEnabled = coerceBooleanFromLooseTrue(isRacEnabledRaw);

                            databaseInstanceDetails.push({
                                instanceId,
                                instanceName,
                                version,
                                instanceState,
                                instanceType: isContainerDbInstance
                                    ? OracleDeploymentTenacy.MULTI_TENANT
                                    : OracleDeploymentTenacy.SINGLE_TENANT,
                                databaseCount: isContainerDbInstance ? pluggableDatabases.length : 1,
                                databaseDetails: databaseInfo,
                                ...(isContainerDbInstance && {
                                    pluggableDatabases
                                }),
                                storage: storageDetails,
                                isInstanceStorageAsmManaged,
                                isDefaultAuthentication,
                                oracleServerAuthentication: isOracleAuth,
                                asmAuthentication: isAsmAuth,
                                manageReadiness: {
                                    assessment: {
                                        missingModules,
                                        missingSqlPermissions: missingPermissions
                                    },
                                    remediation: {
                                        missingSqlPermissions: remediationMissingPermissions,
                                        missingModules
                                    }
                                },
                                isDataGuardDeployed,
                                isRacEnabled,
                                dataguardDetails: isDataGuardDeployed ? dataguardDetails : undefined,
                                error: dbInstanceError
                            });
                        }

                        ec2Instance.ec2HostName = hostname;
                        ec2Instance.databaseInstanceDetails = databaseInstanceDetails;
                        instancesWithSsmResponse.push(ec2Instance);
                    } catch (err: unknown) {
                        ec2Instance.error = err as string;
                        logger.warn('Failed to parse SSM response', { error: err });
                        instancesWithSsmResponse.push(ec2Instance);
                    }
                })
            )
        );
    } catch (error: any) {
        logger.error('Failed to discover oracle resources', { error: error.message });
    }

    return {
        count: (ssmNotConnectedEc2Instances.length || 0) + (instancesWithSsmResponse.length || 0),
        items: [...ssmNotConnectedEc2Instances, ...instancesWithSsmResponse],
        nextToken: NextToken as string
    };
}

async function fetchFsxResourceMappings(
    accountId: string,
    credentialsId: string,
    region: string,
    ssmCommandInput: SendCommandCommandInput,
    ssmConnectedEc2Instances: DiscoveredEc2InstanceType[],
    pageSize?: number
) {
    logger.info('Fetch Fsx resource mappings', { accountId, credentialsId, region, ssmCommandInput, pageSize });

    const [fsxList, { StorageVirtualMachines: svmList }, subnetList, ebsVolumeList, ssmResponseList] =
        await Promise.all([
            describeFSxFileSystems(credentialsId, region, { useCache: true }),
            describeFSxStorageVirtualMachines(credentialsId, region, undefined, { useCache: true }),
            paginatedDescribeSubnets(credentialsId, region, {}, { useCache: true }),
            paginateDescribeEbsVolumes(
                credentialsId,
                region,
                {
                    Filters: [
                        {
                            Name: 'attachment.instance-id',
                            Values: ssmConnectedEc2Instances.map(target => target.ec2InstanceId)
                        }
                    ]
                },
                undefined,
                { useCache: true }
            ),
            !isEmpty(ssmConnectedEc2Instances)
                ? (executeSSMDocumentMultipleInstances(
                      credentialsId,
                      region,
                      ssmCommandInput,
                      accountId,
                      undefined,
                      pageSize
                  ) as Promise<MultipleCommandSsmResponse[]>)
                : Promise.resolve([])
        ]);

    const extractedSsmResponseList = await Promise.all(
        ssmResponseList.map(async ssmResponse =>
            extractSsmResponse(credentialsId, region, SSM_COMMAND_RUNTIMES.POWERSHELL, ssmResponse)
        )
    );
    const ssmResponseMap = new Map(
        extractedSsmResponseList.map((response, index) => [ssmResponseList[index].instanceId, response])
    );
    const endPointIpWithFsxInfo = new Map<string, FSxInfo>();
    const fsIdWithFsxInfo = new Map<string, FsxServerConfig>();

    fsxList?.forEach(fsx => {
        const { FileSystemId, StorageType, OntapConfiguration, SubnetIds, Tags: fileSystemTags } = fsx;
        const fileSystemName = getFsxNameFromTags(fileSystemTags);
        const fsxInfo = {
            fileSystemStorageType: StorageType,
            subnetIds: SubnetIds,
            deploymentType: OntapConfiguration?.DeploymentType,
            fileSystemName
        };
        if (FileSystemId) {
            fsIdWithFsxInfo.set(FileSystemId, fsxInfo);
        }
    });

    svmList?.forEach(svm => {
        const { FileSystemId, StorageVirtualMachineId, Endpoints } = svm;
        if (FileSystemId && Endpoints) {
            Endpoints?.Nfs?.IpAddresses?.forEach(ip => {
                endPointIpWithFsxInfo.set(ip, {
                    fsxId: FileSystemId,
                    svmId: StorageVirtualMachineId,
                    type: STORAGE_TYPE.FSXN
                });
            });

            Endpoints?.Iscsi?.IpAddresses?.forEach(ip => {
                endPointIpWithFsxInfo.set(ip, {
                    fsxId: FileSystemId,
                    svmId: StorageVirtualMachineId,
                    type: STORAGE_TYPE.FSXN
                });
            });
        }
    });

    const subnetListMap = new Map(
        subnetList
            ?.filter(subnet => subnet.SubnetId && subnet.AvailabilityZone)
            .map(subnet => [subnet.SubnetId, subnet.AvailabilityZone]) as [string, string][]
    );

    const ebsVolumeToAvailabilityZoneMap = new Map(
        ebsVolumeList
            ?.filter(vol => vol.VolumeId && vol.AvailabilityZone)
            .map(vol => [vol.VolumeId, vol.AvailabilityZone]) as [string, string][]
    );

    return {
        ssmResponseMap,
        endPointIpWithFsxInfo,
        fsIdWithFsxInfo,
        subnetListMap,
        ebsVolumeToAvailabilityZoneMap
    };
}

async function getOracleResourceDetails(
    accountId: string,
    credentialsId: string,
    region: string,
    instancesString: string,
    fields?: string
) {
    logger.info('Get Oracle resource details', { accountId, credentialsId, region, instancesString, fields });
    const instances = Array.isArray(instancesString) ? instancesString : instancesString?.split(',');
    const { items: ec2Instances } = await discoverOracleResources(
        accountId,
        credentialsId,
        region,
        undefined,
        undefined,
        instances
    );

    const errorInstances: DatabaseHostSummaryForMultiInstanceResponseType[] = [];

    const resourceDetailsList: ResourceDetails[] = ec2Instances?.map(ec2Instance => {
        const resourceDetails: ResourceDetails = {
            id: null,
            account_id: accountId,
            resource_id: ec2Instance.ec2InstanceId,
            resource_type: RESOURCESTYPE.ORACLE,
            resource_name: ec2Instance.ec2InstanceName || ec2Instance.ec2InstanceId,
            cloud_provider_name: CloudProviders.AWS,
            cloud_provider_account_id: null,
            region,
            credentials_id: credentialsId,
            metadata: {
                creationDate: Date.now(),
                node1InstanceId: ec2Instance.ec2InstanceId
            },
            database_instances: [],
            co_relation_id: null,
            ebsVolumeIds: [],
            ec2UsageOperation: ec2Instance.ec2UsageOperation
        };
        const clonedResourceDetails = cloneDeep(resourceDetails);

        for (const oracleDbInstance of ec2Instance?.databaseInstanceDetails || []) {
            const { storage } = oracleDbInstance;
            let fsxnId: string | undefined;
            const ebsVolumeIds: string[] = [];
            storage?.forEach(({ type, id }: { type: string; id: string }) => {
                // if there are multiple entries in storage for the same type then only the last entry will be considered. For eg: if the same sql instance has fsxn-1 and fsxn-2, then only fsxn-2 will be considered. Such a scenario occurs when system dbs use one storage and user dbs use another storage. The reason for this limitation currently is wlmdb resources are not expecting multiple co-relation ids for the same resource.
                // If the storage is of different type, then both will be considered while calculating protection and storage savings details.
                if (type === STORAGE_TYPE.EBS) {
                    ebsVolumeIds.push(id);
                }
                fsxnId = type === STORAGE_TYPE.FSXN ? id : fsxnId;
            });

            resourceDetails.ebsVolumeIds = (resourceDetails.ebsVolumeIds ?? []).concat(ebsVolumeIds);

            const [mountPointDetails] = storage?.[storage.length - 1]?.mountDetails || [];
            const dbInstanceState =
                oracleDbInstance.instanceState === ORACLE_INSTANCE_STATE.OPEN
                    ? 'RUNNING'
                    : oracleDbInstance.instanceState;

            resourceDetails.database_instances?.push({
                database_instance_id: oracleDbInstance.instanceId || '',
                database_instance_name: oracleDbInstance.instanceName || '',
                database_type: RESOURCESTYPE.ORACLE,
                is_default: true,
                instanceState: dbInstanceState,
                region,
                credentials_id: credentialsId,
                metadata: IS_DEMO_FLOW
                    ? { mountPointDetails: { protocol: 'NFS', mountPoint: '/oracleData', mountIp: '0.0.0.0' } }
                    : { mountPointDetails },
                fsxn_ids: fsxnId || '',
                ebsVolumeIds,
                database_deployment_type: STANDALONE,
                storage_type: fsxnId ? STORAGE_TYPE.FSXN : ebsVolumeIds.length > 0 ? STORAGE_TYPE.EBS : NOT_AVAILABLE,
                resource: clonedResourceDetails
            });
        }
        return resourceDetails;
    });

    let response = await Promise.all(
        resourceDetailsList.map(async resourceDetail =>
            getDatabaseHostSummaryV2(
                accountId,
                resourceDetail.resource_id,
                credentialsId,
                region,
                fields ||
                    'serverDetails,nodeTopology,performance,usageEstimation,storage,protection,instanceDetails,databaseInstanceTopology',
                resourceDetail,
                undefined,
                false // unmanaged host,
            )
        )
    );

    if (IS_DEMO_FLOW) {
        response.forEach((item, index) => {
            item.id = instances[index];
        });
    }

    if (errorInstances.length > 0) {
        response = response.concat(errorInstances);
    }
    return {
        count: response.length,
        items: response
    };
}

export {
    getHostAndSqlServerInfo,
    prepareForManage,
    fetchUnmanagedHostsInformationV2,
    discoverPgSqlResources,
    prepareDbScriptsForManage,
    getPgSqlResourceDetails,
    discoverOracleResources,
    getOracleResourceDetails
};
