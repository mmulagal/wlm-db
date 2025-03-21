import { Type } from '@fastify/type-provider-typebox';
import { RouteTags } from '../../utils/consts';

import {
    DatabaseHostQueryString,
    DatabaseHostSummaryParams,
    DatabasesListResponse,
    CreateDatabseRequestBody,
    DatabasesCreateResponse,
    CreateDatabaseParams,
    DriveInfoResponseBody,
    CreateSandboxBody,
    CollationInfoResponseBody,
    SandboxSavingsResponseBody,
    SandboxInfoResponseBody,
    DatabaseMountPointRequestQueryParam,
    GetDriveQueryString,
    DatabaseMountPointResponseBody,
    SandboxParams,
    SplitEstimatesResponse,
    SandboxLifeCycleBody,
    DatabaseHostSummaryForMultiInstanceListResponse,
    SandboxSnapshotsResponse,
    SandboxSnapshotsQueryParams,
    DatabaseHostSummaryForMultiInstanceResponse,
    DatabaseHostInstanceSummaryParams,
    DatabaseHostInstanceSummaryResponse,
    DatabaseHostOptionalInstanceSummaryParams,
    DatabaseQueryString,
    PgSqlDbHostSummaryListResponse,
    PgSqlDbHostsSummaryResponse
} from '../types/database-hosts.types';
import { CredentialsIdParams, NextTokenQueryString } from '../types/generic.types';

// Base Request for resource with credential and region Routes
const resourceRequest = {
    tags: [RouteTags.RESOURCE],
    params: CredentialsIdParams
};

// Get Database hosts summary details
// const DatabaseHostsSummarySchema = {
//     ...resourceRequest,
//     summary: 'Get database hosts details (deprecated)',
//     description: 'Get database hosts summary details (deprecated)',
//     hide: process.env.NODE_ENV === 'production',
//     querystring: DatabaseHostQueryString,
//     response: {
//         200: DatabaseHostSummaryPerStorageTypeListResponse
//     }
// };

// Get Database host summary details
// const DatabaseHostDetailsSchema = {
//     ...resourceRequest,
//     summary: 'Fetch database server details (deprecated)',
//     description:
//         'Fetch database server resource (memory, cpu, disk) consumption, metadata about installation (server details, network, active directory), storage savings, usage cost and databases in the server.',
//     params: DatabaseHostSummaryParams,
//     hide: process.env.NODE_ENV === 'production',
//     querystring: DatabaseHostQueryString,
//     response: {
//         200: DatabaseHostSummaryPerStorageTypeResponse
//     }
// };

// Get databases in a database server
// const DatabasesListSchema = {
//     ...resourceRequest,
//     summary: 'Fetch details about databases in a server (deprecated)',
//     description:
//         'Fetch details about databases in a server - name, protection status, availability status, size and type of database',
//     params: DatabaseHostSummaryParams,
//     hide: process.env.NODE_ENV === 'production',
//     querystring: DatabaseQueryString,
//     response: {
//         200: DatabasesListResponse
//     }
// };

// Create database in a database server
const DatabasesCreateSchema = {
    tags: [RouteTags.RESOURCE],
    params: CreateDatabaseParams,
    summary: 'Create a new user database in a server ',
    description: 'Create a new user database in a server',
    body: CreateDatabseRequestBody,
    response: {
        202: DatabasesCreateResponse
    }
};

// const GetDriveInfoSchema = {
//     ...resourceRequest,
//     querystring: GetDriveQueryString,
//     hide: process.env.NODE_ENV === 'production',
//     summary: 'Get database host drive information (deprecated)',
//     description: 'Fetch drive info about the database host (deprecated)',
//     params: DatabaseHostSummaryParams,
//     response: {
//         200: DriveInfoResponseBody
//     }
// };

const GetDriveInfoSchemaV2 = {
    ...resourceRequest,
    querystring: GetDriveQueryString,
    summary: 'Get database host drive information',
    description: 'Fetch drive info about the database host',
    params: DatabaseHostOptionalInstanceSummaryParams,
    response: {
        200: DriveInfoResponseBody
    }
};

const CreateSandboxSchema = {
    ...resourceRequest,
    tags: [RouteTags.SANDBOX],
    summary: 'Create sandbox',
    description: 'Create sandbox in same or alternate host',
    body: CreateSandboxBody,
    response: {
        202: Type.Object({
            jobId: Type.String()
        })
    }
};

// const GetCollationDetailsSchema = {
//     ...resourceRequest,
//     summary: 'Get database host collation details (deprecated)',
//     hide: process.env.NODE_ENV === 'production',
//     description: 'Fetch collation details about the database host (deprecated)',
//     params: DatabaseHostSummaryParams,
//     response: {
//         200: CollationInfoResponseBody
//     }
// };

const GetCollationDetailsSchemaV2 = {
    ...resourceRequest,
    summary: 'Get database host collation details',
    description: 'Fetch collation details about the database host',
    params: DatabaseHostOptionalInstanceSummaryParams,
    response: {
        200: CollationInfoResponseBody
    }
};

const GetSandboxSavingsSchema = {
    ...resourceRequest,
    tags: [RouteTags.SANDBOX],
    summary: 'Get sandbox savings',
    description: 'Get savings across all the database hosts for sandboxes created',
    response: {
        200: SandboxSavingsResponseBody
    }
};

const GetSandboxesInfoSchema = {
    ...resourceRequest,
    tags: [RouteTags.SANDBOX],
    summary: 'Get Sandboxes Information',
    description: 'Get Sandboxes Information of all databases',
    querystring: NextTokenQueryString,
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
    tags: [RouteTags.SANDBOX],
    hide: process.env.NODE_ENV === 'production',
    summary: 'Patch for sandboxcreation resource metadata ',
    description: 'Patch for sandboxcreation resource metadata.',
    params: DatabaseHostSummaryParams,
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
        200: Type.Object({
            server: Type.String(),
            database: Type.String(),
            userId: Type.Optional(Type.String())
        })
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
        202: Type.Object({
            jobId: Type.String()
        })
    }
};

const SandboxLifeCycleSchema = {
    params: SandboxParams,
    tags: [RouteTags.SANDBOX],
    summary: 'Sandbox lifecycle',
    description: 'Sandbox lifecycle operations',
    body: SandboxLifeCycleBody,
    response: {
        200: Type.Object({
            jobId: Type.String()
        })
    }
};

const DatabaseHostsSummarySchemaV2 = {
    ...resourceRequest,
    summary: 'Get database hosts details',
    description: 'Get database hosts summary details',
    querystring: DatabaseHostQueryString,
    response: {
        200: DatabaseHostSummaryForMultiInstanceListResponse
    }
};

const PgSqlDbHostsSummarySchema = {
    ...resourceRequest,
    summary: 'Get Postgresql database hosts details',
    description: 'Get Postgresql database hosts summary details',
    querystring: DatabaseHostQueryString,
    response: {
        200: PgSqlDbHostSummaryListResponse
    }
};

const DatabaseHostDetailsSchemaV2 = {
    ...resourceRequest,
    summary: 'Fetch database server details',
    description:
        'Fetch database server resource (memory, cpu, disk) consumption, metadata about installation (server details, network, active directory), storage savings, usage cost and databases in the server.',
    params: DatabaseHostSummaryParams,
    querystring: DatabaseHostQueryString,
    response: {
        200: DatabaseHostSummaryForMultiInstanceResponse
    }
};

const PgSqlDbHostDetailsSchema = {
    ...resourceRequest,
    summary: 'Fetch Postgresql database server details',
    description:
        'Fetch Postgresql database server resource (memory, cpu, disk) consumption, metadata about installation (server details, network), storage savings, usage cost and databases in the server.',
    params: DatabaseHostSummaryParams,
    querystring: DatabaseHostQueryString,
    response: {
        200: PgSqlDbHostsSummaryResponse
    }
};

const DatabaseHostInstanceDetailsSchema = {
    ...resourceRequest,
    summary: 'Fetch database server instance details',
    description:
        'Fetch database server resource (memory, cpu, disk) consumption, metadata about installation (server details, network, active directory), storage savings, usage cost and databases in the server. ',
    params: DatabaseHostInstanceSummaryParams,
    querystring: DatabaseHostQueryString,
    response: {
        200: DatabaseHostInstanceSummaryResponse
    }
};

const SandboxSplitSchema = {
    params: SandboxParams,
    tags: [RouteTags.SANDBOX],
    summary: 'Sandbox split',
    description: 'Sandbox split operation',
    response: {
        200: Type.Object({
            jobId: Type.String()
        })
    }
};

const CheckSandboxIntegritySchema = {
    ...SandboxSplitSchema,
    summary: 'Check sandbox integrity',
    description: 'Check sandbox integrity operation'
};

const DatabasesListSchemaV2 = {
    tags: [RouteTags.RESOURCE],
    summary: 'Fetch details about databases in a server',
    description:
        'Fetch details about databases in a server - name, protection status, availability status, size and type of database',
    params: DatabaseHostInstanceSummaryParams,
    querystring: DatabaseQueryString,
    response: {
        200: DatabasesListResponse
    }
};

const GetSandboxSnapshotsSchema = {
    params: SandboxParams,
    tags: [RouteTags.SANDBOX],
    querystring: SandboxSnapshotsQueryParams,
    summary: 'Get Sandbox snapshots',
    description:
        'Get snapshots of all the mapped ontap volumes for the given sandbox to be able to restore the sandbox to a previous state',
    response: {
        200: SandboxSnapshotsResponse
    }
};

export {
    DatabasesCreateSchema,
    CreateSandboxSchema,
    GetSandboxSavingsSchema,
    GetSandboxesInfoSchema,
    PatchResourceForSandboxSchema,
    GetSandboxesMountPointSchema,
    GetSandboxConnectionStringSchema,
    DeleteSandboxSchema,
    GetSandboxSplitEstimateSchema,
    SandboxLifeCycleSchema,
    SandboxSplitSchema,
    DatabaseHostsSummarySchemaV2,
    DatabaseHostDetailsSchemaV2,
    DatabaseHostInstanceDetailsSchema,
    CheckSandboxIntegritySchema,
    DatabasesListSchemaV2,
    GetSandboxSnapshotsSchema,
    GetDriveInfoSchemaV2,
    GetCollationDetailsSchemaV2,
    PgSqlDbHostsSummarySchema,
    PgSqlDbHostDetailsSchema
};
