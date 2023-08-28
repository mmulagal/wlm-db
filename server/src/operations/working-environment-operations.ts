import createError from 'http-errors';
import { RESOURCESTYPE, HttpErrorCodes } from '../utils/consts';
import { getTenancyResourcesByType, getTenancyResourcesByTypeAndId } from '../lib/cloud-manager/tenancy';
import getLogger from '../utils/logger';
import { getDatabasesCount, getResourceDetails } from './workloads/mssql/mssql-operations';

const logger = getLogger();
async function getWorkingEnvironments() {
    logger.info('Getting working environment list');
    const workingEnvironments: { id: string; provider: string; name?: string; state: string }[] = [];
    const mssqlCredentials = await getTenancyResourcesByType(RESOURCESTYPE.MSSQL);
    mssqlCredentials.map((credentials: any) => {
        let state = '';
        try {
            state =
                typeof credentials.metadata === 'string' && credentials.metadata.includes('state')
                    ? JSON.parse(credentials.metadata)
                    : 'initializing';
        } catch (error) {
            logger.error('Unable to parse JSON', error);
            state = 'initializing';
        }
        workingEnvironments.push({
            id: credentials.resourceIdentifier,
            provider: RESOURCESTYPE.MSSQL,
            name: credentials.name,
            state
        });
    });
    return workingEnvironments ? workingEnvironments : [];
}

async function getMSSQLEnvData(tenancyResource: any, resourceId: string) {
    logger.info('Getting MSSQL working environment data for resource:', resourceId);
    const [credentialsId, region, activeInstanceId, standbyInstanceId] = await getResourceDetails(resourceId);
    const dbCount = await getDatabasesCount(credentialsId, region, activeInstanceId, standbyInstanceId);
    const serverName = tenancyResource?.name;
    try {
        tenancyResource = tenancyResource?.metadata?.properties
            ? JSON.parse(tenancyResource?.metadata?.properties)
            : {};
    } catch (error) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Error parsing resource properties, ${error}`);
    }
    const location = tenancyResource?.activeInstanceId || '';
    const deploymentState = tenancyResource?.deploymentState || '';
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
        const response = getMSSQLEnvData(tenancyResource, id);
        if (response) {
            return response;
        } else {
            throw createError(HttpErrorCodes.NOT_FOUND, 'Error Tenancy resource data not found');
        }
    }
}

export { getWorkingEnvironments, getWorkingEnvironment };
