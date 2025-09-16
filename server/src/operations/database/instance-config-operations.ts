import {
    countDatabaseInstanceConfigRecords,
    listDatabaseInstanceConfigData
} from '../../lib/database/database-instance-config';
import { DatabaseInstanceConfigData, ListDatabaseInstanceConfigDataParams } from '../../lib/database/db-types';
import getLogger from '../../utils/logger';
import { checkAccount, getNextToken } from '../../utils/utils';

const logger = getLogger();

async function paginateListInstanceConfigData(
    params: ListDatabaseInstanceConfigDataParams & { databaseInstanceId?: string }
): Promise<{
    totalCount: number;
    items: DatabaseInstanceConfigData[];
    nextToken?: string;
}> {
    logger.info('Paginating list of database instance config data', params);

    const { accountId, pageSize, databaseInstanceId } = params;
    const normalizedParams = {
        ...params,
        ...(databaseInstanceId && { databaseInstanceIds: [databaseInstanceId] }),
        ...(accountId && { accountId: checkAccount(accountId) })
    };

    const [items, totalResourcesCount] = await Promise.all([
        listDatabaseInstanceConfigData(normalizedParams),
        pageSize ? countDatabaseInstanceConfigRecords(normalizedParams) : Promise.resolve(0)
    ]);

    return {
        totalCount: totalResourcesCount ?? 0,
        items: items ?? [],
        ...(pageSize && { nextToken: getNextToken(items, totalResourcesCount, pageSize) })
    };
}

export { paginateListInstanceConfigData };
