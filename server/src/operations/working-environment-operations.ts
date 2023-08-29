import createError from 'http-errors';
import { RESOURCESTYPE, HttpErrorCodes } from '../utils/consts';
import { getTenancyResourcesByType, getTenancyResourcesByTypeAndId } from '../lib/cloud-manager/tenancy';
import getLogger from '../utils/logger';
import { getDatabasesCount, getResourceDetails } from './workloads/mssql/mssql-operations';

const logger = getLogger();
async function getWorkingEnvironments() {
    logger.info('Getting working environment list');
    const mssqlCredentials = await getTenancyResourcesByType(RESOURCESTYPE.MSSQL);
    const workingEnvironments: { id: string; provider: string; name?: string; deploymentState: string }[] =
        mssqlCredentials.map((credentials: any) => {
            const { metadata } = credentials || {};
            const { properties } = metadata || {};
            let deploymentState = '';
            try {
                if (properties) {
                    const parsedProperties = JSON.parse(properties);
                    deploymentState = parsedProperties.deploymentState || '';
                }
            } catch (error) {
                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Error parsing resource properties, ${error}`);
            }
            return {
                id: credentials.resourceIdentifier,
                provider: RESOURCESTYPE.MSSQL,
                name: credentials.name,
                deploymentState
            };
        });
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
