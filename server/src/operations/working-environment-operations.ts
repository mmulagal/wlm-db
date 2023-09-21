import createError from 'http-errors';
import { resource } from '@prisma/client';
import { RESOURCESTYPE, HttpErrorCodes, ACCOUNT_ID } from '../utils/consts';
import getLogger from '../utils/logger';
import { getDatabasesCount, getResourceDetails } from './workloads/mssql/mssql-operations';
import { getAsyncLocalStorageResource } from '../utils/async-local-storage';
import { listResources } from '../lib/database/db';

interface WorkingEnvironment {
    id: string;
    provider: string;
    name?: string;
    deploymentState: string;
}

const logger = getLogger();
async function getWorkingEnvironments() {
    logger.info('Getting working environment list');

    const accountId = getAsyncLocalStorageResource<string>(ACCOUNT_ID);
    const mssqlResources = (await listResources(accountId, undefined, RESOURCESTYPE.MSSQL)) as resource[];
    const workingEnvironments: WorkingEnvironment[] = mssqlResources.map(
        ({
            resource_id: resourceId,
            resource_type: resourceType,
            resource_name: resourceName,
            cloud_provider_name: cloudProviderName
        }) => ({
            id: resourceId,
            provider: resourceType,
            name: resourceName || '',
            location: cloudProviderName,
            deploymentState: 'SUCCESS'
        })
    );

    return workingEnvironments;
}

async function getMSSQLEnvData(resourceDetails: any, resourceId: string) {
    logger.info('Getting MSSQL working environment data for resource:', resourceId);
    const [credentialsId, region, activeNodeInstanceId, standbyNodeInstanceId] = await getResourceDetails(resourceId);
    if (!credentialsId || !region || !activeNodeInstanceId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Unable to get mssql env data');
    }
    const dbCount = await getDatabasesCount(
        credentialsId,
        region,
        activeNodeInstanceId,
        standbyNodeInstanceId || undefined
    );
    const { resource_name: serverName, metadata, cloud_provider_name: location } = resourceDetails || {};
    const deploymentState = 'SUCCESS';
    let domain = '';
    if (metadata) {
        domain = metadata.activeNodeInstanceIp || '';
    }
    return {
        id: resourceId,
        serverName,
        location,
        deploymentState,
        databasesCount: dbCount.totalCount,
        domain
    };
}

async function getWorkingEnvironment(id: string) {
    logger.info('Getting MSSQL working environment data for resource:', id);
    const accountId = getAsyncLocalStorageResource<string>(ACCOUNT_ID);
    const [Resource] = await listResources(accountId, id, RESOURCESTYPE.MSSQL);

    if (Resource) {
        const response = await getMSSQLEnvData(Resource, id);
        if (response) {
            return response;
        }
        throw createError(HttpErrorCodes.NOT_FOUND, 'Error Tenancy resource data not found');
    }
}

export { getWorkingEnvironments, getWorkingEnvironment };
