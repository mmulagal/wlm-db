import { Type } from '@fastify/type-provider-typebox';
import { RouteTags } from '../../utils/consts';
import { CredentialsIdParams, JobIdResponse, NextTokenQueryString } from '../types/generic.types';
import {
    CreateSandboxBody,
    DatabaseMountPointRequestQueryParam,
    DatabaseMountPointResponseBody,
    SandboxInfoResponseBody,
    SandboxLifeCycleBody,
    SandboxParams,
    SandboxSavingsResponseBody,
    SandboxSnapshotsQueryParams,
    SandboxSnapshotsResponse,
    SplitEstimatesResponse
} from '../types/sandbox.types';
import { CreateDatabaseParams, DatabaseHostInstanceSummaryParams } from '../types/database-hosts.types';

// Base Request for resource with credential and region Routes
const resourceRequest = {
    tags: [RouteTags.SANDBOX],
    params: CredentialsIdParams
};

const baseAsyncJobSchema = {
    ...resourceRequest,
    params: SandboxParams,
    response: {
        200: JobIdResponse
    }
};

const CreateSandboxSchema = {
    ...baseAsyncJobSchema,
    params: CredentialsIdParams,
    summary: 'Create sandbox',
    description: 'Create sandbox in same or alternate host',
    body: CreateSandboxBody,
    response: {
        202: JobIdResponse
    }
};

const GetSandboxSavingsSchema = {
    ...resourceRequest,
    summary: 'Get sandbox savings',
    description: 'Get savings across all the database hosts for sandboxes created',
    response: {
        200: SandboxSavingsResponseBody
    }
};

const GetSandboxesInfoSchema = {
    ...resourceRequest,
    summary: 'Get Sandboxes Information',
    description: 'Get Sandboxes Information of all databases',
    querystring: NextTokenQueryString,
    response: {
        200: SandboxInfoResponseBody
    }
};

const GetSandboxesMountPointSchema = {
    ...resourceRequest,
    params: CreateDatabaseParams,
    querystring: DatabaseMountPointRequestQueryParam,
    summary: 'Get mount point information of database',
    description: 'Get data and log file mount point drive information of database',
    response: {
        200: DatabaseMountPointResponseBody
    }
};

const GetSandboxConnectionStringSchema = {
    ...resourceRequest,
    params: SandboxParams,
    summary: 'Get Sandbox connection string',
    description: 'Get sandbox connection string for sql server connection',
    response: {
        200: Type.Object({
            server: Type.String(),
            database: Type.String(),
            userId: Type.Optional(Type.String())
        })
    }
};

const GetSandboxSplitEstimateSchema = {
    ...resourceRequest,
    params: SandboxParams,
    summary: 'Get Sandbox split estimate',
    description: 'Get split estimate of all the mapped ontap volumes for the given sandbox',
    response: {
        200: SplitEstimatesResponse
    }
};

const DeleteSandboxSchema = {
    ...baseAsyncJobSchema,
    summary: 'Delete sandbox',
    description: 'Delete sandbox within a database host',
    response: {
        202: JobIdResponse
    }
};

const SandboxLifeCycleSchema = {
    ...baseAsyncJobSchema,
    summary: 'Sandbox lifecycle',
    description: 'Sandbox lifecycle operations',
    body: SandboxLifeCycleBody,
    response: {
        202: JobIdResponse
    }
};

const SandboxSplitSchema = {
    ...baseAsyncJobSchema,
    summary: 'Sandbox split',
    description: 'Sandbox split operation'
};

const CheckSandboxIntegritySchema = {
    ...baseAsyncJobSchema,
    summary: 'Check sandbox integrity',
    description: 'Check sandbox integrity operation'
};

const GetSandboxSnapshotsSchema = {
    ...resourceRequest,
    params: SandboxParams,
    querystring: SandboxSnapshotsQueryParams,
    summary: 'Get Sandbox snapshots',
    description:
        'Get snapshots of all the mapped ontap volumes for the given sandbox to be able to restore the sandbox to a previous state',
    response: {
        200: SandboxSnapshotsResponse
    }
};

const GetSandboxesInfoPerInstanceSchema = {
    ...resourceRequest,
    params: DatabaseHostInstanceSummaryParams,
    summary: 'Get Sandboxes Information per instance',
    description: 'Get Sandboxes Information of all databases per instance',
    response: {
        200: SandboxInfoResponseBody
    }
};

export {
    CreateSandboxSchema,
    GetSandboxSavingsSchema,
    GetSandboxesInfoSchema,
    GetSandboxesMountPointSchema,
    GetSandboxConnectionStringSchema,
    GetSandboxSplitEstimateSchema,
    DeleteSandboxSchema,
    SandboxLifeCycleSchema,
    SandboxSplitSchema,
    CheckSandboxIntegritySchema,
    GetSandboxSnapshotsSchema,
    GetSandboxesInfoPerInstanceSchema
};
