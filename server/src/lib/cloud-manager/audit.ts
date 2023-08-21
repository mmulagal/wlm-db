import { CLOUD_MANAGER_ENDPOINT, HEADERS } from '../../utils/consts.js';
import { gotInstanceForInternalRequest } from '../../utils/got.js';
import { getServiceToken } from './tenancy.js';

import getLogger from '../../utils/logger.js';

const logger = getLogger();

interface AuditGroup {}

export default async function sendAudit(auditObject: AuditGroup) {
    logger.debug('Sending Audit:', auditObject);

    try {
        const { token } = await getServiceToken();
        return await gotInstanceForInternalRequest.post(`${CLOUD_MANAGER_ENDPOINT}/audit`, {
            headers: {
                [HEADERS.AUTHORIZATION]: token
            },
            json: auditObject
        });
    } catch (error) {
        logger.error('Failed to send audit to audit service', error);
    }
}
