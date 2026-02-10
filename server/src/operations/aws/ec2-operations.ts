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
    CpuManufacturer,
    DescribeNetworkInterfacesRequest,
    DescribeRouteTablesCommandInput
} from '@aws-sdk/client-ec2';
import { Static } from '@fastify/type-provider-typebox';
import ms from 'ms';
import {
    AMI_OWNERS,
    AWSQueryFields,
    EBS_DEFAULT_VOLUME_SIZE,
    ENDPOINTS_DEPLOYMENT,
    HttpErrorCodes,
    SqlServerDeploymentModel,
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
    describeSnapshots,
    describeInstance,
    describeInstanceType,
    getInstanceTypesFromInstanceRequirementsCommand,
    describeAddresses
} from '../../lib/aws/ec2';
import getLogger from '../../utils/logger';
import { KeyPairsSchema } from '../../routes/types/aws.types';
import { filterSqlAmis, getResourceNameFromTags, isCidrContained, sleep, IS_DEMO_FLOW } from '../../utils/utils';
import { getEbsVolumeUtilization, getInstanceUtilization } from './cloud-watch-operations';
import {
    ResourceDetails,
    SecurityGroup,
    Subnet,
    VPC,
    NetworkInterface,
    Metadata,
    NodeDetails,
    AWSSDKCacheParams
} from '../../utils/common-types';
import { getRoleDetails } from '../cloud-manager/credentials-operations';
import describeAutoscalingInstances from '../../lib/aws/auto-scaling';

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
                const resourceName = getResourceNameFromTags(tags);
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

                const resourceName = getResourceNameFromTags(tags);
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

                const resourceName = getResourceNameFromTags(tags);

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
                const resourceName = getResourceNameFromTags(tags);
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
        const amiFilter =
            osType === 'windows'
                ? { Name: 'name', Values: filterSqlAmis(osVersion, databaseVersion, databaseEdition) }
                : { Name: 'description', Values: ['Amazon Linux 2023*'] };

        logger.info('AMI filter:', amiFilter);
        amis = await getAmis(credentialsId, region, {
            Filters: [amiFilter, { Name: 'owner-alias', Values: [AMI_OWNERS.AMAZON] }],
            ...(osType === 'windows' && {
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
                    '162367869970', // me-south-1
                    '194652444849', // ca-west-1,
                    '002667544638', // ap-southeast-5
                    '767398017123', // ap-southeast-7
                    '574179025982' // mx-central-1
                ]
            })
        });

        if (!amis?.Images || isEmpty(amis?.Images)) {
            throw createError(404, `The requested ${osType} ${databaseType} AMI could not be found`);
        }
    }
    const excludedVersions = ['2023.11.15'];
    // https://jira.ngage.netapp.com/browse/DBS-1403 - Temp fix to exclude 2023.11.15 since FCI installations are failing
    const response = amis.Images.filter(image => !excludedVersions.some(version => image.Name?.includes(version))).map(
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

async function getInstanceTypes(region: string, credentialsId?: string) {
    logger.info('List Ec2 Instance Types in region', { region, credentialsId });

    const response = await describeInstanceTypes(region, credentialsId);
    /*
        SDK returns all the instance types which cannot be used to create the instance for SQL deployment.
        Still trying to figure out on what basis the instances are listed in fro creation. As temp solution
        went through the instances listed in Launch wizard and excluded few types. Needs work to filter out
        Created a list of instance that can be excluded EC2_INSTANCE_TYPE_EXCLUDE_LIST
        */
    let filteredInstances = response.map(({ InstanceType, EbsInfo, VCpuInfo, MemoryInfo, ProcessorInfo }) => ({
        instanceType: InstanceType,
        iopsInMbps: EbsInfo?.EbsOptimizedInfo?.MaximumBandwidthInMbps,
        vCpus: VCpuInfo?.DefaultVCpus,
        ramInMib: MemoryInfo?.SizeInMiB,
        architecture: ProcessorInfo?.SupportedArchitectures
    }));

    /*
    https://jira.ngage.netapp.com/browse/DBS-5283:
    Pricing information is not available for Malaysia region for all instance types,
    Since demo returns a static ec2 instance type list, and pricing is from actual APIS,
    selecting a certain instance type may not work in Malaysia region, hence limitng it to certain instance types in demo
    */
    if (IS_DEMO_FLOW && region === 'ap-southeast-5') {
        // Filtering m6i* & c6i* instances for malaysia region, TODO: as DBS extends support for more regions, this call should be modified to be an actual AWS API call & not a static list
        filteredInstances = filteredInstances.filter(
            ({ instanceType }) => instanceType?.startsWith('m6i') || instanceType?.startsWith('c6i')
        );
    }

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
            { Name: 'name', Values: ['Windows_Server-2022-English-Full-Base*'] }
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

    if (!vpcId) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            'VPC ID is missing in the request, provide a valid VPC ID to proceed.'
        );
    }

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

async function validateVpcEndpoints(
    credentialsId: string,
    region: string,
    vpcDetails: { vpcId: string; vpcCidr: string },
    subnetDetails: Array<{ subnetId: string; cidr: string; routeTableId: string }>
) {
    logger.info(
        'Validating VPC endpoints for subnets association, https ingress rules, services with no endpoints',
        credentialsId,
        region,
        vpcDetails,
        subnetDetails
    );

    const { vpcId, vpcCidr: vpcCidrBlock } = vpcDetails;

    const routeTableIds = subnetDetails.map(subnet => subnet.routeTableId);

    const routeTableParams: DescribeRouteTablesCommandInput = {
        Filters: [
            {
                Name: 'route-table-id',
                Values: routeTableIds
            }
        ]
    };

    const enetInterfaces: DescribeNetworkInterfacesRequest = {
        Filters: [
            {
                Name: 'interface-type',
                Values: ['vpc_endpoint']
            },
            {
                Name: 'vpc-id',
                Values: [vpcId]
            }
        ]
    };

    const [routeTables, endpoints, vpcSecurityGroups, vpcNetworkInterfaces] = await Promise.all([
        describeRouteTable(credentialsId, region, routeTableParams),
        getVpcEndpoints(credentialsId, region, vpcId),
        getVpcSecurityGroups(credentialsId, region, vpcId),
        getNetworkInterfacesList(credentialsId, region, enetInterfaces)
    ]);

    const subnetsWithIgwRoutes = subnetDetails
        .filter(subnet => {
            const associatedRouteTable = routeTables?.RouteTables?.find(
                routeTable => routeTable.RouteTableId === subnet.routeTableId
            );

            return associatedRouteTable?.Routes?.some(route => route.GatewayId?.startsWith('igw-')) || false;
        })
        .map(subnet => subnet.subnetId);

    const endpointsWithIssues = compact(
        endpoints
            ?.filter(
                endpoint => endpoint.VpcEndpointType === 'Interface' && endpoint.VpcEndpointId && endpoint.SubnetIds
            )
            .map(endpoint => {
                const missingSubnets = subnetDetails
                    .filter(
                        s => !subnetsWithIgwRoutes.includes(s.subnetId) && !endpoint.SubnetIds?.includes(s.subnetId)
                    )
                    .map(s => s.subnetId);

                const securityGroupCidrs = vpcNetworkInterfaces
                    ?.filter(ni => endpoint.NetworkInterfaceIds?.includes(ni.id || ''))
                    .flatMap(ni => ni.securityGroups || [])
                    .flatMap(
                        sgId =>
                            vpcSecurityGroups.securityGroups
                                .find(sg => sg.id === sgId)
                                ?.ipPermissions?.filter(
                                    ({
                                        FromPort,
                                        ToPort,
                                        IpProtocol
                                    }: {
                                        FromPort: number;
                                        ToPort: number;
                                        IpProtocol: string;
                                    }) => FromPort === 443 && ToPort === 443 && IpProtocol === 'tcp'
                                )
                                .flatMap(
                                    ({ IpRanges }: { IpRanges?: Array<{ CidrIp: string }> }) =>
                                        IpRanges?.map(range => range.CidrIp) || []
                                ) || []
                    );

                const missingCidrs = securityGroupCidrs.includes(vpcCidrBlock)
                    ? []
                    : subnetDetails
                          .filter(
                              subnet =>
                                  !subnetsWithIgwRoutes.includes(subnet.subnetId) &&
                                  !securityGroupCidrs.some(cidr => isCidrContained(cidr, subnet.cidr))
                          )
                          .map(subnet => ({ subnetId: subnet.subnetId, cidrBlock: subnet.cidr }));

                return (
                    (missingSubnets.length || missingCidrs.length) && {
                        serviceName: endpoint.ServiceName!,
                        VpcEndpointId: endpoint.VpcEndpointId!,
                        missingSubnets,
                        missingCidrs
                    }
                );
            })
    );

    // Example for endpointsWithIssues
    // const endpointsWithIssues = [
    //     {
    //         serviceName: 'com.amazonaws.us-east-1.ssm',
    //         VpcEndpointId: 'vpce-1234567890abcdef0',
    //         missingSubnets: ['subnet-12345', 'subnet-67890'],
    //         missingCidrs: [
    //             { subnetId: 'subnet-12345', cidrBlock: '10.0.1.0/24' },
    //             { subnetId: 'subnet-67890', cidrBlock: '10.0.2.0/24' }
    //         ]
    //     },
    //     {
    //         serviceName: 'com.amazonaws.us-east-1.ec2',
    //         VpcEndpointId: 'vpce-abcdef1234567890',
    //         missingSubnets: ['subnet-54321'],
    //         missingCidrs: []
    //     }
    // ];

    if (!IS_DEMO_FLOW && endpointsWithIssues?.length) {
        const combinedIssues = (endpointsWithIssues || []).reduce((acc, issue) => {
            if (!issue) {
                return acc;
            }
            const key = `${issue.missingSubnets.sort().join(',')}|${(issue.missingCidrs || [])
                .map(c => c.cidrBlock)
                .sort()
                .join(',')}`;
            acc[key] = acc[key] || {
                services: [],
                missingSubnets: issue.missingSubnets,
                missingCidrs: issue.missingCidrs
            };
            acc[key].services.push(issue.serviceName);
            return acc;
        }, {} as Record<string, { services: string[]; missingSubnets: string[]; missingCidrs?: Array<{ subnetId: string; cidrBlock: string }> }>);

        const errorMessages = Object.values(combinedIssues).map(({ services, missingSubnets, missingCidrs }) => {
            const subnetsMsg = missingSubnets.length
                ? ` are not associated with subnet(s) ${missingSubnets.join(', ')}.`
                : '';
            const cidrsMsg = missingCidrs?.length
                ? `Ingress HTTPS rule is missing the following CIDRs: ${missingCidrs.map(c => c.cidrBlock).join(', ')}`
                : '';
            return `Services: ${services.join(', ')}, ${subnetsMsg} ${cidrsMsg}`;
        });

        logger.error('Validation issues found with VPC endpoints:', errorMessages);

        throw createError(
            HttpErrorCodes.VALIDATION_ERROR,
            `Validation issues found with VPC endpoints:\n${errorMessages.join(
                '\n'
            )}. \nRefer https://repost.aws/knowledge-center/vpc-fix-gateway-or-interface-endpoint for more details.`
        );
    }

    // If s3 gateway exists, then find if all routetables are associated with the endpoint. If not create new s3 endpoint
    const routeTableIdsInS3Endpoint =
        endpoints && !isEmpty(endpoints)
            ? endpoints
                  .filter(endpoint => endpoint.ServiceName?.includes('s3'))
                  .flatMap(endpoint => endpoint.RouteTableIds)
            : [];

    const missingRoutesInS3 =
        routeTableIds && !isEmpty(routeTableIds)
            ? [...new Set(routeTableIds.filter(rt => routeTableIdsInS3Endpoint.indexOf(rt) < 0))]
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

    try {
        // <p>You cannot modify the DNS resolution and DNS hostnames attributes in the same request. Use separate requests for each attribute.</p>
        const [dnsHostnameResponse, dnsSupportResponse] = await Promise.all([
            modifyVpcAttributes(credentialsId, region, { VpcId: vpcId, EnableDnsSupport: { Value: true } }),
            modifyVpcAttributes(credentialsId, region, { VpcId: vpcId, EnableDnsHostnames: { Value: true } })
        ]);

        logger.debug('Enable vpc dns attributes response ', dnsHostnameResponse, dnsSupportResponse);

        return [dnsHostnameResponse, dnsSupportResponse];
    } catch (err: any) {
        logger.error('Error while setting "EnableDnsSupport" and "EnableDnsHostnames" to true for vpc', vpcId, err);
    }
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

    const backups = await describeSnapshots(credentialsId, region, input, {
        useCache: true
    });

    return backups.Snapshots?.length !== 0;
}

async function determineSmallerInstance(region: string, instanceTypes: _InstanceType[]) {
    logger.info('Determining smaller instance type', region, instanceTypes);

    const { InstanceTypes: instanceTypesListWithDetails } = await describeInstanceType(region, instanceTypes);
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
async function determineBiggerInstance(region: string, instanceTypes: _InstanceType[]) {
    logger.info('Determining bigger instance type', region, instanceTypes);
    const { InstanceTypes: instanceTypesListWithDetails } = await describeInstanceType(region, instanceTypes);
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

async function getInstanceTypesFromInstanceRequirementsForManagedInstances(
    credentialsId: string,
    region: string,
    instanceId: string
) {
    logger.info('Getting instance types from instance requirements for managed instance', {
        credentialsId,
        region,
        instanceId
    });

    const { Reservations = [] } = await describeInstance(credentialsId, region, {
        InstanceIds: [instanceId]
    });

    const instances = Reservations.map(reservation => reservation.Instances || []).flat();
    const [{ Architecture, VirtualizationType }] = instances;
    if (Architecture && VirtualizationType) {
        const params = {
            ArchitectureTypes: [Architecture],
            VirtualizationTypes: [VirtualizationType],
            InstanceRequirements: {
                AllowedInstanceTypes: ['m*', 'c*', 'r*'], // limit to specific instance types: 'm*', 'c*', 'r*' families.
                CpuManufacturers: [CpuManufacturer.INTEL, CpuManufacturer.AMAZON_WEB_SERVICES], // Filtering AMD based instances
                VCpuCount: { Min: 2 },
                MemoryMiB: { Min: 1024 }
            }
        };

        const { InstanceTypes: instanceTypes } = await getInstanceTypesFromInstanceRequirementsCommand(
            region,
            params,
            credentialsId
        );

        const requiredInstanceTypes = compact(
            instanceTypes?.map(requiredInstanceType => requiredInstanceType.InstanceType)
        );

        return requiredInstanceTypes;
    }
}
async function getInstanceTypesFromInstanceRequirements(
    credentialsId: string,
    region: string,
    instanceIds: string[],
    ebsVolumeIds: string[],
    deploymentType: string
) {
    logger.info('Getting instance types from instance requirements', credentialsId, region, instanceIds, ebsVolumeIds);

    const { Reservations = [] } = await describeInstance(credentialsId, region!, {
        InstanceIds: instanceIds
    });
    const instances = Reservations.map(reservation => reservation.Instances || []).flat();
    const currentInstanceTypes = compact(instances.map(instance => instance.InstanceType));

    const [{ Architecture, VirtualizationType }] = instances; // assuming that both the nodes in AOAG/FCI have the same architecture and virtualization type.
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

        const { MemoryInfo, VCpuInfo, NetworkInfo } = await determineBiggerInstance(region, currentInstanceTypes);

        let requiredNetworkBandwidth = averageNetworkBandwidthGbps;
        if (deploymentType === SqlServerDeploymentModel.SQL_STANDALONE_SHORT) {
            /*
            This calculation is relevant only in case of Standard SQL host ( 1 ec2 instance).
            In case the Src env is AOAG SQL over EBS, can we assume that the future FCI SQL over FSXN suggested, remains with the same src instance type's network bandwidth,
            since FCI do not need to handle the AOAG replication's network bandwidth.
            */

            const totalEbsBandwidthGbps = await getEbsVolumeUtilization(region, credentialsId, ebsVolumeIds);
            const { BaselineBandwidthInGbps } =
                NetworkInfo?.NetworkCards?.find(
                    networkCard => networkCard.NetworkCardIndex === NetworkInfo?.DefaultNetworkCardIndex
                ) || {};
            requiredNetworkBandwidth = Math.max(
                totalEbsBandwidthGbps + averageNetworkBandwidthGbps,
                BaselineBandwidthInGbps || 0
            );
            // future network bandwidth = Max{ max (sum) EBS Bandwidth measured + current max network bandwidth measured, src instance type's network }
        }

        const vcpuCountForPeakCpuUtilization = Math.round(
            (VCpuInfo?.DefaultVCpus || 0) * (peakCpuUtilizationPercentage / 100)
        ); // calculates the vCPU count for peak CPU utilization; (default vCPU count * peak CPU utilization fraction) calculates the vCPU count required for peak CPU utilization. So, if VCpuInfo?.DefaultVCpus is 4 and peakCpuUtilizationPercentage is 50, vcpuCountForPeakCpuUtilization will be 2.

        const headroom = SqlServerDeploymentModel.SQL_AOAG_SHORT
            ? vcpuCountForPeakCpuUtilization * 0.1
            : vcpuCountForPeakCpuUtilization * 0.2; // for Standard- headroom=20%, for AOAG, headroom = 10%
        const totalMinCpu = 4; // As per req; min vcpus = 4
        const totalMaxCpu = Math.round(
            vcpuCountForPeakCpuUtilization + headroom <= totalMinCpu
                ? totalMinCpu
                : vcpuCountForPeakCpuUtilization + headroom
        );

        try {
            const params = {
                ArchitectureTypes: [Architecture],
                VirtualizationTypes: [VirtualizationType],
                InstanceRequirements: {
                    CpuManufacturers: [CpuManufacturer.INTEL, CpuManufacturer.AMAZON_WEB_SERVICES], // Filtering AMD based instances; That's a recommendation we've got from the Microsoft specialists in AWS. It is better that across the board we will filter it. Product Management thinks that in general OLTP workloads are associated with Intel processors because of hyper threading technology or something like that.
                    AllowedInstanceTypes: ['m*', 'c*', 'r*'],
                    VCpuCount: { Min: totalMinCpu, Max: totalMaxCpu }, // As per req, Reduced #vcpus - according to #vcpus in use.(for Standard- headroom=20%, for AOAG, headroom = 10%).
                    MemoryMiB: { Min: MemoryInfo?.SizeInMiB }, // As per req, Memory should be the same.
                    NetworkBandwidthGbps: { Min: requiredNetworkBandwidth } // As per req, New Instance's network throughput >= Old Instance's network throughput; in AOAG future network bandwidth = Max{ max (sum) EBS Bandwidth measured + current max network bandwidth measured, src instance type's network }
                }
            };
            let { InstanceTypes: instanceTypes } = await getInstanceTypesFromInstanceRequirementsCommand(
                region,
                params,
                credentialsId
            );
            if (isEmpty(instanceTypes)) {
                /* As the CPU reduces, memory required also reduces. Network configuration remains the same for a wide range of cpu-memory configurations.
                FOR EXAMPLE:(https://aws.amazon.com/ec2/instance-types/)
                    Instance size	vCPU	Memory (GiB)	Instance storage (GB)	Network bandwidth (Gbps)	Amazon EBS bandwidth (Gbps)
                    m8g.medium         1              4                 EBS-only                  Up to 12.5                       Up to 10

                    m8g.large          2              8                 EBS-only                  Up to 12.5                       Up to 10

                    m8g.xlarge         4             16                 EBS-only                  Up to 12.5                       Up to 10
                The network bandwidth is the same for all the instance types. So, if the instance type is not found for the given requirements, we can compromise on the memory requirement and retry.
                */

                logger.warn(
                    'No instance types found for the given requirements, so compromising on the memory requirement and retrying'
                );
                params.InstanceRequirements.MemoryMiB = { Min: 1024 }; // changing the min memory requirement to 1GB as MemoryMiB is a required field in SDK request
                ({ InstanceTypes: instanceTypes } = await getInstanceTypesFromInstanceRequirementsCommand(
                    region,
                    params,
                    credentialsId
                ));
            }
            const requiredInstanceTypes = compact(
                instanceTypes?.map(requiredInstanceType => requiredInstanceType.InstanceType)
            );

            return requiredInstanceTypes;
        } catch (err) {
            logger.error('Failed to get instance types from instance requirements', err);
        }
    }
}

async function getInstanceDetailsByPrivateIp(
    credentialsId: string,
    region: string,
    privateIps: string[],
    cacheParams?: AWSSDKCacheParams
) {
    logger.info('Get instance details by private ip', { credentialsId, region, privateIps });

    // Normalize for caching: sort and de-duplicate to ensure stable cache keys regardless of input order
    const normalizedIps = Array.from(new Set(privateIps)).sort((a, b) => a.localeCompare(b));

    const { Reservations } = await describeInstance(
        credentialsId,
        region,
        {
            Filters: [
                {
                    Name: 'private-ip-address',
                    Values: normalizedIps
                }
            ]
        },
        cacheParams
    );

    const instanceDetails: NodeDetails[] = [];
    const ec2InstanceList = compact(
        Array.isArray(Reservations) ? Reservations.flatMap(reservation => reservation.Instances) : []
    );
    ec2InstanceList.forEach(instance => {
        if (instance) {
            const { InstanceId, PrivateIpAddress, InstanceType, Tags, UsageOperation, PrivateDnsName } = instance;
            if (InstanceId && PrivateIpAddress && InstanceType) {
                instanceDetails.push({
                    ec2InstanceId: InstanceId,
                    ec2InstancePrivateIpAddress: PrivateIpAddress,
                    ec2InstanceType: InstanceType,
                    ec2InstanceName: getResourceNameFromTags(Tags),
                    ec2UsageOperation: UsageOperation,
                    ec2InstancePrivateDnsName: PrivateDnsName
                });
            }
        }
    });

    return instanceDetails;
}

async function waitForInstanceToBeStopped(credentialsId: string, region: string, instanceId: string) {
    logger.info('Waiting for instance to be stopped', { credentialsId, region, instanceId });

    const maxRetries = 10;
    const delay = '30s'; // 30 seconds wait ; total wait maxRetries * delay = 300s

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const { Reservations: [{ Instances: [{ State: { Name: instanceState = '' } = {} }] = [] } = {}] = [] } =
            // eslint-disable-next-line no-await-in-loop
            await describeInstance(credentialsId, region, { InstanceIds: [instanceId] });

        if (!instanceState) {
            throw new Error('Instance state not found');
        }

        if (instanceState === 'stopped') {
            return true;
        }
        if (instanceState === 'stopping') {
            // eslint-disable-next-line no-await-in-loop
            await sleep(ms(delay));
        }
    }

    throw new Error(`Instance ${instanceId} in ${region} did not stop within the expected time`);
}

async function instanceTypeChangePreReqs(
    credentialsId: string,
    region: string,
    accountId: string,
    instanceIds: string[]
) {
    logger.info('Checking instance type change prerequisites', { credentialsId, region, accountId, instanceIds });

    try {
        const { Reservations = [] } = await describeInstance(credentialsId, region, {
            InstanceIds: instanceIds
        });

        const instances = Reservations.map(reservation => reservation.Instances || []).flat();

        // elastic IP check
        try {
            const publicIpAddresses = compact(instances.map(({ PublicIpAddress }) => PublicIpAddress)) || [];
            if (!isEmpty(publicIpAddresses)) {
                return await describeAddresses(credentialsId, region, {
                    PublicIps: publicIpAddresses
                });
            }
        } catch (error: any) {
            logger.error('Error while checking elastic IP address', error);
            if (error?.Code && error.Code === 'InvalidAddress.NotFound') {
                throw createError(
                    500,
                    'Elastic IP address not found. On instance type change, Amazon EC2 releases the address and give your instance a new public IPv4 address'
                );
            }
            throw error;
        }

        // spot instance check
        const instanceLifecycles = compact(instances.map(({ InstanceLifecycle }) => InstanceLifecycle)) || [];
        if (!isEmpty(instanceLifecycles)) {
            instanceLifecycles.some(lifecycle => {
                if (lifecycle === 'spot') {
                    throw createError(500, 'Instance type of a Spot Instance cannot be changed');
                }
                return false;
            });
        }

        // more than 26 volumes to be attached to an instance
        const blockDeviceMappings = compact(instances.map(({ BlockDeviceMappings }) => BlockDeviceMappings)) || [];
        blockDeviceMappings.some(blockDeviceMapping => {
            if (blockDeviceMapping.length > 26) {
                throw createError(
                    500,
                    'The instance type change operation cannot be performed because the instance has more than 26 volumes attached'
                );
            }
            return false;
        });

        // autoscaling group check
        const { AutoScalingInstances: autoScalingInstances } = await describeAutoscalingInstances(
            credentialsId,
            region,
            accountId,
            {
                InstanceIds: instanceIds
            }
        );

        if (autoScalingInstances?.length) {
            throw createError(
                500,
                'Instances are part of an auto-scaling group. The Amazon EC2 Auto Scaling service marks the stopped instance as unhealthy, and might terminate it and launch a replacement instance'
            );
        }
    } catch (error: any) {
        logger.error('Error while checking instance type change prerequisites', error);
        throw error;
    }
}

async function getAmazonLinux2023AmiList(credentialsId: string, region: string): Promise<(string | undefined)[]> {
    logger.info('Get Amazon Linux 2023 AMI List', { credentialsId, region });

    const amis = await getAmis(
        credentialsId,
        region,
        {
            Owners: [AMI_OWNERS.AMAZON],
            Filters: [
                {
                    Name: 'name',
                    Values: ['al2023-ami-2023*-x86_64']
                }
            ]
        },
        { useCache: true }
    );

    const { Images: amisList } = amis || {};
    return (amisList || []).map(image => image.ImageId);
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
    validateVpcEndpoints,
    enableVpcDnsAttributes,
    isEbsAwsBackupEnabled,
    getInstanceTypesFromInstanceRequirementsForManagedInstances,
    getInstanceTypesFromInstanceRequirements,
    getInstanceDetailsByPrivateIp,
    determineBiggerInstance,
    determineSmallerInstance,
    waitForInstanceToBeStopped,
    instanceTypeChangePreReqs,
    getAmazonLinux2023AmiList
};
