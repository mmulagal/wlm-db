import { BASE_URL, delay, generateResponse } from '../utils/appUtils';
import GetWellJson from '../data/getWell.json';
import GetWellHostJson from '../data/getWellHost.json';
import GetWellAccJson from '../data/getWellAcc.json';

const router = require('express').Router();

router.get(`${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/assessment`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, GetWellAccJson);
    }, 20);
});

router.get(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/assessment`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, GetWellHostJson);
        }, 20);
    }
);

router.get(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/assessment`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, GetWellJson);
        }, 20);
    }
    // For compute missing permissions case update compute object as below under getWell.json
    // "compute": {
    //     "errorMessage":"Error while calculating compute drift. Failed to get compute optimizer recommendation options for the selected database host during Continuous Assessment. User: arn:aws:sts::464262061435:assumed-role/preprod_automation_role/CredentialsAssumeRoleValidator is not authorized to perform: compute-optimizer:GetEnrollmentStatus on resource: * because no identity-based policy allows the compute-optimizer:GetEnrollmentStatus action",
    //     "error":{}
    // }
);

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/storage-configuration`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 202, { jobId: '1234' });
        }, 2000);
    }
);

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/storage-sizing`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 202, { jobId: '1234' });
        }, 2000);
    }
);

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/optimize/storage-sizing`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 202, { jobId: '1234' });
        }, 2000);
    }
);

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/storage-operating-system`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 202, { jobId: '1234' });
        }, 2000);
    }
);

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/compute`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 202, { jobId: '1234' });
        }, 2000);
    }
);

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/optimize/compute`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 202, { jobId: '1234' });
        }, 2000);
    }
);

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/storage-tier`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 202, { jobId: '1234' });
        }, 2000);
    }
);

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/optimize/storage-tier`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 202, { jobId: '1234' });
        }, 2000);
    }
);

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/optimize/max-dop`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 202, { jobId: '1234' });
        }, 2000);
    }
);

export default router;
