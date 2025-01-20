import { Type } from '@sinclair/typebox';
import { RouteTags } from '../../utils/consts';
import { OnPremDatabaseResourcesResponse, UploadMetricsFileBody } from '../types/onprem-tco.types';
import { nextTokenQueryString } from '../types/generic.types';

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
    querystring: nextTokenQueryString,
    description:
        'Fetch all the OnPremises database resources for a given account. A resource is a set of database instances in a database host or cluster of a specific deployment type.',
    response: {
        200: OnPremDatabaseResourcesResponse
    }
};

export { DownloadOnPremTcoCollectorScriptSchema, UploadOnPremTcoDataSchema, ListOnPremDatabaseResourcesSchema };
