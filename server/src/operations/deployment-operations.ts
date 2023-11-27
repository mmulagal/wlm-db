import createError from 'http-errors';
import randomize from 'randomatic';
import fs from 'fs';
import path from 'path';
import { escapeRegExp } from 'lodash-es';
import { Parameter } from '@aws-sdk/client-cloudformation';
import { DEPLOYMENT_MODEL, DEPLOYMENT_STATUS } from '@prisma/client';
import { randomUUID } from 'crypto';
import { createStack } from '../lib/aws/cloud-formation';
import getMissingPermissionsList from './aws/iam-operations';
import { getObjectBucket, preSignedUrl } from '../lib/aws/s3';
import { generateAuthToken } from '../lib/cloud-manager/tenancy';
import {
    CFNetworkConfigurationType,
    EC2ConfigurationType,
    ADConfigurationType,
    FSXConfigurationType,
    SQLConfigurationType,
    CloudFormationTemplateResponseType,
    CloudFormationStaticTemplateResponseType
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
    VALIDATION_AMI,
    ASSETS_BUCKET_REGION,
    EC2_ROLE_NAME,
    DatabaseTypes,
    ACCOUNT_ID,
    TEMPLATE_JWT_TOKEN,
    TEMPLATE_CREDENTIALS_ID,
    TEMPLATE_CLOUD_PROVIDER_ID,
    MASTER_TEMPLATE_PATH,
    TEMPLATE_OPTIONAL_PARAMETERS,
    WLMDB,
    TEMPLATE_SNS_SERVICE_TOKEN,
    TEMPLATE_ACCOUNT_ID,
    SUCCESS,
    ACTION_BUTTON_DASHBOARD,
    STANDARD_DEPLOYMENT_ACTION,
    SQL_DEPLOYMENET_INITIATED_SUBJECT,
    AWS_RESOURCES_ACTION_MAP,
    AWS_RESOURCES_STRICT_ACTION_MAP,
    SECRET_MANAGER_ARN,
    CLOUD_FORMATION_ARN,
    EC2_TAG_CONDITION,
    FSX_TAG_CONDITION,
    AWS_RESOURCES_STRICT_CONDITION_ACTION_MAP,
    BUCKET_NAME,
    CLOUD_FORMATION_CLI_COMMAND,
    DEFAULT_AWS_REGION,
    SKIP_TEMPLATE_PASSWORD_PARAMETERS,
    CloudProviders,
    RESOURCESTYPE,
    STANDALONE,
    STANDALONE_NETWORK_VIOLATION_MESSAGE,
    FCI_NETWORK_VIOLATION_MESSAGE,
    FileSystemTypes,
    DATABASE_TYPE,
    FSX_ADMIN_PASSWORD,
    SQL_SA_PASSWORD,
    DOMAIN_ADMIN_PASSWORD,
    LOG_GROUP_ARN,
    WLMDB_RESOURCE_TAG_VALUE
} from '../utils/consts';
import {
    derivePropertiesFromARN,
    generateDeploymentParams,
    getSnsArn,
    isNetworkConfigurationViolated,
    sleep
} from '../utils/utils';
import getLogger from '../utils/logger';
import { getRoleDetails } from './cloud-manager/credentials-operations';
import { getWindowsServerBaseAmi } from './aws/ec2-operations';
import { uploadTemplates } from './template-operations';
import { isCfStackQuotaReached } from './aws/service-quotas-operations';
import { getAsyncLocalStorageResource } from '../utils/async-local-storage';
import { getAllDeploymentStatus, getDeploymentStatusByName } from './database/database-operations';
import { handleNotification } from './cloud-manager/notification-operations';
import { createDeployment, createResource } from '../lib/database/db';

const logger = getLogger();
const { getPreSignedUrl } = preSignedUrl;

async function formatTemplateParameters(
    networkConfiguration: CFNetworkConfigurationType,
    ec2Configuration: EC2ConfigurationType,
    adConfiguration: ADConfigurationType,
    fsxConfiguration: FSXConfigurationType,
    sqlConfiguration: SQLConfigurationType,
    topicArn: string,
    enableCloudWatch: boolean,
    credentialsId?: string,
    region?: string,
    skipPasswords?: boolean
) {
    const derivedParams = fsxConfiguration.fsxFileSystemId
        ? generateDeploymentParams(fsxConfiguration.databaseSize, true, sqlConfiguration.sqlDeploymentMode)
        : generateDeploymentParams(fsxConfiguration.databaseSize, false, sqlConfiguration.sqlDeploymentMode);

    const { roleName = '', providerAccountId = '' } = credentialsId
        ? await getRoleDetails(credentialsId)
        : { roleName: '', providerAccountId: '' };

    const stackName = derivedParams.StackName;
    const validationAmiImage = credentialsId && region ? await getWindowsServerBaseAmi(credentialsId!, region!) : '';
    const accountId = getAsyncLocalStorageResource<string>(ACCOUNT_ID);
    const { token } = generateAuthToken({ user: 'SYSTEM@netapp.com' });

    const { awsAccountId } = derivePropertiesFromARN(process.env.AWS_ROLE_ARN as string) || {};
    const snsServiceToken = awsAccountId ? getSnsArn(awsAccountId, region!, WLMDB) : '';

    const templateParams: Array<Parameter> = [
        { ParameterKey: EC2_ROLE_NAME, ParameterValue: roleName },
        { ParameterKey: VALIDATION_AMI, ParameterValue: validationAmiImage },
        { ParameterKey: TEMPLATE_ACCOUNT_ID, ParameterValue: accountId },
        { ParameterKey: TEMPLATE_CLOUD_PROVIDER_ID, ParameterValue: providerAccountId },
        { ParameterKey: TEMPLATE_CREDENTIALS_ID, ParameterValue: credentialsId },
        { ParameterKey: TEMPLATE_SNS_SERVICE_TOKEN, ParameterValue: snsServiceToken },
        { ParameterKey: TEMPLATE_JWT_TOKEN, ParameterValue: token }
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
                ParameterValue:
                    skipPasswords && SKIP_TEMPLATE_PASSWORD_PARAMETERS.includes(TEMPLATE_CONFIGURATION_MAPPING[key])
                        ? ''
                        : value.toString()
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

async function getCloudformationTemplate(
    networkConfiguration: CFNetworkConfigurationType,
    ec2Configuration: EC2ConfigurationType,
    adConfiguration: ADConfigurationType,
    fsxConfiguration: FSXConfigurationType,
    sqlConfiguration: SQLConfigurationType,
    topicArn: string = '',
    enableCloudWatch: boolean = false,
    tags?: Array<{ key: string; value: string }>,
    credentialsId?: string,
    region?: string
): Promise<CloudFormationStaticTemplateResponseType> {
    logger.info('Cloud formation template ', {
        credentialsId,
        region,
        networkConfiguration,
        ec2Configuration,
        adConfiguration,
        fsxConfiguration,
        sqlConfiguration,
        tags
    });

    const { stackName, templateParameters } = await formatTemplateParameters(
        networkConfiguration,
        ec2Configuration,
        adConfiguration,
        fsxConfiguration,
        sqlConfiguration,
        topicArn,
        enableCloudWatch,
        credentialsId,
        region,
        true
    );

    logger.debug(`Stack ${stackName} parameters ${JSON.stringify(templateParameters)}.`);

    const customMasterTemplatePath: string = `${stackName}/${MASTER_TEMPLATE_PATH}`;

    const signedMasterTemplateUrl = await getPreSignedUrl(ASSETS_BUCKET_REGION, customMasterTemplatePath);

    logger.info('Signed master url ', signedMasterTemplateUrl);

    // Generate Signed-url and upload to bucket
    await uploadTemplates(
        ASSETS_BUCKET_REGION,
        DatabaseTypes.MS_SQL_SERVER,
        stackName,
        tags?.map(({ key, value }) => ({ Key: key, Value: value })),
        customMasterTemplatePath
    );

    let masterTemplateContents;
    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        const filePathSim = path.join(
            process.cwd(),
            '..',
            'server',
            'test',
            'simulator',
            'responses',
            'aws',
            'mock-master-template.yaml'
        );

        const filePathDemo = path.join(
            process.cwd(),
            '..',
            'wlmdb',
            'test',
            'simulator',
            'responses',
            'aws',
            'mock-master-template.yaml'
        );
        const filePath = process.env.NODE_ENV === 'demo' ? filePathDemo : filePathSim;
        const yamlString = fs.readFileSync(filePath, 'utf8');
        masterTemplateContents = yamlString;
    } else {
        // Sleep for 2 seconds for master template to be uploaded
        await sleep(2000);

        const response = await getObjectBucket(ASSETS_BUCKET_REGION, BUCKET_NAME, customMasterTemplatePath);
        masterTemplateContents = await response.Body?.transformToString();
    }
    // Generate parameters list for cli command
    let cliParams: string = '';
    templateParameters.forEach(e => {
        if (e.ParameterKey === FSX_ADMIN_PASSWORD) {
            cliParams += `ParameterKey="${e.ParameterKey}",ParameterValue="${escapeRegExp(
                fsxConfiguration.fsxPassword
            ).replace('!', '\\!')}" `;
        } else if (e.ParameterKey === SQL_SA_PASSWORD) {
            cliParams += `ParameterKey="${e.ParameterKey}",ParameterValue="${escapeRegExp(
                sqlConfiguration.serviceAccountPassword
            ).replace('!', '\\!')}" `;
        } else if (e.ParameterKey === DOMAIN_ADMIN_PASSWORD) {
            cliParams += `ParameterKey="${e.ParameterKey}",ParameterValue="${escapeRegExp(
                adConfiguration.domainPassword
            ).replace('!', '\\!')}" `;
        } else {
            cliParams += `ParameterKey="${e.ParameterKey}",ParameterValue="${e.ParameterValue?.toString()}" `;
        }
    });
    const cloudFormationCli = `${CLOUD_FORMATION_CLI_COMMAND} --stack-name ${stackName} --template-url '${signedMasterTemplateUrl}' --region ${
        region || DEFAULT_AWS_REGION
    } --parameters ${cliParams} --capabilities CAPABILITY_NAMED_IAM`;

    // Generate parameters list for quick create url command
    let urlParams: string = `stackName=${stackName}`;
    templateParameters.forEach(e => {
        urlParams += `&param_${e.ParameterKey}=${e.ParameterValue}`;
    });
    const signedTemplateURL = `${CLOUD_FORMATION_STACK_URL}?region=${
        region || undefined // explicitly needs to be send if the region is empty string -- cloudformation would not take an empty string
    }#/stacks/create/review?templateURL=${encodeURIComponent(signedMasterTemplateUrl)}&${urlParams}`;

    return {
        url: signedTemplateURL,
        template: masterTemplateContents || '',
        cliCommand: cloudFormationCli
    };
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

    const isViolated = isNetworkConfigurationViolated(networkConfiguration, sqlConfiguration.sqlDeploymentMode);
    if (isViolated) {
        if (sqlConfiguration.sqlDeploymentMode === STANDALONE) {
            throw createError(HttpErrorCodes.VALIDATION_ERROR, STANDALONE_NETWORK_VIOLATION_MESSAGE);
        }
        throw createError(HttpErrorCodes.VALIDATION_ERROR, FCI_NETWORK_VIOLATION_MESSAGE);
    }

    // Commented as we have to enable this permission check if the user has SimulatePrincipalPolicy permission
    // const { permissions, strictPermissions, strictConditionPermissions } = await checkAllMissingPermissions(
    //     credentialsId,
    //     region
    // );

    // let errMsg = '';
    // if (permissions?.length || strictPermissions?.length || strictConditionPermissions?.length) {
    //     errMsg = `Required IAM permissions are not available to create the cloud formation template, ${permissions}`;
    //     logger.error(errMsg);
    // }
    const derivedParams = fsxConfiguration.fsxFileSystemId
        ? generateDeploymentParams(fsxConfiguration.databaseSize, true, sqlConfiguration.sqlDeploymentMode)
        : generateDeploymentParams(fsxConfiguration.databaseSize, false, sqlConfiguration.sqlDeploymentMode);

    const { roleName, providerAccountId } = await getRoleDetails(credentialsId);

    const customMasterTemplatePath: string = `${derivedParams.StackName}/${MASTER_TEMPLATE_PATH}`;

    const signedMasterTemplateUrl = await getPreSignedUrl(ASSETS_BUCKET_REGION, customMasterTemplatePath);

    const encodedSignedMasterTemplateURL = encodeURIComponent(signedMasterTemplateUrl);
    logger.info('Signed master url ', encodedSignedMasterTemplateURL);

    // Generate Signed-url and upload to bucket
    await uploadTemplates(
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
    const snsServiceToken = awsAccountId ? getSnsArn(awsAccountId, region!, WLMDB) : '';

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
            value = SKIP_TEMPLATE_PASSWORD_PARAMETERS.includes(TEMPLATE_CONFIGURATION_MAPPING[key]) ? '' : value;
            templateParams += `&param_${TEMPLATE_CONFIGURATION_MAPPING[key]}=${value}`;
        }
    });

    Object.entries(WLM_ASSETS).forEach(([key, value]) => {
        templateParams += `&param_${key}=${value}`;
    });

    const signedTemplateURL = `${CLOUD_FORMATION_STACK_URL}?region=${region}#/stacks/create/review?templateURL=${encodedSignedMasterTemplateURL}&${templateParams}`;

    logger.info('Cloud Formation template URL ', signedTemplateURL);

    return { cloudFormationUrl: signedTemplateURL };
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

    const isViolated = isNetworkConfigurationViolated(networkConfiguration, sqlConfiguration.sqlDeploymentMode);
    if (isViolated) {
        if (sqlConfiguration.sqlDeploymentMode === STANDALONE) {
            throw createError(HttpErrorCodes.VALIDATION_ERROR, STANDALONE_NETWORK_VIOLATION_MESSAGE);
        }
        throw createError(HttpErrorCodes.VALIDATION_ERROR, FCI_NETWORK_VIOLATION_MESSAGE);
    }

    const { permissions, strictPermissions, strictConditionPermissions } = await checkAllMissingPermissions(
        credentialsId,
        region
    );

    if (permissions?.length || strictPermissions?.length || strictConditionPermissions?.length) {
        throw createError(HttpErrorCodes.VALIDATION_ERROR, MISSING_PERMISSIONS(permissions));
    }

    const cfStackQuotaReached = await isCfStackQuotaReached(credentialsId, region);
    if (cfStackQuotaReached) {
        throw createError(HttpErrorCodes.VALIDATION_ERROR, CF_QUOTA_REACHED);
    }

    const { stackName, templateParameters } = await formatTemplateParameters(
        networkConfiguration,
        ec2Configuration,
        adConfiguration,
        fsxConfiguration,
        sqlConfiguration,
        topicArn,
        enableCloudWatch,
        credentialsId,
        region
    );

    logger.debug(`Stack ${stackName} parameters ${JSON.stringify(templateParameters)}.`);

    const customMasterTemplatePath: string = `${stackName}/${MASTER_TEMPLATE_PATH}`;

    const signedMasterTemplateUrl = await getPreSignedUrl(ASSETS_BUCKET_REGION, customMasterTemplatePath);

    logger.info('Signed master url ', signedMasterTemplateUrl);

    // Generate Signed-url and upload to bucket
    await uploadTemplates(
        ASSETS_BUCKET_REGION,
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

    const notificationData = {
        notificationAction: STANDARD_DEPLOYMENT_ACTION,
        subject: SQL_DEPLOYMENET_INITIATED_SUBJECT,
        uiNotificationDescription: `Microsoft SQL Server and FSxN for ONTAP deployment with stack name ${stackName} has been initiated`,
        actionLabel: SQL_DEPLOYMENET_INITIATED_SUBJECT,
        redirectURL: '/',
        label: ACTION_BUTTON_DASHBOARD,
        priority: SUCCESS
    };
    await handleNotification(notificationData, { uiNotification: true, emailNotification: true });

    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        const accountId: string = getAsyncLocalStorageResource(ACCOUNT_ID);
        const stackId = deployStackResponse.StackId || '';
        createDeploymentMockDataInDB(
            accountId,
            stackId,
            stackName,
            region,
            credentialsId,
            sqlConfiguration?.sqlDeploymentMode
        );
    }
    return { cloudFormationStackId: deployStackResponse.StackId! };
}

async function deploymentStatus(accountId: string) {
    logger.info('Fetching deployment status from database', accountId);
    const data = await getAllDeploymentStatus(accountId);
    return data;
}

async function deploymentStatusByName(accountId: string, deploymentName: string) {
    logger.info('Fetching deployment status by id from database ', accountId, deploymentName);
    const data = await getDeploymentStatusByName(accountId, deploymentName);
    return data;
}

async function checkAllMissingPermissions(credentialsId: string, region: string) {
    logger.info('check all missing permissions', credentialsId, region);
    // checking the permissions for three different times to find out with different conditions like resource arn, conditions & resource set to *
    const { permissions } = await getMissingPermissionsList(credentialsId, region, AWS_RESOURCES_ACTION_MAP);
    const { permissions: strictPermissions } = await getMissingPermissionsList(
        credentialsId,
        region,
        AWS_RESOURCES_STRICT_ACTION_MAP,
        [SECRET_MANAGER_ARN, CLOUD_FORMATION_ARN, LOG_GROUP_ARN]
    );
    const { permissions: strictConditionPermissions } = await getMissingPermissionsList(
        credentialsId,
        region,
        AWS_RESOURCES_STRICT_CONDITION_ACTION_MAP,
        undefined,
        [
            {
                // ContextEntry
                ContextKeyName: EC2_TAG_CONDITION,
                ContextKeyValues: [
                    // ContextKeyValueListType
                    WLMDB_RESOURCE_TAG_VALUE
                ],
                ContextKeyType: 'string'
            },
            {
                ContextKeyName: FSX_TAG_CONDITION,
                ContextKeyValues: [WLMDB_RESOURCE_TAG_VALUE],
                ContextKeyType: 'string'
            }
        ]
    );
    return { permissions, strictPermissions, strictConditionPermissions };
}

async function createDeploymentMockDataInDB(
    accountId: string,
    stackId: string,
    stackName: string,
    region: string,
    credentialId: string,
    sqlDeploymentMode: string
) {
    logger.info('create deployment mock data in database', {
        accountId,
        stackId,
        stackName,
        region,
        credentialId,
        sqlDeploymentMode
    });

    const cloudProviderId = randomize('0', 8);
    const resourceName = `sqlnode-${randomize('0', 5)}`;
    if (sqlDeploymentMode.toLowerCase() === 'fci') {
        sqlDeploymentMode = 'FCI';
    } else if (sqlDeploymentMode.toLowerCase() === 'standalone') {
        sqlDeploymentMode = 'Standalone';
    }
    await createDeployment(accountId, {
        deploymentId: stackId,
        cloudProviderAccountId: cloudProviderId,
        cloudProviderName: CloudProviders.AWS,
        credentialsId: credentialId,
        deploymentStatus: DEPLOYMENT_STATUS.CREATE_COMPLETE,
        startTime: new Date().valueOf(),
        region,
        deploymentName: stackName,
        deploymentModel: sqlDeploymentMode as DEPLOYMENT_MODEL,
        endTime: new Date().valueOf(),
        data: {
            databaseType: DATABASE_TYPE,
            resourceName,
            fileSystemType: FileSystemTypes.FSXONTAP
        }
    });

    await createResource(accountId, {
        resourceId: randomUUID(),
        resourceName,
        cloudProviderAccountId: cloudProviderId,
        cloudProviderName: CloudProviders.AWS,
        resourceType: RESOURCESTYPE.MSSQL,
        coRelationId: `fs-${randomize('A0', 17)}`,
        region,
        metadata: {
            credentialsId: credentialId,
            sqlDeploymentType: sqlDeploymentMode as DEPLOYMENT_MODEL,
            fileSystemType: FileSystemTypes.FSXONTAP,
            activeNodeInstanceId: `i-${randomize('A0', 17)}`,
            activeNodeInstanceName: `sqlnode-${randomize('0', 5)}`
        }
    });
}

export {
    createCloudFormationTemplateForUserDeployment,
    deployCloudFormationTemplate,
    deploymentStatus,
    deploymentStatusByName,
    getCloudformationTemplate
};
