import { BASE_URL, generateResponse } from '../utils/appUtils';
import Connectors from '../data/listConnector.json';
import listHosts from '../data/listExistingHosts.json';
import RBACList from '../data/rbacList.json';
import WorkSpaceID from '../data/workSpaceID.json';

const router = require('express').Router();

router.get(`/agents-mgmt/list-connectors/:accountID`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, Connectors);
    }, 2000);
});

router.get(`/backup-recovery/organizations/:accountID/v1/workloads/sql/hosts`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, listHosts);
    }, 2000);
});

router.get(`/fsx-ontap/working-environments/:accountID`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, [
            {
                id: 'fs-0d5efc3057c4f12cb',
                name: 'wlmdb-fsx-1',
                deploymentType: 'MULTI_AZ_1',
                region: 'ap-southeast-1',
                autoScale: false
            }
        ]);
    }, 2000);
});

router.get(`/v1/management/organizations/:accountID/users`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, RBACList);
    }, 2000);
});

router.get(`/v1/management/organizations/:accountID/resources`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, WorkSpaceID);
    }, 2000);
});

router.post(
    `/accounts/:accountID/fsx/v2/credentials/:credentialID/regions/:regionID/bluexp/register-file-systems`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, [
                {
                    id: 'fs-0d5efc3057c4f12cb',
                    credentialsId: '523b6e25-e01c-4397-9adb-c9a4b8f987d6',
                    region: 'ap-southeast-1',
                    name: 'wlmdb-fsx-1',
                    deploymentType: 'MULTI_AZ'
                }
            ]);
        }, 2000);
    }
);

router.post(
    `/v1/management/organizations/:accountID/roles/381a2b6e-693b-4829-95a5-fbd753db30c7/users`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, '');
        }, 2000);
    }
);

export default router;
