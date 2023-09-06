import { faker } from '@faker-js/faker';
import { sendSSMCommand, getCommandInvocation } from '../../../src/lib/aws/ssm';
import ssmCommandOutput from '../../simulator/responses/aws/ssm-sendcommands-response.json';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/aws/ssm-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';

const credentialsId = `${faker.string.alpha(20)}`;

describe('sendSSMCommand', () => {
    it('sendSSMCommand', async () => {
        const params = {
            DocumentName: 'AWS-RunPowerShellScript',
            Documentversion: '1',
            Parameters: {
                commands: [
                    ' C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SELECT\n' +
                        '                                (processmem.physical_memory_in_use_kb * 1024) AS used,\n' +
                        '                                (sysmem.total_physical_memory_kb * 1024) AS total,\n' +
                        '                                ((sysmem.total_physical_memory_kb * 1024)-(processmem.physical_memory_in_use_kb * 1024)) as remaining,\n' +
                        '                                 ((processmem.physical_memory_in_use_kb/1024) * 100 / (sysmem.total_physical_memory_kb/1024)) as percentUsed\n' +
                        '                                 FROM sys.dm_os_process_memory as processmem, sys.dm_os_sys_memory as sysmem;"'
                ]
            },
            InstanceIds: ['i-0880a21327284f67c']
        };
        const resp = await sendSSMCommand(credentialsId, 'ap-southeast-1', params);
        expect(resp).toEqual(ssmCommandOutput.resourceCommandResponse.Command.CommandId);
    });

    const getResponse = {
        $metadata: {
            httpStatusCode: 200,
            requestId: '17601055-7787-4476-8450-2abb4851432a',
            attempts: 1,
            totalRetryDelay: 0
        },
        DocumentName: 'AWS-RunPowerShellScript',
        InstanceId: 'i-0880a21327284f67c',
        PluginName: 'aws:runPowerShellScript',
        ResponseCode: 0,
        StandardErrorContent: '',
        StandardErrorUrl: '',
        StandardOutputContent: '{"used":  342859776,"total":  4294557696,"remaining":  3951697920,"percentUsed":  7}',
        StandardOutputUrl: '',
        Status: 'Success',
        StatusDetails: 'Success'
    };

    it('getCommandInvocation', async () => {
        const params = {
            CommandId: '3b7b2232-67de-4b43-8d52-2997f7b259dd',
            InstanceId: 'i-0880a21327284f67c'
        };
        const resp = await getCommandInvocation(credentialsId, 'us-east-1', params);
        expect(resp).toEqual(getResponse);
    });
});
