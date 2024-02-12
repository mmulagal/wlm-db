import { RouteTags } from '../../utils/consts';
import { PricingServiceRequest, PricingServiceResponse } from '../types/pricing.types';
import { AccountIdParams } from '../types/generic.types';

const CalculatePriceSchema = {
    tags: [RouteTags.PRICING],
    summary: 'MSSQL Server deployment cost estimation',
    description: 'Estimates monthly cost of deployable resources in USD for MSSQL server',
    params: AccountIdParams,
    body: PricingServiceRequest,
    response: {
        200: PricingServiceResponse
    }
};

export default CalculatePriceSchema;
