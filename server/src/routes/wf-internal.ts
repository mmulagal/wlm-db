import { FastifyInstance } from 'fastify/types/instance';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyRequest } from 'fastify';
import {
    GetAccountInfoSchema,
    GetDatabaseVolumesSchema,
    GetFocusEventStatusSchema,
    GetFocusWadStatusSchema,
    GetSystemStatusSchema,
    GetWidgetStatusSchema
} from './schemas/wf-internal-schema';
import {
    getAccountInfo,
    getDatabaseVolumes,
    getFocusWadStatus,
    getLogsAnalysisStatus,
    getSystemStatus,
    getWidgetStatus
} from '../operations/wf-internal-operations';
import castRequest from './utils';

export default function systemRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
    server
        .get('/v1/status', { schema: GetSystemStatusSchema }, async request => {
            const {
                params: { accountId }
            } = castRequest(request);
            return getSystemStatus(accountId);
        })
        .get('/v1/database-volumes', { schema: GetDatabaseVolumesSchema }, async (request: FastifyRequest) => {
            const {
                params: { accountId },
                query: { instancePagesize, nextToken, fsxId }
            } = castRequest(request);
            return getDatabaseVolumes(accountId, instancePagesize, nextToken, fsxId);
        })
        .get('/v1/focus-wad-status', { schema: GetFocusWadStatusSchema }, async (request: FastifyRequest) => {
            const {
                params: { accountId },
                query: { credentialsIds, regions, limit }
            } = castRequest(request);
            return getFocusWadStatus(accountId, credentialsIds, regions, limit);
        })
        .get('/v1/focus-event-status', { schema: GetFocusEventStatusSchema }, async (request: FastifyRequest) => {
            const {
                params: { accountId },
                query: { credentialsIds, regions, limit }
            } = castRequest(request);
            return getLogsAnalysisStatus(accountId, credentialsIds, regions, limit);
        })
        .get('/v1/widget-status', { schema: GetWidgetStatusSchema }, async (request: FastifyRequest) => {
            const {
                params: { accountId },
                query: { credentialsIds, regions }
            } = castRequest(request);
            return getWidgetStatus(accountId, credentialsIds, regions);
        })
        .get('/v1/account-info', { schema: GetAccountInfoSchema }, async (request: FastifyRequest) => {
            const {
                params: { accountId }
            } = castRequest(request);
            return getAccountInfo(accountId);
        });
}
