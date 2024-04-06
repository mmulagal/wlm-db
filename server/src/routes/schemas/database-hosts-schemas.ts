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
    CollationInfoResponseBody
} from '../types/database-hosts.types';
import { CredentialsIdParams } from '../types/generic.types';

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
    summary: 'Get database host drive information',
    description: 'Fetch drive info about the database host',
    params: DatabaseHostSummaryParams,
    response: {
        200: DriveInfoResponseBody
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

export {
    DatabaseHostsSummarySchema,
    DatabaseHostDetailsSchema,
    DatabasesListSchema,
    GetDriveInfoSchema,
    DatabasesCreateSchema,
    GetCollationDetailsSchema
};
