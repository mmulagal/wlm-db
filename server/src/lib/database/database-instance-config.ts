import getLogger from '../../utils/logger';
import { prisma } from '../../utils/prisma-utils';
import { checkAccount } from './db';

const logger = getLogger();

interface DatabaseInstanceConfigData {
    account_id: string;
    credentials_id: string;
    region: string;
    resource_id: string;
    database_instance_id: string;
    creation_time: Date;
    last_updated?: Date;
    config_data: object;
    config_data_type: string;
}
async function createDatabaseInstanceConfigData(records: DatabaseInstanceConfigData[]) {
    logger.info('Creating database instance config data', { records });
    records.forEach(record => {
        record.account_id = checkAccount(record.account_id);
    });
    return prisma.client.database_instance_config_data.createMany({
        data: records
    });
}

async function listDatabaseInstanceConfigData(
    accountId?: string,
    region?: string,
    credentialsId?: string,
    resourceId?: string,
    databaseInstanceId?: string,
    configDataType?: string,
    sort: string = 'creation_time',
    sortOrder: string = 'desc'
) {
    logger.info('Listing database instance config data', {
        accountId,
        region,
        credentialsId,
        resourceId,
        databaseInstanceId,
        configDataType
    });
    accountId = checkAccount(accountId!);

    return prisma.client.database_instance_config_data.findMany({
        where: {
            ...(accountId && { account_id: accountId }),
            ...(region && { region }),
            ...(credentialsId && { credentials_id: credentialsId }),
            ...(resourceId && { resource_id: resourceId }),
            ...(databaseInstanceId && { database_instance_id: databaseInstanceId }),
            ...(configDataType && { config_data_type: configDataType })
        },
        orderBy: [
            {
                [sort]: `${sortOrder}`
            }
        ],
        include: {
            database_instances: true,
            resource: true
        }
    });
}

async function removeDatabaseInstanceConfigData(
    id?: string[],
    accountId?: string,
    region?: string,
    credentialsId?: string,
    resourceId?: string,
    databaseInstanceId?: string
) {
    logger.info('Removing database instance config data', {
        id,
        accountId,
        region,
        credentialsId,
        resourceId,
        databaseInstanceId
    });

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

async function removeAllButLatestDatabaseInstanceConfigData(
    accountId: string,
    region: string,
    credentialsId: string,
    resourceId: string,
    databaseInstanceId: string,
    latestCreatedTime: Date
) {
    logger.info('Remove all but latest assessment data', {
        accountId,
        region,
        credentialsId,
        resourceId,
        databaseInstanceId,
        latestCreatedTime
    });

    return prisma.client.database_instance_config_data.deleteMany({
        where: {
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            resource_id: resourceId,
            database_instance_id: databaseInstanceId,
            creation_time: {
                lt: latestCreatedTime
            }
        }
    });
}

export {
    createDatabaseInstanceConfigData,
    listDatabaseInstanceConfigData,
    removeDatabaseInstanceConfigData,
    removeAllButLatestDatabaseInstanceConfigData
};
