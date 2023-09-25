import {
    PricingClient,
    GetProductsCommand,
    GetProductsCommandInput,
    GetProductsCommandOutput
} from '@aws-sdk/client-pricing';
import { DEFAULT_AWS_REGION } from '../../utils/consts';

import getLogger from '../../utils/logger';
import { getCredentialDetails } from '../cloud-manager/credentials';

const logger = getLogger();

async function getProducts(
    credentialsId: string,
    productFilters: GetProductsCommandInput
): Promise<GetProductsCommandOutput> {
    logger.info('Getting pricing information to calculate estimates', {
        productFilters
    });

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialDetails(credentialsId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };
    const pricingClient = new PricingClient({ credentials, region: DEFAULT_AWS_REGION });
    const command = new GetProductsCommand(productFilters);

    return pricingClient.send(command);
}

export default getProducts;
