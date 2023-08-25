import {
    CPU_UTILISATION,
    DISK_UTILISATION,
    MEMORY_UTILISATION,
    DATABASES,
    SSM_RUN_POWERSHELL_SCRIPT_DOC,
    PSSCRIPT
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

export { getDatabasesSummary, serverResourceUtilisation };
