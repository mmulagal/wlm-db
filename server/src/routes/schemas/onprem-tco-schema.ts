import { Type } from '@sinclair/typebox';
import { RouteTags } from '../../utils/consts';
import {
    OnPremDatabaseResourcesResponse,
    OnPremTcoExploreSavingsRequestBody,
    OnPremTcoExploreSavingsResponse,
    UploadMetricsFileBody
} from '../types/onprem-tco.types';
import { NextTokenQueryString } from '../types/generic.types';

const GeneratePayloadInternal = {
    tags: [RouteTags.ONPREM_TCO],
    summary: 'Generate payload for on-premises metrics collector',
    description: 'Generate payload for on-premises metrics collector',
    body: Type.Any(),
    params: Type.Object({
        accountId: Type.String({ description: 'The account ID' })
    }),
    consumes: ['multipart/form-data'],
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

const DeleteReportInternal = {
    tags: [RouteTags.ONPREM_TCO],
    summary: 'Delete report for on-premises metrics collector',
    description: 'Delete report for on-premises metrics collector',
    body: Type.Any(),
    params: Type.Object({
        accountId: Type.String({ description: 'The account ID' }),
        resourceId: Type.String({ description: 'The resource ID for part of the onprem report' })
    }),
    consumes: ['application/json'],
    response: {
        200: Type.Object({
            count: Type.Number()
        })
    }
};

const DownloadOnPremTcoCollectorScriptSchema = {
    tags: [RouteTags.ONPREM_TCO],
    summary: 'Download OnPremises metrics collector script',
    description: 'Downloads OnPremises metrics collector script',
    response: {
        200: Type.Object({
            url: Type.String()
        })
    }
};

const UploadOnPremTcoDataSchema = {
    tags: [RouteTags.ONPREM_TCO],
    summary: 'Upload OnPremises metrics collector data',
    description: 'Upload OnPremises metrics collector data',
    body: UploadMetricsFileBody,
    response: {
        202: Type.Object({
            jobId: Type.String()
        })
    }
};

const ListOnPremDatabaseResourcesSchema = {
    tags: [RouteTags.ONPREM_TCO],
    summary: 'Fetch all the OnPremises database resources for a given account',
    querystring: NextTokenQueryString,
    description:
        'Fetch all the OnPremises database resources for a given account. A resource is a set of database instances in a database host or cluster of a specific deployment type.',
    response: {
        200: OnPremDatabaseResourcesResponse
    }
};

const OnpremTcoExploreSavingsSchema = {
    tags: [RouteTags.ONPREM_TCO],
    summary: 'Explore potential savings for OnPremises workloads',
    description: 'Explore potential savings for OnPremises workloads',
    body: OnPremTcoExploreSavingsRequestBody,
    response: {
        202: OnPremTcoExploreSavingsResponse
    }
};

export {
    GeneratePayloadInternal,
    DeleteReportInternal,
    DownloadOnPremTcoCollectorScriptSchema,
    UploadOnPremTcoDataSchema,
    ListOnPremDatabaseResourcesSchema,
    OnpremTcoExploreSavingsSchema
};
