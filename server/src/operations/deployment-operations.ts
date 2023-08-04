import config from 'config';
import { createStack } from '../lib/aws/cloud-formation';
import getMissingPermissionsList from './aws/iam-operations';
import { getPreSignedUrl } from '../lib/aws/s3';
import { createSecrets } from './aws/secrets-manager-operations';
import {
    CFNetworkConfigurationType,
    EC2ConfigurationType,
    ADConfigurationType,
    FSXConfigurationType,
    SQLConfigurationType
} from '../routes/types/deployment.types';
import {
    CLOUD_FORMATION_STACK_URL,
    MISSING_PERMISSIONS,
    CF_QUOTA_REACHED,
    TEMPLATE_CONFIGURATION_MAPPING
} from '../utils/consts';
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

    if (permissions?.length) {
        logger.error('Required permissions are not available to create the cloud formation template');
    }
    const derivedParams = await generateFsxParams(fsxConfiguration.databaseSize);

    await createSecrets(credentialsId, region, [
        {
            secretName: derivedParams.DomainAdminSecretName,
            username: adConfiguration.domainUsername,
            password: adConfiguration.domainPassword
        },
        {
            secretName: derivedParams.FSxAdministratorPasswordSecret,
            username: fsxConfiguration.fsxUsername,
            password: fsxConfiguration.fsxPassword
        },
        {
            secretName: derivedParams.SQLServiceAccountSecret,
            username: sqlConfiguration.serviceAccountName,
            password: sqlConfiguration.serviceAccountPassword
        }
    ]);

    const signedURL = await getPreSignedUrl(credentialsId, region);

    let templateParams: string = `stackName=${derivedParams.StackName}`;
    Object.entries(derivedParams).forEach(([key, value]) => {
        if (key !== 'StackName') {
            templateParams += `&param_${key}=${value}`;
        }
    });

    const clubbedParamList = {
        ...networkConfiguration,
        ...adConfiguration,
        ...networkConfiguration,
        ...sqlConfiguration,
        ...ec2Configuration
    };

    Object.entries(clubbedParamList).forEach(([key, value]) => {
        templateParams += `&param_${TEMPLATE_CONFIGURATION_MAPPING[key]}=${value}`;
    });
    logger.info(templateParams);
    const signedTemplateURL = `${CLOUD_FORMATION_STACK_URL}?region=${region}#/stacks/create/review?templateURL=${signedURL}&${templateParams}`;
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
