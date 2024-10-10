import createError from 'http-errors';
import { generateHash } from '../../../utils/utils';
import { executeBashSsmCommand } from '../../aws/ssm-operations';
import getLogger from '../../../utils/logger';

const logger = getLogger();

async function getPgSqlInstanceId(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceName: string,
    nodeIds: string[]
) {
    logger.info('Fetching pg sql instance id', accountId, nodeIds, instanceName);
    const commands = [
        'sudo -u postgres pg_controldata /var/lib/pgsql/data | grep "Database system identifier" | awk \'{print $4}\''
    ];
    let response;
    try {
        let sqlInstanceId;

        for (const nodeId of nodeIds) {
            logger.info('Fetching PGSQL instance GUID', nodeId);
            response = await executeBashSsmCommand(credentialsId, region, commands, nodeId, accountId);
            if (response) {
                sqlInstanceId = response;
                return sqlInstanceId;
            }
        }

        if (!sqlInstanceId) {
            const errorMessage = `Error fetching instance id from nodes: ${nodeIds.join(', ')}`;
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

function getPgSqlResourceId(node1InstanceId: string, node2InstanceId?: string) {
    logger.info('Get MS SQL resource ID:', { node1InstanceId, node2InstanceId });
    return node2InstanceId ? generateHash(node1InstanceId + node2InstanceId) : generateHash(node1InstanceId);
}

export { getPgSqlResourceId, getPgSqlInstanceId };
