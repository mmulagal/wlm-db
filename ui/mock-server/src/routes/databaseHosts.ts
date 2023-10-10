import { BASE_URL, generateResponse } from '../utils/appUtils';

import DatabaseHosts from '../data/databaseHosts.json';

const router = require('express').Router();

router.get(`${BASE_URL}/v1/database-hosts`, async (req: {}, res: any) => {
    generateResponse(res, 200, DatabaseHosts);
});

export default router;
