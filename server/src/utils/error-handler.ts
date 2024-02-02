import { FastifyReply, FastifyRequest } from 'fastify';
import { isArray } from 'lodash-es';
import {
    PrismaClientInitializationError,
    PrismaClientKnownRequestError,
    PrismaClientValidationError
} from '@prisma/client/runtime/library.js';
import { isHTTPError, isTimeoutError } from './got';
import { INVALID_REGION_AWS, INVALID_REGION_MESSAGE, HttpErrorCodes } from './consts';

import getLogger from './logger';

const logger = getLogger();

export default function errorHandler(error: any, request: FastifyRequest, reply: FastifyReply) {
    logger.error(`Request ${request.method} ${request.url} failed: ${error}`, error?.stack);

    const { validation, statusCode = 500, message } = error;

    if (validation) {
        handleValidationError(statusCode, reply, validation, message, request);
    } else if (error.$metadata) {
        // error from aws sdk
        if (error.message.includes(INVALID_REGION_AWS)) {
            const errCode = HttpErrorCodes.NOT_FOUND;
            const errMessage = `${INVALID_REGION_MESSAGE} ${error.message}`;
            return reply.status(errCode).send({ message: errMessage });
        }
        const errCode = error.$metadata.httpStatusCode ? error.$metadata.httpStatusCode : statusCode;
        reply.status(errCode).send({ message: error.message });
    } else if (isHTTPError(error)) {
        const body = error.response.body as any;
        const { statusCode: httpStatusCode } = error.response;
        if (body.error && isArray(body.error.errors)) {
            // then it's gcp error
            reply.status(httpStatusCode).send({ message: body.error.message });
        }
        const responseMessage = typeof body === 'string' ? body : body.message;
        if (request.url.includes('proxy') && body.body) {
            return reply.status(statusCode).send(body.body);
        }
        reply.status(statusCode).send({ responseMessage });
    } else if (isTimeoutError(error)) {
        reply.gatewayTimeout();
    } else if (error instanceof PrismaClientValidationError) {
        logger.error('Error of type PrismaClientValidationError occurred', error);
        reply
            .status(500)
            .send({ message: 'The request to update database failed due to bad request.Please contact support' });
    } else if (error instanceof PrismaClientInitializationError) {
        logger.error('Error of type PrismaClientInitializationError occurred', error);
        reply
            .status(500)
            .send({ message: 'We are unable to establish connection with database. Please contact support' });
    } else if (error instanceof PrismaClientKnownRequestError) {
        logger.error('Error of type PrismaClientKnownRequestError occurred', error);
        reply.status(500).send({
            message: `An error occurred in DB query engine.${
                error?.meta?.cause
                    ? error?.meta?.cause
                    : error?.meta?.target
                    ? `An unique key constraint violated ${error?.meta?.target}`
                    : ''
            }`
        });
    } else {
        reply.status(statusCode).send({ message });
    }
}

function handleValidationError(
    statusCode: number,
    reply: FastifyReply,
    validation: any,
    message: string,
    request: FastifyRequest
) {
    logger.debug(request);
    const code = statusCode ?? reply.raw.statusCode ?? 400;
    if (Array.isArray(validation)) {
        const allowedValuesMessage = validation.reduce(
            (
                acc: string,
                cur: {
                    instancePath?: string;
                    message: string;
                    params: { allowedValue?: string; allowedValues?: string[] };
                }
            ) => {
                if (cur.params?.allowedValue) {
                    return `${acc}${cur.params?.allowedValue}, `;
                }
                if (cur.params?.allowedValues && Array.isArray(cur.params.allowedValues)) {
                    return `${acc}${cur.params?.allowedValues.join(', ')}, `;
                }
                return acc;
            },
            ''
        );
        reply.status(code).send({ message: `${message}: ${allowedValuesMessage.trim()}` });
    }
    reply.status(code).send({ message });
}
