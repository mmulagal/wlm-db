import { BASE_URL, delay, generateResponse } from '../utils/appUtils';

import ResourceDetails from '../data/resourceDetails.json';
import DatabaseList from '../data/databaseList.json';
import DatabaseHosts from '../data/databaseHosts.json';
import JobsSummary from '../data/jobsSummary.json';
import JobsSummaryTimeline from '../data/jobsSummaryTimeline.json';
import Templates from '../data/template.json';
import JobMonitoringDownloads from '../data/jobMonitoringDownload.json';
import JobMonitoringSubTask from '../data/JobMonitoringSubTask.json';
import DiscoverEC2 from '../data/discoverEc2V2.json';
import DiscoverOracle from '../data/discoverOracle.json';
import DiscoverPgsql from '../data/discoverPgsql.json';
import CredentialsStatus from '../data/credentialsStatus.json';
import ManagedInstanceList from '../data/managedInstanceList.json';
import MssqlInstanceData from '../data/mssqlInstance.json';
import OracleOverviewData from '../data/oracleOverview.json';

const router = require('express').Router();

router.get(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/database-hosts`, async (req: {}, res: any) => {
    generateResponse(res, 200, DatabaseHosts);
});

router.get(
    `${BASE_URL}/v1/credentials/:credentialsId/regions/:region/database-hosts/:id`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, ResourceDetails);
        }, 50);
    }
);

router.get(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:id/database-instances/:instanceId/databases`,
    async (req: {}, res: any) => {
        await delay(3000);
        generateResponse(res, 200, DatabaseList);
    }
);

router.get(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:id/database-instances/:instanceId`,
    async (req: {}, res: any) => {
        await delay(3000);
        generateResponse(res, 200, MssqlInstanceData);
    }
);

router.get(
    `${BASE_URL}/v1/oracle/credentials/:credentialsId/regions/:region/database-hosts/:id/database-instances/:instanceId`,
    async (req: {}, res: any) => {
        await delay(3000);
        generateResponse(res, 200, OracleOverviewData);
    }
);

router.get(`${BASE_URL}/v1/jobs/summary`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, JobsSummary);
    }, 30);
});

router.get(`${BASE_URL}/v1/jobs/summary/timeline`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, JobsSummaryTimeline['30']);
    }, 30);
});

router.post(`${BASE_URL}/v1/mssql/cloudformation/template`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, Templates);
    }, 30);
});

router.post(`${BASE_URL}/v1/mssql/terraform/setup`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, Templates);
    }, 30);
});

router.post(`${BASE_URL}/v1/pgsql/terraform/setup`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, Templates);
    }, 30);
});

router.get(`${BASE_URL}/v1/status`, async (req: {}, res: any) => {
    generateResponse(res, 200, { isActive: true });
});

router.get(`${BASE_URL}/v1/jobs`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, JobMonitoringDownloads);
    }, 20);
});

router.get(`${BASE_URL}/v1/jobs/:jobId`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, JobMonitoringSubTask);
        // generateResponse(res, 200, optimizeBulkJobs);
        // generateResponse(res, 200, registerBulkJobs);
    }, 7000);
});

router.get(`${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/discover`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, DiscoverEC2);
    }, 30);
});

router.get(`${BASE_URL}/v1/oracle/credentials/:credentialsId/regions/:region/discover`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, DiscoverOracle);
    }, 30);
});

router.get(`${BASE_URL}/v1/pgsql/credentials/:credentialsId/regions/:region/discover`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, DiscoverPgsql);
    }, 30);
});

router.get(
    `${BASE_URL}/v1/credentials/:credentialsId/regions/:region/resources/file-systems/credentials-status`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, CredentialsStatus);
        }, 30);
    }
);

router.post(`${BASE_URL}/v1/register-credentials`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, {
            items: [
                {
                    ec2InstanceId: 'i-008b54cdabafdbc58',
                    credentialsId: '3ad8702c-a2fd-48d2-be50-1ba6ce83acd5',
                    region: 'ap-southeast-1',
                    errorMessage: '',
                    registerDetails: [
                        {
                            resourceId: "MSSQLSERVER",
                            resourceType: "MSSQL",
                            manageReadiness: []
                        },
                        {
                            resourceId: "MSSQLSERVER2",
                            resourceType: "MSSQL",
                            manageReadiness: []
                        }
                    ],
                    replicaInfo: [
                        {
                            ec2InstanceId: 'i-008b54cdabafdbc582',
                            ec2HostName: 'WEBER2',
                            databaseName: 'MSSQLSERVER2',
                            role: 'SECONDARY'
                        }
                    ]
                }
            ]
        });
    }, 5000);
});

router.post(
    `${BASE_URL}/v1/credentials/:credentialsId/regions/:region/instances/:instanceId/mssql/manage`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, { resource: '1234' });
            // generateResponse(res, 424, {message: 'PowerShell 7 is required for managing the resource. Install it manually by referring to https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-windows?view=powershell-7.4 and retry the operation.'})
            // generateResponse(res, 424, {message: 'Files required for database operations are not available. Install them using the API "/accounts/{accountId}/wlmdb/v1/mssql/credentials/{credentialsId}/regions/{region}/instances/{instanceId}/prepare", and retry the operation.'});
        }, 30);
    }
);

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/instances/:instanceId/prepare`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 202, { message: '1234' });
            // generateResponse(res, 500, {message: 'Already running job'});
        }, 30);
    }
);

router.get(`${BASE_URL}/v1/managed-hosts`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, ManagedInstanceList);
    }, 10);
});

export default router;
