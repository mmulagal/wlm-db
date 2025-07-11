import { delay, BASE_URL, generateResponse } from '../utils/appUtils';

import { CredentialsRes } from '../types/credentialsTypes';
const router = require('express').Router();

//Get credentials mock response
router.get(`${BASE_URL}/v1/credentials/:credentialsType`, async (req: {}, res: CredentialsRes) => {
    const retData: any = [];
    generateResponse(res, 200, retData);
});

export default router;
