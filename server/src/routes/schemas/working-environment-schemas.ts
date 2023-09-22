import { RouteTags } from '../../utils/consts';
import {
    WorkingEnvironmentResponse,
    WorkingEnvironmentsResponse,
    AccountIdParams,
    AccountIdAndWorkingEnvironmentIdParams
} from '../types/working-environment.types';

const GetWorkingEnvironmentsSchema = {
    tags: [RouteTags.WORKING_ENVIRONMENT],
    description: 'Get working environments',
    params: AccountIdParams,
    response: {
        200: WorkingEnvironmentsResponse
    }
};

const GetWorkingEnvironmentSchema = {
    tags: [RouteTags.WORKING_ENVIRONMENT],
    description: 'Get working environments',
    params: AccountIdAndWorkingEnvironmentIdParams,
    response: {
        200: WorkingEnvironmentResponse
    }
};

export { GetWorkingEnvironmentsSchema, GetWorkingEnvironmentSchema };
