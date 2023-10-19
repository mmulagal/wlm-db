import { HealthResponse, AboutResponse, StatusResponse, StatusParams } from '../types/system.types';

// System schemas:
const GetHealthinessSchema = {
    tags: ['System'],
    hide: true,
    description: 'Health and liveness',
    response: { 200: HealthResponse }
};

const GetSystemInfoSchema = {
    tags: ['System'],
    description: 'Get system information',
    response: {
        200: AboutResponse
    }
};

const GetSystemStatusSchema = {
    tags: ['System'],
    params: StatusParams,
    description: 'Get system information',
    response: {
        200: StatusResponse
    }
};

export { GetHealthinessSchema, GetSystemInfoSchema, GetSystemStatusSchema };
