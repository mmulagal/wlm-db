import {
    ServiceResourceRequest,
    registerServiceResource,
    getTenancyResourcesByType
} from '../lib/cloud-manager/tenancy';
import { ACCOUNT_ID, WORKSPACE_ID } from '../utils/consts';
import { getAsyncLocalStorageResource } from '../utils/async-local-storage';
import getLogger from '../utils/logger';

const logger = getLogger();

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
        resourceType: resourceType,
        workspacePublicId: workspaceId,
        accountPublicId: accountId,
        resourceClass: resourceClass,
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
        resource => resource.resourceIdentifier === resourceId
    );

    const details: ServiceResourceRequest = {
        name: resourceDetails?.name || '',
        resourceIdentifier: resourceDetails?.resourceIdentifier || '',
        resourceType: resourceDetails?.resourceType || '',
        workspacePublicId: '',
        accountPublicId: '',
        resourceClass: resourceDetails?.resourceClass || '',
        metadata: { propertyName: '', propertyValue: '' }
    };

    if (resourceDetails) {
        details.metadata = JSON.parse(resourceDetails.metadata);
    }

    logger.debug('Tenancy resource details', resourceDetails);

    return details;
}

export { saveResourceInTenancy, getTenancyResource };
