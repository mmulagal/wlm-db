import { HealthResponse, AboutResponse } from '../types/system.types';

// System schemas:
const GetHealthinessSchema = {
    tags: ['System'],
    hide: true,
    summary: 'Health of system',
    description: 'Health of system',
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

export { GetHealthinessSchema, GetSystemInfoSchema };
