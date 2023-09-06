import { faker } from '@faker-js/faker';
import { sendSSMCommand, getCommandInvocation } from '../../../src/lib/aws/ssm';
import { SSM_PARAMS } from '../../utils/consts';
import ssmCommandOutput from '../../simulator/responses/aws/ssm-sendcommands-response.json';
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
