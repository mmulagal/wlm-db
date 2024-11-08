import { BASE_URL, delay, generateResponse } from '../utils/appUtils';
import GetWellJson from '../data/getWell.json';

const router = require('express').Router();

router.get(`${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/assessment`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, GetWellJson);
    }, 20);
});

router.post(`${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/storage-configuration`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 202, { jobId: '1234' });
    }, 2000);
});

export default router;
