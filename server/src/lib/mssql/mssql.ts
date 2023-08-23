import { DATABASES, DOCUMENTNAME, PSSCRIPT } from './const';
import { executeSsmDocument } from '../aws/ssm';

async function getDBSummary(
    credentialsId: string,
    region: string,
    instanceId: string,
    offset: number,
    rowscount: number
) {
    const params = {
        DocumentName: DOCUMENTNAME,
        InstanceIds: [instanceId],
        Parameters: {
            commands: [`${PSSCRIPT} -Query "${DATABASES(offset, rowscount)}"`]
        }
    };

    const response = await executeSsmDocument(credentialsId, region, params);
    if (response.StandardErrorContent) {
        throw new Error(response.StandardErrorContent);
    }
    const resp = JSON.parse(response.StandardOutputContent);
    return resp;
}
export { getDBSummary };
