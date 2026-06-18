import { BASE_URL, delay, generateResponse } from '../utils/appUtils';
import GetWellJson from '../data/getWell.json';
import GetWellFlatJson from '../data/getWellFlat.json';
import GetWellOracleFlatJson from '../data/getWellOracleFlat.json';
import GetWellOfflineJson from '../data/getWellOffline.json';
import GetWellOfflineFlatJson from '../data/getWellOfflineFlat.json';
import OracleAssessmentOfflineJson from '../data/offlineOracleAssessment.json';
import OracleAssessmentOfflineFlatJson from '../data/offlineOracleAssessmentFlat.json';
import GetWellHostJson from '../data/getWellHost.json';
import SnapshotPolicies from '../data/snapshotPolicies.json';
import GetWellAccJson from '../data/getWellAcc.json';
import GetWellAccOfflineJson from '../data/getWellAccOffline.json';
import GetWellAccOfflineOracleJson from '../data/offlineOracleAssessmentAcc.json';
import OracleAssessmentJson from '../data/oracleAssessment.json';
import OracleAssessmentAccJson from '../data/oracleAssessmentAcc.json';
import MissingPatchJson from '../data/missingPatch.json';

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

router.get(`${BASE_URL}/v1/mssql/offline-assessment`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, GetWellAccOfflineJson);
    }, 20);
});

router.get(`${BASE_URL}/v1/oracle/offline-assessment`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, GetWellAccOfflineOracleJson);
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
    `${BASE_URL}/v1/mssql/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/offline-assessment`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, GetWellOfflineJson);
        }, 20);
    }
);

router.get(
    `${BASE_URL}/v1/oracle/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/offline-assessment`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, OracleAssessmentOfflineJson);
        }, 20);
    }
);

router.get(
    `${BASE_URL}/v2/mssql/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/offline-assessment`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, GetWellOfflineFlatJson);
        }, 500);
    }
);

router.get(
    `${BASE_URL}/v2/oracle/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/offline-assessment`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, OracleAssessmentOfflineFlatJson);
        }, 500);
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
);

router.get(
    `${BASE_URL}/v2/mssql/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/assessment`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, GetWellFlatJson);
        }, 2000);
    }
);

router.get(
    `${BASE_URL}/v1/oracle/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/assessment`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, OracleAssessmentJson);
        }, 2000);
    }
);

router.get(
    `${BASE_URL}/v2/oracle/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/assessment`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, GetWellOracleFlatJson);
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

router.get(
    `${BASE_URL}/v1/:dbType(mssql|oracle)/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/assessment/patch-scan`,
    async (req: any, res: any) => {
        setTimeout(() => {
            const { field } = req.query;
            if (field === 'mssql-patch') {
                generateResponse(res, 200, {
                    status: 'not-optimized',
                    ec2InstancesToPatch: MissingPatchJson.ec2InstancesToPatch
                });
            } else if (field === 'oracle-security-patch') {
                generateResponse(res, 200, {
                    status: 'not-optimized',
                    ec2InstancesToPatch: (MissingPatchJson.ec2InstancesToPatch ?? []).map((inst: any) => ({
                        ec2InstanceId: inst.ec2InstanceId,
                        database: 'oracle-dev',
                        missingPatchDetails: (inst.missingPatchDetails ?? []).map((p: any) => ({
                            cveId: p.cveIds,
                            component: 'Oracle Database',
                            description: p.title,
                            releaseDate: '2025-10-15',
                            releaseName: 'October 2025'
                        }))
                    }))
                });
            } else {
                generateResponse(res, 200, MissingPatchJson);
            }
        }, 3000);
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
    `${BASE_URL}/v1/oracle/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/storage-layout`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 202, { jobId: '1234' });
        }, 20);
    }
);

router.post(`${BASE_URL}/v1/oracle/database-hosts/optimize`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 202, { jobId: '1234' });
    }, 20);
});

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

router.post(`${BASE_URL}/v1/mssql/assessment/dismiss`, async (req: any, res: any) => {
    setTimeout(() => {
        // Extract configurations from request body
        const { configurationsToDismiss } = req.body;

        if (!configurationsToDismiss || !Array.isArray(configurationsToDismiss)) {
            generateResponse(res, 400, { error: 'Invalid request: configurationsToDismiss is required' });
            return;
        }

        // Build dynamic response based on request
        const dismissedConfigurations = configurationsToDismiss.map((config: any) => {
            const currentTime = Date.now();
            const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

            return {
                configurationId: config.configurationId || config.configurationName,
                configurationName: config.configurationName,
                configState: config.configState || 'DISMISSED',
                startTime: currentTime,
                // Add endTime only for POSTPONED state (30 days from now)
                ...(config.configState === 'POSTPONED' && { endTime: currentTime + thirtyDaysInMs }),
                databaseHosts: (config.databaseHosts || []).map((host: any) => ({
                    id: host.id,
                    sqlServerInstances: host.sqlServerInstances || [],
                    credentialsId: host.credentialsId,
                    region: host.region,
                    status: 'Success',
                    failedInstances: {}
                }))
            };
        });

        generateResponse(res, 202, { dismissedConfigurations });
    }, 1000);
});

router.post(`${BASE_URL}/v1/oracle/assessment/dismiss`, async (req: any, res: any) => {
    setTimeout(() => {
        // Extract configurations from request body
        const { configurationsToDismiss } = req.body;

        if (!configurationsToDismiss || !Array.isArray(configurationsToDismiss)) {
            generateResponse(res, 400, { error: 'Invalid request: configurationsToDismiss is required' });
            return;
        }

        // Build dynamic response based on request
        const dismissedConfigurations = configurationsToDismiss.map((config: any) => {
            const currentTime = Date.now();
            const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

            return {
                configurationId: config.configurationId || config.configurationName,
                configurationName: config.configurationName,
                configState: config.configState || 'DISMISSED',
                startTime: currentTime,
                // Add endTime only for POSTPONED state (30 days from now)
                ...(config.configState === 'POSTPONED' && { endTime: currentTime + thirtyDaysInMs }),
                databaseHosts: (config.databaseHosts || []).map((host: any) => ({
                    id: host.id,
                    oracleInstances: host.oracleInstances || [],
                    credentialsId: host.credentialsId,
                    region: host.region,
                    status: 'Success',
                    failedInstances: {}
                }))
            };
        });

        generateResponse(res, 202, { dismissedConfigurations });
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
