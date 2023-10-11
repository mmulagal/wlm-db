import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import { listResources } from '../lib/database/db';
import {
    DatabaseHostSummaryResponseType,
    DatabaseHostSummaryListResponseType,
    PerformanceResponseType
} from '../routes/types/database-hosts.types';
import { DatabaseHostsQueryFields, HttpErrorCodes } from '../utils/consts';
import getLogger from '../utils/logger';
import { getServerIOLatency, getServerState } from './workloads/mssql/mssql-operations';

const logger = getLogger();

async function getDatabaseHostsSummary(
    accountId: string,
    fields?: string
): Promise<DatabaseHostSummaryListResponseType> {
    logger.info('Fetching all database hosts deployed in account ', accountId, fields);

    const resourceDetails = await listResources(accountId);

    if (isEmpty(resourceDetails)) {
        throw createError(HttpErrorCodes.NOT_FOUND, `No database hosts found for account ${accountId}.`);
    }

    let fieldsValues: Array<string> = [];

    if (fields) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    }

    const databaseHosts: DatabaseHostSummaryResponseType[] = [];
    try {
        await Promise.all(
            resourceDetails.map(async resource => {
                const { resource_id: resourceId, resource_name: resourceName } = resource;

                // Fetch server status
                let serverStatus = 'N/A';
                try {
                    serverStatus = await getServerState(resourceId);
                } catch (error) {
                    logger.error('Error while fetching status for server ', accountId, resourceId, error);
                }

                // Fetch io latency data
                let performanceData: PerformanceResponseType;
                if (fieldsValues?.includes(DatabaseHostsQueryFields.PERFORMANCE)) {
                    try {
                        performanceData = await getServerIOLatency(resourceId);
                    } catch (error) {
                        logger.error('Error while fetching io latency for server ', accountId, resourceId, error);
                    }
                }

                databaseHosts.push({
                    id: resourceId,
                    name: resourceName || '',
                    status: serverStatus,
                    performance: performanceData!
                });
            })
        );
    } catch (error) {
        logger.error(`Error while fetching database hosts details ${accountId}, ${error}`);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Error while fetching database hosts details ${accountId}, ${error}`
        );
    }

    logger.debug('Database hosts details', databaseHosts);

    return { count: databaseHosts.length, items: databaseHosts, nextToken: '' };
}

export default getDatabaseHostsSummary;
