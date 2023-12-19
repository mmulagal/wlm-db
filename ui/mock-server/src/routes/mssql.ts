import { BASE_URL, generateResponse } from '../utils/appUtils';

import { CreateMssqlTemplateRes, DeployMssqlTemplate } from '../types/mssqlTypes';
const router = require('express').Router();

//Get Mssql post API mock response
router.post(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/cloudformation/url`, async (req: {}, res: CreateMssqlTemplateRes) => {
    const resData = {
        cloudFormationUrl: 'cloud_formation_url',
        warningMessage: 'Required IAM permissions are not available to deploy the cloud formation template'
    }
    generateResponse(res, 200, resData);
});

// To check dialog flow on click of create, uncomment cloudFormationUrl and comment cloudFormationStackId
router.post(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/cloudformation/deploy`, async (req: {}, res: DeployMssqlTemplate) => {
    const resData = {
        cloudFormationStackId: 'arn:aws:cloudformation:ap-southeast-1:464262061435:stack/WLMDB-SQLFCIStack-1694406372501/5bd05510-505b-11ee-82a3-02e1070421d0',
        cloudFormationUrl: 'cloud_formation_url',
        // warningMessage: 'Required IAM permissions are not available to deploy the cloud formation template'
    }
    generateResponse(res, 200, resData);
});

export default router;
