import getLogger from '../../utils/logger';
import { FastifyReply, FastifyRequest } from 'fastify';
import { getXAgentIdFromBearerToken, hideSecretsValues } from '../../utils/utils';
import { AUDIT_GROUP, HTTP_DELETE, HTTP_POST, HTTP_PUT, REQUEST_ID, VERSION, WLMDB } from '../../utils/consts';
import { cloneDeep } from 'lodash-es';
import { getAsyncLocalStorageResource, setAsyncLocalStorageResource } from '../../utils/async-local-storage';
import sendAudit from '../../lib/cloud-manager/audit';
import randomize from 'randomatic';
import validateSchema from '../../utils/schema-validation';
import { auditRecordSchema, createAuditGroupSchema, updateAuditGroupSchema } from '../../routes/schemas/audit-schema';

const logger = getLogger();

// const AUDIT_PAYLOAD_MAX_LEN = 1000;
const AUDIT_PENDING_STATUS = 'pending';
const AUDIT_SUCCESS_STATUS = 'success';
const AUDIT_FAILED_STATUS = 'failed';

interface Context {
    schema: {
        tags: string[];
        description: string;
        'audit-description': string;
    };
}

interface RequestHeaders {
    host: string;
    authorization: string;
    'user-agent': string;
    'x-agent-id'?: string;
    'x-workspace-id'?: string;
}

interface AuditRecord {
    [x: string]: string | number;
}

type HTTP_POST = typeof HTTP_POST;
type HTTP_PUT = typeof HTTP_PUT;
type HTTP_DELETE = typeof HTTP_DELETE;

type RequestTypes = `${HTTP_POST | HTTP_PUT | HTTP_DELETE}`;

function extractAuditHeaders(headers: RequestHeaders) {
    logger.debug('Extract audit headers', headers);
    const { host, authorization } = headers;
    return {
        host,
        authorization,
        userAgent: headers['user-agent'],
        agentId: headers['x-agent-id'],
        workspaceId: headers['x-workspace-id']
    };
}

async function createAuditGroup(request: FastifyRequest, reply: FastifyReply) {
    logger.debug('Creating audit group');

    const {
        raw: { method, headers, url },
        query,
        params,
        body
    } = request;

    if ([HTTP_POST, HTTP_PUT, HTTP_DELETE].includes(method as string)) {
        const auditHeaders = extractAuditHeaders(headers as RequestHeaders);

        const actionParameters = {
            params,
            query,
            headers: auditHeaders,
            body,
            method
        };

        const clonedData = cloneDeep(actionParameters);

        logger.info(clonedData);
        const secureActionParameters = JSON.stringify(hideSecretsValues(clonedData));

        const { context } = reply;
        const { schema } = context as unknown as Context;

        const auditGroup: AuditRecord = {
            startDate: Date.now(),

            actionName: schema?.['audit-description']
                ? schema?.['audit-description']
                : schema?.description || 'internal',
            status: AUDIT_PENDING_STATUS,
            requestId: request.id,
            serviceName: WLMDB,
            referrer: url as string,
            version: VERSION,
            actionParameters: secureActionParameters,
            principalId: getXAgentIdFromBearerToken() as string
        };

        validateSchema(auditGroup, createAuditGroupSchema);

        setAsyncLocalStorageResource(AUDIT_GROUP, auditGroup);
        sendAudit({ json: { auditGroup } });
    }
}

async function updateAuditGroup(request: FastifyRequest, payload?: any) {
    logger.info('Updating audit group');

    if ([HTTP_POST, HTTP_PUT, HTTP_DELETE].includes(request.raw.method as string)) {
        const auditGroup = (await getAsyncLocalStorageResource(AUDIT_GROUP)) as AuditRecord;

        try {
            if (payload) {
                auditGroup.responseData = payload;
            }
            const { error, message } = JSON.parse(payload);
            if (error) {
                auditGroup.status = AUDIT_FAILED_STATUS;
                auditGroup.errorMessage = message;

                validateSchema(auditGroup, updateAuditGroupSchema);
                sendAudit({ json: { auditGroup } });
            } else {
                auditGroup.status = AUDIT_SUCCESS_STATUS;

                // validateSchema(auditGroup, updateAuditGroupSchema);
                sendAudit({ json: { auditGroup } });
            }
        } catch (error) {
            auditGroup.status = AUDIT_SUCCESS_STATUS;

            // validateSchema(auditGroup, updateAuditGroupSchema);
            sendAudit({ json: { auditGroup } });
        }
    }
}

async function createAuditRecord(
    requestType: RequestTypes,
    actionName: string,
    status: string,
    actionParameters: any,
    errorMessage: string
) {
    logger.debug('Sending audit record');

    if ([HTTP_POST, HTTP_PUT, HTTP_DELETE].includes(requestType)) {
        const clonedData = cloneDeep(actionParameters);
        const secureActionParameters = JSON.stringify(hideSecretsValues(clonedData));

        const auditRecord: { [x: string]: string | number } = {
            date: Date.now(),
            actionName,
            recordId: parseInt(randomize('0', 2), 10),
            status,
            requestId: getAsyncLocalStorageResource(REQUEST_ID) || 'system',
            serviceName: WLMDB,
            actionParameters: secureActionParameters
        };

        if (errorMessage) {
            auditRecord.errorMessage = errorMessage;
        }

        validateSchema(auditRecord, auditRecordSchema);
        sendAudit({ json: { auditRecord } });
    }
}

export { createAuditGroup, updateAuditGroup, createAuditRecord };
