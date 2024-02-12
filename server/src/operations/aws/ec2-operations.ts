import createError from 'http-errors';
import {
    DescribeSubnetsRequest,
    DescribeSecurityGroupsRequest,
    Tag,
    DescribeNetworkInterfacesCommandInput,
    DescribeTagsCommandInput,
    DescribeVpcEndpointsCommandInput
} from '@aws-sdk/client-ec2';
import { Static } from '@fastify/type-provider-typebox';
import { AWSQueryFields, WLMDB_COST_ALLOCATION_TAG } from '../../utils/consts';
import {
    describeVpc,
    describeSecurityGroups,
    describeSubnets,
    getAmis,
    describeRouteTable,
    describeKeyPairs,
    describeInstanceTypes,
    describeNetworkInterfaces,
    createTag,
    describeTags,
    describeEndpoints
} from '../../lib/aws/ec2';
import getLogger from '../../utils/logger';
import { KeyPairsSchema } from '../../routes/types/aws.types';
import { filterSqlAmis } from '../../utils/utils';
import { ResourceDetails, SecurityGroup, Subnet, VPC, NetworkInterface } from '../../utils/common-types';

const logger = getLogger();

type KeyPairType = Static<typeof KeyPairsSchema>;

async function getVpcsList(credentialsId: string, region: string, fields?: string) {
    logger.info('List vpcs in a region', { credentialsId, region, fields });

    let fieldsValues: Array<string> = [];

    if (fields) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    }

    const { Vpcs } = (await describeVpc(credentialsId, region, {})) || [];

    let vpcs: Array<VPC> = [];

    if (Vpcs?.length && fieldsValues.length === 0) {
        vpcs = Vpcs.map(
            ({ VpcId: id, State: state, Tags: tags, CidrBlockAssociationSet: cidrBlock, IsDefault: isDefault }) => {
                const resourceName = findResourceNameFromTags(tags);
                return { id, state, tags, cidrBlock, isDefault, ...(resourceName && { name: resourceName }) };
            }
        );

        return { vpcs };
    }

    if (Vpcs?.length) {
        await Promise.all(
            Vpcs.map(async vpc => {
                const {
                    VpcId: id,
                    State: state,
                    Tags: tags,
                    CidrBlockAssociationSet: cidrBlock,
                    IsDefault: isDefault
                } = vpc;

                const subnetParams: DescribeSubnetsRequest = {
                    Filters: [
                        {
                            Name: 'vpc-id',
                            Values: [id as string]
                        }
                    ]
                };

                const proms = [];

                proms.push(
                    fieldsValues?.includes(AWSQueryFields.SUBNET)
                        ? getSubnetsList(credentialsId, region, subnetParams)
                        : Promise.resolve([])
                );

                const sgParams: DescribeSecurityGroupsRequest = {
                    Filters: [
                        {
                            Name: 'vpc-id',
                            Values: [id as string]
                        }
                    ]
                };

                proms.push(
                    fieldsValues?.includes(AWSQueryFields.SECURITY_GROUP)
                        ? getSecurityGroupsList(credentialsId, region, sgParams)
                        : Promise.resolve([])
                );

                const [subnets, securityGroups] = await Promise.all(proms);

                const resourceName = findResourceNameFromTags(tags);
                vpcs.push({
                    id,
                    state,
                    tags,
                    cidrBlock,
                    isDefault,
                    subnets,
                    securityGroups,
                    ...(resourceName && { name: resourceName })
                });
            })
        );
    }

    return { vpcs };
}

async function getSubnetsList(credentialsId: string, region: string, params: DescribeSubnetsRequest) {
    logger.info('List Subnets in a region', { credentialsId, region, params });

    const { Subnets: subnets } = await describeSubnets(credentialsId, region, params);
    const subnetsList: Array<Subnet> = [];
    if (subnets?.length) {
        await Promise.all(
            subnets.map(async subnet => {
                const {
                    SubnetId: id,
                    State: state,
                    VpcId: vpcId,
                    Tags: tags,
                    CidrBlock: cidrBlock,
                    AvailabilityZone: availabilityZone,
                    AvailableIpAddressCount: availableIps
                } = subnet;

                const options = {
                    Filters: [{ Name: 'vpc-id', Values: [vpcId as string] }]
                };

                const { RouteTables } = await describeRouteTable(credentialsId, region, options);

                let mainTable;
                let subnetTable;
                // This logic is added to know the route table id whether the subnet association is done either Explicit subnet associations or Subnets without explicit associations in aws console.
                RouteTables?.forEach(routeTable => {
                    routeTable.Associations?.forEach(association => {
                        if (association.Main) {
                            mainTable = association.RouteTableId;
                        }

                        if (association.SubnetId === id) {
                            subnetTable = association.RouteTableId;
                        }
                    });
                });

                const routeTableId = subnetTable || mainTable;

                const resourceName = findResourceNameFromTags(tags);

                subnetsList.push({
                    id,
                    state,
                    vpcId,
                    tags,
                    cidrBlock,
                    availabilityZone,
                    availableIps,
                    routeTableId,
                    ...(resourceName && { name: resourceName })
                });
            })
        );
    }
    return subnetsList;
}

async function getSecurityGroupsList(credentialsId: string, region: string, params: DescribeSecurityGroupsRequest) {
    logger.info('List Security Groups in a region', { credentialsId, region, params });

    const { SecurityGroups: securityGroups } = await describeSecurityGroups(credentialsId, region, params);
    let securityGroupList: Array<SecurityGroup> = [];
    if (securityGroups?.length) {
        securityGroupList = securityGroups.map(
            ({
                GroupId: id,
                Description: description,
                VpcId: vpcId,
                IpPermissions: ipPermissions,
                Tags: tags,
                GroupName: securityGroupName
            }) => {
                const resourceName = findResourceNameFromTags(tags);
                return {
                    id,
                    description,
                    vpcId,
                    ipPermissions,
                    ...(resourceName && { name: resourceName }),
                    securityGroupName
                };
            }
        );
    }
    return securityGroupList;
}

async function getNetworkInterfacesList(
    credentialsId: string,
    region: string,
    params: DescribeNetworkInterfacesCommandInput
) {
    logger.info('List Network Interfaces in a region', { credentialsId, region, params });

    const { NetworkInterfaces: networkInterfaces } = await describeNetworkInterfaces(credentialsId, region, params);
    let networkInterfacesList: Array<NetworkInterface> = [];
    if (networkInterfaces?.length) {
        networkInterfacesList = networkInterfaces.map(
            ({
                Groups: securityGroups,
                AvailabilityZone: availabilityZone,
                NetworkInterfaceId: id,
                Description: description,
                SubnetId: subnetId,
                VpcId: vpcId
            }) => ({
                id,
                description,
                vpcId,
                securityGroups: securityGroups?.filter(Boolean).map(sg => sg.GroupId as string),
                availabilityZone,
                subnetId
            })
        );
    }
    return networkInterfacesList;
}

async function getAmiList(
    credentialsId: string,
    region: string,
    osType: string,
    databaseType: string,
    osVersion?: string,
    databaseVersion?: string,
    databaseEdition?: string
) {
    logger.info('Get AWS Amis', {
        credentialsId,
        region,
        osType,
        osVersion,
        databaseType,
        databaseEdition,
        databaseVersion
    });

    const amiNames = filterSqlAmis(osVersion, databaseVersion, databaseEdition);

    const amis = await getAmis(credentialsId, region, {
        Filters: [
            { Name: 'name', Values: amiNames },
            { Name: 'owner-alias', Values: ['amazon'] }
        ],
        Owners: [
            '801119661308', // for regular regions
            '185158320714', // for il-central-1
            '536790793924', // for eu-central-2
            '688423173695', // for eu-south-2
            '878052572473', // for me-central-1
            '159365745649', // for ap-south-2
            '903064639964', // ap-southeast-3
            '311529897437' //  ap-southeast-4
        ]
    });

    if (!amis?.Images) {
        throw createError(404, `The requested ${osType} ${databaseType} AMI could not be found`);
    }
    // https://jira.ngage.netapp.com/browse/DBS-1403 - Temp fix to exclude 2023.11.15 since FCI installations are failing
    const response = amis.Images.filter(image => !image.Name?.includes('2023.11.15')).map(
        ({
            Name,
            Description,
            Architecture,
            ImageId,
            ImageLocation,
            Public,
            Platform,
            PlatformDetails,
            State,
            Hypervisor
        }) => ({
            name: Name as string,
            description: Description,
            architecture: Architecture,
            imageId: ImageId,
            imageLocation: ImageLocation,
            public: Public,
            platform: Platform,
            platformDetails: PlatformDetails,
            state: State,
            hypervisor: Hypervisor
        })
    );

    response?.sort(
        (a, b) =>
            new Date(b.name.substring(b.name.length - 10)).getTime() -
            new Date(a.name.substring(a.name.length - 10)).getTime()
    );

    return { amis: response };
}

/*
 * AWS considers the value of tag 'Name' as the resource name.
 * If tag 'Name' is present, return its corresponding Value.
 * Otherwise, returns undefined.
 */
function findResourceNameFromTags(tags?: Tag[]) {
    logger.debug('Find resource name from the tags', { tags });

    const { Value: name } = tags?.find(tag => tag?.Key === 'Name') || {};

    return name;
}

async function getInstanceTypes(credentialsId: string, region: string) {
    logger.info('List Ec2 Instance Types in region', { credentialsId, region });

    const response = await describeInstanceTypes(credentialsId, region);
    /*
        SDK returns all the instance types which cannot be used to create the instance for SQL deployment.
        Still trying to figure out on what basis the instances are listed in fro creation. As temp solution
        went through the instances listed in Launch wizard and excluded few types. Needs work to filter out
        Created a list of instance that can be excluded EC2_INSTANCE_TYPE_EXCLUDE_LIST
        */
    const filteredInstances = response.map(({ InstanceType, EbsInfo, VCpuInfo, MemoryInfo, ProcessorInfo }) => ({
        instanceType: InstanceType,
        iopsInMbps: EbsInfo?.EbsOptimizedInfo?.MaximumBandwidthInMbps,
        vCpus: VCpuInfo?.DefaultVCpus,
        ramInMib: MemoryInfo?.SizeInMiB,
        architecture: ProcessorInfo?.SupportedArchitectures
    }));

    return { instanceTypes: filteredInstances };
}

async function getKeyPairsList(credentialsId: string, region: string): Promise<{ keyPairs: KeyPairType[] }> {
    logger.info('List key-pairs:', { credentialsId, region });

    let kpList: Array<KeyPairType> = [];
    const { KeyPairs: kps } = await describeKeyPairs(credentialsId, region, {});

    if (kps?.length) {
        kpList = kps.map(({ KeyPairId: id, KeyName: name }) => ({ id, name }));
    }

    return { keyPairs: kpList };
}

async function getWindowsServerBaseAmi(credentialsId: string, region: string) {
    logger.info('Get Windows Server Base AMI from region', { region, credentialsId });

    const amis = await getAmis(credentialsId, region, {
        Filters: [
            { Name: 'platform', Values: ['windows'] },
            { Name: 'is-public', Values: ['true'] },
            { Name: 'owner-alias', Values: ['amazon'] },
            { Name: 'name', Values: ['Windows_Server-*-English-Full-Base*'] }
        ]
    });
    const [filteredInstances] =
        amis.Images?.filter(
            ({ Name, UsageOperation }) => UsageOperation?.includes('RunInstances:0002') && !Name?.includes('SQL')
        ) || [];

    logger.debug('Windows_Server AMI Image in region ', { region, filteredInstances });

    return filteredInstances.ImageId;
}

async function tagEc2Resource(credentialsId: string, region: string, accountId: string, ec2Id: string[], tags: Tag[]) {
    logger.info('Adding tag to EC2 resource', credentialsId, region, accountId, ec2Id);
    createTag(credentialsId, region, accountId, ec2Id, tags);
}

async function getCostAllocationTagEC2Resource(resourceDetail: ResourceDetails) {
    logger.info('Get EC2 Resources which has cost allocation tag attached');
    const { region, metadata } = resourceDetail;
    const { credentialsId, activeNodeInstanceId, standbyNodeInstanceId } = metadata as {
        credentialsId: string;
        activeNodeInstanceId: string;
        standbyNodeInstanceId: string;
    };
    const resourceIds = [activeNodeInstanceId];
    if (standbyNodeInstanceId) {
        resourceIds.push(standbyNodeInstanceId);
    }
    const input: DescribeTagsCommandInput = {
        Filters: [
            {
                Name: 'resource-id',
                Values: resourceIds
            },
            {
                Name: 'resource-type',
                Values: ['instance']
            },
            {
                Name: 'key',
                Values: [WLMDB_COST_ALLOCATION_TAG]
            },
            {
                Name: 'value',
                Values: resourceIds
            }
        ]
    };
    try {
        const ec2Resources = await describeTags(credentialsId, region!, input);
        logger.debug('EC2 Resources with cost allocation tag are ', ec2Resources);
        return ec2Resources;
    } catch (error) {
        logger.error(`Get EC2 resources ${resourceIds} has failed with the error`, error);
    }
}

async function getVpcEndpoints(credentialsId: string, region: string, vpcId: string) {
    logger.info('Get vpc endpoints ', credentialsId, region, vpcId);

    const input: DescribeVpcEndpointsCommandInput = {
        Filters: [
            {
                Name: 'vpc-id',
                Values: [vpcId]
            },
            {
                Name: 'service-name',
                Values: [
                    `com.amazonaws.${region}.s3`,
                    `com.amazonaws.${region}.cloudformation`,
                    `com.amazonaws.${region}.ssm`
                ]
            }
        ]
    };
    const response = await describeEndpoints(credentialsId, region, input);

    logger.debug('Get vpc endpoints response:', response);

    return response;
}

async function getVpcSecurityGroups(credentialsId: string, region: string, vpcId: string) {
    logger.info('Get vpc security groups', { credentialsId, region, vpcId });
    const sgParams: DescribeSecurityGroupsRequest = {
        Filters: [
            {
                Name: 'vpc-id',
                Values: [vpcId as string]
            }
        ]
    };
    const securityGroups = await getSecurityGroupsList(credentialsId, region, sgParams);
    return { securityGroups };
}

export {
    getVpcsList,
    getAmiList,
    getKeyPairsList,
    getInstanceTypes,
    getWindowsServerBaseAmi,
    getSecurityGroupsList,
    getNetworkInterfacesList,
    tagEc2Resource,
    getCostAllocationTagEC2Resource,
    getVpcEndpoints,
    getVpcSecurityGroups
};
