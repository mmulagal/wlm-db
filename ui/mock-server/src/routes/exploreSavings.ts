import { BASE_URL, generateResponse } from '../utils/appUtils';
import StorageSavings from '../data/storageSavings.json';

const router = require('express').Router();

router.post(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/instances/:instanceId/storage-savings`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, StorageSavings);
    }, 3000);
});

export default router;
