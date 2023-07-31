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
    DescribeInstanceTypesCommand
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

async function describeInstanceTypes(credentialsId: string, region: string) {
    const ec2 = await getEC2Client(region, credentialsId);
    const token: string | undefined = undefined;
    const allMappedData: any[] = [];
    const options: any = {};
    await listInstances(ec2, options, token, allMappedData);
    return allMappedData;
}

async function listInstances(ec2: EC2Client, options: any, token: undefined, allMappedData: any[]): Promise<any> {
    if (token) {
        options.NextToken = token;
    }
    const instanceTypes: any = await ec2.send(new DescribeInstanceTypesCommand(options));
    const temp = instanceTypes.InstanceTypes;
    allMappedData.push(...temp);
    if (instanceTypes.NextToken) {
        return listInstances(ec2, options, instanceTypes.NextToken, allMappedData);
    }
}
export {
    getEC2Client,
    describeVpc,
    describeSubnets,
    describeSecurityGroups,
    getAmis,
    describeRegions,
    describeInstanceTypes
};
