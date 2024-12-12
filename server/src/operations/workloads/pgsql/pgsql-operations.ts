import createError from 'http-errors';
import { generateHash } from '../../../utils/utils';
import { executeBashSsmCommand } from '../../aws/ssm-operations';
import getLogger from '../../../utils/logger';

const logger = getLogger();

async function getPgSqlInstanceInfo(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceName: string,
    nodeIds: string[],
    fsxDataVolumeName: string
) {
    logger.info('Fetching pg sql instance info', accountId, nodeIds, instanceName, fsxDataVolumeName);
    const commands = [`sudo -u postgres pg_controldata /${fsxDataVolumeName} | jq -R -s -c 'split("\\n")[:-1]'`];
    let response;
    try {
        for (const nodeId of nodeIds) {
            logger.info('Fetching PGSQL instance GUID', nodeId);
            response = await executeBashSsmCommand(credentialsId, region, commands, nodeId, accountId);
            if (response) {
                return response;
            }
        }

        if (!response) {
            const errorMessage = `Error fetching instance info from nodes: ${nodeIds.join(', ')}`;
            logger.error(errorMessage);
            throw createError(errorMessage);
        }
    } catch (err) {
        const errorMessage = `Error fetching pgsql instance id:,
            ${err},
            ${credentialsId},
            ${region},
            ${instanceName},`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

async function getPgSqlDatabaseCount(accountId: string, credentialsId: string, region: string, nodeIds: string[]) {
    logger.info('Fetching pg sql database count', accountId, region, nodeIds);

    const command = 'sudo -u postgres /usr/bin/psql -c "Select Count(*) from pg_database"';

    try {
        const responses = await Promise.all(
            nodeIds.map(async nodeId => {
                logger.info('Fetching PGSQL database count', nodeId);
                return executeBashSsmCommand(credentialsId, region, [command], nodeId, accountId);
            })
        );

        const validResponse = responses.find(response => response);
        if (validResponse) {
            return validResponse;
        }

        const errorMessage = `Error fetching database count from nodes: ${nodeIds.join(', ')}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    } catch (err) {
        const errorMessage = `Error fetching pgsql database count: ${err}, ${credentialsId}, ${region}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

function getPgSqlResourceId(node1InstanceId: string, node2InstanceId?: string) {
    logger.info('Get MS SQL resource ID:', { node1InstanceId, node2InstanceId });
    return node2InstanceId ? generateHash(node1InstanceId + node2InstanceId) : generateHash(node1InstanceId);
}

export { getPgSqlResourceId, getPgSqlInstanceInfo, getPgSqlDatabaseCount };
