/**
 * This file contains the utility functions
 * These functions can be re-used at different places and act as helper functions
 */
import { getVpcsList } from '../operations/aws/ec2-operations';
import { regionQuotas } from '../operations/aws/service-quotas-operations';
import { currentCfStacksCount } from '../operations/aws/cloud-formation-operations';
import { SQL_AMI_NAMES } from './consts';
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
    const quotaDetails = await regionQuotas(credentialsId, region);
    const currentVpcCount = (await getVpcsList(credentialsId, region)).vpcs.length;
    if (currentVpcCount == quotaDetails.vpcCountQuota) {
        return true;
    }
    return false;
}

async function isCfStackQuotaReached(credentialsId: string, region: string) {
    logger.info('Performing cloudformation stacks quota check in region ', region);
    const quotaDetails = await regionQuotas(credentialsId, region);
    const stacksCount = await currentCfStacksCount(credentialsId, region);
    if (
        stacksCount.currentStacksCount == quotaDetails.cfCountQuota ||
        quotaDetails.cfCountQuota - stacksCount.currentStacksCount < 5
    ) {
        return true;
    }
    return false;
}

export { filterSqlAmis, isVpcQuotaReached, isCfStackQuotaReached };
