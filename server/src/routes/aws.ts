import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

import { FastifyInstance } from 'fastify/types/instance';
import {
    GetAmiSchema,
    GetVpcsListSchema,
    GetAdsSchema,
    GetFsxKmsKeysListSchema,
    GetSnsTopicsSchema,
    GetFSxRegionsSchema,
    GetInstanceTypesSchema,
    GetKeyPairsSchema,
    GetFSxFileSystemsSchema,
    GetVpcSecurityGroupsSchema
} from './schemas/aws-schemas';
import {
    getAmiList,
    getVpcsList,
    getKeyPairsList,
    getInstanceTypes,
    getVpcSecurityGroups
} from '../operations/aws/ec2-operations';
import { getSnsTopics } from '../operations/aws/sns-operations';
import { getAdsList } from '../operations/aws/directory-service-operations';
import { getFSxFileSystemsList } from '../operations/aws/fsx-operations';
import { getFsxKmsKeysList } from '../operations/aws/kms-operations';
import { getFSxOntapRegionsList } from '../operations/aws/ssm-operations';

const REGION_AGNOSTIC_PREFIX_PATH = '/v1/credentials/:credentialsId';
const FSX_PREFIX_PATH = `${REGION_AGNOSTIC_PREFIX_PATH}/fsx`;
const API_PREFIX_PATH = '/v1/credentials/:credentialsId/regions/:region';

export default function awsRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.get(`${API_PREFIX_PATH}/vpcs`, { schema: GetVpcsListSchema }, async (request, reply) => {
        const {
            params: { credentialsId, region },
            query: { fields }
        } = request;
        const response = await getVpcsList(credentialsId, region, fields);
        return reply.send(response);
    });

    server.get(
        `${API_PREFIX_PATH}/vpcs/:vpcId/security-groups`,
        { schema: GetVpcSecurityGroupsSchema },
        async (request, reply) => {
            const {
                params: { credentialsId, region, vpcId }
            } = request;
            const response = await getVpcSecurityGroups(credentialsId, region, vpcId);
            return reply.send(response);
        }
    );

    server.get(`${API_PREFIX_PATH}/amis`, { schema: GetAmiSchema }, async (request, reply) => {
        const {
            params: { credentialsId, region },
            query: { osType, databaseType, osVersion, databaseEdition, databaseVersion }
        } = request;
        const response = await getAmiList(
            credentialsId,
            region,
            osType,
            databaseType,
            osVersion,
            databaseVersion,
            databaseEdition
        );
        return reply.send(response);
    });

    server.get(`${API_PREFIX_PATH}/sns-topics`, { schema: GetSnsTopicsSchema }, async (request, reply) => {
        const {
            params: { credentialsId, region }
        } = request;
        const response = await getSnsTopics(region, credentialsId);
        return reply.send(response);
    });

    server.get(`${API_PREFIX_PATH}/ads`, { schema: GetAdsSchema }, async (request, reply) => {
        const {
            params: { credentialsId, region }
        } = request;
        const response = await getAdsList(credentialsId, region);
        return reply.send(response);
    });

    server.get(`${API_PREFIX_PATH}/instance-types`, { schema: GetInstanceTypesSchema }, async (request, reply) => {
        const {
            params: { credentialsId, region }
        } = request;
        const response = await getInstanceTypes(credentialsId, region);
        return reply.send(response);
    });

    server.get(`${FSX_PREFIX_PATH}/regions`, { schema: GetFSxRegionsSchema }, async (request, reply) => {
        const {
            params: { credentialsId }
        } = request;

        const response = await getFSxOntapRegionsList(credentialsId);
        return reply.send(response);
    });

    server.get(
        `${FSX_PREFIX_PATH}/regions/:region/vpcs/:vpcId/file-systems`,
        { schema: GetFSxFileSystemsSchema },
        async (request, reply) => {
            const {
                params: { credentialsId, region, vpcId }
            } = request;
            const response = await getFSxFileSystemsList(credentialsId, region, vpcId);

            return reply.send(response);
        }
    );

    server.get(`${API_PREFIX_PATH}/kms-keys`, { schema: GetFsxKmsKeysListSchema }, async (request, reply) => {
        const {
            params: { credentialsId, region }
        } = request;
        const response = await getFsxKmsKeysList(credentialsId, region);
        return reply.send(response);
    });

    server.get(`${API_PREFIX_PATH}/key-pairs`, { schema: GetKeyPairsSchema }, async (request, reply) => {
        const {
            params: { credentialsId, region }
        } = request;

        const response = await getKeyPairsList(credentialsId, region);
        return reply.send(response);
    });
}
