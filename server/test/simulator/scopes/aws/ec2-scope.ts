// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { faker } from '@faker-js/faker';
import { cloneDeep, sample } from 'lodash-es';
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
    DescribeSnapshotsCommand,
    ImageState,
    PlatformValues
} from '@aws-sdk/client-ec2';
import { mockClient } from 'aws-sdk-client-mock';
import vpcsResponse from '../../responses/aws/list-vpcs.json';
import subnetsResponse from '../../responses/aws/list-subnets.json';
import securityGroupsResponse from '../../responses/aws/list-security-groups.json';
import ec2ImagesResponse from '../../responses/aws/ec2-images.json';
import ec2CustomImagesResponse from '../../responses/aws/ec2-custom-images.json';
import ec2AMIImagesResponse from '../../responses/aws/ec2-ami-images.json';
import fsxRegionsResponse from '../../responses/aws/list-fsx-regions.json';
import ec2InstanaceTypes from '../../responses/aws/ec2-instance-types.json';
import routeTablesResponse from '../../responses/aws/list-route-tables.json';
import networkInterfaceResponse from '../../responses/aws/list-network-interfaces.json';
import describeInstanceResponse from '../../responses/aws/describe-instance.json';
import describeVpcEndpointsResponse from '../../responses/aws/describe-endpoints.json';
import describeInstanceTypeOfferings from '../../responses/aws/describe-instancetype-offerings.json';
import modifyVpcAttributesResponse from '../../responses/aws/modify-vpc-attributes.json';
// import describeVolumesResponse from '../../responses/aws/describe-volumes.json';
import describeSnapshotsResponse from '../../responses/aws/describe-snapshots.json';
import { inventoryDemoData } from '../../../../src/utils/demo-utils/demoInventoryData';

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

const generateImageFilter = (serverVersion: string, sqlVersion: string, sqlEdition: string) => ({
    Filters: [
        { Name: 'name', Values: [`Windows_Server-${serverVersion}-English-Full-SQL_${sqlVersion}_${sqlEdition}`] },
        { Name: 'owner-alias', Values: ['amazon'] }
    ],
    Owners: amiOwners
});

const images = [
    ['2016', '2016', 'SP*_Enterprise*'],
    ['2016', '2016', 'SP*_Standard*'],
    ['2016', '2019', 'Standard*'],
    ['2016', '2019', 'Enterprise*'],
    ['2019', '2016', 'SP*_Standard*'],
    ['2019', '2019', 'Standard*'],
    ['2019', '2022', 'Standard*'],
    ['2019', '2016', 'SP*_Enterprise*'],
    ['2019', '2019', 'Enterprise*'],
    ['2019', '2022', 'Enterprise*']
];

const ec2Mock = mockClient(EC2Client);

ec2Mock.on(DescribeVpcsCommand).resolves(vpcsResponse);

ec2Mock.on(DescribeSubnetsCommand).resolves(subnetsResponse);

ec2Mock.on(DescribeSecurityGroupsCommand).resolves(securityGroupsResponse);

ec2Mock.on(DescribeImagesCommand).resolves(ec2ImagesResponse);

ec2Mock
    .on(DescribeImagesCommand, {
        Filters: [
            { Name: 'state', Values: [ImageState.available] },
            { Name: 'platform', Values: [PlatformValues.Windows.toLowerCase()] }
        ]
    })
    .resolves(ec2CustomImagesResponse);

for (let i = 0; i < images.length; i += 1) {
    const [serverVersion, sqlVersion, sqlEdition] = images[i];
    const filter = generateImageFilter(serverVersion, sqlVersion, sqlEdition);
    ec2Mock
        .on(DescribeImagesCommand, filter)
        .resolves(ec2AMIImagesResponse[`Windows_Server-${serverVersion}-English-Full-SQL_${sqlVersion}_${sqlEdition}`]);
}

ec2Mock.on(DescribeRegionsCommand).resolves(fsxRegionsResponse);

ec2Mock.on(DescribeInstanceTypesCommand).resolves(ec2InstanaceTypes);

ec2Mock.on(DescribeRouteTablesCommand).resolves(routeTablesResponse);

ec2Mock.on(DescribeKeyPairsCommand).resolves(keyPairsResponse);

ec2Mock.on(DescribeNetworkInterfacesCommand).resolves(networkInterfaceResponse);

ec2Mock.on(DescribeInstancesCommand).callsFake(async (command: DescribeInstancesCommand) => {
    const instanceFilters = command?.Filters || [];

    let instancesQueryPrivateIps;
    if (instanceFilters) {
        const [filtered] = instanceFilters.filter(filter => filter?.Name === 'private-ip-address') || [];
        if (filtered) {
            instancesQueryPrivateIps = filtered?.Values;
        }
    }
    if (instanceFilters && instancesQueryPrivateIps) {
        const reservations = [];
        const { items } = inventoryDemoData('fsx', 'ebsTest'); // private-ip-address filter is only added to get partner node details of instances using ebs; revisit when the filter is used for other purposes
        const instancesWithEbs = items.filter(instance =>
            instance.sqlServerInstances?.find(({ storage }) =>
                storage?.find((sqlStorage: SqlStorage) => sqlStorage?.type === 'EBS')
            )
        );
        instancesQueryPrivateIps.forEach((privateIp: string) => {
            const instances = [];
            const dummyInstanceDetails = cloneDeep(describeInstanceResponse.Reservations[0].Instances[0]);
            const dummyResevation = cloneDeep(describeInstanceResponse.Reservations[0]);
            dummyInstanceDetails.PrivateIpAddress = privateIp;
            dummyInstanceDetails.InstanceId = sample(instancesWithEbs).ec2InstanceId;
            instances?.push(dummyInstanceDetails);
            dummyResevation.Instances = instances;
            reservations?.push(dummyResevation);
        });

        return { Reservations: reservations };
    }
    return describeInstanceResponse;
});

ec2Mock.on(DescribeVpcEndpointsCommand).resolves(describeVpcEndpointsResponse);

ec2Mock.on(DescribeInstanceTypeOfferingsCommand).resolves(describeInstanceTypeOfferings);

ec2Mock.on(ModifyVpcAttributeCommand).resolves(modifyVpcAttributesResponse);

// ec2Mock.on(DescribeVolumesCommand).resolves(describeVolumesResponse);
ec2Mock.on(DescribeVolumesCommand).callsFake(async (command: DescribeVolumesCommand) => {
    // Get the VolumeIds from the command parameters
    const volumeIds = command.VolumeIds;

    const volumes: Volume[] = volumeIds.map(volumeId => ({
        VolumeId: volumeId,
        AvailabilityZone: 'us-east-1a',
        Attachments: [
            {
                AttachTime: '2013-12-18T22:35:00.000Z',
                InstanceId: 'i-1234567890abcdef0',
                VolumeId: 'vol-049df61146c4d7901',
                State: 'attached',
                DeleteOnTermination: true,
                Device: '/dev/sda1'
            }
        ],
        Encrypted: true,
        KmsKeyId: 'arn:aws:kms:us-east-2a:123456789012:key/8c5b2c63-b9bc-45a3-a87a-5513eEXAMPLE',
        VolumeType: 'gp2',
        State: 'in-use',
        Iops: 100,
        SnapshotId: 'snap-1234567890abcdef0',
        CreateTime: '2019-12-18T22:35:00.084Z',
        Size: 8
    }));
    return {
        Volumes: volumes
    } as DescribeVolumesResult;
});
ec2Mock.on(DescribeSnapshotsCommand).resolves(describeSnapshotsResponse);
