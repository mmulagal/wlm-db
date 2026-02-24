import { Type } from 'typebox';
import { RouteTags } from '../../utils/consts';
import {
    UploadMetricsFileBody,
    OnPremDatabaseResourcesResponse,
    OnPremTcoExploreSavingsRequestBody,
    OnPremTcoExploreSavingsResponse,
    OnPremDatabaseResourceObject,
    BulkOnPremTcoExploreSavingsRequestBody,
    BulkTcoExploreSavingsResponse,
    OracleDatabaseResourcesResponse,
    OracleDatabaseResourceObject,
    BulkOracleTcoExploreSavingsRequestBody
} from '../types/onprem-tco.types';
import { JobIdResponse, NextTokenQueryString } from '../types/generic.types';

const GeneratePayloadInternal = {
    tags: [RouteTags.ONPREM_TCO],
    summary: 'Generate payload for on-premises metrics collector',
    description: 'Generate payload for on-premises metrics collector',
    body: Type.Any(),
    params: Type.Object({
        accountId: Type.String({ description: 'The account ID' })
    }),
    consumes: ['multipart/form-data'],
    hide: true,
    response: {
        202: Type.Object({
            fileName: Type.String(),
            fileContent: Type.String()
        }),
        400: Type.Object({
            message: Type.String()
        })
    }
};

function createDeleteSchema(dbLabel: string) {
    return {
        tags: [RouteTags.ONPREM_TCO],
        summary: `Delete ${dbLabel} on-premises TCO report`,
        description: `Delete ${dbLabel} on-premises TCO report for a given resource`,
        params: Type.Object({
            accountId: Type.String({ description: 'The account ID' }),
            resourceId: Type.String({ description: `The resource ID for the ${dbLabel} on-prem report` })
        }),
        response: {
            200: Type.Object({
                count: Type.Number()
            })
        }
    };
}

function createDownloadSchema(dbLabel: string) {
    return {
        tags: [RouteTags.ONPREM_TCO],
        summary: `Download ${dbLabel} on-premises data collector script`,
        description: `Downloads the ${dbLabel} on-premises data collector script`,
        response: {
            200: Type.Object({
                url: Type.String()
            })
        }
    };
}

function createUploadSchema(dbLabel: string) {
    return {
        tags: [RouteTags.ONPREM_TCO],
        summary: `Upload ${dbLabel} on-premises data collector output`,
        description: `Upload ${dbLabel} on-premises data collector output for TCO analysis`,
        body: UploadMetricsFileBody,
        response: {
            202: JobIdResponse
        }
    };
}

const DeleteOnPremReport = createDeleteSchema('SQL Server');
const DownloadSqlServerDataCollectorScriptSchema = createDownloadSchema('SQL Server');
const UploadOnPremTcoDataSchema = createUploadSchema('SQL Server');

const ListOnPremDatabaseResourcesSchema = {
    tags: [RouteTags.ONPREM_TCO],
    summary: 'Fetch all the SQL Server OnPremises database resources for a given account',
    querystring: NextTokenQueryString,
    description:
        'Fetch all the SQL Server OnPremises database resources for a given account. A resource is a set of database instances in a database host or cluster of a specific deployment type.',
    response: {
        200: OnPremDatabaseResourcesResponse
    }
};

const GetOnPremDatabaseResourceSchema = {
    tags: [RouteTags.ONPREM_TCO],
    summary: 'Fetch a SQL Server onprem database resource for a given account and resource identifier',
    querystring: NextTokenQueryString,
    description:
        'Fetch a SQL Server onprem database resource for a given account and resource identifier. A resource is a set of database instances in a database host or cluster of a specific deployment type.',
    response: {
        200: OnPremDatabaseResourceObject
    }
};

const OnpremTcoExploreSavingsSchema = {
    tags: [RouteTags.ONPREM_TCO],
    summary: 'Explore potential savings for SQL Server OnPremises workloads',
    description: 'Explore potential savings for SQL Server OnPremises workloads',
    body: OnPremTcoExploreSavingsRequestBody,
    response: {
        202: OnPremTcoExploreSavingsResponse
    }
};

const BulkOnpremTcoExploreSavingsSchema = {
    tags: [RouteTags.ONPREM_TCO],
    summary: 'Explore potential savings for multiple SQL Server OnPremises resources',
    description: 'Explore potential savings for multiple SQL Server OnPremises resources in a single request',
    body: BulkOnPremTcoExploreSavingsRequestBody,
    response: {
        202: BulkTcoExploreSavingsResponse
    }
};

const DeleteOracleOnPremReport = createDeleteSchema('Oracle');
const DownloadOracleDataCollectorScriptSchema = createDownloadSchema('Oracle');
const UploadOracleTcoDataSchema = createUploadSchema('Oracle');

const ListOracleDatabaseResourcesSchema = {
    tags: [RouteTags.ONPREM_TCO],
    summary: 'Fetch all Oracle on-premises database resources for a given account',
    querystring: NextTokenQueryString,
    description:
        'Fetch all Oracle on-premises database resources for a given account. A resource is an Oracle database instance or RAC cluster.',
    response: {
        200: OracleDatabaseResourcesResponse
    }
};

const GetOracleDatabaseResourceSchema = {
    tags: [RouteTags.ONPREM_TCO],
    summary: 'Fetch an Oracle on-prem database resource for a given account and resource identifier',
    params: Type.Object({
        accountId: Type.String({ description: 'The account ID' }),
        resourceId: Type.String({ description: 'The resource ID' })
    }),
    description: 'Fetch an Oracle on-prem database resource for a given account and resource identifier.',
    response: {
        200: OracleDatabaseResourceObject
    }
};

const BulkOracleTcoExploreSavingsSchema = {
    tags: [RouteTags.ONPREM_TCO],
    summary: 'Explore potential savings for multiple Oracle on-premises resources',
    description: 'Explore potential savings for multiple Oracle on-premises resources in a single request',
    body: BulkOracleTcoExploreSavingsRequestBody,
    response: {
        202: BulkTcoExploreSavingsResponse
    }
};

export {
    GeneratePayloadInternal,
    DeleteOnPremReport,
    DownloadSqlServerDataCollectorScriptSchema,
    UploadOnPremTcoDataSchema,
    ListOnPremDatabaseResourcesSchema,
    GetOnPremDatabaseResourceSchema,
    OnpremTcoExploreSavingsSchema,
    BulkOnpremTcoExploreSavingsSchema,
    DeleteOracleOnPremReport,
    DownloadOracleDataCollectorScriptSchema,
    UploadOracleTcoDataSchema,
    ListOracleDatabaseResourcesSchema,
    GetOracleDatabaseResourceSchema,
    BulkOracleTcoExploreSavingsSchema
};
