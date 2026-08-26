import { MultipartFile } from '@fastify/multipart';
import { FastifyInstance } from 'fastify/types/instance';
import { FastifyRequest } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import createError from 'http-errors';
import { emailSchema, notificationSchema } from './schemas/notification-schema';
import { HttpErrorCodes } from '../utils/consts';
import castRequest from './utils';
import processEmailRequest from '../operations/notification-operations';
import prepareWFNotificationRequest from '../operations/wf-notification-operations';

export default function notificationRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
    const API_PATH_NOTIFICATION = '/v1/notification';

    server.post(
        `${API_PATH_NOTIFICATION}/email`,
        {
            schema: emailSchema,
            preValidation: async (request: FastifyRequest) => {
                const parts = request.parts();
                let emailRequestBody = {};
                for await (const part of parts) {
                    if (part.type === 'file') {
                        const fileObject = part as MultipartFile;
                        const fileBuffer = await fileObject.toBuffer();
                        emailRequestBody = {
                            ...emailRequestBody,
                            file: fileBuffer.toString('base64'),
                            fileName: fileObject.filename
                        };
                    } else if (part.type === 'field') {
                        emailRequestBody = {
                            ...emailRequestBody,
                            [part.fieldname]: part.value
                        };
                    }
                }
                request.body = {
                    ...(request.body || {}),
                    ...emailRequestBody
                };
            }
        },
        async (request: FastifyRequest, reply) => {
            const {
                params: { accountId },
                query: { emailType },
                body: { file, fileName, ...fields }
            } = castRequest(request);

            if (!request.isMultipart()) {
                throw createError(HttpErrorCodes.BAD_REQUEST, 'No calculations file attached');
            }

            const response = await processEmailRequest(
                accountId,
                Buffer.from(file, 'base64'),
                fileName,
                fields,
                emailType
            );

            return reply.send(response);
        }
    );

    // Endpoint to send Workload Factory notification
    // This endpoint prepares the notification request and sends it to the Workload Factory service
    // TODO: This is added for the simulator to test the notification service.. can be removed later
    server.post(`${API_PATH_NOTIFICATION}/send`, { schema: notificationSchema }, async (request, reply) => {
        const {
            params: { accountId },
            body: { notificationData }
        } = castRequest(request);

        const result = await prepareWFNotificationRequest(accountId, notificationData);

        return reply.send(result);
    });
}
