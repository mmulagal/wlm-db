import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import { CalculatePriceSchema, LogsAnalysisPriceSchema } from './schemas/pricing-schema';
import { calculatePrice } from '../operations/aws/pricing-operations';
import castRequest from './utils';
import { calculateLogsAnalysisPrice } from '../operations/logs-analyzer/logs-analyzer-operations';

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

    server.get(
        `${API_PATH_PRICING}/region/:region/logs-analysis`,
        { schema: LogsAnalysisPriceSchema },
        async (request, reply) => {
            const {
                params: { region }
            } = castRequest(request);

            const response = await calculateLogsAnalysisPrice(region);
            return reply.send(response);
        }
    );
}
