import config from 'config';
import randomize from 'randomatic';
import { JwtPayload } from 'jsonwebtoken';
import './utils/tracer';
import fastify, { FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import helmet from '@fastify/helmet';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import sensible from '@fastify/sensible';
import fastifyMultipart from '@fastify/multipart';
import SwaggerParser from '@apidevtools/swagger-parser';
import getLogger, { getTraceData } from './utils/logger';
import {
    ACCOUNT_ID,
    API_PATH_HEALTH,
    API_TITLE,
    AUDIT_EXCLUDE_LIST,
    HEADERS,
    REQUEST_ID,
    USER_TOKEN,
    VERSION,
    WORKSPACE_ID,
    JWKS_FULL_NAME,
    WLMDB,
    SSM_COMMAND_CACHE_TYPE,
    BXP
} from './utils/consts';
import jwtOperation from './utils/jwt';
import {
    getAsyncLocalStorageResource,
    getLocalStorage,
    setAsyncLocalStorageResource
} from './utils/async-local-storage';
import errorHandler from './utils/error-handler';
import systemRoutes from './routes/system';
import credentialsRoutes from './routes/credentials';
import awsRoutes from './routes/aws';
import formConfigRoutes from './routes/form-config';
import workingEnvironmentRoutes from './routes/working-environment';
import msSqlServerRoutes from './routes/mssql';
import batchRoutes from './routes/batch';
import pricingRoutes from './routes/pricing';
import databaseHostsRoutes from './routes/database-hosts';
import deploymentJobsRoutes from './routes/jobs';
import workloadFactoryInternalRoutes from './routes/wf-internal';
import discoverRoutes from './routes/discover';
import storageSavingsRoutes from './routes/storage-savings';
import onpremTcoRoutes from './routes/onprem-tco';
import mssqlContinuousOptimizationRoutes from './routes/mssql-continuous-optimization';
import oracleContinuousOptimizationRoutes from './routes/oracle-continuous-optimization';
import notificationRoutes from './routes/notification';
import logsAnalyzerRoutes from './routes/logs-analyzer';
import registerRoutes from './routes/register';
import ubrProtectionRoutes from './routes/ubr-protection';
import {
    createAuditGroup,
    updateAuditGroup,
    updateAuditGroupResponse
} from './operations/cloud-manager/audit-operations';
import deploymentRoutes from './routes/deployment';
import resourceRoutes from './routes/resource';
import initiateSecrets from './utils/secret';
import { createAndSubscribeToSnsTopicInAllRegions } from './operations/aws/sns-operations';
import { processCloudFormationMessages } from './operations/aws/sqs-operations';
import { execute, initializeDatabase } from './utils/prisma-utils';
import sandboxRoutes from './routes/sandbox';
import { initiateCronOperations } from './operations/cron-operations';
import { isActiveInstance } from './utils/utils';
import { resetCache } from './utils/cache';
import { REDIS_URL } from './utils/continous-optimization-consts';

const logger = getLogger();
const accessLogger = getLogger('access');

logger.info(`Redis URL ${REDIS_URL}.`);

const { verifyToken, authorizeJwt } = jwtOperation;

const port = config.get<number>('app-port');
const host = '0.0.0.0';

const API_PREFIX_PATH = '/accounts/:accountId/wlmdb';

process.on('unhandledRejection', (reason, p) => logger.error('Unhandled Rejection at:', p, 'reason:', reason));

process.on('uncaughtException', err => logger.error('Uncaught exception was thrown', err.message));

async function validateSchema() {
    logger.info('Validating schema');
    try {
        await SwaggerParser.validate(`http://${host}:${port}/${WLMDB}/documentation/yaml`);
        logger.info('Schema is valid!!!');
    } catch (err) {
        logger.error(err);
    }
}

interface Params {
    accountId: string;
}

interface Headers {
    [HEADERS.AUTHORIZATION]: string;
}

await initiateSecrets();
logger.info('Secrets initiated');
logger.info('Initializing app');
const ALLOWED_ORIGINS = new Set(config.get<string[]>('cors.allowed-origins') || []);

logger.info(`CORS allowed origins: ${Array.from(ALLOWED_ORIGINS).join(', ')}`);
const app = fastify({
    trustProxy: true,
    genReqId: () => `WLM-DB-${randomize('Aa0', 8)}`,
    requestIdHeader: HEADERS.NETAPP_WLMSQL_REQUEST_ID,
    ajv: {
        customOptions: {
            coerceTypes: 'array'
        }
    }
})
    .register(fastifyMultipart, {
        limits: { fileSize: 500 * 1024 * 1024 }
    })
    .register(cors, {
        origin: (origin, callback) => {
            if (!origin) {
                return callback(null, true);
            }

            if (ALLOWED_ORIGINS.has(origin)) {
                return callback(null, true);
            }

            logger.warn(`CORS: Blocked request from unauthorized origin: ${origin}`, {
                origin,
                timestamp: new Date().toISOString()
            });

            return callback(new Error(`CORS policy violation: Origin ${origin} not allowed`), false);
        },
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE']
    })
    .register(compress)
    .register(sensible) // disable sensible error handler and use fastify native
    .register(helmet, {
        contentSecurityPolicy: false
    })
    .register(fastifySwagger, {
        openapi: {
            info: {
                title: API_TITLE,
                version: VERSION,
                description: API_TITLE,
                contact: {
                    email: 'ng-wlm-fsx@netapp.com'
                }
            },
            servers: [
                {
                    url: 'http://localhost:8085'
                },
                {
                    url: 'https://staging.api.workloads.netapp.com'
                },
                {
                    url: 'https://api.workloads.bluexp.netapp.com'
                },
                {
                    url: 'https://demo-wlmdb.api.workloads.bluexp.netapp.com'
                }
            ],
            components: {
                securitySchemes: {
                    http: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT'
                    }
                }
            },
            security: [{ http: ['scheme:bearer', 'bearerFormat:JWT'] }]
        }
    })
    .register(fastifySwaggerUi, {
        routePrefix: '/wlmdb/documentation'
    })
    .register(
        (instance, _, done) => {
            systemRoutes(instance);
            done();
        },
        { prefix: `${WLMDB}` }
    )
    .register(
        (instance, _, next) => {
            instance.addHook(
                'onRequest',
                async (request: FastifyRequest<{ Headers: Headers; Params: Params }>, reply: FastifyReply) => {
                    // Return not found if the route is invalid
                    if (request.is404) {
                        reply.notFound();
                    }
                    const {
                        headers: { authorization },
                        params: { accountId }
                    } = request;

                    logger.debug('Incoming request headers', request.headers);
                    if (authorization) {
                        try {
                            const payload = (await verifyToken(authorization.replace('Bearer ', ''))) as JwtPayload;
                            await authorizeJwt(authorization, payload, accountId);
                            request.headers.user = payload[JWKS_FULL_NAME] ? payload[JWKS_FULL_NAME] : 'SYSTEM';
                            request.headers.principal = payload.sub;
                        } catch (err) {
                            logger.error('Token verification error', err);
                            reply.unauthorized();
                        }
                    } else {
                        reply.unauthorized('Authorization header is missing');
                    }
                }
            );
            awsRoutes(instance);
            credentialsRoutes(instance);
            deploymentRoutes(instance);
            formConfigRoutes(instance);
            workingEnvironmentRoutes(instance);
            msSqlServerRoutes(instance);
            batchRoutes(instance);
            pricingRoutes(instance);
            databaseHostsRoutes(instance);
            deploymentJobsRoutes(instance);
            workloadFactoryInternalRoutes(instance);
            discoverRoutes(instance);
            resourceRoutes(instance);
            storageSavingsRoutes(instance);
            mssqlContinuousOptimizationRoutes(instance);
            onpremTcoRoutes(instance);
            notificationRoutes(instance);
            logsAnalyzerRoutes(instance);
            sandboxRoutes(instance);
            registerRoutes(instance);
            ubrProtectionRoutes(instance);
            oracleContinuousOptimizationRoutes(instance);
            next();
        },
        { prefix: `${API_PREFIX_PATH}` }
    )
    .addHook(
        'preHandler',
        (
            request: FastifyRequest<{
                Params: Params;
                Headers: Headers;
            }>,
            _reply: FastifyReply,
            done
        ) => {
            // If the route is invalid, don't call the below functions
            if (!request.is404) {
                getLocalStorage().run(new Map(getLocalStorage().getStore()), async () => {
                    const {
                        method,
                        url,
                        headers: {
                            authorization,
                            [HEADERS.WORKSPACE_ID_HEADER]: workspaceId,
                            [HEADERS.X_NETAPP_REFERER]: xNetappReferer,
                            [HEADERS.X_NETAPP_CACHE_CONTROL]: xNetappCacheControl
                        },
                        params: { accountId },
                        id: requestId
                    } = request;
                    setAsyncLocalStorageResource(REQUEST_ID, requestId);
                    setAsyncLocalStorageResource(USER_TOKEN, authorization);
                    setAsyncLocalStorageResource(ACCOUNT_ID, accountId);
                    setAsyncLocalStorageResource(WORKSPACE_ID, workspaceId);
                    setAsyncLocalStorageResource(HEADERS.X_NETAPP_REFERER, xNetappReferer);
                    setAsyncLocalStorageResource(HEADERS.X_NETAPP_CACHE_CONTROL, xNetappCacheControl);

                    if (!url.includes(API_PATH_HEALTH) && !url.includes('/wlmdb/documentation')) {
                        const traceData = getTraceData();
                        accessLogger.info({
                            requestId,
                            time: Date.now(),
                            accountId: getAsyncLocalStorageResource(ACCOUNT_ID),
                            method,
                            traceId: traceData?.traceId,
                            spanId: traceData?.spanId,
                            url,
                            params: request.params,
                            reqBody: request.body,
                            principal: request.headers.principal,
                            referer: request.headers.referer,
                            headers: JSON.stringify(
                                request.headers
                                    ? Object.fromEntries(
                                          Object.entries(request.headers).filter(([key]) => key.startsWith('x-netapp'))
                                      )
                                    : {}
                            )
                        });
                    }
                    // Added for testing purpose when we want to clear the ssm cache
                    if (xNetappCacheControl === 'no-cache') {
                        resetCache(SSM_COMMAND_CACHE_TYPE);
                    }

                    if (xNetappReferer === BXP) {
                        const requestUrl = AUDIT_EXCLUDE_LIST.some(element => request.url.includes(element));
                        if (!requestUrl) {
                            createAuditGroup(request);
                        }
                    }
                    done();
                });
            } else {
                done();
            }
        }
    )
    .setErrorHandler((error, request, reply) => errorHandler(error, request, reply))
    .addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload) => {
        const { url, params, method, id: requestId, body } = request;
        if (!url.includes(API_PATH_HEALTH) && !url.includes('/wlmdb/documentation')) {
            const traceData = getTraceData();
            let replyBody = payload;
            if (replyBody) {
                try {
                    replyBody = JSON.parse(payload as unknown as string);
                } catch (e) {
                    //  285:25  error    Empty block statement                               no-empty
                    logger.error('Error parsing reply body', e);
                }
            }

            accessLogger.info({
                requestId,
                time: Date.now(),
                accountId: getAsyncLocalStorageResource(ACCOUNT_ID),
                method,
                traceId: traceData?.traceId,
                spanId: traceData?.spanId,
                url,
                params,
                statusCode: reply.statusCode,
                replyBody,
                reqBody: body,
                principal: request.headers.principal,
                referer: request.headers.referer,
                headers: JSON.stringify(
                    request.headers
                        ? Object.fromEntries(
                              Object.entries(request.headers).filter(([key]) => key.startsWith('x-netapp'))
                          )
                        : {}
                )
            });
        }
        reply.header(HEADERS.NETAPP_WLMSQL_REQUEST_ID, request.id);

        if (request.headers[HEADERS.X_NETAPP_REFERER] === BXP) {
            const requestUrl = AUDIT_EXCLUDE_LIST.some(element => request.url.includes(element));
            // Don't update audit record on invalid route
            if (!request.is404) {
                if (!requestUrl && reply.statusCode !== 202) {
                    updateAuditGroup(request, reply, payload);
                } else if (request.url.includes('cloudformation/stack')) {
                    updateAuditGroupResponse(request, payload);
                }
            }
        }
        return payload;
    });
logger.info('App initiated');
// Blocking for simulator
if (process.env.NODE_ENV !== 'demo' && process.env.NODE_ENV !== 'simulator' && isActiveInstance()) {
    try {
        await createAndSubscribeToSnsTopicInAllRegions();
        processCloudFormationMessages();
    } catch (error) {
        logger.error('Failed to setup SNS-SQS infra', error);
    }
}

logger.info('Initializing database');
try {
    initializeDatabase();
    if (isActiveInstance()) {
        await execute('node_modules/prisma/build/index.js migrate deploy');
    }
    logger.info('Database initialized');
} catch (error) {
    logger.error('Failed to initialize database', error);
}

// Initialize cron jobs
if (isActiveInstance()) {
    initiateCronOperations();
}

app.listen({ port, host }, err => {
    if (err) {
        logger.error('Failed to start server', err.message);
        process.exit(1);
    }
    logger.info(`Server listening on ${host}:${port}`);
    logger.info(`Server version: ${VERSION}, node-version: ${process.version}, mode: ${process.env.NODE_ENV}`);
    validateSchema();
});

export { app };
