import { listStacks } from '../../lib/aws/cloud-formation';
import { getMissingPermissionsList } from '../../lib/aws/iam';
import { getPreSignedUrl } from '../../lib/aws/s3';
import getLogger from '../../utils/logger';
import { generateFsxParams } from '../../utils/utils';
import {
    CFNetworkConfigurationType,
    EC2ConfigurationType,
    ADConfigurationType,
    FSXConfigurationType,
    SQLConfigurationType
} from '../../routes/types/deployment.types';
import { CLOUD_FORMATION_STACK_URL } from '../../utils/consts';
const logger = getLogger();

async function currentCfStacksCount(credentialsId: string, region: string) {
    logger.info('Fetching cloudformation stacks in region ', region);

    const currentStacksCount = (await listStacks(credentialsId, region)).StackSummaries?.length;
    logger.debug('Completed stacks count ', currentStacksCount);

    return { currentStacksCount: currentStacksCount };
}

async function createCloudFormationTemplateForUserDeployment(
    credentialsId: string,
    region: string,
    vpcId: string,
    networkConfiguration: CFNetworkConfigurationType,
    ec2Configuration: EC2ConfigurationType,
    adConfiguration: ADConfigurationType,
    fsxConfiguration: FSXConfigurationType,
    sqlConfiguration: SQLConfigurationType
): Promise<{ cloudFormationUrl: string }> {
    logger.info('Create cloud formation template for user deployment', {
        credentialsId,
        region,
        vpcId,
        networkConfiguration,
        ec2Configuration,
        adConfiguration,
        fsxConfiguration,
        sqlConfiguration
    });

    const { permissions } = await getMissingPermissionsList(credentialsId, region);
    // logger.info('permissions', permissions);
    if (permissions?.length) {
        logger.error('Required permissions are not available to create the cloud formation template');
    }
    const data = await generateFsxParams(fsxConfiguration.databaseSize);
    const signedURL = await getPreSignedUrl(credentialsId, region);

    let params: string = `stackName=${data.StackName}`;
    Object.entries(data).forEach(([key, value]) => {
        if (key !== 'StackName') {
            params += `&param_${key}=${value}`;
        }
    });
    // logger.info(params);
    const signedTemplateURL = `${CLOUD_FORMATION_STACK_URL}?region=${region}#/stacks/create/review?templateURL=${signedURL}${params}`;
    return { cloudFormationUrl: signedTemplateURL };
}

export { currentCfStacksCount, createCloudFormationTemplateForUserDeployment };
