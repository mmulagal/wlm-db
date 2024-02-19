import { RouteTags } from '../../utils/consts';
import {
    DatabaseHostQueryString,
    DatabaseHostSummaryListResponse,
    DatabaseHostSummaryParams,
    DatabaseHostSummaryResponse,
    DatabasesListResponse
} from '../types/database-hosts.types';
import { AccountIdParams, ManagedHostParams } from '../types/generic.types';

// Base Request for Deployment Routes
const baseRequest = {
    tags: [RouteTags.DEPLOYMENT],
    params: AccountIdParams
};

// Base Request for Deployment with credential and region Routes
const databaseHostsRequest = {
    tags: [RouteTags.DEPLOYMENT],
    params: ManagedHostParams
};

// Get Database hosts summary details
const DatabaseHostsSummarySchema = {
    ...databaseHostsRequest,
    summary: 'Get databse hosts details',
    description: 'Get database hosts summary details',
    querystring: DatabaseHostQueryString,
    response: {
        200: DatabaseHostSummaryListResponse
    }
};

// Get Database host summary details
const DatabaseHostDetailsSchema = {
    ...baseRequest,
    summary: 'Fetch database server details ',
    description:
        'Fetch database server resource (memory, cpu, disk) comsumption, metadata about installation (server details, network, active directory), storage savings, usage cost and databases in the server.',
    params: DatabaseHostSummaryParams,
    querystring: DatabaseHostQueryString,
    response: {
        200: DatabaseHostSummaryResponse
    }
};

// Get databases in a database server
const DatabasesListSchema = {
    ...baseRequest,
    summary: 'Fetch details about databases in a server ',
    description:
        'Fetch details about databases in a server - name, protection status, availability status, size and type of database',
    params: DatabaseHostSummaryParams,
    response: {
        200: DatabasesListResponse
    }
};

export { DatabaseHostsSummarySchema, DatabaseHostDetailsSchema, DatabasesListSchema };
