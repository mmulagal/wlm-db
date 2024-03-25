import createError from 'http-errors';
import config from 'config';

import { STORAGE_TYPE } from '@prisma/client';
import { FileSystem, FileSystemType } from '@aws-sdk/client-fsx';
import { attempt, compact, uniqBy, isEmpty } from 'lodash-es';
import { DescribeInstancesCommandInput, InstanceStateName, Vpc } from '@aws-sdk/client-ec2';
import { CommandInvocationStatus, ConnectionStatus } from '@aws-sdk/client-ssm';
import throat from 'throat';
import { describeInstance, paginatedDescribeSubnets, paginatedDescribeVpcs } from '../lib/aws/ec2';
import { getResourceNameFromTags, sleep } from '../utils/utils';
import {
    getEc2SqlParameters,
    callSsmExecution,
    getSSMConnectionStatus,
    pollCommandStatus,
    ssmPutParameters
} from './aws/ssm-operations';
import { CloudProviders, HttpErrorCodes, RESOURCESTYPE, SSM_PARAMETERS_BASE_PATH } from '../utils/consts';
import { SQL_SERVER_VERSION_TO_YEAR, HOST_AND_SQL_INFO_PS1 } from './workloads/mssql/discover-consts';
import { deleteParameters, getParameter, sendSSMCommand } from '../lib/aws/ssm';
import { SSM_RUN_POWERSHELL_SCRIPT_DOC } from './workloads/mssql/const';
import { registerFsxOntapCredentials } from '../lib/cloud-manager/fsx-core';
import { SSMParamterObject } from '../utils/common-types';

import {
    DiscoverMsSqlResponseBodyType,
    SqlServerInstanceInfoType,
    DiscoverResponseInfoType,
    DiscoverCredentialsType
} from '../routes/types/discover.types';
import getLogger from '../utils/logger';
import { describeFSxFileSystems, describeFSxStorageVirtualMachines } from '../lib/aws/fsx';
import { returnInventorydata } from '../utils/demo-utils/demoDefaultUtils';
import { getMsSqlResourceId } from './workloads/mssql/mssql-operations';
import { getDatabaseHostSummary } from './database-hosts-operations';
import { validateOntapConnectivity, validateSQLInstanceConnectivity } from './workloads/mssql/ssm-script-utils';
import { getAsyncLocalStorageResource, setAsyncLocalStorageResource } from '../utils/async-local-storage';

const logger = getLogger();

interface SsmTargetsInfo {
    ec2InstanceId: string;
    ec2InstanceName: string;
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
    windowsMountEndpoint?: string[] | undefined;
}

const MINIMUM_SQL_SERVER_SUPPORTED = 2016;

const NEW_SSM_PARAMETERS = 'NEW_SSM_PARAMETERS';
const SSM_PARAM_PREFIX = '/netapp/wlmdb/';

async function getHostAndSqlServerInfo(
    accountId: string,
    credentialsId: string,
    region: string,
    pageSize: number,
    nextToken: string = '',
    instances: string[] = []
): Promise<DiscoverMsSqlResponseBodyType> {
    logger.info('getHostAndSqlServerInfo():', { accountId, credentialsId, region, nextToken });
    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        return returnInventorydata();
    }
    let api1StartTime;
    let api1EndTime;

    const describeInstanceParams: DescribeInstancesCommandInput = {
        Filters: [
            { Name: 'platform', Values: ['windows'] },
            { Name: 'architecture', Values: ['x86_64'] },
            { Name: 'instance-state-name', Values: [InstanceStateName.running] }
        ],
        MaxResults: pageSize,
        NextToken: nextToken
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
                ec2InstanceName: name!,
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

        const endPointIpWithFsxId = new Map<string, string>();
        const fsIdWithDeploymentType = new Map<string, DeployType>();
        api1StartTime = performance.now();
        svmList.StorageVirtualMachines?.forEach(async elem => {
            const fsId = elem.FileSystemId;
            elem?.Endpoints?.Iscsi?.IpAddresses?.forEach(async ip => {
                endPointIpWithFsxId.set(ip, fsId!);
            });
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
            .map(fsx =>
                fsIdWithDeploymentType.set(fsx.FileSystemId!, {
                    deploymentType: fsx.WindowsConfiguration?.DeploymentType,
                    subnetIds: fsx.SubnetIds!,
                    windowsMountEndpoint: [
                        `\\\\${fsx.WindowsConfiguration?.RemoteAdministrationEndpoint}`,
                        `\\\\${fsx.WindowsConfiguration?.PreferredFileServerIp}`
                    ]
                })
            );
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
                throat(pageSize, async (target: SsmTargetsInfo) => {
                    let dbInfo: SqlServerInstanceInfoType[] = [];
                    const dbInfoStartTime = performance.now();
                    dbInfo = await getHostAndSqlInfoFromPsOutput(
                        credentialsId,
                        region,
                        target,
                        commandId!,
                        endPointIpWithFsxId,
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
                            ec2InstanceName: target.ec2InstanceName,
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
    endPointIpWithFsxId: Map<string, string>,
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
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Failed to get details from EC2 instance ${ssmTarget.ec2InstanceId}. Reason: ${ssmResponse?.StandardErrorContent}`
        );
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
            let responseInJson = JSON.parse(ssmResponse?.StandardOutputContent || '');
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

                    let driveInfo = JSON.parse(sqlServerInstanceInfo?.sqlServerInstanceStorageInfo);
                    if (!Array.isArray(driveInfo)) {
                        driveInfo = [driveInfo];
                    }

                    for (const di of driveInfo) {
                        const ebsVolumeId = ebsVolumeIDs?.find(elem => di?.SerialNumberOrScsiTarget?.includes(elem));
                        if (ebsVolumeId) {
                            storageTypes.push({
                                type: STORAGE_TYPE.EBS,
                                id: ebsVolumeId
                            });
                        } else if (endPointIpWithFsxId.has(di?.SerialNumberOrScsiTarget)) {
                            const fsxId = endPointIpWithFsxId.get(di?.SerialNumberOrScsiTarget);
                            storageTypes.push({
                                type: STORAGE_TYPE.FSXN,
                                id: fsxId!
                            });
                            const { deploymentType, subnetIds } = fsIdWithDeploymentType.get(fsxId!) || {};

                            deploymentTypes.push({
                                type: deploymentType,
                                zones: compact(subnetIds?.map(subnetId => subnetListMap.get(subnetId))),
                                ids: subnetIds?.join()
                            });
                        }
                    }

                    // Add FSxW details
                    // Match get-smbmapping with FSxW (RemoteAdministrationEndpoint and PreferredFileServerIp)
                    // let windowsFsxMountsPS = ['//ip/share', '//fsxid/share]
                    // fsIdWithDeploymentType = {'fsxid', {windowsMountEndpoint:['//fsxid']}
                    const windowsFsxMountsPS = driveInfo.map(
                        (di: { SerialNumberOrScsiTarget: any }) => di.SerialNumberOrScsiTarget
                    );
                    fsIdWithDeploymentType.forEach((details: DeployType, fsxId: string) => {
                        const matchedPoints = details.windowsMountEndpoint?.filter(value =>
                            windowsFsxMountsPS.includes(value)
                        );
                        if (matchedPoints) {
                            storageTypes.push({
                                type: STORAGE_TYPE.FSXW,
                                id: fsxId
                            });
                        }
                    });

                    api1EndTime = performance.now();
                    logger.info(
                        `API1Performance: Time taken to parse PowerShell script output: ${
                            api1EndTime - api1StartTime
                        }ms`
                    );

                    let {
                        sqlServerVersion,
                        sqlServerName,
                        sqlServerEdition,
                        sqlServerNodes,
                        sqlServerInstance,
                        sqlServerState,
                        windowsAuthentication,
                        scriptExecutionTime,
                        databaseCount
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
                        sqlServerNodes,
                        sqlServerInstance,
                        sqlServerState,
                        sqlServerProductYear,
                        ...(sqlServerEdition && { sqlServerEdition }),
                        windowsAuthentication,
                        sqlServerAuthentication,
                        storage: uniqBy(storageTypes, 'id'),
                        deploymentTypes: uniqBy(deploymentTypes, 'ids').map(({ type, zones }) => ({ type, zones })),
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

async function validateAndStoreDiscoveredParameters(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    credentials: DiscoverCredentialsType[]
) {
    logger.info('Validate and Put SSM parameters', { accountId, credentialsId, region, instanceId });

    try {
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

        if (fsxCredentials && !detectResponse?.ontapError) {
            await registerFsxOntapCredentials(
                accountId,
                credentialsId,
                region,
                fsxCredentials.resourceId,
                fsxCredentials.password
            );
        }

        return detectResponse;
    } catch (error: any) {
        logger.error('Failed to validate credentials', error);
        throw createError(HttpErrorCodes.BAD_REQUEST, error.message);
    }
}

async function fetchUnmanagedHostsInformation(
    accountId: string,
    credentialsId: string,
    region: string,
    instancesDetails: { ec2InstanceId: string; fsxnId?: string; ebsVolumeId?: string; fsxwId?: string }[] = []
) {
    logger.info('Fetching hosts information:', { accountId, credentialsId, region, instancesDetails });

    // TODO: /v1/credentials/:credentialsId/regions/:region/mssql/discover (API1) fetches instance-storage mapping and returns it, /v1/credentials/:credentialsId/regions/:region/mssql/instances(API2) expects the same combination in request. In the event there is a mismatch, this function may return incorrect data. Add validation for instance-storage mapping

    const resourceDetailsList = instancesDetails.map(({ ec2InstanceId, fsxnId, ebsVolumeId, fsxwId }) => ({
        id: null,
        account_id: accountId,
        resource_id: getMsSqlResourceId(ec2InstanceId),
        resource_type: RESOURCESTYPE.MSSQL,
        resource_name: ec2InstanceId,
        cloud_provider_name: CloudProviders.AWS,
        co_relation_id: fsxnId || null,
        cloud_provider_account_id: null,
        region,
        credentials_id: credentialsId,
        storage_type: STORAGE_TYPE.FSXN,
        metadata: {
            creationDate: Date.now(),
            node1InstanceId: ec2InstanceId
        },
        ebsVolumeId,
        fsxwId
    }));

    const response = await Promise.all(
        resourceDetailsList.map(async resourceDetail =>
            getDatabaseHostSummary(
                accountId,
                resourceDetail.resource_id,
                'serverDetails,performance,usageEstimation,resourceUtilization',
                resourceDetail,
                false // unmanaged host
            )
        )
    );

    return {
        count: response.length,
        items: response
    };
}

async function manageSqlServer(accountId: string, credentialsId: string, region: string, instanceId: string) {
    logger.info('Manage EC2 hosting SQL Server', { accountId, credentialsId, region, instanceId });

    const discoverInfo = await getHostAndSqlServerInfo(accountId, credentialsId, region, 5, undefined, [instanceId]);
    await validateEc2InstanceManageability(discoverInfo, instanceId);
    // TODO: copy scripts, add resource to WLMDB tables etc.
}

async function validateEc2InstanceManageability(discoverInfo: any, ec2InstanceId: string) {
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

        if ((sqlServerInstances?.length || 0) <= 0) {
            throw new Error('no SQL Server instances found');
        }

        // Current supported configuration is expected to be one SQL Server instance per EC2.
        // If the EC2 has more than one SQL Server instance, we are considering only the first one.
        const { windowsAuthentication, sqlServerAuthentication, storage, sqlServerNodes, sqlServerInstance } =
            sqlServerInstances![0] as SqlServerInstanceInfoType;

        if (windowsAuthentication === false && sqlServerAuthentication === false) {
            // eslint-disable-next-line quotes
            throw new Error(`authentication to SQL Server instance isn't possible`);
        }

        if (!storage || storage.length <= 0 || storage?.some(elem => elem.type !== STORAGE_TYPE.FSXN)) {
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

    let command = 'pwsh -Command {$WarningPreference = "SilentlyContinue";';

    if (fsxCredentials) {
        command += `${validateOntapConnectivity(fsxCredentials.resourceId, region)};\n`;
    }

    if (sqlCredentials.length) {
        command += sqlCredentials.reduce(
            (acc: string, { resourceId }) => `${acc}${validateSQLInstanceConnectivity(instanceId, resourceId)};\n`,
            ''
        );
    }

    command += '$responeObject | ConvertTo-Json -Compress }';

    const ssmresponse = await callSsmExecution(credentialsId, region, [command], instanceId);

    const cleanResponse = ssmresponse?.replaceAll('\r\n', '');
    let parsedResponse = attempt(JSON.parse, cleanResponse);

    parsedResponse = parsedResponse instanceof Error ? undefined : parsedResponse;

    if (!parsedResponse) {
        throw new Error(`Failed to validate credentials. Reason: ${cleanResponse}`);
    }

    const response: Record<string, string> = {};
    const paramesToDelete: string[] = [];

    if (fsxCredentials && parsedResponse.ontapconnectivity === false) {
        paramesToDelete.push(`${SSM_PARAM_PREFIX}${fsxCredentials.resourceId}`);
        response.fsxnError = parsedResponse.ontapError;
    }

    if (sqlCredentials.length) {
        if (parsedResponse.sqlInstanceConnectivity === false) {
            paramesToDelete.push(`${SSM_PARAM_PREFIX}${instanceId}`);
            response.sqlServerError = parsedResponse.sqlerror;
        }

        if (parsedResponse.sqlInstanceConnectivity === true) {
            response.sqlServerEdition = parsedResponse.sqlEdition;
            response.databaseCount = parsedResponse.noOfDatabases;
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
    const filteredSSMParameters = ssmParameterNames.filter(param => newlyAddedSSMParameters.includes(param));

    if (filteredSSMParameters.length) {
        await deleteParameters(credentialsId, region, filteredSSMParameters);
    }
}

export {
    getHostAndSqlServerInfo,
    validateAndStoreDiscoveredParameters,
    getHostAndSqlInfoFromPsOutput,
    fetchUnmanagedHostsInformation,
    manageSqlServer
};
