import createError from 'http-errors';
import moment from 'moment';
import { DEPLOYMENT_STATUS } from '@prisma/client';
import { isEmpty } from 'lodash-es';
import {
    createConfig,
    updateConfig,
    deleteConfig,
    listConfig,
    listDeployments,
    listResources,
    countResources,
    listDatabaseInstances,
    updateDatabaseInstance,
    updateResource,
    listDatabaseInstancesPaginated
} from '../../lib/database/db';
import {
    FormConfigCreateResponseType,
    FormConfigListResponseType,
    FormConfigObjectResponseType,
    FormConfigUpdateResponseType
} from '../../routes/types/form-config.types';
import { DeploymentStatusListResponseType, DeploymentStatusResponseType } from '../../routes/types/deployment.types';
import getLogger from '../../utils/logger';
import { CONFIG_NOT_FOUND, HttpErrorCodes, RESOURCESTYPE, STACK_NOT_FOUND } from '../../utils/consts';
import { ResourceDetails, DeploymentDetails } from '../../utils/common-types';
import { updateLongRunningAuditGroup } from '../cloud-manager/audit-operations';
import { ListDatabaseInstancesRecord } from '../../lib/database/db-types';

const logger = getLogger();

async function getSavedConfig(accountId: string, id: string): Promise<FormConfigObjectResponseType> {
    logger.info('Load individual saved config ', accountId);
    try {
        const [
            {
                user = '',
                creation_time: creationTime,
                data,
                name = '',
                modified_time: modifiedTime,
                database_type: databaseType
            } = {}
        ] = (await listConfig(accountId, id)) || [];
        return {
            accountId,
            id,
            user,
            creationTime: moment(creationTime).unix() * 1000,
            data,
            name,
            ...(modifiedTime && { modifiedTime: moment(modifiedTime).unix() * 1000 }),
            databaseType
        };
    } catch (error) {
        logger.error(`Error occurred while fetching saved config ${id}. Error: ${error}`);
        throw createError(HttpErrorCodes.NOT_FOUND, CONFIG_NOT_FOUND(id));
    }
}

async function deleteSavedConfig(accountId: string, id: string): Promise<void> {
    logger.info('Delete saved config ', accountId, id);
    const savedConfigs = await getSavedConfig(accountId, id);
    updateLongRunningAuditGroup(undefined, undefined, savedConfigs?.name);

    try {
        await deleteConfig(accountId, id);
    } catch (error) {
        logger.error(`Error occurred while deleting saved config ${id}. Error: ${error}`);
        throw createError(HttpErrorCodes.NOT_FOUND, CONFIG_NOT_FOUND(id));
    }
}

async function getAllSavedConfig(accountId: string): Promise<FormConfigListResponseType> {
    logger.info('Load saved config ', accountId);

    const data = await listConfig(accountId);
    return data.map(
        ({
            id,
            user,
            creation_time: creationTime,
            data: configData,
            name,
            modified_time: modifiedTime,
            database_type: databaseType
        }) => ({
            accountId,
            id,
            user,
            name,
            creationTime: moment(creationTime).unix() * 1000,
            data: configData as object,
            ...(modifiedTime && { modifiedTime: moment(modifiedTime).unix() * 1000 }),
            databaseType
        })
    );
}

async function saveConfig(
    accountId: string,
    user: string,
    name: string,
    data: object,
    databaseType?: string
): Promise<FormConfigCreateResponseType> {
    logger.info('Save config ', accountId);
    logger.debug('Save config data', data);

    updateLongRunningAuditGroup(undefined, undefined, name);
    const { id, creation_time: configCreationTime } = await createConfig(accountId, {
        user,
        name,
        creationTime: Date.now(),
        data,
        databaseType
    });
    return {
        id,
        accountId,
        creationTime: moment(configCreationTime).unix() * 1000,
        user,
        data,
        name
    };
}

async function modifyConfig(
    accountId: string,
    configId: string,
    name: string,
    data?: object
): Promise<FormConfigUpdateResponseType> {
    logger.info('Modify config ', { accountId, configId });
    logger.debug('Modify config data', data);

    try {
        const { id } = await updateConfig(accountId, configId, {
            name,
            data
        });
        return { id };
    } catch (error) {
        logger.error(`Error occurred while updating saved config ${configId}. Error: ${error}`);
        throw createError(HttpErrorCodes.NOT_FOUND, CONFIG_NOT_FOUND(configId));
    }
}

async function getAllDeploymentStatus(accountId: string): Promise<DeploymentStatusListResponseType> {
    logger.info(' Deployment status', accountId);

    const data = await listDeployments(accountId);

    logger.debug(data);

    return data
        .filter(each => each.parent_deployment_id == null)
        .map(
            ({
                deployment_id: deploymentId,
                deployment_name: deploymentName,
                deployment_status: deploymentStatus,
                deployment_status_reason: reason
            }) => ({
                deploymentId,
                deploymentName,
                deploymentStatus,
                deploymentFailureReason: reason || ''
            })
        );
}

async function getDeploymentStatusByName(accountId: string, name: string): Promise<DeploymentStatusResponseType> {
    logger.info(' Deployment status by id', accountId, name);

    try {
        const [
            {
                deployment_id: deploymentId,
                deployment_name: deploymentName,
                deployment_status: deploymentStatus,
                deployment_status_reason: reason
            }
        ] = await listDeployments(accountId, undefined, name, undefined, undefined, 1);
        return {
            deploymentId,
            deploymentName,
            deploymentStatus,
            deploymentFailureReason: reason || ''
        };
    } catch (error) {
        throw createError(HttpErrorCodes.NOT_FOUND, STACK_NOT_FOUND(name));
    }
}

async function getDeployments(
    accountId?: string,
    deploymentId?: string,
    deploymentName?: string,
    statuses?: Array<DEPLOYMENT_STATUS>,
    parentStackOnly?: boolean,
    API_PAGE_SIZE?: number,
    nextToken?: string
): Promise<Array<DeploymentDetails>> {
    logger.info(' Get the Deployments', {
        accountId,
        deploymentId,
        deploymentName,
        statuses,
        parentStackOnly,
        API_PAGE_SIZE,
        nextToken
    });

    try {
        const records = await listDeployments(
            accountId,
            deploymentId,
            deploymentName,
            statuses,
            parentStackOnly,
            API_PAGE_SIZE,
            nextToken
        );
        return trimAccountIdForDemo(records);
    } catch (error) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to list the deployments');
    }
}

async function getResources(
    accountId?: string,
    resourceId?: string,
    credentialsId?: string | string[],
    region?: string | string[],
    resourceType?: string | string[],
    pageSize: number | undefined = 200,
    nextToken?: string,
    includeDatabaseInstances?: boolean,
    allRecords?: boolean
): Promise<{ count: number; items: Array<ResourceDetails>; nextToken?: string }> {
    logger.info(' Get the Resources', {
        accountId,
        resourceId,
        credentialsId,
        region,
        resourceType,
        pageSize,
        nextToken
    });

    resourceType = resourceType || [RESOURCESTYPE.MSSQL, RESOURCESTYPE.PGSQL];

    if (allRecords) {
        pageSize = undefined;
    }

    try {
        const recordsPromise = listResources(
            accountId,
            resourceId,
            credentialsId,
            region,
            resourceType,
            undefined,
            undefined,
            pageSize,
            nextToken,
            includeDatabaseInstances
        );

        const countPromise = countResources(accountId);

        const {
            _count: { id: totalResourcesCount }
        } = await countPromise;

        const records = await recordsPromise;
        const items = trimAccountIdForDemo(records);

        return {
            count: items?.length,
            items,
            nextToken:
                totalResourcesCount > Number(pageSize) && records.length >= Number(pageSize)
                    ? items[items.length - 1].id
                    : undefined
        };
    } catch (error) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to list the resources');
    }
}

// To differentiate the users in the DEMO Mode, we are keeping accountId as accountId_UserId in the database
// So while saving & retrieving we have to maintain the same in demo mode
function trimAccountIdForDemo(records: any) {
    logger.debug('records', records);
    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        if (records && records.length) {
            const modifiedData = records.map((record: any) => {
                const { account_id: accountId, ...rest } = record;
                const [modifiedAccountId] = accountId.split('_');
                // For test cases there will not be bearer token so the user id will be undefined.. To handle that using accountId as it is
                return { account_id: modifiedAccountId || accountId, ...rest };
            });
            return modifiedData;
        }
    }
    return records;
}

async function getInstanceInfo(
    accountId: string,
    credentialsId: string,
    databaseHostId: string,
    databaseInstanceId: string,
    region?: string
) {
    const [instanceDetail] = await listDatabaseInstances(accountId, {
        credentialsId,
        resourceId: databaseHostId,
        sqlInstanceId: databaseInstanceId,
        region
    });

    if (isEmpty(instanceDetail)) {
        const errorMessage = `No database instance by id ${databaseInstanceId} in host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    return instanceDetail;
}

async function listAllManagedInstances(accountId?: string, record?: ListDatabaseInstancesRecord) {
    return listDatabaseInstances(accountId, record);
}

async function updateInstanceMetadata(accountId: string, instanceId: string, metaData: any) {
    logger.info('Update instance metadata', { accountId, instanceId });
    return updateDatabaseInstance({ accountId, instanceId, metaData });
}

async function updateDatabaseInstanceConfigurations(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    instanceId: string,
    updatedConfigs: any
) {
    logger.info('Update instance configurations', { accountId, instanceId });
    return updateDatabaseInstance({ accountId, credentialsId, region, databaseHostId, instanceId, updatedConfigs });
}

async function updateResourceMetaData(accountId: string, credentialsId: string, resourceId: string, metaData?: any) {
    logger.info('Update resource metadata', { accountId, resourceId });
    return updateResource({ accountId, credentialsId, resourceId, metaData });
}

async function updateDatabaseHostConfigurations(
    accountId: string,
    credentialsId: string,
    region: string,
    resourceId: string,
    updatedConfigs: any
) {
    logger.info('Update host configurations', { accountId, resourceId });
    return updateResource({ accountId, credentialsId, region, resourceId, updatedConfigs });
}

async function getPaginatedDatabaseInstances(
    accountId?: string,
    record?: ListDatabaseInstancesRecord,
    pageSize: number = 50,
    nextToken?: string
) {
    logger.info('Get paginated database instances', { accountId, record, pageSize, nextToken });
    return listDatabaseInstancesPaginated(accountId, record, pageSize, nextToken);
}

async function updateDatabaseHostAssessmentData(
    accountId: string,
    credentialsId: string,
    resourceId: string,
    updatedAssessmentData: any
) {
    logger.info('Update host configurations', { accountId, resourceId });
    return updateResource({ accountId, credentialsId, resourceId, updatedAssessmentData });
}

async function updateDatabaseHostAssessmentResults(
    accountId: string,
    credentialsId: string,
    region: string,
    resourceId: string,
    updatedAssessmentResults: any
) {
    logger.info('Update host configurations', { accountId, resourceId });
    return updateResource({ accountId, credentialsId, region, resourceId, updatedAssessmentResults });
}

async function updateDatabaseInstanceAssessmentResults(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    instanceId: string,
    assessmentResults: any
) {
    logger.info('Update instance configurations', { accountId, instanceId });
    return updateDatabaseInstance({ accountId, credentialsId, region, databaseHostId, instanceId, assessmentResults });
}
export {
    getSavedConfig,
    getAllSavedConfig,
    saveConfig,
    modifyConfig,
    deleteSavedConfig,
    getAllDeploymentStatus,
    getDeploymentStatusByName,
    getDeployments,
    getResources,
    trimAccountIdForDemo,
    getInstanceInfo,
    listAllManagedInstances,
    updateInstanceMetadata,
    updateDatabaseInstanceConfigurations,
    updateResourceMetaData,
    updateDatabaseHostConfigurations,
    getPaginatedDatabaseInstances,
    updateDatabaseHostAssessmentData,
    updateDatabaseHostAssessmentResults,
    updateDatabaseInstanceAssessmentResults
};
