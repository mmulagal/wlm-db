import {
    CPU_UTILISATION,
    DISK_UTILISATION,
    MEMORY_UTILISATION,
    DATABASES,
    SSM_RUN_POWERSHELL_SCRIPT_DOC,
    PSSCRIPT,
    DATABASES_COUNT
} from './const';
import getLogger from '../../utils/logger';
import { DATABASE_METRIC_TYPE } from '../../utils/consts';
import { executeSsmDocument } from '../../operations/aws/ssm-operations';

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
    try {
        return JSON.parse(response.StandardOutputContent!);
    } catch (error) {
        logger.error('Error parsing response for command:', commands, error);
        return {};
    }
}

async function getDatabasesSummary(
    credentialsId: string,
    region: string,
    activeInstanceId: string,
    standbyInstanceId: string,
    offset: number,
    rowscount: number
) {
    logger.info('Fetching databases ', credentialsId, region, activeInstanceId, offset, rowscount);

    const commands = [`${PSSCRIPT} -Query "${DATABASES(offset, rowscount)}"`];
    let response = [];

    try {
        response = await callSsmExecution(credentialsId, activeInstanceId, region, commands);
    } catch (error) {
        logger.error('Fetching database summary from primary node failed', activeInstanceId, error);
        logger.info('Fetching database summary from secondary', credentialsId, region, standbyInstanceId);
        response = await callSsmExecution(credentialsId, activeInstanceId, region, commands);
    }

    logger.debug('Fetching databases response', response);

    return response;
}

async function getDatabasesCount(
    credentialsId: string,
    region: string,
    activeInstanceId: string,
    standbyInstanceId: string
) {
    logger.info('Fetching databases total count ', credentialsId, region, activeInstanceId);

    const commands = [`${PSSCRIPT} -Query "${DATABASES_COUNT()}"`];
    let response = [];

    try {
        response = await callSsmExecution(credentialsId, activeInstanceId, region, commands);
    } catch (error) {
        logger.error('Fetching database count from primary node failed', activeInstanceId, error);
        logger.info('Fetching database count from secondary', credentialsId, region, standbyInstanceId);
        response = await callSsmExecution(credentialsId, activeInstanceId, region, commands);
    }

    logger.debug('Fetching databases count response', response);

    return response;
}

function resourceUtilisationQuery(metricType: string) {
    switch (metricType) {
        case DATABASE_METRIC_TYPE.CPU:
            return CPU_UTILISATION;
        case DATABASE_METRIC_TYPE.DISK:
            return DISK_UTILISATION;
        case DATABASE_METRIC_TYPE.MEMORY:
            return MEMORY_UTILISATION;
        default:
            return '';
    }
}

async function serverResourceUtilisation(
    credentialsId: string,
    region: string,
    activeInstanceId: string,
    standbyInstanceId: string,
    metricType: string
) {
    logger.info('Fetching utilization from primary', credentialsId, region, activeInstanceId, metricType);

    let commands: string[] = [];
    let response = [];

    const metricQuery = resourceUtilisationQuery(metricType);
    commands = [`${PSSCRIPT} -Query "${metricQuery}"`];

    try {
        response = await callSsmExecution(credentialsId, activeInstanceId, region, commands);
    } catch (error) {
        logger.error('Fetching utilization from primary node failed', activeInstanceId, error);
        logger.info('Fetching utilization from secondary', credentialsId, region, standbyInstanceId, metricType);
        response = await callSsmExecution(credentialsId, activeInstanceId, region, commands);
    }

    logger.debug('Fetching  utilization', response);

    return response;
}

export { getDatabasesSummary, getDatabasesCount, serverResourceUtilisation };
