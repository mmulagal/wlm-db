import config from 'config';
import {
    EC2Client,
    DescribeVpcsCommand,
    DescribeSubnetsCommand,
    DescribeSecurityGroupsCommand,
    DescribeSubnetsRequest,
    DescribeVpcsRequest,
    DescribeSecurityGroupsRequest,
    DescribeImagesCommand,
    DescribeImagesCommandInput,
    DescribeRegionsCommand,
    DescribeRegionsCommandInput,
    DescribeRegionsCommandOutput,
    paginateDescribeInstanceTypes,
    DescribeRouteTablesCommand,
    DescribeRouteTablesCommandInput,
    DescribeKeyPairsCommand,
    DescribeKeyPairsCommandOutput,
    DescribeRouteTablesCommandOutput,
    DescribeImagesCommandOutput,
    DescribeNetworkInterfacesCommandInput,
    DescribeNetworkInterfacesCommandOutput,
    DescribeNetworkInterfacesCommand,
    DescribeInstancesCommand,
    DescribeInstancesCommandInput,
    CreateTagsCommand,
    CreateTagsCommandOutput,
    Tag,
    DescribeInstancesCommandOutput,
    DescribeTagsCommandInput,
    DescribeTagsCommand,
    DescribeVpcEndpointsCommandInput,
    DescribeVpcEndpointsCommand,
    paginateDescribeVpcs,
    paginateDescribeSubnets,
    ModifyVpcAttributeCommandInput,
    ModifyVpcAttributeCommand,
    DescribeInstanceTypeOfferingsCommandInput,
    DescribeInstanceTypeOfferingsCommand,
    DescribeVolumesCommandInput,
    DescribeVolumesCommand,
    DescribeSnapshotsCommandInput,
    DescribeSnapshotsCommand,
    DescribeInstanceTypesCommand,
    _InstanceType,
    GetInstanceTypesFromInstanceRequirementsCommandInput,
    GetInstanceTypesFromInstanceRequirementsCommand,
    paginateDescribeVolumes,
    Volume,
    StopInstancesCommand,
    ModifyInstanceAttributeCommand,
    StartInstancesCommand,
    waitUntilInstanceStatusOk,
    DescribeInstanceStatusCommandInput,
    DescribeAddressesCommand,
    DescribeAddressesCommandInput,
    paginateDescribeInstances,
    Reservation
} from '@aws-sdk/client-ec2';
import { PaginationConfiguration } from '@aws-sdk/types';
import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import getLogger from '../../utils/logger';
import {
    DEFAULT_AWS_REGION,
    DEFAULT_GOV_REGION,
    GOV_ACCOUNT,
    EC2_INSTANCE_FAMILY_PREFIXES,
    EC2_ALLOWED_MEMORY_MIB
} from '../../utils/consts';
import { getAsyncLocalStorageResource } from '../../utils/async-local-storage';
import addCacheMiddleware from '../../utils/aws-sdk-middlewares';
import { AWSSDKCacheParams } from '../../utils/common-types';

const logger = getLogger();

async function getEC2Client(
    region: string,
    credentialsId?: string,
    accountId?: string,
    cacheParams: AWSSDKCacheParams = {}
): Promise<EC2Client> {
    logger.debug('Getting EC2 client:', region, credentialsId);

    let client: EC2Client;
    if (!credentialsId) {
        client = new EC2Client({ region });
    } else {
        const {
            credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
        } = await getCredentialsDetails(credentialsId, accountId);
        const credentials = { accessKeyId, secretAccessKey, sessionToken };
        client = new EC2Client({ credentials, region });
    }

    return addCacheMiddleware(client, { ...cacheParams, credentialsId });
}

async function describeVpc(credentialsId: string, region: string, params: DescribeVpcsRequest) {
    logger.info('Describe VPC', { region, params });

    const ec2 = await getEC2Client(region, credentialsId);

    const resp = await ec2.send(new DescribeVpcsCommand(params));
    logger.debug('descibeVpcs response:', resp);

    return resp;
}

async function paginatedDescribeVpcs(
    credentialsId: string,
    region: string,
    params: DescribeVpcsRequest,
    cacheParams?: AWSSDKCacheParams
) {
    logger.info('Describe VPC', { region, params });

    const ec2 = await getEC2Client(region, credentialsId, undefined, cacheParams);

    const vpcList = [];
    for await (const { Vpcs } of paginateDescribeVpcs({ client: ec2 }, params)) {
        if (Vpcs?.length) {
            vpcList.push(...Vpcs);
        }
    }

    return vpcList;
}

async function describeSubnets(credentialsId: string, region: string, params: DescribeSubnetsRequest) {
    logger.info('Describe Subnets', { region, params });

    const ec2 = await getEC2Client(region, credentialsId);

    const resp = await ec2.send(new DescribeSubnetsCommand(params));
    logger.debug('descibeSubnets response:', resp);

    return resp;
}

async function paginatedDescribeSubnets(
    credentialsId: string,
    region: string,
    params: DescribeVpcsRequest,
    cacheParams?: AWSSDKCacheParams
) {
    logger.info('Describe VPC', { region, params });

    const ec2 = await getEC2Client(region, credentialsId, undefined, cacheParams);

    const subnetList = [];
    for await (const { Subnets } of paginateDescribeSubnets({ client: ec2 }, params)) {
        if (Subnets?.length) {
            subnetList.push(...Subnets);
        }
    }

    return subnetList;
}

async function describeSecurityGroups(credentialsId: string, region: string, params: DescribeSecurityGroupsRequest) {
    logger.info('Describe Security Groups', { region, params });

    const ec2 = await getEC2Client(region, credentialsId);

    const resp = await ec2.send(new DescribeSecurityGroupsCommand(params));
    logger.debug('descibeSecurityGroupss response:', resp);

    return resp;
}

async function getAmis(
    credentialsId: string,
    region: string,
    params: DescribeImagesCommandInput,
    cacheParams?: AWSSDKCacheParams
): Promise<DescribeImagesCommandOutput> {
    logger.info('Get AMIs', { credentialsId, region, params });

    const ec2 = await getEC2Client(region, credentialsId, undefined, cacheParams);

    const resp = await ec2.send(new DescribeImagesCommand(params));
    logger.debug('DescribeImagesCommand response:', resp);

    return resp;
}

async function describeInstance(
    credentialsId: string,
    region: string,
    params: DescribeInstancesCommandInput,
    cacheParams?: AWSSDKCacheParams
): Promise<DescribeInstancesCommandOutput> {
    logger.info('Describe EC2 instance', { credentialsId, region, params });

    const client = await getEC2Client(region, credentialsId, undefined, cacheParams);
    const response = await client.send(new DescribeInstancesCommand(params));
    logger.debug('Describe instance response:', response);

    return response;
}

async function describeRegions(
    input: DescribeRegionsCommandInput,
    credentialsId?: string,
    cacheParams?: AWSSDKCacheParams
): Promise<DescribeRegionsCommandOutput> {
    const isGovAccount = getAsyncLocalStorageResource<boolean>(GOV_ACCOUNT);
    const region = isGovAccount ? DEFAULT_GOV_REGION : DEFAULT_AWS_REGION;
    logger.info('Describe AWS regions:', { credentialsId, input, isGovAccount, region });

    const client = await getEC2Client(region, credentialsId, undefined, cacheParams);
    const response = await client.send(new DescribeRegionsCommand(input));
    logger.debug('Describe AWS regions response:', response);

    return response;
}

async function describeInstanceTypes(region: string, credentialsId?: string) {
    logger.info('Describe AWS instance types:', { region, credentialsId });

    const client = await getEC2Client(region, credentialsId);

    const vcpuFilter = config.get('ec2.vcpu-filter') as Array<string>;

    const paginator = paginateDescribeInstanceTypes(
        { client, pageSize: 100 },
        {
            Filters: [
                { Name: 'processor-info.supported-architecture', Values: ['x86_64'] },
                { Name: 'supported-usage-class', Values: ['on-demand'] },
                { Name: 'supported-virtualization-type', Values: ['hvm'] },
                { Name: 'vcpu-info.default-vcpus', Values: vcpuFilter },
                {
                    Name: 'memory-info.size-in-mib',
                    Values: EC2_ALLOWED_MEMORY_MIB.map(String)
                },
                {
                    Name: 'instance-type',
                    Values: EC2_INSTANCE_FAMILY_PREFIXES.map(prefix => `${prefix}*`)
                }
            ]
        }
    );
    const instanceTypes = [];

    for await (const page of paginator) {
        if (page.InstanceTypes?.length) {
            instanceTypes.push(...page.InstanceTypes);
        }
    }

    return instanceTypes;
}

async function describeInstanceType(region: string, instanceTypes: _InstanceType[]) {
    logger.info('Describe AWS instance type:', { region, instanceTypes });

    const client = await getEC2Client(region);

    const response = await client.send(
        new DescribeInstanceTypesCommand({
            InstanceTypes: instanceTypes
        })
    );

    return response;
}
async function describeRouteTable(
    credentialsId: string,
    region: string,
    params: DescribeRouteTablesCommandInput
): Promise<DescribeRouteTablesCommandOutput> {
    logger.info('Describe route table:', { region, params });

    const ec2 = await getEC2Client(region, credentialsId);

    const resp = await ec2.send(new DescribeRouteTablesCommand(params));
    logger.debug('describe route table response:', resp);

    return resp;
}

async function describeKeyPairs(
    credentialsId: string,
    region: string,
    input: DescribeRegionsCommandInput
): Promise<DescribeKeyPairsCommandOutput> {
    logger.info('Describe key-pair:', { credentialsId, region, input });

    const client = await getEC2Client(region, credentialsId);
    const response = await client.send(new DescribeKeyPairsCommand(input));
    logger.debug('Describe key-pairs response:', response);

    return response;
}

async function describeNetworkInterfaces(
    credentialsId: string,
    region: string,
    input: DescribeNetworkInterfacesCommandInput
): Promise<DescribeNetworkInterfacesCommandOutput> {
    logger.info('Describe network interfaces:', { credentialsId, region, input });

    const client = await getEC2Client(region, credentialsId);
    const response = await client.send(new DescribeNetworkInterfacesCommand(input));
    logger.debug('Describe network interfaces:', response);

    return response;
}

async function createTag(credentialsId: string, region: string, accountId: string, resourceId: string[], tags: Tag[]) {
    logger.info('Adding tags to resource', credentialsId, region, accountId, resourceId, tags);
    try {
        const client = await getEC2Client(region, credentialsId, accountId);
        const ec2Params = {
            Resources: resourceId,
            Tags: tags
        };

        const command = new CreateTagsCommand(ec2Params);
        const response: CreateTagsCommandOutput = await client.send(command);
        logger.info('Resource tagged successfully:', response);
    } catch (error) {
        logger.error('Error tagging resource:', error);
    }
}

async function describeTags(credentialsId: string, region: string, input: DescribeTagsCommandInput) {
    logger.info('Describe Tags command ', credentialsId, region, input);

    try {
        const client = await getEC2Client(region, credentialsId);
        const command = new DescribeTagsCommand(input);
        const response = await client.send(command);
        return response;
    } catch (error) {
        logger.error('Describe Tags command failed with the error', error);
    }
}

async function describeEndpoints(credentialsId: string, region: string, input: DescribeVpcEndpointsCommandInput) {
    logger.info('Describe vpc endpoints command ', credentialsId, region, input);

    try {
        const client = await getEC2Client(region, credentialsId);
        const command = new DescribeVpcEndpointsCommand(input);
        const response = await client.send(command);

        return response;
    } catch (error) {
        logger.error('Describe vpc endpoints command failed with the error', error);
    }
}

async function modifyVpcAttributes(credentialsId: string, region: string, input: ModifyVpcAttributeCommandInput) {
    logger.info('Modify vpc attibutes ', credentialsId, region, input);

    const client = await getEC2Client(region, credentialsId);
    const command = new ModifyVpcAttributeCommand(input);
    const response = await client.send(command);

    logger.debug('Modify vpc attibutes response', response);

    return response;
}

async function describeInstanceTypeOfferings(
    credentialsId: string,
    region: string,
    input: DescribeInstanceTypeOfferingsCommandInput
) {
    logger.info('Describe instance type offerings command ', credentialsId, region, input);

    const client = await getEC2Client(region, credentialsId);
    const command = new DescribeInstanceTypeOfferingsCommand(input);
    const response = await client.send(command);

    logger.debug('Describe instance type offerings response ', response);

    return response;
}

async function describeVolumes(
    credentialsId: string,
    region: string,
    params: DescribeVolumesCommandInput,
    cacheParams?: AWSSDKCacheParams
) {
    logger.info('Describe volumes', { region, params });

    const ec2 = await getEC2Client(region, credentialsId, undefined, cacheParams);

    const resp = await ec2.send(new DescribeVolumesCommand(params));
    logger.debug('descibeVolumes response:', resp);

    return resp;
}

async function describeSnapshots(
    credentialsId: string,
    region: string,
    params: DescribeSnapshotsCommandInput,
    cacheParams?: AWSSDKCacheParams
) {
    logger.info('Describe snapshots', { region, params });

    const ec2 = await getEC2Client(region, credentialsId, undefined, cacheParams);

    const resp = await ec2.send(new DescribeSnapshotsCommand(params));
    logger.debug('descibeSnapshots response:', resp);

    return resp;
}

async function getInstanceTypesFromInstanceRequirementsCommand(
    region: string,
    params: GetInstanceTypesFromInstanceRequirementsCommandInput,
    credentialsId?: string
) {
    logger.info('Get instance types from instance requirements', { region, params });

    const ec2 = await getEC2Client(region, credentialsId);

    const resp = await ec2.send(new GetInstanceTypesFromInstanceRequirementsCommand(params));
    logger.debug('getInstanceTypesFromInstanceRequirementsCommand response:', resp);

    return resp;
}

async function paginateDescribeEbsVolumes(
    credentialsId: string,
    region: string,
    params: DescribeVolumesCommandInput,
    accountId?: string,
    cacheParams?: AWSSDKCacheParams
): Promise<Volume[]> {
    logger.info('Paginate describe EBS volumes', { region, credentialsId, params, accountId });

    const ec2 = await getEC2Client(region, credentialsId, accountId, cacheParams);

    const volumeList = [];
    for await (const { Volumes } of paginateDescribeVolumes({ client: ec2 }, params)) {
        if (Volumes?.length) {
            volumeList.push(...Volumes);
        }
    }

    return volumeList;
}

async function stopInstance(credentialsId: string, region: string, instanceId: string) {
    logger.info('Stop instance', { credentialsId, region, instanceId });

    const ec2 = await getEC2Client(region, credentialsId);

    const resp = await ec2.send(
        new StopInstancesCommand({
            InstanceIds: [instanceId]
        })
    );
    logger.debug('Stop instance response:', resp);

    return resp;
}

async function modifyInstanceType(credentialsId: string, region: string, instanceId: string, instanceType: string) {
    logger.info('Change instance type', { credentialsId, region, instanceId, instanceType });

    const ec2 = await getEC2Client(region, credentialsId);

    const resp = await ec2.send(
        new ModifyInstanceAttributeCommand({
            InstanceId: instanceId,
            InstanceType: {
                Value: instanceType
            }
        })
    );
    logger.debug('Change instance type response:', resp);

    return resp;
}

async function startInstance(credentialsId: string, region: string, instanceId: string) {
    logger.info('Start instance', { credentialsId, region, instanceId });

    const ec2 = await getEC2Client(region, credentialsId);

    const resp = await ec2.send(
        new StartInstancesCommand({
            InstanceIds: [instanceId]
        })
    );
    logger.debug('Start instance response:', resp);

    return resp;
}

async function waitForInstanceOk(credentialsId: string, region: string, instanceId: string) {
    logger.info('Wait for instance status to be OK', { credentialsId, region, instanceId });

    const params: DescribeInstanceStatusCommandInput = {
        InstanceIds: [instanceId]
    };
    const ec2 = await getEC2Client(region, credentialsId);

    // Wait until the instance status is OK
    const response = await waitUntilInstanceStatusOk(
        { client: ec2, maxWaitTime: 300 }, // maxWaitTime is in seconds
        params
    );
    logger.debug('Wait for instance status to be OK response:', response);

    return response;
}

async function describeAddresses(credentialsId: string, region: string, params: DescribeAddressesCommandInput) {
    logger.info('Describe addresses', { credentialsId, region, params });

    const ec2 = await getEC2Client(region, credentialsId);

    const response = await ec2.send(new DescribeAddressesCommand(params)); // throws error if any of the public IP is not elastic IP
    logger.debug('Describe addresses response:', response);

    return response;
}

async function describeInstancesWithPagination(
    credentialsId: string,
    region: string,
    params: DescribeInstancesCommandInput,
    pageSize = 10,
    nextToken?: string,
    cacheParams?: AWSSDKCacheParams
) {
    logger.info('Paginate describe instances', { region, params });

    const ec2 = await getEC2Client(region, credentialsId, undefined, cacheParams);
    const paginatorConfig: PaginationConfiguration = {
        client: ec2,
        pageSize,
        ...(nextToken && { startingToken: nextToken })
    };
    const reservations: Reservation[] = [];
    let newToken;
    for await (const { Reservations, NextToken } of paginateDescribeInstances(paginatorConfig, params)) {
        newToken = NextToken;
        if (Reservations?.length) {
            reservations.push(...Reservations);
            if (reservations.length >= pageSize) {
                return [reservations, newToken];
            }
        }
    }
    return [reservations, newToken];
}

const waitForInstanceOkWrapper = { waitForInstanceOk };

export {
    getEC2Client,
    describeVpc,
    describeSubnets,
    describeSecurityGroups,
    getAmis,
    describeInstance,
    describeRegions,
    describeInstanceTypes,
    describeInstanceType,
    describeRouteTable,
    describeKeyPairs,
    describeNetworkInterfaces,
    createTag,
    describeTags,
    describeEndpoints,
    paginatedDescribeVpcs,
    paginatedDescribeSubnets,
    describeVolumes,
    modifyVpcAttributes,
    describeInstanceTypeOfferings,
    describeSnapshots,
    getInstanceTypesFromInstanceRequirementsCommand,
    paginateDescribeEbsVolumes,
    stopInstance,
    startInstance,
    modifyInstanceType,
    waitForInstanceOk,
    describeAddresses,
    describeInstancesWithPagination,
    waitForInstanceOkWrapper
};
