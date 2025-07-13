
import express from 'express';
import { BASE_URL, generateResponse } from '../utils/appUtils';
import ErrorInvestigationData from '../data/errorInvestigationGet.json';

const router = express.Router();

router.post(`${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/logs-analysis`, async (req: express.Request, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, {jobId: '1234'});
    }, 7000);
});

router.get(`${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/logs-analysis`, async (req: express.Request, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, ErrorInvestigationData);
        // generateResponse(res, 200, {remediationRecommendation: []});
        // generateResponse(res, 500, {message: 'Server Error: Unable to fetch logs analysis data.'});
    }, 7000);
});

router.get(`${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/logs-analysis/reports`, async (req: express.Request, res: any) => {
    setTimeout(() => {
        // generateResponse(res, 500, {message: "Server Error: Unable to fetch logs analysis data."});
        generateResponse(res, 200, {
            'reports': [
                {
                    'id': 'b76a4d14-0590-44e8-b382-bae338973dce',
                    'creationTime': 1752171100298
                },
                {
                    'id': '576b358c-a3c8-422e-957a-1c799415db0b',
                    'creationTime': 1752171034699
                },
                {
                    'id': '20d558fa-7763-4b90-a3d5-16db809c083e',
                    'creationTime': 1752098061709
                },
                {
                    'id': '4bf2615c-d4c0-4d28-b363-5adcb61b9d25',
                    'creationTime': 1752097038503
                },
                {
                    'id': 'b77f22a5-de20-4cbc-a73e-266e933d7d4f',
                    'creationTime': 1752096380778
                },
                {
                    'id': 'b6d8b44a-19b2-4e91-abf3-ce36ada5249b',
                    'creationTime': 1752095693167
                },
                {
                    'id': '99dc70b4-4e6a-4d7e-9b16-4d0ccd6251ef',
                    'creationTime': 1752094381194
                },
                {
                    'id': 'e6f9d66c-9a3b-4990-87d8-0dc076c3519d',
                    'creationTime': 1752094151235
                },
                {
                    'id': '54b8dd8b-b26c-4e29-948c-d6164206e608',
                    'creationTime': 1752092457495
                },
                {
                    'id': '44af2b29-1f69-4822-914b-4755908936c0',
                    'creationTime': 1752087232637
                },
                {
                    'id': 'f8285584-fe75-494e-af66-74a40994569b',
                    'creationTime': 1752084086001
                },
                {
                    'id': '85ca45b9-2c7a-4030-a69a-aa07e080295c',
                    'creationTime': 1751933807443
                }
            ]
        });
    }, 7000);
});

export default router;
