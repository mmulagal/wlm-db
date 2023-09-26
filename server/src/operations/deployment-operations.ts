import createError from 'http-errors';
import { Parameter } from '@aws-sdk/client-cloudformation';
import { createStack } from '../lib/aws/cloud-formation';
import getMissingPermissionsList from './aws/iam-operations';
import { getPreSignedUrl } from '../lib/aws/s3';
import { generateAuthToken } from '../lib/cloud-manager/tenancy';
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
    DISABLE_ROLLBACK,
    MASTER_STACK_TIMEOUT_MINUTES,
    HttpErrorCodes,
    WLM_ASSETS,
    SAME_ROUTETABLE_MESSAGE,
    VALIDATION_AMI,
    ASSETS_BUCKET_REGION,
    EC2_ROLE_NAME,
    DatabaseTypes,
    ACCOUNT_ID,
    TEMPLATE_JWT_TOKEN,
    TEMPLATE_CREDENTIALS_ID,
    TEMPLATE_CLOUD_PROVIDER_ID,
    MASTER_TEMPLATE_PATH,
    WLMDB,
    TEMPLATE_SNS_SERVICE_TOKEN,
    TEMPLATE_OPTIONAL_PARAMETERS,
    TEMPLATE_ACCOUNT_ID,
    SUCCESS,
    ACTION_BUTTON_DASHBOARD
} from '../utils/consts';
import { derivePropertiesFromARN, generateDeploymentParams, getSnsArn, isSameRoutetables } from '../utils/utils';
import getLogger from '../utils/logger';
import { getRoleName } from './cloud-manager/credentials-operations';
import { getWindowsServerBaseAmi } from './aws/ec2-operations';
import { uploadTemplates } from './template-operations';
import { isCfStackQuotaReached } from './aws/service-quotas-operations';
import { getAsyncLocalStorageResource } from '../utils/async-local-storage';
import { prepareDetailsToSendNotification } from './cloud-manager/notification-operations';

const logger = getLogger();

async function formatTemplateParameters(
    credentialsId: string,
    region: string,
    networkConfiguration: CFNetworkConfigurationType,
    ec2Configuration: EC2ConfigurationType,
    adConfiguration: ADConfigurationType,
    fsxConfiguration: FSXConfigurationType,
    sqlConfiguration: SQLConfigurationType,
    topicArn: string,
    enableCloudWatch: boolean
) {
    const derivedParams = fsxConfiguration.fsxFileSystemId
        ? generateDeploymentParams(fsxConfiguration.databaseSize, true, sqlConfiguration.sqlDeploymentMode)
        : generateDeploymentParams(fsxConfiguration.databaseSize, false, sqlConfiguration.sqlDeploymentMode);

    const { roleName, roleArn, providerAccountId } = await getRoleName(credentialsId);

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

    const stackName = derivedParams.StackName;
    const validationAmiImage = await getWindowsServerBaseAmi(credentialsId, region);
    const accountId = getAsyncLocalStorageResource<string>(ACCOUNT_ID);
    const { token } = generateAuthToken({ user: 'SYSTEM@netapp.com' });

    const { awsAccountId } = derivePropertiesFromARN(process.env.AWS_ROLE_ARN as string) || {};
    const snsServiceToken = awsAccountId ? getSnsArn(awsAccountId, region, WLMDB) : '';

    const templateParams: Array<Parameter> = [
        { ParameterKey: EC2_ROLE_NAME, ParameterValue: roleName },
        { ParameterKey: VALIDATION_AMI, ParameterValue: validationAmiImage },
        { ParameterKey: TEMPLATE_ACCOUNT_ID, ParameterValue: accountId },
        { ParameterKey: TEMPLATE_CLOUD_PROVIDER_ID, ParameterValue: providerAccountId },
        { ParameterKey: TEMPLATE_CREDENTIALS_ID, ParameterValue: credentialsId },
        { ParameterKey: TEMPLATE_JWT_TOKEN, ParameterValue: token },
        { ParameterKey: TEMPLATE_SNS_SERVICE_TOKEN, ParameterValue: snsServiceToken }
    ];

    Object.entries(derivedParams).forEach(([key, value]) => {
        if (key !== 'StackName') {
            templateParams.push({
                ParameterKey: key,
                ParameterValue: value.toString()
            });
        }
    });

    const clubbedParamList = {
        ...networkConfiguration,
        ...adConfiguration,
        ...fsxConfiguration,
        ...sqlConfiguration,
        ...ec2Configuration,
        topicArn,
        enableCloudWatch
    };

    Object.entries(clubbedParamList).forEach(([key, value]) => {
        if (TEMPLATE_CONFIGURATION_MAPPING[key]) {
            templateParams.push({
                ParameterKey: TEMPLATE_CONFIGURATION_MAPPING[key],
                ParameterValue: value.toString()
            });
        }
    });

    Object.entries(TEMPLATE_OPTIONAL_PARAMETERS).forEach(([key, value]) => {
        if (!(key in clubbedParamList)) {
            templateParams.push({
                ParameterKey: value,
                ParameterValue: ''
            });
        }
    });

    Object.entries(WLM_ASSETS).forEach(([key, value]) => {
        templateParams.push({
            ParameterKey: key,
            ParameterValue: value.toString()
        });
    });

    return { stackName, templateParameters: templateParams };
}

async function createCloudFormationTemplateForUserDeployment(
    credentialsId: string,
    region: string,
    networkConfiguration: CFNetworkConfigurationType,
    ec2Configuration: EC2ConfigurationType,
    adConfiguration: ADConfigurationType,
    fsxConfiguration: FSXConfigurationType,
    sqlConfiguration: SQLConfigurationType,
    topicArn: string = '',
    enableCloudWatch: boolean = false,
    tags?: Array<{ key: string; value: string }>
): Promise<CloudFormationTemplateResponseType> {
    logger.info('Create cloud formation template for user deployment', {
        credentialsId,
        region,
        networkConfiguration,
        ec2Configuration,
        adConfiguration,
        fsxConfiguration,
        sqlConfiguration,
        tags
    });

    const sameRoutes = isSameRoutetables(networkConfiguration);
    if (sameRoutes) {
        throw createError(HttpErrorCodes.VALIDATION_ERROR, SAME_ROUTETABLE_MESSAGE);
    }

    const { permissions } = await getMissingPermissionsList(credentialsId, region);

    let errMsg = '';
    if (permissions?.length) {
        errMsg = `Required IAM permissions are not available to create the cloud formation template, ${permissions}`;
        logger.error(errMsg);
    }
    const derivedParams = fsxConfiguration.fsxFileSystemId
        ? generateDeploymentParams(fsxConfiguration.databaseSize, true, sqlConfiguration.sqlDeploymentMode)
        : generateDeploymentParams(fsxConfiguration.databaseSize, false, sqlConfiguration.sqlDeploymentMode);

    const { roleName, roleArn, providerAccountId } = await getRoleName(credentialsId);

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

    const customMasterTemplatePath: string = `${derivedParams.StackName}/${MASTER_TEMPLATE_PATH}`;

    const signedMasterTemplateUrl = await getPreSignedUrl(ASSETS_BUCKET_REGION, customMasterTemplatePath);

    logger.info('Signed master url ', signedMasterTemplateUrl);

    // Generate Signed-url and upload to bucket
    await uploadTemplates(
        credentialsId,
        ASSETS_BUCKET_REGION,
        DatabaseTypes.MS_SQL_SERVER,
        derivedParams.StackName,
        tags?.map(({ key, value }) => ({ Key: key, Value: value })),
        customMasterTemplatePath
    );

    const validationAmiImage = await getWindowsServerBaseAmi(credentialsId, region);

    const accountId = getAsyncLocalStorageResource<string>(ACCOUNT_ID);
    const { token } = generateAuthToken({ email: 'SYSTEM@netapp.com' });

    const { awsAccountId } = derivePropertiesFromARN(process.env.AWS_ROLE_ARN as string) || {};
    const snsServiceToken = awsAccountId ? getSnsArn(awsAccountId, region, WLMDB) : '';

    let templateParams: string = `stackName=${derivedParams.StackName}&param_${EC2_ROLE_NAME}=${roleName}&param_${VALIDATION_AMI}=${validationAmiImage}&param_${TEMPLATE_ACCOUNT_ID}=${accountId}&param_${TEMPLATE_JWT_TOKEN}=${token}&param_${TEMPLATE_CREDENTIALS_ID}=${credentialsId}&param_${TEMPLATE_CLOUD_PROVIDER_ID}=${providerAccountId}&param_${TEMPLATE_SNS_SERVICE_TOKEN}=${snsServiceToken}`;

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

    const signedTemplateURL = `${CLOUD_FORMATION_STACK_URL}?region=${region}#/stacks/create/review?templateURL=${signedMasterTemplateUrl}&${templateParams}`;

    logger.info('Cloud Formation template URL ', signedTemplateURL);

    await prepareDetailsToSendNotification(
        'user_deployment',
        'Cloud formation signed template URL created successfully',
        'Cloud formation signed template URL created successfully for quick user deployment',
        { uiNotification: true, emailNotification: true },
        ACTION_BUTTON_DASHBOARD,
        SUCCESS
    );
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
    enableCloudWatch: boolean = false,
    tags?: Array<{ key: string; value: string }>
): Promise<{ cloudFormationStackId: string }> {
    logger.info('Deploy sql cloud formation template ', {
        credentialsId,
        region,
        networkConfiguration,
        ec2Configuration,
        adConfiguration,
        fsxConfiguration,
        sqlConfiguration,
        tags
    });

    const sameRoutes = isSameRoutetables(networkConfiguration);
    if (sameRoutes) {
        throw createError(HttpErrorCodes.VALIDATION_ERROR, SAME_ROUTETABLE_MESSAGE);
    }

    const { permissions } = await getMissingPermissionsList(credentialsId, region);
    if (permissions?.length) {
        throw createError(HttpErrorCodes.VALIDATION_ERROR, MISSING_PERMISSIONS(permissions));
    }

    const cfStackQuotaReached = await isCfStackQuotaReached(credentialsId, region);
    if (cfStackQuotaReached) {
        throw createError(HttpErrorCodes.VALIDATION_ERROR, CF_QUOTA_REACHED);
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

    const customMasterTemplatePath: string = `${stackName}/${MASTER_TEMPLATE_PATH}`;

    const signedMasterTemplateUrl = await getPreSignedUrl(ASSETS_BUCKET_REGION, customMasterTemplatePath);

    logger.info('Signed master url ', signedMasterTemplateUrl);

    // Generate Signed-url and upload to bucket
    await uploadTemplates(
        credentialsId,
        region,
        DatabaseTypes.MS_SQL_SERVER,
        stackName,
        tags?.map(({ key, value }) => ({ Key: key, Value: value })),
        customMasterTemplatePath
    );

    const deployStackResponse = await createStack(
        credentialsId,
        region,
        stackName,
        signedMasterTemplateUrl,
        templateParameters,
        DISABLE_ROLLBACK,
        MASTER_STACK_TIMEOUT_MINUTES
    );

    logger.info(`Stack ${stackName} response ${deployStackResponse}`);

    await prepareDetailsToSendNotification(
        'standard_deployment',
        'Cloud formation standard deployment initiated',
        'Cloud formation standard deployment initiated',
        { uiNotification: true, emailNotification: true },
        ACTION_BUTTON_DASHBOARD,
        SUCCESS
    );

    return { cloudFormationStackId: deployStackResponse.StackId! };
}

export { createCloudFormationTemplateForUserDeployment, deployCloudFormationTemplate };
