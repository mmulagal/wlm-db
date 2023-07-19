import { HealthResponse, AboutResponse } from '../types/system.types';

// System schemas:
const getHealthinessSchema = {
    tags: ['System'],
    hide: true,
    description: 'Health and liveness',
    response: { 200: HealthResponse }
};

const getSystemInfoSchema = {
    tags: ['System'],
    description: 'Get system information',
    response: {
        200: AboutResponse
    }
};

export {
    getHealthinessSchema, getSystemInfoSchema
}