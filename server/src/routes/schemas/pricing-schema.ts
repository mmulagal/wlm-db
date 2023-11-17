import { RouteTags } from '../../utils/consts';
import { PricingServiceRequest, PricingServiceResponse } from '../types/pricing.types';
import { AwsParams } from '../types/aws.types';

const CalculatePriceSchema = {
    tags: [RouteTags.PRICING],
    summary: 'Deployment cost estimation',
    description: 'Estimates monthly cost of deployable resources in USD',
    params: AwsParams,
    body: PricingServiceRequest,
    response: {
        200: PricingServiceResponse
    }
};

export default CalculatePriceSchema;
