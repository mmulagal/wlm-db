import moment from 'moment';
import { createConfig, listConfig } from '../../lib/database/db';
import {
    FormConfigCreateResponseType,
    FormConfigListResponseType,
    FormConfigObjectResponseType
} from '../../routes/types/form-config.types';
import getLogger from '../../utils/logger';

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

async function getAllSavedConfig(accountId: string): Promise<FormConfigListResponseType> {
    logger.info('Load saved config ', accountId);

    const data = await listConfig(accountId);
    return data.map(({ account_id: accId, id, user, creation_time: creationTime, data: d, name }) => ({
        accountId: accId,
        id,
        user,
        name,
        creationTime: moment(creationTime).unix() * 1000,
        data: d as object
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
export { getSavedConfig, getAllSavedConfig, saveConfig };
