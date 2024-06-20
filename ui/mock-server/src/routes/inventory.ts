import { BASE_URL, delay, generateResponse } from '../utils/appUtils';
import DatabaseHostsV2 from '../data/databaseHostsV2.json';
import MssqlInstancesV2 from '../data/mssqlInstancesV2.json';

const router = require('express').Router();

router.get(`${BASE_URL}/v2/credentials/:credentialsId/regions/:region/database-hosts`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, DatabaseHostsV2);
    }, 4000);
});

router.get(`${BASE_URL}/v2/credentials/:credentialsId/regions/:region/mssql/instances`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, MssqlInstancesV2);
    }, 7000);
});

router.post(`${BASE_URL}/v2/credentials/:credentialsId/regions/:region/mssql`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, {
            resourceId: 'resource-id-2',
            items: [
              {
                databaseInstanceName: 'MSSQLSERVER3',
                databaseInstanceGuid: '3',
                status: 'success',
                errorMessage: ''
              }
            ]
          })
    }, 3000);
});

export default router;
