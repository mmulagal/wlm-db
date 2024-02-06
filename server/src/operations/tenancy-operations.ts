import {
    ServiceResourceRequest,
    registerServiceResource,
    getTenancyResourcesByType,
    removeResource
} from '../lib/cloud-manager/tenancy';
import { ACCOUNT_ID, WORKSPACE_ID } from '../utils/consts';
import { getAsyncLocalStorageResource } from '../utils/async-local-storage';
import getLogger from '../utils/logger';

const logger = getLogger();

interface ServiceResourceResponse {
    name: string;
    resourceIdentifier: string;
    resourceType: string;
    workspacePublicId: string;
    accountPublicId: string;
    resourceClass: string;
    metadata: { [key: string]: string };
}

async function saveResourceInTenancy(
    resourceName: string,
    resourceId: string,
    resourceType: string,
    resourceClass: string,
    resourceProperties: object
) {
    logger.info('Save resource in tenancy:', {
        resourceName,
        resourceId,
        resourceType,
        resourceClass,
        resourceProperties
    });

    const accountId = getAsyncLocalStorageResource<string>(ACCOUNT_ID);
    const workspaceId = getAsyncLocalStorageResource<string>(WORKSPACE_ID);

    const params: ServiceResourceRequest = {
        name: resourceName,
        resourceIdentifier: resourceId,
        resourceType,
        workspacePublicId: workspaceId,
        accountPublicId: accountId,
        resourceClass,
        metadata: {
            propertyName: 'properties',
            propertyValue: JSON.stringify(resourceProperties)
        }
    };

    const response = await registerServiceResource(params);

    logger.debug('Status of saving resource in tenancy:', response);

    return response;
}

async function getTenancyResource(resourceType: string, resourceId: string) {
    logger.info('Fetching tenancy resource ', resourceType, resourceId);

    const resourceDetails = (await getTenancyResourcesByType(resourceType)).find(
        (resource: { resourceIdentifier: string }) => resource.resourceIdentifier === resourceId
    );

    const details: ServiceResourceResponse = {
        name: resourceDetails?.name || '',
        resourceIdentifier: resourceDetails?.resourceIdentifier || '',
        resourceType: resourceDetails?.resourceType || '',
        workspacePublicId: '',
        accountPublicId: '',
        resourceClass: resourceDetails?.resourceClass || '',
        metadata: {}
    };

    if (resourceDetails) {
        details.metadata = JSON.parse(resourceDetails.metadata);
    }

    logger.debug('Tenancy resource details', resourceDetails);

    return details;
}

async function removeTenancyResource(resourceId: string): Promise<{ status: number; message: string }> {
    logger.info('Remove resouce from tenancy:', { resourceId });

    try {
        const response = await removeResource(resourceId);
        logger.info('Remove resource response:', response);
        return { status: 204, message: 'Ok' }; // Successfully deleted
    } catch (error) {
        logger.error('Failed to remove resource. Reason:', error);
        return { status: 404, message: error as string };
    }
}

export { saveResourceInTenancy, getTenancyResource, removeTenancyResource };
