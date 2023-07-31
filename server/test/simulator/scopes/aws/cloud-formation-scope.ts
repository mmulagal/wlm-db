// @ts-nocheck
import { CloudFormationClient, ListStacksCommand, CreateStackCommand } from '@aws-sdk/client-cloudformation';
import { mockClient } from 'aws-sdk-client-mock';
import listStacks from '../../responses/aws/cloud-formation-stacks.json';
import createStackResponse from '../../responses/aws/cloud-formation-createstack.json';

const cfMock = mockClient(CloudFormationClient);

cfMock.on(ListStacksCommand).resolves(listStacks);

cfMock.on(CreateStackCommand).resolves(createStackResponse);
