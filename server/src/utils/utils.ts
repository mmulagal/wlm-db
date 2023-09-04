/**
 * This file contains the utility functions
 * These functions can be re-used at different places and act as helper functions
 */
import createError from 'http-errors';
import { exec } from 'child_process';
import { getAsyncLocalStorageResource } from './async-local-storage';
import { trimEnd, trimStart } from 'lodash-es';
import jwt from 'jsonwebtoken';

import { getVpcsList, getWindowsServerBaseAmi } from '../operations/aws/ec2-operations';
import { currentCfStacksCount } from '../operations/aws/cloud-formation-operations';
import { getCfQuota, getVpcQuota } from '../operations/aws/service-quotas-operations';
import {
    SQL_AMI_NAMES,
    HttpErrorCodes,
    STACKS_DEPLOYED,
    WLMDB,
    EC2_ROLE_NAME,
    TEMPLATE_CONFIGURATION_MAPPING,
    WLM_ASSETS,
    USER_TOKEN,
    TEMPLATE_OPTIONAL_PARAMETERS,
    DEFAULT_AWS_REGION,
    FSX_SSD_MIN_SIZE,
    FSX_SSD_MAX_SIZE,
    VALIDATION_AMI,
    ACCOUNT_ID,
    TEMPLATE_CLOUD_PROVIDER_ID,
    TEMPLATE_CREDENTIALS_ID,
    TEMPLATE_JWT_TOKEN
} from './consts';
import getLogger, { hideSecretsValues } from './logger';
import { createSecrets } from '../operations/aws/secrets-manager-operations';
import {
    CFNetworkConfigurationType,
    EC2ConfigurationType,
    ADConfigurationType,
    FSXConfigurationType,
    SQLConfigurationType
} from '../routes/types/deployment.types';
import { Parameter } from '@aws-sdk/client-cloudformation';
import { getRoleName } from '../operations/cloud-manager/credentials-operations';
import { PrismaClient } from '@prisma/client';
import { getServiceToken } from '../lib/cloud-manager/tenancy';

const logger = getLogger();

const prisma: PrismaClient = new PrismaClient();

async function initializeDatabase() {
    await prisma.$connect();
}

async function execute(command: string, timeout?: number, cwd?: string) {
    logger.info('Executing command:', { command, timeout, cwd });

    return new Promise(resolve => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        exec(command, { cwd, timeout }, (error: any, stdout: any, stderr: any) => {
            if (error) {
                logger.error('Failed to execute shell commands', error);
            }
            resolve(stdout || stderr);
        });
    });
}

function filterSqlAmis(osVersion?: string, dbVersion?: string, dbEdition?: string) {
    logger.debug({ osVersion, dbEdition, dbVersion });
    return SQL_AMI_NAMES.filter(ami =>
        osVersion ? ami.toLowerCase().includes(`Windows_Server-${osVersion}`.toLowerCase()) : true
    )
        .filter(ami => (dbVersion ? ami.toLowerCase().includes(`SQL_${dbVersion}`.toLowerCase()) : true))
        .filter(ami => (dbEdition ? ami.toLowerCase().includes(dbEdition.toLowerCase()) : true));
}

async function isVpcQuotaReached(credentialsId: string, region: string) {
    logger.info('Performing vpc quota check in region ', { credentialsId, region });
    const quotaDetails = await getVpcQuota(credentialsId, region);
    const currentVpcCount = (await getVpcsList(credentialsId, region)).vpcs.length;
    return currentVpcCount == quotaDetails.vpcCountQuota;
}

async function isCfStackQuotaReached(credentialsId: string, region: string) {
    logger.info('Performing cloudformation stacks quota check in region ', region);
    const quotaDetails = await getCfQuota(credentialsId, region);
    const stacksCount = await currentCfStacksCount(credentialsId, region);
    if (!stacksCount.currentStacksCount) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Unable to get cloudformation stacks in region ${region} and credentials ${credentialsId}.`
        );
    }
    // We might deploy more than 1 stack and diff (cfstackquota, current deployed stacks) must be >= STACKS_DEPLOYED
    return (
        stacksCount.currentStacksCount == quotaDetails.cfCountQuota ||
        quotaDetails.cfCountQuota - stacksCount.currentStacksCount < STACKS_DEPLOYED
    );
}

function generateDeploymentParams(FSxDataLunSize: number, isExistingFSx: boolean) {
    const prefix = WLMDB;
    const suffix = Date.now();
    const randomDigits = generateRandomNumberInRange(10000, 99999);

    const FSxDataLunSizeInMib = FSxDataLunSize * 1024;

    // All these in MiB
    const FSxDataVolumeSize = Math.ceil(1.1 * FSxDataLunSizeInMib); // FSxDataLunSize + 10% of FSxDataLunSize
    const FSxLogVolumeSize = Math.ceil(0.25 * FSxDataVolumeSize); // 25% of FSxDataVolumeSize
    const FSxTempDbVolumeSize = Math.ceil(0.1 * FSxDataVolumeSize); // 10% of FSxDataVolumeSize
    const FSxQuorumVolumeSize = 12000; // 12GB

    // StorageCapacity in GiB
    let FSxStorageCapacity = Math.ceil(
        (FSxDataVolumeSize + FSxLogVolumeSize + FSxTempDbVolumeSize + FSxQuorumVolumeSize) / 1024
    );

    FSxStorageCapacity = Math.max(FSxStorageCapacity, FSX_SSD_MIN_SIZE);
    FSxStorageCapacity = Math.min(FSxStorageCapacity, FSX_SSD_MAX_SIZE);

    return {
        UniqueID: suffix,
        StackName: `${prefix.toUpperCase()}-SQLFCIStack-${suffix}`,
        //VpcName: `${prefix}-vpc-${suffix}`,
        SqlFSxWSFCName: `WLMWSFC-${randomDigits}`,
        FSxFileSystemName: isExistingFSx ? '' : `${prefix}-fsx-${suffix}`,
        FSxDataVolumeName: `${prefix}_sqldata_${suffix}`,
        FSxDataVolumeSize,
        FSxLogVolumeName: `${prefix}_sqllog_${suffix}`,
        FSxLogVolumeSize, // 25% of FSxDataVolumeSize
        FSxTempDbVolumeName: `${prefix}_sqltemp_${suffix}`,
        FSxTempDbVolumeSize, // 10% of FSxDataVolumeSize
        FSxQuorumVolumeName: `${prefix}_quorum_${suffix}`,
        FSxQuorumVolumeSize,
        FSxSvmName: `${prefix}_svm_${suffix}`,
        SQLigroupname: `${prefix}_sqligroup_${suffix}`,
        SQLSvmName: `${prefix}_sqlsvm_${suffix}`,
        NodeNetBIOSNames: [`sqlnode1-${randomDigits}`, `sqlnode2-${randomDigits}`],
        DomainAdminSecretName: `${prefix}-domain-${suffix}`,
        FSxAdministratorPasswordSecret: `${prefix}-fsx${suffix}`,
        SQLServiceAccountSecret: `${prefix}-sql-${suffix}`,
        FSxStorageCapacity,
        FSxDataLunSize: FSxDataLunSizeInMib
    };
}

function generateRandomNumberInRange(min: number, max: number) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

// Get xAgentId from bearer token
function getSubjectFromBearerToken() {
    const token = getAsyncLocalStorageResource<string>(USER_TOKEN);
    const tokenWithoutBearerPrefix = trimStart(token, 'Bearer').trim();
    const tokenWithoutBearerSuffix = trimEnd(tokenWithoutBearerPrefix, 'clients').trim();
    const decodedToken = jwt.decode(tokenWithoutBearerSuffix, { complete: true });
    return decodedToken?.payload.sub;
}

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
        ? generateDeploymentParams(fsxConfiguration.databaseSize, true)
        : generateDeploymentParams(fsxConfiguration.databaseSize, false);

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
    const { token } = await getServiceToken();

    const templateParams: Array<Parameter> = [
        { ParameterKey: EC2_ROLE_NAME, ParameterValue: roleName },
        { ParameterKey: VALIDATION_AMI, ParameterValue: validationAmiImage },
        { ParameterKey: ACCOUNT_ID, ParameterValue: accountId },
        { ParameterKey: TEMPLATE_CLOUD_PROVIDER_ID, ParameterValue: providerAccountId },
        { ParameterKey: TEMPLATE_CREDENTIALS_ID, ParameterValue: credentialsId },
        { ParameterKey: TEMPLATE_JWT_TOKEN, ParameterValue: token }
    ];

    Object.entries(derivedParams).forEach(([key, value]) => {
        if (key != 'StackName') {
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

    return { stackName: stackName, templateParameters: templateParams };
}

function isSameRoutetables(networkConfiguration: CFNetworkConfigurationType) {
    return (
        'routeTable1Id' in networkConfiguration &&
        'routeTable2Id' in networkConfiguration &&
        networkConfiguration.routeTable1Id === networkConfiguration.routeTable2Id
    );
}
function isValidJsonString(str: string | undefined) {
    try {
        if (str) {
            return { isValid: true, message: JSON.parse(str) };
        }
        return { isValid: false };
    } catch (err) {
        return { isValid: false };
    }
}

function getQueueArn(accountId: string, queueName: string) {
    return `arn:aws:sqs:${DEFAULT_AWS_REGION}:${accountId}:${queueName}`;
}

function getQueueUrl(accountId: string, queueName: string) {
    return `https://sqs.${DEFAULT_AWS_REGION}.amazonaws.com/${accountId}/${queueName}`;
}

function derivePropertiesFromARN(awsResourceArn: string) {
    const ARN_FORMAT = /arn:aws:(?<awsServiceName>.+):(?<region>.+):(?<awsAccountId>.+):(?<resourceName>.+)/;
    if (ARN_FORMAT.test(awsResourceArn)) {
        const matchResult = awsResourceArn.match(ARN_FORMAT);
        if (matchResult && matchResult.groups) {
            const { awsServiceName, region, awsAccountId, resourceName } = matchResult.groups;

            return {
                awsServiceName,
                region,
                awsAccountId,
                resourceName
            };
        }
    }
}

async function waitFor(ms: number) {
    await new Promise(resolve => setTimeout(resolve, ms));
}

export {
    prisma,
    execute,
    initializeDatabase,
    filterSqlAmis,
    isVpcQuotaReached,
    isCfStackQuotaReached,
    generateDeploymentParams,
    formatTemplateParameters,
    getSubjectFromBearerToken,
    hideSecretsValues,
    isSameRoutetables,
    isValidJsonString,
    getQueueArn,
    getQueueUrl,
    derivePropertiesFromARN,
    waitFor
};
