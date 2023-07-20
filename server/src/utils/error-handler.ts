import { FastifyReply, FastifyRequest } from "fastify";
import { isArray } from "lodash-es";
import { isHTTPError, isTimeoutError } from "./got";
import getLogger from "./logger";

const logger = getLogger();

export default function errorHandler(
  error: any,
  request: FastifyRequest,
  reply: FastifyReply
) {
  logger.error(
    `Request ${request.method} ${request.url} failed: ${error.message}`
  );

  const { validation, statusCode = 500, message } = error;

  if (validation) {
    handleValidationError(statusCode, reply, validation, message, request);
  } else if (error.$metadata) {
    // error from aws sdk
    reply
      .status(error.$metadata.httpStatusCode)
      .send({ message: error.message });
  } else if (isHTTPError(error)) {
    const body = error.response.body as any;
    const statusCode = error.response.statusCode;
    if (body.error && isArray(body.error.errors)) {
      // then it's gcp error
      reply.status(statusCode).send({ message: body.error.message });
    }
    const message = typeof body === "string" ? body : body.message;
    if (request.url.includes("proxy") && body.body) {
      return reply.status(statusCode).send(body.body);
    }
    reply.status(statusCode).send({ message });
  } else if (isTimeoutError(error)) {
    reply.gatewayTimeout();
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
        } else if (
          cur.params?.allowedValues &&
          Array.isArray(cur.params.allowedValues)
        ) {
          return `${acc}${cur.params?.allowedValues.join(", ")}, `;
        } else {
          return acc;
        }
      },
      ""
    );
    reply
      .status(code)
      .send({ message: `${message}: ${allowedValuesMessage.trim()}` });
  }
  reply.status(code).send({ message });
}
