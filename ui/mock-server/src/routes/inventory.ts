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

export default router;
