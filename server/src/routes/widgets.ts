import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import GetWidgetStatusSchema from './schemas/widgets-schema';

const API_PATH_WIDGETS: string = '/v1/widgets';

export default function widgetRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.get(`${API_PATH_WIDGETS}/status`, { schema: GetWidgetStatusSchema }, async () => {
        // will be changed in future to send dynamically
        const status = { isActive: true };
        return { status };
    });
}
