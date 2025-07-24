import { compact, isEmpty } from 'lodash-es';
import getLogger from '../../utils/logger';
import { prisma } from '../../utils/prisma-utils';
import { checkAccount } from './db';
import {
    CountDatabaseInstanceConfigRecordsParams,
    DatabaseInstanceConfigData,
    ListDatabaseInstanceConfigDataParams
} from './db-types';
import { buildSelectFields, addIncludeSelect } from '../../utils/utils';
import {
    INSTANCE_CONFIG_DEFAULT_SELECT_FIELDS,
    INSTANCE_DEFAULT_SELECT_FIELDS,
    RESOURCE_DEFAULT_SELECT_FIELDS
} from '../../utils/database-consts';

const logger = getLogger();

async function createDatabaseInstanceConfigData(records: DatabaseInstanceConfigData[]) {
    logger.info('Creating database instance config data', { records });
    records.forEach(record => {
        record.account_id = checkAccount(record.account_id);
    });
    return prisma.client.database_instance_config_data.createMany({
        data: records
    });
}

async function listDatabaseInstanceConfigData({
    accountId,
    region,
    credentialsId,
    resourceId,
    databaseInstanceId,
    configDataType,
    pageSize,
    nextToken,
    includeDatabaseInstance,
    includeResource,
    select,
    filters
}: ListDatabaseInstanceConfigDataParams) {
    logger.info('Listing database instance config data', {
        accountId,
        region,
        credentialsId,
        resourceId,
        databaseInstanceId,
        configDataType,
        pageSize,
        nextToken,
        includeDatabaseInstance,
        includeResource,
        select
    });

    accountId = checkAccount(accountId!);

    // Build the select object, including related tables if requested

    // Use default fields converted to object format when select is undefined
    const optimizedSelect = select || buildSelectFields(INSTANCE_CONFIG_DEFAULT_SELECT_FIELDS);

    // Determine final select strategy
    const finalSelect = {
        ...(optimizedSelect && !isEmpty(optimizedSelect) && optimizedSelect),
        ...(includeDatabaseInstance && addIncludeSelect('database_instances', INSTANCE_DEFAULT_SELECT_FIELDS)),
        ...(includeResource &&
            addIncludeSelect('resource', RESOURCE_DEFAULT_SELECT_FIELDS, {
                assessment_data: true,
                configurations: true
            }))
    };

    // Build optimized where clause
    const whereClause = {
        ...(accountId && { account_id: accountId }),
        ...(region && { region }),
        ...(credentialsId && { credentials_id: credentialsId }),
        ...(resourceId && { resource_id: resourceId }),
        ...(databaseInstanceId && { database_instance_id: databaseInstanceId }),
        ...(configDataType && { config_data_type: configDataType }),
        ...filters
    };

    // Build optimized query options
    const queryOptions = {
        where: whereClause,
        ...(finalSelect && { select: finalSelect }),
        ...(pageSize && pageSize > 0 && { take: pageSize }),
        ...(nextToken && {
            cursor: { id: nextToken },
            skip: 1
        })
    };

    const results = await prisma.client.database_instance_config_data.findMany(queryOptions);

    // Optimized sorting using a comparison function
    return results.sort((a, b) => {
        const dateA = new Date(a.creation_time).getTime();
        const dateB = new Date(b.creation_time).getTime();
        return dateB - dateA; // Sort by creation_time in descending order
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

async function deleteAllButLatestRecordPerConfigDataType() {
    logger.info('Deleting all but latest record per config data type');

    const latestRecords = await prisma.client.database_instance_config_data.groupBy({
        by: ['account_id', 'region', 'credentials_id', 'resource_id', 'database_instance_id', 'config_data_type'],
        _max: {
            creation_time: true
        }
    });

    const latestRecordCreationTimes = compact(latestRecords.map(record => record._max.creation_time));

    return prisma.client.database_instance_config_data.deleteMany({
        where: {
            creation_time: {
                notIn: latestRecordCreationTimes
            }
        }
    });
}

async function countDatabaseInstanceConfigRecords({
    accountId,
    region,
    credentialsId,
    resourceId,
    databaseInstanceId,
    configDataType,
    filters
}: CountDatabaseInstanceConfigRecordsParams): Promise<number> {
    logger.info('Counting database instance config records', {
        accountId,
        region,
        credentialsId,
        resourceId,
        databaseInstanceId,
        configDataType
    });

    const result = await prisma.client.database_instance_config_data.aggregate({
        _count: {
            id: true
        },
        where: {
            ...(accountId && { account_id: accountId }),
            ...(region && { region }),
            ...(credentialsId && { credentials_id: credentialsId }),
            ...(resourceId && { resource_id: resourceId }),
            ...(databaseInstanceId && { database_instance_id: databaseInstanceId }),
            ...(configDataType && { config_data_type: configDataType }),
            ...filters
        }
    });

    return result?._count?.id || 0;
}

export {
    createDatabaseInstanceConfigData,
    listDatabaseInstanceConfigData,
    removeDatabaseInstanceConfigData,
    deleteAllButLatestRecordPerConfigDataType,
    countDatabaseInstanceConfigRecords
};
