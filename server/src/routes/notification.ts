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

    server.post(`${API_PATH_NOTIFICATION}/email`, { schema: emailSchema }, async (request: FastifyRequest, reply) => {
        const {
            params: { accountId },
            query: { emailType }
        } = castRequest(request);

        if (!request.isMultipart()) {
            return reply.status(400).send({ message: 'No calculations file attached' });
        }

        let fileBuffer: Buffer | null = null;
        let fileName = '';

        const fields: { [key: string]: string } = {};

        const parts = request.parts();
        for await (const part of parts) {
            if (part.type === 'file') {
                const file = part as MultipartFile;
                fileName = file.filename;
                fileBuffer = await file.toBuffer();
            } else if (part.type === 'field') {
                fields[part.fieldname] = part.value as string;
            }
        }

        const response = await processEmailRequest(accountId, fileBuffer, fileName, fields, emailType);

        return reply.send(response);
    });
}
