import createError from 'http-errors';
import moment from 'moment';
import { DEPLOYMENT_STATUS } from '@prisma/client';
import {
    createConfig,
    updateConfig,
    deleteConfig,
    listConfig,
    listDeployments,
    listResources
} from '../../lib/database/db';
import {
    FormConfigCreateResponseType,
    FormConfigListResponseType,
    FormConfigObjectResponseType,
    FormConfigUpdateResponseType
} from '../../routes/types/form-config.types';
import { DeploymentStatusListResponseType, DeploymentStatusResponseType } from '../../routes/types/deployment.types';
import getLogger from '../../utils/logger';
import { CONFIG_NOT_FOUND, HttpErrorCodes, STACK_NOT_FOUND } from '../../utils/consts';
import { ResourceDetails, DeploymentDetails } from '../../utils/common-types';

const logger = getLogger();

async function getSavedConfig(accountId: string, id: string): Promise<FormConfigObjectResponseType> {
    logger.info('Load individual saved config ', accountId);
    try {
        const [{ user, creation_time: creationTime, data, name, modified_time: modifiedTime }] = await listConfig(
            accountId,
            id
        );
        return {
            accountId,
            id,
            user,
            creationTime: moment(creationTime).unix() * 1000,
            data,
            name,
            ...(modifiedTime && { modifiedTime: moment(modifiedTime).unix() * 1000 })
        };
    } catch (error) {
        logger.error(`Error occured while fetching saved config ${id}. Error: ${error}`);
        throw createError(HttpErrorCodes.NOT_FOUND, CONFIG_NOT_FOUND(id));
    }
}

async function deleteSavedConfig(accountId: string, id: string): Promise<void> {
    logger.info('Delete saved config ', accountId, id);

    try {
        await deleteConfig(accountId, id);
    } catch (error) {
        logger.error(`Error occured while deleting saved config ${id}. Error: ${error}`);
        throw createError(HttpErrorCodes.NOT_FOUND, CONFIG_NOT_FOUND(id));
    }
}

async function getAllSavedConfig(accountId: string): Promise<FormConfigListResponseType> {
    logger.info('Load saved config ', accountId);

    const data = await listConfig(accountId);
    return data.map(
        ({ id, user, creation_time: creationTime, data: configData, name, modified_time: modifiedTime }) => ({
            accountId,
            id,
            user,
            name,
            creationTime: moment(creationTime).unix() * 1000,
            data: configData as object,
            ...(modifiedTime && { modifiedTime: moment(modifiedTime).unix() * 1000 })
        })
    );
}

async function saveConfig(
    accountId: string,
    user: string,
    name: string,
    data: object
): Promise<FormConfigCreateResponseType> {
    logger.info('Save config ', accountId);
    logger.debug('Save config data', data);

    const { id, creation_time: configCreationTime } = await createConfig(accountId, {
        user,
        name,
        creationTime: Date.now(),
        data
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
        logger.error(`Error occured while updating saved config ${configId}. Error: ${error}`);
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
        ] = await listDeployments(accountId, undefined, name);
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
    accountId: string,
    resourceId?: string,
    resourceType?: string
): Promise<Array<ResourceDetails>> {
    logger.info(' Get the Resources', { accountId, resourceId, resourceType });

    try {
        const records = await listResources(accountId, resourceId, resourceType);
        return trimAccountIdForDemo(records);
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
    trimAccountIdForDemo
};
