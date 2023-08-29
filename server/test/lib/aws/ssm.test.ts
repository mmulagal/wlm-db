import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/aws/sns-scope';
import '../../simulator/scopes/opentelemetry-scope';
import { sendSSMCommand, getSSMClient, getCommandInvocation } from '../../../src/lib/aws/ssm';
import { faker } from '@faker-js/faker';
import ssmCommandOutput from '../../simulator/responses/aws/ssm-sendcommans-response.json';
import getssmcoommandoutput from '../../simulator/responses/aws/ssm-getcommands.json';

describe('sendSSMCommand', () => {
    it('sendSSMCommand', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const client = await getSSMClient('us-east-1', credentialsId);
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
            InstanceIds: ['i-07e76a4b916548dc0']
        };
        const resp = await sendSSMCommand(client, params);
        expect(resp).toEqual(ssmCommandOutput);
    });

    it('getCommandInvocation', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const client = await getSSMClient('us-east-1', credentialsId);
        const params = {
            CommandId: '3b7b2232-67de-4b43-8d52-2997f7b259dd',
            InstanceId: 'i-0880a21327284f67c'
        };
        const resp = await getCommandInvocation(client, params);
        expect(resp).toEqual(getssmcoommandoutput);
    });
});
