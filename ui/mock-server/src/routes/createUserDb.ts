import { BASE_URL, generateResponse } from '../utils/appUtils';
import driveInfo from '../data/driveInfo.json';

const router = require('express').Router();

router.get(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/database-hosts/:id/drive-information`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, driveInfo);
    }, 2000);  
});

router.post(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/database-hosts/:id/database`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, { jobId: 'jobId' });
    }, 2000);
});

export default router;
