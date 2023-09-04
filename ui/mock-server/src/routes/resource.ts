import { delay, BASE_URL, generateResponse } from '../utils/appUtils';

import {
    SummaryRes,
    CpuUtilisation,
    DiskUtilisation,
    MemoryUtilisation,
    Databases,
    Tables
} from '../types/resourceTypes';
const router = require('express').Router();

router.delete(`${BASE_URL}/v1/:databaseType/resources/:resourceId`, async (req: {}, res: SummaryRes) => {
    const retData = {};
    generateResponse(res, 204, retData);
});

router.get(`${BASE_URL}/v1/:databaseType/resources/:resourceId/summary`, async (req: {}, res: SummaryRes) => {
    const retData = {
        serverId: '1234567',
        serverVersion: 'SQL2022',
        serverStatus: 'Healthy',
        serverEdition: 'Standard',
        serverEngine: 'SQL Server express edition',
        activeConnections: 2,
        deploymentModel: 'Always On (FCI)',
        primaryNode: 'abcd',
        standbyNode: 'xyz',
        activeNode: 'abcd'
    };
    generateResponse(res, 200, retData);
});

router.get(
    `${BASE_URL}/v1/:databaseType/resources/:resourceId/utilization/cpu`,
    async (req: {}, res: CpuUtilisation) => {
        const retData = {
            percentUsed: '3',
            used: '3',
            total: '100',
            remaining: '97'
        };
        generateResponse(res, 200, retData);
    }
);

router.get(
    `${BASE_URL}/v1/:databaseType/resources/:resourceId/utilization/disk`,
    async (req: {}, res: DiskUtilisation) => {
        const retData = {
            percentUsed: '30',
            used: '300000',
            total: '1000000',
            remaining: '700000'
        };
        generateResponse(res, 200, retData);
    }
);

router.get(
    `${BASE_URL}/v1/:databaseType/resources/:resourceId/utilization/memory`,
    async (req: {}, res: MemoryUtilisation) => {
        const retData = {
            percentUsed: '40',
            used: '400000',
            total: '1000000',
            remaining: '600000'
        };
        generateResponse(res, 200, retData);
    }
);

router.get(`${BASE_URL}/v1/:databaseType/resources/:resourceId/databases`, async (req: {}, res: Databases) => {
    const retData = {
        databases: [
            {
                databaseId: '1',
                databaseName: 'master',
                creationDate: 1693284194,
                databaseStatus: 'ONLINE',
                databaseSize: 4653056
            },
            {
                databaseId: '2',
                databaseName: 'tempdb',
                creationDate: 1693284194,
                databaseStatus: 'ONLINE',
                databaseSize: 8388608
            }
        ]
    };
    generateResponse(res, 200, retData);
});

router.get(
    `${BASE_URL}/v1/:databaseType/resources/:resourceId/databases/:databaseName/tables`,
    async (req: {}, res: Tables) => {
        const retData = {
            tables: [
                {
                    tableName: 'table-1',
                    databaseName: 'db-1',
                    tableType: 'USER_TABLE',
                    tableSchema: 'dbo',
                    tableSize: '0'
                },
                {
                    tableName: 'table-2',
                    databaseName: 'db-2',
                    tableType: 'USER_TABLE',
                    tableSchema: 'dbo',
                    tableSize: '0'
                }
            ]
        };
        generateResponse(res, 200, retData);
    }
);

router.post(`${BASE_URL}/v1/batch`, async (req: {}, res: Tables) => {
    const retData = [
        {
            data: {
                tables: [
                    {
                        tableName: 'table-1',
                        databaseName: 'db-1',
                        tableType: 'USER_TABLE',
                        tableSchema: 'dbo',
                        tableSize: '0'
                    },
                    {
                        tableName: 'table-2',
                        databaseName: 'db-2',
                        tableType: 'USER_TABLE',
                        tableSchema: 'dbo',
                        tableSize: '0'
                    }
                ]
            }
        }
    ];
    generateResponse(res, 200, retData);
});

export default router;
