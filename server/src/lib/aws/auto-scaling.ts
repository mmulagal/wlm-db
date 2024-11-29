import {
    AutoScalingClient,
    DescribeAutoScalingInstancesCommand,
    DescribeAutoScalingInstancesCommandInput
} from '@aws-sdk/client-auto-scaling';
import getLogger from '../../utils/logger';
import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';

const logger = getLogger();

async function getAutoScalingClient(region: string, credentialsId: string, accountId: string) {
    logger.debug('Getting auto scaling client:', region, credentialsId);

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialsDetails(credentialsId, accountId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };
    return new AutoScalingClient({ credentials, region });
}

export default async function describeAutoscalingInstances(
    credentialsId: string,
    region: string,
    accountId: string,
    params: DescribeAutoScalingInstancesCommandInput
) {
    logger.info('Describing auto scaling instances:', region, credentialsId, accountId, params);

    const client = await getAutoScalingClient(region, credentialsId, accountId);
    const response = await client.send(new DescribeAutoScalingInstancesCommand(params));
    logger.debug('Auto scaling instances:', response);
    return response;
}
