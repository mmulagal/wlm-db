import { Type } from '@sinclair/typebox';
import { RouteTags, HEADERS } from '../../utils/consts';
import { WorkingEnvironmentResponse, WorkingEnvironmentsResponse } from '../types/working-environment.types';

const GenericHeaders = Type.Object({
    [HEADERS.SIMULATOR]: Type.Optional(Type.Boolean())
});

const AccountIdParams = Type.Object({
    accountId: Type.String({ minLength: 1 })
});

const AccountIdAndWorkingEnvironmentIdParams = Type.Object({
    accountId: Type.String({ minLength: 1 }),
    workingEnvironmentId: Type.String({ minLength: 1 })
});

const getWorkingEnvironmentsSchema = {
    tags: [RouteTags.WORKING_ENVIRONMENT],
    description: 'Get working environments',
    headers: GenericHeaders,
    params: AccountIdParams,
    response: {
        200: WorkingEnvironmentsResponse
    }
};

const getWorkingEnvironmentSchema = {
    tags: [RouteTags.WORKING_ENVIRONMENT],
    description: 'Get working environments',
    headers: GenericHeaders,
    params: AccountIdAndWorkingEnvironmentIdParams,
    response: {
        200: WorkingEnvironmentResponse
    }
};

export { getWorkingEnvironmentsSchema, getWorkingEnvironmentSchema };
