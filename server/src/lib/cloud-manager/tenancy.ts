import jwt from 'jsonwebtoken';
import config from 'config';
import createError from 'http-errors';
import { gotInstanceForInternalRequest, gotInstanceForTextResponse } from '../../utils/got';
import {
    ACCOUNT_ID,
    CLOUD_MANAGER_ENDPOINT,
    HEADERS,
    AUTH0_AUDIENCE,
    WORKSPACE_ID,
    SECRETS,
    HttpErrorCodes,
    SERVICE_TOKEN,
    TOKEN_EXPIRATION_TIME
} from '../../utils/consts';
import { getAsyncLocalStorageResource, setAsyncLocalStorageResource } from '../../utils/async-local-storage';
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

function generateAuthToken(user: object) {
    logger.info('Generating auth token');
    const token = jwt.sign({ user }, '3Sdstv1J0nIBIFinhic2uOF6Yr6qRMj7' as string, {
        expiresIn: config.get('jwt-token-expiry')
    });

    return { token };
}

function verifyAuthToken(token: string) {
    logger.info('Verifying auth token');
    try {
        return jwt.verify(token, SECRETS.CLIENT_ID as string);
    } catch (err) {
        const errMsg = 'Invalid token.';
        logger.error(errMsg, err);
        throw createError(400, errMsg);
    }
}

async function getServiceToken(): Promise<{ token: string; expiresIn: number }> {
    logger.info('Getting service token:');

    const token: string = getAsyncLocalStorageResource(SERVICE_TOKEN);
    const tokenExpirationTime: number = getAsyncLocalStorageResource(TOKEN_EXPIRATION_TIME);

    if (token && Date.now() < tokenExpirationTime) {
        return { token, expiresIn: tokenExpirationTime };
    }

    try {
        const data: { access_token: string; expires_in: number; token_type: string } =
            await gotInstanceForInternalRequest
                .post(`${CLOUD_MANAGER_ENDPOINT}/auth/oauth/token`, {
                    json: {
                        audience: AUTH0_AUDIENCE,
                        client_id: SECRETS.CLIENT_ID,
                        client_secret: SECRETS.CLIENT_SECRET,
                        grant_type: 'client_credentials'
                    }
                })
                .json();
        logger.debug('service token response', data);
        setAsyncLocalStorageResource(SERVICE_TOKEN, `${data.token_type} ${data.access_token}`);
        // converting seconds of expires in value to time stamp
        const expiresIn = Date.now() + data.expires_in * 1000;
        setAsyncLocalStorageResource(TOKEN_EXPIRATION_TIME, expiresIn);
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
                    resourceType,
                    account: getAsyncLocalStorageResource<string>(ACCOUNT_ID),
                    workspace: getAsyncLocalStorageResource<string>(WORKSPACE_ID)
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

async function getTenancyResourcesByTypeAndId(resourceType: string, resourceId: string) {
    logger.info('Getting tenancy resource details for resource:', resourceType, resourceId);
    const resource = (await getTenancyResourcesByType(resourceType)).find(
        resourceObject => resourceObject.resourceIdentifier === resourceId
    );
    if (resource) {
        if (resource?.metadata?.length) {
            resource.metadata = JSON.parse(resource.metadata);
        } else {
            resource.metadata = '';
        }

        return resource;
    }
    throw createError(HttpErrorCodes.NOT_FOUND, `Error Tenancy resource not found for resource id: ${resourceId}`);
}

async function removeResource(resourceIdentifier: string) {
    logger.info('Removing resource from tenancy', { resourceIdentifier });

    const { token } = await getServiceToken();

    try {
        return gotInstanceForTextResponse.delete(`${CLOUD_MANAGER_ENDPOINT}/tenancy/resource/${resourceIdentifier}`, {
            headers: {
                [HEADERS.AUTHORIZATION]: token,
                [HEADERS.WORKSPACE_ID_HEADER]: getAsyncLocalStorageResource<string>(WORKSPACE_ID)
            }
        });
    } catch (err) {
        throw createError(500, `Error occured while deleting resoureces, ${err}`);
    }
}

export {
    registerServiceResource,
    getTenancyResourcesByType,
    getTenancyResourcesByTypeAndId,
    removeResource,
    getServiceToken,
    generateAuthToken,
    verifyAuthToken,
    ServiceResourceRequest,
    MetaData
};
