import {
    PricingClient,
    GetProductsCommand,
    GetProductsCommandInput,
    GetProductsCommandOutput
} from '@aws-sdk/client-pricing';
import { DEFAULT_AWS_REGION } from '../../utils/consts';

import getLogger from '../../utils/logger';

const logger = getLogger();

async function getProducts(productFilters: GetProductsCommandInput): Promise<GetProductsCommandOutput> {
    logger.info('Getting pricing information to calculate estimates', {
        productFilters
    });

    const pricingClient = new PricingClient({ region: DEFAULT_AWS_REGION });

    const command = new GetProductsCommand(productFilters);

    return pricingClient.send(command);
}

export default getProducts;
