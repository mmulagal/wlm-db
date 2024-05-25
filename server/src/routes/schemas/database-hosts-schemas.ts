import { Type } from '@fastify/type-provider-typebox';
import { RouteTags } from '../../utils/consts';

import {
    DatabaseHostQueryString,
    DatabaseHostSummaryPerStorageTypeListResponse,
    DatabaseHostSummaryParams,
    DatabaseHostSummaryPerStorageTypeResponse,
    DatabasesListResponse,
    CreateDatabseRequestBody,
    DatabasesCreateResponse,
    CreateDatabaseParams,
    DriveInfoResponseBody,
    CloneDatabaseHostBody,
    CollationInfoResponseBody,
    SandboxSavingsResponseBody,
    SandboxInfoResponseBody,
    DatabaseMountPointRequestQueryParam,
    GetDriveQueryString,
    DatabaseMountPointResponseBody,
    SandboxParams,
    SplitEstimatesResponse,
    SandboxLifeCycleBody
} from '../types/database-hosts.types';
import { CredentialsIdParams, nextTokenQueryString } from '../types/generic.types';

// Base Request for Deployment with credential and region Routes
const databaseHostsRequest = {
    tags: [RouteTags.DEPLOYMENT],
    params: CredentialsIdParams
};

// Get Database hosts summary details
const DatabaseHostsSummarySchema = {
    ...databaseHostsRequest,
    summary: 'Get database hosts details',
    description: 'Get database hosts summary details',
    querystring: DatabaseHostQueryString,
    response: {
        200: DatabaseHostSummaryPerStorageTypeListResponse
    }
};

// Get Database host summary details
const DatabaseHostDetailsSchema = {
    ...databaseHostsRequest,
    summary: 'Fetch database server details ',
    description:
        'Fetch database server resource (memory, cpu, disk) comsumption, metadata about installation (server details, network, active directory), storage savings, usage cost and databases in the server.',
    params: DatabaseHostSummaryParams,
    querystring: DatabaseHostQueryString,
    response: {
        200: DatabaseHostSummaryPerStorageTypeResponse
    }
};

// Get databases in a database server
const DatabasesListSchema = {
    ...databaseHostsRequest,
    summary: 'Fetch details about databases in a server ',
    description:
        'Fetch details about databases in a server - name, protection status, availability status, size and type of database',
    params: DatabaseHostSummaryParams,
    response: {
        200: DatabasesListResponse
    }
};

// Create database in a database server
const DatabasesCreateSchema = {
    tags: [RouteTags.DEPLOYMENT],
    params: CreateDatabaseParams,
    summary: 'Create a new user databases in a server ',
    description: 'Create a new user database in a server',
    body: CreateDatabseRequestBody,
    response: {
        200: DatabasesCreateResponse
    }
};

const GetDriveInfoSchema = {
    ...databaseHostsRequest,
    querystring: GetDriveQueryString,
    summary: 'Get database host drive information',
    description: 'Fetch drive info about the database host',
    params: DatabaseHostSummaryParams,
    response: {
        200: DriveInfoResponseBody
    }
};

const CloneDatabaseHostSchema = {
    ...databaseHostsRequest,
    tags: [RouteTags.SANDBOX],
    summary: 'Clone database',
    description: 'Clone database in same or alternate host',
    body: CloneDatabaseHostBody,
    response: {
        200: {
            jobId: Type.String()
        }
    }
};

const GetCollationDetailsSchema = {
    ...databaseHostsRequest,
    summary: 'Get database host collation details',
    description: 'Fetch collation details about the database host',
    params: DatabaseHostSummaryParams,
    response: {
        200: CollationInfoResponseBody
    }
};

const GetSandboxSavingsSchema = {
    ...databaseHostsRequest,
    tags: [RouteTags.SANDBOX],
    summary: 'Get sandbox savings',
    description: 'Get savings across all the database hosts for sandboxes created',
    response: {
        200: SandboxSavingsResponseBody
    }
};

const GetSandboxesInfoSchema = {
    ...databaseHostsRequest,
    tags: [RouteTags.SANDBOX],
    summary: 'Get Sandboxes Information',
    description: 'Get Sandboxes Information of all databases',
    querystring: nextTokenQueryString,
    response: {
        200: SandboxInfoResponseBody
    }
};

const GetSandboxesMountPointSchema = {
    params: CreateDatabaseParams,
    querystring: DatabaseMountPointRequestQueryParam,
    tags: [RouteTags.SANDBOX],
    summary: 'Get mount point information of database',
    description: 'Get data and log file mount point drive information of database',
    response: {
        200: DatabaseMountPointResponseBody
    }
};

const PatchResourceForSandboxSchema = {
    ...databaseHostsRequest,
    tags: [RouteTags.SANDBOX],
    hide: process.env.NODE_ENV === 'production',
    summary: 'Patch for sandboxcreation resource metadata ',
    description: 'Patch for sandboxcreation resource metadata.',
    params: DatabaseHostSummaryParams,
    response: {
        200: Type.Any()
    }
};

const RevertPatchResourceForSandboxSchema = {
    ...databaseHostsRequest,
    tags: [RouteTags.SANDBOX],
    hide: process.env.NODE_ENV === 'production',
    summary: 'Revert  for sandboxcreation resource metadata ',
    description: 'Revert  for sandboxcreation resource metadata.',
    response: {
        200: Type.Any()
    }
};

const GetSandboxConnectionStringSchema = {
    params: SandboxParams,
    tags: [RouteTags.SANDBOX],
    summary: 'Get Sandbox connection string',
    description: 'Get sandbox connection string for sql server connection',
    response: {
        200: {
            server: Type.String(),
            database: Type.String(),
            userId: Type.Optional(Type.String())
        }
    }
};

const GetSandboxSplitEstimateSchema = {
    params: SandboxParams,
    tags: [RouteTags.SANDBOX],
    summary: 'Get Sandbox split estimate',
    description: 'Get split estimate of all the mapped ontap volumes for the given sandbox',
    response: {
        200: SplitEstimatesResponse
    }
};

const DeleteSandboxSchema = {
    params: SandboxParams,
    tags: [RouteTags.SANDBOX],
    summary: 'Delete sandbox',
    description: 'Delete sandbox within a database host',
    response: {
        200: {
            jobId: Type.String()
        }
    }
};

const SandboxLifeCycleSchema = {
    params: SandboxParams,
    tags: [RouteTags.SANDBOX],
    summary: 'Sandbox lifecycle',
    description: 'Sandbox lifecycle operations',
    body: SandboxLifeCycleBody,
    response: {
        200: {
            jobId: Type.String()
        }
    }
};

export {
    DatabaseHostsSummarySchema,
    DatabaseHostDetailsSchema,
    DatabasesListSchema,
    GetDriveInfoSchema,
    DatabasesCreateSchema,
    CloneDatabaseHostSchema,
    GetCollationDetailsSchema,
    GetSandboxSavingsSchema,
    GetSandboxesInfoSchema,
    PatchResourceForSandboxSchema,
    RevertPatchResourceForSandboxSchema,
    GetSandboxesMountPointSchema,
    GetSandboxConnectionStringSchema,
    DeleteSandboxSchema,
    GetSandboxSplitEstimateSchema,
    SandboxLifeCycleSchema
};
