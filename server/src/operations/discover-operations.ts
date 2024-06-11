import createError from 'http-errors';
import config from 'config';

import { STORAGE_TYPE, JOBSTATUS, JOBTYPE } from '@prisma/client';
import { FileSystem, FileSystemType } from '@aws-sdk/client-fsx';
import { attempt, compact, uniqBy, isEmpty } from 'lodash-es';
import { DescribeInstancesCommandInput, InstanceStateName, Vpc } from '@aws-sdk/client-ec2';
import { CommandInvocationStatus, ConnectionStatus } from '@aws-sdk/client-ssm';
import throat from 'throat';
import { createResource, deleteDatabaseInstance, listDatabaseInstances } from '../lib/database/db';
import { getResources } from './database/database-operations';
import { describeInstance, paginatedDescribeSubnets, paginatedDescribeVpcs } from '../lib/aws/ec2';
import { getResourceNameFromTags, sleep, getArtifactsRegionBucketName } from '../utils/utils';
import {
    getEc2SqlParameters,
    callSsmExecution,
    getSSMConnectionStatus,
    pollCommandStatus,
    ssmPutParameters
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
    DBCREATE_RELATIVE_PATH,
    STORAGE_PROTOCOLS,
    RESOURCE_PREPARE_JOB_TIMEOUT_MINUTES,
    PSMODULES_RELATIVE_PATH
} from '../utils/consts';
import {
    SQL_SERVER_VERSION_TO_YEAR,
    HOST_AND_SQL_INFO_PS1,
    CLUSTER_NETWORK_IP_INFO_PS1,
    IS_PS7_AVAILABLE,
    UNAVAILABLE_PS_MODULES,
    GET_MISSING_RESOURCE_DETAILS,
    IS_DATABASE_CREATE_POSSIBLE,
    COPY_SCIRPTS_TO_MANAGE_RESOURCE,
    INSTALL_WF_POWERSHELL_PREREQS_PS1,
    REQUIRED_PS_MODULES_FOR_MANAGEMENT,
    FAILURE_INFO,
    ACTIVE_DIRECTORY,
    GET_ACTIVE_DIRECTORY_DETAILS
} from './workloads/mssql/discover-consts';
import { deleteParameters, getParameter, sendSSMCommand } from '../lib/aws/ssm';
import { SSM_RUN_POWERSHELL_SCRIPT_DOC } from './workloads/mssql/const';
import { listFsxOntapCredentials, registerFsxOntapCredentials } from '../lib/cloud-manager/fsx-core';
import { NodeDetails, ResourceDetails, SSMParamterObject } from '../utils/common-types';
import {
    DiscoverMsSqlResponseBodyType,
    SqlServerInstanceInfoType,
    DiscoverResponseInfoType,
    DiscoverCredentialsType
} from '../routes/types/discover.types';
import getLogger from '../utils/logger';
import { describeFSxFileSystems, describeFSxStorageVirtualMachines } from '../lib/aws/fsx';
import { returnInventorydata } from '../utils/demo-utils/demoDefaultUtils';
import { getDatabaseHostSummary, getDatabaseHostSummaryV2 } from './database-hosts-operations';
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

const { getPreSignedUrl } = preSignedUrl;
const logger = getLogger();

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

interface DeployType {
    deploymentType: string | undefined;
    subnetIds: string[] | undefined;
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
    logger.info('getHostAndSqlServerInfo():', { accountId, credentialsId, region, nextToken });
    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        return returnInventorydata(instances);
    }
    let api1StartTime;
    let api1EndTime;

    const describeInstanceParams: DescribeInstancesCommandInput = {
        Filters: [
            { Name: 'platform', Values: ['windows'] },
            { Name: 'architecture', Values: ['x86_64'] },
            { Name: 'instance-state-name', Values: [InstanceStateName.running] }
        ],
        ...(pageSize && { MaxResults: pageSize }),
        ...(nextToken && { NextToken: nextToken })
    };

    // For use cases, where info for specific EC2s is needed
    if (instances.length > 0) {
        describeInstanceParams.Filters?.push({ Name: 'instance-id', Values: instances });
    }

    api1StartTime = performance.now();
    const [{ Reservations, NextToken }, vpcs] = await Promise.all([
        describeInstance(credentialsId, region, describeInstanceParams),
        paginatedDescribeVpcs(credentialsId, region, {})
    ]);

    const vpcNames = new Map(vpcs?.map(({ Tags, VpcId }: Vpc) => [VpcId, getResourceNameFromTags(Tags)]));
    const vpcCidrs = new Map(vpcs?.map(({ CidrBlock, VpcId }: Vpc) => [VpcId, CidrBlock]));

    api1EndTime = performance.now();
    logger.info(`API1Performance: Time taken by describeInstance(): ${api1EndTime - api1StartTime}ms`);

    const ec2instanceList = Reservations?.flatMap(reservation => reservation.Instances);

    const ssmTargets: SsmTargetsInfo[] = [];
    api1StartTime = performance.now();
    await Promise.all(
        (ec2instanceList || []).map(async ec2Instance => {
            const name = getResourceNameFromTags(ec2Instance?.Tags);
            const ssmStatus = await getSSMConnectionStatus(credentialsId, region, ec2Instance?.InstanceId || '');
            ssmTargets.push({
                ec2InstanceId: ec2Instance?.InstanceId || '',
                ec2InstanceType: ec2Instance?.InstanceType || '',
                ec2InstanceName: name!,
                ec2UsageOperation: ec2Instance?.UsageOperation || '',
                ssmState: ssmStatus.Status!,
                ebsVolumeIDs: ec2Instance?.BlockDeviceMappings?.map(bdm => bdm?.Ebs?.VolumeId),
                vpc: {
                    ...(ec2Instance?.VpcId && { id: ec2Instance?.VpcId }),
                    ...(vpcNames.has(ec2Instance?.VpcId) && { name: vpcNames.get(ec2Instance?.VpcId) }),
                    ...(vpcCidrs.has(ec2Instance?.VpcId) && { cidrBlock: vpcCidrs.get(ec2Instance?.VpcId) })
                }
            });
        })
    );
    api1EndTime = performance.now();
    logger.info(
        `API1Performance: Time taken for connectionStatus, Tag and ssmTarget finding: ${api1EndTime - api1StartTime}ms`
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
        api1EndTime = performance.now();
        const commandId = await makeSsmCall(
            credentialsId,
            region,
            HOST_AND_SQL_INFO_PS1,
            ssmConnectedNodes.map(target => target.ec2InstanceId),
            accountId
        );
        api1EndTime = performance.now();
        logger.info(
            `API1Performance: Time taken by makeSsmCall() for multiple targets: ${api1EndTime - api1StartTime}ms`
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
        const [fsxList, svmList, subnetList] = await Promise.all([
            describeFSxFileSystems(credentialsId, region),
            describeFSxStorageVirtualMachines(credentialsId, region),
            paginatedDescribeSubnets(credentialsId, region, {})
        ]);
        api1EndTime = performance.now();
        logger.info(`API1Performance: Time taken by describe FSxFS/SVM: ${api1EndTime - api1StartTime}ms`);

        const endPointIpWithFsxInfo = new Map<string, FSxInfo>();
        const fsIdWithDeploymentType = new Map<string, DeployType>();
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
            const { OntapConfiguration, SubnetIds } =
                fsxList.find((fsx: FileSystem) => fsx?.FileSystemId === fsId) || {};
            fsIdWithDeploymentType.set(fsId!, {
                deploymentType: OntapConfiguration?.DeploymentType,
                subnetIds: SubnetIds!
            });
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
            });

        api1EndTime = performance.now();
        logger.info(`API1Performance: Endpoint/FSx/Deployment map creation time: ${api1EndTime - api1StartTime}ms`);

        const subnetListMap = new Map(subnetList?.map(subnet => [subnet.SubnetId, subnet.AvailabilityZone]));

        // PS execution would take some time, so we wait for a second before triggering polling.
        //
        // NOTE:
        //  Getting FSx filesystems and SVMs will take some time, which could serve the
        // purpose of sleep() below.  Since  PowerShell script takes some time to complete,
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
                        fsIdWithDeploymentType,
                        subnetListMap
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
        nextToken: NextToken,
        items: [...ssmNotConnectedEc2ResponseInfo, ...ssmConnectedEc2ResponseInfo]
    };
}

async function getHostAndSqlInfoFromPsOutput(
    credentialsId: string,
    region: string,
    ssmTarget: SsmTargetsInfo,
    commandId: string,
    endPointIpWithFsxInfo: Map<string, FSxInfo>,
    fsIdWithDeploymentType: Map<string, DeployType>,
    subnetListMap: Map<string | undefined, string | undefined>
): Promise<SqlServerInstanceInfoType[]> {
    const commandInvocationParam = {
        CommandId: commandId,
        InstanceId: ssmTarget.ec2InstanceId
    };

    let api1StartTime;
    let api1EndTime;

    api1StartTime = performance.now();
    const [ssmResponse, ec2SqlParametersInfo] = await Promise.all([
        pollCommandStatus(credentialsId, region, commandInvocationParam),
        getEc2SqlParameters(credentialsId, region, ssmTarget.ec2InstanceId)
    ]);

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
        logger.error(`SSM command ${commandId} execution  timed out on node ${ssmTarget.ec2InstanceId}`);
    }

    api1EndTime = performance.now();
    logger.info(
        `API1Performance: pollCommandStatus time for target ${ssmTarget.ec2InstanceId}: ${
            api1EndTime - api1StartTime
        }ms`
    );

    const ssmTargetSqlServerInstancesInfo: SqlServerInstanceInfoType[] = [];

    try {
        const powerShellScriptOutput = ssmResponse?.StandardOutputContent || '';

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
                        const ebsVolumeId = ebsVolumeIDs?.find(elem => di?.SerialNumberOrScsiTarget?.includes(elem));
                        const volIdRegex = /^(vol)([a-zA-Z0-9]+)/; // volumeId derived from SerialNumberOrScsiTarget is of the format,vol012ab34ed, but, AWS ebs volume IDs are always in vol-012ab34ed format, so we need to convert it to the correct format.
                        if (ebsVolumeId) {
                            storageTypes.push({
                                type: STORAGE_TYPE.EBS,
                                id: volIdRegex.test(ebsVolumeId)
                                    ? ebsVolumeId.replace(volIdRegex, '$1-$2')
                                    : ebsVolumeId // convert the volumeId to the correct format.
                            });
                        } else if (endPointIpWithFsxInfo.has(di?.SerialNumberOrScsiTarget)) {
                            const { fsxId, svmId } = endPointIpWithFsxInfo.get(di?.SerialNumberOrScsiTarget)!;

                            storageTypes.push({
                                type: STORAGE_TYPE.FSXN,
                                id: fsxId!,
                                svmId,
                                protocol: STORAGE_PROTOCOLS.ISCSI
                            });

                            const { deploymentType, subnetIds } = fsIdWithDeploymentType.get(fsxId!) || {};

                            deploymentTypes.push({
                                type: deploymentType,
                                zones: compact(subnetIds?.map(subnetId => subnetListMap.get(subnetId))),
                                ids: subnetIds?.join()
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
                            const matchedEndpoints = fsxEndpoints.filter(value =>
                                targets.includes(value.toLowerCase())
                            );

                            if (!isEmpty(matchedEndpoints)) {
                                const fsxType = endPointIpWithFsxInfo.get(matchedEndpoints[0])?.type;
                                if (fsxType === FileSystemType.WINDOWS) {
                                    storageTypes.push({
                                        type: STORAGE_TYPE.FSXW,
                                        id: endPointIpWithFsxInfo.get(matchedEndpoints[0])?.fsxId,
                                        protocol: STORAGE_PROTOCOLS.SMB
                                    });
                                } else {
                                    storageTypes.push({
                                        type: STORAGE_TYPE.FSXN,
                                        id: endPointIpWithFsxInfo.get(matchedEndpoints[0])?.fsxId,
                                        svmId: endPointIpWithFsxInfo.get(matchedEndpoints[0])?.svmId,
                                        protocol: STORAGE_PROTOCOLS.SMB
                                    });
                                }
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
                        sqlServerNodes,
                        nodeIps,
                        sqlServerInstance,
                        sqlServerState,
                        isDefaultInstance,
                        windowsAuthentication,
                        scriptExecutionTime,
                        databaseCount,
                        failureInfo,
                        sqlServerDeploymentType
                    } = sqlServerInstanceInfo;
                    logger.info(
                        `API1Performance: Time taken to execute PowerShell script for instance ${sqlServerInstance}: ${scriptExecutionTime}ms`
                    );

                    if (!Array.isArray(sqlServerNodes)) {
                        sqlServerNodes = [sqlServerNodes];
                    }

                    const sqlServerAuthentication = ec2SqlParametersInfo.some(
                        (elem: { sqlinstancename: string }) => elem.sqlinstancename === sqlServerInstance
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
                        isDefaultInstance,
                        ...(failureInfo && { failureInfo }),
                        windowsAuthentication,
                        sqlServerAuthentication,
                        storage: compact(uniqBy(storageTypes, v => [v.id, v.svmId, v.protocol].join())),
                        deploymentTypes: compact(
                            uniqBy(deploymentTypes, 'ids').map(({ type, zones }) => ({ type, zones }))
                        ),
                        ...(databaseCount && { databaseCount })
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
        }
    };

    let commandId;
    try {
        commandId = await sendSSMCommand(credentialsId, region, params, accountId);
        logger.info('SSM command ID:', commandId);
    } catch (error) {
        logger.error(`Failed to start EC2 instance information retrieval using sendSSMCommand. Reason: ${error}`);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Failed to start information retrieval from EC2 instances. Reason: ${error}`
        );
    }
    return commandId;
}

function prepareParametersToStore(instanceId: string, credentials: DiscoverCredentialsType[]) {
    logger.debug('prepare parameters to store', { instanceId });

    return credentials.reduce((acc: SSMParamterObject[], { resourceId, resourceType, username, password }) => {
        if (resourceType === RESOURCESTYPE.MSSQL) {
            const sqlItem = acc.find(el => el.value.sql);

            if (sqlItem && Array.isArray(sqlItem)) {
                sqlItem.push({
                    sqlinstancename: resourceId,
                    username,
                    password
                });
            } else {
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
                });
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
    credentials: DiscoverCredentialsType[]
) {
    logger.info('Validate and Put SSM parameters', { accountId, credentialsId, region, instanceId });

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

        const fsxCredentials = credentials.find(cred => cred.resourceType === RESOURCESTYPE.FSX);
        const sqlCredentials = credentials.filter(cred => cred.resourceType === RESOURCESTYPE.MSSQL);
        if (isEmpty(fsxCredentials) && isEmpty(sqlCredentials)) {
            throw new Error('Credentials cannot be empty');
        }

        const detectResponse = await validateCredentials(
            credentialsId,
            region,
            instanceId,
            fsxCredentials,
            sqlCredentials
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

async function fetchUnmanagedHostsInformation(
    accountId: string,
    credentialsId: string,
    region: string,
    instances: string[] = []
) {
    logger.info('Fetching hosts information:', { accountId, credentialsId, region, instances });

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

    const errorInstances: {
        id: string;
        name: string;
        status: string;
        errors: string;
        sqlServerDeploymentType?: string;
        clusterNodeDetails?: NodeDetails[];
    }[] = [];

    await Promise.all(
        ec2HostDetails?.map(async ec2Instance => {
            const [{ nodeIps, sqlServerDeploymentType }] = ec2Instance?.sqlServerInstances || [];
            let clusterNodeDetails: NodeDetails[] = [];
            if (
                (sqlServerDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT ||
                    sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT) &&
                nodeIps
            ) {
                clusterNodeDetails = (await getInstanceDetailsByPrivateIp(credentialsId, region, nodeIps)) || [];
            }
            const sqlServerInstance = ec2Instance?.sqlServerInstances?.find(
                sqlInstance => sqlInstance.sqlServerState === 'Running'
            );
            // ec2Instance?.sqlServerInstances?.forEach(sqlInstance => { // skipping this loop as we are only considering the first running sql instance in the ec2 instance. This needs to be enabled when we support multiple sql instances in an ec2 instance.
            if (!isEmpty(sqlServerInstance)) {
                const { storage } = sqlServerInstance;
                let ebsVolumeIds: string[] | undefined = [];
                let fsxwId: string | undefined;
                let fsxnId: string | undefined;
                storage?.forEach(({ type, id }) => {
                    // if there are multiple entries in storage for the same type then only the last entry will be considered. For eg: if the same sql instance has fsxn-1 and fsxn-2, then only fsxn-2 will be considered. Such a scenario occurs when system dbs use one storage and user dbs use another storage. The reason for this limitation currently is wlmdb resources are not expecting multiple co-relation ids for the same resource.
                    // If the storage is of different type, then both will be considered while calculating protection and storage savings details.
                    ebsVolumeIds = type === STORAGE_TYPE.EBS ? ebsVolumeIds?.concat(id) : ebsVolumeIds;
                    fsxwId = type === STORAGE_TYPE.FSXW ? id : fsxwId;
                    fsxnId = type === STORAGE_TYPE.FSXN ? id : fsxnId;
                });

                resourceDetailsList.push({
                    id: null,
                    account_id: accountId,
                    resource_id: ec2Instance.ec2InstanceId,
                    resource_type: RESOURCESTYPE.MSSQL,
                    resource_name: ec2Instance.ec2InstanceName || ec2Instance.ec2InstanceId,
                    cloud_provider_name: CloudProviders.AWS,
                    co_relation_id: fsxnId || null,
                    cloud_provider_account_id: null,
                    region,
                    credentials_id: credentialsId,
                    storage_type: fsxnId ? STORAGE_TYPE.FSXN : fsxwId ? STORAGE_TYPE.FSXW : STORAGE_TYPE.EBS,
                    metadata: {
                        creationDate: Date.now(),
                        node1InstanceId: ec2Instance.ec2InstanceId
                    },
                    ebsVolumeIds,
                    fsxwId,
                    sqlServerDeploymentType,
                    clusterNodeDetails
                });
            } else {
                errorInstances.push({
                    id: ec2Instance.ec2InstanceId,
                    name: ec2Instance.ec2InstanceId,
                    sqlServerDeploymentType,
                    ...(clusterNodeDetails && { clusterNodeDetails }),
                    status: 'Down',
                    errors: 'No active SQL Server instances found'
                });
            }
            // });
        })
    );

    let response = await Promise.all(
        resourceDetailsList.map(async resourceDetail =>
            getDatabaseHostSummary(
                accountId,
                resourceDetail.resource_id,
                'serverDetails,topology,performance,usageEstimation,storage,protection',
                resourceDetail,
                false // unmanaged host
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

async function fetchUnmanagedHostsInformationV2(
    accountId: string,
    credentialsId: string,
    region: string,
    instances: string[] = []
) {
    logger.info('Fetching hosts information:', { accountId, credentialsId, region, instances });

    // Modified implementation to fetch SQL Server instance details for EC2 instances with underlying storage details. The code now accepts instances ID array instead of object with ec2InstanceId and storageType. If there are multiple sql instances in an ec2 instance, the code will return multiple resource details for the same ec2 instance. Every item in resourceDetailsList is an ec2 instance - sql instance pair with storage type.

    const { items: ec2HostDetails } = await getHostAndSqlServerInfo(
        accountId,
        credentialsId,
        region,
        undefined,
        undefined,
        instances
    );
    let resourceDetailsList: ResourceDetails[] = [];

    const errorInstances: DatabaseHostSummaryForMultiInstanceResponseType[] = [];

    await Promise.all(
        ec2HostDetails?.map(async ec2Instance => {
            const [{ nodeIps, sqlServerDeploymentType }] = ec2Instance?.sqlServerInstances || [];
            let clusterNodeDetails: NodeDetails[] = [];
            if (
                (sqlServerDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT ||
                    sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT) &&
                nodeIps
            ) {
                clusterNodeDetails = (await getInstanceDetailsByPrivateIp(credentialsId, region, nodeIps)) || [];
            }
            let resourceDetails: ResourceDetails = {
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
                databaseInstanceDetails: []
            };
            if (ec2Instance?.sqlServerInstances && ec2Instance?.sqlServerInstances.length > 0) {
                ec2Instance?.sqlServerInstances?.forEach(sqlServerInstance => {
                    // skipping this loop as we are only considering the first running sql instance in the ec2 instance. This needs to be enabled when we support multiple sql instances in an ec2 instance.
                    const { storage } = sqlServerInstance;
                    let ebsVolumeIds: string[] | undefined = [];
                    let fsxwId: string | undefined;
                    let fsxnId: string | undefined;
                    storage?.forEach(({ type, id }) => {
                        // if there are multiple entries in storage for the same type then only the last entry will be considered. For eg: if the same sql instance has fsxn-1 and fsxn-2, then only fsxn-2 will be considered. Such a scenario occurs when system dbs use one storage and user dbs use another storage. The reason for this limitation currently is wlmdb resources are not expecting multiple co-relation ids for the same resource.
                        // If the storage is of different type, then both will be considered while calculating protection and storage savings details.
                        ebsVolumeIds = type === STORAGE_TYPE.EBS ? ebsVolumeIds?.concat(id) : ebsVolumeIds;
                        fsxwId = type === STORAGE_TYPE.FSXW ? id : fsxwId;
                        fsxnId = type === STORAGE_TYPE.FSXN ? id : fsxnId;
                    });
                    
                    resourceDetails.ebsVolumeIds = ebsVolumeIds
                    resourceDetails.databaseInstanceDetails?.push({
                        database_instance_id: sqlServerInstance.sqlServerInstance,
                        database_instance_name: sqlServerInstance.sqlServerInstance,
                        database_type: RESOURCESTYPE.MSSQL,
                        is_default: sqlServerInstance.isDefaultInstance,
                        instanceState: sqlServerInstance.sqlServerState,
                        region,
                        credentials_id: credentialsId,
                        metadata: { userDatabase: [] },
                        fsxn_ids: fsxnId || '',
                        fsxwId,
                        ebsVolumeIds,
                        database_deployment_type: sqlServerInstance.sqlServerDeploymentType
                    });
                });
                resourceDetailsList.push(resourceDetails);
            } else {
                errorInstances.push({
                    id: ec2Instance.ec2InstanceId,
                    name: ec2Instance.ec2InstanceId,
                    nodeStatus: 'Down',
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

async function manageSqlServer(accountId: string, credentialsId: string, region: string, ec2InstanceId: string) {
    logger.info('Manage EC2 hosting SQL Server', { accountId, credentialsId, region, ec2InstanceId });

    if (isEmpty(ec2InstanceId)) {
        throw createError(
            HttpErrorCodes.VALIDATION_ERROR,
            `Unable to manage instance '${ec2InstanceId}'. Reason: empty instance ID.`
        );
    }

    const ssmStatus = await getSSMConnectionStatus(credentialsId, region, ec2InstanceId);
    if (ssmStatus.Status === ConnectionStatus.NOT_CONNECTED) {
        throw createError(
            HttpErrorCodes.VALIDATION_ERROR,
            `Unable to manage instance '${ec2InstanceId}'. Reason: no SSM connectivity.`
        );
    }

    const missingResourceInfo = await callSsmExecution(
        credentialsId,
        region,
        GET_MISSING_RESOURCE_DETAILS,
        ec2InstanceId,
        accountId
    );
    logger.debug('Missing resource info', missingResourceInfo);
    const missingResourceResponse = JSON.parse(missingResourceInfo!);

    if (missingResourceResponse[IS_PS7_AVAILABLE] === false) {
        throw createError(
            HttpErrorCodes.FAILED_DEPENDENCY,
            'PowerShell 7 is required for managing the resource. Install it manually by referring to https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-windows?view=powershell-7.4 and retry the operation.'
        );
    } else if (missingResourceResponse[UNAVAILABLE_PS_MODULES]) {
        throw createError(
            HttpErrorCodes.FAILED_DEPENDENCY,
            `PowerShell modules ${missingResourceResponse[UNAVAILABLE_PS_MODULES]} are required for managing the resource. Install them manually by referring to https://learn.microsoft.com/en-us/powershell/scripting/developer/module/installing-a-powershell-module?view=powershell-7.4) or using the API "/accounts/{accountId}/wlmdb/v1/credentials/{credentialsId}/regions/{region}/instances/{instanceId}/mssql/prepare", and retry the operation.`
        );
    } else if (missingResourceResponse[IS_DATABASE_CREATE_POSSIBLE] === false) {
        throw createError(
            HttpErrorCodes.FAILED_DEPENDENCY,
            'Files required for database operations are not available. Install them using the API "/accounts/{accountId}/wlmdb/v1/credentials/{credentialsId}/regions/{region}/instances/{instanceId}/mssql/prepare", and retry the operation.'
        );
    }

    const [discoverInfo, clusterNetworkIpDetails, ec2Details, adDetails] = await Promise.all([
        getHostAndSqlServerInfo(accountId, credentialsId, region, undefined, undefined, [ec2InstanceId]),
        callSsmExecution(credentialsId, region, CLUSTER_NETWORK_IP_INFO_PS1, ec2InstanceId, accountId),
        describeInstance(credentialsId, region, { InstanceIds: [ec2InstanceId] }),
        callSsmExecution(credentialsId, region, GET_ACTIVE_DIRECTORY_DETAILS, ec2InstanceId, accountId)
    ]);

    const awsAccountId = ec2Details?.Reservations?.[0]?.Instances?.[0]?.IamInstanceProfile?.Arn?.split(':')[4];

    if (isEmpty(awsAccountId)) {
        logger.error('Failed to get AWS account ID: ', ec2Details);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Unable to manage instance '${ec2InstanceId}'. Reason: failed to get AWS account ID.`
        );
    }

    if (clusterNetworkIpDetails?.includes(FAILURE_INFO)) {
        logger.error(
            `Failed to get cluster network interface details for EC2 ${ec2InstanceId}. Reason: ${clusterNetworkIpDetails}`
        );
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Unable to manage instance '${ec2InstanceId}'. Reason: failed to get network interface details.`
        );
    }

    if (isEmpty(adDetails) || adDetails?.includes(FAILURE_INFO)) {
        logger.error(`Failed to get Active Directory details for EC2 ${ec2InstanceId}. Reason: ${adDetails}`);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Unable to manage instance '${ec2InstanceId}'. Reason: Failed to Active Directory details.`
        );
    }

    const clusterNetworkIpDetailsInJson: { clusterNetworkIps: string[] } = JSON.parse(clusterNetworkIpDetails!);

    const node1InstanceId = ec2InstanceId;
    let node2InstanceId;
    if (clusterNetworkIpDetailsInJson.clusterNetworkIps.length > 1) {
        // FCI environment
        const describeInstanceParams: DescribeInstancesCommandInput = {
            Filters: [{ Name: 'private-ip-address', Values: clusterNetworkIpDetailsInJson.clusterNetworkIps }]
        };

        const { Reservations } = await describeInstance(credentialsId, region, describeInstanceParams);
        const instances = Reservations?.flatMap(elem => elem.Instances);
        instances?.forEach(elem => {
            if (elem?.InstanceId !== ec2InstanceId) {
                node2InstanceId = elem?.InstanceId;
            }
        });
    }

    /* Resource ID is obtained either by one instanceID (in case of standalone
       deployment) or by combining instanceIDs of both node1 and node (in case
       of FCI deployment).  FCI resourceID can be a hash of inst1ID+inst2ID or
       inst2ID+inst1.  Since a resource would have been regisered with either
       of the instance IDs,  we check need to verify the hash for both
       combinations.
    */
    const resourceId = getMsSqlResourceId(node1InstanceId, node2InstanceId);
    const resourceId2 = getMsSqlResourceId(node2InstanceId || '', node1InstanceId);
    const [
        {
            items: [resourceDetails1]
        },
        {
            items: [resourceDetails2]
        }
    ] = await Promise.all([
        getResources(accountId, resourceId, credentialsId, region),
        getResources(accountId, resourceId2, credentialsId, region)
    ]);

    if (!isEmpty(resourceDetails1) || !isEmpty(resourceDetails2)) {
        throw createError(HttpErrorCodes.VALIDATION_ERROR, 'Instances are already managed by Workload Factory.');
    }

    await validateEc2InstanceManageability(discoverInfo, ec2InstanceId);

    const [item] = discoverInfo.items;
    const [sqlServerInstance] = item?.sqlServerInstances || [];
    const { storage } = sqlServerInstance;
    const storageInfo = storage?.find(elem => elem.type === STORAGE_TYPE.FSXN);
    const storageProtocols = storage?.filter(elem => elem.type === STORAGE_TYPE.FSXN).map(elem => elem.protocol);

    verifyAndAddFSxOntapCredentials(
        accountId,
        credentialsId,
        region,
        discoverInfo?.items?.[0].sqlServerInstances?.[0]?.storage
    );

    const fsxStorage = storage?.find(elem => elem.type === STORAGE_TYPE.FSXN);

    tagResources(credentialsId, region, awsAccountId!, accountId, fsxStorage!.id, node1InstanceId, node2InstanceId);

    const { domainName: activeDirectoryDomainName, ipAddresses: activeDirectoryIpAddresses } = JSON.parse(adDetails!)[
        ACTIVE_DIRECTORY
    ];

    try {
        // Register the resource
        await createResource(accountId, {
            resourceId,
            credentialsId,
            storageType: STORAGE_TYPE.FSXN,
            resourceName: sqlServerInstance?.sqlServerName,
            cloudProviderAccountId: awsAccountId!,
            cloudProviderName: CloudProviders.AWS,
            resourceType: RESOURCESTYPE.MSSQL,
            coRelationId: storageInfo?.id,
            region,
            metadata: {
                creationDate: Date.now(),
                node1InstanceId,
                node2InstanceId,
                sqlDeploymentType:
                    (sqlServerInstance?.sqlServerNodes?.length || 1) === 1
                        ? SqlServerDeploymentModel.SQL_STANDALONE_SHORT
                        : SqlServerDeploymentModel.SQL_FCI_SHORT,
                source: RESOURCE_SOURCE.DISCOVER,
                fsxSvmId: storageInfo?.svmId,
                storageProtocol: storageProtocols ? storageProtocols.join() : '',
                ...(activeDirectoryDomainName && { activeDirectoryName: activeDirectoryDomainName }),
                ...(activeDirectoryIpAddresses && { activeDirectoryAddress: activeDirectoryIpAddresses.join() })
            }
        });
    } catch (error) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Unable to manage instance '${ec2InstanceId}'. Failed to create resource. Reason: ${error}`
        );
    }

    return {
        resourceId
    };
}

async function validateEc2InstanceManageability(discoverInfo: DiscoverMsSqlResponseBodyType, ec2InstanceId: string) {
    logger.debug('Is EC2 instance manageable', discoverInfo);

    try {
        const { count, items } = discoverInfo;

        if (count <= 0) {
            throw new Error(
                'only existing instances in running state, have Microsoft Windows as host operating system, architecture is x86_64, and hosting SQL Server 2016 above can be managed. Ensure valid instance ID is provided'
            );
        }

        const { ssmState, sqlServerInstances } = items[0];
        if (ssmState === ConnectionStatus.NOT_CONNECTED) {
            throw new Error('no SSM connectivity');
        }

        if (isEmpty(sqlServerInstances)) {
            throw new Error('no SQL Server instances found');
        }

        if (
            sqlServerInstances!.some(elem => elem.sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT)
        ) {
            throw new Error('Always On Availability Group environments are not supported');
        }

        // Current supported configuration is expected to be one SQL Server instance per EC2.
        // If the EC2 has more than one SQL Server instance, we are considering only the first one.
        const { windowsAuthentication, sqlServerAuthentication, storage, sqlServerNodes, sqlServerInstance } =
            sqlServerInstances![0] as SqlServerInstanceInfoType;

        if (windowsAuthentication === false && sqlServerAuthentication === false) {
            throw new Error(
                // eslint-disable-next-line quotes
                `authentication to SQL Server instance isn't possible. Check if the SQL Server service is running, stored credentials are valid, or windows authentication is disabled`
            );
        }

        if (isEmpty(storage) || !storage?.some(elem => elem.type === STORAGE_TYPE.FSXN)) {
            throw new Error(`SQL Server instance '${sqlServerInstance}' isn't hosted on FSx for ONTAP`);
        }

        logger.debug(sqlServerNodes);
        // Validate and error out if
        // - any of the nodes are down; nodes should be up for copying various scripts.
        // - instances are already managed
    } catch (error: any) {
        throw createError(
            HttpErrorCodes.VALIDATION_ERROR,
            `Unable to manage instance '${ec2InstanceId}'. Reason: ${error.message}.`
        );
    }
}

async function validateCredentials(
    credentialsId: string,
    region: string,
    instanceId: string,
    fsxCredentials: DiscoverCredentialsType | undefined,
    sqlCredentials: DiscoverCredentialsType[]
) {
    logger.info('validateCredentials', { instanceId, fsxCredentials, sqlCredentials });

    await verifyAndCreateCredentials(credentialsId, region, instanceId, fsxCredentials, sqlCredentials);

    const connectionStatus = await getSSMConnectionStatus(credentialsId, region, instanceId);
    if (connectionStatus.Status !== ConnectionStatus.CONNECTED) {
        const errorMessage = `Unable to validate the credentials through SSM, for host ${instanceId}`;
        logger.error(errorMessage);

        await deleteSSMParameter(credentialsId, region, [
            `${SSM_PARAM_PREFIX}${fsxCredentials?.resourceId}`,
            `${SSM_PARAM_PREFIX}${instanceId}`
        ]);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    let command = '$WarningPreference = "SilentlyContinue";';

    if (fsxCredentials || sqlCredentials.length) {
        // Get signed url for aws_ssm.zip to install the ps modules
        const bucketname = getArtifactsRegionBucketName(region);
        const copyPSModuleS3SignedUrl = await getPreSignedUrl(region, bucketname, PSMODULES_RELATIVE_PATH);
        const moduleNames = `
  'AWS.Tools.Common',
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

    const ssmresponse = await callSsmExecution(credentialsId, region, [command], instanceId, undefined, false);

    const cleanResponse = ssmresponse?.replaceAll('\r\n', '');
    let parsedResponse = attempt(JSON.parse, cleanResponse);

    parsedResponse = parsedResponse instanceof Error ? undefined : parsedResponse;

    if (!parsedResponse) {
        throw new Error(`Failed to validate credentials. Reason: ${cleanResponse}`);
    }

    const response: Record<string, string> = {};
    const paramesToDelete: string[] = [];

    if (parsedResponse.requiredModuleError) {
        response.requiredModuleError = parsedResponse.requiredModuleError;
    } else {
        if (fsxCredentials && parsedResponse.ontapconnectivity === false) {
            paramesToDelete.push(`${SSM_PARAM_PREFIX}${fsxCredentials.resourceId}`);
            response.fsxnError = parsedResponse?.ontaperror;
        }

        if (sqlCredentials.length) {
            if (parsedResponse.sqlInstanceConnectivity === false) {
                paramesToDelete.push(`${SSM_PARAM_PREFIX}${instanceId}`);
                response.sqlServerError = parsedResponse?.sqlerror;
            } else if (parsedResponse.sqlInstanceConnectivity === true) {
                response.sqlServerEdition = parsedResponse?.sqlEdition;
                response.databaseCount = parsedResponse?.noOfDatabases;
            }
        }
    }

    await deleteSSMParameter(credentialsId, region, paramesToDelete);

    return response;
}

async function verifyAndCreateCredentials(
    credentialsId: string,
    region: string,
    instanceId: string,
    fsxCredentials: DiscoverCredentialsType | undefined,
    sqlCredentials: DiscoverCredentialsType[]
) {
    logger.info('verifyAndCreateCredentials', { instanceId, fsxCredentials, sqlCredentials });

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
        const SSMParameters = await getParameter(credentialsId, region, `${SSM_PARAM_PREFIX}${instanceId}`);
        if (!SSMParameters) {
            const newSSMParameters: string[] = await getAsyncLocalStorageResource(NEW_SSM_PARAMETERS);
            setAsyncLocalStorageResource(NEW_SSM_PARAMETERS, [...(newSSMParameters || []), instanceId]);
        }
    }

    const creds = prepareParametersToStore(instanceId, [
        ...(fsxCredentials ? [fsxCredentials] : []),
        ...sqlCredentials
    ]);
    await ssmPutParameters(credentialsId, region, creds);
}

async function deleteSSMParameter(credentialsId: string, region: string, ssmParameterNames: string[]) {
    logger.info('deleteSSMParameter', { ssmParameterNames });

    const newlyAddedSSMParameters: string[] = await getAsyncLocalStorageResource(NEW_SSM_PARAMETERS);
    if (!isEmpty(newlyAddedSSMParameters) && !isEmpty(ssmParameterNames)) {
        const filteredSSMParameters = (ssmParameterNames || []).filter(param =>
            (newlyAddedSSMParameters || []).includes(param)
        );

        if (filteredSSMParameters?.length) {
            await deleteParameters(credentialsId, region, filteredSSMParameters);
        }
    }
}

async function verifyAndAddFSxOntapCredentials(
    accountId: string,
    credentialsId: string,
    region: string,
    storage: SqlServerInstanceInfoType['storage']
) {
    logger.info('verifyAndAddFSxOntapCredentials', { storage });

    const fsxStorage = storage?.find(elem => elem.type === STORAGE_TYPE.FSXN);
    if (fsxStorage) {
        // Check if the FSx credentials are already present in SSM parameter store
        const fsxCredentials = await getParameter(credentialsId, region, `${SSM_PARAM_PREFIX}${fsxStorage.id}`);

        if (!fsxCredentials) {
            let credentials;

            try {
                ({ credentials } = await listFsxOntapCredentials(accountId, fsxStorage?.id));

                if (isEmpty(credentials)) {
                    throw new Error('FSx for ONTAP storage credentials not found');
                }
            } catch (error: any) {
                throw createError(
                    HttpErrorCodes.INTERNAL_SERVER_ERROR,
                    `Unable to manage the instance. Reason: FSx for ONTAP storage '${fsxStorage.id}' isn't registered with FSxN core service.`
                );
            }

            const preparedCreds = prepareParametersToStore('', [
                {
                    resourceId: fsxStorage.id,
                    resourceType: RESOURCESTYPE.FSX,
                    username: credentials?.userName,
                    password: credentials?.password
                }
            ]);

            await ssmPutParameters(credentialsId, region, preparedCreds);
        }
    }
}

async function prepareForManage(accountId: string, credentialsId: string, region: string, ec2InstanceId: string) {
    logger.info('Prepare for manage:', { accountId, credentialsId, region });

    const ssmState = await getSSMConnectionStatus(credentialsId, region, ec2InstanceId);
    if (ssmState.Status === ConnectionStatus.NOT_CONNECTED) {
        throw createError(
            HttpErrorCodes.SERVICE_UNAVAILABLE,
            `Unable to prepare instance '${ec2InstanceId}' for management. Reason: no SSM connectivity.`
        );
    }

    // Check if any job is already running for the same purpose.
    const jobFilterParams = {
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: ec2InstanceId,
        typeFilter: JOBTYPE.PREPARE_RESOURCE
    };
    const {
        items: [job]
    } = await getJobs(accountId, credentialsId, region, jobFilterParams);
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
        name: `Prepare EC2 '${ec2InstanceId}' for management`,
        startTime: Date.now(),
        description: `Prepare EC2 '${ec2InstanceId}' for management by Workload Factory database operations`
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

    await updateJobDetails(accountId, credentialsId, region, parentJobId, {
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
        // Get signed url for dbcreate.zip
        const bucketname = getArtifactsRegionBucketName(region);
        const dbcreateS3SignedUrl = await getPreSignedUrl(region, bucketname, DBCREATE_RELATIVE_PATH);

        // Copy scripts to the EC2 instance
        const ssmScriptsCopyResponse = await callSsmExecution(
            credentialsId,
            region,
            COPY_SCIRPTS_TO_MANAGE_RESOURCE(dbcreateS3SignedUrl),
            ec2InstanceId,
            accountId,
            false,
            (RESOURCE_PREPARE_JOB_TIMEOUT_MINUTES * 60).toString()
        );

        logger.info(`Response for copy scripts using PowerShell for ${ec2InstanceId}: ${ssmScriptsCopyResponse}`);

        if (ssmScriptsCopyResponse?.includes('failureInfo')) {
            const responseInJson = JSON.parse(ssmScriptsCopyResponse);
            logger.error(
                `Unable to prepare instance '${ec2InstanceId}'. Reason: failed to copy database operation artifacts. Error: ${ssmScriptsCopyResponse}`
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
    await updateJobDetails(accountId, credentialsId, region, childJobId, jobStatusRecord);

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
        const ssmPsModuleInstallResponse = await callSsmExecution(
            credentialsId,
            region,
            INSTALL_WF_POWERSHELL_PREREQS_PS1(REQUIRED_PS_MODULES_FOR_MANAGEMENT),
            ec2InstanceId,
            accountId,
            false,
            (RESOURCE_PREPARE_JOB_TIMEOUT_MINUTES * 60).toString()
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

    await updateJobDetails(accountId, credentialsId, region, childJobId, jobStatusRecord);

    return jobStatusRecord.status;
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
    }

    return {
        resourceId,
        items: databaseInstanceResponse
    };
}
export {
    getHostAndSqlServerInfo,
    validateAndStoreDiscoveredParameters,
    fetchUnmanagedHostsInformation,
    manageSqlServer,
    prepareForManage,
    fetchUnmanagedHostsInformationV2,
    unmanageDatabaseInstance
};
