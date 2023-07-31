/**
 * This file contains the utility functions
 * These functions can be re-used at different places and act as helper functions
 */
import createError from 'http-errors';
import { getSecretsManagerClient, createSecret } from '../lib/aws/secrets-manager';
import { getVpcsList } from '../operations/aws/ec2-operations';
import { vpcQuota, cfQuota } from '../operations/aws/service-quotas-operations';
import { currentCfStacksCount } from '../operations/aws/cloud-formation-operations';
import { SQL_AMI_NAMES, HttpErrorCodes } from './consts';
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
    const quotaDetails = await vpcQuota(credentialsId, region);
    const currentVpcCount = (await getVpcsList(credentialsId, region)).vpcs.length;
    if (currentVpcCount == quotaDetails.vpcCountQuota) {
        return true;
    }
    return false;
}

async function isCfStackQuotaReached(credentialsId: string, region: string) {
    logger.info('Performing cloudformation stacks quota check in region ', region);
    const quotaDetails = await cfQuota(credentialsId, region);
    const stacksCount = await currentCfStacksCount(credentialsId, region);
    if (!stacksCount.currentStacksCount) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Unable to get cloudformation stacks in region ${region} and credentials ${credentialsId}.`
        );
    }
    if (
        stacksCount.currentStacksCount == quotaDetails.cfCountQuota ||
        quotaDetails.cfCountQuota - stacksCount.currentStacksCount < 5
    ) {
        return true;
    }
    return false;
}

async function createSecretsString(
    credentialsId: string,
    region: string,
    secretName: string,
    username: string,
    password: string
) {
    logger.info(`Creating ${secretName} secret in region ${region} with credentials ${credentialsId}.`);
    const secretsManagerClient = await getSecretsManagerClient(credentialsId, region);
    const resp = await createSecret(secretsManagerClient, secretName, username, password);
    return resp.Name;
}
export { filterSqlAmis, isVpcQuotaReached, isCfStackQuotaReached, createSecretsString };
