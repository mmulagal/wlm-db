import { CPU_UTILIZATION, DATABASES, SSM_RUN_POWERSHELL_SCRIPT_DOC, PSSCRIPT, TABLES_QUERY } from './const';
import { executeSsmDocument } from '../aws/ssm';

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
    const resp = JSON.parse(response.StandardOutputContent!);
    return resp;
}

async function getDBSummary(
    credentialsId: string,
    region: string,
    instanceId: string,
    offset: number,
    rowscount: number
) {
    const commands = [`${PSSCRIPT} -Query "${DATABASES(offset, rowscount)}"`];
    return callSsmExecution(credentialsId, instanceId, region, commands);
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

async function getTablesList(
    credentialsId: string,
    region: string,
    instanceId: string,
    offset: number,
    rowscount: number,
    databaseName: string
) {
    const commands = [`${PSSCRIPT} -Query "${TABLES_QUERY(databaseName, offset, rowscount)}"`];
    return callSsmExecution(credentialsId, instanceId, region, commands);
}

export { getDBSummary, serverResourceUtilisation, getTablesList };
