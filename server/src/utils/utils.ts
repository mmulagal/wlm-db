/**
 * This file contains the utility functions
 * These functions can be re-used at different places and act as helper functions
 */
import createError from 'http-errors';
import { getVpcsList } from '../operations/aws/ec2-operations';
import { currentCfStacksCount } from '../operations/aws/cloud-formation-operations';
import { getCfQuota, getVpcQuota } from '../operations/aws/service-quotas-operations';
import {
    SQL_AMI_NAMES,
    HttpErrorCodes,
    STACKS_DEPLOYED,
    WLMDB,
    EC2_ROLE_NAME,
    TEMPLATE_CONFIGURATION_MAPPING,
    WLM_ASSETS
} from './consts';

import getLogger from './logger';
import { round } from 'lodash-es';
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

const logger = getLogger();

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

function generateFsxParams(FSxDataLunSize: number) {
    const prefix = WLMDB;
    const suffix = Date.now();
    const randomDigits = generateRandomNumberInRange(10000, 99999);

    const FSxDataVolumeSize = round(1.1 * FSxDataLunSize); // FSxDataLunSize + 10% of FSxDataLunSize
    const FSxLogVolumeSize = round(0.25 * FSxDataVolumeSize); // 25% of FSxDataVolumeSize
    const FSxTempDbVolumeSize = round(0.1 * FSxDataVolumeSize); // 10% of FSxDataVolumeSize
    const FSxQuorumVolumeSize = 10000; // 10GB
    const FSxStorageCapacity = round(FSxDataVolumeSize + FSxLogVolumeSize + FSxTempDbVolumeSize + FSxQuorumVolumeSize);

    return {
        UniqueID: suffix,
        StackName: `${prefix.toUpperCase()}-SQLFCIStack-${suffix}`,
        //VpcName: `${prefix}-vpc-${suffix}`,
        SqlFSxWSFCName: `WLMWSFC-${randomDigits}`,
        FSxFileSystemName: `${prefix}-fsx-${suffix}`,
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
        DomainAdminSecretName: `${prefix}-DOMAIN-${suffix}`,
        FSxAdministratorPasswordSecret: `${prefix}-FSX-${suffix}`,
        SQLServiceAccountSecret: `${prefix}-SQL-${suffix}`,
        FSxStorageCapacity
    };
}

function generateRandomNumberInRange(min: number, max: number) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

async function formatTemplateParameters(
    credentialsId: string,
    region: string,
    networkConfiguration: CFNetworkConfigurationType,
    ec2Configuration: EC2ConfigurationType,
    adConfiguration: ADConfigurationType,
    fsxConfiguration: FSXConfigurationType,
    sqlConfiguration: SQLConfigurationType
) {
    const derivedParams = generateFsxParams(fsxConfiguration.databaseSize);

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

    const stackName = derivedParams.StackName;
    const { roleName } = await getRoleName(credentialsId);
    const templateParams: Array<Parameter> = [{ ParameterKey: EC2_ROLE_NAME, ParameterValue: roleName }];

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
        ...ec2Configuration
    };

    Object.entries(clubbedParamList).forEach(([key, value]) => {
        templateParams.push({
            ParameterKey: TEMPLATE_CONFIGURATION_MAPPING[key],
            ParameterValue: value.toString()
        });
    });

    Object.entries(WLM_ASSETS).forEach(([key, value]) => {
        templateParams.push({
            ParameterKey: key,
            ParameterValue: value.toString()
        });
    });

    return { stackName: stackName, templateParameters: templateParams };
}
export { filterSqlAmis, isVpcQuotaReached, isCfStackQuotaReached, generateFsxParams, formatTemplateParameters };
