import { FastifyInstance } from 'fastify/types/instance';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { queryBotSchema } from './schemas/chatbot-schema';
import { queryBot } from '../operations/chatbot-operations';

export default function chatbotRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.post('/v1/chatbot/prompt', { schema: queryBotSchema }, async (request, reply) => {
        const {
            body: { prompt, intent, params, userParams }
        } = request;

        const response = await queryBot(prompt, intent, params, userParams);

        return reply.send(response);
    });
}
