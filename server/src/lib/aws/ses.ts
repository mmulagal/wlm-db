import { SESv2Client } from '@aws-sdk/client-sesv2';

import getLogger from '../../utils/logger';

const logger = getLogger();

// Per server-patterns: AWS SDK v3 clients should be singletons. Cache one client per
// resolved region so repeated sends reuse the same credential chain.
const sesClientsByRegion = new Map<string, SESv2Client>();

const getSES = async (): Promise<SESv2Client> => {
    // Always use the pod's own region. Cross-partition SES (commercial pod -> gov SES)
    // cannot work because the pod's IRSA web-identity token is issued by the commercial
    // OIDC provider and gov STS has no trust relationship with it, producing
    // InvalidIdentityTokenException. Gov tenants still receive email — it's sent from
    // commercial SES as standard internet email, matching gg-skywalker's pattern.
    const region = process.env.REGION;
    let client = sesClientsByRegion.get(region ?? '');
    if (!client) {
        logger.debug('Creating SES client', { region });
        client = new SESv2Client({ region });
        sesClientsByRegion.set(region ?? '', client);
    }
    return client;
};

export { getSES };
