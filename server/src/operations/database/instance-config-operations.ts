import {
    countDatabaseInstanceConfigRecords,
    listDatabaseInstanceConfigData,
    removeAllButLatestDatabaseInstanceConfigData
} from '../../lib/database/database-instance-config';
import { ListDatabaseInstanceConfigDataParams } from '../../lib/database/db-types';
import getLogger from '../../utils/logger';
import { checkAccount, getNextToken } from '../../utils/utils';

const logger = getLogger();

async function purgeOlderAssessmentRecords() {
    logger.info('Purging older assessment records');
    const instanceAssessmentRecords = await listDatabaseInstanceConfigData({});
    instanceAssessmentRecords.forEach(
        async ({
            account_id: accountId,
            region,
            credentials_id: credentialsId,
            resource_id: resourceId,
            database_instance_id: databaseInstanceId,
            creation_time: creationTime
        }) => {
            await removeAllButLatestDatabaseInstanceConfigData(
                accountId,
                region,
                credentialsId,
                resourceId,
                databaseInstanceId,
                creationTime
            );
        }
    );
}

async function listInstanceConfigIncludingResourceAndInstance(params: ListDatabaseInstanceConfigDataParams) {
    logger.info('Listing database instance config data with resource and instance included', params);

    return listDatabaseInstanceConfigData({
        ...params,
        include: {
            database_instances: true,
            resource: true
        }
    });
}

async function paginateListInstanceConfigData(params: ListDatabaseInstanceConfigDataParams) {
    logger.info('Paginating list of database instance config data', params);

    const { select, accountId, pageSize } = params ?? {};
    if (accountId) {
        params = { ...params, accountId: checkAccount(accountId) };
    }

    if (select && !select.id && pageSize) {
        select.id = true; // Ensure id is always selected for pagination
    }
    params = { ...params, select };

    const [items, totalResourcesCount] = await Promise.all([
        listDatabaseInstanceConfigData(params),
        pageSize ? countDatabaseInstanceConfigRecords(params) : Promise.resolve(0)
    ]);

    return {
        count: items?.length,
        items,
        ...(pageSize && { nextToken: getNextToken(items, totalResourcesCount, pageSize) })
    };
}

export { purgeOlderAssessmentRecords, listInstanceConfigIncludingResourceAndInstance, paginateListInstanceConfigData };
