import { BASE_URL, generateResponse } from '../utils/appUtils';

import { CreateMssqlTemplateRes, DeployMssqlTemplate } from '../types/mssqlTypes';
const router = require('express').Router();

//Get Mssql post API mock response
router.post(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/cloudformation/url`, async (req: {}, res: CreateMssqlTemplateRes) => {
    const resData = {
        cloudFormationUrl: 'cloud_formation_url',
        warningMessage: 'warning_message'
    }
    generateResponse(res, 200, resData);
});

router.post(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/cloudformation/stack`, async (req: {}, res: DeployMssqlTemplate) => {
    const resData = {
        cloudFormationStackId: 'stack-123'
    }
    generateResponse(res, 200, resData);
});

export default router;
