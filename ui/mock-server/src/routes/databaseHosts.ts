import { BASE_URL, delay, generateResponse } from '../utils/appUtils';

import ResourceDetails from '../data/resourceDetails.json';
import DatabaseHosts from '../data/databaseHosts.json';
import DatabaseJobs from '../data/databaseJobs.json';
import JobsSummary from '../data/jobsSummary.json';
import Templates from '../data/template.json';

const router = require('express').Router();

router.get(`${BASE_URL}/v1/database-hosts`, async (req: {}, res: any) => {
    generateResponse(res, 200, DatabaseHosts);
});

router.get(`${BASE_URL}/v1/database-hosts/:id`, async (req: {}, res: any) => {
    await delay(3000);
    generateResponse(res, 200, ResourceDetails);
});

router.get(`${BASE_URL}/v1/jobs`, async (req: {}, res: any) => {
    generateResponse(res, 200, DatabaseJobs);
});

router.get(`${BASE_URL}/v1/jobs/summary`, async (req: {}, res: any) => {
    generateResponse(res, 200, JobsSummary);
});

router.post(`${BASE_URL}/v1/cloudformation/template`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, Templates);
    }, 3000);
});

router.get(`${BASE_URL}/v1/status`, async (req: {}, res: any) => {
    generateResponse(res, 200, { isActive: true });
});

router.delete(`${BASE_URL}/v1/jobs/jobId/:id`, async (req: {}, res: any) => {
    generateResponse(res, 200, { success: 'ok' });
});

export default router;
