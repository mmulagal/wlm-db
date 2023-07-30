// @ts-nocheck
import { FSxClient, DescribeFileSystemsCommand } from '@aws-sdk/client-fsx';
import { mockClient } from 'aws-sdk-client-mock';
import fsxFileSystemsResponse from '../../responses/aws/list-fsx-filesystems.json';

const ec2Mock = mockClient(FSxClient);

ec2Mock.on(DescribeFileSystemsCommand).resolves(fsxFileSystemsResponse);
