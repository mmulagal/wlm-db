
import express from 'express';
import { BASE_URL, generateResponse } from '../utils/appUtils';
import ErrorInvestigationData from '../data/errorInvestigationGet.json';

const router = express.Router();

router.get(`${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/logs-analysis`, async (req: express.Request, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, ErrorInvestigationData);
        // generateResponse(res, 200, {remediationRecommendation: []});
        // generateResponse(res, 500, {message: "Server Error: Unable to fetch logs analysis data."});
    }, 7000);
});

router.get(`${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/investigation-dates`, async (req: express.Request, res: any) => {
    setTimeout(() => {
        // generateResponse(res, 500, {message: "Server Error: Unable to fetch logs analysis data."});
        generateResponse(res, 200, [
            {
                 id: "1",
                 reportCreationTime: "1752121886000"
            },
            {
                 id: "2",
                 reportCreationTime: "1752035486000"
            },
            {
                 id: "3",
                 reportCreationTime: "1751949086000"
            },
            {
                 id: "4",
                 reportCreationTime: "1751862686000"
            }
        ]);
    }, 7000);
});

export default router;
