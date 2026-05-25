import createError from 'http-errors';
import { ContextEntry } from '@aws-sdk/client-iam';
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
    CloudFormationStaticTemplateResponseType,
    PgSqlConfigurationType,
    TerraformSetupResponseType
} from '../routes/types/deployment.types';
import {
    MISSING_PERMISSIONS,
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
    IAM,
    SIMULATE_IAM_POLICY,
    TEMPLATE_S3GATEWAY_ROUTETABLES,
    FSX_VOL_THROUGHPUT,
    FSX_IOPS,
    DATABASE_MIN_LUN_SIZE_IN_GIB,
    DATABASE_MAX_LUN_SIZE_IN_GIB,
    TEMPLATE_USERNAME_MAPPING,
    PERMISSION_DENIAL_POSSIBLE_REASONS,
    STORAGE_PROTOCOLS,
    EBS_VOLUME_SIZE,
    EBS_DEFAULT_VOLUME_SIZE,
    TEMPLATE_PRIVATESUBNET1_CIDRBLOCK,
    TEMPLATE_PRIVATESUBNET2_CIDRBLOCK,
    PG_TEMPLATE_CONFIG_MAPPING,
    PG_TEMPLATE_OPTIONAL_PARAMETERS,
    PGSQL_VERSION,
    AuditStatus,
    FCI,
    PGSQL_MASTER_TEMPLATE_PATH,
    AL2023_AMI_NAME,
    CF_QUOTA_REACHED,
    HA,
    AMAZON_LINUX_AMI_PATH,
    GOV_ACCOUNT
} from '../utils/consts';
import {
    calculateSQLandWindowsVersion,
    deployedStackUrl,
    derivePropertiesFromARN,
    generateDeploymentParams,
    isNetworkConfigurationViolated,
    sleep,
    splitDomainUsername,
    getCollationForMSSQLVersion,
    filterActions,
    IS_DEMO_FLOW,
    getCloudFormationStackUrl
} from '../utils/utils';
import getLogger from '../utils/logger';
import { getRoleDetails } from './cloud-manager/credentials-operations';
import { validateVpcEndpoints, enableVpcDnsAttributes } from './aws/ec2-operations';
import { uploadTemplates } from './template-operations';
import { getAsyncLocalStorageResource } from '../utils/async-local-storage';
import { getAllDeploymentStatus, getDeploymentStatusByName } from './database/database-operations';
// import { handleNotification } from './cloud-manager/notification-operations';
import { MissingPermissionInterface, NetworkViolation } from '../utils/common-types';
import { encryptString } from './aws/kms-operations';
import getConfigParameters from '../utils/template-parameters';
import { getWlmdbPolicy, PolicyStatement } from '../lib/cloud-manager/wlmdb';
import { validateSsmArnFormat, SSM_ARN_PATTERN } from '../utils/ssm-arn-validator';
import {
    createDeploymentMockDataInDB,
    createFileSystemForDemo,
    createDeploymentMockDataInDBForPgSql
} from './demo-operations';
import { describeSubnets, getAmis } from '../lib/aws/ec2';
import { updateLongRunningAuditGroup } from './cloud-manager/audit-operations';
import {
    createAndUploadTheTerraformZipFile,
    uploadTerraformModules,
    createTFVarsFile,
    createRootModuleFile
} from './terraform-operations';
import { getParameter, getParametersByPath } from '../lib/aws/ssm';
import { isCfStackQuotaReached } from './aws/service-quotas-operations';
import { validateSvmCountCapacity } from './aws/fsx-operations';
import { createDemoResourcesPerRegion } from '../utils/demo-utils/demoDefaultUtils';

const logger = getLogger();
const { getPreSignedUrl } = preSignedUrl;

interface InitializationScript {
    name: string;
    url: string;
}

async function endpointsValidationResults(
    credentialsId: string,
    region: string,
    networkConfiguration: CFNetworkConfigurationType,
    deploymentMode: string,
    privateSubnet1Cidr: string,
    privateSubnet2Cidr: string
) {
    logger.info('Fetch VPC endpoints results', credentialsId, region);
    const { vpcId = '', vpcCidr = '', routeTable1Id = '', routeTable2Id = '' } = networkConfiguration;
    const subnetDetails = [
        {
            subnetId: networkConfiguration.privateSubnet1Id,
            cidr: privateSubnet1Cidr,
            routeTableId: routeTable1Id
        },
        ...(deploymentMode === FCI && networkConfiguration.privateSubnet2Id
            ? [
                  {
                      subnetId: networkConfiguration.privateSubnet2Id,
                      cidr: privateSubnet2Cidr,
                      routeTableId: routeTable2Id
                  }
              ]
            : [])
    ];
    const { servicesWithNoEndpoint = [], missingRoutesInS3 = [] } =
        credentialsId && region
            ? await validateVpcEndpoints(
                  credentialsId,
                  region,
                  { vpcId, vpcCidr },

                  subnetDetails
              )
            : {};
    return {
        servicesWithNoEndpoint,
        missingRoutesInS3
    };
}

async function getSubnetsCidr(
    credentialsId: string,
    region: string,
    networkConfiguration: CFNetworkConfigurationType,
    sqlDeploymentMode: string
) {
    logger.info('Fetch cidr block for subnets', credentialsId, region);

    if (
        isEmpty(networkConfiguration.privateSubnet1Id) ||
        (sqlDeploymentMode === FCI && isEmpty(networkConfiguration.privateSubnet2Id))
    ) {
        return { privateSubnet1Cidr: '', privateSubnet2Cidr: '' };
    }

    const subnetIds =
        sqlDeploymentMode === STANDALONE
            ? [networkConfiguration.privateSubnet1Id!]
            : [networkConfiguration.privateSubnet1Id!, networkConfiguration.privateSubnet2Id!];
    const { Subnets } = await describeSubnets(credentialsId!, region!, { SubnetIds: subnetIds });
    const subnetCidrs = Subnets?.map(({ SubnetId: subnetId, CidrBlock: cidrBlock }) => ({ subnetId, cidrBlock }));
    const [privateSubnet1Cidr = ''] =
        subnetCidrs
            ?.filter(subnet => subnet.subnetId === networkConfiguration.privateSubnet1Id)
            .map(subnet => subnet.cidrBlock) ?? [];
    const [privateSubnet2Cidr = ''] =
        subnetCidrs
            ?.filter(subnet => subnet.subnetId === networkConfiguration.privateSubnet2Id)
            .map(subnet => subnet.cidrBlock) ?? [];

    if (isEmpty(privateSubnet1Cidr)) {
        const errorMessage = `Failed to determine CIDR block for subnet ${networkConfiguration.privateSubnet1Id}`;
        logger.error(errorMessage, {
            credentialsId,
            region,
            subnetId: networkConfiguration.privateSubnet1Id
        });
        throw createError(HttpErrorCodes.VALIDATION_ERROR, errorMessage);
    }

    if (sqlDeploymentMode === FCI && !isEmpty(networkConfiguration.privateSubnet2Id) && isEmpty(privateSubnet2Cidr)) {
        const errorMessage = `Failed to determine CIDR block for subnet ${networkConfiguration.privateSubnet2Id}`;
        logger.error(errorMessage, {
            credentialsId,
            region,
            subnetId: networkConfiguration.privateSubnet2Id
        });
        throw createError(HttpErrorCodes.VALIDATION_ERROR, errorMessage);
    }
    return { privateSubnet1Cidr, privateSubnet2Cidr };
}

async function readSsmCredential(credentialsId: string, region: string, ssmParameterArn: string, configName: string) {
    validateSsmArnFormat(ssmParameterArn, configName, region);

    const arnParts = ssmParameterArn.match(SSM_ARN_PATTERN);
    if (!arnParts) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            `Invalid SSM parameter ARN format for ${configName}: ${ssmParameterArn}`
        );
    }
    const parameterName = `/${arnParts[4]}`;
    const paramValue = await getParameter(credentialsId, region, parameterName);
    if (!paramValue) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            `SSM parameter not found or not readable for ${configName}: ${parameterName}. Ensure the parameter exists and the credentials have access.`
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any;
    try {
        parsed = JSON.parse(paramValue);
    } catch {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            `SSM parameter value is not valid JSON for ${configName}: ${parameterName}`
        );
    }

    const creds = extractCredentials(parsed, configName);
    return creds;
}

/**
 * Extracts username/password from SSM parameter JSON.
 * Supports the nested format used by commercial registration (e.g. { fsx: { username, password } })
 * and flat format ({ username, password }).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCredentials(parsed: any, configName: string): { username: string; password: string } {
    if (parsed.username && parsed.password) {
        return { username: parsed.username, password: parsed.password };
    }

    if (configName === 'fsxConfiguration' && parsed.fsx?.username && parsed.fsx?.password) {
        return { username: parsed.fsx.username, password: parsed.fsx.password };
    }

    if (configName === 'adConfiguration') {
        const domain = Array.isArray(parsed.domain) ? parsed.domain[0] : parsed.domain;
        if (domain?.username && domain?.password) {
            return { username: domain.username, password: domain.password };
        }
    }

    if (configName === 'sqlConfiguration') {
        const sql = Array.isArray(parsed.sql) ? parsed.sql[0] : parsed.sql;
        if (sql?.username && sql?.password) {
            return { username: sql.username, password: sql.password };
        }
        const pgsql = Array.isArray(parsed.pgsql) ? parsed.pgsql[0] : parsed.pgsql;
        if (pgsql?.username && pgsql?.password) {
            return { username: pgsql.username, password: pgsql.password };
        }
    }

    throw createError(
        HttpErrorCodes.BAD_REQUEST,
        `SSM parameter for ${configName} must contain credentials in one of these formats: ` +
            '{ "username": "...", "password": "..." } or nested format matching the credential type ' +
            '(e.g. { "fsx": { "username": "...", "password": "..." } }).'
    );
}

async function resolveGovCloudDeploymentCredentials(
    credentialsId: string,
    region: string,
    adConfiguration?: ADConfigurationType,
    fsxConfiguration?: FSXConfigurationType,
    sqlConfiguration?: SQLConfigurationType | PgSqlConfigurationType
) {
    logger.info('Resolving GovCloud deployment credentials from per-config SSM parameters', { credentialsId, region });

    if (fsxConfiguration?.ssmParameterArn) {
        const creds = await readSsmCredential(
            credentialsId,
            region,
            fsxConfiguration.ssmParameterArn,
            'fsxConfiguration'
        );
        fsxConfiguration.fsxUsername = creds.username || fsxConfiguration.fsxUsername;
        fsxConfiguration.fsxPassword = creds.password;
    }

    if (adConfiguration?.ssmParameterArn) {
        const creds = await readSsmCredential(
            credentialsId,
            region,
            adConfiguration.ssmParameterArn,
            'adConfiguration'
        );
        adConfiguration.domainUsername = creds.username || adConfiguration.domainUsername;
        adConfiguration.domainPassword = creds.password;
    }

    if (sqlConfiguration?.ssmParameterArn) {
        const creds = await readSsmCredential(
            credentialsId,
            region,
            sqlConfiguration.ssmParameterArn,
            'sqlConfiguration'
        );
        sqlConfiguration.serviceAccountPassword = creds.password;
        if ('serviceAccountName' in sqlConfiguration) {
            (sqlConfiguration as SQLConfigurationType).serviceAccountName =
                creds.username || (sqlConfiguration as SQLConfigurationType).serviceAccountName;
        }
    }

    logger.info('GovCloud deployment credentials resolved successfully');
}

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
    const derivedParams = generateDeploymentParams(
        DatabaseTypes.MS_SQL_SERVER,
        fsxConfiguration.databaseSize,
        Boolean(fsxConfiguration.fsxFileSystemId),
        sqlConfiguration.sqlDeploymentMode,
        fsxConfiguration.fsxVolThroughput,
        fsxConfiguration.fsxIOPS
    );

    const { roleName = '', providerAccountId = '' } = credentialsId
        ? await getRoleDetails(credentialsId)
        : { roleName: '', providerAccountId: '' };

    const stackName = derivedParams.StackName;
    const validationAmiImage = sqlConfiguration.sqlAmiId;

    const accountId = getAsyncLocalStorageResource<string>(ACCOUNT_ID);
    const { token } = generateAuthToken({ user: 'SYSTEM@netapp.com' });

    const { awsAccountId } = derivePropertiesFromARN(process.env.AWS_ROLE_ARN as string) || {};

    const { privateSubnet1Cidr, privateSubnet2Cidr } =
        credentialsId && region
            ? await getSubnetsCidr(credentialsId!, region!, networkConfiguration, sqlConfiguration.sqlDeploymentMode)
            : { privateSubnet1Cidr: '', privateSubnet2Cidr: '' };

    const { servicesWithNoEndpoint = [], missingRoutesInS3 = [] } =
        credentialsId && region
            ? await endpointsValidationResults(
                  credentialsId,
                  region,
                  networkConfiguration,
                  sqlConfiguration.sqlDeploymentMode,
                  privateSubnet1Cidr,
                  privateSubnet2Cidr
              )
            : {};

    const templateParams: Array<Parameter> = [
        { ParameterKey: CF_DEPLOY_ROLE_NAME, ParameterValue: roleName },
        { ParameterKey: VALIDATION_AMI, ParameterValue: validationAmiImage },
        { ParameterKey: VALIDATION_INSTANCE_TYPE, ParameterValue: VALIDATION_NODE_INSTANCETYPE },
        { ParameterKey: TEMPLATE_ACCOUNT_ID, ParameterValue: accountId },
        { ParameterKey: TEMPLATE_CLOUD_PROVIDER_ID, ParameterValue: providerAccountId },
        { ParameterKey: TEMPLATE_CREDENTIALS_ID, ParameterValue: credentialsId },
        { ParameterKey: TEMPLATE_WLMDB_AWS_ACCOUT_ID, ParameterValue: awsAccountId },
        { ParameterKey: TEMPLATE_JWT_TOKEN, ParameterValue: token },
        { ParameterKey: TEMPLATE_METRICS, ParameterValue: metrics },
        { ParameterKey: TEMPLATE_S3GATEWAY_ROUTETABLES, ParameterValue: missingRoutesInS3.toString() },
        { ParameterKey: TEMPLATE_PRIVATESUBNET1_CIDRBLOCK, ParameterValue: privateSubnet1Cidr },
        { ParameterKey: TEMPLATE_PRIVATESUBNET2_CIDRBLOCK, ParameterValue: privateSubnet2Cidr }
    ];

    if (fsxConfiguration.fsxPassword) {
        try {
            const encryptedFsxPassword = await encryptString(fsxConfiguration.fsxPassword);
            if (encryptedFsxPassword) {
                templateParams.push({
                    ParameterKey: TEMPLATE_FSX_PASSWORD,
                    ParameterValue: encryptedFsxPassword
                });
            }
        } catch (error) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Error while encrypting password ${error}.`);
        }
    }

    // Get the volume size of an ami.. Set to minimum value of 100 if its lesser than that
    let amiSize = EBS_DEFAULT_VOLUME_SIZE; // to accomodate guest user when credentials or region could be empty
    if (credentialsId && region && sqlConfiguration.sqlAmiId) {
        const {
            Images: [
                {
                    BlockDeviceMappings: [
                        { Ebs: { VolumeSize: amiVolumeSize = EBS_DEFAULT_VOLUME_SIZE } = {} } = {}
                    ] = []
                } = {}
            ] = []
        } = (await getAmis(credentialsId as string, region as string, { ImageIds: [sqlConfiguration.sqlAmiId] })) || [];

        amiSize = Math.max(amiVolumeSize, EBS_DEFAULT_VOLUME_SIZE);
    }
    templateParams.push({ ParameterKey: EBS_VOLUME_SIZE, ParameterValue: amiSize.toString() });

    Object.entries(MAP_SERVICE_TEMPLATE_PARAMETER).forEach(([key, value]) => {
        templateParams.push({
            ParameterKey: value,
            ParameterValue: servicesWithNoEndpoint.includes(key) ? 'false' : 'true'
        });
    });

    Object.entries(derivedParams).forEach(([key, value]) => {
        if (key !== 'StackName') {
            templateParams.push({
                ParameterKey: key,
                ParameterValue: value.toString()
            });
        }
    });

    const adUsernameDetails = splitDomainUsername(adConfiguration.domainUsername || '');
    const fsxUsernameDetails = splitDomainUsername(fsxConfiguration.fsxUsername || '');
    const sqlUsernameDetails = splitDomainUsername(sqlConfiguration.serviceAccountName || '');
    templateParams.push(
        {
            ParameterKey: TEMPLATE_USERNAME_MAPPING.DomainAdminUser,
            ParameterValue: adUsernameDetails?.username || adConfiguration.domainUsername || ''
        },
        {
            ParameterKey: TEMPLATE_USERNAME_MAPPING.FSxAdminUsername,
            ParameterValue: fsxUsernameDetails?.username || fsxConfiguration.fsxUsername || ''
        },
        {
            ParameterKey: TEMPLATE_USERNAME_MAPPING.SQLServiceAccountName,
            ParameterValue: sqlUsernameDetails?.username || sqlConfiguration.serviceAccountName
        }
    );

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

async function formatTemplateParametersToCf(
    templateParameters: Parameter[],
    databaseType: DatabaseTypes.MS_SQL_SERVER | DatabaseTypes.PG_SQL = DatabaseTypes.MS_SQL_SERVER
) {
    logger.info('Add parameters to template in cloud formation format');
    const parameters = {};
    const PARAMETERS = getConfigParameters(databaseType);
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

    if (
        credentialsId &&
        region &&
        (fsxConfiguration.ssmParameterArn || adConfiguration.ssmParameterArn || sqlConfiguration.ssmParameterArn)
    ) {
        await resolveGovCloudDeploymentCredentials(
            credentialsId,
            region,
            adConfiguration,
            fsxConfiguration,
            sqlConfiguration
        );
    }

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
    if (IS_DEMO_FLOW) {
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
            let paramValue = e.ParameterValue;
            if (Array.isArray(e.ParameterValue)) {
                paramValue = e.ParameterValue.join(',');
            }
            cliParams += `ParameterKey="${e.ParameterKey}",ParameterValue="${paramValue?.toString()}" `;
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

    const signedTemplateURL = `${getCloudFormationStackUrl()}?region=${
        region || undefined // explicitly needs to be send if the region is empty string -- cloudformation would not take an empty string
    }#/stacks/create/review?templateURL=${encodeURIComponent(signedMasterTemplateUrl)}&${urlParams}`;

    return {
        url: signedTemplateURL,
        template: masterTemplateContents || '',
        cliCommand: cloudFormationCli
    };
}

async function getPgSqlCfTemplate(
    networkConfiguration: CFNetworkConfigurationType,
    ec2Configuration: EC2ConfigurationType,
    fsxConfiguration: FSXConfigurationType,
    sqlConfiguration: PgSqlConfigurationType,
    topicArn: string = '',
    enableCloudWatch: boolean = false,
    triggeredFrom: string,
    tags?: Array<{ key: string; value: string }>,
    credentialsId?: string,
    region?: string
): Promise<CloudFormationStaticTemplateResponseType> {
    logger.info('PGSQL Cloud formation template ', {
        credentialsId,
        region,
        networkConfiguration,
        ec2Configuration,
        fsxConfiguration,
        sqlConfiguration,
        triggeredFrom,
        tags
    });

    if (credentialsId && region && (fsxConfiguration.ssmParameterArn || sqlConfiguration.ssmParameterArn)) {
        await resolveGovCloudDeploymentCredentials(
            credentialsId,
            region,
            undefined,
            fsxConfiguration,
            sqlConfiguration
        );
    }

    const { workloadInstanceType } = ec2Configuration;
    const { sqlServerName, sqlVersion } = sqlConfiguration;
    const { databaseSize } = fsxConfiguration;

    const amazonLinuxAmis = await getParametersByPath(credentialsId, region, '/aws/service/ami-amazon-linux-latest');
    const al2023AmiId = amazonLinuxAmis?.find(({ Name }) => Name === AL2023_AMI_NAME)?.Value;
    if (al2023AmiId) {
        sqlConfiguration.sqlAmiId = al2023AmiId;
    } else {
        throw createError(412, 'Amazon Linux 2023 AMI is not available');
    }

    const metrics = `${TRIGGERED_FROM}:${triggeredFrom},${DEPLOYED_FROM}:${AWSServiceNames.CLOUDFORMATION},${INSTANCE_TYPE}:${workloadInstanceType},${SQL_VERSION}:${sqlVersion},${DATABASE_SIZE}:${databaseSize},${SQL_HOST_NAME}:${sqlServerName}`;

    const { stackName, templateParameters } = await formatPgSqlTemplateParameters(
        networkConfiguration,
        ec2Configuration,
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

    const customMasterTemplatePath: string = `${WLMDB}/${stackName}/${PGSQL_MASTER_TEMPLATE_PATH}`;
    const signedMasterTemplateUrl = await getPreSignedUrl(
        TEMPLATE_BUCKET_REGION,
        SIGNED_TEMPLATES_BUCKET_NAME,
        customMasterTemplatePath
    );

    logger.info('Signed master url ', signedMasterTemplateUrl);

    // Add Parameter construct - description, type and others. Default is added if user has specified a value or a value specified by default
    const templateParamsInCfFormat = await formatTemplateParametersToCf(templateParameters, DatabaseTypes.PG_SQL);

    // Generate Signed-url and upload to bucket
    await uploadTemplates(
        region!,
        DatabaseTypes.PG_SQL,
        stackName,
        tags?.map(({ key, value }) => ({ Key: key, Value: value })),
        customMasterTemplatePath,
        templateParamsInCfFormat
    );

    let masterTemplateContents;
    if (IS_DEMO_FLOW) {
        const filePathSim = path.join(
            process.cwd(),
            '..',
            'server',
            'test',
            'simulator',
            'responses',
            'aws',
            'mock-master-template-postgres.yaml'
        );

        const filePathDemo = path.join(
            process.cwd(),
            '..',
            'wlmdb',
            'test',
            'simulator',
            'responses',
            'aws',
            'mock-master-template-postgres.yaml'
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
        } else {
            let paramValue = e.ParameterValue;
            if (Array.isArray(e.ParameterValue)) {
                paramValue = e.ParameterValue.join(',');
            }
            cliParams += `ParameterKey="${e.ParameterKey}",ParameterValue="${paramValue?.toString()}" `;
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

    const signedTemplateURL = `${getCloudFormationStackUrl()}?region=${
        region || undefined // explicitly needs to be send if the region is empty string -- cloudformation would not take an empty string
    }#/stacks/create/review?templateURL=${encodeURIComponent(signedMasterTemplateUrl)}&${urlParams}`;

    return {
        url: signedTemplateURL,
        template: masterTemplateContents || '',
        cliCommand: cloudFormationCli
    };
}

function validateFSXThroughputAndIOPS(fsxVolThroughput: number, fsxIOPS: number, region?: string) {
    logger.info('Validate fsx throughput and iops', fsxVolThroughput, fsxIOPS, region);

    // If the fsx throughput selected as 4 GBps means, file system must be configured with 160,000 SSD IOPS.
    if (fsxVolThroughput === FSX_VOL_THROUGHPUT) {
        // FSX 4gbps throughput capacity supported regions
        const { regions: fsx4GbSupportedRegions } = getFSXAvailableRegionsForThrougput();
        const regionExists = fsx4GbSupportedRegions.some(regions => regions.regionCode === region);
        if (!regionExists) {
            throw createError(
                412,
                `Fsxn provisioning with 4 GBps of throughput capacity is not supported for the region ${region}`
            );
        }
        // check ssd and iops size
        if (fsxIOPS !== FSX_IOPS) {
            throw createError(412, 'Supported Fsxn IOPs should be 160000');
        }
    }
}

async function getTerraformSetup(
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
): Promise<TerraformSetupResponseType> {
    logger.info('Get terraform setup', {
        credentialsId,
        region,
        networkConfiguration,
        ec2Configuration,
        adConfiguration,
        fsxConfiguration,
        sqlConfiguration,
        triggeredFrom,
        tags,
        enableCloudWatch,
        topicArn
    });

    if (
        credentialsId &&
        region &&
        (fsxConfiguration.ssmParameterArn || adConfiguration.ssmParameterArn || sqlConfiguration.ssmParameterArn)
    ) {
        await resolveGovCloudDeploymentCredentials(
            credentialsId,
            region,
            adConfiguration,
            fsxConfiguration,
            sqlConfiguration
        );
    }

    const { workloadInstanceType } = ec2Configuration;
    const { sqlServerName, sqlAmiName } = sqlConfiguration;
    const { databaseSize, fsxVolThroughput, fsxIOPS } = fsxConfiguration;
    const [sqlVersion] = calculateSQLandWindowsVersion(sqlAmiName);
    // TODO we can make describe image aws sdk call for sqlAmiName instead of UI sending it in payload as it is error prone
    const metrics = `${TRIGGERED_FROM}:${triggeredFrom},${DEPLOYED_FROM}:${AWSServiceNames.CLOUDFORMATION},${INSTANCE_TYPE}:${workloadInstanceType},${SQL_VERSION}:${sqlVersion},${DATABASE_SIZE}:${databaseSize},${SQL_HOST_NAME}:${sqlServerName}`;

    try {
        // Here 120 & 133120 is in GiB
        if (databaseSize < DATABASE_MIN_LUN_SIZE_IN_GIB || databaseSize > DATABASE_MAX_LUN_SIZE_IN_GIB) {
            throw createError(412, 'Supported Fsxn disk size should be between 120GiB to 130TiB');
        }

        validateFSXThroughputAndIOPS(fsxVolThroughput, fsxIOPS, region);

        // Set EnableDnsSupport and EnableDnsHostnames to true
        await enableVpcDnsAttributes(credentialsId as string, region as string, networkConfiguration.vpcId);

        const { stackName: deploymentName, templateParameters } = await formatTemplateParameters(
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

        if (fsxConfiguration.ssmParameterArn) {
            templateParameters.push({
                ParameterKey: 'FSxSsmParameterArn',
                ParameterValue: fsxConfiguration.ssmParameterArn
            });
        }
        if (adConfiguration.ssmParameterArn) {
            templateParameters.push({
                ParameterKey: 'ADSsmParameterArn',
                ParameterValue: adConfiguration.ssmParameterArn
            });
        }
        if (sqlConfiguration.ssmParameterArn) {
            templateParameters.push({
                ParameterKey: 'SQLSsmParameterArn',
                ParameterValue: sqlConfiguration.ssmParameterArn
            });
        }

        const tfDeploymentName = `TF-${deploymentName.replace('Stack', '')}`;
        logger.debug(`Deployment ${tfDeploymentName} parameters ${JSON.stringify(templateParameters)}.`);

        region = !isEmpty(region) ? region : TEMPLATE_BUCKET_REGION;

        const customTerraformModulesPath: string = `${WLMDB}/${tfDeploymentName}/terraform`;

        const initializationScriptURLs = await uploadTerraformModules(
            region as string,
            DatabaseTypes.MS_SQL_SERVER,
            tfDeploymentName,
            sqlConfiguration.sqlDeploymentMode,
            tags?.map(({ key, value }) => ({ Key: key, Value: value })),
            customTerraformModulesPath
        );
        logger.debug('Terraform modules uploaded successfully', initializationScriptURLs);

        const { terraformVariables } = await createTFVarsFile(
            region as string,
            DatabaseTypes.MS_SQL_SERVER,
            tfDeploymentName,
            customTerraformModulesPath,
            templateParameters,
            initializationScriptURLs as InitializationScript[]
        );

        const contents = await createRootModuleFile(
            region as string,
            DatabaseTypes.MS_SQL_SERVER,
            tfDeploymentName,
            terraformVariables
        );
        const terraformZipS3SignedURL = await createAndUploadTheTerraformZipFile(
            region as string,
            DatabaseTypes.MS_SQL_SERVER,
            tfDeploymentName,
            customTerraformModulesPath
        );

        logger.debug('Terraform zip file signed url', terraformZipS3SignedURL);

        return {
            url: terraformZipS3SignedURL,
            template: contents || ''
        };
    } catch (err: any) {
        logger.error('Error while getting terraform setup', err);
        throw createError(500, `Error while getting terraform setup: ${err.message}`);
    }
}

async function getPGSQLTerraformSetup(
    networkConfiguration: CFNetworkConfigurationType,
    ec2Configuration: EC2ConfigurationType,
    fsxConfiguration: FSXConfigurationType,
    sqlConfiguration: PgSqlConfigurationType,
    topicArn: string = '',
    enableCloudWatch: boolean = false,
    triggeredFrom: string,
    tags?: Array<{ key: string; value: string }>,
    credentialsId?: string,
    region?: string
): Promise<TerraformSetupResponseType> {
    logger.info('Get PGSQL terraform setup', {
        networkConfiguration,
        ec2Configuration,
        fsxConfiguration,
        sqlConfiguration,
        triggeredFrom,
        tags,
        enableCloudWatch,
        topicArn,
        credentialsId,
        region
    });

    if (credentialsId && region && (fsxConfiguration.ssmParameterArn || sqlConfiguration.ssmParameterArn)) {
        await resolveGovCloudDeploymentCredentials(
            credentialsId,
            region,
            undefined,
            fsxConfiguration,
            sqlConfiguration
        );
    }

    const { workloadInstanceType } = ec2Configuration;
    const { databaseSize, fsxVolThroughput, fsxIOPS } = fsxConfiguration;
    const { sqlServerName } = sqlConfiguration;

    try {
        const amazonLinuxAmis = await getParametersByPath(credentialsId, region, AMAZON_LINUX_AMI_PATH);
        const al2023AmiId = amazonLinuxAmis?.find(({ Name }) => Name === AL2023_AMI_NAME)?.Value;
        if (al2023AmiId) {
            sqlConfiguration.sqlAmiId = al2023AmiId;
        } else {
            throw createError(412, 'Amazon Linux 2023 AMI is not available');
        }

        validateFSXThroughputAndIOPS(fsxVolThroughput, fsxIOPS, region);

        const metrics = `${TRIGGERED_FROM}:${triggeredFrom},${INSTANCE_TYPE}:${workloadInstanceType},${PGSQL_VERSION}:15,${DATABASE_SIZE}:${databaseSize},${SQL_HOST_NAME}:${sqlServerName}`;

        const { stackName: deploymentName, templateParameters } = await formatPgSqlTemplateParameters(
            networkConfiguration,
            ec2Configuration,
            fsxConfiguration,
            sqlConfiguration,
            topicArn,
            enableCloudWatch,
            metrics,
            credentialsId,
            region,
            true // to skip the passwords param to be empty string
        );

        if (fsxConfiguration.ssmParameterArn) {
            templateParameters.push({
                ParameterKey: 'FSxSsmParameterArn',
                ParameterValue: fsxConfiguration.ssmParameterArn
            });
        }
        if (sqlConfiguration.ssmParameterArn) {
            templateParameters.push({
                ParameterKey: 'SQLSsmParameterArn',
                ParameterValue: sqlConfiguration.ssmParameterArn
            });
        }

        const tfDeploymentName = `TF-${deploymentName.replace('Stack', '')}`;
        logger.debug(`Deployment ${tfDeploymentName} parameters ${JSON.stringify(templateParameters)}.`);

        region = !isEmpty(region) ? region : TEMPLATE_BUCKET_REGION;

        const customTerraformModulesPath: string = `${WLMDB}/${tfDeploymentName}/terraform`;

        const initializationScriptURLs = await uploadTerraformModules(
            region as string,
            DatabaseTypes.PG_SQL,
            tfDeploymentName,
            sqlConfiguration.sqlDeploymentMode,
            tags?.map(({ key, value }) => ({ Key: key, Value: value })),
            customTerraformModulesPath
        );
        logger.debug('PGSQL Terraform modules uploaded successfully', initializationScriptURLs);

        const { terraformVariables } = await createTFVarsFile(
            region as string,
            DatabaseTypes.PG_SQL,
            tfDeploymentName,
            customTerraformModulesPath,
            templateParameters,
            initializationScriptURLs as InitializationScript[]
        );

        const contents = await createRootModuleFile(
            region as string,
            DatabaseTypes.PG_SQL,
            tfDeploymentName,
            terraformVariables
        );

        const terraformZipS3SignedURL = await createAndUploadTheTerraformZipFile(
            region as string,
            DatabaseTypes.PG_SQL,
            tfDeploymentName,
            customTerraformModulesPath
        );

        logger.debug('PGSQL Terraform zip file signed url', terraformZipS3SignedURL);

        return {
            url: terraformZipS3SignedURL,
            template: contents || ''
        };
    } catch (err: any) {
        logger.error('Error while getting terraform setup for pgsql', err);
        throw createError(500, `Error while getting terraform setup for pgsql: ${err.message}`);
    }
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

    if (fsxConfiguration.ssmParameterArn || adConfiguration.ssmParameterArn || sqlConfiguration.ssmParameterArn) {
        await resolveGovCloudDeploymentCredentials(
            credentialsId,
            region,
            adConfiguration,
            fsxConfiguration,
            sqlConfiguration
        );
    }

    updateLongRunningAuditGroup(undefined, undefined, sqlConfiguration?.sqlServerName);
    const { workloadInstanceType } = ec2Configuration;
    const { sqlServerName, sqlAmiName, sqlCollation } = sqlConfiguration;
    const { databaseSize, fsxVolThroughput, fsxIOPS } = fsxConfiguration;
    const [sqlVersion] = calculateSQLandWindowsVersion(sqlAmiName);

    // TODO we can make describe image aws sdk call for sqlAmiName instead of UI sending it in payload as it is error prone
    let metrics = `${TRIGGERED_FROM}:${triggeredFrom},${INSTANCE_TYPE}:${workloadInstanceType},${SQL_VERSION}:${sqlVersion},${DATABASE_SIZE}:${databaseSize},${SQL_HOST_NAME}:${sqlServerName}`;

    try {
        // Here 120 & 133120 is in GiB
        if (databaseSize < DATABASE_MIN_LUN_SIZE_IN_GIB || databaseSize > DATABASE_MAX_LUN_SIZE_IN_GIB) {
            throw createError(412, 'Supported Fsxn disk size should be between 120GiB to 130TiB');
        }

        if (!sqlCollation) {
            throw createError(412, 'Please provide the collation information');
        }

        validateFSXThroughputAndIOPS(fsxVolThroughput, fsxIOPS, region);

        const { permissions } = await checkAllMissingPermissions(credentialsId, region, OPERATE);

        // if the simulatePrincipalPolicy is present, its operate user so can go through the deploying the stack if all other permissions are available
        if (permissions.implicitlyDenied.length || permissions.explicitlyDenied.length) {
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
            const errMsg = MISSING_PERMISSIONS(permissions.implicitlyDenied, permissions.explicitlyDenied);

            const responseWithPermissions: CloudFormationDeploymentResponseType = {
                ...response,
                missingPermissions: {
                    implicitlyDenied: permissions.implicitlyDenied || [],
                    explicitlyDenied: permissions.explicitlyDenied
                }
            };
            updateLongRunningAuditGroup(AuditStatus.SUCCESS);
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

            const errMsg = MISSING_PERMISSIONS(err?.message, []);
            const responseWithPermissions: CloudFormationDeploymentResponseType = {
                ...response,
                missingPermissions: {
                    implicitlyDenied: !blockedBySCP
                        ? [
                              {
                                  service: IAM,
                                  action: SIMULATE_IAM_POLICY,
                                  reason: PERMISSION_DENIAL_POSSIBLE_REASONS.MISSING
                              }
                          ]
                        : [],
                    explicitlyDenied: blockedBySCP
                        ? [
                              {
                                  service: IAM,
                                  action: SIMULATE_IAM_POLICY,
                                  reason: PERMISSION_DENIAL_POSSIBLE_REASONS.BLOCKED_SCP
                              }
                          ]
                        : []
                }
            };
            logger.error(errMsg);
            updateLongRunningAuditGroup(AuditStatus.SUCCESS);
            return responseWithPermissions;
        }
        const errorMsg = `Error while deploying stack. ${err?.message}`;
        logger.error(errorMsg, err);
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMsg);

        throw createError(err.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
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
        let errorMessage = '';
        if (vpcValidationCheck.violationMessage !== undefined) {
            errorMessage = vpcValidationCheck.violationMessage;
        } else if (sqlConfiguration.sqlDeploymentMode === STANDALONE) {
            errorMessage = STANDALONE_NETWORK_VIOLATION_MESSAGE;
        }
        if (!isEmpty(errorMessage)) {
            logger.error('VPC validation error:', errorMessage);
            throw createError(HttpErrorCodes.VALIDATION_ERROR, errorMessage!);
        }
    }

    const derivedParams = generateDeploymentParams(
        DatabaseTypes.MS_SQL_SERVER,
        fsxConfiguration.databaseSize,
        Boolean(fsxConfiguration.fsxFileSystemId),
        sqlConfiguration.sqlDeploymentMode,
        fsxConfiguration.fsxVolThroughput,
        fsxConfiguration.fsxIOPS
    );

    const { roleName, providerAccountId } = await getRoleDetails(credentialsId);

    const customMasterTemplatePath: string = `${WLMDB}/${derivedParams.StackName}/${MASTER_TEMPLATE_PATH}`;

    const signedMasterTemplateUrl = await getPreSignedUrl(
        TEMPLATE_BUCKET_REGION,
        SIGNED_TEMPLATES_BUCKET_NAME,
        customMasterTemplatePath
    );

    const encodedSignedMasterTemplateURL = encodeURIComponent(signedMasterTemplateUrl);
    logger.info('Signed master url ', encodedSignedMasterTemplateURL);

    const validationAmiImage = sqlConfiguration.sqlAmiId;

    const accountId = getAsyncLocalStorageResource<string>(ACCOUNT_ID);
    const { token } = generateAuthToken({ email: 'SYSTEM@netapp.com' });

    const { awsAccountId } = derivePropertiesFromARN(process.env.AWS_ROLE_ARN as string) || {};

    const { privateSubnet1Cidr, privateSubnet2Cidr } = await getSubnetsCidr(
        credentialsId!,
        region!,
        networkConfiguration,
        sqlConfiguration.sqlDeploymentMode
    );

    const { servicesWithNoEndpoint = [], missingRoutesInS3 = [] } =
        credentialsId && region
            ? await endpointsValidationResults(
                  credentialsId,
                  region,
                  networkConfiguration,
                  sqlConfiguration.sqlDeploymentMode,
                  privateSubnet1Cidr,
                  privateSubnet2Cidr
              )
            : {};

    const templateParamsAsList: Array<Parameter> = [
        { ParameterKey: CF_DEPLOY_ROLE_NAME, ParameterValue: roleName },
        { ParameterKey: VALIDATION_AMI, ParameterValue: validationAmiImage },
        { ParameterKey: VALIDATION_INSTANCE_TYPE, ParameterValue: VALIDATION_NODE_INSTANCETYPE },
        { ParameterKey: TEMPLATE_ACCOUNT_ID, ParameterValue: accountId },
        { ParameterKey: TEMPLATE_CLOUD_PROVIDER_ID, ParameterValue: providerAccountId },
        { ParameterKey: TEMPLATE_CREDENTIALS_ID, ParameterValue: credentialsId },
        { ParameterKey: TEMPLATE_WLMDB_AWS_ACCOUT_ID, ParameterValue: awsAccountId },
        { ParameterKey: TEMPLATE_JWT_TOKEN, ParameterValue: token },
        { ParameterKey: TEMPLATE_S3GATEWAY_ROUTETABLES, ParameterValue: missingRoutesInS3.toString() },
        { ParameterKey: TEMPLATE_PRIVATESUBNET1_CIDRBLOCK, ParameterValue: privateSubnet1Cidr },
        { ParameterKey: TEMPLATE_PRIVATESUBNET2_CIDRBLOCK, ParameterValue: privateSubnet2Cidr }
    ];
    let templateParams: string = `stackName=${derivedParams.StackName}&param_${CF_DEPLOY_ROLE_NAME}=${roleName}&param_${VALIDATION_AMI}=${validationAmiImage}&param_${VALIDATION_INSTANCE_TYPE}=${VALIDATION_NODE_INSTANCETYPE}&param_${TEMPLATE_ACCOUNT_ID}=${accountId}&param_${TEMPLATE_JWT_TOKEN}=${token}&param_${TEMPLATE_CREDENTIALS_ID}=${credentialsId}&param_${TEMPLATE_CLOUD_PROVIDER_ID}=${providerAccountId}&param_${TEMPLATE_WLMDB_AWS_ACCOUT_ID}=${awsAccountId}`;
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

    const adUsernameDetails = splitDomainUsername(adConfiguration.domainUsername || '');
    const fsxUsernameDetails = splitDomainUsername(fsxConfiguration.fsxUsername || '');
    const sqlUsernameDetails = splitDomainUsername(sqlConfiguration.serviceAccountName || '');
    templateParams += `&param_${TEMPLATE_USERNAME_MAPPING.DomainAdminUser}=${
        adUsernameDetails?.username || adConfiguration.domainUsername || ''
    }`;
    templateParams += `&param_${TEMPLATE_USERNAME_MAPPING.FSxAdminUsername}=${
        fsxUsernameDetails?.username || fsxConfiguration.fsxUsername || ''
    }`;
    templateParams += `&param_${TEMPLATE_USERNAME_MAPPING.SQLServiceAccountName}=${
        sqlUsernameDetails?.username || sqlConfiguration.serviceAccountName || ''
    }`;

    // Get the volume size of an ami.. Set to minimum value of 100 if its lesser than that
    const {
        Images: [
            {
                BlockDeviceMappings: [{ Ebs: { VolumeSize: amiVolumeSize = EBS_DEFAULT_VOLUME_SIZE } = {} } = {}] = []
            } = {}
        ] = []
    } = await getAmis(credentialsId, region, { ImageIds: [sqlConfiguration.sqlAmiId] });

    const amiSize = Math.max(amiVolumeSize, EBS_DEFAULT_VOLUME_SIZE);
    templateParams += `&param_${EBS_VOLUME_SIZE}=${amiSize}`;

    templateParamsAsList.push(
        {
            ParameterKey: TEMPLATE_USERNAME_MAPPING.DomainAdminUser,
            ParameterValue: adUsernameDetails?.username || adConfiguration.domainUsername
        },
        {
            ParameterKey: TEMPLATE_USERNAME_MAPPING.FSxAdminUsername,
            ParameterValue: fsxUsernameDetails?.username || fsxConfiguration.fsxUsername
        },
        {
            ParameterKey: TEMPLATE_USERNAME_MAPPING.SQLServiceAccountName,
            ParameterValue: sqlUsernameDetails?.username || sqlConfiguration.serviceAccountName
        }
    );

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

    const signedTemplateURL = `${getCloudFormationStackUrl()}?region=${region}#/stacks/create/review?templateURL=${encodedSignedMasterTemplateURL}&${templateParams}`;

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
    await enableVpcDnsAttributes(credentialsId, region, networkConfiguration.vpcId);

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
    if (IS_DEMO_FLOW) {
        const accountId: string = getAsyncLocalStorageResource(ACCOUNT_ID);
        const stackId = deployStackResponse.StackId || '';
        const awsAccountId = randomize('0', 8);
        await createDemoResourcesPerRegion(accountId, credentialsId, region, awsAccountId);
        createDeploymentMockDataInDB(
            accountId,
            stackId,
            stackName,
            region,
            credentialsId,
            sqlConfiguration?.sqlDeploymentMode,
            fsxConfiguration?.fsxFileSystemId,
            awsAccountId,
            sqlConfiguration?.sqlServerName,
            false,
            STORAGE_PROTOCOLS.ISCSI
        );
        if (!fsxConfiguration.fsxFileSystemId) {
            // create a new fsx record in fsx inventory
            createFileSystemForDemo(credentialsId, region, fsxConfiguration, false);
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

function prepareResourceActionMap(statements: PolicyStatement[]) {
    logger.debug('Preparing resource action map', { statements });

    const resourcePolicyActions: {
        resourceArn: string[];
        resourceActions: string[];
        resourceConditions: ContextEntry[];
    }[] = [];
    statements.forEach(({ Resource, Action, Condition }) => {
        const actionMap = [];

        const filteredActions = filterActions(Action);
        actionMap.push(...filteredActions);

        const resourceConditions: ContextEntry[] = [];

        if (!isEmpty(Condition)) {
            Object.entries(Condition).forEach(obj => {
                const [key, value] = obj;
                if (key === 'StringLike' || key === 'StringEquals') {
                    // TODO : revisit this implementation when the WLMDB policy has Conditions supporting Numeric/Boolean datatypes
                    Object.entries(value).forEach(([conditionKey, conditionValue]) =>
                        resourceConditions.push({
                            ContextKeyName: conditionKey,
                            ContextKeyValues: Array.isArray(conditionValue) ? conditionValue : [conditionValue],
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

/**
 * Rewrites ARN partition from commercial (arn:aws:) to GovCloud (arn:aws-us-gov:)
 * in all Resource fields. The static workload-policies.json hosted on WF Console
 * only contains commercial ARNs. For GovCloud accounts, SimulatePrincipalPolicy
 * needs the correct partition to match the role's actual permissions.
 *
 * TODO: Remove this workaround once WF Console team hosts a GovCloud-specific
 * workload-policies.json (or workload-policies-gov.json) with arn:aws-us-gov: ARNs.
 */
function rewriteArnPartitionForGovCloud(statements: PolicyStatement[]): PolicyStatement[] {
    return statements.map(stmt => ({
        ...stmt,
        Resource: (Array.isArray(stmt.Resource) ? stmt.Resource : [stmt.Resource]).map(arn =>
            typeof arn === 'string' && arn.startsWith('arn:aws:') ? arn.replace('arn:aws:', 'arn:aws-us-gov:') : arn
        )
    }));
}

async function checkAllMissingPermissions(credentialsId: string, region: string, action: string = VIEW) {
    logger.info('Check all missing permissions', { credentialsId, region, action });
    // checking the permissions for three different times to find out with different conditions like resource arn, conditions & resource set to *
    const { operate, view } = await getWlmdbPolicy();

    const isGovAccount = getAsyncLocalStorageResource<boolean>(GOV_ACCOUNT);
    let statements = action === OPERATE ? operate.Statement : view.Statement;
    if (isGovAccount) {
        logger.info('GovCloud account — rewriting ARN partition in policy resource ARNs');
        statements = rewriteArnPartitionForGovCloud(statements);
    }
    const policyResourceActions = prepareResourceActionMap(statements);

    const missedPermissions: MissingPermissionInterface = {
        implicitlyDenied: [],
        explicitlyDenied: []
    };

    await Promise.all(
        // 'throat' is used to limit the number of concurrent requests
        // Limit of 3 is tested for 10 requests, 4 sometimes throws - rate execeeded error
        // 07-03-2024: throttling to 1, as the issue is continuously being hit
        policyResourceActions.map(
            throat(1, async ({ resourceArn, resourceActions, resourceConditions }) => {
                try {
                    const { implicitlyDenied, explicitlyDenied } = await getMissingPermissionsList(
                        credentialsId,
                        region,
                        resourceActions,
                        resourceArn,
                        resourceConditions
                    );
                    if (implicitlyDenied.length > 0) {
                        missedPermissions.implicitlyDenied.push(...implicitlyDenied);
                    }
                    if (explicitlyDenied.length > 0) {
                        missedPermissions.explicitlyDenied.push(...explicitlyDenied);
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

function getFSXAvailableRegionsForThrougput(accountId?: string) {
    logger.info('Getting FSX Available regions for throughput', accountId);

    // Its the static list which supported fsx provisioning for 4GBps of throughput capacity
    // https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/performance.html
    return {
        regions: [
            {
                regionCode: 'us-east-1',
                regionName: 'US East (N. Virginia)'
            },
            {
                regionCode: 'us-east-2',
                regionName: 'US East (Ohio)'
            },
            {
                regionCode: 'eu-west-1',
                regionName: 'Europe (Ireland)'
            },
            {
                regionCode: 'us-west-2',
                regionName: 'US West (Oregon)'
            }
        ]
    };
}

function getCollationDetailsForDeployment(accountId: string, mssqlVersion: number) {
    logger.info('Getting collation details for mssql deployment', { accountId, mssqlVersion });
    return getCollationForMSSQLVersion(String(mssqlVersion));
}

async function deployPgSql(
    credentialsId: string,
    region: string,
    networkConfiguration: CFNetworkConfigurationType,
    ec2Configuration: EC2ConfigurationType,
    fsxConfiguration: FSXConfigurationType,
    sqlConfiguration: PgSqlConfigurationType,
    topicArn: string = '',
    enableCloudWatch: boolean = false,
    triggeredFrom: string,
    tags?: Array<{ key: string; value: string }>
) {
    logger.info('Deploy Postgres SQL', {
        credentialsId,
        region,
        networkConfiguration,
        ec2Configuration,
        fsxConfiguration,
        sqlConfiguration,
        topicArn,
        enableCloudWatch,
        triggeredFrom,
        tags
    });

    if (fsxConfiguration.ssmParameterArn || sqlConfiguration.ssmParameterArn) {
        await resolveGovCloudDeploymentCredentials(
            credentialsId,
            region,
            undefined,
            fsxConfiguration,
            sqlConfiguration
        );
    }

    updateLongRunningAuditGroup(undefined, undefined, sqlConfiguration?.sqlServerName);

    const { workloadInstanceType } = ec2Configuration;
    const { databaseSize, fsxVolThroughput, fsxIOPS } = fsxConfiguration;
    const { sqlServerName, sqlVersion, sqlDeploymentMode } = sqlConfiguration;
    const amazonLinuxAmis = await getParametersByPath(credentialsId, region, '/aws/service/ami-amazon-linux-latest');
    const al2023AmiId = amazonLinuxAmis?.find(({ Name }) => Name === AL2023_AMI_NAME)?.Value;
    if (al2023AmiId) {
        sqlConfiguration.sqlAmiId = al2023AmiId;
    } else {
        throw createError(412, 'Amazon Linux 2023 AMI is not available');
    }

    validateFSXThroughputAndIOPS(fsxVolThroughput, fsxIOPS, region);

    await validateSvmCountCapacity(
        credentialsId,
        region,
        sqlConfiguration.sqlDeploymentMode,
        fsxConfiguration.fsxFileSystemId
    );

    let metrics = `${TRIGGERED_FROM}:${triggeredFrom},${INSTANCE_TYPE}:${workloadInstanceType},${PGSQL_VERSION}:${sqlVersion},${DATABASE_SIZE}:${databaseSize},${SQL_HOST_NAME}:${sqlServerName}`;

    try {
        // Get the Max capacity - headroom of 35% for OS and other services
        // Divide by 1.75 (data + 75% log) to get the max database size
        // Further divide by 2 for HA mode as we would create 2 data volumes
        let maxDatabaseSizeInGib = ((1 - 0.35) * 192 * 1024) / 1.75;
        maxDatabaseSizeInGib = Number(maxDatabaseSizeInGib / (sqlDeploymentMode === HA ? 2 : 1));
        if (databaseSize < DATABASE_MIN_LUN_SIZE_IN_GIB || databaseSize > maxDatabaseSizeInGib) {
            throw createError(412, `Supported Fsxn disk size should be between 120GiB to ${maxDatabaseSizeInGib}GiB`);
        }

        const { permissions } = await checkAllMissingPermissions(credentialsId, region, OPERATE);

        // if the simulatePrincipalPolicy is present, its operate user so can go through the deploying the stack if all other permissions are available
        if (permissions.implicitlyDenied.length || permissions.explicitlyDenied.length) {
            metrics += `,${DEPLOYED_FROM}:${AWSServiceNames.CLOUDFORMATION}`;
            const response = await createCfTemplateForPgsqlDeployment(
                credentialsId,
                region,
                networkConfiguration,
                ec2Configuration,
                fsxConfiguration,
                sqlConfiguration,
                topicArn,
                enableCloudWatch,
                metrics,
                tags
            );
            const errMsg = MISSING_PERMISSIONS(permissions.implicitlyDenied, permissions.explicitlyDenied);

            const responseWithPermissions: CloudFormationDeploymentResponseType = {
                ...response,
                missingPermissions: {
                    implicitlyDenied: permissions.implicitlyDenied || [],
                    explicitlyDenied: permissions.explicitlyDenied
                }
            };

            logger.error(errMsg);
            return responseWithPermissions;
        }
        metrics += `,${DEPLOYED_FROM}:${WLMDB}`;
        return deployCfTemplateForPgSql(
            credentialsId,
            region,
            networkConfiguration,
            ec2Configuration,
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
            const response = await createCfTemplateForPgsqlDeployment(
                credentialsId,
                region,
                networkConfiguration,
                ec2Configuration,
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

            const errMsg = MISSING_PERMISSIONS(err?.message, []);
            const responseWithPermissions: CloudFormationDeploymentResponseType = {
                ...response,
                missingPermissions: {
                    implicitlyDenied: !blockedBySCP
                        ? [
                              {
                                  service: IAM,
                                  action: SIMULATE_IAM_POLICY,
                                  reason: PERMISSION_DENIAL_POSSIBLE_REASONS.MISSING
                              }
                          ]
                        : [],
                    explicitlyDenied: blockedBySCP
                        ? [
                              {
                                  service: IAM,
                                  action: SIMULATE_IAM_POLICY,
                                  reason: PERMISSION_DENIAL_POSSIBLE_REASONS.BLOCKED_SCP
                              }
                          ]
                        : []
                }
            };
            logger.error(errMsg);
            updateLongRunningAuditGroup(AuditStatus.SUCCESS);
            return responseWithPermissions;
        }
        const errorMsg = `Error while deploying stack. ${err?.message}`;
        logger.error(errorMsg, err);
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMsg);

        throw createError(err.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
    }
}

async function deployCfTemplateForPgSql(
    credentialsId: string,
    region: string,
    networkConfiguration: CFNetworkConfigurationType,
    ec2Configuration: EC2ConfigurationType,
    fsxConfiguration: FSXConfigurationType,
    sqlConfiguration: PgSqlConfigurationType,
    topicArn: string = '',
    enableCloudWatch: boolean = false,
    metrics: string,
    tags?: Array<{ key: string; value: string }>
): Promise<{ cloudFormationStackId: string; cloudFormationUrl: string }> {
    const vpcValidationCheck: NetworkViolation = isNetworkConfigurationViolated(networkConfiguration, STANDALONE);

    if (vpcValidationCheck.isViolated && vpcValidationCheck.violationMessage !== undefined) {
        const errorMessage = vpcValidationCheck.violationMessage;
        throw createError(HttpErrorCodes.VALIDATION_ERROR, errorMessage);
    }

    const cfStackQuotaReached = await isCfStackQuotaReached(credentialsId, region);
    if (cfStackQuotaReached) {
        throw createError(HttpErrorCodes.VALIDATION_ERROR, CF_QUOTA_REACHED);
    }

    // Set EnableDnsSupport and EnableDnsHostnames to true
    await enableVpcDnsAttributes(credentialsId, region, networkConfiguration.vpcId);

    const { stackName, templateParameters: templateParams } = await formatPgSqlTemplateParameters(
        networkConfiguration,
        ec2Configuration,
        fsxConfiguration,
        sqlConfiguration,
        topicArn,
        enableCloudWatch,
        metrics,
        credentialsId,
        region
    );

    const customMasterTemplatePath = `${WLMDB}/${stackName}/${PGSQL_MASTER_TEMPLATE_PATH}`;

    const signedMasterTemplateUrl = await getPreSignedUrl(
        TEMPLATE_BUCKET_REGION,
        SIGNED_TEMPLATES_BUCKET_NAME,
        customMasterTemplatePath
    );

    logger.info('Signed master url ', signedMasterTemplateUrl);

    // Add Parameter construct - description, type and others. Default is added if user has specified a value or a value specified by default
    const templateParamsInCfFormat = await formatTemplateParametersToCf(templateParams, DatabaseTypes.PG_SQL);

    logger.info('Template parameters in CF format', templateParamsInCfFormat);

    // Generate Signed-url and upload to bucket
    await uploadTemplates(
        region,
        DatabaseTypes.PG_SQL,
        stackName,
        tags?.map(({ key, value }) => ({ Key: key, Value: value })),
        customMasterTemplatePath,
        templateParamsInCfFormat
    );

    logger.debug('template params', templateParams);

    const deployStackResponse = await createStack(
        credentialsId,
        region,
        stackName,
        signedMasterTemplateUrl,
        templateParams,
        DISABLE_ROLLBACK,
        MASTER_STACK_TIMEOUT_MINUTES
    );

    // logger.info(`Stack ${stackName} response ${deployStackResponse}`);

    const cfUrl = deployedStackUrl(region, deployStackResponse.StackId!);
    if (IS_DEMO_FLOW) {
        const accountId: string = getAsyncLocalStorageResource(ACCOUNT_ID);
        const stackId = deployStackResponse.StackId || '';
        const awsAccountId = randomize('0', 8);
        await createDemoResourcesPerRegion(accountId, credentialsId, region, awsAccountId);
        createDeploymentMockDataInDBForPgSql(
            accountId,
            stackId,
            stackName,
            region,
            credentialsId,
            sqlConfiguration?.sqlDeploymentMode,
            fsxConfiguration?.fsxFileSystemId,
            awsAccountId,
            sqlConfiguration?.sqlServerName,
            DatabaseTypes.PG_SQL
        );
        if (!fsxConfiguration.fsxFileSystemId) {
            // create a new fsx record in fsx inventory
            createFileSystemForDemo(credentialsId, region, fsxConfiguration, false);
        }
    }

    return { cloudFormationStackId: deployStackResponse.StackId!, cloudFormationUrl: cfUrl };
}

async function formatPgSqlTemplateParameters(
    networkConfiguration: CFNetworkConfigurationType,
    ec2Configuration: EC2ConfigurationType,
    fsxConfiguration: FSXConfigurationType,
    sqlConfiguration: PgSqlConfigurationType,
    topicArn: string,
    enableCloudWatch: boolean,
    metrics: string,
    credentialsId?: string,
    region?: string,
    skipPasswords?: boolean
) {
    logger.info('Format Postgres SQL template parameters', {
        networkConfiguration,
        ec2Configuration,
        fsxConfiguration,
        sqlConfiguration,
        topicArn,
        enableCloudWatch,
        metrics,
        credentialsId,
        region,
        skipPasswords
    });
    const derivedParams = generateDeploymentParams(
        DatabaseTypes.PG_SQL,
        fsxConfiguration.databaseSize,
        Boolean(fsxConfiguration.fsxFileSystemId),
        sqlConfiguration.sqlDeploymentMode,
        fsxConfiguration.fsxVolThroughput,
        fsxConfiguration.fsxIOPS
    );

    logger.info('Derived parameters for Postgres deployment', derivedParams);

    const { roleName = '', providerAccountId = '' } = credentialsId
        ? await getRoleDetails(credentialsId)
        : { roleName: '', providerAccountId: '' };

    const stackName = derivedParams.StackName;

    const validationAmiImage = sqlConfiguration.sqlAmiId;

    const accountId = getAsyncLocalStorageResource<string>(ACCOUNT_ID);
    const { token } = generateAuthToken({ user: 'SYSTEM@netapp.com' });

    const { awsAccountId } = derivePropertiesFromARN(process.env.AWS_ROLE_ARN as string) || {};

    const { privateSubnet1Cidr, privateSubnet2Cidr } =
        credentialsId && region
            ? await getSubnetsCidr(credentialsId!, region!, networkConfiguration, sqlConfiguration.sqlDeploymentMode)
            : { privateSubnet1Cidr: '', privateSubnet2Cidr: '' };

    const { servicesWithNoEndpoint = [], missingRoutesInS3 = [] } =
        credentialsId && region
            ? await endpointsValidationResults(
                  credentialsId,
                  region,
                  networkConfiguration,
                  sqlConfiguration.sqlDeploymentMode,
                  privateSubnet1Cidr,
                  privateSubnet2Cidr
              )
            : {};
    const templateParams: Array<Parameter> = [
        { ParameterKey: CF_DEPLOY_ROLE_NAME, ParameterValue: roleName },
        { ParameterKey: VALIDATION_AMI, ParameterValue: validationAmiImage },
        { ParameterKey: VALIDATION_INSTANCE_TYPE, ParameterValue: VALIDATION_NODE_INSTANCETYPE },
        { ParameterKey: TEMPLATE_ACCOUNT_ID, ParameterValue: accountId },
        { ParameterKey: TEMPLATE_CLOUD_PROVIDER_ID, ParameterValue: providerAccountId },
        { ParameterKey: TEMPLATE_CREDENTIALS_ID, ParameterValue: credentialsId },
        { ParameterKey: TEMPLATE_METRICS, ParameterValue: metrics },
        { ParameterKey: TEMPLATE_WLMDB_AWS_ACCOUT_ID, ParameterValue: awsAccountId },
        { ParameterKey: TEMPLATE_JWT_TOKEN, ParameterValue: token },
        { ParameterKey: TEMPLATE_S3GATEWAY_ROUTETABLES, ParameterValue: missingRoutesInS3.toString() },
        { ParameterKey: TEMPLATE_PRIVATESUBNET1_CIDRBLOCK, ParameterValue: privateSubnet1Cidr },
        { ParameterKey: TEMPLATE_PRIVATESUBNET2_CIDRBLOCK, ParameterValue: privateSubnet2Cidr }
    ];

    if (fsxConfiguration.fsxPassword) {
        try {
            const encryptedFsxPassword = await encryptString(fsxConfiguration.fsxPassword);
            if (encryptedFsxPassword) {
                templateParams.push({
                    ParameterKey: TEMPLATE_FSX_PASSWORD,
                    ParameterValue: encryptedFsxPassword
                });
            }
        } catch (error) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Error while encrypting password ${error}.`);
        }
    }

    // Get the volume size of an ami.. Set to minimum value of 100 if its lesser than that
    let amiSize = EBS_DEFAULT_VOLUME_SIZE; // to accomodate guest user when credentials or region could be empty
    if (credentialsId && region && sqlConfiguration.sqlAmiId) {
        const {
            Images: [
                {
                    BlockDeviceMappings: [
                        { Ebs: { VolumeSize: amiVolumeSize = EBS_DEFAULT_VOLUME_SIZE } = {} } = {}
                    ] = []
                } = {}
            ] = []
        } = (await getAmis(credentialsId as string, region as string, { ImageIds: [sqlConfiguration.sqlAmiId] })) || [];

        amiSize = Math.max(amiVolumeSize, EBS_DEFAULT_VOLUME_SIZE);
    }
    templateParams.push({ ParameterKey: EBS_VOLUME_SIZE, ParameterValue: amiSize.toString() });

    Object.entries(MAP_SERVICE_TEMPLATE_PARAMETER).forEach(([key, value]) => {
        templateParams.push({
            ParameterKey: value,
            ParameterValue: servicesWithNoEndpoint.includes(key) ? 'false' : 'true'
        });
    });

    Object.entries(derivedParams).forEach(([key, value]) => {
        if (key !== 'StackName') {
            templateParams.push({
                ParameterKey: key,
                ParameterValue: value.toString()
            });
        }
    });

    const fsxUsernameDetails = splitDomainUsername(fsxConfiguration.fsxUsername || '');
    templateParams.push({
        ParameterKey: TEMPLATE_USERNAME_MAPPING.FSxAdminUsername,
        ParameterValue: fsxUsernameDetails?.username || fsxConfiguration.fsxUsername || ''
    });

    const clubbedParamList = {
        ...networkConfiguration,
        ...fsxConfiguration,
        ...sqlConfiguration,
        ...ec2Configuration,
        topicArn,
        enableCloudWatch
    };

    Object.entries(clubbedParamList).forEach(([key, value]) => {
        if (PG_TEMPLATE_CONFIG_MAPPING[key]) {
            templateParams.push({
                ParameterKey: PG_TEMPLATE_CONFIG_MAPPING[key],
                ParameterValue:
                    skipPasswords && SKIP_TEMPLATE_PASSWORD_PARAMETERS.includes(PG_TEMPLATE_CONFIG_MAPPING[key])
                        ? ''
                        : value.toString()
            });
        }
    });

    Object.entries(PG_TEMPLATE_OPTIONAL_PARAMETERS).forEach(([key, value]) => {
        if (!(key in clubbedParamList)) {
            templateParams.push({
                ParameterKey: value,
                ParameterValue: ''
            });
        }
    });

    return { stackName, templateParameters: templateParams };
}

async function createCfTemplateForPgsqlDeployment(
    credentialsId: string,
    region: string,
    networkConfiguration: CFNetworkConfigurationType,
    ec2Configuration: EC2ConfigurationType,
    fsxConfiguration: FSXConfigurationType,
    sqlConfiguration: PgSqlConfigurationType,
    topicArn: string = '',
    enableCloudWatch: boolean = false,
    metrics: string,
    tags?: Array<{ key: string; value: string }>
) {
    logger.info('Create cloud formation template for Postgres deployment', {
        credentialsId,
        region,
        networkConfiguration,
        ec2Configuration,
        fsxConfiguration,
        sqlConfiguration,
        topicArn,
        enableCloudWatch,
        metrics,
        tags
    });

    const vpcValidationCheck: NetworkViolation = isNetworkConfigurationViolated(
        networkConfiguration,
        sqlConfiguration.sqlDeploymentMode
    );

    if (vpcValidationCheck.isViolated) {
        let errorMessage = '';
        if (vpcValidationCheck.violationMessage !== undefined) {
            errorMessage = vpcValidationCheck.violationMessage;
        } else if (sqlConfiguration.sqlDeploymentMode === STANDALONE) {
            errorMessage = STANDALONE_NETWORK_VIOLATION_MESSAGE;
        }
        if (!isEmpty(errorMessage)) {
            logger.error('VPC validation error:', errorMessage);
            throw createError(HttpErrorCodes.VALIDATION_ERROR, errorMessage!);
        }
    }

    const derivedParams = generateDeploymentParams(
        DatabaseTypes.PG_SQL,
        fsxConfiguration.databaseSize,
        Boolean(fsxConfiguration.fsxFileSystemId),
        sqlConfiguration.sqlDeploymentMode,
        fsxConfiguration.fsxVolThroughput,
        fsxConfiguration.fsxIOPS
    );

    const { roleName, providerAccountId } = await getRoleDetails(credentialsId);

    const customMasterTemplatePath: string = `${WLMDB}/${derivedParams.StackName}/${PGSQL_MASTER_TEMPLATE_PATH}`;

    const signedMasterTemplateUrl = await getPreSignedUrl(
        TEMPLATE_BUCKET_REGION,
        SIGNED_TEMPLATES_BUCKET_NAME,
        customMasterTemplatePath
    );

    const encodedSignedMasterTemplateURL = encodeURIComponent(signedMasterTemplateUrl);
    logger.info('Signed master url ', encodedSignedMasterTemplateURL);

    const validationAmiImage = sqlConfiguration.sqlAmiId;

    const accountId = getAsyncLocalStorageResource<string>(ACCOUNT_ID);
    const { token } = generateAuthToken({ email: 'SYSTEM@netapp.com' });

    const { awsAccountId } = derivePropertiesFromARN(process.env.AWS_ROLE_ARN as string) || {};

    const { privateSubnet1Cidr, privateSubnet2Cidr } = await getSubnetsCidr(
        credentialsId!,
        region!,
        networkConfiguration,
        sqlConfiguration.sqlDeploymentMode
    );

    const { servicesWithNoEndpoint = [], missingRoutesInS3 = [] } =
        credentialsId && region
            ? await endpointsValidationResults(
                  credentialsId,
                  region,
                  networkConfiguration,
                  sqlConfiguration.sqlDeploymentMode,
                  privateSubnet1Cidr,
                  privateSubnet2Cidr
              )
            : {};

    const templateParamsAsList: Array<Parameter> = [
        { ParameterKey: CF_DEPLOY_ROLE_NAME, ParameterValue: roleName },
        { ParameterKey: VALIDATION_AMI, ParameterValue: validationAmiImage },
        { ParameterKey: VALIDATION_INSTANCE_TYPE, ParameterValue: VALIDATION_NODE_INSTANCETYPE },
        { ParameterKey: TEMPLATE_ACCOUNT_ID, ParameterValue: accountId },
        { ParameterKey: TEMPLATE_CLOUD_PROVIDER_ID, ParameterValue: providerAccountId },
        { ParameterKey: TEMPLATE_CREDENTIALS_ID, ParameterValue: credentialsId },
        { ParameterKey: TEMPLATE_WLMDB_AWS_ACCOUT_ID, ParameterValue: awsAccountId },
        { ParameterKey: TEMPLATE_JWT_TOKEN, ParameterValue: token },
        { ParameterKey: TEMPLATE_S3GATEWAY_ROUTETABLES, ParameterValue: missingRoutesInS3.toString() },
        { ParameterKey: TEMPLATE_PRIVATESUBNET1_CIDRBLOCK, ParameterValue: privateSubnet1Cidr },
        { ParameterKey: TEMPLATE_PRIVATESUBNET2_CIDRBLOCK, ParameterValue: privateSubnet2Cidr }
    ];

    let templateParams: string = `stackName=${derivedParams.StackName}&param_${CF_DEPLOY_ROLE_NAME}=${roleName}&param_${VALIDATION_AMI}=${validationAmiImage}&param_${VALIDATION_INSTANCE_TYPE}=${VALIDATION_NODE_INSTANCETYPE}&param_${TEMPLATE_ACCOUNT_ID}=${accountId}&param_${TEMPLATE_JWT_TOKEN}=${token}&param_${TEMPLATE_CREDENTIALS_ID}=${credentialsId}&param_${TEMPLATE_CLOUD_PROVIDER_ID}=${providerAccountId}&param_${TEMPLATE_WLMDB_AWS_ACCOUT_ID}=${awsAccountId}`;

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

    const fsxUsernameDetails = splitDomainUsername(fsxConfiguration.fsxUsername || '');
    // const sqlUsernameDetails = splitDomainUsername(sqlConfiguration.serviceAccountName);
    templateParams += `&param_${TEMPLATE_USERNAME_MAPPING.FSxAdminUsername}=${
        fsxUsernameDetails?.username || fsxConfiguration.fsxUsername || ''
    }`;
    // templateParams += `&param_${TEMPLATE_USERNAME_MAPPING.SQLServiceAccountName}=${
    //     sqlUsernameDetails?.username || sqlConfiguration.serviceAccountName
    // }`;

    const {
        Images: [
            {
                BlockDeviceMappings: [{ Ebs: { VolumeSize: amiVolumeSize = EBS_DEFAULT_VOLUME_SIZE } = {} } = {}] = []
            } = {}
        ] = []
    } = await getAmis(credentialsId, region, {
        ImageIds: [sqlConfiguration.sqlAmiId ? sqlConfiguration.sqlAmiId : '']
    });

    const amiSize = Math.max(amiVolumeSize, EBS_DEFAULT_VOLUME_SIZE);
    templateParams += `&param_${EBS_VOLUME_SIZE}=${amiSize}`;

    templateParamsAsList.push({
        ParameterKey: TEMPLATE_USERNAME_MAPPING.FSxAdminUsername,
        ParameterValue: fsxUsernameDetails?.username || fsxConfiguration.fsxUsername
    });

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

    // Add Parameter construct - description, type and others. Default is added if user has specified a value or a value specified by default
    const templateParamsInCfFormat = await formatTemplateParametersToCf(templateParamsAsList, DatabaseTypes.PG_SQL);

    // Generate Signed-url and upload to bucket
    await uploadTemplates(
        region!,
        DatabaseTypes.PG_SQL,
        derivedParams.StackName,
        tags?.map(({ key, value }) => ({ Key: key, Value: value })),
        customMasterTemplatePath,
        templateParamsInCfFormat
    );

    const signedTemplateURL = `${getCloudFormationStackUrl()}?region=${region}#/stacks/create/review?templateURL=${encodedSignedMasterTemplateURL}&${templateParams}`;

    logger.info('Cloud Formation template URL ', signedTemplateURL);

    return { cloudFormationUrl: signedTemplateURL };
}

export {
    createCloudFormationTemplateForUserDeployment,
    deployCloudFormationTemplate,
    deploymentStatus,
    deploymentStatusByName,
    getCloudformationTemplate,
    deployStackOrCreateTemplateURL,
    getFSXAvailableRegionsForThrougput,
    getCollationDetailsForDeployment,
    deployPgSql,
    getTerraformSetup,
    getPgSqlCfTemplate,
    getPGSQLTerraformSetup,
    getSubnetsCidr
};
