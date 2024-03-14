import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import CalculatePriceSchema from './schemas/pricing-schema';
import calculatePrice from '../operations/aws/pricing-operations';

export default function pricingRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    const API_PATH_PRICING = '/v1/pricing';

    server.post(API_PATH_PRICING, { schema: CalculatePriceSchema }, async (request, reply) => {
        const {
            body: { compute, storage, vpc, ebsStorage }
        } = request;

        const response = await calculatePrice(compute, storage, vpc, ebsStorage);
        return reply.send(response);
    });
}
