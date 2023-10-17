import createError from 'http-errors';
import moment from 'moment';
import { createConfig, deleteConfig, listConfig, listDeployments } from '../../lib/database/db';
import {
    FormConfigCreateResponseType,
    FormConfigListResponseType,
    FormConfigObjectResponseType
} from '../../routes/types/form-config.types';
import { DeploymentStatusListResponseType, DeploymentStatusResponseType } from '../../routes/types/deployment.types';
import getLogger from '../../utils/logger';
import { HttpErrorCodes, STACK_NOT_FOUND } from '../../utils/consts';

const logger = getLogger();

async function getSavedConfig(accountId: string, id: string): Promise<FormConfigObjectResponseType> {
    logger.info('Load individual saved config ', accountId);

    const [{ user, creation_time: creationTime, data, name }] = await listConfig(accountId, id);
    return {
        accountId,
        id,
        user,
        creationTime: moment(creationTime).unix() * 1000,
        data,
        name
    };
}

async function deleteSavedConfig(accountId: string, id: string): Promise<void> {
    logger.info('Delete saved config ', accountId, id);

    await deleteConfig(accountId, id);
}

async function getAllSavedConfig(accountId: string): Promise<FormConfigListResponseType> {
    logger.info('Load saved config ', accountId);

    const data = await listConfig(accountId);
    return data.map(({ id, user, creation_time: creationTime, data: configData, name }) => ({
        accountId,
        id,
        user,
        name,
        creationTime: moment(creationTime).unix() * 1000,
        data: configData as object
    }));
}

async function saveConfig(
    accountId: string,
    user: string,
    name: string,
    data: object
): Promise<FormConfigCreateResponseType> {
    logger.info('Save config ', accountId);
    logger.debug('Save config data', data);

    const {
        id,
        account_id: configAccountId,
        creation_time: configCreationTime
    } = await createConfig(accountId, {
        user,
        name,
        creationTime: Date.now(),
        data
    });
    return { id, accountId: configAccountId, creationTime: moment(configCreationTime).unix() * 1000, user, data, name };
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

export {
    getSavedConfig,
    getAllSavedConfig,
    saveConfig,
    deleteSavedConfig,
    getAllDeploymentStatus,
    getDeploymentStatusByName
};
