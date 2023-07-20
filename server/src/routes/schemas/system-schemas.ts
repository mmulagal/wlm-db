import { HealthResponse, AboutResponse } from '../types/system.types';

// System schemas:
export const GetHealthinessSchema = {
    tags: ['System'],
    hide: true,
    description: 'Health and liveness',
    response: { 200: HealthResponse },
};

export const GetSystemInfoSchema = {
    tags: ['System'],
    description: 'Get system information',
    response: {
        200: AboutResponse,
    },
};
