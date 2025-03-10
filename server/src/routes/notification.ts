import { MultipartFile } from '@fastify/multipart';
import { FastifyInstance } from 'fastify/types/instance';
import { FastifyRequest } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { emailSchema } from './schemas/notification-schema';
import castRequest from './utils';
import processEmailRequest from '../operations/notification-operations';

export default function storageSavingsRoutes(fastify: FastifyInstance) {
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
                return reply.status(400).send({ message: 'No calculations file attached' });
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
}
