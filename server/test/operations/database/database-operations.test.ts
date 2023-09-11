import { deleteConfig } from '../../../src/lib/database/db';
import {
    getSavedConfig,
    getAllSavedConfig,
    saveConfig,
    deleteSavedConfig
} from '../../../src/operations/database/database-operations';
import { ACCOUNT_ID } from '../../utils/consts';

describe('Database operations', () => {
    it('Get saved config', async () => {
        const response = await saveConfig(ACCOUNT_ID, 'testuser', 'testname', {
            subnetId: 'test-subnet',
            vpcId: 'test-vpc'
        });
        const resp = await getSavedConfig(ACCOUNT_ID, response.id);
        expect(resp.accountId).toEqual(ACCOUNT_ID);
        expect(resp.data.subnetId).toEqual('test-subnet');

        await deleteConfig(ACCOUNT_ID, response.id);
    });

    it('Get all saved config', async () => {
        await saveConfig(ACCOUNT_ID, 'testuser', 'testname', {
            subnetId: 'test-subnet',
            vpcId: 'test-vpc'
        });
        const resp = await getAllSavedConfig(ACCOUNT_ID);
        expect(resp[0].accountId).toEqual(ACCOUNT_ID);
        expect(resp[0].name).toEqual('testname');

        await deleteConfig(ACCOUNT_ID, resp[0].id);
    });
    it('Delete saved config', async () => {
        const { id } = await saveConfig(ACCOUNT_ID, 'testuser', 'testname', {
            subnetId: 'test-subnet',
            vpcId: 'test-vpc'
        });
        const response = await deleteSavedConfig(ACCOUNT_ID, id);
        expect(response).toBeUndefined();
    });
});
