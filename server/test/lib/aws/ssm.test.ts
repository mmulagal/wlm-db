import { faker } from '@faker-js/faker';

import { CommandFilterKey, PutParameterCommandInput } from '@aws-sdk/client-ssm';
import {
    sendSSMCommand,
    getCommandInvocation,
    getParametersByPath,
    getConnectionStatus,
    putParameter,
    getParameter,
    describeInstancePatchStates,
    describeInstancePatches,
    listSsmCommands,
    describeInstanceInformation
} from '../../../src/lib/aws/ssm';
import { SSM_PARAMS } from '../../utils/consts';
import ssmCommandOutput from '../../simulator/responses/aws/ssm-sendcommands-response.json';
import ssmResponse from '../../simulator/responses/aws/ssm-response.json';
import fsxOntapRegions from '../../simulator/responses/aws/list-fsx-ontap-regions.json';
import getConnectionStatusResponse from '../../simulator/responses/aws/ssm-connection-status.json';
import putParameterResponse from '../../simulator/responses/aws/ssm-put-parameter.json';
import getParameterResponse from '../../simulator/responses/aws/ssm-get-parameter.json';
import describePatchStatesResponse from '../../simulator/responses/aws/ssm-describe-patch-states.json';

import { AL2023_AMI_NAME } from '../../../src/utils/consts';

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
        const response = await getParametersByPath();
        expect(response).toEqual(fsxOntapRegions.Parameters);
    });

    it('List of AWS AL2023 AMIs', async () => {
        const response = await getParametersByPath(undefined, undefined, '/aws/service/ami-amazon-linux-latest');
        const isAMIPresent = response?.find(({ Name }) => Name === AL2023_AMI_NAME)?.Value;
        expect(isAMIPresent).toBeTruthy();
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

    it('Describe instance patch states', async () => {
        const params = {
            InstanceIds: ['i-0e5af83448e1b83ef']
        };
        const response = await describeInstancePatchStates(credentialsId, 'us-east-1', params);
        expect(response.InstancePatchStates).toEqual(describePatchStatesResponse.InstancePatchStates);
    });

    it('Describe instance patches', async () => {
        const params = {
            InstanceId: 'i-0e5af83448e1b83ef',
            Filters: [
                {
                    Key: 'Severity',
                    Values: ['Critical', 'Important']
                },
                {
                    Key: 'State',
                    Values: ['Missing']
                }
            ]
        };
        const [response] = await describeInstancePatches(credentialsId, 'us-east-1', params);
        expect(response.Classification).toBeDefined();
    });
    it('List commands command', async () => {
        const params = {
            InstanceId: 'i-0e5af8344inProgress',
            Filters: [
                {
                    key: CommandFilterKey.DOCUMENT_NAME,
                    value: 'AWS-RunPatchBaseline'
                },
                {
                    key: CommandFilterKey.STATUS,
                    value: 'InProgress'
                }
            ]
        };
        const response = await listSsmCommands(credentialsId, 'us-east-1', params);
        expect(response.Commands?.length).toBeGreaterThan(0);
    });

    it('List commands command none in progress', async () => {
        const params = {
            InstanceId: 'i-0e5af83448e1b83ef',
            Filters: [
                {
                    key: CommandFilterKey.DOCUMENT_NAME,
                    value: 'AWS-RunPatchBaseline'
                },
                {
                    key: CommandFilterKey.STATUS,
                    value: 'InProgress'
                }
            ]
        };
        const response = await listSsmCommands(credentialsId, 'us-east-1', params);
        expect(response.Commands?.length).toEqual(0);
    });

    it('Describe instance information', async () => {
        const params = {
            Filters: [
                {
                    Key: 'InstanceIds',
                    Values: ['i-039eb3334526ae1ca']
                }
            ]
        };
        const response = await describeInstanceInformation(credentialsId, 'us-east-1', params);
        expect(response.length).toEqual(1);
    });
});
