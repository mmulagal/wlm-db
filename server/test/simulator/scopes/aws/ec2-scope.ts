// @ts-nocheck
import {
    EC2Client,
    DescribeVpcsCommand,
    DescribeSubnetsCommand,
    DescribeSecurityGroupsCommand,
    DescribeImagesCommand,
    DescribeRegionsCommand,
    DescribeRouteTablesCommand,
    DescribeKeyPairsCommand
} from '@aws-sdk/client-ec2';
import { mockClient } from 'aws-sdk-client-mock';
import vpcsResponse from '../../responses/aws/list-vpcs.json';
import subnetsResponse from '../../responses/aws/list-subnets.json';
import securityGroupsResponse from '../../responses/aws/list-security-groups.json';
import ec2ImagesResponse from '../../responses/aws/ec2-images.json';
import fsxRegionsResponse from '../../responses/aws/list-fsx-regions.json';
import routeTablesResponse from '../../responses/aws/list-route-tables.json';
import keyPairsResponse from '../../responses/aws/list-key-pairs.json';

const ec2Mock = mockClient(EC2Client);

ec2Mock.on(DescribeVpcsCommand).resolves(vpcsResponse);

ec2Mock.on(DescribeSubnetsCommand).resolves(subnetsResponse);

ec2Mock.on(DescribeSecurityGroupsCommand).resolves(securityGroupsResponse);

ec2Mock.on(DescribeImagesCommand).resolves(ec2ImagesResponse);

ec2Mock.on(DescribeRegionsCommand).resolves(fsxRegionsResponse);

ec2Mock.on(DescribeRouteTablesCommand).resolves(routeTablesResponse);
ec2Mock.on(DescribeKeyPairsCommand).resolves(keyPairsResponse);
