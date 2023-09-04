import { deleteConfig } from '../../../src/lib/database/db';
import { getAllSavedConfig, saveConfig } from '../../../src/operations/database/database-operations';
import { ACCOUNT_ID } from '../../utils/consts';

describe('Database operations', () => {
    it('Save config', async () => {
        await saveConfig(ACCOUNT_ID, 'testuser', 'testname', {
            subnetId: 'test-subnet',
            vpcId: 'test-vpc'
        });
        const resp = await getAllSavedConfig(ACCOUNT_ID);
        expect(resp[0].accountId).toEqual(ACCOUNT_ID);
        expect(resp[0].data.subnetId).toEqual('test-subnet');

        await deleteConfig(ACCOUNT_ID, resp[0].id);
    });
    it('Return all saved config', async () => {
        await saveConfig(ACCOUNT_ID, 'testuser', 'testname', {
            subnetId: 'test-subnet',
            vpcId: 'test-vpc'
        });
        const resp = await getAllSavedConfig(ACCOUNT_ID);
        expect(resp[0].accountId).toEqual(ACCOUNT_ID);
        expect(resp[0].data.subnetId).toEqual('test-subnet');

        await deleteConfig(ACCOUNT_ID, resp[0].id);
    });
});
