import { RouteTags } from '../../utils/consts';
import {
    WorkingEnvironmentResponse,
    WorkingEnvironmentsResponse,
    AccountIdParams,
    AccountIdAndWorkingEnvironmentIdParams,
    RelationshipsResponse
} from '../types/working-environment.types';

const GetWorkingEnvironmentsSchema = {
    tags: [RouteTags.WORKING_ENVIRONMENT],
    hide: true,
    summary: 'Get working environments',
    description: 'Get working environments for the selected account',
    params: AccountIdParams,
    response: {
        200: WorkingEnvironmentsResponse
    }
};

const GetWorkingEnvironmentSchema = {
    tags: [RouteTags.WORKING_ENVIRONMENT],
    hide: true,
    summary: 'Get working environment details',
    description: 'Get working environment details for the given Id',
    params: AccountIdAndWorkingEnvironmentIdParams,
    response: {
        200: WorkingEnvironmentResponse
    }
};

const GetRelationshipsSchema = {
    tags: [RouteTags.WORKING_ENVIRONMENT],
    hide: true,
    summary: 'Get relationships of working environments',
    description: 'Get relationships of all working environments',
    params: AccountIdParams,
    response: {
        200: RelationshipsResponse
    }
};

export { GetWorkingEnvironmentsSchema, GetWorkingEnvironmentSchema, GetRelationshipsSchema };
