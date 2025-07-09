
import express from 'express';
import { BASE_URL, generateResponse } from '../utils/appUtils';
import ErrorInvestigationData from '../data/errorInvestigationGet.json';

const router = express.Router();

router.get(`${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/logs-analysis`, async (req: express.Request, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, ErrorInvestigationData);
    }, 100);
});

export default router;
