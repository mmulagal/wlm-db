import config from 'config';
import { createStack } from '../lib/aws/cloud-formation';
import { getMissingPermissionsList } from '../lib/aws/iam';
import { getPreSignedUrl } from '../lib/aws/s3';
import {
    CFNetworkConfigurationType,
    EC2ConfigurationType,
    ADConfigurationType,
    FSXConfigurationType,
    SQLConfigurationType
} from '../routes/types/deployment.types';
import { CLOUD_FORMATION_STACK_URL, MISSING_PERMISSIONS, CF_QUOTA_REACHED } from '../utils/consts';
import { formatTemplateParameters, generateFsxParams, isCfStackQuotaReached } from '../utils/utils';
import getLogger from '../utils/logger';

const logger = getLogger();
const master_template_url = config.get<string>('template-urls.master-template');

async function createCloudFormationTemplateForUserDeployment(
    credentialsId: string,
    region: string,
    networkConfiguration: CFNetworkConfigurationType,
    ec2Configuration: EC2ConfigurationType,
    adConfiguration: ADConfigurationType,
    fsxConfiguration: FSXConfigurationType,
    sqlConfiguration: SQLConfigurationType
): Promise<{ cloudFormationUrl: string }> {
    logger.info('Create cloud formation template for user deployment', {
        credentialsId,
        region,
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

async function deploySqlTemplate(
    credentialsId: string,
    region: string,
    networkConfiguration: CFNetworkConfigurationType,
    ec2Configuration: EC2ConfigurationType,
    adConfiguration: ADConfigurationType,
    fsxConfiguration: FSXConfigurationType,
    sqlConfiguration: SQLConfigurationType
): Promise<{ cloudFormationStackId: string }> {
    logger.info('Deploy sql cloud formation template ', {
        credentialsId,
        region,
        networkConfiguration,
        ec2Configuration,
        adConfiguration,
        fsxConfiguration,
        sqlConfiguration
    });

    const { permissions } = await getMissingPermissionsList(credentialsId, region);
    if (permissions?.length) {
        throw {
            statusCode: 409,
            message: MISSING_PERMISSIONS(permissions)
        };
    }

    const cfStackQuotaReached = await isCfStackQuotaReached(credentialsId, region);
    if (cfStackQuotaReached) {
        throw {
            statusCode: 409,
            message: CF_QUOTA_REACHED
        };
    }

    const details = await formatTemplateParameters(
        credentialsId,
        region,
        networkConfiguration,
        ec2Configuration,
        adConfiguration,
        fsxConfiguration,
        sqlConfiguration
    );

    logger.debug(`Stack ${details.stackName} parameters ${JSON.stringify(details.templateParameters)}.`);

    const deployStackResponse = await createStack(
        credentialsId,
        region,
        details.stackName,
        master_template_url,
        details.templateParameters
    );

    logger.info(`Stack ${details.stackName} response ${deployStackResponse}`);
    return { cloudFormationStackId: deployStackResponse.StackId! };
}

export { createCloudFormationTemplateForUserDeployment, deploySqlTemplate };
