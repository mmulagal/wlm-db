import { createStack } from '../lib/aws/cloud-formation';
import getMissingPermissionsList from './aws/iam-operations';
import { getPreSignedUrl } from '../lib/aws/s3';
import { createSecrets } from './aws/secrets-manager-operations';
import {
    CFNetworkConfigurationType,
    EC2ConfigurationType,
    ADConfigurationType,
    FSXConfigurationType,
    SQLConfigurationType,
    CloudFormationTemplateResponseType
} from '../routes/types/deployment.types';
import {
    CLOUD_FORMATION_STACK_URL,
    MISSING_PERMISSIONS,
    CF_QUOTA_REACHED,
    TEMPLATE_CONFIGURATION_MAPPING,
    MASTER_TEMPLATE_URL,
    DISABLE_ROLLBACK,
    MASTER_STACK_TIMEOUT_MINUTES,
    HttpErrorCodes,
    WLM_ASSETS
} from '../utils/consts';
import {
    formatTemplateParameters,
    generateFsxParams,
    isCfStackQuotaReached,
    saveFSxAndSqlServerDetailsInTenancy
} from '../utils/utils';
import getLogger from '../utils/logger';
import { getRoleName } from './cloud-manager/credentials-operations';

const logger = getLogger();

async function createCloudFormationTemplateForUserDeployment(
    credentialsId: string,
    region: string,
    networkConfiguration: CFNetworkConfigurationType,
    ec2Configuration: EC2ConfigurationType,
    adConfiguration: ADConfigurationType,
    fsxConfiguration: FSXConfigurationType,
    sqlConfiguration: SQLConfigurationType,
    topicArn: string = '',
    enableCloudWatch: boolean = false
): Promise<CloudFormationTemplateResponseType> {
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

    let errMsg = '';
    if (permissions?.length) {
        errMsg = `Required IAM permissions are not available to create the cloud formation template, ${permissions}`;
        logger.error(errMsg);
    }
    const derivedParams = fsxConfiguration.fsxFileSystemId
        ? await generateFsxParams(fsxConfiguration.databaseSize, true)
        : await generateFsxParams(fsxConfiguration.databaseSize, false);

    const { roleArn } = await getRoleName(credentialsId);

    await createSecrets(
        credentialsId,
        region,
        [
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
        ],
        roleArn
    );

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
        ...ec2Configuration,
        ...fsxConfiguration,
        topicArn,
        enableCloudWatch
    };

    Object.entries(clubbedParamList).forEach(([key, value]) => {
        if (TEMPLATE_CONFIGURATION_MAPPING[key]) {
            templateParams += `&param_${TEMPLATE_CONFIGURATION_MAPPING[key]}=${value}`;
        }
    });

    Object.entries(WLM_ASSETS).forEach(([key, value]) => {
        templateParams += `&param_${key}=${value}`;
    });

    const signedTemplateURL = `${CLOUD_FORMATION_STACK_URL}?region=${region}#/stacks/create/review?templateURL=${signedURL}&${templateParams}`;
    return { cloudFormationUrl: signedTemplateURL, warningMessage: errMsg };
}

async function deployCloudFormationTemplate(
    credentialsId: string,
    region: string,
    networkConfiguration: CFNetworkConfigurationType,
    ec2Configuration: EC2ConfigurationType,
    adConfiguration: ADConfigurationType,
    fsxConfiguration: FSXConfigurationType,
    sqlConfiguration: SQLConfigurationType,
    topicArn: string = '',
    enableCloudWatch: boolean = false
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
            statusCode: HttpErrorCodes.VALIDATION_ERROR,
            message: MISSING_PERMISSIONS(permissions)
        };
    }

    const cfStackQuotaReached = await isCfStackQuotaReached(credentialsId, region);
    if (cfStackQuotaReached) {
        throw {
            statusCode: HttpErrorCodes.VALIDATION_ERROR,
            message: CF_QUOTA_REACHED
        };
    }

    const { stackName, templateParameters } = await formatTemplateParameters(
        credentialsId,
        region,
        networkConfiguration,
        ec2Configuration,
        adConfiguration,
        fsxConfiguration,
        sqlConfiguration,
        topicArn,
        enableCloudWatch
    );

    logger.debug(`Stack ${stackName} parameters ${JSON.stringify(templateParameters)}.`);

    const deployStackResponse = await createStack(
        credentialsId,
        region,
        stackName,
        MASTER_TEMPLATE_URL,
        templateParameters,
        DISABLE_ROLLBACK,
        MASTER_STACK_TIMEOUT_MINUTES
    );

    logger.info(`Stack ${stackName} response ${deployStackResponse}`);

    await saveFSxAndSqlServerDetailsInTenancy(stackName, fsxConfiguration, sqlConfiguration);

    return { cloudFormationStackId: deployStackResponse.StackId! };
}

export { createCloudFormationTemplateForUserDeployment, deployCloudFormationTemplate };
