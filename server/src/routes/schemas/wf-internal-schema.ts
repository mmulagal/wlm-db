import { AccountIdParams, NextTokenQueryString } from '../types/generic.types';
import { ListVolumesResponse, StatusParams, StatusResponse } from '../types/wf-internal.types';

const GetSystemStatusSchema = {
    tags: ['WF-Internal'],
    params: StatusParams,
    summary: 'Get status of the user',
    description: 'Get status of the user',
    response: {
        200: StatusResponse
    }
};

const GetDatabaseVolumesSchema = {
    tags: ['WF-Internal'],
    params: AccountIdParams,
    querystring: NextTokenQueryString,
    summary: 'Get WLMDB volumes',
    description: 'List all the volumes managed by WLMDB for the given account',
    response: {
        200: ListVolumesResponse
    }
};

export { GetSystemStatusSchema, GetDatabaseVolumesSchema };
