import { FastifyRequest } from 'fastify';

// Utility function to cast FastifyRequest to a generic type
function castRequest<TParams = Record<string, any>, TQuery = Record<string, any>, TBody = Record<string, any>>(
    request: FastifyRequest
): FastifyRequest<{ Params: TParams; Querystring: TQuery; Body: TBody }> {
    return request as FastifyRequest<{ Headers: TParams; Params: TParams; Querystring: TQuery; Body: TBody }>;
}

export default castRequest;
