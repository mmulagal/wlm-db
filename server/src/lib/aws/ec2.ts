import {
    EC2Client,
    DescribeSubnetsCommand,
    DescribeSecurityGroupsCommand,
    DescribeSubnetsRequest,
    DescribeVpcsCommand,
    DescribeVpcsRequest,
    DescribeSecurityGroupsRequest,
    DescribeRegionsCommand,
    DescribeRegionsCommandInput,
    DescribeRegionsCommandOutput
} from '@aws-sdk/client-ec2';
import { getCredentialDetails } from '../cloud-manager/credentials';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getEC2Client(region: string, credentialsId: string) {
    logger.debug('Getting EC2 client:', region, credentialsId);

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken },
    } = await getCredentialDetails(credentialsId);
    let credentials = { accessKeyId, secretAccessKey, sessionToken };
    return new EC2Client({ credentials, region });
}

async function describeVpc(credentialsId: string, region: string, params: DescribeVpcsRequest) {
    logger.info('Describe VPC', { region, params });

    const ec2 = await getEC2Client(region, credentialsId);

    const resp = await ec2.send(new DescribeVpcsCommand(params));
    logger.info('descibeVpcs response:', resp);

    return resp;
}

async function describeSubnets(credentialsId: string, region: string, params: DescribeSubnetsRequest) {
    logger.info('Describe Subnets', { region, params });

    const ec2 = await getEC2Client(region, credentialsId);

    const resp = await ec2.send(new DescribeSubnetsCommand(params));
    logger.info('descibeSubnets response:', resp);

    return resp;
}

async function describeSecurityGroups(credentialsId: string, region: string, params: DescribeSecurityGroupsRequest) {
    logger.info('Describe Security Groups', { region, params });

    const ec2 = await getEC2Client(region, credentialsId);

    const resp = await ec2.send(new DescribeSecurityGroupsCommand(params));
    logger.info('descibeSecurityGroupss response:', resp);

    return resp;
}

async function describeRegions(
    credentialsId: string,
    region: string,
    input: DescribeRegionsCommandInput
): Promise<DescribeRegionsCommandOutput> {
    logger.info('Describe AWS regions:', Array.from(arguments));

    let response: DescribeRegionsCommandOutput;

    try {
        const client = await getEC2Client(region, credentialsId);
        response = await client.send(new DescribeRegionsCommand(input));

        logger.debug('Describe AWS regions response:', response);
    } catch (e: any) {
        logger.error('Failed to get AWS regions. Reason:', e.message);
        throw e;
    }

    return response;
}

export {
    getEC2Client,
    describeVpc,
    describeSubnets,
    describeSecurityGroups,
    describeRegions
};
