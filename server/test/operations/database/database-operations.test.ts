import { createDeployment, deleteConfig, deleteDeployment } from '../../../src/lib/database/db';
import {
    getSavedConfig,
    getAllSavedConfig,
    saveConfig,
    deleteSavedConfig,
    getAllDeploymentStatus,
    getDeploymentStatusByName,
    modifyConfig
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

    it('Update saved config', async () => {
        const { id } = await saveConfig(ACCOUNT_ID, 'testuser', 'testname', {
            subnetId: 'test-subnet',
            vpcId: 'test-vpc'
        });
        const { id: modifiedId } = await modifyConfig(ACCOUNT_ID, id, 'updated name');
        const resp = await getSavedConfig(ACCOUNT_ID, modifiedId);
        expect(resp.name).toEqual('updated name');
        // expect(resp.modifiedTime).toBeDefined();
        /*
            This check is commented because prismock doesnot support @updatedAT attribute https://github.com/morintd/prismock#:~:text=%E2%9B%94-,%40updatedAt,-%E2%9B%94
            Once the attribute is enabled we can run this assertion.
        */
        const response = await deleteSavedConfig(ACCOUNT_ID, id);
        expect(response).toBeUndefined();
    });

    it('Get all deployment status', async () => {
        const response = await createDeployment(ACCOUNT_ID, {
            deploymentId: 'wlmdb-12345',
            deploymentName: 'wlmdb-12345',
            deploymentStatus: 'CREATE_COMPLETE',
            deploymentModel: 'FCI',
            credentialsId: '',
            startTime: 0,
            region: '',
            data: {
                resourceName: 'dummy-resourec-name',
                databaseType: 'Microsoft SQL server',
                fileSystemType: 'FSx for ONTAP'
            }
        });
        await createDeployment(ACCOUNT_ID, {
            deploymentId: 'wlmdb-12345-sql',
            deploymentName: 'wlmdb-12345-sql',
            parentDeploymentId: 'wlmdb-12345',
            deploymentModel: 'FCI',
            deploymentStatus: 'CREATE_COMPLETE',
            credentialsId: '',
            startTime: 0,
            region: '',
            data: {
                resourceName: 'dummy-resourec-name',
                databaseType: 'Microsoft SQL server',
                fileSystemType: 'FSx for ONTAP'
            }
        });
        const resp = await getAllDeploymentStatus(ACCOUNT_ID);
        expect(response.deployment_id).toEqual(resp[0].deploymentId);

        await deleteDeployment(ACCOUNT_ID, 'wlmdb-12345');
        await deleteDeployment(ACCOUNT_ID, 'wlmdb-12345-sql');
    });
    it('Get deployment status by id', async () => {
        const response = await createDeployment(ACCOUNT_ID, {
            deploymentId: 'wlmdb-2345',
            deploymentName: 'wlmdb-2345',
            deploymentStatus: 'CREATE_COMPLETE',
            deploymentModel: 'FCI',
            credentialsId: '',
            startTime: 0,
            region: '',
            data: {
                resourceName: 'dummy-resourec-name',
                databaseType: 'Microsoft SQL server',
                fileSystemType: 'FSx for ONTAP'
            }
        });
        const response1 = await createDeployment(ACCOUNT_ID, {
            deploymentId: 'wlmdb-45678',
            deploymentName: 'wlmdb-45678',
            deploymentStatus: 'CREATE_FAILED',
            deploymentModel: 'FCI',
            credentialsId: '',
            startTime: 0,
            region: '',
            data: {
                resourceName: 'dummy-resourec-name',
                databaseType: 'Microsoft SQL server',
                fileSystemType: 'FSx for ONTAP'
            }
        });
        let resp = await getDeploymentStatusByName(ACCOUNT_ID, 'wlmdb-2345');
        expect(response.deployment_name).toEqual(resp.deploymentName);
        expect(response.deployment_status).toEqual(resp.deploymentStatus);

        resp = await getDeploymentStatusByName(ACCOUNT_ID, 'wlmdb-45678');
        expect(resp);
        expect(response1.deployment_name).toEqual(resp.deploymentName);
        expect(response1.deployment_status).toEqual(resp.deploymentStatus);

        await deleteDeployment(ACCOUNT_ID, 'wlmdb-2345');
        await deleteDeployment(ACCOUNT_ID, 'wlmdb-45678');
    });
});
