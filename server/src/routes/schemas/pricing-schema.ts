import { RouteTags } from '../../utils/consts';
import { PricingServiceRequest, PricingServiceResponse } from '../types/pricing.types';
import { AccountIdParams, AccountIdRegionParams } from '../types/generic.types';

const CalculatePriceSchema = {
    tags: [RouteTags.PRICING],
    summary: 'Database Server deployment cost estimation',
    description: 'Estimates monthly cost of deployable resources in USD for the given database server configuration',
    params: AccountIdParams,
    body: PricingServiceRequest,
    response: {
        200: PricingServiceResponse
    }
};

const LogsAnalysisPriceSchema = {
    tags: [RouteTags.PRICING],
    summary: 'Logs analysis cost estimation',
    description: 'Estimates logs analysis cost in USD',
    params: AccountIdRegionParams,
    response: {
        200: {
            type: 'object',
            properties: {
                costPerError: { type: 'number', description: 'Estimated total cost in USD per analysis' }
            },
            required: ['costPerError']
        }
    }
};

export { CalculatePriceSchema, LogsAnalysisPriceSchema };
