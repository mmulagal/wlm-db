// @ts-nocheck
import { CloudFormationClient, ListStacksCommand } from '@aws-sdk/client-cloudformation';
import { mockClient } from 'aws-sdk-client-mock';
import listStacks from '../../responses/aws/cloud-formation-stacks.json';

const cfMock = mockClient(CloudFormationClient);

cfMock.on(ListStacksCommand).resolves(listStacks);
