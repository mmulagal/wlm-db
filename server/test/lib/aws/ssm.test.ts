import { faker } from '@faker-js/faker';
import { sendSSMCommand, getCommandInvocation } from '../../../src/lib/aws/ssm';
import { SSM_PARAMS } from '../../utils/consts';
import ssmCommandOutput from '../../simulator/responses/aws/ssm-sendcommands-response.json';
import ssmResponse from '../../simulator/responses/aws/ssm-response.json';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/aws/ssm-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';

const credentialsId = `${faker.string.alpha(20)}`;

describe('sendSSMCommand', () => {
    it('sendSSMCommand', async () => {
        const resp = await sendSSMCommand(credentialsId, 'ap-southeast-1', SSM_PARAMS);
        expect(resp).toEqual(ssmCommandOutput.resourceCommandResponse.Command.CommandId);
    });

    it('getCommandInvocation', async () => {
        const params = {
            CommandId: '3b7b2232-67de-4b43-8d52-2997f7b259dd',
            InstanceId: 'i-0880a21327284f67c'
        };
        const resp = await getCommandInvocation(credentialsId, 'us-east-1', params);
        expect(resp).toEqual(ssmResponse.ssmResponse);
    });
});
