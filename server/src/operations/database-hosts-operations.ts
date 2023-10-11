import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import { listResources } from '../lib/database/db';
import {
    DatabaseHostSummaryResponseType,
    DatabaseHostSummaryListResponseType
} from '../routes/types/database-hosts.types';
import { HttpErrorCodes } from '../utils/consts';
import getLogger from '../utils/logger';
import { callSsmExecution, getResourceDetails } from './workloads/mssql/mssql-operations';
import { PSSCRIPT, SERVER_STATE } from './workloads/mssql/const';

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

    const databaseHosts: DatabaseHostSummaryResponseType[] = [];
    try {
        await Promise.all(
            resourceDetails.map(async resource => {
                const { resource_id: resourceId, resource_name: resourceName } = resource;

                const [credentialsId, region, activeNodeInstanceId, standbyNodeInstanceId] = await getResourceDetails(
                    resourceId
                );
                let serverStatus = 'N/A';
                try {
                    const serverStatusInfo = await callSsmExecution(
                        credentialsId!,
                        region!,
                        [`${PSSCRIPT} -Query "${SERVER_STATE}"`],
                        activeNodeInstanceId!,
                        standbyNodeInstanceId!
                    );
                    serverStatus = serverStatusInfo!.replace(/[\r\n.]/g, '');
                } catch (error) {
                    logger.error('Error while fetching status for server ', accountId, resourceId, error);
                }
                databaseHosts.push({ id: resourceId, name: resourceName || '', status: serverStatus });
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
