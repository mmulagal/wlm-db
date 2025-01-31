import { FastifyReply, FastifyRequest } from 'fastify';
import { cloneDeep, isEmpty } from 'lodash-es';
import randomize from 'randomatic';
import getLogger from '../../utils/logger';
import { getSubjectFromBearerToken, hideSecretsValues } from '../../utils/utils';
import {
    AUDIT_GROUP,
    HTTP_DELETE,
    HTTP_PATCH,
    HTTP_POST,
    HTTP_PUT,
    REQUEST_ID,
    TIMELINE_SERVICE_NAME,
    VERSION
} from '../../utils/consts';
import { getAsyncLocalStorageResource, setAsyncLocalStorageResource } from '../../utils/async-local-storage';
import sendAudit from '../../lib/cloud-manager/audit';
import validateSchema from '../../utils/schema-validation';
import {
    AuditRecordSchema,
    AuditRecordSchemaType,
    CreateAuditGroupSchema,
    CreateAuditGroupSchemaType,
    UpdateAuditGroupSchema,
    UpdateAuditGroupSchemaType
} from '../../routes/schemas/audit-schema';
import castRequest from '../../routes/utils';
import { getStorageSizingSchemaDesc } from '../../utils/storage-sizing-schema';

const logger = getLogger();

// const AUDIT_PAYLOAD_MAX_LEN = 1000;
const AUDIT_PENDING_STATUS = 'pending';
const AUDIT_SUCCESS_STATUS = 'success';
const AUDIT_FAILED_STATUS = 'failed';

interface RequestHeaders {
    host: string;
    authorization: string;
    'user-agent': string;
    'x-workspace-id'?: string;
}

type HTTP_POST = typeof HTTP_POST;
type HTTP_PUT = typeof HTTP_PUT;
type HTTP_DELETE = typeof HTTP_DELETE;

type RequestTypes = `${HTTP_POST | HTTP_PUT | HTTP_DELETE}`;

const methods = [HTTP_POST, HTTP_PUT, HTTP_PATCH, HTTP_DELETE];

type AUDIT_PENDING = typeof AUDIT_PENDING_STATUS;
type AUDIT_SUCCESS = typeof AUDIT_SUCCESS_STATUS;
type AUDIT_FAILED_ = typeof AUDIT_FAILED_STATUS;

type AUDIT_STATUS = `${AUDIT_FAILED_ | AUDIT_PENDING | AUDIT_SUCCESS}`;

function extractAuditHeaders(headers: RequestHeaders) {
    logger.debug('Extract audit headers', headers);
    const { host, authorization } = headers;
    return {
        host,
        referer: TIMELINE_SERVICE_NAME,
        authorization,
        userAgent: headers['user-agent'],
        workspaceId: headers['x-workspace-id']
    };
}

async function createAuditGroup(request: FastifyRequest) {
    logger.debug('Creating audit group');

    const {
        raw: { method, headers, url },
        query,
        params,
        body
    } = request;

    if (methods.includes(method as string)) {
        const auditHeaders = extractAuditHeaders(headers as RequestHeaders);

        const actionParameters = {
            params,
            query,
            headers: auditHeaders,
            body,
            method
        };

        const clonedData = cloneDeep(actionParameters);

        logger.debug(clonedData);
        const secureActionParameters = JSON.stringify(hideSecretsValues(clonedData));

        const { schema } = request.routeOptions;
        if (!isEmpty(schema)) {
            let actionName = schema?.description || 'internal';
            if (request.url.includes('/optimize/storage-sizing')) {
                const { body: castedBody } = castRequest(request);
                actionName = getStorageSizingSchemaDesc(castedBody?.type);
            }

            const auditGroup: CreateAuditGroupSchemaType = {
                startTime: Date.now(),
                actionName,
                status: AUDIT_PENDING_STATUS,
                requestId: request.id,
                serviceName: TIMELINE_SERVICE_NAME,
                referrer: url && url.length < 180 ? (url as string) : (url?.substring(0, 180) as string), // Here audit service has a limit of 191 characters for referrer
                version: VERSION,
                requestData: secureActionParameters,
                principalId: getSubjectFromBearerToken() as string
            };

            validateSchema(auditGroup, CreateAuditGroupSchema);

            setAsyncLocalStorageResource(AUDIT_GROUP, auditGroup);
            sendAudit({ json: { auditGroup } });
        }
    }
}

async function updateAuditGroupResponse(request: FastifyRequest, payload?: any) {
    logger.debug('Updating audit group response');
    if (methods.includes(request.raw.method as string)) {
        const auditGroup = (await getAsyncLocalStorageResource(AUDIT_GROUP)) as UpdateAuditGroupSchemaType;
        try {
            auditGroup.responseData = payload;

            validateSchema(auditGroup, UpdateAuditGroupSchema);
            sendAudit({ json: { auditGroup } });
        } catch (error) {
            logger.error('Unable to update audit group response', auditGroup);
        }
    }
}

async function updateAuditGroup(request: FastifyRequest, reply: FastifyReply, payload?: any) {
    logger.debug('Updating audit group');

    if (methods.includes(request.raw.method as string)) {
        const auditGroup = (await getAsyncLocalStorageResource(AUDIT_GROUP)) as UpdateAuditGroupSchemaType;

        if (auditGroup) {
            try {
                auditGroup.endTime = Date.now();

                const { statusCode } = reply;
                const { message } = JSON.parse(payload);
                if (statusCode >= 400) {
                    auditGroup.status = AUDIT_FAILED_STATUS;
                    auditGroup.errors = [message];

                    validateSchema(auditGroup, UpdateAuditGroupSchema);
                    sendAudit({ json: { auditGroup } });
                } else {
                    auditGroup.responseData = payload;
                    auditGroup.status = AUDIT_SUCCESS_STATUS;

                    validateSchema(auditGroup, UpdateAuditGroupSchema);
                    sendAudit({ json: { auditGroup } });
                }
            } catch (error) {
                auditGroup.status = AUDIT_SUCCESS_STATUS;

                validateSchema(auditGroup, UpdateAuditGroupSchema);
                sendAudit({ json: { auditGroup } });
            }
        }
    }
}

async function createAuditRecord(
    requestType: RequestTypes,
    actionName: string,
    status: AUDIT_STATUS,
    actionParameters: any,
    errorMessage?: string
) {
    logger.debug('Sending audit record');

    if (methods.includes(requestType)) {
        const clonedData = cloneDeep(actionParameters);
        const secureActionParameters = JSON.stringify(hideSecretsValues(clonedData));

        const auditRecord: AuditRecordSchemaType = {
            creationTime: Date.now(),
            actionName,
            status,
            recordId: parseInt(randomize('0', 2), 10),
            requestId: getAsyncLocalStorageResource(REQUEST_ID) || 'system',
            serviceName: TIMELINE_SERVICE_NAME,
            data: secureActionParameters
        };

        if (errorMessage) {
            auditRecord.errors = [errorMessage];
        }

        validateSchema(auditRecord, AuditRecordSchema);
        sendAudit({ json: { auditRecord } });
    }
}

async function updateLongRunningAuditGroup(
    status?: AUDIT_STATUS,
    message?: string,
    resourceId?: string,
    responseData?: any
) {
    logger.info('Updating long running audit group:', {
        status,
        message,
        resourceId,
        responseData
    });

    const auditGroup = (await getAsyncLocalStorageResource(AUDIT_GROUP)) as UpdateAuditGroupSchemaType;

    if (auditGroup) {
        logger.info('Updating existing long running audit group:', auditGroup);
        auditGroup.status = status || auditGroup.status;
        auditGroup.resourceId = resourceId || auditGroup.resourceId;
        auditGroup.responseData = responseData ? JSON.stringify(responseData) : auditGroup.responseData;

        if (status === AUDIT_FAILED_STATUS && message) {
            auditGroup.errors = [message];
        }

        sendAudit({ json: { auditGroup } });
    }
}

export { createAuditGroup, updateAuditGroupResponse, updateAuditGroup, createAuditRecord, updateLongRunningAuditGroup };
