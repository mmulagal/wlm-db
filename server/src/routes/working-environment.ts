import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    GetRelationshipsSchema,
    GetWorkingEnvironmentSchema,
    GetWorkingEnvironmentsSchema
} from './schemas/working-environment-schemas';
import {
    getResourceRelationships,
    getWorkingEnvironment,
    getWorkingEnvironments
} from '../operations/working-environment-operations';

const API_PATH_WORKING_ENVIRONMENTS: string = '/v1/workingEnvironments';
const API_PATH_RELATIONSHIP: string = '/v1/relationships';

export default function workingEnvironmentRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.get(`${API_PATH_WORKING_ENVIRONMENTS}`, { schema: GetWorkingEnvironmentsSchema }, async () => {
        const workingEnvironments = await getWorkingEnvironments();
        return { workingEnvironments };
    });

    server.get(
        `${API_PATH_WORKING_ENVIRONMENTS}/:workingEnvironmentId`,
        { schema: GetWorkingEnvironmentSchema },
        async (request, reply) => {
            const {
                params: { workingEnvironmentId }
            } = request;
            const response = await getWorkingEnvironment(workingEnvironmentId);
            return reply.send(response);
        }
    );

    server.get(`${API_PATH_RELATIONSHIP}`, { schema: GetRelationshipsSchema }, async () => {
        const relationships = await getResourceRelationships();
        return { relationships };
    });
}
