import {
    PricingClient,
    paginateGetProducts,
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

async function fetchPricingData(
    pricingClient: PricingClient,
    productFilters: GetProductsCommandInput
): Promise<GetProductsCommandOutput> {
    const paginator = paginateGetProducts({ client: pricingClient }, productFilters);
    const pricingResult: GetProductsCommandOutput = { PriceList: [], $metadata: { httpStatusCode: 200 } };

    for await (const page of paginator) {
        if (isEmpty(pricingResult.$metadata.requestId) && page?.$metadata) {
            pricingResult.$metadata = page.$metadata;
        }
        if (page?.PriceList) {
            pricingResult.PriceList = pricingResult.PriceList?.concat(page.PriceList);
        }
    }

    return pricingResult;
}

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
    const pricingClient = new PricingClient({
        region: AWS_PRICING_REGION,
        maxAttempts: 5,
        retryMode: 'adaptive', // Use adaptive retry mode for better throttling handling
        defaultsMode: 'cross-region' // Optimize for cross-region calls; wlmdb pod could be in any region
    });

    const pricingResult = await fetchPricingData(pricingClient, productFilters);

    if (!isEmpty(pricingResult?.PriceList)) {
        logger.debug('Writing pricing information to cache');

        writeToCache(AWS_PRICING_TYPE, productsHashKey, pricingResult);
    }

    return pricingResult;
}

export default getProducts;
