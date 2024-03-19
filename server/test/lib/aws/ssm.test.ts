import { faker } from '@faker-js/faker';

import { PutParameterCommandInput } from '@aws-sdk/client-ssm';
import {
    sendSSMCommand,
    getCommandInvocation,
    describeFSxOntapRegions,
    getConnectionStatus,
    putParameter,
    getParameter
} from '../../../src/lib/aws/ssm';
import { SSM_PARAMS, DEFAULT_AWS_CREDENTIALS_TYPE } from '../../utils/consts';
import ssmCommandOutput from '../../simulator/responses/aws/ssm-sendcommands-response.json';
import ssmResponse from '../../simulator/responses/aws/ssm-response.json';
import fsxOntapRegions from '../../simulator/responses/aws/list-fsx-ontap-regions.json';
import getConnectionStatusResponse from '../../simulator/responses/aws/ssm-connection-status.json';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/aws/ssm-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import putParameterResponse from '../../simulator/responses/aws/ssm-put-parameter.json';
import getParameterResponse from '../../simulator/responses/aws/ssm-get-parameter.json';

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

    it('List of AWS regions supporting Amazon FSx for NetApp ONTAP', async () => {
        const response = await describeFSxOntapRegions(DEFAULT_AWS_CREDENTIALS_TYPE);
        expect(response).toEqual(fsxOntapRegions.Parameters);
    });

    it('SSM connection status', async () => {
        const params = { Target: 'i-07e76a4b916548dc0' };
        const response = await getConnectionStatus(credentialsId, 'us-east-1', params);
        expect(response).toEqual(getConnectionStatusResponse);
    });

    it('Put parameters in ssm parameter store', async () => {
        const params: PutParameterCommandInput = {
            // PutParameterRequest
            Name: '/i-0e5af83448e1b83ef/instanceId/username', // required
            Value: 'SQLdev', // required
            Type: 'SecureString',
            Tier: 'Standard',
            Overwrite: true
        };

        const response = await putParameter(credentialsId, 'us-east-1', params);
        expect(response).toEqual(putParameterResponse);
    });

    it('Get parameters from SSM parameter store', async () => {
        const response = await getParameter(credentialsId, 'us-east-1', '/netapp/wlmdb/i-test-ec2');
        expect(response).toEqual(getParameterResponse.Parameter.Value);
    });
});
