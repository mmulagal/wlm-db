// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { faker } from '@faker-js/faker';
import {
    EC2Client,
    DescribeVpcsCommand,
    DescribeSubnetsCommand,
    DescribeSecurityGroupsCommand,
    DescribeImagesCommand,
    DescribeRegionsCommand,
    DescribeRouteTablesCommand,
    DescribeKeyPairsCommand,
    DescribeInstanceTypesCommand,
    DescribeNetworkInterfacesCommand,
    DescribeInstancesCommand,
    DescribeVpcEndpointsCommand,
    DescribeInstanceTypeOfferingsCommand,
    ModifyVpcAttributeCommand,
    DescribeVolumesCommand,
    DescribeSnapshotsCommand
} from '@aws-sdk/client-ec2';
import { mockClient } from 'aws-sdk-client-mock';
import vpcsResponse from '../../responses/aws/list-vpcs.json';
import subnetsResponse from '../../responses/aws/list-subnets.json';
import securityGroupsResponse from '../../responses/aws/list-security-groups.json';
import ec2ImagesResponse from '../../responses/aws/ec2-images.json';
import ec2AMIImagesResponse from '../../responses/aws/ec2-ami-images.json';
import fsxRegionsResponse from '../../responses/aws/list-fsx-regions.json';
import ec2InstanaceTypes from '../../responses/aws/ec2-instance-types.json';
import routeTablesResponse from '../../responses/aws/list-route-tables.json';
import networkInterfaceResponse from '../../responses/aws/list-network-interfaces.json';
import describeInstanceResponse from '../../responses/aws/describe-instance.json';
import describeVpcEndpointsResponse from '../../responses/aws/describe-endpoints.json';
import describeInstanceTypeOfferings from '../../responses/aws/describe-instancetype-offerings.json';
import modifyVpcAttributesResponse from '../../responses/aws/modify-vpc-attributes.json';
import describeVolumesResponse from '../../responses/aws/describe-volumes.json';
import describeSnapshotsResponse from '../../responses/aws/describe-snapshots.json';

const KeyPairId = `${faker.string.alphanumeric(20)}`;
const KeyFingerprint = `${faker.string.alphanumeric(20)}`;

const keyPairsResponse = {
    KeyPairs: [
        {
            KeyPairId,
            KeyFingerprint,
            KeyName: 'Key-Pair-1',
            KeyType: 'rsa',
            Tags: [],
            CreateTime: '2022-01-09T21:45:04.000Z'
        },
        {
            KeyPairId,
            KeyFingerprint,
            KeyName: 'Key-Pair-2',
            KeyType: 'rsa',
            Tags: [],
            CreateTime: '2023-02-14T06:29:16.874Z'
        },
        {
            KeyPairId,
            KeyFingerprint,
            KeyName: 'Key-Pair-3',
            KeyType: 'rsa',
            Tags: [],
            CreateTime: '2023-02-14T07:06:02.860Z'
        }
    ]
};

const amiOwners = [
    '801119661308',
    '185158320714',
    '536790793924',
    '688423173695',
    '878052572473',
    '159365745649',
    '903064639964',
    '311529897437'
];

const FIRSTIMAGEFILTER = {
    Filters: [
        { Name: 'name', Values: ['Windows_Server-2016-English-Full-SQL_2016_SP*_Enterprise*'] },
        { Name: 'owner-alias', Values: ['amazon'] }
    ],
    Owners: amiOwners
};

const SECONDIMAGEFILTER = {
    Filters: [
        { Name: 'name', Values: ['Windows_Server-2016-English-Full-SQL_2016_SP*_Standard*'] },
        { Name: 'owner-alias', Values: ['amazon'] }
    ],
    Owners: amiOwners
};

const THIRDIMAGEFILTER = {
    Filters: [
        { Name: 'name', Values: ['Windows_Server-2016-English-Full-SQL_2019_Standard*'] },
        { Name: 'owner-alias', Values: ['amazon'] }
    ],
    Owners: amiOwners
};

const FOURTHIMAGEFILTER = {
    Filters: [
        { Name: 'name', Values: ['Windows_Server-2016-English-Full-SQL_2019_Enterprise*'] },
        { Name: 'owner-alias', Values: ['amazon'] }
    ],
    Owners: amiOwners
};

const FIFTHIMAGEFILTER = {
    Filters: [
        { Name: 'name', Values: ['Windows_Server-2019-English-Full-SQL_2016_SP*_Standard*'] },
        { Name: 'owner-alias', Values: ['amazon'] }
    ],
    Owners: amiOwners
};

const SIXTHIMAGEFILTER = {
    Filters: [
        { Name: 'name', Values: ['Windows_Server-2019-English-Full-SQL_2019_Standard*'] },
        { Name: 'owner-alias', Values: ['amazon'] }
    ],
    Owners: amiOwners
};

const SEVENTHIMAGEFILTER = {
    Filters: [
        { Name: 'name', Values: ['Windows_Server-2019-English-Full-SQL_2022_Standard*'] },
        { Name: 'owner-alias', Values: ['amazon'] }
    ],
    Owners: amiOwners
};

const EIGHTHIMAGEFILTER = {
    Filters: [
        { Name: 'name', Values: ['Windows_Server-2019-English-Full-SQL_2016_SP*_Enterprise*'] },
        { Name: 'owner-alias', Values: ['amazon'] }
    ],
    Owners: amiOwners
};

const NINETHIMAGEFILTER = {
    Filters: [
        { Name: 'name', Values: ['Windows_Server-2019-English-Full-SQL_2019_Enterprise*'] },
        { Name: 'owner-alias', Values: ['amazon'] }
    ],
    Owners: amiOwners
};

const TENTHIMAGEFILTER = {
    Filters: [
        { Name: 'name', Values: ['Windows_Server-2019-English-Full-SQL_2022_Enterprise*'] },
        { Name: 'owner-alias', Values: ['amazon'] }
    ],
    Owners: amiOwners
};

const ec2Mock = mockClient(EC2Client);

ec2Mock.on(DescribeVpcsCommand).resolves(vpcsResponse);

ec2Mock.on(DescribeSubnetsCommand).resolves(subnetsResponse);

ec2Mock.on(DescribeSecurityGroupsCommand).resolves(securityGroupsResponse);

ec2Mock.on(DescribeImagesCommand).resolves(ec2ImagesResponse);

ec2Mock.on(DescribeImagesCommand, FIRSTIMAGEFILTER).resolves(ec2AMIImagesResponse[0]);

ec2Mock.on(DescribeImagesCommand, SECONDIMAGEFILTER).resolves(ec2AMIImagesResponse[1]);

ec2Mock.on(DescribeImagesCommand, THIRDIMAGEFILTER).resolves(ec2AMIImagesResponse[2]);

ec2Mock.on(DescribeImagesCommand, FOURTHIMAGEFILTER).resolves(ec2AMIImagesResponse[3]);

ec2Mock.on(DescribeImagesCommand, FIFTHIMAGEFILTER).resolves(ec2AMIImagesResponse[4]);

ec2Mock.on(DescribeImagesCommand, SIXTHIMAGEFILTER).resolves(ec2AMIImagesResponse[5]);

ec2Mock.on(DescribeImagesCommand, SEVENTHIMAGEFILTER).resolves(ec2AMIImagesResponse[6]);

ec2Mock.on(DescribeImagesCommand, EIGHTHIMAGEFILTER).resolves(ec2AMIImagesResponse[7]);

ec2Mock.on(DescribeImagesCommand, NINETHIMAGEFILTER).resolves(ec2AMIImagesResponse[8]);

ec2Mock.on(DescribeImagesCommand, TENTHIMAGEFILTER).resolves(ec2AMIImagesResponse[9]);

ec2Mock.on(DescribeRegionsCommand).resolves(fsxRegionsResponse);

ec2Mock.on(DescribeInstanceTypesCommand).resolves(ec2InstanaceTypes);

ec2Mock.on(DescribeRouteTablesCommand).resolves(routeTablesResponse);

ec2Mock.on(DescribeKeyPairsCommand).resolves(keyPairsResponse);

ec2Mock.on(DescribeNetworkInterfacesCommand).resolves(networkInterfaceResponse);

ec2Mock.on(DescribeInstancesCommand).resolves(describeInstanceResponse);

ec2Mock.on(DescribeVpcEndpointsCommand).resolves(describeVpcEndpointsResponse);

ec2Mock.on(DescribeInstanceTypeOfferingsCommand).resolves(describeInstanceTypeOfferings);

ec2Mock.on(ModifyVpcAttributeCommand).resolves(modifyVpcAttributesResponse);

ec2Mock.on(DescribeVolumesCommand).resolves(describeVolumesResponse);

ec2Mock.on(DescribeSnapshotsCommand).resolves(describeSnapshotsResponse);
