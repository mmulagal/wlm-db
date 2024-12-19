import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import CalculatePriceSchema from './schemas/pricing-schema';
import { calculatePrice } from '../operations/aws/pricing-operations';
import castRequest from './utils';

export default function pricingRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    const API_PATH_PRICING = '/v1/pricing';

    server.post(API_PATH_PRICING, { schema: CalculatePriceSchema }, async (request, reply) => {
        const {
            body: { compute, fsxnStorage, vpc, ebsStorage, fsxwStorage, osType, databaseType }
        } = castRequest(request);

        const response = await calculatePrice(compute, fsxnStorage, vpc, ebsStorage, fsxwStorage, osType, databaseType);
        return reply.send(response);
    });
}
