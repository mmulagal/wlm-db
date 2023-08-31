import { BASE_URL, generateResponse } from '../utils/appUtils';
import loadconfig from '../data/loadconfig.json';

const router = require('express').Router();

//Get all saved credentials mock response
router.get(`${BASE_URL}/v1/loadconfig`, async (req: {}, res: any) => {
    const retData = [
        {
            id: 'config1',
            name: 'config1',
        },
        {
            id: 'config2',
            name: 'config2',
        },
    ];
    generateResponse(res, 200, retData);
});

router.get(`${BASE_URL}/v1/loadconfig/:configid`, async (req: {}, res: any) => {
    generateResponse(res, 200, loadconfig);
});

router.post(`${BASE_URL}/v1/saveconfig/:configId`, async (req: {}, res: any) => {
    generateResponse(res, 200, {'success': 'ok'});
});

export default router;
