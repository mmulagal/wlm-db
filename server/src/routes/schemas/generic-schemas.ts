import { CredentialsResponse, CredentialsListParams } from '../types/credentials.types';
import { AccountIdParams } from '../types/generic.types';
import {
    BulkDismissConfigurationRequestBody,
    BulkDismissConfigurationResponse
} from '../types/mssql-continuous-optimisation.types';

const CredentialsSchema = {
    tags: ['Generic'],
    params: CredentialsListParams,
    summary: 'List credentials',
    description: 'List added credentials',
    response: {
        200: CredentialsResponse
    }
};

const BaseBulkDismissConfigurationSchema = {
    params: AccountIdParams,
    body: BulkDismissConfigurationRequestBody,
    response: {
        200: BulkDismissConfigurationResponse
    }
};

export { CredentialsSchema, BaseBulkDismissConfigurationSchema };
