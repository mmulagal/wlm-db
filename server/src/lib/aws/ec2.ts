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
    DescribeNetworkInterfacesCommand
} from '@aws-sdk/client-ec2';
import { getCredentialDetails } from '../cloud-manager/credentials';
import getLogger from '../../utils/logger';
import { DEFAULT_AWS_REGION } from '../../utils/consts';

const logger = getLogger();
async function getEC2Client(region: string, credentialsId?: string) {
    logger.debug('Getting EC2 client:', region, credentialsId);
    if (!credentialsId) {
        return new EC2Client({ region });
    }
    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialDetails(credentialsId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };

    return new EC2Client({ credentials, region });
}

async function describeVpc(credentialsId: string, region: string, params: DescribeVpcsRequest) {
    logger.info('Describe VPC', { region, params });

    const ec2 = await getEC2Client(region, credentialsId);

    const resp = await ec2.send(new DescribeVpcsCommand(params));
    logger.debug('descibeVpcs response:', resp);

    return resp;
}

async function describeSubnets(credentialsId: string, region: string, params: DescribeSubnetsRequest) {
    logger.info('Describe Subnets', { region, params });

    const ec2 = await getEC2Client(region, credentialsId);

    const resp = await ec2.send(new DescribeSubnetsCommand(params));
    logger.debug('descibeSubnets response:', resp);

    return resp;
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
    params: DescribeImagesCommandInput
): Promise<DescribeImagesCommandOutput> {
    logger.info('Get AMIs', { credentialsId, region, params });

    const ec2 = await getEC2Client(region, credentialsId);

    const resp = await ec2.send(new DescribeImagesCommand(params));
    logger.debug('descibeSecurityGroupss response:', resp);

    return resp;
}

async function describeRegions(
    input: DescribeRegionsCommandInput,
    credentialsId?: string
): Promise<DescribeRegionsCommandOutput> {
    logger.info('Describe AWS regions:', { credentialsId, input });

    const client = await getEC2Client(DEFAULT_AWS_REGION, credentialsId);
    const response = await client.send(new DescribeRegionsCommand(input));
    logger.debug('Describe AWS regions response:', response);

    return response;
}

async function describeInstanceTypes(credentialsId: string, region: string) {
    logger.info('Describe AWS instance types:', { credentialsId, region });

    const client = await getEC2Client(region, credentialsId);
    const paginator = paginateDescribeInstanceTypes(
        { client, pageSize: 50 },
        {
            Filters: [{ Name: 'instance-type', Values: ['*'] }]
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

export {
    getEC2Client,
    describeVpc,
    describeSubnets,
    describeSecurityGroups,
    getAmis,
    describeRegions,
    describeInstanceTypes,
    describeRouteTable,
    describeKeyPairs,
    describeNetworkInterfaces
};
