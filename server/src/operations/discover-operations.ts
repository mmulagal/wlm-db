import createError from 'http-errors';
import config from 'config';

import { STORAGE_TYPE } from '@prisma/client';
import { FileSystem } from '@aws-sdk/client-fsx';
import { compact, uniqBy } from 'lodash-es';
import { DescribeInstancesCommandInput, InstanceStateName, Vpc } from '@aws-sdk/client-ec2';
import { ConnectionStatus } from '@aws-sdk/client-ssm';
import throat from 'throat';
import { describeInstance, paginatedDescribeSubnets, paginatedDescribeVpcs } from '../lib/aws/ec2';
import { getResourceNameFromTags, sleep } from '../utils/utils';
import { getSSMConnectionStatus, pollCommandStatus, ssmPutParameters } from './aws/ssm-operations';
import { HttpErrorCodes, RESOURCESTYPE, SSM_PARAMETERS_BASE_PATH } from '../utils/consts';
import { hostAndSqlInfoPowerShellScript } from './workloads/mssql/discover-consts';
import { sendSSMCommand } from '../lib/aws/ssm';
import { SSM_RUN_POWERSHELL_SCRIPT_DOC } from './workloads/mssql/const';
import { registerFsxOntapCredentials } from '../lib/cloud-manager/fsx-core';
import { SSMParamterObject } from '../utils/common-types';

import {
    SqlServerInstanceInfoType,
    DiscoverResponseInfoType,
    DiscoverCredentialsType
} from '../routes/types/discover.types';
import getLogger from '../utils/logger';
import { describeFSxFileSystems, describeFSxStorageVirtualMachines } from '../lib/aws/fsx';

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
}

const MINIMUM_SQL_SERVER_EDITION_SUPPORTED = 2016;

async function getHostAndSqlServerInfo(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2Count: number,
    nextToken: string = '',
    instances: string[] = []
) {
    logger.info('getHostAndSqlServerInfo():', { accountId, credentialsId, region, nextToken });
    let api1StartTime;
    let api1EndTime;

    const describeInstanceParams: DescribeInstancesCommandInput = {
        Filters: [
            { Name: 'platform', Values: ['windows'] },
            { Name: 'architecture', Values: ['x86_64'] },
            { Name: 'instance-state-name', Values: [InstanceStateName.running] }
        ],
        MaxResults: ec2Count,
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
            hostAndSqlInfoPowerShellScript,
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
                throat(ec2Count, async (target: SsmTargetsInfo) => {
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
    const response = await pollCommandStatus(credentialsId, region, commandInvocationParam);
    if (response?.StandardErrorContent) {
        logger.error('Failed to collect info using SSM. Reason: ', response?.StandardErrorContent);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Failed to get details from EC2 instance ${ssmTarget.ec2InstanceId}. Reason: ${response?.StandardErrorContent}`
        );
    }
    api1EndTime = performance.now();
    logger.info(
        `API1Performance: pollCommandStatus time for target ${ssmTarget.ec2InstanceId}: ${
            api1EndTime - api1StartTime
        }ms`
    );

    const ssmTargetSqlServerInstancesInfo: SqlServerInstanceInfoType[] = [];

    try {
        const powerShellScriptOutput = response?.StandardOutputContent || '';
        if (powerShellScriptOutput.length > 0) {
            let responseInJson = JSON.parse(response?.StandardOutputContent || '');
            if (!Array.isArray(responseInJson)) {
                responseInJson = [responseInJson];
            }
            for (const sqlServerInstanceInfo of responseInJson) {
                if (sqlServerInstanceInfo.sqlServerEdition >= MINIMUM_SQL_SERVER_EDITION_SUPPORTED) {
                    api1StartTime = performance.now();
                    const storageTypes = [];
                    const deploymentTypes = [];
                    const ebsVolumeIDs = ssmTarget.ebsVolumeIDs?.map(elem => elem?.replace('-', ''));

                    let driveInfo = JSON.parse(sqlServerInstanceInfo.sqlDriveInfo);
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
                    api1EndTime = performance.now();
                    logger.info(
                        `API1Performance: Time taken to parse PowerShell script output: ${
                            api1EndTime - api1StartTime
                        }ms`
                    );

                    const {
                        sqlServerVersion,
                        sqlServerInstance,
                        sqlServerState,
                        sqlServerEdition,
                        windowsAuthentication,
                        scriptExecutionTime
                    } = sqlServerInstanceInfo;
                    logger.info(
                        `API1Performance: Time taken to execute PowerShell script for instance ${sqlServerInstance}: ${scriptExecutionTime}ms`
                    );

                    ssmTargetSqlServerInstancesInfo.push({
                        sqlServerVersion,
                        sqlServerInstance,
                        sqlServerState,
                        sqlServerEdition,
                        windowsAuthentication,
                        storage: uniqBy(storageTypes, 'id'),
                        deploymentTypes: uniqBy(deploymentTypes, 'ids').map(({ type, zones }) => ({ type, zones }))
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

async function saveDiscoveredParameters(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    credentials: DiscoverCredentialsType[]
) {
    logger.info('Put SSM parameters', { accountId, credentialsId, region, instanceId });

    const fsxCredentials = credentials.filter(cred => cred.resourceType === RESOURCESTYPE.FSX);

    const creds = prepareParametersToStore(instanceId, credentials);

    await Promise.all([
        Promise.all(
            fsxCredentials.map(cred =>
                registerFsxOntapCredentials(accountId, credentialsId, region, cred.resourceId, cred.password)
            )
        ),
        ssmPutParameters(credentialsId, region, creds)
    ]);
}

export {
    getHostAndSqlServerInfo,
    hostAndSqlInfoPowerShellScript,
    saveDiscoveredParameters,
    getHostAndSqlInfoFromPsOutput
};
