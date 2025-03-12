import { BASE_URL, delay, generateResponse } from '../utils/appUtils';
import DatabaseHostsV2 from '../data/databaseHostsV2.json';
import PgSqlDatabaseHosts from '../data/pgsqlDatabaseHosts.json';
import MssqlInstancesV2 from '../data/mssqlInstancesV2.json';

const router = require('express').Router();

router.get(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, DatabaseHostsV2);
        }, 2000);
    }
);

router.get(
    `${BASE_URL}/v1/pgsql/credentials/:credentialsId/regions/:region/database-hosts`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, PgSqlDatabaseHosts);
        }, 4000);
    }
);

router.get(`${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/instances`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, MssqlInstancesV2);

        // generateResponse(res, 400, {'error': 'error'});
    }, 15000);
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
    }, 3000);
});

router.post(`${BASE_URL}/v1/mssql/manage`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, {items: [
            {
                // error: 'error',
                resourceId: '123',
                "ec2InstanceId": "i-09adb571ab7dd6c17",
                "credentialsId": "3ad8702c-a2fd-48d2-be50-1ba6ce83acd5",
                "region": "eu-south-2",
                items: [
                    {
                        databaseInstanceName: 'SIGMA',
                        databaseInstanceGuid: '3',
                        status: 'success',
                        errorMessage: ''
                    }
                ]
            },
            {
                // error: 'error',
                resourceId: '2345',
                "ec2InstanceId": "i-0397e170050487f1c",
                "credentialsId": "3ad8702c-a2fd-48d2-be50-1ba6ce83acd5",
                "region": "eu-south-2",
                items: [
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
                items: [
                    {
                        databaseInstanceName: 'MSSQLSERVER',
                        databaseInstanceGuid: '3',
                        status: 'success',
                        errorMessage: ''
                    }
                ]
            }
        ]});
    }, 3000);
});

export default router;
