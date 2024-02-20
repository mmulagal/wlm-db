import jwt from 'jsonwebtoken';
import config from 'config';
import createError from 'http-errors';
import { gotInstanceForInternalRequest, gotInstanceForTextResponse } from '../../utils/got';
import { ACCOUNT_ID, CLOUD_MANAGER_ENDPOINT, HEADERS, WORKSPACE_ID, HttpErrorCodes } from '../../utils/consts';
import { getAsyncLocalStorageResource } from '../../utils/async-local-storage';
import getLogger from '../../utils/logger';
import { getBxpServiceToken } from './auth';

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
    const token = jwt.sign({ user }, 'SECRETS.AUTH_CLIENT_ID' as string, {
        expiresIn: config.get('jwt-token-expiry')
    });

    return { token };
}

function verifyAuthToken(token: string) {
    logger.info('Verifying auth token');
    try {
        return jwt.verify(token, 'SECRETS.AUTH_CLIENT_ID' as string);
    } catch (err) {
        const errMsg = 'Invalid token.';
        logger.error(errMsg, err);
        throw createError(400, errMsg);
    }
}

async function registerServiceResource(resource: ServiceResourceRequest) {
    logger.info('Registering service resource in tenancy');

    const { token } = await getBxpServiceToken();

    try {
        return await gotInstanceForInternalRequest.post(`${CLOUD_MANAGER_ENDPOINT}/tenancy/service-resource`, {
            headers: {
                [HEADERS.AUTHORIZATION]: token
            },
            json: resource
        });
    } catch (err) {
        throw createError(500, `Error occurred while register service resource, ${err}`);
    }
}

async function getTenancyResourcesByType(resourceType: string) {
    logger.info('Get tenancy resources by type', resourceType);

    const { token } = await getBxpServiceToken();

    try {
        return await gotInstanceForInternalRequest
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
        throw createError(500, `Error occurred while getting resoureces, ${err}`);
    }
}

async function getTenancyResourcesByTypeAndId(resourceType: string, resourceId: string) {
    logger.info('Getting tenancy resource details for resource:', resourceType, resourceId);
    const resource = (await getTenancyResourcesByType(resourceType)).find(
        (resourceObject: { resourceIdentifier: string }) => resourceObject.resourceIdentifier === resourceId
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

    const { token } = await getBxpServiceToken();

    try {
        return await gotInstanceForTextResponse.delete(
            `${CLOUD_MANAGER_ENDPOINT}/tenancy/resource/${resourceIdentifier}`,
            {
                headers: {
                    [HEADERS.AUTHORIZATION]: token,
                    [HEADERS.WORKSPACE_ID_HEADER]: getAsyncLocalStorageResource<string>(WORKSPACE_ID)
                }
            }
        );
    } catch (err) {
        throw createError(500, `Error occurred while deleting resoureces, ${err}`);
    }
}

interface TenancyUserPermissions {
    role: string;
    permissions: [string];
}
async function getPermissionsForUser(token: string, accountId: string): Promise<TenancyUserPermissions> {
    logger.info('Getting permissions for a user in tenancy account:', { accountId });

    return gotInstanceForInternalRequest
        .get(`${CLOUD_MANAGER_ENDPOINT}/tenancy/account/${accountId}/permissions-for-user`, {
            headers: {
                authorization: token
            }
        })
        .json<TenancyUserPermissions>();
}

interface Account {
    accountPublicId: string;
    accountName: string;
    isSaas: boolean;
    isGov: boolean;
    isPrivatePreviewEnabled: boolean;
    is3rdPartyServicesEnabled: boolean;
    accountSerial: string;
    userRole: string;
}

async function getTenancyAccounts(token: string): Promise<Array<Account>> {
    logger.info('Getting tenancy accounts based on JWT token:');

    return gotInstanceForInternalRequest
        .get(`${CLOUD_MANAGER_ENDPOINT}/tenancy/account`, {
            headers: {
                authorization: token
            }
        })
        .json<Account[]>();
}

export {
    registerServiceResource,
    getTenancyResourcesByType,
    getTenancyResourcesByTypeAndId,
    removeResource,
    generateAuthToken,
    verifyAuthToken,
    getPermissionsForUser,
    getTenancyAccounts,
    ServiceResourceRequest,
    MetaData,
    Account
};
