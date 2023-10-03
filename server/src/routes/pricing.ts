import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import CalculatePriceSchema from './schemas/pricing-schema';
import calculatePrice from '../operations/aws/pricing-operations';

export default function pricingRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    const API_PATH_PRICING = '/v1/credentials/:credentialsId/pricing';

    server.post(API_PATH_PRICING, { schema: CalculatePriceSchema }, async (request, reply) => {
        const {
            params: { credentialsId },
            body: { compute, storage, vpc }
        } = request;

        const response = await calculatePrice(credentialsId, compute, storage, vpc);
        return reply.send(response);
    });
}
