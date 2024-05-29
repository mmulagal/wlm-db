import { BASE_URL, delay, generateResponse } from '../utils/appUtils';
import DatabaseHostsV2 from '../data/databaseHostsV2.json';

const router = require('express').Router();

router.get(`${BASE_URL}/v2/credentials/:credentialsId/regions/:region/database-hosts`, async (req: {}, res: any) => {
    generateResponse(res, 200, DatabaseHostsV2);
});

export default router;
