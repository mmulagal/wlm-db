import { BASE_URL, generateResponse } from '../utils/appUtils';

import DatabaseHosts from '../data/databaseHosts.json';
import DatabaseJobs from '../data/databaseJobs.json';
import JobsSummary from '../data/jobsSummary.json';

const router = require('express').Router();

router.get(`${BASE_URL}/v1/database-hosts`, async (req: {}, res: any) => {
    generateResponse(res, 200, DatabaseHosts);
});

router.get(`${BASE_URL}/v1/jobs`, async (req: {}, res: any) => {
    generateResponse(res, 200, DatabaseJobs);
});

router.get(`${BASE_URL}/v1/jobs/summary`, async (req: {}, res: any) => {
    generateResponse(res, 200, JobsSummary);
});

export default router;
