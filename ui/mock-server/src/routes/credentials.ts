import { delay, BASE_URL, generateResponse } from '../utils/appUtils';

import { CredentialsRes } from '../types/credentialsTypes';
const router = require('express').Router();

//Get credentials mock response
router.get(`${BASE_URL}/v1/credentials/:credentialsType`, async (req: {}, res: CredentialsRes) => {
    const retData = [
        {
            credentialsId: '3ad8702c-a2fd-48d2-be50-1ba6ce83acd5',
            name: 'mock-ui-creds-1',
            arn: 'arn:aws:iam::464262061435:role/Fsx-role',
            providerAccountId: '464262061435'
        },
        {
            credentialsId: '3ad8702c-a2fd-48d2-be50-1ba6ce83acd6',
            name: 'mock-ui-creds-2',
            arn: 'arn:aws:iam::464262061436:role/Fsx-role',
            providerAccountId: '464262061436'
        }
    ];
    generateResponse(res, 200, retData);
});

export default router;
