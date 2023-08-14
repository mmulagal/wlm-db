import { CLOUD_MANAGER_ENDPOINT } from '../../utils/consts.js';
import { gotInstanceForInternalRequest } from '../../utils/got.js';
import getLogger from '../../utils/logger.js';

const logger = getLogger();

interface AuditGroup {}

export default async function sendAudit(auditObject: AuditGroup) {
    logger.debug('Sending Audit:', auditObject);

    try {
        return await gotInstanceForInternalRequest.post(`${CLOUD_MANAGER_ENDPOINT}/audit`, auditObject);
    } catch (error) {
        logger.error('Failed to send audit to audit service', error);
    }
}
