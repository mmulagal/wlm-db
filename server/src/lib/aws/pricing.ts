import {
    PricingClient,
    GetProductsCommand,
    GetProductsCommandInput,
    GetProductsCommandOutput
} from '@aws-sdk/client-pricing';
import { isEmpty } from 'lodash-es';
import { hasCache, readFromCacheByKey, writeToCache } from '../../utils/cache';
import { generateHash } from '../../utils/utils';
import { AWS_PRICING_TYPE } from '../../utils/consts';

import getLogger from '../../utils/logger';

const logger = getLogger();
const AWS_PRICING_REGION = 'us-east-1';

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
    /*
        The pricing SDK is supported in only the following regions.
        us-east-1
        eu-central-1
        ap-south-1
    */
    const pricingClient = new PricingClient({ region: AWS_PRICING_REGION });
    const command = new GetProductsCommand(productFilters);

    const pricingResult = await pricingClient.send(command);

    if (!isEmpty(pricingResult)) {
        logger.debug('Writing pricing information to cache');

        writeToCache(AWS_PRICING_TYPE, productsHashKey, pricingResult);
    }

    return pricingResult;
}

export default getProducts;
