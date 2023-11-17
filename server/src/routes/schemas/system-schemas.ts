import { HealthResponse, AboutResponse, StatusResponse, StatusParams } from '../types/system.types';

// System schemas:
const GetHealthinessSchema = {
    tags: ['System'],
    hide: true,
    summary: 'Health and liveness',
    description: 'Health and liveness',
    response: { 200: HealthResponse }
};

const GetSystemInfoSchema = {
    tags: ['System'],
    summary: 'Get system information',
    description: 'Get information about the system',
    response: {
        200: AboutResponse
    }
};

const GetSystemStatusSchema = {
    tags: ['System'],
    params: StatusParams,
    summary: 'Get status of the user',
    description: 'Get status of the user',
    response: {
        200: StatusResponse
    }
};

export { GetHealthinessSchema, GetSystemInfoSchema, GetSystemStatusSchema };
