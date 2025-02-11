import { isEmpty } from 'lodash-es';
import getLogger from '../utils/logger';
import { getCredentials } from './cloud-manager/credentials-operations';
import { creadteDemoDBData } from '../utils/demo-utils/demoDefaultUtils';
import { MSSQL } from '../utils/consts';
import {
    onPremAOAGAUploadObject,
    onPremFCIUploadObject,
    onpremStdUploadObject
} from '../utils/demo-utils/demoMockdata';
import { getOnPremDatabaseResources, uploadOnpremTcoData } from './onprem-tco-operations';

const logger = getLogger();

export default async function getSystemStatus(accountId: string) {
    logger.info('Getting system status for account.', accountId);
    const credentialsType = 'aws_assume_role';
    const credentialsList = await getCredentials(credentialsType);
    if (process.env.NODE_ENV !== 'demo' && process.env.NODE_ENV !== 'simulator') {
        if (isEmpty(credentialsList)) {
            return { isActive: false };
        }
        return { isActive: true };
    }
    creadteDemoDBData(accountId, credentialsList);
    const resource = await getOnPremDatabaseResources(accountId, MSSQL);
    if (resource.count === 0) {
        uploadOnpremTcoData(accountId, MSSQL, onPremFCIUploadObject.fileName, onPremFCIUploadObject.fileContent);
        uploadOnpremTcoData(accountId, MSSQL, onPremAOAGAUploadObject.fileName, onPremAOAGAUploadObject.fileContent);
        uploadOnpremTcoData(accountId, MSSQL, onpremStdUploadObject.fileName, onpremStdUploadObject.fileContent);
    }
    return { isActive: true };
}
