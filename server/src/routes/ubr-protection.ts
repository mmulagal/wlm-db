import { FastifyInstance } from 'fastify/types/instance';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import castRequest from './utils';
import { GenerateUbrCredentialsSchema } from './schemas/ubr-protection.schema';
import { generateUbrCredentials } from '../operations/ubr-protection-operations';

const UBR_PROTECTION_API_PREFIX_PATH = '/v1/ubr-protection/credentials/:credentialsId/regions/:region/ubr-credentials';
export default function ubrProtectionRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.post(UBR_PROTECTION_API_PREFIX_PATH, { schema: GenerateUbrCredentialsSchema }, async request => {
        const {
            params: { accountId, region, credentialsId },
            body: { ec2InstanceIds, connectorId, ...rest }
        } = castRequest(request);

        return generateUbrCredentials({ accountId, region, credentialsId, ec2InstanceIds, connectorId, ...rest });
    });
}
