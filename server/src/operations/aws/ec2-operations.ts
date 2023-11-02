import createError from 'http-errors';
import {
    DescribeSubnetsRequest,
    DescribeSecurityGroupsRequest,
    Tag,
    DescribeNetworkInterfacesCommandInput
} from '@aws-sdk/client-ec2';
import { Static } from '@fastify/type-provider-typebox';
import { AWSQueryFields, EC2_INSTANCE_TYPE_EXCLUDE_LIST } from '../../utils/consts';
import {
    describeVpc,
    describeSecurityGroups,
    describeSubnets,
    getAmis,
    describeRouteTable,
    describeKeyPairs,
    describeInstanceTypes,
    describeNetworkInterfaces
} from '../../lib/aws/ec2';
import getLogger from '../../utils/logger';
import { KeyPairsSchema } from '../../routes/types/aws.types';
import { filterSqlAmis } from '../../utils/utils';

const logger = getLogger();

interface VPC {
    id?: string;
    state?: string;
    cidrBlock?: any;
    tags?: Array<{ Key?: string; Value?: string }>;
    isDefault?: boolean;
    subnets?: Array<Subnet>;
    securityGroups?: Array<SecurityGroup>;
    name?: string;
}
interface Subnet {
    id?: string;
    name?: string;
    state?: string;
    vpcId?: string;
    tags?: Array<{ Key?: string; Value?: string }>;
    cidrBlock?: string;
    availabilityZone?: string;
    availableIps?: number;
    routeTableId?: string;
}
interface SecurityGroup {
    id?: string;
    description?: string;
    vpcId?: string;
    ipPermissions?: any;
    name?: string;
    securityGroupName?: string;
}

interface NetworkInterface {
    id?: string;
    description?: string;
    vpcId?: string;
    subnetId?: string;
    securityGroups?: Array<string>;
    availabilityZone?: string;
}

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
                    fieldsValues?.includes(AWSQueryFields.SUBNET)
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
        for (const subnet of subnets) {
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
        }
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
        ]
    });

    if (!amis?.Images) {
        throw createError(404, `The requested ${osType} ${databaseType} AMI could not be found`);
    }

    const response = amis.Images.map(
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
    const filteredInstances = response
        .filter(
            ({ InstanceType }) =>
                !EC2_INSTANCE_TYPE_EXCLUDE_LIST.some((excludedType: string) => InstanceType?.includes(excludedType))
        )
        .map(({ InstanceType, EbsInfo, VCpuInfo, MemoryInfo, ProcessorInfo }) => ({
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
export {
    getVpcsList,
    getAmiList,
    getKeyPairsList,
    getInstanceTypes,
    getWindowsServerBaseAmi,
    getSecurityGroupsList,
    getNetworkInterfacesList
};
