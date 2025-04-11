import createError from 'http-errors';
import config from 'config';
import randomize from 'randomatic';

import { STORAGE_TYPE, JOBSTATUS, JOBTYPE } from '@prisma/client';
import { FileSystemType } from '@aws-sdk/client-fsx';
import { attempt, compact, uniqBy, isEmpty, cloneDeep } from 'lodash-es';
import { DescribeInstancesCommandInput, Filter, InstanceStateName, Vpc } from '@aws-sdk/client-ec2';
import { CommandInvocationStatus, ConnectionStatus, SendCommandCommandInput } from '@aws-sdk/client-ssm';
import throat from 'throat';
import {
    createResource,
    deleteDatabaseInstance,
    deleteResource,
    listDatabaseInstances,
    upsertDatabaseInstance
} from '../lib/database/db';
import { getResources } from './database/database-operations';
import {
    describeInstance,
    describeInstancesWithPagination,
    paginateDescribeEbsVolumes,
    paginatedDescribeSubnets,
    paginatedDescribeVpcs
} from '../lib/aws/ec2';
import {
    getResourceNameFromTags,
    sleep,
    getArtifactsRegionBucketName,
    derivePropertiesFromARN,
    isDemo,
    decompressSSMResponse,
    retryWithDelay,
    getServerNameWithHostname,
    sqlResponseParsing,
    isValidProp
} from '../utils/utils';
import {
    getEc2SqlParameters,
    callSsmExecution,
    getSSMConnectionStatus,
    pollCommandStatus,
    ssmPutParameters,
    getSSMConnectionStatusByInstanceIds,
    executeSSMDocumentMultipleInstances,
    extractSsmResponse
} from './aws/ssm-operations';
import { registerJob, updateJobDetails, getJobs } from './database/job-operations';
import { UpdateJobRecordType } from '../routes/types/jobs.types';

import { tagResources } from './aws/sqs-operations';
import {
    CloudProviders,
    HttpErrorCodes,
    RESOURCESTYPE,
    SSM_PARAMETERS_BASE_PATH,
    SqlServerDeploymentModel,
    RESOURCE_SOURCE,
    STORAGE_PROTOCOLS,
    RESOURCE_PREPARE_JOB_TIMEOUT_MINUTES,
    PSMODULES_RELATIVE_PATH,
    DatabaseTypes,
    OFFLINE,
    NOT_AVAILABLE,
    PREPARE_PSMODULES_RELATIVE_PATH,
    SINGLE_AZ,
    AL2023_AMI_NAME,
    AMAZON_LINUX_AMI_PATH,
    HA
} from '../utils/consts';
import {
    SQL_SERVER_VERSION_TO_YEAR,
    HOST_AND_SQL_INFO_PS1,
    CLUSTER_NETWORK_IP_INFO_PS1,
    IS_PS7_AVAILABLE,
    UNAVAILABLE_PS_MODULES,
    GET_MISSING_RESOURCE_DETAILS,
    IS_DATABASE_CREATE_POSSIBLE,
    INSTALL_WF_POWERSHELL_PREREQS_PS1,
    REQUIRED_PS_MODULES_FOR_MANAGEMENT,
    FAILURE_INFO,
    ACTIVE_DIRECTORY,
    GET_ACTIVE_DIRECTORY_DETAILS
} from './workloads/mssql/discover-consts';
import { deleteParameters, getParameter, getParametersByPath, sendSSMCommand } from '../lib/aws/ssm';
import { SSM_RUN_POWERSHELL_SCRIPT_DOC } from './workloads/mssql/const';
import { listFsxOntapCredentials, registerFsxOntapCredentials } from '../lib/cloud-manager/fsx-core';
import { NodeDetails, ResourceDetails, SSMParamterObject, MultipleCommandSsmResponse } from '../utils/common-types';
import {
    DiscoverMsSqlResponseBodyType,
    SqlServerInstanceInfoType,
    DiscoverResponseInfoType,
    DiscoverCredentialsType,
    MultiInstanceManageMsSqlRequestBodyType,
    MultiInstanceManageResponseBodyType,
    DiscoverPgSqlResponseType,
    DiscoverPgSqlResponseBodyType
} from '../routes/types/discover.types';
import getLogger from '../utils/logger';
import { describeFSxFileSystems, describeFSxStorageVirtualMachines } from '../lib/aws/fsx';
import { returnInventorydata } from '../utils/demo-utils/demoDefaultUtils';
import { getDatabaseHostSummaryV2 } from './database-hosts-operations';
import {
    copyPowerShellModule,
    validateOntapConnectivity,
    validateSQLInstanceConnectivity
} from './workloads/mssql/ssm-script-utils';
import { getAsyncLocalStorageResource, setAsyncLocalStorageResource } from '../utils/async-local-storage';
import { getMsSqlResourceId } from './workloads/mssql/mssql-operations';
import { preSignedUrl } from '../lib/aws/s3';
import { getInstanceDetailsByPrivateIp } from './aws/ec2-operations';
import { DatabaseHostSummaryForMultiInstanceResponseType } from '../routes/types/database-hosts.types';
import { copyScriptsToHost } from './resource-operations';
import { updateLongRunningAuditGroup } from './cloud-manager/audit-operations';
import { createDatabaseInstanceConfigData } from '../lib/database/database-instance-config';
import { AssessmentCategories } from '../utils/continous-optimization-consts';
import { ASSESMENT_CONFIG_DATA, ASSESSMENT_CRR_CONFIG_DATA } from '../utils/demo-utils/demoInventoryData';
import { discoverPgsqlHosts } from './workloads/pgsql/pgsql-discover-scripts';

const { getPreSignedUrl } = preSignedUrl;
const logger = getLogger();
const isDemoFlow = isDemo();

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
}

interface FSxInfo {
    fsxId: string;
    svmId?: string;
    type?: string;
}

const MINIMUM_SQL_SERVER_SUPPORTED = 2016;
const PREPARE_EC2_RERUN_DURATION: number = 20; // in minutes

const NEW_SSM_PARAMETERS = 'NEW_SSM_PARAMETERS';
const SSM_PARAM_PREFIX = '/netapp/wlmdb/';

async function getHostAndSqlServerInfo(
    accountId: string,
    credentialsId: string,
    region: string,
    pageSize?: number,
    nextToken?: string,
    instances: string[] = []
): Promise<DiscoverMsSqlResponseBodyType> {
    logger.info('Get host and SQL Server info:', { accountId, credentialsId, region, nextToken, instances });
    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        return returnInventorydata(instances) as unknown as DiscoverMsSqlResponseBodyType;
    }
    let api1StartTime;
    let api1EndTime;
    const filters: Filter[] = [{ Name: 'platform', Values: ['windows'] }];
    const { ec2Instances: ssmTargets, NextToken } = await discoverEc2Instances(
        accountId,
        credentialsId,
        region,
        filters,
        pageSize,
        nextToken,
        instances
    );

    const ssmConnectedEc2ResponseInfo: DiscoverResponseInfoType[] = [];
    // Since it isn't possible to get SQL Server details for EC2 without
    // SSM connectivity, the attribute 'sqlServerInstances' will not be
    // available for those hosts in API response.
    const ssmNotConnectedEc2ResponseInfo: DiscoverResponseInfoType[] = ssmTargets.filter(
        target => target.ssmState === ConnectionStatus.NOT_CONNECTED
    );

    const ssmConnectedNodes = ssmTargets.filter(target => target.ssmState === ConnectionStatus.CONNECTED);
    if (ssmConnectedNodes?.length > 0) {
        api1StartTime = performance.now();
        const commandId = await makeSsmCall(
            credentialsId,
            region,
            HOST_AND_SQL_INFO_PS1,
            ssmConnectedNodes.map(target => target.ec2InstanceId),
            accountId
        );
        api1EndTime = performance.now();
        logger.info(
            `API1Performance: Time taken by makeSsmCall() for multiple targets: ${
                api1EndTime - api1StartTime
            }ms. SSM command ID: ${commandId}`
        );

        /*
          FIXME: Optimize

          These calls will be made for each invocation of the API, though they
          will be repetitive for a paginated call.

          One option is to see if nextToken is present and don't make the call.
          However, two independent requests can be having nextToken and can cause
          incorrect data to be returned.

          If we cache data based on nextToken, it too won't be useful since the next
          call will come with a new nextToken.
        */
        api1StartTime = performance.now();
        const [fsxList, svmList, subnetList, ebsVolumeList] = await Promise.all([
            describeFSxFileSystems(credentialsId, region),
            describeFSxStorageVirtualMachines(credentialsId, region),
            paginatedDescribeSubnets(credentialsId, region, {}),
            paginateDescribeEbsVolumes(credentialsId, region, {
                Filters: [
                    { Name: 'attachment.instance-id', Values: ssmConnectedNodes.map(target => target.ec2InstanceId) }
                ]
            })
        ]);
        api1EndTime = performance.now();
        logger.info(`API1Performance: Time taken by describe FSxFS/SVM: ${api1EndTime - api1StartTime}ms`);

        const endPointIpWithFsxInfo = new Map<string, FSxInfo>();
        const fsIdWithFsxInfo = new Map<string, FsxServerConfig>();
        api1StartTime = performance.now();
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

        fsxList.forEach(({ FileSystemId, OntapConfiguration, WindowsConfiguration, SubnetIds, StorageType }) => {
            if (FileSystemId) {
                fsIdWithFsxInfo.set(FileSystemId, {
                    deploymentType: isEmpty(OntapConfiguration)
                        ? WindowsConfiguration?.DeploymentType
                        : OntapConfiguration?.DeploymentType,
                    subnetIds: SubnetIds,
                    fileSystemStorageType: StorageType
                });
            }
        });

        api1EndTime = performance.now();
        logger.info(`API1Performance: Endpoint/FSx/Deployment map creation time: ${api1EndTime - api1StartTime}ms`);

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

        api1StartTime = performance.now();
        await Promise.all(
            ssmConnectedNodes.map(
                throat(pageSize || 5, async (target: SsmTargetsInfo) => {
                    let dbInfo: SqlServerInstanceInfoType[] = [];
                    const dbInfoStartTime = performance.now();
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
                    const dbInfoEndTime = performance.now();
                    logger.info(
                        `API1Performance: getHostAndSqlInfoFromPsOutput() time for target ${target.ec2InstanceId}: ${
                            dbInfoEndTime - dbInfoStartTime
                        }ms`
                    );

                    if (dbInfo.length) {
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
        api1EndTime = performance.now();
        logger.info(
            `API1Performance: getHostAndSqlInfoFromPsOutput()+other operations time for all targets: ${
                api1EndTime - api1StartTime
            }ms`
        );
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

    const [ssmResponse, ec2SqlParametersInfo] = await Promise.all(
        [
            pollCommandStatus(credentialsId, region, commandInvocationParam),
            getEc2SqlParameters(credentialsId, region, ssmTarget.ec2InstanceId)
        ].map((p, index) =>
            p.catch(error => {
                if (index === 0) {
                    const errorMessage = `Error fetching command status: ${error} on node ${ssmTarget.ec2InstanceId} for command Id ${commandId}`;
                    logger.error(errorMessage);
                    throw createError(errorMessage);
                }
            })
        )
    );

    logger.info(`SQL Parameter details for ${ssmTarget.ec2InstanceId}: ${ec2SqlParametersInfo}`);

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
            logger.info(`SSM response for ${ssmTarget.ec2InstanceId}: ${responseInJson}`);

            if (!Array.isArray(responseInJson)) {
                responseInJson = [responseInJson];
            }

            responseInJson.forEach((item: { [key: string]: any }) => {
                try {
                    if (item.hasOwnProperty('windowsClusterNodes')) {
                        item.windowsClusterNodes = JSON.parse(item.windowsClusterNodes);
                        // DBS-3941 fix
                        if (!Array.isArray(item.windowsClusterNodes)) {
                            item.windowsClusterNodes = [item.windowsClusterNodes];
                        }
                        item.nodeIps = item.windowsClusterNodes.map(({ Address }: { Address: string }) => Address);
                    }
                } catch (error) {
                    logger.error('Error parsing windowsClusterNodes:', error);
                }
            });

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

                            const { deploymentType, subnetIds, fileSystemStorageType } =
                                fsIdWithFsxInfo.get(fsxId!) || {};

                            storageTypes.push({
                                type: STORAGE_TYPE.FSXN,
                                id: fsxId!,
                                svmId,
                                protocol: STORAGE_PROTOCOLS.ISCSI,
                                fileSystemStorageType
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
                                const { fileSystemStorageType } = fsIdWithFsxInfo.get(fsxId!) || {};
                                if (fsxType === FileSystemType.WINDOWS) {
                                    storageTypes.push({
                                        type: STORAGE_TYPE.FSXW,
                                        id: fsxId,
                                        protocol: STORAGE_PROTOCOLS.SMB,
                                        fileSystemStorageType
                                    });
                                } else {
                                    storageTypes.push({
                                        type: STORAGE_TYPE.FSXN,
                                        id: fsxId,
                                        svmId,
                                        protocol: STORAGE_PROTOCOLS.SMB,
                                        fileSystemStorageType
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
                        scriptExecutionTime,
                        databaseCount,
                        failureInfo,
                        sqlServerDeploymentType,
                        windowsOsVersion,
                        windowsClusterName,
                        windowsClusterNodes,
                        missingSqlPermissions
                    } = sqlServerInstanceInfo;
                    logger.info(
                        `API1Performance: Time taken to execute PowerShell script for instance ${sqlServerInstance}: ${scriptExecutionTime}ms`
                    );

                    if (!Array.isArray(sqlServerNodes)) {
                        sqlServerNodes = [sqlServerNodes];
                    }

                    const sqlServerAuthentication = ec2SqlParametersInfo?.some(
                        (elem: { sqlinstancename: string }) =>
                            elem.sqlinstancename.toUpperCase() === sqlServerInstance.toUpperCase()
                    );

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
                        ...(missingSqlPermissions && { missingSqlPermissions })
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
    logger.info('makeSsmCall():', credentialsId, region, commands, targets, accountId);

    const params = {
        DocumentName: SSM_RUN_POWERSHELL_SCRIPT_DOC,
        Documentversion: '1',
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
        Comment: 'Discover SQL Server instances'
    };

    let commandId;
    try {
        commandId = await sendSSMCommand(credentialsId, region, params, accountId);
        logger.info(`SSM command ID is ${commandId} for commands ${commands}`);
    } catch (error) {
        logger.error(`Failed to start EC2 instance information retrieval using sendSSMCommand. Reason: ${error}`);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Failed to start information retrieval from EC2 instances. Reason: ${error}`
        );
    }
    return commandId;
}

function prepareParametersToStore(instanceIds: string[], credentials: DiscoverCredentialsType[]) {
    logger.debug('prepare parameters to store', { instanceIds });

    return credentials.reduce((acc: SSMParamterObject[], { resourceId, resourceType, username, password }) => {
        if (resourceType === RESOURCESTYPE.MSSQL) {
            const sqlItem = acc.find(el => el.value.sql);

            if (sqlItem && Array.isArray(sqlItem.value.sql)) {
                sqlItem.value.sql.push({
                    sqlinstancename: resourceId,
                    username,
                    password
                });
            } else {
                instanceIds.forEach(instanceId =>
                    acc.push({
                        path: `${SSM_PARAMETERS_BASE_PATH}/${instanceId}`,
                        value: {
                            sql: [
                                {
                                    sqlinstancename: resourceId,
                                    username,
                                    password
                                }
                            ]
                        }
                    })
                );
            }
        } else if (resourceType === RESOURCESTYPE.FSX) {
            acc.push({
                path: `${SSM_PARAMETERS_BASE_PATH}/${resourceId}`,
                value: {
                    fsx: {
                        username,
                        password
                    }
                }
            });
        }
        return acc;
    }, []);
}

function getErrorMessage(detectResponse: Record<string, string>) {
    logger.debug('Get detect resource error message', { detectResponse });

    let errorMessage = '';
    if (detectResponse.hasOwnProperty('requiredModuleError') && detectResponse.requiredModuleError) {
        errorMessage += `requiredModuleError: ${detectResponse.requiredModuleError}, `;
    }

    if (detectResponse.hasOwnProperty('sqlServerError') && detectResponse.sqlServerError) {
        errorMessage += `sqlServerError: ${detectResponse.sqlServerError}, `;
    }

    if (detectResponse.hasOwnProperty('fsxnError') && detectResponse.fsxnError) {
        errorMessage += `fsxnError: ${detectResponse.fsxnError}`;
    }

    errorMessage = errorMessage?.replace(', ', '');
    return errorMessage;
}

async function validateAndStoreDiscoveredParameters(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    credentials: DiscoverCredentialsType[],
    clusterNodesIpAddress?: string[]
) {
    logger.info('Validate and store SSM parameters', { accountId, credentialsId, region, instanceId });

    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        return {
            databaseCount: '10',
            sqlServerEdition: 'Standard Edition (64-bit)'
        };
    }

    try {
        if (!accountId || !credentialsId || !region || !instanceId) {
            logger.error('Invalid input parameters', { accountId, credentialsId, region, instanceId });
            throw new Error('Invalid input parameters');
        }

        credentials = uniqBy(credentials, 'resourceId');
        const fsxCredentials = credentials.find(cred => cred.resourceType === RESOURCESTYPE.FSX);
        const sqlCredentials = credentials.filter(cred => cred.resourceType === RESOURCESTYPE.MSSQL);
        if (isEmpty(fsxCredentials) && isEmpty(sqlCredentials)) {
            throw new Error('Credentials cannot be empty');
        }

        let instanceIds = [instanceId];
        if (clusterNodesIpAddress && !isEmpty(clusterNodesIpAddress)) {
            try {
                const clusterNodeDetails =
                    (await getInstanceDetailsByPrivateIp(credentialsId, region, clusterNodesIpAddress)) || [];
                instanceIds = clusterNodeDetails.map(e => e.ec2InstanceId);
            } catch (error) {
                logger.error('Error while generating resource id for SSM parameter: ', error);
            }
        }

        const detectResponse = await validateCredentials(
            credentialsId,
            region,
            instanceId,
            fsxCredentials,
            sqlCredentials,
            instanceIds
        );

        if (!detectResponse?.requiredModuleError && fsxCredentials && !detectResponse?.fsxnError) {
            await registerFsxOntapCredentials(
                accountId,
                credentialsId,
                region,
                fsxCredentials.resourceId,
                fsxCredentials.password
            );
        }

        const errorMessage = getErrorMessage(detectResponse);
        if (errorMessage) {
            logger.error('Failed to validate credentials', errorMessage);
            throw createError(HttpErrorCodes.VALIDATION_ERROR, errorMessage);
        }

        return detectResponse;
    } catch (error: any) {
        logger.error('Failed to validate credentials', error);
        throw createError(error?.statusCode || HttpErrorCodes.BAD_REQUEST, error.message);
    }
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
                clusterNodeDetails = (await getInstanceDetailsByPrivateIp(credentialsId, region, nodeIps)) || [];
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
                databaseInstanceDetails: [],
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

                    resourceDetails.databaseInstanceDetails?.push({
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
                false // unmanaged host,
            )
        )
    );

    if (errorInstances.length > 0) {
        response = response.concat(errorInstances);
    }
    return {
        count: response.length,
        items: response
    };
}

async function rewriteOrDeleteSSMParameter(
    credentialsId: string,
    region: string,
    instanceIds: string[],
    paramesToDelete: string[],
    instancesToBeDeleted: string[],
    fsxCredentials: DiscoverCredentialsType,
    sqlCredentials: DiscoverCredentialsType[]
) {
    logger.info('Calling rewriteOrDeleteSSMParameter', {
        credentialsId,
        region,
        instanceIds,
        paramesToDelete,
        instancesToBeDeleted,
        fsxCredentials,
        sqlCredentials
    });
    if (sqlCredentials.length === instancesToBeDeleted.length) {
        // Delete the parameter store all credentials are invalid
        instanceIds.forEach(instanceId => paramesToDelete.push(`${SSM_PARAM_PREFIX}${instanceId}`));
        await deleteSSMParameter(credentialsId, region, paramesToDelete);
    } else {
        // Rewrite parameter store after removing invalid credentials
        const latestSqlCredentials = sqlCredentials.filter(e => !instancesToBeDeleted.includes(e.resourceId));
        const creds = prepareParametersToStore(instanceIds, [
            ...(fsxCredentials ? [fsxCredentials] : []),
            ...latestSqlCredentials
        ]);
        await ssmPutParameters(credentialsId, region, creds);
    }
}

async function validateCredentials(
    credentialsId: string,
    region: string,
    instanceId: string,
    fsxCredentials: DiscoverCredentialsType | undefined,
    sqlCredentials: DiscoverCredentialsType[],
    instanceIds: string[]
) {
    logger.info('Validate credentials', { instanceId, fsxCredentials, sqlCredentials, instanceIds });

    const connectionStatus = await getSSMConnectionStatus(credentialsId, region, instanceId);

    const ssmParameters = [`${SSM_PARAM_PREFIX}${fsxCredentials?.resourceId}`];
    instanceIds.forEach(instance => ssmParameters.push(`${SSM_PARAM_PREFIX}${instance}`));

    if (connectionStatus.Status !== ConnectionStatus.CONNECTED) {
        const errorMessage = `Unable to validate the credentials through SSM, for host ${instanceId}`;
        logger.error(errorMessage);

        await deleteSSMParameter(credentialsId, region, ssmParameters);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    const newSqlCredentials = cloneDeep(sqlCredentials);
    await verifyAndCreateCredentials(credentialsId, region, instanceId, fsxCredentials, newSqlCredentials, instanceIds);

    let parsedResponse;

    try {
        let command = '$WarningPreference = "SilentlyContinue";';

        if (fsxCredentials || sqlCredentials.length) {
            // Get signed url for aws_ssm.zip to install the ps modules
            const bucketname = getArtifactsRegionBucketName(region);
            const copyPSModuleS3SignedUrl = await getPreSignedUrl(region, bucketname, PSMODULES_RELATIVE_PATH);
            const moduleNames = `
  'AWS.Tools.SimpleSystemsManagement'
`;
            command += `${copyPowerShellModule(copyPSModuleS3SignedUrl, moduleNames)};\n`;
        }

        if (fsxCredentials) {
            command += `${validateOntapConnectivity(fsxCredentials.resourceId, region)};\n`;
        }

        if (sqlCredentials.length) {
            command += sqlCredentials.reduce(
                (acc: string, { resourceId }) => `${acc}${validateSQLInstanceConnectivity(instanceId, resourceId)};\n`,
                ''
            );
        }

        command += '$responseObject | ConvertTo-Json -Compress';

        const ssmresponse = await callSsmExecution(
            credentialsId,
            region,
            [command],
            instanceId,
            'Validate credentials',
            undefined,
            false
        );

        const cleanResponse = ssmresponse?.replaceAll('\r\n', '');
        parsedResponse = attempt(JSON.parse, cleanResponse);
        logger.info('Parsed response for credential validation: ', parsedResponse);

        parsedResponse = parsedResponse instanceof Error ? undefined : parsedResponse;

        if (!parsedResponse) {
            throw new Error(`Failed to validate credentials. Reason: ${cleanResponse}`);
        }

        const response: Record<string, string> = {};
        const paramesToDelete: string[] = [];
        const instancesToBeDeleted: string[] = [];

        if (parsedResponse.requiredModuleError) {
            response.requiredModuleError = parsedResponse.requiredModuleError;
        } else {
            if (fsxCredentials && parsedResponse.ontapconnectivity === false) {
                paramesToDelete.push(`${SSM_PARAM_PREFIX}${fsxCredentials.resourceId}`);
                response.fsxnError = parsedResponse?.ontaperror;
            }

            if (sqlCredentials.length) {
                if (parsedResponse.sqlInstanceConnectivity === false) {
                    instancesToBeDeleted.push(sqlCredentials[0].resourceId);
                    response.sqlServerError = parsedResponse?.sqlerror;
                } else if (parsedResponse.sqlInstanceConnectivity === true) {
                    response.sqlServerEdition = parsedResponse?.sqlEdition;
                    response.databaseCount = parsedResponse?.noOfDatabases;
                }
            }
        }

        if (instancesToBeDeleted.length > 0) {
            await rewriteOrDeleteSSMParameter(
                credentialsId,
                region,
                instanceIds,
                paramesToDelete,
                instancesToBeDeleted,
                fsxCredentials!,
                newSqlCredentials
            );
        }
        return response;
    } catch (error: any) {
        // delete the ssm parameters if its already created
        const paramesToDelete: string[] = [];
        const instancesToBeDeleted: string[] = [];

        if (fsxCredentials) {
            paramesToDelete.push(`${SSM_PARAM_PREFIX}${fsxCredentials.resourceId}`);
        }

        if (sqlCredentials.length) {
            instancesToBeDeleted.push(sqlCredentials[0].resourceId);
        }

        await rewriteOrDeleteSSMParameter(
            credentialsId,
            region,
            instanceIds,
            paramesToDelete,
            instancesToBeDeleted,
            fsxCredentials!,
            newSqlCredentials
        );

        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Unable to validate the credentials . Reason: ${error?.message}.`
        );
    }
}

async function verifyAndCreateCredentials(
    credentialsId: string,
    region: string,
    instanceId: string,
    fsxCredentials: DiscoverCredentialsType | undefined,
    sqlCredentials: DiscoverCredentialsType[],
    instanceIds: string[]
) {
    logger.info('Verify and create credentials', { instanceId });

    if (fsxCredentials) {
        const SSMParameter = await getParameter(
            credentialsId,
            region,
            `${SSM_PARAM_PREFIX}${fsxCredentials.resourceId}`
        );
        if (!SSMParameter) {
            const newSSMParameters: string[] = await getAsyncLocalStorageResource(NEW_SSM_PARAMETERS);
            setAsyncLocalStorageResource(NEW_SSM_PARAMETERS, [...(newSSMParameters || []), fsxCredentials.resourceId]);
        }
    }

    if (sqlCredentials.length) {
        const existingParameters = await getParameter(credentialsId, region, `${SSM_PARAM_PREFIX}${instanceId}`);
        if (!existingParameters) {
            const newSSMParameters: string[] = await getAsyncLocalStorageResource(NEW_SSM_PARAMETERS);
            setAsyncLocalStorageResource(NEW_SSM_PARAMETERS, [...(newSSMParameters || []), ...instanceIds]);
        } else {
            const { sql } = JSON.parse(existingParameters);
            if (sql) {
                const newSqlInstances = sqlCredentials.map(e => e.resourceId);
                sql.forEach((e: { sqlinstancename: string; username: string; password: string }) => {
                    if (!newSqlInstances.includes(e.sqlinstancename)) {
                        sqlCredentials.push({
                            resourceId: e.sqlinstancename,
                            resourceType: RESOURCESTYPE.MSSQL,
                            username: e.username,
                            password: e.password
                        });
                    }
                });
            }
        }
    }

    const creds = prepareParametersToStore(instanceIds, [
        ...(fsxCredentials ? [fsxCredentials] : []),
        ...sqlCredentials
    ]);

    await ssmPutParameters(credentialsId, region, creds);
}

async function deleteSSMParameter(credentialsId: string, region: string, ssmParameterNames: string[]) {
    logger.info('Delete SSM parameter', { credentialsId, region, ssmParameterNames });

    const newlyAddedSSMParameters: string[] = (await getAsyncLocalStorageResource(NEW_SSM_PARAMETERS)) || [];
    const ssmParamRegex = /\/netapp\/wlmdb\/(.*)/;

    if (!isEmpty(newlyAddedSSMParameters) && !isEmpty(ssmParameterNames)) {
        const filteredSSMParameters = (ssmParameterNames || []).filter(param => {
            const [, lastPart] = param.match(ssmParamRegex) || [];
            return newlyAddedSSMParameters.includes(lastPart);
        });

        if (filteredSSMParameters?.length) {
            await deleteParameters(credentialsId, region, filteredSSMParameters);
        }
    }
}

async function verifyAndAddFSxOntapCredentials(
    accountId: string,
    credentialsId: string,
    region: string,
    fsxNId: string
) {
    logger.info('Verify and add FSx ONTAP credentials', { accountId, credentialsId, region, fsxStorageId: fsxNId });

    if (!isEmpty(fsxNId)) {
        // Check if the FSx credentials are already present in SSM parameter store
        const fsxCredentials = await getParameter(credentialsId, region, `${SSM_PARAM_PREFIX}${fsxNId}`);

        if (!fsxCredentials) {
            let credentials;

            try {
                ({ credentials } = await listFsxOntapCredentials(accountId, fsxNId));

                if (isEmpty(credentials)) {
                    throw new Error('FSx for ONTAP storage credentials not found');
                }
            } catch (error: any) {
                throw createError(
                    HttpErrorCodes.INTERNAL_SERVER_ERROR,
                    `Unable to manage the instance. Reason: FSx for ONTAP storage '${fsxNId}' isn't registered with FSxN core service.`
                );
            }

            const preparedCreds = prepareParametersToStore(
                [''],
                [
                    {
                        resourceId: fsxNId,
                        resourceType: RESOURCESTYPE.FSX,
                        username: credentials?.userName,
                        password: credentials?.password
                    }
                ]
            );

            await ssmPutParameters(credentialsId, region, preparedCreds);
        }
    }
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

    const hostname = await callSsmExecution(
        credentialsId,
        region,
        ['hostname'],
        ec2InstanceId,
        'Get hostname',
        accountId
    );
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

    const [dbResponse, psResponse] = await Promise.all([
        prepareDbScriptsForManage(accountId, credentialsId, region, ec2InstanceId, parentJobId),
        preparePsModulesForManage(accountId, credentialsId, region, ec2InstanceId, parentJobId)
    ]);

    await updateJobDetails(accountId, parentJobId, {
        status:
            dbResponse === JOBSTATUS.COMPLETED && psResponse === JOBSTATUS.COMPLETED
                ? JOBSTATUS.COMPLETED
                : JOBSTATUS.FAILED,
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
    logger.info(
        `Prepare database scripts for managing ${ec2InstanceId}: { accountId, credentialsId, region, ec2InstanceId, parentJobId }`
    );

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

        logger.info(`Response for copy scripts using PowerShell for ${ec2InstanceId}: ${copyScriptResponse}`);

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
    logger.info(
        `Prepare database scripts for managing ${ec2InstanceId}: { accountId, credentialsId, region, ec2InstanceId, parentJobId }`
    );

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
        const bucketname = getArtifactsRegionBucketName(region);
        const copyPSModuleS3SignedUrl = await getPreSignedUrl(region, bucketname, PREPARE_PSMODULES_RELATIVE_PATH);

        const ssmPsModuleInstallResponse = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                INSTALL_WF_POWERSHELL_PREREQS_PS1(REQUIRED_PS_MODULES_FOR_MANAGEMENT, copyPSModuleS3SignedUrl),
                ec2InstanceId,
                'Install PowerShell modules',
                accountId,
                false,
                (RESOURCE_PREPARE_JOB_TIMEOUT_MINUTES * 60).toString()
            ),
            3,
            5000
        );
        logger.info(`Response for PowerShell module installation for ${ec2InstanceId}: ${ssmPsModuleInstallResponse}`);

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

async function manageSqlServerV2(accountId: string, itemsTobeManged: MultiInstanceManageMsSqlRequestBodyType[]) {
    logger.info('Manage SQL Server instances (v2):', {
        accountId,
        itemsTobeManged
    });

    const manageResponse: MultiInstanceManageResponseBodyType = [];
    let auditlogResponse = '';
    await Promise.all(
        itemsTobeManged.map(
            throat(3, async (item: MultiInstanceManageMsSqlRequestBodyType) => {
                try {
                    const {
                        credentialsId,
                        region,
                        ec2InstanceId,
                        databaseInstanceNames: databaseInstanceNameList,
                        databaseHostId
                    } = item;

                    /* SSM is a must for all remaining validations */
                    const ssmStatus = await getSSMConnectionStatus(credentialsId, region, ec2InstanceId);
                    if (ssmStatus.Status === ConnectionStatus.NOT_CONNECTED) {
                        throw createError(HttpErrorCodes.VALIDATION_ERROR, 'No SSM connectivity.');
                    }

                    const [ec2Details, discoverDetails, clusterNetworkIpDetails, adDetails, missingResourceDetails] =
                        await Promise.all([
                            describeInstance(credentialsId, region, { InstanceIds: [ec2InstanceId] }),
                            getHostAndSqlServerInfo(accountId, credentialsId, region, undefined, undefined, [
                                ec2InstanceId
                            ]),
                            callSsmExecution(
                                credentialsId,
                                region,
                                CLUSTER_NETWORK_IP_INFO_PS1,
                                ec2InstanceId,
                                'Get cluster network info',
                                accountId
                            ),
                            callSsmExecution(
                                credentialsId,
                                region,
                                GET_ACTIVE_DIRECTORY_DETAILS,
                                ec2InstanceId,
                                'Get AD details',
                                accountId
                            ),
                            callSsmExecution(
                                credentialsId,
                                region,
                                GET_MISSING_RESOURCE_DETAILS,
                                ec2InstanceId,
                                'Get missing resources',
                                accountId
                            )
                        ]);

                    const node1InstanceId = ec2InstanceId;
                    let node2InstanceId;
                    const precheckErrorList: string[] = [];
                    const missingResourceJson = JSON.parse(missingResourceDetails!);

                    if (missingResourceJson[IS_PS7_AVAILABLE] === false) {
                        precheckErrorList.push(
                            'PowerShell 7 is required for managing the resource. Install it manually by referring to https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-windows?view=powershell-7.4.'
                        );
                    }
                    if (missingResourceJson[UNAVAILABLE_PS_MODULES]) {
                        precheckErrorList.push(
                            `PowerShell modules ${missingResourceJson[UNAVAILABLE_PS_MODULES]} are required for managing the resource. Install them manually by referring to https://learn.microsoft.com/en-us/powershell/scripting/developer/module/installing-a-powershell-module?view=powershell-7.4) or using the API "/accounts/{accountId}/wlmdb/v1/mssql/credentials/{credentialsId}/regions/{region}/instances/{instanceId}/prepare".`
                        );
                    }
                    if (missingResourceJson[IS_DATABASE_CREATE_POSSIBLE] === false) {
                        precheckErrorList.push(
                            'Files required for database operations are not available. Install them using the API "/accounts/{accountId}/wlmdb/v1/mssql/credentials/{credentialsId}/regions/{region}/instances/{instanceId}/prepare".'
                        );
                    }

                    const { awsAccountId } =
                        derivePropertiesFromARN(
                            ec2Details?.Reservations?.[0]?.Instances?.[0]?.IamInstanceProfile?.Arn || ''
                        ) || {};

                    if (isEmpty(awsAccountId)) {
                        precheckErrorList.push('Failed to get AWS account ID.');
                    }

                    if (clusterNetworkIpDetails?.includes(FAILURE_INFO)) {
                        precheckErrorList.push('Failed to get network interface details.');
                    } else if (clusterNetworkIpDetails) {
                        const clusterNetworkIpDetailsJson: { clusterNetworkIps: string[] } =
                            JSON.parse(clusterNetworkIpDetails);
                        if (clusterNetworkIpDetailsJson.clusterNetworkIps.length > 1) {
                            // FCI/AOAG environment
                            const clusterNodeDetails = await getInstanceDetailsByPrivateIp(
                                credentialsId,
                                region,
                                clusterNetworkIpDetailsJson.clusterNetworkIps
                            );
                            const temp = clusterNodeDetails?.find(elem => elem.ec2InstanceId !== node1InstanceId);
                            if (!isEmpty(temp)) {
                                if (!isDemoFlow) {
                                    node2InstanceId = temp.ec2InstanceId;
                                }

                                const node2ssmStatus = await getSSMConnectionStatus(
                                    credentialsId,
                                    region,
                                    node2InstanceId!
                                );
                                if (node2ssmStatus.Status === ConnectionStatus.NOT_CONNECTED) {
                                    precheckErrorList.push(`No SSM connectivity on partner node ${node2InstanceId}.`);
                                } else {
                                    const node2missingResourceDetails = await callSsmExecution(
                                        credentialsId,
                                        region,
                                        GET_MISSING_RESOURCE_DETAILS,
                                        node2InstanceId!,
                                        'Get missing resources',
                                        accountId
                                    );

                                    const node2missingResourceJson = JSON.parse(node2missingResourceDetails!);

                                    if (node2missingResourceJson[IS_PS7_AVAILABLE] === false) {
                                        precheckErrorList.push(
                                            `PowerShell 7 is required for managing the resource on partner node ${node2InstanceId}. Install it manually by referring to https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-windows?view=powershell-7.4.`
                                        );
                                    }
                                    if (node2missingResourceJson[UNAVAILABLE_PS_MODULES]) {
                                        precheckErrorList.push(
                                            `PowerShell modules ${node2missingResourceJson[UNAVAILABLE_PS_MODULES]} are required for managing the resource on partner node ${node2InstanceId}. Install them manually by referring to https://learn.microsoft.com/en-us/powershell/scripting/developer/module/installing-a-powershell-module?view=powershell-7.4) or using the API "/accounts/{accountId}/wlmdb/v1/mssql/credentials/{credentialsId}/regions/{region}/instances/{instanceId}/prepare".`
                                        );
                                    }
                                    if (node2missingResourceJson[IS_DATABASE_CREATE_POSSIBLE] === false) {
                                        precheckErrorList.push(
                                            `Files required for database operations are not available on partner node ${node2InstanceId}. Install them using the API "/accounts/{accountId}/wlmdb/v1/mssql/credentials/{credentialsId}/regions/{region}/instances/{instanceId}/prepare".`
                                        );
                                    }
                                }
                            }
                        }
                    }

                    if (isEmpty(adDetails) || adDetails?.includes(FAILURE_INFO)) {
                        precheckErrorList.push('Failed to get Active Directory details.');
                    }

                    const { count, items } = discoverDetails;

                    if (count <= 0) {
                        precheckErrorList.push(
                            'Only existing instances in running state, have Microsoft Windows as host operating system, architecture is x86_64, and hosting SQL Server 2016 above can be managed.'
                        );
                    }

                    if (!isEmpty(precheckErrorList)) {
                        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, precheckErrorList.join('\n'));
                    }

                    const [{ sqlServerInstances } = {}] = items || [];
                    let resourceId;
                    let isResourceTobeCreated: boolean;
                    if (isDemoFlow && databaseHostId) {
                        resourceId = databaseHostId;
                        isResourceTobeCreated = false;
                    } else {
                        // A resource ID is a hash generated using available EC2 instance IDs.
                        resourceId = getMsSqlResourceId(node1InstanceId, node2InstanceId);
                        const {
                            items: [resourceDetails]
                        } = await getResources(accountId, resourceId, credentialsId, region);

                        isResourceTobeCreated = !resourceDetails;
                    }
                    const alreadyManagedDatabaseInstances = await listDatabaseInstances(accountId, {
                        credentialsId,
                        resourceId,
                        region
                    });

                    const itemsStatus: {
                        databaseInstanceName: string;
                        databaseInstanceGuid?: string;
                        status: string;
                        errorMessage?: string;
                    }[] = [];
                    if (sqlServerInstances && sqlServerInstances.length > 0) {
                        auditlogResponse += `${sqlServerInstances[0].sqlServerName}\\${databaseInstanceNameList.join(
                            ','
                        )};`;
                    }

                    for (const dbInst of databaseInstanceNameList) {
                        const sqlInstanceInfo = sqlServerInstances?.find(
                            sqlInst => sqlInst.sqlServerInstance === dbInst
                        );

                        if (alreadyManagedDatabaseInstances.some(elem => elem.database_instance_name === dbInst)) {
                            itemsStatus.push({
                                databaseInstanceName: dbInst,
                                databaseInstanceGuid: sqlInstanceInfo?.serverGuid,
                                status: 'failed',
                                errorMessage: 'Instance is already managed.'
                            });
                        } else if (isEmpty(sqlInstanceInfo)) {
                            itemsStatus.push({
                                databaseInstanceName: dbInst,
                                status: 'failed',
                                errorMessage: 'SQL Server instance not found.'
                            });
                        } else {
                            try {
                                const { windowsAuthentication, sqlServerAuthentication, serverGuid, storage } =
                                    sqlInstanceInfo;
                                const storageInfo = storage?.find(elem => elem.type === STORAGE_TYPE.FSXN);
                                const storageProtocols = storage
                                    ?.filter(elem => elem.type === STORAGE_TYPE.FSXN)
                                    .map(elem => elem.protocol);

                                if (windowsAuthentication === false && sqlServerAuthentication === false) {
                                    throw Error(
                                        'Authentication to SQL Server instance is not possible. Check if the SQL Server service is running, stored credentials are valid, or windows authentication is enabled.'
                                    );
                                }

                                if (isEmpty(storageInfo)) {
                                    throw Error('SQL Server instance is not hosted on storage of type FSx for NetApp.');
                                }

                                if (
                                    sqlInstanceInfo.sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT
                                ) {
                                    throw Error('Always On availability group environments are not supported.');
                                }

                                try {
                                    await verifyAndAddFSxOntapCredentials(
                                        accountId,
                                        credentialsId,
                                        region,
                                        storageInfo!.id
                                    );
                                } catch (error: any) {
                                    // verifyAndAddFSxOntapCredentials() is used by both V1 and V2 versions
                                    // of the API.  The prefix 'Unable to manage' is alredy added by V2 API.
                                    // To avoid duplication of sentence, we remove the sentence, if present.
                                    const errorMessage = error?.message?.replace(
                                        'Unable to manage the instance. Reason: ',
                                        ''
                                    );
                                    throw Error(isEmpty(errorMessage) ? error : errorMessage);
                                }

                                if (isResourceTobeCreated) {
                                    const {
                                        domainName: activeDirectoryDomainName,
                                        ipAddresses: activeDirectoryIpAddresses
                                    } = JSON.parse(adDetails!)[ACTIVE_DIRECTORY];
                                    const ebsVolumes = await paginateDescribeEbsVolumes(credentialsId, region, {
                                        Filters: [
                                            {
                                                Name: 'attachment.instance-id',
                                                Values: node2InstanceId
                                                    ? [node1InstanceId, node2InstanceId]
                                                    : [node1InstanceId]
                                            }
                                        ]
                                    });
                                    const ebsVolumesFiltered = ebsVolumes?.map(volume => ({
                                        iops: volume.Iops,
                                        size: volume.Size,
                                        isRoot: volume.Attachments?.some(
                                            attachment =>
                                                attachment.Device === '/dev/xvda' || attachment.Device === '/dev/sda1'
                                        ),
                                        volumeType: volume.VolumeType,
                                        volumeId: volume.VolumeId,
                                        throughput: volume.Throughput
                                    }));

                                    await createResource(accountId, {
                                        resourceId,
                                        credentialsId,
                                        storageType: STORAGE_TYPE.FSXN,
                                        resourceName: sqlInstanceInfo.sqlServerName,
                                        cloudProviderAccountId: awsAccountId!,
                                        cloudProviderName: CloudProviders.AWS,
                                        resourceType: RESOURCESTYPE.MSSQL,
                                        coRelationId: storageInfo!.id,
                                        region,
                                        metadata: {
                                            creationDate: Date.now(),
                                            node1InstanceId,
                                            node2InstanceId,
                                            sqlDeploymentType: sqlInstanceInfo.sqlServerDeploymentType,
                                            source: RESOURCE_SOURCE.DISCOVER,
                                            fsxSvmId: storageInfo!.svmId,
                                            storageProtocol: storageProtocols ? storageProtocols.join() : '',
                                            ...(activeDirectoryDomainName && {
                                                activeDirectoryName: activeDirectoryDomainName
                                            }),
                                            ...(activeDirectoryIpAddresses && {
                                                activeDirectoryAddress: activeDirectoryIpAddresses.join()
                                            }),
                                            ...(ebsVolumesFiltered && { ebsVolumes: ebsVolumesFiltered })
                                        }
                                    });

                                    isResourceTobeCreated = false;
                                }

                                tagResources(
                                    credentialsId,
                                    region,
                                    awsAccountId!,
                                    accountId,
                                    storageInfo!.id,
                                    node1InstanceId,
                                    node2InstanceId
                                );

                                let dbInstanceName;
                                if (isDemoFlow) {
                                    dbInstanceName =
                                        sqlInstanceInfo.sqlServerInstance !== 'MSSQLSERVER'
                                            ? sqlInstanceInfo.sqlServerName + sqlInstanceInfo.sqlServerInstance
                                            : sqlInstanceInfo.sqlServerInstance;
                                } else {
                                    dbInstanceName = sqlInstanceInfo.sqlServerInstance;
                                }

                                await upsertDatabaseInstance(accountId, {
                                    credentialsId,
                                    resourceId,
                                    region,
                                    databaseInstanceId: serverGuid!,
                                    databaseInstanceName: dbInstanceName,
                                    fsxnIds: storageInfo!.id,
                                    isDefault: sqlInstanceInfo.isDefaultInstance,
                                    source: RESOURCE_SOURCE.DISCOVER,
                                    sqlDeploymentType: sqlInstanceInfo.sqlServerDeploymentType!,
                                    fsxSvmId: { [storageInfo!.id]: storageInfo!.svmId },
                                    storageProtocol: storageProtocols ? storageProtocols.join() : '',
                                    databaseType: DatabaseTypes.MS_SQL_SERVER
                                });
                                if (isDemoFlow) {
                                    const instanceConfigDataRecord = {
                                        account_id: accountId,
                                        credentials_id: credentialsId,
                                        region,
                                        resource_id: resourceId,
                                        database_instance_id: serverGuid!,
                                        creation_time: new Date(Date.now()),
                                        config_data_type: AssessmentCategories.STORAGE,
                                        config_data: ASSESMENT_CONFIG_DATA
                                    };
                                    await createDatabaseInstanceConfigData([instanceConfigDataRecord]);

                                    const instanceCRRConfigDataRecord = {
                                        account_id: accountId,
                                        credentials_id: credentialsId,
                                        region,
                                        resource_id: resourceId,
                                        database_instance_id: serverGuid!,
                                        creation_time: new Date(Date.now()),
                                        config_data_type: AssessmentCategories.CRR,
                                        config_data: ASSESSMENT_CRR_CONFIG_DATA
                                    };

                                    await createDatabaseInstanceConfigData([instanceCRRConfigDataRecord]);
                                }

                                let errorMessage = '';
                                if (
                                    sqlInstanceInfo.missingSqlPermissions &&
                                    sqlInstanceInfo.missingSqlPermissions?.length > 0
                                ) {
                                    errorMessage = `SQL Instance permissions ${sqlInstanceInfo.missingSqlPermissions} are required for managing the resource.`;
                                }

                                itemsStatus.push({
                                    databaseInstanceName: dbInst,
                                    databaseInstanceGuid: serverGuid,
                                    status: 'success',
                                    errorMessage
                                });
                            } catch (error) {
                                itemsStatus.push({
                                    databaseInstanceName: dbInst,
                                    status: 'failed',
                                    errorMessage: `${error}`
                                });
                            }
                        }
                    }
                    manageResponse.push({ resourceId, instances: itemsStatus, credentialsId, region, ec2InstanceId });
                } catch (error: any) {
                    const err = `Unable to manage instance '${item.ec2InstanceId}'. Reason: ${error.message}`;
                    manageResponse.push({
                        hostErrorMessage: err,
                        credentialsId: item.credentialsId,
                        region: item.region,
                        ec2InstanceId: item.ec2InstanceId,
                        instances: item.databaseInstanceNames.map(name => ({ databaseInstanceName: name }))
                    });
                }
            })
        )
    );
    updateLongRunningAuditGroup(undefined, undefined, auditlogResponse);

    return { hosts: manageResponse };
}

async function unmanageDatabaseInstance(
    accountId: string,
    credentialsId: string,
    resourceId: string,
    databaseInstanceList: string
) {
    logger.info('Unmanaging SQL Server instances', { accountId, credentialsId, resourceId, databaseInstanceList });

    const databaseInstanceResponse: {
        databaseInstanceId: string;
        status: string;
        errorMessage?: string;
    }[] = [];

    databaseInstanceList = databaseInstanceList.replace(/ /g, '');
    if (databaseInstanceList.length > 0) {
        const databaseInstanceIds = databaseInstanceList.split(',');

        const preDeleteDatabaseInstances = await listDatabaseInstances(accountId, { credentialsId, resourceId });

        const instanceDetails = preDeleteDatabaseInstances.find(
            item => item.database_instance_id === databaseInstanceList
        );
        const {
            items: [resourceDetails]
        } = await getResources(accountId, resourceId, credentialsId);

        updateLongRunningAuditGroup(
            undefined,
            undefined,
            getServerNameWithHostname(
                resourceDetails?.resource_name ?? undefined,
                instanceDetails?.database_instance_name
            )
        );

        await deleteDatabaseInstance(accountId, credentialsId, resourceId, databaseInstanceIds);

        const postDeleteDatabaseInstances = await listDatabaseInstances(accountId, { credentialsId, resourceId });
        databaseInstanceIds.forEach(databaseInstanceId => {
            if (preDeleteDatabaseInstances.some(elem => elem.database_instance_id === databaseInstanceId)) {
                if (postDeleteDatabaseInstances.some(elem => elem.database_instance_id === databaseInstanceId)) {
                    databaseInstanceResponse.push({ databaseInstanceId, status: 'failed' });
                } else {
                    databaseInstanceResponse.push({ databaseInstanceId, status: 'success' });
                }
            } else {
                databaseInstanceResponse.push({
                    databaseInstanceId,
                    status: 'failed',
                    errorMessage: 'Instance does not exist.'
                });
            }
        });

        // When all database instances are removed, the EC2 ceases to be a
        // managed resource, since  we aren't managing any SQL Server instance.
        // So we need to remove the EC2 resource from wlmdb.resource table.
        if (postDeleteDatabaseInstances.length <= 0 && !isDemoFlow) {
            deleteResource(accountId, resourceId, credentialsId);
        }
    }

    return {
        resourceId,
        items: databaseInstanceResponse
    };
}

async function discoverEc2Instances(
    accountId: string,
    credentialsId: string,
    region: string,
    filters: Filter[] = [],
    pageSize?: number,
    nextToken?: string,
    ec2InstanceIds: string[] = []
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
        describeInstancesWithPagination(credentialsId, region, describeInstanceParams, pageSize, nextToken),
        paginatedDescribeVpcs(credentialsId, region, {})
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

    const ec2Instances = ec2InstanceList?.map(ec2Instance => {
        const name = isDemo() ? `sqlnode-${randomize('0', 5)}` : getResourceNameFromTags(ec2Instance?.Tags);
        return {
            ec2InstanceId: ec2Instance?.InstanceId || '',
            ec2InstanceType: ec2Instance?.InstanceType || '',
            ec2InstanceName: name || '',
            ec2UsageOperation: ec2Instance?.UsageOperation || '',
            ssmState: ssmConnectionMap.get(ec2Instance?.InstanceId) || ConnectionStatus.NOT_CONNECTED,
            ebsVolumeIDs: ec2Instance?.BlockDeviceMappings?.map(bdm => bdm?.Ebs?.VolumeId),
            vpc: {
                ...(ec2Instance?.VpcId && { id: ec2Instance?.VpcId }),
                ...(vpcNames.has(ec2Instance?.VpcId) && { name: vpcNames.get(ec2Instance?.VpcId) }),
                ...(vpcCidrs.has(ec2Instance?.VpcId) && { cidrBlock: vpcCidrs.get(ec2Instance?.VpcId) })
            },
            error: undefined
        };
    });

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

    // TODO: Cache this API call
    // This function is expecting credentials, but we can add these permissions to our app and make credId optional.
    // that might reduce the number of calls to user's AWS account.
    const amazonLinuxAmis = await getParametersByPath(credentialsId, region, AMAZON_LINUX_AMI_PATH);
    const al2023ImageId = amazonLinuxAmis?.find(({ Name }) => Name === AL2023_AMI_NAME)?.Value;

    const filters = [
        { Name: 'platform-details', Values: ['Linux/UNIX'] },
        ...(al2023ImageId ? [{ Name: 'image-id', Values: [al2023ImageId] }] : [])
    ];
    const { ec2Instances, NextToken } = await discoverEc2Instances(
        accountId,
        credentialsId,
        region,
        filters,
        pageSize,
        nextToken,
        ec2InstanceIds
    );

    logger.debug('Discovered PostgreSQL resources', { ec2Instances, NextToken });

    type DiscoveredEc2InstanceType = DiscoverPgSqlResponseType & {
        error?: string;
        ebsVolumeIDs: (string | undefined)[] | undefined;
    };

    const ssmNotConnectedEc2Instances: DiscoveredEc2InstanceType[] = ec2Instances.filter(
        ({ ssmState }) => ssmState === ConnectionStatus.NOT_CONNECTED
    );
    const ssmConnectedEc2Instances = ec2Instances.filter(
        ({ ssmState }) => ssmState === ConnectionStatus.CONNECTED
    ) as DiscoveredEc2InstanceType[];

    const ssmCommandInput: SendCommandCommandInput = {
        DocumentName: 'AWS-RunShellScript',
        InstanceIds: compact(ssmConnectedEc2Instances.map(target => target?.ec2InstanceId)),
        Comment: 'Discover PostgreSQL resources',
        Parameters: {
            commands: [discoverPgsqlHosts],
            executionTimeout: [config.get<string>('ssm.execution-timeout')]
        }
    };

    const instancesWithSsmResponse: DiscoverPgSqlResponseType[] = [];

    try {
        const [fsxList, { StorageVirtualMachines: svmList }, subnetList, ebsVolumeList, ssmResponseList] =
            await Promise.all([
                describeFSxFileSystems(credentialsId, region),
                describeFSxStorageVirtualMachines(credentialsId, region),
                paginatedDescribeSubnets(credentialsId, region, {}),
                paginateDescribeEbsVolumes(credentialsId, region, {
                    Filters: [
                        {
                            Name: 'attachment.instance-id',
                            Values: ssmConnectedEc2Instances.map(target => target.ec2InstanceId)
                        }
                    ]
                }),
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

        logger.debug({ fsxList, svmList, subnetList, ebsVolumeList });
        const extractedSsmResponseList = await Promise.all(
            ssmResponseList.map(async ssmResponse => extractSsmResponse(ssmResponse))
        );
        const ssmResponseMap = new Map(
            extractedSsmResponseList.map((response, index) => [ssmResponseList[index].instanceId, response])
        );
        const endPointIpWithFsxInfo = new Map<string, FSxInfo>();
        const fsIdWithFsxInfo = new Map<string, FsxServerConfig>();

        fsxList?.forEach(fsx => {
            const { FileSystemId, StorageType, OntapConfiguration, SubnetIds } = fsx;
            const fsxInfo = {
                fileSystemStorageType: StorageType,
                subnetIds: SubnetIds,
                deploymentType: OntapConfiguration?.DeploymentType
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

        await Promise.all(
            ssmConnectedEc2Instances.map(async ec2Instance => {
                const ssmResponse = ssmResponseMap.get(ec2Instance.ec2InstanceId);
                const output = ssmResponse?.output;
                const error = ssmResponse?.error;
                if (error) {
                    ec2Instance.error = error;
                    return instancesWithSsmResponse.push(ec2Instance);
                }

                let parsedResponse;
                try {
                    parsedResponse = sqlResponseParsing(output || '{}');
                    const {
                        version,
                        nfs_ip_address: nfsIpAddress,
                        ebs_volume_id: localVolumeName,
                        status,
                        hostname,
                        nfs_mount_point: nfsMountPoint,
                        postgres_server: pgSqlServer,
                        database_count: databaseCount,
                        deployment_type: deploymentType,
                        replica_info: replicaInfo,
                        replica_type: replicaType,
                        primary_host: primaryHostIp
                    } = parsedResponse;

                    ec2Instance = {
                        ...ec2Instance,
                        pgsqlServerVersion: isValidProp(version) ? version : undefined,
                        pgsqlServerState: isValidProp(status) ? status : undefined,
                        pgsqlServerName: getPgSqlHostName(hostname, pgSqlServer),
                        pgsqlServerDeploymentType: isValidProp(deploymentType) ? deploymentType : undefined,
                        databaseCount: isValidProp(databaseCount) ? databaseCount : 0,
                        ...(deploymentType === HA && {
                            isPrimary: replicaType === 'primary',
                            primaryNode: await getPrimaryHostDetails(credentialsId, region, primaryHostIp),
                            nodes: await await getReplicaNodes(credentialsId, region, replicaInfo, replicaType)
                        })
                    };

                    ec2Instance.storage = getDiscoveredPgSqlStorageDetails(
                        ec2Instance.ebsVolumeIDs!,
                        endPointIpWithFsxInfo,
                        fsIdWithFsxInfo,
                        subnetListMap,
                        ebsVolumeToAvailabilityZoneMap,
                        nfsIpAddress,
                        localVolumeName,
                        nfsMountPoint
                    );
                    instancesWithSsmResponse.push(ec2Instance);
                } catch (err: unknown) {
                    logger.warn('Failed to parse SSM response', { error: err });
                    ec2Instance.error = err as string;
                    return instancesWithSsmResponse.push(ec2Instance);
                }
            })
        );
    } catch (error: any) {
        logger.error('Failed to discover PostgreSQL resources', { error: error.message });
    }

    return {
        count: ec2Instances.length || 0,
        items: [...ssmNotConnectedEc2Instances, ...instancesWithSsmResponse],
        nextToken: NextToken as string
    };
}

function getDiscoveredPgSqlStorageDetails(
    ebsVolumeIDs: (string | undefined)[],
    endPointIpWithFsxInfo: Map<string, FSxInfo>,
    fsIdWithFsxInfo: Map<string, FsxServerConfig>,
    subnetListMap: Map<string, string>,
    ebsVolumeToAvailabilityZoneMap: Map<string, string>,
    nfsIpAddress?: string,
    localVolumeName?: string,
    nfsMountPoint?: string
) {
    logger.debug('getDiscoveredPgSqlStorageDetails', {
        ebsVolumeIDs,
        endPointIpWithFsxInfo,
        fsIdWithFsxInfo,
        subnetListMap,
        ebsVolumeToAvailabilityZoneMap,
        nfsIpAddress,
        localVolumeName,
        nfsMountPoint
    });

    const ebsVolumeId = ebsVolumeIDs?.find((elem: string | undefined) => elem === localVolumeName);
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

async function getPrimaryHostDetails(credentialsId: string, region: string, primaryHostIp: string) {
    logger.info('Get primary host details', { credentialsId, region, primaryHostIp });
    if (isValidProp(primaryHostIp)) {
        const [hostDetails] = await getInstanceDetailsByPrivateIp(credentialsId, region, [primaryHostIp]);
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
            replicaInfo.map((info: Record<string, string>) => info.client_addr)
        );
    }
}

function getPgSqlHostName(hostname: string, pgSqlServer: string) {
    if (isValidProp(pgSqlServer) && (pgSqlServer === 'localhost' || pgSqlServer === '*') && isValidProp(hostname)) {
        return hostname;
    }

    return pgSqlServer;
}

export {
    getHostAndSqlServerInfo,
    validateAndStoreDiscoveredParameters,
    manageSqlServerV2,
    prepareForManage,
    fetchUnmanagedHostsInformationV2,
    unmanageDatabaseInstance,
    discoverPgSqlResources
};
