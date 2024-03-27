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
import SwaggerParser from '@apidevtools/swagger-parser';
import getLogger from './utils/logger';
import {
    ACCOUNT_ID,
    API_PATH_HEALTH,
    API_TITLE,
    // AUDIT_EXCLUDE_LIST,
    HEADERS,
    REQUEST_ID,
    USER_TOKEN,
    VERSION,
    WORKSPACE_ID,
    JWKS_FULL_NAME,
    WLMDB
} from './utils/consts';
import jwtOperation from './utils/jwt';
import { getLocalStorage, setAsyncLocalStorageResource } from './utils/async-local-storage';
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
import serviceStatusRoutes from './routes/service-status';
import discoverRoutes from './routes/discover';
// import {
//     createAuditGroup,
//     updateAuditGroup,
//     updateAuditGroupResponse
// } from './operations/cloud-manager/audit-operations';
import deploymentRoutes from './routes/deployment';
import resourceRoutes from './routes/resource';
import initiateSecrets from './utils/secret';
import { createAndSubscribeToSnsTopicInAllRegions } from './operations/aws/sns-operations';
import { processCloudFormationMessages } from './operations/aws/sqs-operations';
import { execute, initializeDatabase } from './utils/prisma-utils';
import chatbotRoutes from './routes/chatbot';
import { purgeOlderJobs, failLongRunningDeploymentJobs } from './operations/cron-operations';
import { isActiveInstance } from './utils/utils';

const logger = getLogger();
const accessLogger = getLogger('access');

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
    .register(cors)
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
            chatbotRoutes(instance);
            serviceStatusRoutes(instance);
            discoverRoutes(instance);
            resourceRoutes(instance);
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
            reply: FastifyReply,
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
                            [HEADERS.X_NETAPP_REFERER]: xNetappReferer
                        },
                        params: { accountId },
                        id: requestId
                    } = request;
                    logger.debug(url, reply);
                    setAsyncLocalStorageResource(REQUEST_ID, requestId);
                    setAsyncLocalStorageResource(USER_TOKEN, authorization);
                    setAsyncLocalStorageResource(ACCOUNT_ID, accountId);
                    setAsyncLocalStorageResource(WORKSPACE_ID, workspaceId);
                    setAsyncLocalStorageResource(HEADERS.X_NETAPP_REFERER, xNetappReferer);

                    if (!url.includes(API_PATH_HEALTH)) {
                        accessLogger.info(`[${method}] [${url}]`);
                    }

                    // Don't update audit record until BXP integration decision is made.
                    // const requestUrl = AUDIT_EXCLUDE_LIST.some(element => request.url.includes(element));
                    // if (!requestUrl) {
                    //     createAuditGroup(request, reply);
                    // }
                    done();
                });
            } else {
                done();
            }
        }
    )
    .addHook('onResponse', (request, reply, done) => {
        if (!request.url.includes(API_PATH_HEALTH)) {
            accessLogger.info(`[${request.method}] [${request.url}] [${reply.statusCode}]`);
        }
        done();
    })
    .setErrorHandler((error, request, reply) => errorHandler(error, request, reply))
    .addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload) => {
        reply.header(HEADERS.NETAPP_WLMSQL_REQUEST_ID, request.id);

        // Don't update audit record until BXP integration decision is made.
        // const requestUrl = AUDIT_EXCLUDE_LIST.some(element => request.url.includes(element));
        // // Don't update audit record on invalid route
        // if (!request.is404) {
        //     if (!requestUrl && reply.statusCode !== 202) {
        //         updateAuditGroup(request, reply, payload);
        //     } else if (request.url.includes('cloudformation/stack')) {
        //         updateAuditGroupResponse(request, payload);
        //     }
        // }
        return payload;
    });

// Blocking for simulator
if (process.env.NODE_ENV !== 'demo' && process.env.NODE_ENV !== 'simulator' && isActiveInstance()) {
    try {
        await createAndSubscribeToSnsTopicInAllRegions();
        processCloudFormationMessages();
    } catch (error) {
        logger.error('Failed to setup SNS-SQS infra', error);
    }
}

try {
    initializeDatabase();
    if (isActiveInstance()) {
        await execute('node_modules/prisma/build/index.js migrate deploy');
    }
} catch (error) {
    logger.error('Failed to initialize database', error);
}

// Initialize cron jobs
try {
    if (isActiveInstance()) {
        purgeOlderJobs();
        failLongRunningDeploymentJobs();
    }
} catch (error) {
    logger.error('Failed to initialize cron jobs', error);
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
