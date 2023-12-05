import { tagResource } from '../../lib/aws/tags';
import { getEc2Arn, getFsxArn } from '../../utils/utils';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function tagFsxResource(
    credentialsId: string,
    region: string,
    awsAccountId: string,
    fsxId: string,
    tags: Record<string, string>
) {
    logger.info('Adding tag to Fsx resource', credentialsId, region, awsAccountId, fsxId);
    const fsxArn = getFsxArn(awsAccountId, region, fsxId);
    tagResource(credentialsId, region, fsxArn, tags);
}

async function tagEc2Resource(
    credentialsId: string,
    region: string,
    awsAccountId: string,
    ec2Id: string,
    tags: Record<string, string>
) {
    logger.info('Adding tag to EC2 resource', credentialsId, region, awsAccountId, ec2Id);
    const ec2Arn = getEc2Arn(awsAccountId, region, ec2Id);
    tagResource(credentialsId, region, ec2Arn, tags);
}

export { tagEc2Resource, tagFsxResource };
