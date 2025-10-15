import { Sandboxes } from '../types/sandBoxTypes';
import { BASE_URL, generateResponse } from '../utils/appUtils';

const router = require('express').Router();

router.get(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/sandboxes`,
    async (req: {}, res: Sandboxes) => {
        const retData = {
            count: 4,
            items: [
                {
                    databaseHostName: 'Database hostname 1',
                    databaseHostId: 'resource-id-1',
                    databaseInstanceName: 'MSSQLSERVER',
                    databaseInstanceId: '11',
                    sandboxName: 'sandboxtest1',
                    sourceDatabaseName: 'dbname1',
                    sourceDatabaseHostName: 'dbhost',
                    sourceDatabaseInstanceName: 'dbinstance',
                    createdAt: '1733821459096',
                    tag: 'dev'
                },
                {
                    databaseHostName: 'Database hostname 1',
                    databaseHostId: 'resource-id-1',
                    databaseInstanceName: 'MSSQLSERVER',
                    databaseInstanceId: '11',
                    sandboxName: 'sandboxtest2',
                    sourceDatabaseName: 'dbname2',
                    sourceDatabaseHostName: 'dbhost',
                    sourceDatabaseInstanceName: 'dbinstance',
                    createdAt: '1649875812345',
                    tag: 'qa'
                },
                {
                    databaseHostName: 'Database hostname 1',
                    databaseHostId: 'resource-id-1',
                    databaseInstanceName: 'MSSQLSERVER2',
                    databaseInstanceId: '12',
                    sandboxName: 'sandboxtest1',
                    sourceDatabaseName: 'dbname1',
                    sourceDatabaseHostName: 'dbhost',
                    sourceDatabaseInstanceName: 'dbinstance',
                    createdAt: '1649875812345',
                    tag: 'dev'
                },
                {
                    databaseHostName: 'Database hostname 2',
                    databaseHostId: 'resource-id-2',
                    databaseInstanceName: 'MSSQLSERVER',
                    databaseInstanceId: '21',
                    sandboxName: 'sandboxtest2',
                    sourceDatabaseName: 'dbname2',
                    sourceDatabaseHostName: 'dbhost',
                    sourceDatabaseInstanceName: 'dbinstance',
                    createdAt: '1649875812345',
                    tag: 'qa'
                }
            ]
        };
        generateResponse(res, 200, retData);
    }
);

router.get(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/:hostId/database-instances/:instanceId/sandboxes`,
    async (req: {}, res: Sandboxes) => {
        const retData = {
            count: 4,
            items: [
                {
                    databaseHostName: 'SQLServer-Prod-01',
                    databaseHostId: '64de4daa-3405-47c6-8689-58f4987b6ad8',
                    databaseInstanceName: 'Default Instance',
                    databaseInstanceId: 'inst1',
                    sandboxName: 'sandboxtest1',
                    sourceDatabaseName: 'dbname1',
                    sourceDatabaseHostName: 'dbhost',
                    sourceDatabaseInstanceName: 'dbinstance',
                    createdAt: '1733821459096',
                    tag: 'dev'
                },
                {
                    databaseHostName: 'SQLServer-Prod-01',
                    databaseHostId: '64de4daa-3405-47c6-8689-58f4987b6ad82',
                    databaseInstanceName: 'Default Instance',
                    databaseInstanceId: 'inst1',
                    sandboxName: 'sandboxtest2',
                    sourceDatabaseName: 'dbname2',
                    sourceDatabaseHostName: 'dbhost',
                    sourceDatabaseInstanceName: 'dbinstance',
                    createdAt: '1649875812345',
                    tag: 'qa'
                },
                {
                    databaseHostName: 'SQLServer-Dev-01',
                    databaseHostId: 'fc0be6a3-f710-47db-b5b4-4ee709250777',
                    databaseInstanceName: 'Default Instance',
                    databaseInstanceId: 'inst2',
                    sandboxName: 'sandboxtest1',
                    sourceDatabaseName: 'dbname1',
                    sourceDatabaseHostName: 'dbhost',
                    sourceDatabaseInstanceName: 'dbinstance',
                    createdAt: '1649875812345',
                    tag: 'dev'
                },
                {
                    databaseHostName: 'SQLServer-Dev-01',
                    databaseHostId: 'fc0be6a3-f710-47db-b5b4-4ee7092507774',
                    databaseInstanceName: 'Default Instance',
                    databaseInstanceId: 'inst2',
                    sandboxName: 'sandboxtest2',
                    sourceDatabaseName: 'dbname2',
                    sourceDatabaseHostName: 'dbhost',
                    sourceDatabaseInstanceName: 'dbinstance',
                    createdAt: '1649875812345',
                    tag: 'qa'
                }
            ]
        };
        generateResponse(res, 200, retData);
    }
);

router.get(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/database-hosts/sandboxes/savings`,
    async (req: {}, res: Sandboxes) => {
        const retData = {
            consumedStorage: 10000,
            savedStorage: 90000,
            sandboxSavingsPercentage: 90
        };
        generateResponse(res, 200, retData);
    }
);

export default router;
