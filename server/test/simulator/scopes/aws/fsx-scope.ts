// @ts-nocheck
import { FSxClient, DescribeFileSystemsCommand, DescribeVolumesCommand } from '@aws-sdk/client-fsx';
import { mockClient } from 'aws-sdk-client-mock';
import fsxFileSystemsResponse from '../../responses/aws/list-fsx-filesystems.json';
import fsxVolumesResponse from '../../responses/aws/list-fsx-volumes.json';

const ec2Mock = mockClient(FSxClient);

ec2Mock.on(DescribeFileSystemsCommand).resolves(fsxFileSystemsResponse);
ec2Mock.on(DescribeVolumesCommand).resolves(fsxVolumesResponse);
