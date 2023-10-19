import { isEmpty } from 'lodash-es';
import getLogger from '../utils/logger';
import { listResources } from '../lib/database/db';
import { RESOURCESTYPE } from '../utils/consts';

const logger = getLogger();

export default async function getSystemStatus(accountId: string) {
    logger.info('Getting system status');
    const mssqlResources = await listResources(accountId, undefined, RESOURCESTYPE.MSSQL);
    if (isEmpty(mssqlResources)) {
        return { isActive: false };
    }
    return { isActive: true };
}
