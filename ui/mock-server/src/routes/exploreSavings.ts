import { BASE_URL, generateResponse } from '../utils/appUtils';
import StorageSavings from '../data/storageSavings.json';
import StorageSavingsFsxw from '../data/storageSavingsFsxw.json';
import ViewCalculations from '../data/viewCalculations.json';
import ViewCalculationsFsxw from '../data/viewCalculationsFsxw.json';
import UploadScript from '../data/uploadScript.json';

const router = require('express').Router();

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/instances/:instanceId/storage-savings/ebs`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, StorageSavings);
        }, 5000);
    }
);

router.post(`${BASE_URL}/v1/mssql/regions/:region/manual-storage-savings/ebs`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, StorageSavings);
    }, 5000);
});

router.post(`${BASE_URL}/v1/mssql/onprem/upload`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, UploadScript);
    }, 5000);
});

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/instances/:instanceId/storage-savings/ebs/calculations`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, ViewCalculations);
        }, 5000);
    }
);

router.post(
    `${BASE_URL}/v1/mssql/regions/:region/manual-storage-savings/ebs/calculations`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            // generateResponse(res, 200, ViewCalculations);
            generateResponse(res, 200, ViewCalculations);
        }, 5000);
    }
);

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/instances/:instanceId/storage-savings/fsxw`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, StorageSavingsFsxw);
        }, 5000);
    }
);

router.post(`${BASE_URL}/v1/mssql/regions/:region/manual-storage-savings/fsxw`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, StorageSavingsFsxw);
    }, 5000);
});

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/instances/:instanceId/storage-savings/fsxw/calculations`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, ViewCalculationsFsxw);
        }, 5000);
    }
);

router.post(
    `${BASE_URL}/v1/mssql/regions/:region/manual-storage-savings/fsxw/calculations`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            // generateResponse(res, 200, ViewCalculations);
            generateResponse(res, 200, ViewCalculationsFsxw);
        }, 5000);
    }
);

export default router;
