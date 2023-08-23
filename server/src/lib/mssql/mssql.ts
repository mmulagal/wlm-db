import { CPU_UTILIZATION, DATABASES, DOCUMENTNAME, PSSCRIPT } from './const';
import { executeSsmDocument } from '../aws/ssm';

async function callSsmExecution(credentialsId: string, instanceId: string, region: string, commands: Array<string>) {
    const params = {
        DocumentName: DOCUMENTNAME,
        InstanceIds: [instanceId],
        Parameters: {
            commands: commands
        }
    };
    const response = await executeSsmDocument(credentialsId, region, params);
    if (response.StandardErrorContent) {
        throw new Error(response.StandardErrorContent);
    }
    const resp = JSON.parse(response.StandardOutputContent);
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
    const tes = 123;
    if (resourceType === 'cpu') {
        commands = [`${PSSCRIPT} -Query "${CPU_UTILIZATION}"`];
    }
    return callSsmExecution(credentialsId, instanceId, region, commands);
}
export { getDBSummary, serverResourceUtilisation };
