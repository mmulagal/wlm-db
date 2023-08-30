import createError from 'http-errors';
import { RESOURCESTYPE, HttpErrorCodes, WORKSPACE_ID } from '../utils/consts';
import { getTenancyResourcesByType, getTenancyResourcesByTypeAndId } from '../lib/cloud-manager/tenancy';
import getLogger from '../utils/logger';
import { getDatabasesCount, getResourceDetails } from './workloads/mssql/mssql-operations';
import { getAsyncLocalStorageResource } from '../utils/async-local-storage';

const logger = getLogger();
async function getWorkingEnvironments() {
    logger.info('Getting working environment list');
    const mssqlResources = await getTenancyResourcesByType(RESOURCESTYPE.MSSQL);
    const workingEnvironments: { id: string; provider: string; name?: string; deploymentState: string }[] =
        mssqlResources
            .filter((resource: any) => {
                const { metadata } = resource || {};
                try {
                    if (metadata) {
                        const { properties } = JSON.parse(metadata) || {};
                        const parsedProperties = JSON.parse(properties);
                        const workspaceid = parsedProperties.workspace || '';
                        // workaround to filter based on workspaceid passed as header
                        return workspaceid === getAsyncLocalStorageResource<string>(WORKSPACE_ID);
                    }
                } catch (error) {
                    throw createError(
                        HttpErrorCodes.INTERNAL_SERVER_ERROR,
                        `Error parsing resource properties, ${error}`
                    );
                }
                return false;
            })
            .map((resource: any) => ({
                id: resource.resourceIdentifier,
                provider: resource.resourceType,
                name: resource.name,
                deploymentState: resource.metadata ? JSON.parse(resource.metadata).properties.deploymentState || '' : ''
            }));
    return workingEnvironments || [];
}

async function getMSSQLEnvData(tenancyResource: any, resourceId: string) {
    logger.info('Getting MSSQL working environment data for resource:', resourceId);
    const [credentialsId, region, activeInstanceId, standbyInstanceId] = await getResourceDetails(resourceId);
    const dbCount = await getDatabasesCount(credentialsId, region, activeInstanceId, standbyInstanceId);
    const { name: serverName, metadata } = tenancyResource || {};
    const { properties } = metadata || {};
    let location = '';
    let deploymentState = '';
    try {
        if (properties) {
            const parsedProperties = JSON.parse(properties);
            location = parsedProperties.location || '';
            deploymentState = parsedProperties.deploymentState || '';
        }
    } catch (error) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Error parsing resource properties, ${error}`);
    }
    return {
        id: resourceId,
        serverName,
        location,
        deploymentState,
        databasesCount: dbCount.totalCount,
        domain: ''
    };
}

async function getWorkingEnvironment(id: string) {
    logger.info('Getting MSSQL working environment data for resource:', id);
    const tenancyResource = await getTenancyResourcesByTypeAndId(RESOURCESTYPE.MSSQL, id);

    if (tenancyResource) {
        const response = await getMSSQLEnvData(tenancyResource, id);
        if (response) {
            return response;
        } else {
            throw createError(HttpErrorCodes.NOT_FOUND, 'Error Tenancy resource data not found');
        }
    }
}

export { getWorkingEnvironments, getWorkingEnvironment };
