import { RouteTags } from '../../utils/consts';
import { PricingServiceRequest, PricingServiceResponse } from '../types/pricing.types';

const CalculatePriceSchema = {
    tags: [RouteTags.PRICING],
    description: 'Calculates cost for the selected resources.',
    body: PricingServiceRequest,
    response: {
        200: PricingServiceResponse
    }
};

export default CalculatePriceSchema;
