import { ACCOUNT_ID, CLOUD_MANAGER_ENDPOINT, HEADERS } from '../../utils/consts';
import { gotInstanceForInternalRequest } from '../../utils/got';

import getLogger from '../../utils/logger';
import {
    AuditRecordSchemaType,
    CreateAuditGroupSchemaType,
    UpdateAuditGroupSchemaType
} from '../../routes/schemas/audit-schema';
import { getAsyncLocalStorageResource } from '../../utils/async-local-storage';
import { getBxpServiceToken } from './auth';

const logger = getLogger();

export default async function sendAudit(auditData: {
    json: {
        auditGroup?: CreateAuditGroupSchemaType | UpdateAuditGroupSchemaType | AuditRecordSchemaType;
        auditRecord?: CreateAuditGroupSchemaType | UpdateAuditGroupSchemaType | AuditRecordSchemaType;
    };
}) {
    logger.debug('Sending Audit:', auditData);

    try {
        const { token } = await getBxpServiceToken();
        const accountId = getAsyncLocalStorageResource<string>(ACCOUNT_ID);
        return await gotInstanceForInternalRequest.post(`${CLOUD_MANAGER_ENDPOINT}/audit/${accountId}`, {
            headers: {
                [HEADERS.AUTHORIZATION]: token
            },
            ...auditData
        });
    } catch (error) {
        logger.error('Failed to send audit to audit service', { error, auditData });
    }
}
