import {
    PricingClient,
    GetProductsCommand,
    GetProductsCommandInput,
    GetProductsCommandOutput
} from '@aws-sdk/client-pricing';
import { isEmpty } from 'lodash-es';
import { hasCache, readFromCacheByKey, writeToCache } from '../../utils/cache';
import { generateHash } from '../../utils/utils';
import { DEFAULT_AWS_REGION, AWS_PRICING_TYPE } from '../../utils/consts';

import getLogger from '../../utils/logger';

const logger = getLogger();

async function getProducts(
    productFilters: GetProductsCommandInput,
    readFromCache = true
): Promise<GetProductsCommandOutput> {
    logger.info('Getting pricing information to calculate estimates', {
        productFilters
    });

    const productsHashKey = generateHash(JSON.stringify(productFilters));
    if (readFromCache && hasCache(AWS_PRICING_TYPE, productsHashKey)) {
        logger.debug('Found pricing information in cache');

        return readFromCacheByKey(AWS_PRICING_TYPE, productsHashKey) as GetProductsCommandOutput;
    }

    // We don't need credentials as our SaaS account is already having pricing:getProducts permission
    const pricingClient = new PricingClient({ region: DEFAULT_AWS_REGION });
    const command = new GetProductsCommand(productFilters);

    const pricingResult = await pricingClient.send(command);

    if (!isEmpty(pricingResult)) {
        logger.debug('Writing pricing information to cache');

        writeToCache(AWS_PRICING_TYPE, productsHashKey, pricingResult);
    }

    return pricingResult;
}

export default getProducts;
