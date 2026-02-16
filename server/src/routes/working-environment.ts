import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import { FastifyRequest } from 'fastify';
import createError from 'http-errors';
import { HttpErrorCodes } from '../utils/consts';
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
import castRequest from './utils';

const API_PATH_WORKING_ENVIRONMENTS: string = '/v1/working-environments';
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
        async (request: FastifyRequest, reply) => {
            const {
                params: { workingEnvironmentId }
            } = castRequest(request);
            const response = await getWorkingEnvironment(workingEnvironmentId);
            if (!response) {
                throw createError(HttpErrorCodes.NOT_FOUND, 'Working environment not found');
            }
            return reply.send(response);
        }
    );

    server.get(`${API_PATH_RELATIONSHIP}`, { schema: GetRelationshipsSchema }, async () => {
        const relationships = await getResourceRelationships();
        return { relationships };
    });
}
