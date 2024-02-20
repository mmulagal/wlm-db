import createError from 'http-errors';
import config from 'config';

import { DescribeInstancesCommandInput, DescribeInstancesCommandOutput, InstanceStateName } from '@aws-sdk/client-ec2';
import { ConnectionStatus } from '@aws-sdk/client-ssm';
import throat from 'throat';
import { describeInstance } from '../lib/aws/ec2';
import { getResourceNameFromTags, sleep } from '../utils/utils';
import { getSSMConnectionStatus, pollCommandStatus } from './aws/ssm-operations';
import { HttpErrorCodes } from '../utils/consts';
import { sendSSMCommand } from '../lib/aws/ssm';
import { SSM_RUN_POWERSHELL_SCRIPT_DOC } from './workloads/mssql/const';
import { SqlServerInstanceInfoType, DiscoverResponseInfoType } from '../routes/types/discover.types';
import getLogger from '../utils/logger';

const logger = getLogger();

interface SsmTargetsInfo {
    ec2InstanceId: string;
    ec2Name: string;
    ssmState: string;
}

const MAX_DESCRIBE_INSTANCES_COUNT = 10;
const MAX_SSM_COMMANDS_POLL_COUNT = 10;
const MINIMUM_SQL_SERVER_EDITION_SUPPORTED = 2016;

const hostAndSqlInfoPowerShellScript = [
    `
    $body = @{}

    (Get-WmiObject win32_service | ?{$_.DisplayName -like 'sql server (*'}) | SELECT Name, State, PathName | ForEach {
    
        $instance = $_.Name -Replace "MSSQL\\$", ""
        $state = $_.State
        $path = $_.PathName  -Replace "-s.*",""
    
        If (Get-Command sqlcmd) {
            $serverInstance = If ($instance -ne "MSSQLSERVER") { "$Env:ComputerName\\$instance" } Else { "$Env:ComputerName" }
            sqlcmd -Q "SELECT @@serviceName" -C -S $serverInstance -l 1 2> Out-Null | Out-Null
            $body['windowsAuthentication'] = $?
        } else {
            $body['windowsAuthentication'] = $False
        }

        $info = Invoke-Expression -Command "(dir $path).VersionInfo"
        $productversion = $info.ProductVersion
        $sqlversion = $info.FileVersionRaw.Major
    
        $body['sqlServerInstance'] = $instance
        $body['sqlServerState'] = $state
        $body['sqlServerVersion'] = $productversion
        $body['sqlServerEdition'] = $sqlversion
    
        Echo $body | ConvertTo-Json
    } | ConvertFrom-Json | ConvertTo-Json
    `
];

async function getHostAndSqlServerInfo(
    accountId: string,
    credentialsId: string,
    region: string,
    nextToken: string = '',
    instances: string[] = []
) {
    logger.info('getHostAndSqlServerInfo():', { accountId, credentialsId, region, nextToken });

    const responseInfo: DiscoverResponseInfoType[] = [];
    const ssmTargets: SsmTargetsInfo[] = [];

    const describeInstanceParams: DescribeInstancesCommandInput = {
        Filters: [
            { Name: 'platform', Values: ['windows'] },
            { Name: 'architecture', Values: ['x86_64'] },
            { Name: 'instance-state-name', Values: [InstanceStateName.running] }
        ],
        MaxResults: MAX_DESCRIBE_INSTANCES_COUNT,
        NextToken: nextToken
    };

    // For cases, where info for specific EC2s is needed
    if (instances.length > 0) {
        describeInstanceParams.Filters?.push({ Name: 'instance-id', Values: instances });
    }

    const paginatedEc2Instances: DescribeInstancesCommandOutput = await describeInstance(
        credentialsId,
        region,
        describeInstanceParams
    );

    for (const reservation of paginatedEc2Instances.Reservations!) {
        for (const ec2Instance of reservation.Instances!) {
            const name = getResourceNameFromTags(ec2Instance.Tags);
            const ssmStatus = await getSSMConnectionStatus(credentialsId, region, ec2Instance.InstanceId!);
            ssmTargets.push({
                ec2InstanceId: ec2Instance.InstanceId!,
                ec2Name: name!,
                ssmState: ssmStatus.Status!
            });
        }
    }

    // Populate details for EC2 hosts having no SSM connectivity. Since it
    // wont't be possible to get SQL Server details without SSM, the attribute
    // 'sqlServerInstances' will not be available for those hosts in API response.
    ssmTargets
        .filter(target => target.ssmState === ConnectionStatus.NOT_CONNECTED)
        .forEach(target => {
            responseInfo.push({
                instanceId: target.ec2InstanceId,
                instanceName: target.ec2Name,
                ssmState: target.ssmState
            });
        });

    const ssmConnectedNodes = ssmTargets.filter(target => target.ssmState === ConnectionStatus.CONNECTED);

    const commandId = await makeSsmCall(
        credentialsId,
        region,
        hostAndSqlInfoPowerShellScript,
        ssmConnectedNodes.map(target => target.ec2InstanceId),
        accountId
    );

    // PS execution would take some time, so we wait for a second before triggering polling.
    await sleep(1000);

    await Promise.all(
        ssmConnectedNodes.map(
            throat(MAX_SSM_COMMANDS_POLL_COUNT, async (target: SsmTargetsInfo) => {
                let dbInfo: SqlServerInstanceInfoType[] = [];
                dbInfo = await getHostAndSqlInfoFromPsOutput(credentialsId, region, target.ec2InstanceId, commandId!);
                responseInfo.push({
                    instanceId: target.ec2InstanceId,
                    instanceName: target.ec2Name,
                    ssmState: target.ssmState,
                    sqlServerInstances: dbInfo
                });
            })
        )
    );

    return {
        count: responseInfo.length,
        nextToken: paginatedEc2Instances.NextToken,
        items: responseInfo
    };
}

async function getHostAndSqlInfoFromPsOutput(
    credentialsId: string,
    region: string,
    ssmTarget: string,
    commandId: string
): Promise<SqlServerInstanceInfoType[]> {
    const commandInvocationParam = {
        CommandId: commandId,
        InstanceId: ssmTarget
    };

    const response = await pollCommandStatus(credentialsId, region, commandInvocationParam);
    if (response?.StandardErrorContent) {
        logger.error('Failed to collect info using SSM. Reason: ', response?.StandardErrorContent);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Failed to get details from EC2 instance ${ssmTarget}. Reason: ${response?.StandardErrorContent}`
        );
    }

    const dbInfo: SqlServerInstanceInfoType[] = [];
    const powerShellScriptOutput = response?.StandardOutputContent || '';
    if (powerShellScriptOutput.length > 0) {
        let responseInJson = JSON.parse(response?.StandardOutputContent || '');
        if (!Array.isArray(responseInJson)) {
            responseInJson = [responseInJson];
        }

        for (const dbInstanceInfo of responseInJson) {
            if (dbInstanceInfo.sqlServerEdition >= MINIMUM_SQL_SERVER_EDITION_SUPPORTED) {
                dbInfo.push(dbInstanceInfo);
            }
        }
    }

    return dbInfo;
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

export { getHostAndSqlServerInfo, hostAndSqlInfoPowerShellScript };
