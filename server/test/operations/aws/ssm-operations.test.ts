import { executeSSMDocument } from '../../../src/operations/aws/ssm-operations';
import { faker } from '@faker-js/faker';

import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/aws/sns-scope';
import '../../simulator/scopes/opentelemetry-scope';

describe('executeSsmDocument', () => {
    it('executeSsmDocument', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
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

        const resp = await executeSSMDocument(credentialsId, 'us-east-1', params);
        expect(resp).toEqual('sample');
    });
    
});
