import { BASE_URL, delay, generateResponse } from '../utils/appUtils';
import GetWellJson from '../data/getWell.json';
import GetWellHostJson from '../data/getWellHost.json';
import SnapshotPolicies from '../data/snapshotPolicies.json';
import GetWellAccJson from '../data/getWellAcc.json';
import OracleAssessmentJson from '../data/oracleAssessment.json';
import OracleAssessmentAccJson from '../data/oracleAssessmentAcc.json';

const router = require('express').Router();

router.get(`${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/assessment`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, GetWellAccJson);
    }, 20);
});

router.get(`${BASE_URL}/v1/oracle/credentials/:credentialsId/regions/:region/assessment`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, OracleAssessmentAccJson);
    }, 20);
});

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/assessment`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, { jobId: '1234' });
            // generateResponse(res, 404, { message: 'No data found' });
        }, 20);
    }
);

router.get(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/assessment`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, GetWellHostJson);
        }, 20);
    }
);

router.get(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/snapshot-policies`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, SnapshotPolicies);
        }, 20);
    }
);

router.get(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/assessment`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, GetWellJson);
        }, 2000);
    }
    // For compute missing permissions case update compute object as below under getWell.json
    // "compute": {
    //     "errorMessage":"Error while calculating compute drift. Failed to get compute optimizer recommendation options for the selected database host during Continuous Assessment. User: arn:aws:sts::464262061435:assumed-role/preprod_automation_role/CredentialsAssumeRoleValidator is not authorized to perform: compute-optimizer:GetEnrollmentStatus on resource: * because no identity-based policy allows the compute-optimizer:GetEnrollmentStatus action",
    //     "error":{}
    // }
);

router.get(
    `${BASE_URL}/v1/oracle/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/assessment`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, OracleAssessmentJson);
        }, 2000);
    }
);

router.post(
    `${BASE_URL}/v1/oracle/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/assessment`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, { jobId: '1234' });
        }, 20);
    }
);

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/storage-configuration`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 202, { jobId: '1234' });
        }, 20);
    }
);

router.post(
    `${BASE_URL}/v1/oracle/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/storage-configuration`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 202, { jobId: '1234' });
        }, 20);
    }
);

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/storage-sizing`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 202, { jobId: '1234' });
        }, 20);
    }
);

router.post(`${BASE_URL}/v1/mssql/database-hosts/optimize/storage-sizing`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 202, { jobId: '1234' });
    }, 100);
});

router.post(`${BASE_URL}/v1/mssql/assessment/dismiss`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 202, {
            dismissedConfigurations: [
                {
                    configurationName: 'clone-management',
                    configState: 'active',
                    startTime: 1744588921000,
                    endTime: 1744588921000,
                    databaseHosts: [
                        {
                            id: 'resource-id-4',
                            sqlServerInstances: ['41', '42'],
                            credentialsId: '3ad8702c-a2fd-48d2-be50-1ba6ce83acd5',
                            region: 'us-east-1',
                            status: 'Success', // If only some instances are updated successfully, the status will be marked as 'partial', and the error message will indicate how many instances succeeded versus failed.
                            failedInstances: {}
                        }
                    ]
                }
            ]
        });
    }, 1000);
});

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/storage-operating-system`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 202, { jobId: '1234' });
        }, 20);
    }
);

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/compute`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 202, { jobId: '1234' });
        }, 20);
    }
);

router.post(`${BASE_URL}/v1/mssql/database-hosts/optimize/compute`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 202, { jobId: '1234' });
    }, 20);
});

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/storage-tier`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 202, { jobId: '1234' });
        }, 20);
    }
);

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/resiliency`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 202, { jobId: '1234' });
        }, 20);
    }
);

router.post(`${BASE_URL}/v1/mssql/database-hosts/optimize/storage-tier`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 202, { jobId: '1234' });
    }, 20);
});

router.post(`${BASE_URL}/v1/mssql/database-hosts/optimize/max-dop`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 202, { jobId: '1234' });
    }, 20);
});

router.post(`${BASE_URL}/v1/mssql/database-hosts/optimize/resiliency/aws-backup`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 202, { jobId: '1234' });
    }, 20);
});

router.post(`${BASE_URL}/v1/mssql/database-hosts/optimize/clone`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 202, { jobId: '1234' });
    }, 20);
});

router.post(`${BASE_URL}/v1/mssql/database-hosts/optimize/mtu-alignment`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 202, { jobId: '1234' });
    }, 20);
});

router.post(`${BASE_URL}/v1/mssql/database-hosts/optimize/:configurationName`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 202, { jobId: '1234' });
    }, 20);
});

export default router;
