import { CredentialsIdParams } from '../types/generic.types';
import { GenerateUbrCredentialsBody, GenerateUbrCredentialsResponse } from '../types/ubr-protection.types';

const GenerateUbrCredentialsSchema = {
    tags: ['Unified Backup & Recovery'],
    params: CredentialsIdParams,
    body: GenerateUbrCredentialsBody,
    summary: 'Generate United Backup & Recovery credentials',
    description: 'Generate United Backup & Recovery credentials for the specified account',
    response: {
        200: GenerateUbrCredentialsResponse
    }
};

export { GenerateUbrCredentialsSchema };
