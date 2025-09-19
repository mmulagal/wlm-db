import { RouteTags } from '../../utils/consts';

import {
    DatabaseHostQueryString,
    DatabaseHostSummaryParams,
    DatabasesListResponse,
    CreateDatabseRequestBody,
    CreateDatabaseParams,
    DriveInfoResponseBody,
    CollationInfoResponseBody,
    GetDriveQueryString,
    DatabaseHostSummaryForMultiInstanceListResponse,
    DatabaseHostSummaryForMultiInstanceResponse,
    DatabaseHostInstanceSummaryParams,
    DatabaseHostInstanceSummaryResponse,
    DatabaseHostOptionalInstanceSummaryParams,
    PgSqlDbHostSummaryListResponse,
    PgSqlDbHostsSummaryResponse,
    OracleDbHostsSummaryResponse,
    OracleDbHostSummaryListResponse
} from '../types/database-hosts.types';
import { CredentialsIdParams, JobIdResponse } from '../types/generic.types';

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
        202: JobIdResponse
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

const OracleDbHostsSummarySchema = {
    ...resourceRequest,
    summary: 'Get Oracle database hosts details',
    description: 'Get Oracle database hosts summary details',
    querystring: DatabaseHostQueryString,
    response: {
        200: OracleDbHostSummaryListResponse
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

const DatabaseHostDiagramSchema = {
    ...resourceRequest,
    summary: 'Generate architecture diagram of a database server',
    description: 'Generate and fetch an architecture diagram for a database server.',
    params: DatabaseHostSummaryParams,
    response: {
        200: {
            type: 'object',
            properties: {
                file: { type: 'string', format: 'binary', description: 'file of type image/png' }
            }
        },
        500: {
            type: 'object',
            properties: {
                error: { type: 'string', description: 'Error message if diagram generation fails' }
            }
        }
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

const oracleDbHostDetailsSchema = {
    ...resourceRequest,
    summary: 'Fetch Oracle database server details',
    description:
        'Fetch Oracle database server resource (memory, cpu, disk) consumption, metadata about installation (server details, network), storage savings, usage cost and databases in the server.',
    params: DatabaseHostSummaryParams,
    querystring: DatabaseHostQueryString,
    response: {
        200: OracleDbHostsSummaryResponse
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

const DatabasesListSchemaV2 = {
    tags: [RouteTags.RESOURCE],
    summary: 'Fetch details about databases in a server',
    description:
        'Fetch details about databases in a server - name, protection status, availability status, size and type of database',
    params: DatabaseHostInstanceSummaryParams,
    querystring: DatabaseHostQueryString,
    response: {
        200: DatabasesListResponse
    }
};

export {
    DatabasesCreateSchema,
    DatabaseHostsSummarySchemaV2,
    DatabaseHostDiagramSchema,
    DatabaseHostDetailsSchemaV2,
    DatabaseHostInstanceDetailsSchema,
    DatabasesListSchemaV2,
    GetDriveInfoSchemaV2,
    GetCollationDetailsSchemaV2,
    PgSqlDbHostsSummarySchema,
    PgSqlDbHostDetailsSchema,
    oracleDbHostDetailsSchema,
    OracleDbHostsSummarySchema,
    resourceRequest
};
