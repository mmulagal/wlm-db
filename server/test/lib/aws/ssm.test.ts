import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/aws/ssm-scope';
import '../../simulator/scopes/opentelemetry-scope';
import { sendSSMCommand, getCommandInvocation } from '../../../src/lib/aws/ssm';
import ssmCommandOutput from '../../simulator/responses/aws/ssm-sendcommans-response.json';
import getssmcoommandoutput from '../../simulator/responses/aws/ssm-getcommands.json';
import { faker } from '@faker-js/faker';

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
            InstanceIds: ['i-07e76a4b916548dc0']
        };
        const resp = await sendSSMCommand(credentialsId, 'us-east-1', params);
        expect(resp).toEqual(ssmCommandOutput.Command.CommandId);
    });

    it('getCommandInvocation', async () => {
        const params = {
            CommandId: '3b7b2232-67de-4b43-8d52-2997f7b259dd',
            InstanceId: 'i-0880a21327284f67c'
        };
        const resp = await getCommandInvocation(credentialsId, 'us-east-1', params);
        expect(resp).toEqual(getssmcoommandoutput);
    });
});
