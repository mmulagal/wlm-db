import { BASE_URL, generateResponse } from '../utils/appUtils';
import Connectors from '../data/listConnector.json';
import listHosts from '../data/listExistingHosts.json';
import RBACList from '../data/rbacList.json';
import WorkSpaceID from '../data/workSpaceID.json';

const router = require('express').Router();

router.get(`/agents-mgmt/list-connectors/:accountID`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, Connectors);
    }, 100);
});

router.get(`/backup-recovery/organizations/:accountID/v1/workloads/sql/hosts`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, listHosts);
    }, 500);
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
    }, 500);
});

router.get(`/v1/management/organizations/:accountID/users`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, RBACList);
    }, 500);
});

router.get(`/v1/management/organizations/:accountID/resources`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, WorkSpaceID);
    }, 10);
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
        }, 10);
    }
);

router.post(
    `/v1/management/organizations/:accountID/roles/381a2b6e-693b-4829-95a5-fbd753db30c7/users`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, '');
        }, 100);
    }
);

router.post(
    `${BASE_URL}/v1/ubr-protection/credentials/:credentialsID/regions/:regionID/ubr-credentials`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, {
                credentialsId: '523b6e25-e01c-4397-9adb-c9a4b8f987d6'
            });
        }, 10);
    }
);

//Job api call - add host
router.post(`backup-recovery/organizations/:accountID/v1/workloads/sql/hosts`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, {
            jobId: 'f662093f-9f26-4b88-ba12-4c57e656922f',
            jobUrl: 'https://staging.api.bluexp.netapp.com/cbs-backend/api/account/8b037670-92c8-480a-9ddd-d0bbfd1b18cb/v1/jobs/f662093f-9f26-4b88-ba12-4c57e656922f',
            errorMessage: ''
        });
    }, 100);
});

export default router;
