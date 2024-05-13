import createError from 'http-errors';
import { RESOURCESTYPE, HttpErrorCodes, ACCOUNT_ID } from '../utils/consts';
import getLogger from '../utils/logger';
import { getDatabasesCount, getResourceDetails, getActiveSqlNode } from './workloads/mssql/mssql-operations';
import { getAsyncLocalStorageResource } from '../utils/async-local-storage';
import { listRelationshipsResources } from '../lib/database/db';
import { getResources } from './database/database-operations';
import { describeInstance } from '../lib/aws/ec2';

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
    const { items: mssqlResources } = await getResources(
        accountId,
        undefined,
        undefined,
        undefined,
        RESOURCESTYPE.MSSQL
    );
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
    const [credentialsId, region, node1InstanceId] = await getResourceDetails(resourceId);
    if (!credentialsId || !region || !node1InstanceId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Unable to get mssql env data');
    }
    const { activeNodeInstanceId } = await getActiveSqlNode(credentialsId, region!, node1InstanceId);
    let activeNodeInstanceIp;
    if (activeNodeInstanceId) {
        const activeInstanceDetails = await describeInstance(credentialsId, region, {
            InstanceIds: [activeNodeInstanceId]
        });
        activeNodeInstanceIp =
            activeInstanceDetails?.Reservations?.[0]?.Instances?.[0]?.NetworkInterfaces?.[0]?.PrivateIpAddress;
        const dbCount = await getDatabasesCount(credentialsId, region, activeNodeInstanceId!, '.');
        const { resource_name: serverName, cloud_provider_name: location } = resourceDetails || {};
        const deploymentState = 'SUCCESS';
        return {
            id: resourceId,
            serverName,
            location,
            deploymentState,
            databasesCount: dbCount?.totalCount,
            domain: activeNodeInstanceIp || ''
        };
    }

    if (!activeNodeInstanceId) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            'Failed to get MSSQL resource information, the instance is not available'
        );
    }
}

async function getWorkingEnvironment(id: string) {
    logger.info('Getting MSSQL working environment data for resource:', id);
    const accountId = getAsyncLocalStorageResource<string>(ACCOUNT_ID);
    const {
        items: [resourceDetails]
    } = await getResources(accountId, id, undefined, undefined, RESOURCESTYPE.MSSQL);

    if (resourceDetails) {
        const response = await getMSSQLEnvData(resourceDetails, id);
        if (response) {
            return response;
        }
        throw createError(HttpErrorCodes.NOT_FOUND, 'Error Tenancy resource data not found');
    }
}

async function getResourceRelationships() {
    logger.info('Get relations between resources ');

    const accountId = getAsyncLocalStorageResource<string>(ACCOUNT_ID);
    const relationshipResources = await listRelationshipsResources(accountId);

    return relationshipResources.map(({ resource_id: resourceId, co_relation_id: coRelationId }) => ({
        source: {
            id: resourceId
        },
        target: {
            id: coRelationId!
        }
    }));
}

export { getWorkingEnvironments, getWorkingEnvironment, getResourceRelationships };
