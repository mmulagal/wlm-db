import { isEmpty } from 'lodash-es';
import getLogger from '../utils/logger';
import { listDeployments, listResources } from '../lib/database/db';
import { RESOURCESTYPE, DEPLOYMENT_JOBS_LIST_FILTER } from '../utils/consts';

const logger = getLogger();

export default async function getSystemStatus(accountId: string) {
    logger.info('Getting system status');
    const mssqlResources = await listResources(accountId, undefined, RESOURCESTYPE.MSSQL);
    const deployments = await listDeployments(accountId, undefined, undefined, DEPLOYMENT_JOBS_LIST_FILTER, true);
    if (isEmpty(mssqlResources) && isEmpty(deployments)) {
        return { isActive: false };
    }
    return { isActive: true };
}
