import { BASE_URL, delay, generateResponse } from '../utils/appUtils';
import DatabaseHostsV2 from '../data/databaseHostsV2.json';
import PgSqlDatabaseHosts from '../data/pgsqlDatabaseHosts.json';
import MssqlInstancesV2 from '../data/mssqlInstancesV2.json';
import PgsqlInstancesV2 from '../data/pgsqlInstances.json';
import OracleInstancesV2 from '../data/oracleInstances.json';

const router = require('express').Router();

router.get(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, DatabaseHostsV2);
        }, 100);
    }
);

router.get(
    `${BASE_URL}/v1/pgsql/credentials/:credentialsId/regions/:region/database-hosts`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, PgSqlDatabaseHosts);
        }, 100);
    }
);

router.get(`${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/instances`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, MssqlInstancesV2);

        // generateResponse(res, 400, {'error': 'error'});
    }, 100);
});

router.get(`${BASE_URL}/v1/pgsql/credentials/:credentialsId/regions/:region/resource-details`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, PgsqlInstancesV2);

        // generateResponse(res, 400, {'error': 'error'});
    }, 100);
});

router.get(`${BASE_URL}/v1/oracle/credentials/:credentialsId/regions/:region/resource-details`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, OracleInstancesV2);

        // generateResponse(res, 400, {'error': 'error'});
    }, 100);
});

router.post(`${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/manage`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, {
            // error: 'error',
            resourceId: 'resource-id-2',
            items: [
                {
                    databaseInstanceName: 'MSSQLSERVER',
                    databaseInstanceGuid: '3',
                    status: 'success',
                    errorMessage: ''
                }
            ]
        });
    }, 100);
});

router.post(`${BASE_URL}/v1/mssql/manage`, async (req: {}, res: any) => {

    setTimeout(() => {
        generateResponse(res, 200, {
            "hosts": [
                {
                    // error: 'error',
                    resourceId: '123',
                    "ec2InstanceId": "i-09adb571ab7dd6c17",
                    "credentialsId": "3ad8702c-a2fd-48d2-be50-1ba6ce83acd5",
                    "region": "eu-south-2",
                    "instances": [
                        {
                            databaseInstanceName: 'SIGMA',
                            databaseInstanceGuid: '3',
                            // status: 'failed',
                            // errorMessage: 'some err'
                        }
                    ],
                    "hostErrorMessage": "Unable to manage instance 'i-05978dd409ce8e0e6'. Reason: PowerShell modules AWS.Tools.EC2,AWS.Tools.FSx,AWS.Tools.SimpleSystemsManagement,NetApp.ONTAP are required for managing the resource. Install them manually by referring to https://learn.microsoft.com/en-us/powershell/scripting/developer/module/installing-a-powershell-module?view=powershell-7.4) or using the API \"/accounts/{accountId}/wlmdb/v1/mssql/credentials/{credentialsId}/regions/{region}/instances/{instanceId}/prepare\".\nFiles required for database operations are not available. Install them using the API \"/accounts/{accountId}/wlmdb/v1/mssql/credentials/{credentialsId}/regions/{region}/instances/{instanceId}/prepare\"."
                },
                {
                    // error: 'error',
                    resourceId: '2345',
                    "ec2InstanceId": "i-0397e170050487f1c",
                    "credentialsId": "3ad8702c-a2fd-48d2-be50-1ba6ce83acd5",
                    "region": "eu-south-2",
                    "instances": [
                        {
                            databaseInstanceName: 'MSSQLSERVER',
                            databaseInstanceGuid: '3',
                            status: 'success',
                            errorMessage: ''
                        }
                    ]
                },
                {
                    // error: 'error',
                    resourceId: '234w25',
                    "ec2InstanceId": "i-065dddc35ba1046ac",
                    "credentialsId": "3ad8702c-a2fd-48d2-be50-1ba6ce83acd5",
                    "region": "eu-south-2",
                    "instances": [
                        {
                            databaseInstanceName: 'MSSQLSERVER',
                            databaseInstanceGuid: '3',
                            status: 'failed',
                            errorMessage: 'some API'
                        }
                    ]
                }
            ]
        });
    }, 100);
});

router.post(
    `${BASE_URL}/v1/mssql/register`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, { jobId: '1234' });
            // generateResponse(res, 404, { message: 'No data found' });
        }, 20);
    }
);

export default router;
