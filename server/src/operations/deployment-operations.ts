import createError from 'http-errors';
import randomize from 'randomatic';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
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
    CloudFormationDeploymentResponseType,
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
    CF_DEPLOY_ROLE_NAME,
    DatabaseTypes,
    ACCOUNT_ID,
    TEMPLATE_JWT_TOKEN,
    TEMPLATE_CREDENTIALS_ID,
    TEMPLATE_CLOUD_PROVIDER_ID,
    MASTER_TEMPLATE_PATH,
    TEMPLATE_OPTIONAL_PARAMETERS,
    TEMPLATE_WLMDB_AWS_ACCOUT_ID,
    TEMPLATE_ACCOUNT_ID,
    AWS_RESOURCES_ACTION_MAP,
    AWS_RESOURCES_STRICT_ACTION_MAP,
    SECRET_MANAGER_ARN,
    CLOUD_FORMATION_ARN,
    EC2_TAG_CONDITION,
    FSX_TAG_CONDITION,
    AWS_RESOURCES_STRICT_CONDITION_ACTION_MAP,
    BUCKET_NAME,
    CLOUD_FORMATION_CLI_COMMAND,
    SKIP_TEMPLATE_PASSWORD_PARAMETERS,
    CloudProviders,
    RESOURCESTYPE,
    FileSystemTypes,
    DATABASE_TYPE,
    FSX_ADMIN_PASSWORD,
    SQL_SA_PASSWORD,
    DOMAIN_ADMIN_PASSWORD,
    LOG_GROUP_ARN,
    WLMDB_RESOURCE_TAG_VALUE,
    STANDALONE,
    STANDALONE_NETWORK_VIOLATION_MESSAGE,
    FCI_NETWORK_VIOLATION_MESSAGE,
    IAM_LINKEDROLE_CONDITION,
    IAM_EC2_SERVICE,
    IAM_PASSROLE_CONDITION,
    TEMPLATE_FSX_PASSWORD,
    TEMPLATE_METRICS,
    TRIGGERED_FROM,
    DEPLOYED_FROM,
    WLMDB,
    AWSServiceNames,
    INSTANCE_TYPE,
    SQL_VERSION,
    DATABASE_SIZE,
    SQL_HOST_NAME
} from '../utils/consts';
import {
    createJobMockData,
    calculateSQLandWindowsVersion,
    deployedStackUrl,
    derivePropertiesFromARN,
    generateDeploymentParams,
    generateRandomIP,
    isNetworkConfigurationViolated,
    sleep
} from '../utils/utils';
import getLogger from '../utils/logger';
import { getRoleDetails } from './cloud-manager/credentials-operations';
import { getWindowsServerBaseAmi } from './aws/ec2-operations';
import uploadTemplates from './template-operations';
import { isCfStackQuotaReached } from './aws/service-quotas-operations';
import { getAsyncLocalStorageResource } from '../utils/async-local-storage';
import { getAllDeploymentStatus, getDeploymentStatusByName } from './database/database-operations';
// import { handleNotification } from './cloud-manager/notification-operations';
import { createDeployment, createResource } from '../lib/database/db';
import { Metadata, NetworkViolation } from '../utils/common-types';
import { encryptString } from './aws/kms-operations';
import PARAMETERS from '../utils/template-parameters';
import { createJobs } from '../lib/database/job';

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
    metrics: string,
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
    const templateParams: Array<Parameter> = [
        { ParameterKey: CF_DEPLOY_ROLE_NAME, ParameterValue: roleName },
        { ParameterKey: VALIDATION_AMI, ParameterValue: validationAmiImage },
        { ParameterKey: TEMPLATE_ACCOUNT_ID, ParameterValue: accountId },
        { ParameterKey: TEMPLATE_CLOUD_PROVIDER_ID, ParameterValue: providerAccountId },
        { ParameterKey: TEMPLATE_CREDENTIALS_ID, ParameterValue: credentialsId },
        { ParameterKey: TEMPLATE_WLMDB_AWS_ACCOUT_ID, ParameterValue: awsAccountId },
        { ParameterKey: TEMPLATE_JWT_TOKEN, ParameterValue: token },
        { ParameterKey: TEMPLATE_METRICS, ParameterValue: metrics }
    ];
    if (fsxConfiguration.fsxPassword) {
        const encryptedFsxPassword = await encryptString(fsxConfiguration.fsxPassword);
        if (encryptedFsxPassword) {
            templateParams.push({ ParameterKey: TEMPLATE_FSX_PASSWORD, ParameterValue: encryptedFsxPassword });
        }
    }

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

async function formatTemplateParametersToCf(templateParameters: Parameter[]) {
    logger.info('Add parameters to template in cloud formation format');
    const parameters = {};
    PARAMETERS.forEach(parameter => {
        const { name, description, type, noEcho, minLength, maxLength, minValue, maxValue, allowedValues, pattern } =
            parameter;
        const paramValue = templateParameters.find(param => param.ParameterKey === name);
        const paramData = {};
        (paramData as { [index: string]: object })[name] = {
            Description: description,
            Type: type,
            Default: paramValue && paramValue.ParameterValue !== '' ? paramValue.ParameterValue : parameter.default!,
            NoEcho: noEcho!,
            MinLength: minLength!,
            MaxLength: maxLength!,
            MinValue: minValue!,
            MaxValue: maxValue!,
            AllowedValues: allowedValues!,
            AllowedPattern: pattern!
        };

        (parameters as { [index: string]: string })[name] = yaml.stringify(paramData, {
            indent: 4,
            collectionStyle: 'block'
        });
    });

    logger.debug('Formatted cloud formation parameters', parameters);
    return parameters;
}

async function getCloudformationTemplate(
    networkConfiguration: CFNetworkConfigurationType,
    ec2Configuration: EC2ConfigurationType,
    adConfiguration: ADConfigurationType,
    fsxConfiguration: FSXConfigurationType,
    sqlConfiguration: SQLConfigurationType,
    topicArn: string = '',
    enableCloudWatch: boolean = false,
    triggeredFrom: string,
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
        triggeredFrom,
        tags
    });

    const { workloadInstanceType } = ec2Configuration;
    const { sqlServerName, sqlAmiName } = sqlConfiguration;
    const { databaseSize } = fsxConfiguration;
    const [sqlVersion] = calculateSQLandWindowsVersion(sqlAmiName);
    // TODO we can make describe image aws sdk call for sqlAmiName instead of UI sending it in payload as it is error prone
    const metrics = `${TRIGGERED_FROM}:${triggeredFrom},${DEPLOYED_FROM}:${AWSServiceNames.CLOUDFORMATION},${INSTANCE_TYPE}:${workloadInstanceType},${SQL_VERSION}:${sqlVersion},${DATABASE_SIZE}:${databaseSize},${SQL_HOST_NAME}:${sqlServerName}`;

    const { stackName, templateParameters } = await formatTemplateParameters(
        networkConfiguration,
        ec2Configuration,
        adConfiguration,
        fsxConfiguration,
        sqlConfiguration,
        topicArn,
        enableCloudWatch,
        metrics,
        credentialsId,
        region,
        true
    );

    logger.debug(`Stack ${stackName} parameters ${JSON.stringify(templateParameters)}.`);

    const customMasterTemplatePath: string = `${stackName}/${MASTER_TEMPLATE_PATH}`;

    const signedMasterTemplateUrl = await getPreSignedUrl(ASSETS_BUCKET_REGION, customMasterTemplatePath);

    logger.info('Signed master url ', signedMasterTemplateUrl);

    // Add Parameter construct - description, type and others. Default is added if user has specified a value or a value specified by default
    const templateParamsInCfFormat = await formatTemplateParametersToCf(templateParameters);

    // Generate Signed-url and upload to bucket
    await uploadTemplates(
        ASSETS_BUCKET_REGION,
        DatabaseTypes.MS_SQL_SERVER,
        stackName,
        tags?.map(({ key, value }) => ({ Key: key, Value: value })),
        customMasterTemplatePath,
        templateParamsInCfFormat
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
    const cloudFormationCli = `${CLOUD_FORMATION_CLI_COMMAND} --stack-name ${stackName} --template-url '${signedMasterTemplateUrl}' --parameters ${cliParams} --capabilities CAPABILITY_NAMED_IAM ${
        region ? `--region ${region}` : ''
    }`;

    // Generate parameters list for quick create url command
    let urlParams: string = `stackName=${stackName}`;
    templateParameters.forEach(e => {
        urlParams += `&param_${e.ParameterKey}=${
            e.ParameterValue ? encodeURIComponent(e.ParameterValue) : e.ParameterValue
        }`;
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

async function deployStackOrCreateTemplateURL(
    credentialsId: string,
    region: string,
    networkConfiguration: CFNetworkConfigurationType,
    ec2Configuration: EC2ConfigurationType,
    adConfiguration: ADConfigurationType,
    fsxConfiguration: FSXConfigurationType,
    sqlConfiguration: SQLConfigurationType,
    topicArn: string = '',
    enableCloudWatch: boolean = false,
    triggeredFrom: string,
    tags?: Array<{ key: string; value: string }>
) {
    logger.info('Deploy Stack or Create Template URL For user deployment', {
        credentialsId,
        region,
        networkConfiguration,
        ec2Configuration,
        adConfiguration,
        fsxConfiguration,
        sqlConfiguration,
        tags,
        triggeredFrom
    });

    const { workloadInstanceType } = ec2Configuration;
    const { sqlServerName, sqlAmiName } = sqlConfiguration;
    const { databaseSize } = fsxConfiguration;
    const [sqlVersion] = calculateSQLandWindowsVersion(sqlAmiName);
    // TODO we can make describe image aws sdk call for sqlAmiName instead of UI sending it in payload as it is error prone
    let metrics = `${TRIGGERED_FROM}:${triggeredFrom},${INSTANCE_TYPE}:${workloadInstanceType},${SQL_VERSION}:${sqlVersion},${DATABASE_SIZE}:${databaseSize},${SQL_HOST_NAME}:${sqlServerName}`;

    try {
        const { permissions, strictPermissions, strictConditionPermissions } = await checkAllMissingPermissions(
            credentialsId,
            region
        );

        // if the simulatePrincipalPolicy is present, its operate user so can go through the deploying the stack if all other permissions are available
        if (permissions?.length || strictPermissions?.length || strictConditionPermissions?.length) {
            metrics += `,${DEPLOYED_FROM}:${AWSServiceNames.CLOUDFORMATION}`;
            const response = await createCloudFormationTemplateForUserDeployment(
                credentialsId,
                region,
                networkConfiguration,
                ec2Configuration,
                adConfiguration,
                fsxConfiguration,
                sqlConfiguration,
                topicArn,
                enableCloudWatch,
                metrics,
                tags
            );
            response.missingPermissions = MISSING_PERMISSIONS(permissions);
            return response;
        }
        metrics += `,${DEPLOYED_FROM}:${WLMDB}`;
        return await deployCloudFormationTemplate(
            credentialsId,
            region,
            networkConfiguration,
            ec2Configuration,
            adConfiguration,
            fsxConfiguration,
            sqlConfiguration,
            topicArn,
            enableCloudWatch,
            metrics,
            tags
        );
    } catch (err: any) {
        // missingPermissions throws exception if iam:SimulatePrincipalPolicy is not in permissions
        if (err?.message?.includes('iam:SimulatePrincipalPolicy')) {
            metrics += `,${DEPLOYED_FROM}:${AWSServiceNames.CLOUDFORMATION}`;
            const response = await createCloudFormationTemplateForUserDeployment(
                credentialsId,
                region,
                networkConfiguration,
                ec2Configuration,
                adConfiguration,
                fsxConfiguration,
                sqlConfiguration,
                topicArn,
                enableCloudWatch,
                metrics,
                tags
            );
            response.missingPermissions = MISSING_PERMISSIONS(err?.message);
            return response;
        }
        throw createError(
            err.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Error while deploying stack ${err}.`
        );
    }
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
    metrics: string,
    tags?: Array<{ key: string; value: string }>
): Promise<CloudFormationDeploymentResponseType> {
    logger.info('Create cloud formation template for user deployment', {
        credentialsId,
        region,
        networkConfiguration,
        ec2Configuration,
        adConfiguration,
        fsxConfiguration,
        sqlConfiguration,
        metrics,
        tags
    });

    const vpcValidationCheck: NetworkViolation = isNetworkConfigurationViolated(
        networkConfiguration,
        sqlConfiguration.sqlDeploymentMode
    );

    if (vpcValidationCheck.isViolated) {
        let errorMessage;
        if (vpcValidationCheck.violationMessage !== undefined) {
            errorMessage = vpcValidationCheck.violationMessage;
        } else if (sqlConfiguration.sqlDeploymentMode === STANDALONE) {
            errorMessage = STANDALONE_NETWORK_VIOLATION_MESSAGE;
        } else {
            errorMessage = FCI_NETWORK_VIOLATION_MESSAGE;
        }
        logger.error('VPC validation error:', errorMessage);
        throw createError(HttpErrorCodes.VALIDATION_ERROR, errorMessage);
    }

    const derivedParams = fsxConfiguration.fsxFileSystemId
        ? generateDeploymentParams(fsxConfiguration.databaseSize, true, sqlConfiguration.sqlDeploymentMode)
        : generateDeploymentParams(fsxConfiguration.databaseSize, false, sqlConfiguration.sqlDeploymentMode);

    const { roleName, providerAccountId } = await getRoleDetails(credentialsId);

    const customMasterTemplatePath: string = `${derivedParams.StackName}/${MASTER_TEMPLATE_PATH}`;

    const signedMasterTemplateUrl = await getPreSignedUrl(ASSETS_BUCKET_REGION, customMasterTemplatePath);

    const encodedSignedMasterTemplateURL = encodeURIComponent(signedMasterTemplateUrl);
    logger.info('Signed master url ', encodedSignedMasterTemplateURL);

    const validationAmiImage = await getWindowsServerBaseAmi(credentialsId, region);

    const accountId = getAsyncLocalStorageResource<string>(ACCOUNT_ID);
    const { token } = generateAuthToken({ email: 'SYSTEM@netapp.com' });

    const { awsAccountId } = derivePropertiesFromARN(process.env.AWS_ROLE_ARN as string) || {};

    const templateParamsAsList: Array<Parameter> = [
        { ParameterKey: CF_DEPLOY_ROLE_NAME, ParameterValue: roleName },
        { ParameterKey: VALIDATION_AMI, ParameterValue: validationAmiImage },
        { ParameterKey: TEMPLATE_ACCOUNT_ID, ParameterValue: accountId },
        { ParameterKey: TEMPLATE_CLOUD_PROVIDER_ID, ParameterValue: providerAccountId },
        { ParameterKey: TEMPLATE_CREDENTIALS_ID, ParameterValue: credentialsId },
        { ParameterKey: TEMPLATE_WLMDB_AWS_ACCOUT_ID, ParameterValue: awsAccountId },
        { ParameterKey: TEMPLATE_JWT_TOKEN, ParameterValue: token }
    ];
    let templateParams: string = `stackName=${derivedParams.StackName}&param_${CF_DEPLOY_ROLE_NAME}=${roleName}&param_${VALIDATION_AMI}=${validationAmiImage}&param_${TEMPLATE_ACCOUNT_ID}=${accountId}&param_${TEMPLATE_JWT_TOKEN}=${token}&param_${TEMPLATE_CREDENTIALS_ID}=${credentialsId}&param_${TEMPLATE_CLOUD_PROVIDER_ID}=${providerAccountId}&param_${TEMPLATE_WLMDB_AWS_ACCOUT_ID}=${awsAccountId}`;
    if (fsxConfiguration.fsxPassword) {
        const encryptedFsxPassword = await encryptString(fsxConfiguration.fsxPassword);
        if (encryptedFsxPassword) {
            templateParams += `&param_${TEMPLATE_FSX_PASSWORD}=${encodeURIComponent(encryptedFsxPassword)}`;
        }
    }

    Object.entries(derivedParams).forEach(([key, value]) => {
        if (key !== 'StackName') {
            templateParams += `&param_${key}=${value}`;
            templateParamsAsList.push({
                ParameterKey: key,
                ParameterValue: value.toString()
            });
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
        enableCloudWatch,
        metrics
    };

    Object.entries(clubbedParamList).forEach(([key, value]) => {
        if (TEMPLATE_CONFIGURATION_MAPPING[key]) {
            value = SKIP_TEMPLATE_PASSWORD_PARAMETERS.includes(TEMPLATE_CONFIGURATION_MAPPING[key]) ? '' : value;
            templateParams += `&param_${TEMPLATE_CONFIGURATION_MAPPING[key]}=${value}`;
            templateParamsAsList.push({
                ParameterKey: TEMPLATE_CONFIGURATION_MAPPING[key],
                ParameterValue: value.toString()
            });
        }
    });

    Object.entries(WLM_ASSETS).forEach(([key, value]) => {
        templateParams += `&param_${key}=${value}`;
        templateParamsAsList.push({
            ParameterKey: key,
            ParameterValue: value.toString()
        });
    });

    // Add Parameter construct - description, type and others. Default is added if user has specified a value or a value specified by default
    const templateParamsInCfFormat = await formatTemplateParametersToCf(templateParamsAsList);

    // Generate Signed-url and upload to bucket
    await uploadTemplates(
        ASSETS_BUCKET_REGION,
        DatabaseTypes.MS_SQL_SERVER,
        derivedParams.StackName,
        tags?.map(({ key, value }) => ({ Key: key, Value: value })),
        customMasterTemplatePath,
        templateParamsInCfFormat
    );

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
    metrics: string,
    tags?: Array<{ key: string; value: string }>
): Promise<{ cloudFormationStackId: string; cloudFormationUrl: string }> {
    logger.info('Deploy sql cloud formation template ', {
        credentialsId,
        region,
        networkConfiguration,
        ec2Configuration,
        adConfiguration,
        fsxConfiguration,
        sqlConfiguration,
        tags,
        metrics
    });

    const vpcValidationCheck: NetworkViolation = isNetworkConfigurationViolated(
        networkConfiguration,
        sqlConfiguration.sqlDeploymentMode
    );

    if (vpcValidationCheck.isViolated && vpcValidationCheck.violationMessage !== undefined) {
        const errorMessage = vpcValidationCheck.violationMessage;
        throw createError(HttpErrorCodes.VALIDATION_ERROR, errorMessage);
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
        metrics,
        credentialsId,
        region
    );

    logger.debug(`Stack ${stackName} parameters ${JSON.stringify(templateParameters)}.`);

    const customMasterTemplatePath: string = `${stackName}/${MASTER_TEMPLATE_PATH}`;

    const signedMasterTemplateUrl = await getPreSignedUrl(ASSETS_BUCKET_REGION, customMasterTemplatePath);

    logger.info('Signed master url ', signedMasterTemplateUrl);

    // Add Parameter construct - description, type and others. Default is added if user has specified a value or a value specified by default
    const templateParamsInCfFormat = await formatTemplateParametersToCf(templateParameters);

    // Generate Signed-url and upload to bucket
    await uploadTemplates(
        ASSETS_BUCKET_REGION,
        DatabaseTypes.MS_SQL_SERVER,
        stackName,
        tags?.map(({ key, value }) => ({ Key: key, Value: value })),
        customMasterTemplatePath,
        templateParamsInCfFormat
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

    // commented for now until we fix the queue issue of getting triggered multiple times for the same stack status
    // const notificationData = {
    //     notificationAction: STANDARD_DEPLOYMENT_ACTION,
    //     subject: SQL_DEPLOYMENET_INITIATED_SUBJECT,
    //     uiNotificationDescription: `Microsoft SQL Server and FSxN for ONTAP deployment with stack name ${stackName} has been initiated`,
    //     actionLabel: SQL_DEPLOYMENET_INITIATED_SUBJECT,
    //     redirectURL: '/',
    //     label: ACTION_BUTTON_DASHBOARD,
    //     priority: SUCCESS
    // };
    // await handleNotification(notificationData, { uiNotification: true, emailNotification: true });

    const cfUrl = deployedStackUrl(region, deployStackResponse.StackId!);
    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        const accountId: string = getAsyncLocalStorageResource(ACCOUNT_ID);
        const stackId = deployStackResponse.StackId || '';
        createDeploymentMockDataInDB(
            accountId,
            stackId,
            stackName,
            region,
            credentialsId,
            sqlConfiguration?.sqlDeploymentMode,
            fsxConfiguration?.fsxFileSystemId
        );
    }
    return { cloudFormationStackId: deployStackResponse.StackId!, cloudFormationUrl: cfUrl };
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
            },
            {
                ContextKeyName: IAM_LINKEDROLE_CONDITION,
                ContextKeyValues: [IAM_EC2_SERVICE],
                ContextKeyType: 'string'
            },
            {
                ContextKeyName: IAM_PASSROLE_CONDITION,
                ContextKeyValues: [IAM_EC2_SERVICE],
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
    sqlDeploymentMode: string,
    fsxFileSystemId: string | undefined
) {
    logger.info('create deployment, resource and job table mock data in database', {
        accountId,
        stackId,
        stackName,
        region,
        credentialId,
        sqlDeploymentMode,
        fsxFileSystemId
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
    const metadata: Metadata = {
        credentialsId: credentialId,
        sqlDeploymentType: sqlDeploymentMode as DEPLOYMENT_MODEL,
        fileSystemType: FileSystemTypes.FSXONTAP,
        activeNodeInstanceId: `i-${randomize('A0', 17)}`,
        activeNodeInstanceName: `sqlnode1-${randomize('0', 5)}`,
        creationDate: new Date().getTime().toString(),
        activeDirectoryName: 'wlm.com',
        activeDirectoryAddress: generateRandomIP()
    };

    if (sqlDeploymentMode === 'FCI') {
        metadata.standbyNodeInstanceId = `i-${randomize('A0', 17)}`;
        metadata.standbyNodeInstanceName = `sqlnode2-${randomize('0', 5)}`;
        metadata.activeDirectoryAddress = `${generateRandomIP()}, ${generateRandomIP()}`;
    }
    await createResource(accountId, {
        resourceId: randomUUID(),
        resourceName,
        cloudProviderAccountId: cloudProviderId,
        cloudProviderName: CloudProviders.AWS,
        resourceType: RESOURCESTYPE.MSSQL,
        coRelationId: `fs-${randomize('A0', 17)}`,
        region,
        metadata
    });

    const data = await createJobMockData(
        accountId,
        resourceName,
        stackName,
        sqlDeploymentMode,
        fsxFileSystemId,
        cloudProviderId,
        region
    );
    await createJobs(accountId, data);
}

export {
    createCloudFormationTemplateForUserDeployment,
    deployCloudFormationTemplate,
    deploymentStatus,
    deploymentStatusByName,
    getCloudformationTemplate,
    deployStackOrCreateTemplateURL
};
