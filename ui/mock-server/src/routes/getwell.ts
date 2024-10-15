import { BASE_URL, delay, generateResponse } from '../utils/appUtils';
import GetWellJson from '../data/getWell.json';

const router = require('express').Router();

router.get(`${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/drift-assessment`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, GetWellJson);
    }, 2000);
});

export default router;
