import { BASE_URL, delay, generateResponse } from '../utils/appUtils';

import ResourceDetails from '../data/resourceDetails.json';
import DatabaseList from '../data/databaseList.json';
import DatabaseHosts from '../data/databaseHosts.json';
import JobsSummary from '../data/jobsSummary.json';
import JobsSummaryTimeline from '../data/jobsSummaryTimeline.json';
import Templates from '../data/template.json';
import JobMonitoringDownloads from '../data/jobMonitoringDownload.json';
import JobMonitoringSubTask from '../data/JobMonitoringSubTask.json';
import DiscoverEC2 from '../data/discoverEc2.json';
import CredentialsStatus from '../data/credentialsStatus.json';
import MssqlInstances from '../data/mssqlInstances.json';
import ManagedInstanceList from '../data/managedInstanceList.json';

const router = require('express').Router();

router.get(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/database-hosts`, async (req: {}, res: any) => {
    generateResponse(res, 200, DatabaseHosts);
});

router.get(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/database-hosts/:id`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, ResourceDetails);
    }, 5000);
});

router.get(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/database-hosts/:id/databases`, async (req: {}, res: any) => {
    await delay(3000);
    generateResponse(res, 200, DatabaseList);
});

router.get(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/jobs/summary`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, JobsSummary);
    }, 3000);
});

router.get(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/jobs/summary/timeline`, async (req: {}, res: any) => {
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

router.get(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/jobs`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, JobMonitoringDownloads);
    }, 2000);
});

router.get(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/jobs/:jobId`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, JobMonitoringSubTask);
    }, 3000);
});

router.get(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/mssql/discover`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, DiscoverEC2);
    }, 3000);
});

router.get(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/resources/file-systems/credentials-status`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, CredentialsStatus);
    }, 3000);
});

router.post(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/instances/:instanceId/mssql/discover/resource-credentials`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, {databaseCount: 10, sqlServerEdition: 'Standard', sqlServerError: '', fsxnError: ''});
    }, 3000);
});

router.post(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/instances/:instanceId/mssql/manage`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, {resource: '1234'})
        // generateResponse(res, 424, {message: 'PowerShell 7 is required for managing the resource. Install it manually by referring to https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-windows?view=powershell-7.4 and retry the operation.'})
        // generateResponse(res, 424, {message: 'Files required for database operations are not available. Install them using the API "/accounts/{accountId}/wlmdb/v1/credentials/{credentialsId}/regions/{region}/instances/{instanceId}/mssql/prepare", and retry the operation.'});
    }, 3000);
});

router.post(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/instances/:instanceId/mssql/prepare`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 202, {message: '1234'});
        // generateResponse(res, 500, {message: 'Already running job'});
    }, 3000);
});

router.get(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/mssql/instances`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, MssqlInstances);
    }, 7000);
});

router.get(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/resources/managed-hosts`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, ManagedInstanceList);
    }, 1000);
});

export default router;
