import { createConfig, listConfig } from '../../lib/database/db';
import { FormConfigCreateResponseType, FormConfigListResponseType } from '../../routes/types/form-config.types';
import getLogger from '../../utils/logger';

const logger = getLogger();
async function getSavedConfig(accountId: string): Promise<FormConfigListResponseType> {
    logger.info('Load saved config ', accountId);

    const data = await listConfig(accountId);
    return data.map(({ account_id: accountId, id, user, creation_time: creationTime, data }) => ({
        accountId,
        id,
        user,
        creationTime,
        data: data as object
    }));
}

async function saveConfig(accountId: string, user: string, data: object): Promise<FormConfigCreateResponseType> {
    logger.info('Save config ', accountId);
    logger.debug('Save config data', data);

    return createConfig(accountId, {
        user,
        creationTime: Date.now(),
        data
    });
}
export { getSavedConfig, saveConfig };
