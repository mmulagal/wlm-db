import createError from 'http-errors';
import { gotInstanceForInternalRequest, gotInstanceForTextResponse } from '../../utils/got';
import { CLOUD_MANAGER_ENDPOINT, HEADERS, AUTH0_AUDIENCE, WORKSPACE_ID } from '../../utils/consts';
import { getAsyncLocalStorageResource } from '../../utils/async-local-storage';
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

    try {
        const data: { access_token: string; expires_in: number; token_type: string } =
            await gotInstanceForInternalRequest
                .post(`${CLOUD_MANAGER_ENDPOINT}/auth/oauth/token`, {
                    json: {
                        audience: AUTH0_AUDIENCE,
                        client_id: '3Sdstv1J0nIBIFinhic2uOF6Yr6qRMj7',
                        client_secret: '2fbQV4RarcrCweRERZRGJEZ8RmuTQ9iFQkoy1gBGUmQc5WShqAIdKuFAjMGO0M3D',
                        grant_type: 'client_credentials'
                    }
                })
                .json();
        logger.debug('service token response', data);
        return { token: `${data.token_type} ${data.access_token}`, expiresIn: data.expires_in };
    } catch (err) {
        throw createError(500, `Error occured while getting service token, ${err}`);
    }
}

async function registerServiceResource(resource: ServiceResourceRequest) {
    logger.info('Registering service resource in tenancy');

    const { token } = await getServiceToken();

    try {
        return gotInstanceForInternalRequest.post(`${CLOUD_MANAGER_ENDPOINT}/tenancy/service-resource`, {
            headers: {
                [HEADERS.AUTHORIZATION]: token
            },
            json: resource
        });
    } catch (err) {
        throw createError(500, `Error occured while register service resource, ${err}`);
    }
}

async function getTenancyResourcesByType(resourceType: string) {
    logger.info('Get tenancy resources by type', resourceType);

    const { token } = await getServiceToken();

    try {
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
    } catch (err) {
        throw createError(500, `Error occured while getting resoureces, ${err}`);
    }
}

async function removeResource(resourceIdentifier: string) {
    logger.info('Removing resource from tenancy', { resourceIdentifier });

    const { token } = await getServiceToken();

    try {
        return gotInstanceForTextResponse.delete(`${CLOUD_MANAGER_ENDPOINT}/tenancy/resource/${resourceIdentifier}`, {
            headers: {
                [HEADERS.AUTHORIZATION]: token,
                [HEADERS.WORKSPACE_ID]: getAsyncLocalStorageResource<string>(WORKSPACE_ID)
            }
        });
    } catch (err) {
        throw createError(500, `Error occured while deleting resoureces, ${err}`);
    }
}

export { registerServiceResource, getTenancyResourcesByType, removeResource, getServiceToken, ServiceResourceRequest };
