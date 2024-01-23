import { BASE_URL, delay, generateResponse } from '../utils/appUtils';

import ResourceDetails from '../data/resourceDetails.json';
import DatabaseList from '../data/databaseList.json';
import DatabaseHosts from '../data/databaseHosts.json';
import DatabaseJobs from '../data/databaseJobs.json';
import JobsSummary from '../data/jobsSummary.json';
import JobsSummaryTimeline from '../data/jobsSummaryTimeline.json';
import Templates from '../data/template.json';
import JobMonitoringJobs from '../data/jobMonitoringJobs.json';
import JobMonitoringDownloads from '../data/jobMonitoringDownload.json';
import JobMonitoringSubTask from '../data/JobMonitoringSubTask.json';

const router = require('express').Router();

router.get(`${BASE_URL}/v1/database-hosts`, async (req: {}, res: any) => {
    generateResponse(res, 200, DatabaseHosts);
});

router.get(`${BASE_URL}/v1/database-hosts/:id`, async (req: {}, res: any) => {
    await delay(3000);
    generateResponse(res, 200, ResourceDetails);
});

router.get(`${BASE_URL}/v1/database-hosts/:id/databases`, async (req: {}, res: any) => {
    await delay(3000);
    generateResponse(res, 200, DatabaseList);
});

router.get(`${BASE_URL}/v1/deployments`, async (req: {}, res: any) => {
    generateResponse(res, 200, DatabaseJobs);
});

router.get(`${BASE_URL}/v1/jobs/summary`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, JobsSummary);
    }, 3000);
});

router.get(`${BASE_URL}/v1/jobs/summary/timeline`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, JobsSummaryTimeline['30']);
    }, 3000);
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

router.get(`${BASE_URL}/v1/jobs`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, JobMonitoringDownloads);
    }, 2000);
});

router.get(`${BASE_URL}/v1/jobs/:jobId`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, JobMonitoringSubTask);
    }, 3000);
});

export default router;
