import config from 'config';
import { gotInstanceForInternalRequest } from '../../utils/got';
import { CLOUD_MANAGER_ENDPOINT, HEADERS, AUTH0_AUDIENCE } from '../../utils/consts';
import getLogger from '../../utils/logger';

const logger = getLogger();

interface ServiceResourceRequest {
    name: string;
    resourceIdentifier: string;
    resourceType: string;
    workspacePublicId: string;
    accountPublicId: string;
    resourceClass: string;
    metadata: MetaData;
}

interface MetaData {
    propertyName: string;
    propertyValue: string;
}

async function getServiceToken(): Promise<{ token: string; expiresIn: number }> {
    logger.info('Getting service token:');

    const CLIENT_ID = process.env.CLIENT_ID || config.get('wlmdb-client.id');
    const CLIENT_SECRET = process.env.CLIENT_SECRET || config.get('wlmdb-client.secret');

    const data: { access_token: string; expires_in: number; token_type: string } = await gotInstanceForInternalRequest
        .post(`${CLOUD_MANAGER_ENDPOINT}/auth/oauth/token`, {
            json: {
                audience: AUTH0_AUDIENCE,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'client_credentials'
            }
        })
        .json();
    logger.debug('service token response', data);
    return { token: `${data.token_type} ${data.access_token}`, expiresIn: data.expires_in };
}

async function registerServiceResource(resource: ServiceResourceRequest) {
    logger.info('Registering service resource in tenancy');

    const { token } = await getServiceToken();
    return gotInstanceForInternalRequest.post(`${CLOUD_MANAGER_ENDPOINT}/tenancy/service-resource`, {
        headers: {
            [HEADERS.AUTHORIZATION]: token
        },
        json: resource
    });
}

async function getTenancyResourcesByType(resourceType: string) {
    logger.info('Get tenancy resources by type', resourceType);

    const { token } = await getServiceToken();
    return gotInstanceForInternalRequest
        .get(`${CLOUD_MANAGER_ENDPOINT}/tenancy/service-resource`, {
            searchParams: {
                resourceType
            },
            headers: {
                [HEADERS.AUTHORIZATION]: token
            }
        })
        .json<
            {
                resourceIdentifier: string;
                account: string;
                resourceType: string;
                resourceClass: string;
                name: string;
                agentIds: string[];
                metadata: string;
            }[]
        >();
}

async function getTenancyResourcesByTypeAndId(resourceType: string, resourceId: string) {
    const resource = (await getTenancyResourcesByType(resourceType)).find(
        resource => resource.resourceIdentifier === resourceId
    );
    if (resource) {
        if (resource?.metadata?.length) {
            resource.metadata = JSON.parse(resource.metadata);
        } else {
            resource.metadata = '';
        }
    }
    return resource;
}

async function removeResource(resourceIdentifier: string) {
    logger.info('Removing resource from tenancy', { resourceIdentifier });

    const { token } = await getServiceToken();
    return gotInstanceForInternalRequest.delete(`${CLOUD_MANAGER_ENDPOINT}/tenancy/resource/${resourceIdentifier}`, {
        headers: {
            [HEADERS.AUTHORIZATION]: token
        }
    });
}

export {
    registerServiceResource,
    getTenancyResourcesByType,
    getTenancyResourcesByTypeAndId,
    removeResource,
    getServiceToken,
    ServiceResourceRequest
};
