import {
    EC2Client,
    DescribeVpcsCommand,
    DescribeSubnetsCommand,
    DescribeSecurityGroupsCommand
} from '@aws-sdk/client-ec2';
import { mockClient } from 'aws-sdk-client-mock';
import vpcsResponse from '../../responses/aws/list-vpcs.json';
import subnetsResponse from '../../responses/aws/list-subnets.json';
import securityGroupsResponse from '../../responses/aws/list-security-groups.json';

const s3Mock = mockClient(EC2Client);

s3Mock.on(DescribeVpcsCommand).resolves(vpcsResponse);

s3Mock.on(DescribeSubnetsCommand).resolves(subnetsResponse);

s3Mock.on(DescribeSecurityGroupsCommand).resolves(securityGroupsResponse);
