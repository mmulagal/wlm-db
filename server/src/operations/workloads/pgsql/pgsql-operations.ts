import createError from 'http-errors';
import { generateHash } from '../../../utils/utils';
import { executeBashSsmCommand } from '../../aws/ssm-operations';
import getLogger from '../../../utils/logger';
import { getParameter } from '../../../lib/aws/ssm';
import { SSM_PARAM_PREFIX } from '../../../utils/consts';

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

async function getPgSqlDatabaseCount(
    accountId: string,
    credentialsId: string,
    region: string,
    node1InstanceId: string
) {
    logger.info('Fetching pg sql database count', accountId, credentialsId, region, node1InstanceId);

    try {
        const command = 'sudo -u postgres /usr/bin/psql -t -A -c "Select Count(*) from pg_database"';
        const response = await executeBashSsmCommand(credentialsId, region, [command], node1InstanceId, accountId);

        if (response) {
            return response;
        }
        const errorMessage = `Error fetching database count from nodes: ${node1InstanceId}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    } catch (err) {
        const errorMessage = `Error fetching pgsql database count: ${err}, ${credentialsId}, ${region}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

async function getPgSqlDataMountedVolume(credentialsId: string, region: string, node1InstanceId: string) {
    logger.info('Fetching pg sql data volume mount point', { credentialsId, region, node1InstanceId });
    const commands = [
        // eslint-disable-next-line quotes
        "findmnt -n -o SOURCE $(sudo systemctl cat postgresql | grep Environment=PGDATA | awk -F= '/Environment=PGDATA=/ {print $3}')"
    ];
    let response;
    try {
        response = await executeBashSsmCommand(credentialsId, region, commands, node1InstanceId);
        const mountedVolume = response?.split(':')[1]?.substring(1)?.trim();
        return mountedVolume;
    } catch (err) {
        const errorMessage = `Error fetching pgsql data volume mount point:,
            ${err},
            ${credentialsId},
            ${region},
            ${node1InstanceId}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

function getPgSqlResourceId(node1InstanceId: string, node2InstanceId?: string) {
    logger.info('Get MS SQL resource ID:', { node1InstanceId, node2InstanceId });
    return node2InstanceId ? generateHash(node1InstanceId + node2InstanceId) : generateHash(node1InstanceId);
}

async function getPgSqlStorageSavingsVolumeData(
    accountId: string,
    credentialsId: string,
    region: string,
    node1InstanceId: string,
    fsxNId: string
) {
    logger.info('Fetching storage savings volume data', { accountId, credentialsId, region, node1InstanceId, fsxNId });
    let response;
    try {
        const mountedVolume = await getPgSqlDataMountedVolume(credentialsId, region, node1InstanceId);
        const apiEndpoint = `https://management.${fsxNId}.fsx.${region}.amazonaws.com/api/storage/volumes?fields=efficiency.space_savings.total,efficiency.space_savings.total_percent,space.size,space.used&name=${mountedVolume}`;

        const fsxCredentials = await getParameter(credentialsId, region, `${SSM_PARAM_PREFIX}${fsxNId}`);
        const fsxCreds = JSON.parse(fsxCredentials!.replace(/'/g, '"').replace(/(\w+):/g, '"$1":')); // converts single quotes to double quotes and add double quotes to keys
        const auth: string = Buffer.from(`${fsxCreds?.fsx?.username}:${fsxCreds?.fsx?.password}`).toString('base64');

        const commands = [`curl -k -sS -X GET '${apiEndpoint}' --header 'Authorization: Basic ${auth}' | jq '.'`];
        response = await executeBashSsmCommand(credentialsId, region, commands, node1InstanceId);

        const { records } = JSON.parse(response!);
        const volSavingsData = records?.[0];
        const instanceStorageSavingsInfo = {
            fsxn: {
                spaceSavings: volSavingsData.efficiency.space_savings.total,
                spaceSavingsPercentage: volSavingsData.efficiency.space_savings.total_percent,
                size: volSavingsData.space.size,
                used: volSavingsData.space.used,
                protocol: ['NFS']
            }
        };
        logger.debug('Instance Storage Savings Data:', instanceStorageSavingsInfo);
        return instanceStorageSavingsInfo;
    } catch (err) {
        const errorMessage = `Error fetching storage savings volume data:,
            ${err},
            ${credentialsId},
            ${region}`;
        logger.error(errorMessage);
    }
}

export {
    getPgSqlResourceId,
    getPgSqlInstanceInfo,
    getPgSqlStorageSavingsVolumeData,
    getPgSqlDataMountedVolume,
    getPgSqlDatabaseCount
};
