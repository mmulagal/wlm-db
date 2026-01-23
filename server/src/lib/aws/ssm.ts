import {
    SSMClient,
    SendCommandCommand,
    SendCommandCommandInput,
    GetCommandInvocationCommandInput,
    GetCommandInvocationCommandOutput,
    GetCommandInvocationCommand,
    paginateGetParametersByPath,
    GetParametersByPathCommandInput,
    GetConnectionStatusCommandInput,
    GetConnectionStatusCommand,
    GetConnectionStatusCommandOutput,
    PutParameterCommand,
    PutParameterCommandInput,
    GetParameterCommand,
    GetParameterCommandInput,
    GetParameterCommandOutput,
    DeleteParametersCommand,
    DescribeInstancePatchStatesCommand,
    DescribeInstancePatchStatesCommandInput,
    DescribeInstancePatchesCommandInput,
    PatchComplianceData,
    ListCommandsCommand,
    ListCommandsCommandInput,
    DescribeAvailablePatchesCommandInput,
    Patch,
    DescribeInstanceInformationCommandInput,
    paginateDescribeInstanceInformation,
    paginateDescribeAvailablePatches,
    paginateDescribeInstancePatches
} from '@aws-sdk/client-ssm';
import { gzipSync } from 'node:zlib';
import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import { DEFAULT_AWS_REGION } from '../../utils/consts';
import getLogger from '../../utils/logger';
import { SSM_RUN_SHELL_SCRIPT_DOC } from '../../operations/workloads/oracle/consts';
import { SSM_RUN_POWERSHELL_SCRIPT_DOC } from '../../operations/workloads/mssql/const';

const logger = getLogger();

// Limit is 64KB, use a slightly smaller threshold to account for parameter and document overhead
const SSM_COMMAND_COMPRESSION_THRESHOLD = 62 * 1024;

// Bash decompression script template - decompresses gzipped base64 payload and executes
const BASH_DECOMPRESS_TEMPLATE = (compressedBase64: string) => `#!/bin/bash
d='${compressedBase64}'
echo "$d" | base64 -d | gunzip | bash`;

// PowerShell decompression script template - decompresses gzipped base64 payload and executes
const POWERSHELL_DECOMPRESS_TEMPLATE = (base64Data: string) => `$ErrorActionPreference="Stop"
$d=@"
${base64Data}
"@
$b=[Convert]::FromBase64String($d)
$m=New-Object IO.MemoryStream
$m.Write($b,0,$b.Length)
$m.Position=0
$g=New-Object IO.Compression.GzipStream($m,[IO.Compression.CompressionMode]::Decompress)
$r=New-Object IO.StreamReader($g)
$s=$r.ReadToEnd()
$r.Close();$g.Close();$m.Close()
Invoke-Expression $s`;

async function getSSMClient(region: string, credentialsId?: string, accountId?: string) {
    logger.debug('Getting SSM client:', region, credentialsId, accountId);

    if (!credentialsId) {
        return new SSMClient({ region });
    }
    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialsDetails(credentialsId, accountId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };

    return new SSMClient({ credentials, region });
}

async function sendSSMCommand(
    credentialsId: string,
    region: string,
    params: SendCommandCommandInput,
    accountId?: string
) {
    logger.info('Send SSM Command', { credentialsId, region, params: params?.Comment, accountId });

    // Compress commands if they exceed size threshold
    const isBashScript = params.DocumentName === SSM_RUN_SHELL_SCRIPT_DOC;
    const isPowerShellScript = params.DocumentName === SSM_RUN_POWERSHELL_SCRIPT_DOC;

    if ((isBashScript || isPowerShellScript) && params.Parameters?.commands) {
        const commandsStr = JSON.stringify(params.Parameters.commands);
        const commandsSize = Buffer.byteLength(commandsStr, 'utf8');

        logger.info(`SSM command size: ${commandsSize} bytes`);

        if (commandsSize > SSM_COMMAND_COMPRESSION_THRESHOLD) {
            logger.info('Compressing large SSM command...');

            // Join commands array into single script
            const scriptContent = Array.isArray(params.Parameters.commands)
                ? params.Parameters.commands.join('\n')
                : params.Parameters.commands;

            // Compress the script with maximum compression
            const compressed = gzipSync(scriptContent, { level: 9 });
            const compressedBase64 = compressed.toString('base64');

            logger.info(
                `Compressed size: ${compressedBase64.length} bytes (${Math.round(
                    (compressedBase64.length / commandsSize) * 100
                )}% of original)`
            );

            // Replace commands with appropriate decompression wrapper
            if (isBashScript) {
                params.Parameters.commands = [BASH_DECOMPRESS_TEMPLATE(compressedBase64)];
            } else {
                // Split base64 into chunks for PowerShell here-string readability (80 char lines)
                const chunks = compressedBase64.match(/.{1,80}/g) || [compressedBase64];
                const base64Data = chunks.join('\n');
                params.Parameters.commands = [POWERSHELL_DECOMPRESS_TEMPLATE(base64Data)];
            }

            const finalSize = Buffer.byteLength(JSON.stringify(params), 'utf8');
            logger.info(`Final SSM request size: ${finalSize} bytes`);

            if (finalSize > SSM_COMMAND_COMPRESSION_THRESHOLD) {
                throw new Error(
                    `Compressed payload still exceeds SSM limit: ${finalSize} bytes. Original: ${commandsSize} bytes`
                );
            }
        }
    }

    const ssmClient = await getSSMClient(region, credentialsId, accountId);
    const sendCommand = new SendCommandCommand(params);
    const response = await ssmClient.send(sendCommand);

    logger.debug('SSM Command response', response);
    return response.Command?.CommandId;
}

async function listSsmCommands(credentialsId: string, region: string, params: ListCommandsCommandInput) {
    logger.info('Listing SSM commands', { credentialsId, region, params });

    const ssmClient = await getSSMClient(region, credentialsId);
    const response = await ssmClient.send(new ListCommandsCommand(params));
    logger.info('SSM ListCommands response', response);
    return response;
}

async function getCommandInvocation(
    credentialsId: string,
    region: string,
    params: GetCommandInvocationCommandInput,
    accountId?: string
) {
    logger.info('Getting command invocation details for command', { credentialsId, region, params, accountId });

    const ssmClient = await getSSMClient(region, credentialsId, accountId);
    const response: GetCommandInvocationCommandOutput = await ssmClient.send(new GetCommandInvocationCommand(params));
    logger.debug('SSM Command response', response);
    return response;
}

async function getParametersByPath(credentialsId?: string, region?: string, path?: string) {
    logger.info('Get parameter by path', { credentialsId, region, path });

    const ssmClient = await getSSMClient(region || DEFAULT_AWS_REGION, credentialsId);

    const parametersInput: GetParametersByPathCommandInput = {
        Path: path || '/aws/service/global-infrastructure/services/fsx-ontap/regions',
        Recursive: false,
        WithDecryption: true
    };

    const paginator = paginateGetParametersByPath({ client: ssmClient }, parametersInput);
    const pathParameters = [];
    for await (const page of paginator) {
        if (page.Parameters?.length) {
            pathParameters.push(...page.Parameters);
        }
    }
    logger.debug('Get parameter by path command response:', pathParameters);

    return pathParameters;
}

async function getConnectionStatus(
    credentialsId: string,
    region: string,
    params: GetConnectionStatusCommandInput,
    accountId?: string
) {
    logger.info('Getting connection status', { credentialsId, region, params, accountId });

    const ssmClient = await getSSMClient(region, credentialsId, accountId);
    const response: GetConnectionStatusCommandOutput = await ssmClient.send(new GetConnectionStatusCommand(params));
    logger.debug('SSM Command response', response);
    return response;
}

async function putParameter(credentialsId: string, region: string, params: PutParameterCommandInput) {
    logger.info('Put SSM Parameter');

    const ssmClient = await getSSMClient(region, credentialsId);
    const response = await ssmClient.send(new PutParameterCommand(params));

    logger.debug('SSM PutParameter response', response);
    return response;
}

async function getParameter(credentialsId: string, region: string, ssmParameterName: string) {
    logger.info('Get SSM paramter', { credentialsId, region, ssmParameterName });

    const input: GetParameterCommandInput = {
        Name: ssmParameterName,
        WithDecryption: true
    };

    try {
        const ssmClient = await getSSMClient(region, credentialsId);
        const response: GetParameterCommandOutput = await ssmClient.send(new GetParameterCommand(input));
        return response?.Parameter?.Value;
    } catch (error: any) {
        if (error?.name === 'ParameterNotFound') {
            logger.debug('SSM parameter not found');
        } else {
            logger.error('Failed to get SSM parameter', error);
        }
    }
}

async function deleteParameters(credentialsId: string, region: string, ssmParameterNames: string[]) {
    logger.info('Delete SSM paramters', { credentialsId, region, ssmParameterNames });

    const ssmClient = await getSSMClient(region, credentialsId);
    try {
        return await ssmClient.send(new DeleteParametersCommand({ Names: ssmParameterNames }));
    } catch (error) {
        logger.error('Failed to delete SSM parameters', error);
    }
}

async function describeInstancePatchStates(
    credentialsId: string,
    region: string,
    params: DescribeInstancePatchStatesCommandInput
) {
    logger.info('Describe Instance Patch States');

    const ssmClient = await getSSMClient(region, credentialsId);
    const response = await ssmClient.send(new DescribeInstancePatchStatesCommand(params));
    logger.debug('describeInstancePatchStates response', response);

    return response;
}

async function describeInstancePatches(
    credentialsId: string,
    region: string,
    params: DescribeInstancePatchesCommandInput
) {
    logger.info('Describe Instance Patches', { credentialsId, region, params });

    const ssmClient = await getSSMClient(region, credentialsId);
    let allPatches: PatchComplianceData[] = [];

    for await (const page of paginateDescribeInstancePatches({ client: ssmClient }, params)) {
        if (page.Patches?.length) {
            allPatches = [...allPatches, ...page.Patches];
        }
    }

    logger.debug('all patches', allPatches);
    return allPatches;
}

async function describeAvailablePatches(
    region: string,
    params: DescribeAvailablePatchesCommandInput
): Promise<Patch[]> {
    logger.info('Describe Available Patches', { region, params });

    const ssmClient = await getSSMClient(region);
    let allPatches: Patch[] = [];

    for await (const page of paginateDescribeAvailablePatches({ client: ssmClient }, params)) {
        if (page.Patches?.length) {
            allPatches = [...allPatches, ...page.Patches];
        }
    }

    logger.debug('all MSSQL available patches', allPatches);
    return allPatches;
}

async function describeInstanceInformation(
    credentialsId: string,
    region: string,
    params: DescribeInstanceInformationCommandInput
) {
    logger.info('Describe Instance Information', { credentialsId, region, params });

    const ssmClient = await getSSMClient(region, credentialsId);
    const paginator = paginateDescribeInstanceInformation({ client: ssmClient }, params);
    const instanceInformation = [];
    for await (const page of paginator) {
        if (page.InstanceInformationList?.length) {
            instanceInformation.push(...page.InstanceInformationList);
        }
    }
    logger.debug('describeInstanceInformation response', instanceInformation);

    return instanceInformation;
}

export {
    getSSMClient,
    sendSSMCommand,
    listSsmCommands,
    getCommandInvocation,
    getParametersByPath,
    getConnectionStatus,
    putParameter,
    getParameter,
    deleteParameters,
    describeInstancePatchStates,
    describeInstancePatches,
    describeAvailablePatches,
    describeInstanceInformation,
    SSM_COMMAND_COMPRESSION_THRESHOLD
};
