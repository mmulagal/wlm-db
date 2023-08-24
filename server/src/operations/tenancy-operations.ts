import { ServiceResourceRequest, registerServiceResource } from '../lib/cloud-manager/tenancy';
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
    logger.info('Status of saving resource in tenancy:', response);
    return response;
}

export { saveResourceInTenancy };
