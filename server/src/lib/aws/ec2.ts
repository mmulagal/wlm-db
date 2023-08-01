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
    DescribeRouteTablesCommand,
    DescribeRouteTablesCommandInput
} from '@aws-sdk/client-ec2';
import { getCredentialDetails } from '../cloud-manager/credentials';
import getLogger from '../../utils/logger';
import { DEFAULT_AWS_REGION } from '../../utils/consts';

const logger = getLogger();
async function getEC2Client(region: string, credentialsId: string) {
    logger.debug('Getting EC2 client:', region, credentialsId);

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

async function getAmis(credentialsId: string, region: string, params: DescribeImagesCommandInput) {
    logger.info('Get AMIs', { credentialsId, region, params });

    const ec2 = await getEC2Client(region, credentialsId);

    const resp = await ec2.send(new DescribeImagesCommand(params));
    logger.debug('descibeSecurityGroupss response:', resp);

    return resp;
}

async function describeRegions(
    credentialsId: string,
    input: DescribeRegionsCommandInput
): Promise<DescribeRegionsCommandOutput> {
    // eslint-disable-next-line
    logger.info('Describe AWS regions:', Array.from(arguments));

    const client = await getEC2Client(DEFAULT_AWS_REGION, credentialsId);
    const response = await client.send(new DescribeRegionsCommand(input));

    logger.debug('Describe AWS regions response:', response);

    return response;
}

async function describeRouteTable(credentialsId: string, region: string, params: DescribeRouteTablesCommandInput) {
    logger.info('Describe route table:', { region, params });

    const ec2 = await getEC2Client(region, credentialsId);

    const resp = await ec2.send(new DescribeRouteTablesCommand(params));
    logger.debug('describe route table response:', resp);

    return resp;
}

export {
    getEC2Client,
    describeVpc,
    describeSubnets,
    describeSecurityGroups,
    getAmis,
    describeRegions,
    describeRouteTable
};
