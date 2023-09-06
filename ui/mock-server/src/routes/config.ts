import { BASE_URL, generateResponse } from '../utils/appUtils';
import loadconfig from '../data/loadconfig.json';

const router = require('express').Router();

//Get all saved credentials mock response
router.get(`${BASE_URL}/v1/config`, async (req: {}, res: any) => {
    const retData = [
        {
            id: 'id1',
            name: 'config1',
        },
        {
            id: 'id2',
            name: 'config2',
        },
    ];
    setTimeout(() => {
        generateResponse(res, 200, retData);
    }, 3000);
});

router.get(`${BASE_URL}/v1/config/:configid`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, loadconfig);
    }, 3000);
});

router.post(`${BASE_URL}/v1/config`, async (req: {}, res: any) => {
    generateResponse(res, 200, {'success': 'ok'});
});

router.delete(`${BASE_URL}/v1/config/:configid`, async (req: {}, res: any) => {
    generateResponse(res, 200, {'success': 'ok'});
});

export default router;
