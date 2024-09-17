import getLogger from '../../utils/logger';
import { prisma } from '../../utils/prisma-utils';

const logger = getLogger();

interface HostConfigData {
    account_id: string;
    credentials_id: string;
    region: string;
    resource_id: string;
    database_instance_id: string;
    timestamp: Date;
    last_updated?: Date;
    config_data: object;
    config_data_type: string;
}
async function createHostConfigData(records: HostConfigData[]) {
    logger.info('Creating host config data', { records });

    return prisma.client.database_instance_config_data.createMany({
        data: records
    });
}

async function listHostConfigData(
    accountId?: string,
    region?: string,
    credentialsId?: string,
    resourceId?: string,
    databaseInstanceId?: string,
    configDataType?: string
) {
    logger.info('Listing host config data', {
        accountId,
        region,
        credentialsId,
        resourceId,
        databaseInstanceId,
        configDataType
    });

    return prisma.client.database_instance_config_data.findMany({
        where: {
            ...(accountId && { account_id: accountId }),
            ...(region && { region }),
            ...(credentialsId && { credentials_id: credentialsId }),
            ...(resourceId && { resource_id: resourceId }),
            ...(databaseInstanceId && { database_instance_id: databaseInstanceId }),
            ...(configDataType && { config_data_type: configDataType })
        }
    });
}

async function removeHostConfigData(
    id?: string[],
    accountId?: string,
    region?: string,
    credentialsId?: string,
    resourceId?: string,
    databaseInstanceId?: string
) {
    logger.info('Removing host config data', { id, accountId, region, credentialsId, resourceId, databaseInstanceId });

    return prisma.client.database_instance_config_data.deleteMany({
        where: {
            OR: [
                ...(id ? [{ id: { in: id } }] : []),
                ...(region ? [{ region }] : []),
                ...(accountId ? [{ account_id: accountId }] : []),
                ...(credentialsId ? [{ credentials_id: credentialsId }] : []),
                ...(resourceId ? [{ resource_id: resourceId }] : []),
                ...(databaseInstanceId ? [{ database_instance_id: databaseInstanceId }] : [])
            ]
        }
    });
}

export { createHostConfigData, listHostConfigData, removeHostConfigData };
