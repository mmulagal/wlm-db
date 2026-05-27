import { SESv2Client } from '@aws-sdk/client-sesv2';

import getLogger from '../../utils/logger';
import { getAsyncLocalStorageResource } from '../../utils/async-local-storage';
import { GOV_ACCOUNT } from '../../utils/consts';

const logger = getLogger();
const AWS_SES_COMMERCIAL_REGION = 'us-east-1';
const AWS_SES_GOV_REGION = 'us-gov-west-1';

// Per server-patterns: AWS SDK v3 clients should be singletons. Keep one client per region
// so the gov vs commercial split keeps working without rebuilding the credential chain per call.
const sesClientsByRegion = new Map<string, SESv2Client>();

const getSES = async (): Promise<SESv2Client> => {
    const isGov = getAsyncLocalStorageResource<boolean>(GOV_ACCOUNT);
    const region = isGov ? AWS_SES_GOV_REGION : AWS_SES_COMMERCIAL_REGION;
    let client = sesClientsByRegion.get(region);
    if (!client) {
        logger.debug('Creating SES client', { region });
        client = new SESv2Client({ region });
        sesClientsByRegion.set(region, client);
    }
    return client;
};

export { getSES };
