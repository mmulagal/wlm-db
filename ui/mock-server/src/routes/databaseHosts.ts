import { BASE_URL, delay, generateResponse } from '../utils/appUtils';

import ResourceDetails from '../data/resourceDetails.json';
import DatabaseList from '../data/databaseList.json';
import DatabaseListAoag from '../data/databaseListAoag.json';
import DatabaseListAoagSecondary from '../data/databaseListAoagSecondary.json';
import DatabaseHosts from '../data/databaseHosts.json';
import MssqlInstanceAoagData from '../data/mssqlInstanceAoag.json';
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
    async (req: any, res: any) => {
        const hostId = req.params.id;
        let data;
        if (hostId === 'resource-id-aoag1') {
            data = DatabaseListAoag;
        } else if (hostId === 'resource-id-aoag2') {
            data = DatabaseListAoagSecondary;
        } else {
            data = DatabaseList;
        }
        await delay(3000);
        generateResponse(res, 200, data);
    }
);

router.get(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:id/database-instances/:instanceId`,
    async (req: any, res: any) => {
        const hostId = req.params.id;
        const data =
            hostId === 'resource-id-aoag1' || hostId === 'resource-id-aoag2'
                ? MssqlInstanceAoagData
                : MssqlInstanceData;
        await delay(3000);
        generateResponse(res, 200, data);
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

// Toggle isGovAccount to true to test GovCloud SSM ARN flows
// Toggle aiAnalysisEnabled to false to test the error-analysis-disabled-by-administrator flows
router.get(`${BASE_URL}/v1/account-info`, async (req: {}, res: any) => {
    generateResponse(res, 200, { isGovAccount: false, aiAnalysisEnabled: true });
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

/**
 * Dynamic mock for register-credentials API
 * - Parses request body to determine what resources are being registered
 * - Returns appropriate response for MSSQL, ORACLE, or FSX resources
 * - Adds replicaInfo for AOAG (Always On Availability Group) cases when isReplicaInfoRequired is true
 * - Returns manageReadiness structure with all required capabilities
 */
router.post(`${BASE_URL}/v1/register-credentials`, async (req: any, res: any) => {
    setTimeout(() => {
        const requestBody = req.body || {};
        const requestItems = requestBody.items || [];

        // Build response items dynamically based on request
        const responseItems = requestItems.map((item: any) => {
            const credentials = item.credentials || [];
            const isReplicaInfoRequired = item.isReplicaInfoRequired || false;

            // Build registerDetails for each credential
            const registerDetails = credentials.map((cred: any) => {
                // Use resourceType and resourceId from request if provided, otherwise derive them
                const resourceType =
                    cred.resourceType ||
                    (cred.databaseInstanceName?.includes('ORACLE') || cred.databaseName
                        ? 'ORACLE'
                        : cred.fsxId
                        ? 'FSX'
                        : 'MSSQL');

                const resourceId =
                    cred.resourceId ||
                    cred.fsxId ||
                    cred.databaseInstanceName ||
                    cred.databaseName ||
                    'MSSQLSERVER';

                // Base manageReadiness structure (full permissions by default)
                const manageReadiness: any = {
                    remediation: {
                        missingSqlPermissions: [],
                        missingModules: []
                    },
                    dbcreation: {
                        missingSqlPermissions: [],
                        missingModules: []
                    },
                    sandbox: {
                        missingSqlPermissions: [],
                        missingModules: []
                    },
                    errorInvestigation: {
                        missingSqlPermissions: [],
                        missingModules: []
                    }
                };

                // Build register detail object
                const registerDetail: any = {
                    resourceId,
                    resourceType,
                    manageReadiness
                };

                // Add database-specific fields
                if (resourceType === 'MSSQL') {
                    registerDetail.databaseCount = 10;
                    registerDetail.databaseServerEdition = 'Standard';
                    registerDetail.databaseServerError = '';
                }

                if (resourceType === 'ORACLE') {
                    registerDetail.databaseCount = 5;
                    registerDetail.databaseServerError = '';
                    registerDetail.oracleAsmError = '';
                }

                if (resourceType === 'FSX') {
                    registerDetail.fsxnError = '';
                }

                return registerDetail;
            });

            // Build replicaInfo array if AOAG is required
            const replicaInfo =
                isReplicaInfoRequired && credentials.some((c: any) => c.databaseInstanceName)
                    ? [
                          {
                              ec2InstanceId: 'i-' + Math.random().toString(36).substring(2, 15),
                              ec2HostName: 'REPLICA-HOST',
                              sqlServerName: credentials[0]?.databaseInstanceName || 'MSSQLSERVER',
                              role: 'SECONDARY',
                              availabilityGroupNames: ['AG1', 'AG2']
                          }
                      ]
                    : [];

            return {
                ec2InstanceId: item.ec2InstanceId,
                credentialsId: item.credentialsId,
                region: item.region,
                errorMessage: '',
                registerDetails,
                ...(replicaInfo.length > 0 && { replicaInfo })
            };
        });

        generateResponse(res, 200, {
            items: responseItems
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
