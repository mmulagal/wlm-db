import { CPU_UTILIZATION, DATABASES, SSM_RUN_POWERSHELL_SCRIPT_DOC, PSSCRIPT, TABLES_QUERY, TABLES_COUNT_QUERY } from './const';
import { executeSsmDocument } from '../aws/ssm';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function callSsmExecution(credentialsId: string, instanceId: string, region: string, commands: Array<string>) {
    const params = {
        DocumentName: SSM_RUN_POWERSHELL_SCRIPT_DOC,
        Documentversion: '1',
        InstanceIds: [instanceId],
        Parameters: {
            commands: commands
        }
    };
    const response = await executeSsmDocument(credentialsId, region, params);
    if (response.StandardErrorContent) {
        throw new Error(response.StandardErrorContent);
    }
    return JSON.parse(response.StandardOutputContent!);
}

async function getDatabasesSummary(
    credentialsId: string,
    region: string,
    instanceId: string,
    offset: number,
    rowscount: number
) {
    logger.info('Fetching databases ', credentialsId, region, instanceId, offset, rowscount);

    const commands = [`${PSSCRIPT} -Query "${DATABASES(offset, rowscount)}"`];
    const response = await callSsmExecution(credentialsId, instanceId, region, commands);

    logger.debug('Fetching databases response', response);

    return response;
}

async function serverResourceUtilisation(
    instanceId: string,
    credentialsId: string,
    region: string,
    resourceType: string
) {
    let commands: string[] = [];
    if (resourceType === 'cpu') {
        commands = [`${PSSCRIPT} -Query "${CPU_UTILIZATION}"`];
    }
    return callSsmExecution(credentialsId, instanceId, region, commands);
}


async function getTablesCount(
    credentialsId: string,
    region: string,
    instanceId: string,
    databaseName: string
) {
    const commands = [`${PSSCRIPT} -Query "${TABLES_COUNT_QUERY(databaseName)}"`];
    return callSsmExecution(credentialsId, instanceId, region, commands);
}

async function getTablesList(
    credentialsId: string,
    region: string,
    instanceId: string,
    offset: number,
    rowscount: number,
    databaseName: string
) {
    logger.info('Fetching databases ', credentialsId, region, instanceId, offset, rowscount, databaseName);

    const commands = [`${PSSCRIPT} -Query "${TABLES_QUERY(databaseName, offset, rowscount)}"`];
    const response = callSsmExecution(credentialsId, instanceId, region, commands);

    logger.debug('Fetching tables response', response);

    return response;
}

export { getDatabasesSummary, serverResourceUtilisation, getTablesCount, getTablesList };
