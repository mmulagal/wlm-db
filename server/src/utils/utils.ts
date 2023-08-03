/**
 * This file contains the utility functions
 * These functions can be re-used at different places and act as helper functions
 */
import createError from 'http-errors';
import { getVpcsList } from '../operations/aws/ec2-operations';
import { currentCfStacksCount } from '../operations/aws/cloud-formation-operations';
import { getCfQuota, getVpcQuota } from '../operations/aws/service-quotas-operations';
import { SQL_AMI_NAMES, HttpErrorCodes, STACKS_DEPLOYED, WLMDB } from './consts';

import getLogger from './logger';

const logger = getLogger();

function filterSqlAmis(osVersion?: string, dbVersion?: string, dbEdition?: string) {
    logger.debug({ osVersion, dbEdition, dbVersion });
    return SQL_AMI_NAMES.filter(name => (osVersion ? name.includes(`Windows_Server-${osVersion}`) : true))
        .filter(name => (dbVersion ? name.includes(`SQL_${dbVersion}`) : true))
        .filter(name => (dbEdition ? name.includes(dbEdition) : true));
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

    const FSxDataVolumeSize = 1.1 * FSxDataLunSize; // FSxDataLunSize + 10% of FSxDataLunSize

    return {
        StackName: `${prefix.toUpperCase()}-SQLFCIStack-${suffix}`,
        VpcName: `${prefix}-vpc-${suffix}`,
        WSFClusterName: `WLMWSFC-${generateRandomNumberInRange(10000, 99999)}`,
        FSxFileSystemName: `${prefix}-fsx-${suffix}`,
        FSxDataVolumeName: `${prefix}-sqldata-${suffix}`,
        FSxDataVolumeSize,
        FSxLogVolumeName: `${prefix}-sqllog-${suffix}`,
        FSxLogVolumeSize: 0.25 * FSxDataVolumeSize, // 25% of FSxDataVolumeSize
        FSxTempDBVolumeName: `${prefix}-sqltemp-${suffix}`,
        FSxTempDBVolumeSize: 0.1 * FSxDataVolumeSize, // 10% of FSxDataVolumeSize
        FSxQuorumVolumeName: `${prefix}-quorum-${suffix}`,
        FSxSvmName: `${prefix}-svm-${suffix}`,
        SQLigroupname: `${prefix}-sqligroup-${suffix}`,
        SQLSvmName: `${prefix}-sqlsvm-${suffix}`,
        NodeNetBIOSNames: [`${prefix}-node1-${suffix}`, `${prefix}-node2-${suffix}`],
        DomainAdminSecretName: `${prefix}-DOMAIN-${suffix}`,
        FSxAdministratorPasswordSecret: `${prefix}-FSX-${suffix}`,
        SQLServiceAccountSecret: `${prefix}-SQL-${suffix}`
    };
}

function generateRandomNumberInRange(min: number, max: number) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

export { filterSqlAmis, isVpcQuotaReached, isCfStackQuotaReached, generateFsxParams };
