import { CredentialsResponse, CredentialsListParams } from '../types/credentials.types';
import { DeleteResourceParams, DeleteResponse } from '../types/generic.types';
import { RouteTags } from '../../utils/consts';

const CredentialsSchema = {
    tags: ['Generic'],
    params: CredentialsListParams,
    description: 'List added credentials',
    response: {
        200: CredentialsResponse
    }
};

const DeleteResourceSchema = {
    params: DeleteResourceParams,
    tags: [RouteTags.GENERIC],
    description: 'Remove the given resource',
    response: {
        200: DeleteResponse
    }
};

export { CredentialsSchema, DeleteResourceSchema };
