import { CLOUD_MANAGER_ENDPOINT, HEADERS } from '../../utils/consts.js';
import { gotInstanceForInternalRequest } from '../../utils/got.js';
import { getServiceToken } from './tenancy.js';

import getLogger from '../../utils/logger.js';
import {
    AuditRecordSchemaType,
    CreateAuditGroupSchemaType,
    UpdateAuditGroupSchemaType
} from '../../routes/schemas/audit-schema.js';

const logger = getLogger();

export default async function sendAudit(
    auditGroup: CreateAuditGroupSchemaType | UpdateAuditGroupSchemaType | AuditRecordSchemaType
) {
    logger.debug('Sending Audit:', auditGroup);

    try {
        const { token } = await getServiceToken();
        return await gotInstanceForInternalRequest.post(`${CLOUD_MANAGER_ENDPOINT}/audit`, {
            headers: {
                [HEADERS.AUTHORIZATION]: token
            },
            json: { auditGroup }
        });
    } catch (error) {
        logger.error('Failed to send audit to audit service', error);
    }
}
