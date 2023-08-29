import { sendSSMCommand, getSSMClient } from '../../../src/lib/aws/ssm';
import { faker } from '@faker-js/faker';
import '../../simulator/scopes/aws/ssm-scope';
import '../../simulator/scopes/opentelemetry-scope';
import ssmCommandOutput from '../../simulator/responses/aws/ssm-sendcommans-response.json';
import { cloudManagerAwsCredentials } from '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
// import getssmcoommandoutput from '../../simulator/responses/aws/ssm-getcommands.json';

vi.mock('../../../src/lib/cloud-manager/credentials.ts', () => {
    return {
        getCredentialDetails() {
            return cloudManagerAwsCredentials;
        }
    };
});

describe('sendSSMCommand', () => {
    it('sendSSMCommand', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const client = await getSSMClient('us-east-1', credentialsId);
        const params = {
            DocumentName: 'AWS-RunPowerShellScript',
            Documentversion: '1',
            Parameters: {
                commands: ['dummy']
            },
            InstanceIds: [`${faker.string.alpha(12)}`]
        };
        const resp = await sendSSMCommand(client, params);
        expect(resp).toEqual(ssmCommandOutput.Command.CommandId);
    });

    // it('getCommandInvocation', async () => {
    //     const credentialsId = `${faker.string.alpha(20)}`;
    //     const client = await getSSMClient('us-east-1', credentialsId);
    //     const params = {
    //         CommandId: '3b7b2232-67de-4b43-8d52-2997f7b259dd',
    //         InstanceId: 'i-0880a21327284f67c'
    //     };
    //     const resp = await getCommandInvocation(client, params);
    //     expect(resp).toEqual(getssmcoommandoutput);
    // });
});
