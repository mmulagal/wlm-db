// import { initiateTracer } from './utils/tracer';

// await initiateTracer();

import config from 'config';
import randomize from 'randomatic';
import fastify, { FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import helmet from '@fastify/helmet';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import sensible from '@fastify/sensible';
import getLogger from './utils/logger';
import {
    ACCOUNT_ID,
    AGENT_ID,
    API_PATH_HEALTH,
    API_TITLE,
    HEADERS,
    REQUEST_ID,
    USER_TOKEN,
    VERSION,
    WORKSPACE_ID
} from './utils/consts';
import jwtOperation from './utils/jwt';
import { getLocalStorage, setAsyncLocalStorageResource } from './utils/async-local-storage';
import errorHandler from './utils/error-handler';
import systemRoutes from './routes/system';
import credentialsRoutes from './routes/credentials';
import awsRoutes from './routes/aws';
import initiateSecrets from './utils/secret';

const logger = getLogger();
const accessLogger = getLogger('access');

const { verifyToken } = jwtOperation;

const port = config.get<number>('app-port');
const host = '0.0.0.0';
const API_PREFIX_PATH = 'wlmdb';

process.on('unhandledRejection', (reason, p) => logger.error('Unhandled Rejection at:', p, 'reason:', reason));

process.on('uncaughtException', err => logger.error('Uncaught exception was thrown', err.message));

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
                version: VERSION
            },
            servers: [
                {
                    url: 'http://localhost:8085/wlmdb'
                },
                {
                    url: 'https://staging.api.bluexp.netapp.com/wlmdb'
                },
                {
                    url: 'https://api.bluexp.netapp.com/wlmdb'
                },
                {
                    url: 'https://demo-wlmdb.api.bluexp.netapp.com/wlmdb'
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
        { prefix: `${API_PREFIX_PATH}` }
    )
    .register(
        (instance, _, next) => {
            instance.addHook(
                'onRequest',
                async (request: FastifyRequest<{ Headers: Headers; Params: Params }>, reply: FastifyReply) => {
                    const {
                        headers: { authorization }
                    } = request;
                    logger.debug('Incoming request headers', request.headers);
                    if (authorization) {
                        try {
                            await verifyToken(authorization.replace('Bearer ', ''));
                        } catch (err) {
                            reply.unauthorized();
                        }
                    } else {
                        reply.unauthorized('Authorization header is missing');
                    }
                }
            );
            awsRoutes(instance);
            credentialsRoutes(instance);
            next();
        },
        { prefix: `${API_PREFIX_PATH}/accounts/:accountId/api` }
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
            getLocalStorage().run(new Map(getLocalStorage().getStore()), async () => {
                const {
                    url,
                    headers: { authorization, [HEADERS.WORKSPACE_ID]: workspaceId, [HEADERS.AGENT_ID]: agentId },
                    params: { accountId },
                    id: requestId
                } = request;
                logger.debug(url, reply);
                setAsyncLocalStorageResource(REQUEST_ID, requestId);
                setAsyncLocalStorageResource(USER_TOKEN, authorization);
                setAsyncLocalStorageResource(ACCOUNT_ID, accountId);
                setAsyncLocalStorageResource(WORKSPACE_ID, workspaceId);
                setAsyncLocalStorageResource(AGENT_ID, agentId);
                done();
            });
        }
    )
    .addHook('onResponse', (request, reply, done) => {
        if (!request.url.includes(API_PATH_HEALTH)) {
            accessLogger.info(`[${request.method}] [${request.url}] [${reply.statusCode}]`);
        }
        done();
    })
    .setErrorHandler((error, request, reply) => errorHandler(error, request, reply))
    .addHook('onSend', async (request, reply, payload) => {
        reply.header(HEADERS.NETAPP_WLMSQL_REQUEST_ID, request.id);
        // TO add audit logging
        // if (shouldCreateOrUpdateAudit(request.url, request.method)) {
        //     updateAuditGroup(reply, payload);
        // }
        return payload;
    });

app.listen({ port, host }, err => {
    if (err) {
        logger.error('Failed to start server', err.message);
        process.exit(1);
    }
    logger.info(`Server listening on ${host}:${port}`);
    logger.info(`Server version: ${VERSION}, node-version: ${process.version}, mode: ${process.env.NODE_ENV}`);
});
