import createError from 'http-errors';
import { ContextEntry, PolicyEvaluationDecisionType } from '@aws-sdk/client-iam';
import randomize from 'randomatic';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { escapeRegExp, isArray, isEmpty } from 'lodash-es';
import { Parameter } from '@aws-sdk/client-cloudformation';
import throat from 'throat';
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
    CLOUD_FORMATION_CLI_COMMAND,
    SKIP_TEMPLATE_PASSWORD_PARAMETERS,
    FSX_ADMIN_PASSWORD,
    SQL_SA_PASSWORD,
    DOMAIN_ADMIN_PASSWORD,
    STANDALONE,
    STANDALONE_NETWORK_VIOLATION_MESSAGE,
    FCI_NETWORK_VIOLATION_MESSAGE,
    TEMPLATE_FSX_PASSWORD,
    TEMPLATE_METRICS,
    TRIGGERED_FROM,
    DEPLOYED_FROM,
    WLMDB,
    AWSServiceNames,
    INSTANCE_TYPE,
    SQL_VERSION,
    DATABASE_SIZE,
    SQL_HOST_NAME,
    OPERATE,
    VIEW,
    MAP_SERVICE_TEMPLATE_PARAMETER,
    SIGNED_TEMPLATES_BUCKET_NAME,
    TEMPLATE_BUCKET_REGION,
    DEFAULT_AWS_REGION,
    VALIDATION_INSTANCE_TYPE,
    VALIDATION_NODE_INSTANCETYPE,
    BLOCKED_BY_SCP,
    IAM,
    SIMULATE_IAM_POLICY,
    TEMPLATE_S3GATEWAY_ROUTETABLES
} from '../utils/consts';
import {
    calculateSQLandWindowsVersion,
    deployedStackUrl,
    derivePropertiesFromARN,
    generateDeploymentParams,
    isNetworkConfigurationViolated,
    sleep
} from '../utils/utils';
import getLogger from '../utils/logger';
import { getRoleDetails } from './cloud-manager/credentials-operations';
import {
    getServicesWithNoEndpoint,
    getValidationNodeInstanceType,
    getWindowsServerBaseAmi,
    enableVpcDnsAttributes
} from './aws/ec2-operations';
import uploadTemplates from './template-operations';
import { isCfStackQuotaReached } from './aws/service-quotas-operations';
import { getAsyncLocalStorageResource } from '../utils/async-local-storage';
import { getAllDeploymentStatus, getDeploymentStatusByName } from './database/database-operations';
// import { handleNotification } from './cloud-manager/notification-operations';
import { MissingPermissionInterface, NetworkViolation } from '../utils/common-types';
import { encryptString } from './aws/kms-operations';
import PARAMETERS from '../utils/template-parameters';
import { getWlmdbPolicy, PolicyStatement } from '../lib/cloud-manager/wlmdb';
import { createDeploymentMockDataInDB, createFileSystemForDemo } from './demo-operations';

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

    const availabilityZones =
        sqlConfiguration.sqlDeploymentMode === STANDALONE
            ? [networkConfiguration.availabilityZone1!]
            : [networkConfiguration.availabilityZone1!, networkConfiguration.availabilityZone2!];
    const validationNodeInstanceType =
        credentialsId && region
            ? await getValidationNodeInstanceType(credentialsId!, region, availabilityZones)
            : VALIDATION_NODE_INSTANCETYPE.T2MICRO;

    const accountId = getAsyncLocalStorageResource<string>(ACCOUNT_ID);
    const { token } = generateAuthToken({ user: 'SYSTEM@netapp.com' });

    const { awsAccountId } = derivePropertiesFromARN(process.env.AWS_ROLE_ARN as string) || {};

    const routeTables =
        sqlConfiguration.sqlDeploymentMode === STANDALONE
            ? [networkConfiguration.routeTable1Id!]
            : [networkConfiguration.routeTable1Id!, networkConfiguration.routeTable2Id!];
    const { servicesWithNoEndpoint, missingRoutesInS3 } =
        credentialsId && region
            ? await getServicesWithNoEndpoint(credentialsId, region, networkConfiguration.vpcId, routeTables)
            : { servicesWithNoEndpoint: [], missingRoutesInS3: [] };

    const templateParams: Array<Parameter> = [
        { ParameterKey: CF_DEPLOY_ROLE_NAME, ParameterValue: roleName },
        { ParameterKey: VALIDATION_AMI, ParameterValue: validationAmiImage },
        { ParameterKey: VALIDATION_INSTANCE_TYPE, ParameterValue: validationNodeInstanceType },
        { ParameterKey: TEMPLATE_ACCOUNT_ID, ParameterValue: accountId },
        { ParameterKey: TEMPLATE_CLOUD_PROVIDER_ID, ParameterValue: providerAccountId },
        { ParameterKey: TEMPLATE_CREDENTIALS_ID, ParameterValue: credentialsId },
        { ParameterKey: TEMPLATE_WLMDB_AWS_ACCOUT_ID, ParameterValue: awsAccountId },
        { ParameterKey: TEMPLATE_JWT_TOKEN, ParameterValue: token },
        { ParameterKey: TEMPLATE_METRICS, ParameterValue: metrics },
        { ParameterKey: TEMPLATE_S3GATEWAY_ROUTETABLES, ParameterValue: missingRoutesInS3.toString() }
    ];

    if (fsxConfiguration.fsxPassword) {
        try {
            const encryptedFsxPassword = await encryptString(fsxConfiguration.fsxPassword);
            if (encryptedFsxPassword) {
                templateParams.push({ ParameterKey: TEMPLATE_FSX_PASSWORD, ParameterValue: encryptedFsxPassword });
            }
        } catch (error) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Error while encrypting password ${error}.`);
        }
    }

    Object.entries(MAP_SERVICE_TEMPLATE_PARAMETER).forEach(([key, value]) => {
        if (!servicesWithNoEndpoint.includes(key)) {
            templateParams.push({
                ParameterKey: value,
                ParameterValue: 'true'
            });
        }
    });

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

    region = !isEmpty(region) ? region : DEFAULT_AWS_REGION;

    const customMasterTemplatePath: string = `${WLMDB}/${stackName}/${MASTER_TEMPLATE_PATH}`;

    const signedMasterTemplateUrl = await getPreSignedUrl(
        TEMPLATE_BUCKET_REGION,
        SIGNED_TEMPLATES_BUCKET_NAME,
        customMasterTemplatePath
    );

    logger.info('Signed master url ', signedMasterTemplateUrl);

    // Add Parameter construct - description, type and others. Default is added if user has specified a value or a value specified by default
    const templateParamsInCfFormat = await formatTemplateParametersToCf(templateParameters);

    // Generate Signed-url and upload to bucket
    await uploadTemplates(
        region!,
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
        const response = await getObjectBucket(
            TEMPLATE_BUCKET_REGION,
            SIGNED_TEMPLATES_BUCKET_NAME,
            customMasterTemplatePath
        );
        masterTemplateContents = await response.Body?.transformToString();
    }

    // Generate parameters list for cli command
    const specialCharacters = ['!', '&'];
    let cliParams: string = '';
    templateParameters.forEach(e => {
        if (e.ParameterKey === FSX_ADMIN_PASSWORD) {
            cliParams += `ParameterKey="${e.ParameterKey}",ParameterValue="${escapeRegExp(
                fsxConfiguration.fsxPassword
            ).replace(new RegExp(`[${specialCharacters.join('')}]`, 'g'), '\\$&')}" `;
        } else if (e.ParameterKey === SQL_SA_PASSWORD) {
            cliParams += `ParameterKey="${e.ParameterKey}",ParameterValue="${escapeRegExp(
                sqlConfiguration.serviceAccountPassword
            ).replace(new RegExp(`[${specialCharacters.join('')}]`, 'g'), '\\$&')}" `;
        } else if (e.ParameterKey === DOMAIN_ADMIN_PASSWORD) {
            cliParams += `ParameterKey="${e.ParameterKey}",ParameterValue="${escapeRegExp(
                adConfiguration.domainPassword
            ).replace(new RegExp(`[${specialCharacters.join('')}]`, 'g'), '\\$&')}" `;
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
        const { permissions } = await checkAllMissingPermissions(credentialsId, region, OPERATE);

        // if the simulatePrincipalPolicy is present, its operate user so can go through the deploying the stack if all other permissions are available
        if (
            permissions.missingStatements.length ||
            permissions.blockedByOrganisation.length ||
            permissions.blockedByPermissionBoundary.length
        ) {
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
            const errMsg = MISSING_PERMISSIONS(
                permissions.missingStatements,
                permissions.blockedByOrganisation,
                permissions.blockedByPermissionBoundary
            );

            const responseWithPermissions: CloudFormationDeploymentResponseType = {
                ...response,
                missingPermissions: {
                    missingStatements: permissions.missingStatements || [],
                    blockedByOrganisation: permissions.blockedByOrganisation || [],
                    blockedByPermissionBoundary: permissions.blockedByPermissionBoundary || []
                }
            };

            logger.error(errMsg);
            return responseWithPermissions;
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

            let blockedBySCP = false;
            if (err?.message?.includes('deny in a service control policy')) {
                blockedBySCP = true;
            }

            const errMsg = MISSING_PERMISSIONS(err?.message, [], []);
            const responseWithPermissions: CloudFormationDeploymentResponseType = {
                ...response,
                missingPermissions: {
                    missingStatements: !blockedBySCP
                        ? [
                              {
                                  service: IAM,
                                  action: SIMULATE_IAM_POLICY,
                                  error: PolicyEvaluationDecisionType.EXPLICIT_DENY
                              }
                          ]
                        : [],
                    blockedByOrganisation: blockedBySCP
                        ? [{ service: IAM, action: SIMULATE_IAM_POLICY, error: BLOCKED_BY_SCP }]
                        : [],
                    blockedByPermissionBoundary: []
                }
            };
            logger.error(errMsg);
            return responseWithPermissions;
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
) {
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

    const customMasterTemplatePath: string = `${WLMDB}/${derivedParams.StackName}/${MASTER_TEMPLATE_PATH}`;

    const signedMasterTemplateUrl = await getPreSignedUrl(
        TEMPLATE_BUCKET_REGION,
        SIGNED_TEMPLATES_BUCKET_NAME,
        customMasterTemplatePath
    );

    const encodedSignedMasterTemplateURL = encodeURIComponent(signedMasterTemplateUrl);
    logger.info('Signed master url ', encodedSignedMasterTemplateURL);

    const validationAmiImage = await getWindowsServerBaseAmi(credentialsId, region);
    const availabilityZones =
        sqlConfiguration.sqlDeploymentMode === STANDALONE
            ? [networkConfiguration.availabilityZone1!]
            : [networkConfiguration.availabilityZone1!, networkConfiguration.availabilityZone2!];
    const validationNodeInstanceType = await getValidationNodeInstanceType(credentialsId!, region!, availabilityZones);

    const accountId = getAsyncLocalStorageResource<string>(ACCOUNT_ID);
    const { token } = generateAuthToken({ email: 'SYSTEM@netapp.com' });

    const { awsAccountId } = derivePropertiesFromARN(process.env.AWS_ROLE_ARN as string) || {};

    const routeTables =
        sqlConfiguration.sqlDeploymentMode === STANDALONE
            ? [networkConfiguration.routeTable1Id!]
            : [networkConfiguration.routeTable1Id!, networkConfiguration.routeTable2Id!];
    const { servicesWithNoEndpoint, missingRoutesInS3 } =
        credentialsId && region
            ? await getServicesWithNoEndpoint(credentialsId, region, networkConfiguration.vpcId, routeTables)
            : { servicesWithNoEndpoint: [], missingRoutesInS3: [] };

    const templateParamsAsList: Array<Parameter> = [
        { ParameterKey: CF_DEPLOY_ROLE_NAME, ParameterValue: roleName },
        { ParameterKey: VALIDATION_AMI, ParameterValue: validationAmiImage },
        { ParameterKey: VALIDATION_INSTANCE_TYPE, ParameterValue: validationNodeInstanceType },
        { ParameterKey: TEMPLATE_ACCOUNT_ID, ParameterValue: accountId },
        { ParameterKey: TEMPLATE_CLOUD_PROVIDER_ID, ParameterValue: providerAccountId },
        { ParameterKey: TEMPLATE_CREDENTIALS_ID, ParameterValue: credentialsId },
        { ParameterKey: TEMPLATE_WLMDB_AWS_ACCOUT_ID, ParameterValue: awsAccountId },
        { ParameterKey: TEMPLATE_JWT_TOKEN, ParameterValue: token },
        { ParameterKey: TEMPLATE_S3GATEWAY_ROUTETABLES, ParameterValue: missingRoutesInS3.toString() }
    ];
    let templateParams: string = `stackName=${derivedParams.StackName}&param_${CF_DEPLOY_ROLE_NAME}=${roleName}&param_${VALIDATION_AMI}=${validationAmiImage}&param_${VALIDATION_INSTANCE_TYPE}=${validationNodeInstanceType}&param_${TEMPLATE_ACCOUNT_ID}=${accountId}&param_${TEMPLATE_JWT_TOKEN}=${token}&param_${TEMPLATE_CREDENTIALS_ID}=${credentialsId}&param_${TEMPLATE_CLOUD_PROVIDER_ID}=${providerAccountId}&param_${TEMPLATE_WLMDB_AWS_ACCOUT_ID}=${awsAccountId}`;
    if (fsxConfiguration.fsxPassword) {
        try {
            const encryptedFsxPassword = await encryptString(fsxConfiguration.fsxPassword);
            if (encryptedFsxPassword) {
                templateParams += `&param_${TEMPLATE_FSX_PASSWORD}=${encodeURIComponent(encryptedFsxPassword)}`;
            }
        } catch (error) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Error while encrypting password ${error}.`);
        }
    }

    Object.entries(MAP_SERVICE_TEMPLATE_PARAMETER).forEach(([key, value]) => {
        if (!servicesWithNoEndpoint.includes(key)) {
            templateParams += `&param_${value}='true'`;
        }
    });

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
        region!,
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

    // Set EnableDnsSupport and EnableDnsHostnames to true
    try {
        await enableVpcDnsAttributes(credentialsId, region, networkConfiguration.vpcId);
    } catch (error) {
        logger.error(
            'Error while setting "EnableDnsSupport" and "EnableDnsHostnames" to true for vpc',
            networkConfiguration.vpcId,
            error
        );
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

    const customMasterTemplatePath: string = `${WLMDB}/${stackName}/${MASTER_TEMPLATE_PATH}`;

    const signedMasterTemplateUrl = await getPreSignedUrl(
        TEMPLATE_BUCKET_REGION,
        SIGNED_TEMPLATES_BUCKET_NAME,
        customMasterTemplatePath
    );

    logger.info('Signed master url ', signedMasterTemplateUrl);

    // Add Parameter construct - description, type and others. Default is added if user has specified a value or a value specified by default
    const templateParamsInCfFormat = await formatTemplateParametersToCf(templateParameters);

    // Generate Signed-url and upload to bucket
    await uploadTemplates(
        region,
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
        const awsAccountId = randomize('0', 8);
        createDeploymentMockDataInDB(
            accountId,
            stackId,
            stackName,
            region,
            credentialsId,
            sqlConfiguration?.sqlDeploymentMode,
            fsxConfiguration?.fsxFileSystemId,
            awsAccountId,
            sqlConfiguration?.sqlServerName
        );
        if (!fsxConfiguration.fsxFileSystemId) {
            // create a new fsx record in fsx inventory
            createFileSystemForDemo(credentialsId, region, fsxConfiguration);
        }
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

function prepareResourceActionMap(statements: [PolicyStatement]) {
    logger.debug('Preparing resource action map', { statements });

    const resourcePolicyActions: {
        resourceArn: string[];
        resourceActions: string[];
        resourceConditions: ContextEntry[];
    }[] = [];
    statements.forEach(({ Resource, Action, Condition }) => {
        const actionMap = [];
        if (isArray(Action)) {
            actionMap.push(...Action);
        } else {
            actionMap.push(Action);
        }
        const resourceConditions: ContextEntry[] = [];

        if (!isEmpty(Condition)) {
            Object.entries(Condition).forEach(obj => {
                const [key, value] = obj;
                if (key === 'StringLike' || key === 'StringEquals') {
                    // TODO : revisit this implementation when the WLMDB policy has Conditions supporting Numeric/Boolean datatypes
                    Object.entries(value).forEach(([conditionKey, conditionValue]) =>
                        resourceConditions.push({
                            ContextKeyName: conditionKey,
                            ContextKeyValues: [conditionValue],
                            ContextKeyType: 'string'
                        })
                    );
                }
            });
        }

        resourcePolicyActions.push({
            resourceArn: isArray(Resource) ? Resource : [Resource],
            resourceActions: actionMap,
            resourceConditions
        });
    });

    return resourcePolicyActions;
}

async function checkAllMissingPermissions(credentialsId: string, region: string, action: string = VIEW) {
    logger.info('Check all missing permissions', { credentialsId, region, action });
    // checking the permissions for three different times to find out with different conditions like resource arn, conditions & resource set to *
    let policyResourceActions;
    const { operate, view } = await getWlmdbPolicy();
    if (action === OPERATE) {
        policyResourceActions = prepareResourceActionMap(operate.Statement);
    } else {
        policyResourceActions = prepareResourceActionMap(view.Statement);
    }

    const missedPermissions: MissingPermissionInterface = {
        missingStatements: [],
        blockedByOrganisation: [],
        blockedByPermissionBoundary: []
    };

    await Promise.all(
        // 'throat' is used to limit the number of concurrent requests
        // Limit of 3 is tested for 10 requests, 4 sometimes throws - rate execeeded error
        // 07-03-2024: throttling to 1, as the issue is continuously being hit
        policyResourceActions.map(
            throat(1, async ({ resourceArn, resourceActions, resourceConditions }) => {
                try {
                    const { missingPermissions, blockedByOrganisation, blockedByPermissionBoundary } =
                        await getMissingPermissionsList(
                            credentialsId,
                            region,
                            resourceActions,
                            resourceArn,
                            resourceConditions
                        );
                    if (missingPermissions.length > 0) {
                        missedPermissions.missingStatements.push(...missingPermissions);
                    }
                    if (blockedByOrganisation.length > 0) {
                        missedPermissions.blockedByOrganisation.push(...blockedByOrganisation);
                    }
                    if (blockedByPermissionBoundary.length > 0) {
                        missedPermissions.blockedByPermissionBoundary.push(...blockedByPermissionBoundary);
                    }
                } catch (error) {
                    throw createError(
                        HttpErrorCodes.INTERNAL_SERVER_ERROR,
                        `Error while checking permissions ${error}.`
                    );
                }
            })
        )
    );

    return { permissions: missedPermissions };
}

export {
    createCloudFormationTemplateForUserDeployment,
    deployCloudFormationTemplate,
    deploymentStatus,
    deploymentStatusByName,
    getCloudformationTemplate,
    deployStackOrCreateTemplateURL,
    checkAllMissingPermissions
};
