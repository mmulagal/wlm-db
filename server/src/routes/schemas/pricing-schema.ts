import { RouteTags } from '../../utils/consts';
import { PricingServiceRequest, PricingServiceResponse } from '../types/pricing.types';

const CalculatePriceSchema = {
    tags: [RouteTags.PRICING],
    description: 'Estimates monthly cost of deployable resources in USD',
    body: PricingServiceRequest,
    response: {
        200: PricingServiceResponse
    }
};

export default CalculatePriceSchema;
