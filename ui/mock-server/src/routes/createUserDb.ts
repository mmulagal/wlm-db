import { BASE_URL, generateResponse } from '../utils/appUtils';
import driveInfo from '../data/driveInfo.json';
import collationList from '../data/collation.json';

const router = require('express').Router();

router.get(`${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:id/database-instances/:instanceId/drive-information`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, driveInfo);
    }, 20);  
});

router.get(`${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:id/database-instances/:instanceId/collation`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, collationList);
    }, 20);  
});

router.post(`${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:id/database`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, { jobId: 'jobId' });
    }, 20);
});

export default router;
