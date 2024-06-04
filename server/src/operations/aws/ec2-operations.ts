import createError from 'http-errors';
import { compact, isEmpty } from 'lodash-es';
import {
    DescribeSubnetsRequest,
    DescribeSecurityGroupsRequest,
    Tag,
    DescribeNetworkInterfacesCommandInput,
    DescribeTagsCommandInput,
    DescribeVpcEndpointsCommandInput,
    VpcEndpoint,
    DescribeSnapshotsCommandInput,
    _InstanceType,
    ImageState,
    PlatformValues,
    Instance
} from '@aws-sdk/client-ec2';
import { Static } from '@fastify/type-provider-typebox';
import {
    AMI_OWNERS,
    AWSQueryFields,
    EBS_DEFAULT_VOLUME_SIZE,
    ENDPOINTS_DEPLOYMENT,
    HttpErrorCodes,
    SqlServerDeploymentModel,
    VALIDATION_NODE_INSTANCETYPE,
    WLMDB_COST_ALLOCATION_TAG
} from '../../utils/consts';
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
    describeEndpoints,
    modifyVpcAttributes,
    describeInstanceTypeOfferings,
    describeSnapshots,
    describeInstance,
    describeInstanceType,
    getInstanceTypesFromInstanceRequirementsCommand
} from '../../lib/aws/ec2';
import getLogger from '../../utils/logger';
import { KeyPairsSchema } from '../../routes/types/aws.types';
import { filterSqlAmis } from '../../utils/utils';
import { getEbsVolumeUtilization, getInstanceUtilization } from './cloud-watch-operations';
import {
    ResourceDetails,
    SecurityGroup,
    Subnet,
    VPC,
    NetworkInterface,
    Metadata,
    NodeDetails
} from '../../utils/common-types';
import { getRoleDetails } from '../cloud-manager/credentials-operations';

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

        // https://jira.ngage.netapp.com/browse/DBS-2453
        // "ec2:Describevpcendpoints" is needed to determine if endpoints are available. If this assessment fails, then endpoint
        // parameters will carry incorrect values and deployment fails.
        // So, lets check early if endpoints can be fetched.
        const [firstVpc] = vpcs.values();
        await getVpcEndpoints(credentialsId, region, firstVpc.id!);

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
    osType?: string,
    databaseType?: string,
    osVersion?: string,
    databaseVersion?: string,
    databaseEdition?: string,
    customAmi?: boolean
) {
    logger.info('Get AWS Amis', {
        credentialsId,
        region,
        osType,
        osVersion,
        databaseType,
        databaseEdition,
        databaseVersion,
        customAmi
    });

    let amis;
    if (customAmi) {
        const { providerAccountId } = await getRoleDetails(credentialsId);
        amis = await getAmis(credentialsId, region, {
            Owners: [providerAccountId],
            Filters: [
                { Name: 'state', Values: [ImageState.available] },
                { Name: 'platform', Values: [PlatformValues.Windows.toLowerCase()] }
            ]
        });
        if (!amis?.Images || isEmpty(amis?.Images)) {
            logger.info(`AWS account ${providerAccountId} does not own any amis in region ${region}.`);
            return { amis: [] };
        }
    } else {
        const amiNames = filterSqlAmis(osVersion, databaseVersion, databaseEdition);

        amis = await getAmis(credentialsId, region, {
            Filters: [
                { Name: 'name', Values: amiNames },
                { Name: 'owner-alias', Values: [AMI_OWNERS.AMAZON] }
            ],
            Owners: [
                '801119661308', // for regular regions
                '185158320714', // for il-central-1
                '536790793924', // for eu-central-2
                '688423173695', // for eu-south-2
                '878052572473', // for me-central-1
                '159365745649', // for ap-south-2
                '903064639964', // ap-southeast-3
                '311529897437', //  ap-southeast-4
                '442396546477', // af-south-1
                '777534740333', // ap-east-1
                '460214486919', // eu-south-1
                '162367869970' // me-south-1
            ]
        });

        if (!amis?.Images || isEmpty(amis?.Images)) {
            throw createError(404, `The requested ${osType} ${databaseType} AMI could not be found`);
        }
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
            Hypervisor,
            BlockDeviceMappings: [{ Ebs: { VolumeSize: amiVolumeSize = EBS_DEFAULT_VOLUME_SIZE } = {} } = {}] = []
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
            hypervisor: Hypervisor,
            ebsVolumeSize: amiVolumeSize
        })
    );
    if (!customAmi) {
        response
            .sort(
                (a, b) =>
                    new Date(b.name.substring(b.name.length - 10)).getTime() -
                    new Date(a.name.substring(a.name.length - 10)).getTime()
            )
            .filter(image => !image.name?.includes('2023.11.15'));
    }

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
    const { region, credentials_id: credentialsId, metadata } = resourceDetail;
    const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;
    const resourceIds = [node1InstanceId];
    if (node2InstanceId) {
        resourceIds.push(node2InstanceId);
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
                    `com.amazonaws.${region}.ssm`,
                    `com.amazonaws.${region}.ssmmessages`,
                    `com.amazonaws.${region}.ec2messages`,
                    `com.amazonaws.${region}.sqs`,
                    `com.amazonaws.${region}.logs`,
                    `com.amazonaws.${region}.fsx`,
                    `com.amazonaws.${region}.ec2`
                ]
            }
        ]
    };
    const response = await describeEndpoints(credentialsId, region, input);
    if (isEmpty(response)) {
        throw createError(
            HttpErrorCodes.UNAUTHORIZED,
            'Unable to fetch VPC endpoints. Check if role has "ec2:DescribeVpcEndpoints" permission.'
        );
    }

    logger.debug('Get vpc endpoints response:', response);

    return response.VpcEndpoints;
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

async function getServicesWithNoEndpoint(
    credentialsId: string,
    region: string,
    vpcId: string,
    routeTableIds: string[]
) {
    logger.info('Get services with no endpoint ', credentialsId, region, vpcId, routeTableIds);

    const endpoints = await getVpcEndpoints(credentialsId, region, vpcId);

    // If s3 gateway exists, then find if all routetables are associated with the endpoint. If not create new s3 endpoint
    const routeTableIdsInS3Endpoint =
        endpoints && !isEmpty(endpoints)
            ? endpoints
                  .filter(endpoint => endpoint.ServiceName?.includes('s3'))
                  .flatMap(endpoint => endpoint.RouteTableIds)
            : [];
    const missingRoutesInS3 =
        routeTableIds && !isEmpty(routeTableIds)
            ? routeTableIds.filter(rt => routeTableIdsInS3Endpoint.indexOf(rt) < 0)
            : [];

    const availableEndpoints = !isEmpty(endpoints)
        ? [...new Set(endpoints!.map(({ ServiceName }: VpcEndpoint) => ServiceName?.split('.')[3]))]
        : [];
    const servicesWithNoEndpoint = ENDPOINTS_DEPLOYMENT.filter(
        endpoint => !availableEndpoints.includes(endpoint) || (endpoint.includes('s3') && missingRoutesInS3.length > 0)
    );

    return { servicesWithNoEndpoint, missingRoutesInS3 };
}

async function enableVpcDnsAttributes(credentialsId: string, region: string, vpcId: string) {
    logger.info('Enable vpc dns attributes', credentialsId, region, vpcId);

    // <p>You cannot modify the DNS resolution and DNS hostnames attributes in the same request. Use separate requests for each attribute.</p>
    const [dnsHostnameResponse, dnsSupportResponse] = await Promise.all([
        modifyVpcAttributes(credentialsId, region, { VpcId: vpcId, EnableDnsSupport: { Value: true } }),
        modifyVpcAttributes(credentialsId, region, { VpcId: vpcId, EnableDnsHostnames: { Value: true } })
    ]);

    logger.debug('Enable vpc dns attributes response ', dnsHostnameResponse, dnsSupportResponse);

    return [dnsHostnameResponse, dnsSupportResponse];
}

async function getValidationNodeInstanceType(credentialsId: string, region: string, availabilityZones: string[]) {
    logger.info('Get instance type offerings ', credentialsId, region, availabilityZones);

    const response = await describeInstanceTypeOfferings(credentialsId, region, {
        LocationType: 'availability-zone',
        Filters: [{ Name: 'instance-type', Values: ['t2.micro', 't3.micro'] }]
    });

    const t2microSupportedZones = response.InstanceTypeOfferings?.filter(e =>
        e.InstanceType?.includes(VALIDATION_NODE_INSTANCETYPE.T2MICRO)
    ).map(e => e.Location as string);

    const instanceType = availabilityZones.every(a => t2microSupportedZones?.includes(a))
        ? VALIDATION_NODE_INSTANCETYPE.T2MICRO
        : VALIDATION_NODE_INSTANCETYPE.T3MICRO;

    return instanceType;
}

async function isEbsAwsBackupEnabled(credentialsId: string, region: string, ebsVolumeIds: string[]) {
    logger.info('Check if EBS AWS backup is enabled', {
        credentialsId,
        region,
        ebsVolumeIds
    });

    const input: DescribeSnapshotsCommandInput = {
        Filters: [
            {
                Name: 'volume-id',
                Values: ebsVolumeIds
            }
        ]
    };

    const backups = await describeSnapshots(credentialsId, region, input);

    return backups.Snapshots?.length !== 0;
}

async function determineSmallerInstance(credentialsId: string, region: string, instanceTypes: _InstanceType[]) {
    const { InstanceTypes: instanceTypesListWithDetails } = await describeInstanceType(
        credentialsId,
        region,
        instanceTypes
    );
    let [smallerInstanceType] = instanceTypesListWithDetails || [];

    if (instanceTypesListWithDetails?.length && instanceTypesListWithDetails?.length > 1) {
        instanceTypesListWithDetails?.forEach(instanceTypeDetails => {
            const { VCpuInfo, MemoryInfo } = instanceTypeDetails;

            if (
                VCpuInfo?.DefaultVCpus &&
                smallerInstanceType.VCpuInfo?.DefaultVCpus &&
                MemoryInfo?.SizeInMiB &&
                smallerInstanceType.MemoryInfo?.SizeInMiB
            ) {
                // Compare the number of vCPUs
                if (VCpuInfo.DefaultVCpus < smallerInstanceType.VCpuInfo?.DefaultVCpus) {
                    smallerInstanceType = instanceTypeDetails;
                } else if (VCpuInfo.DefaultVCpus === smallerInstanceType.VCpuInfo?.DefaultVCpus) {
                    // If the number of vCPUs is the same, compare the amount of memory
                    if (MemoryInfo?.SizeInMiB < smallerInstanceType.MemoryInfo?.SizeInMiB) {
                        smallerInstanceType = instanceTypeDetails;
                    }
                }
            }
        });
    }

    return smallerInstanceType;
}
async function determineBiggerInstance(credentialsId: string, region: string, instanceTypes: _InstanceType[]) {
    const { InstanceTypes: instanceTypesListWithDetails } = await describeInstanceType(
        credentialsId,
        region,
        instanceTypes
    );
    let [biggerInstanceType] = instanceTypesListWithDetails || [];

    if (instanceTypesListWithDetails?.length && instanceTypesListWithDetails?.length > 1) {
        instanceTypesListWithDetails?.forEach(instanceTypeDetails => {
            const { VCpuInfo, MemoryInfo } = instanceTypeDetails;

            if (
                VCpuInfo?.DefaultVCpus &&
                biggerInstanceType.VCpuInfo?.DefaultVCpus &&
                MemoryInfo?.SizeInMiB &&
                biggerInstanceType.MemoryInfo?.SizeInMiB
            ) {
                // Compare the number of vCPUs
                if (VCpuInfo.DefaultVCpus > biggerInstanceType.VCpuInfo?.DefaultVCpus) {
                    biggerInstanceType = instanceTypeDetails;
                } else if (VCpuInfo.DefaultVCpus === biggerInstanceType.VCpuInfo?.DefaultVCpus) {
                    // If the number of vCPUs is the same, compare the amount of memory
                    if (MemoryInfo?.SizeInMiB > biggerInstanceType.MemoryInfo?.SizeInMiB) {
                        biggerInstanceType = instanceTypeDetails;
                    }
                }
            }
        });
    }

    return biggerInstanceType;
}

async function getInstanceTypesFromInstanceRequirements(
    credentialsId: string,
    region: string,
    instanceIds: string[],
    ebsVolumeIds: string[],
    deploymentType: string
) {
    logger.info('Getting instance types from instance requirements', credentialsId, region, instanceIds, ebsVolumeIds);

    const { Reservations } = await describeInstance(credentialsId, region!, {
        InstanceIds: instanceIds
    });
    const instances = Reservations?.map(reservation => reservation.Instances).flat();
    const currentInstanceTypes = instances?.map(instance => instance?.InstanceType) as _InstanceType[];

    const [{ Architecture, VirtualizationType }] = instances as Instance[]; // assuming that both the nodes in AOAG/FCI have the same architecture and virtualization type.

    if (
        !isEmpty(instances) &&
        Architecture &&
        VirtualizationType &&
        currentInstanceTypes &&
        currentInstanceTypes?.length > 0
    ) {
        const { peakCpuUtilizationPercentage, averageNetworkBandwidthGbps } = await getInstanceUtilization(
            region,
            credentialsId,
            instanceIds
        );

        const { MemoryInfo, VCpuInfo, NetworkInfo } = await determineBiggerInstance(
            credentialsId,
            region,
            currentInstanceTypes
        );

        let requiredNetworkBandwidth = averageNetworkBandwidthGbps;
        if (deploymentType === SqlServerDeploymentModel.SQL_STANDALONE_SHORT) {
            /*
            This calculation is relevant only in case of Standard SQL host ( 1 ec2 instance).
            In case the Src env is AOAG SQL over EBS, can we assume that the future FCI SQL over FSXN suggested, remains with the same src instance type's network bandwidth,
            since FCI do not need to handle the AOAG replication's network bandwidth.
            */

            const totalEbsBandwidthGbps = await getEbsVolumeUtilization(region, credentialsId, ebsVolumeIds);
            const { PeakBandwidthInGbps } =
                NetworkInfo?.NetworkCards?.find(
                    networkCard => networkCard.NetworkCardIndex === NetworkInfo?.DefaultNetworkCardIndex
                ) || {};
            requiredNetworkBandwidth = Math.max(
                totalEbsBandwidthGbps + averageNetworkBandwidthGbps,
                PeakBandwidthInGbps || 0
            );
            // future network bandwidth = Max{ max (sum) EBS Bandwidth measured + current max network bandwidth measured, src instance type's network }
        }

        const vcpuCountForPeakCpuUtilization = Math.round(
            VCpuInfo?.DefaultVCpus || 0 * (peakCpuUtilizationPercentage / 100)
        );
        const headroom20 = vcpuCountForPeakCpuUtilization * 0.2; // 20% of peakCpuUtilization
        const totalMinCpu20 = Math.round(
            vcpuCountForPeakCpuUtilization - headroom20 > 0 ? vcpuCountForPeakCpuUtilization - headroom20 : 1
        );
        const totalMaxCpu20 = Math.round(
            vcpuCountForPeakCpuUtilization + headroom20 <= totalMinCpu20
                ? totalMinCpu20 + 1
                : vcpuCountForPeakCpuUtilization + headroom20
        );

        try {
            const params = {
                ArchitectureTypes: [Architecture],
                VirtualizationTypes: [VirtualizationType],
                InstanceRequirements: {
                    VCpuCount: { Min: totalMinCpu20, Max: totalMaxCpu20 }, // As per req, Reduced #vcpus - according to #vcpus in use.(for Standard- headroom=20%, for AOAG, headroom = 10%).
                    MemoryMiB: { Min: MemoryInfo?.SizeInMiB }, // As per req, Memory should be the same.
                    NetworkBandwidthGbps: { Min: requiredNetworkBandwidth } // As per req, New Instance's network throughput >= Old Instance's network throughput; in AOAG future network bandwidth = Max{ max (sum) EBS Bandwidth measured + current max network bandwidth measured, src instance type's network }
                }
            };
            const { InstanceTypes: instanceTypes } = await getInstanceTypesFromInstanceRequirementsCommand(
                credentialsId,
                region,
                params
            );
            const requiredInstanceTypes = compact(
                instanceTypes
                    ?.map(requiredInstanceType => requiredInstanceType.InstanceType)
                    .filter(
                        requiredInstanceType =>
                            requiredInstanceType?.startsWith('m') ||
                            requiredInstanceType?.startsWith('c') ||
                            requiredInstanceType?.startsWith('r')
                    )
            );

            return requiredInstanceTypes;
        } catch (err) {
            logger.error('Failed to get instance types from instance requirements', err);
        }
    }
}

async function getInstanceDetailsByPrivateIp(credentialsId: string, region: string, privateIps: string[]) {
    logger.info('Get instance details by private ip', { credentialsId, region, privateIps });

    const { Reservations } = await describeInstance(credentialsId, region, {
        Filters: [
            {
                Name: 'private-ip-address',
                Values: privateIps
            }
        ]
    });
    const instanceDetails: NodeDetails[] = [];
    Reservations?.forEach(({ Instances }) => {
        const [instance] = Instances || [];
        if (instance) {
            const { InstanceId, PrivateIpAddress, InstanceType, Tags } = instance;
            if (InstanceId && PrivateIpAddress && InstanceType) {
                instanceDetails.push({
                    ec2InstanceId: InstanceId,
                    ec2InstancePrivateIpAddress: PrivateIpAddress,
                    ec2InstanceType: InstanceType,
                    ec2InstanceName: Tags?.find(tag => tag?.Key === 'Name')?.Value
                });
            }
        }
    });

    return instanceDetails;
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
    getVpcSecurityGroups,
    getServicesWithNoEndpoint,
    findResourceNameFromTags,
    enableVpcDnsAttributes,
    getValidationNodeInstanceType,
    isEbsAwsBackupEnabled,
    getInstanceTypesFromInstanceRequirements,
    getInstanceDetailsByPrivateIp,
    determineBiggerInstance,
    determineSmallerInstance
};
