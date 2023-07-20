import { EC2Client, DescribeVpcsCommand, DescribeSubnetsCommand, DescribeSecurityGroupsCommand, DescribeSubnetsRequest, DescribeVpcsRequest, DescribeSecurityGroupsRequest,
DescribeImagesCommand,
DescribeImagesCommandInput
} from '@aws-sdk/client-ec2';
import { getCredentialDetails } from '../cloud-manager/credentials';
import getLogger from '../../utils/logger';

const logger = getLogger();
async function getEC2(region: string, credentialsId: string) {
    logger.debug('Getting EC2 client:', region, credentialsId);

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken },
    } = await getCredentialDetails(credentialsId);
    let credentials = { accessKeyId, secretAccessKey, sessionToken };
    return new EC2Client({ credentials, region });
}

async function describeVpc(credentialsId: string, region: string, params: DescribeVpcsRequest) {
    logger.info('Describe VPC', { region, params });

    const ec2 = await getEC2(region, credentialsId);

    const resp = await ec2.send(new DescribeVpcsCommand(params));
    logger.info('descibeVpcs response:', resp);

    return resp;
}

async function describeSubnets(credentialsId: string, region: string, params: DescribeSubnetsRequest) {
    logger.info('Describe Subnets', { region, params });

    const ec2 = await getEC2(region, credentialsId);

    const resp = await ec2.send(new DescribeSubnetsCommand(params));
    logger.info('descibeSubnets response:', resp);

    return resp;
}

async function describeSecurityGroups(credentialsId: string, region: string, params: DescribeSecurityGroupsRequest) {
    logger.info('Describe Security Groups', { region, params });

    const ec2 = await getEC2(region, credentialsId);

    const resp = await ec2.send(new DescribeSecurityGroupsCommand(params));
    logger.info('descibeSecurityGroupss response:', resp);

    return resp;
}

async function getAmis(credentialsId: string, region: string, params: DescribeImagesCommandInput) {
    logger.info('Get AMIs', { region, params });

    const ec2 = await getEC2(region, credentialsId);

    const resp = await ec2.send(new DescribeImagesCommand(params));
    logger.debug('descibeSecurityGroupss response:', resp);

    return resp;
}

export { getEC2, describeVpc, describeSubnets, describeSecurityGroups, getAmis };
