import createError from 'http-errors';
import { DescribeSubnetsRequest, DescribeSecurityGroupsRequest, Tag } from '@aws-sdk/client-ec2';
import { AWSQueryFields, FSX_SUPPORTED_REGIONS, EC2INSTANCETYPESE_EXCLUDE } from '../../utils/consts';
import {
    describeVpc,
    describeSecurityGroups,
    describeSubnets,
    describeRegions,
    getAmis,
    describeInstanceTypes
} from '../../lib/aws/ec2';
import getLogger from '../../utils/logger';
import { filterSqlAmis } from '../../utils/utils';

const logger = getLogger();

interface VPC {
    id?: string;
    state?: string;
    cidrBlock?: any;
    tags?: any;
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
    tags?: any;
    cidrBlock?: string;
    availabilityZone?: string;
    availableIps?: number;
}
interface SecurityGroup {
    id?: string;
    description?: string;
    vpcId?: string;
    ipPermissions?: any;
    name?: string;
}

interface FSxAvailableRegions {
    regionCode: string;
    regionName: string;
}

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
                let name = '-';
                if (tags?.length) {
                    name = findNameFromTags(tags);
                }
                return { id, state, tags, cidrBlock, isDefault, name };
            }
        );
        const totalRecords = vpcs?.length;
        return { vpcs: vpcs, totalRecords };
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

                let name = '-';
                if (tags?.length) {
                    name = findNameFromTags(tags);
                }

                const subnetParams: DescribeSubnetsRequest = {
                    Filters: [
                        {
                            Name: 'vpc-id',
                            Values: [id as string]
                        }
                    ]
                };

                let subnetsList: Array<Subnet> = [];
                if (fieldsValues?.includes(AWSQueryFields.SUBNET)) {
                    subnetsList = await getSubnetsList(credentialsId, region, subnetParams);
                }

                const sgParams: DescribeSecurityGroupsRequest = {
                    Filters: [
                        {
                            Name: 'vpc-id',
                            Values: [id as string]
                        }
                    ]
                };
                let securityGroupList: Array<SecurityGroup> = [];
                if (fieldsValues?.includes(AWSQueryFields.SECURITY_GROUP)) {
                    securityGroupList = await getSecurityGroupsList(credentialsId, region, sgParams);
                }
                vpcs.push({
                    id,
                    state,
                    tags,
                    cidrBlock,
                    isDefault,
                    subnets: subnetsList,
                    securityGroups: securityGroupList,
                    name
                });
            })
        );
    }
    const totalRecords = vpcs?.length;
    return { vpcs: vpcs, totalRecords };
}

async function getSubnetsList(credentialsId: string, region: string, params: DescribeSubnetsRequest) {
    logger.info('List Subnets in a region', { credentialsId, region, params });

    const { Subnets: subnets } = await describeSubnets(credentialsId, region, params);
    let subnetsList: Array<Subnet> = [];
    if (subnets?.length) {
        subnetsList = subnets.map(
            ({
                SubnetId: id,
                State: state,
                VpcId: vpcId,
                Tags: tags,
                CidrBlock: cidrBlock,
                AvailabilityZone: availabilityZone,
                AvailableIpAddressCount: availableIps
            }) => {
                let name = '-';
                if (tags?.length) {
                    name = findNameFromTags(tags);
                }
                return { id, state, vpcId, tags, cidrBlock, availabilityZone, availableIps, name };
            }
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
            ({ GroupId: id, Description: description, VpcId: vpcId, IpPermissions: ipPermissions, Tags: tags }) => {
                let name = '-';
                if (tags?.length) {
                    name = findNameFromTags(tags);
                }
                return { id: id, description: description, vpcId: vpcId, ipPermissions, name };
            }
        );
    }
    return securityGroupList;
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

function findNameFromTags(tags: Tag[]) {
    logger.debug('Find name from the tags', { tags });
    const { Value: name } = tags?.find(tag => tag.Key?.toLowerCase() === 'name') || {};
    return name ? name : '-';
}

async function getFSxAvailableRegionsList(credentialsId: string): Promise<{ regions: FSxAvailableRegions[] }> {
    // eslint-disable-next-line prefer-rest-params
    logger.info('List regions supporting Amazon FSx for NetApp ONTAP', Array.from(arguments));

    const input = {
        AllRegions: false, // Describe only the regions enabled for the account
        DryRun: false,
        Filter: {
            RegionNames: Array.from(FSX_SUPPORTED_REGIONS.keys()) // Limit describe to known FSx regions only
        }
    };

    const { Regions: regions } = await describeRegions(credentialsId, input);

    const fsxRegionsList: Array<FSxAvailableRegions> = [];

    if (regions?.length) {
        regions.forEach(({ RegionName: code }) => {
            if (code && FSX_SUPPORTED_REGIONS.has(code)) {
                fsxRegionsList.push({
                    regionCode: code,
                    regionName: FSX_SUPPORTED_REGIONS.get(code)!
                });
            }
        });
    }

    return { regions: fsxRegionsList };
}

async function getInstnaceTypes(credentialsId: string, region: string) {
    logger.info('List Ec2 Instance Types in region', { credentialsId, region });
    try {
        const response = await describeInstanceTypes(credentialsId, region);
        /* 
        SDK returns all the instance types which cannot be used to create the instance for SQL deployment.
        Still trying to figure out on what basis the instances are listed in fro creation. As temp solution 
        went through the instances listed in Launch wizard and excluded few types. Needs work to filter out
        Created a list of instance that can be excluded EC2INSTANCETYPESE_EXCLUDE
        */
        const filteredInstances = response
            .filter(
                (instance: { InstanceType: string | string[] }) =>
                    !EC2INSTANCETYPESE_EXCLUDE.some((excludedType: string) =>
                        instance.InstanceType.includes(excludedType)
                    )
            )
            .map(
                (instance: {
                    EbsInfo: { EbsOptimizedInfo: { MaximumBandwidthInMbps: number } };
                    VCpuInfo: { DefaultVCpus: number };
                    MemoryInfo: { SizeInMiB: number };
                    InstanceType: string;
                }) => ({
                    instanceType: instance.InstanceType,
                    iopsInMbps: instance.EbsInfo?.EbsOptimizedInfo?.MaximumBandwidthInMbps,
                    vCpus: instance.VCpuInfo?.DefaultVCpus,
                    ramInMib: instance.MemoryInfo?.SizeInMiB
                })
            );
        const totalRecords = filteredInstances?.length;
        return { instanceTypes: filteredInstances, totalRecords };
    } catch (error: any) {
        logger.error('Failed to get the ec2 instance types', error.message);
        throw createError(error.statusCode || error.code || 500, error.message);
    }
}

export { getVpcsList, getFSxAvailableRegionsList, getAmiList, getInstnaceTypes };
