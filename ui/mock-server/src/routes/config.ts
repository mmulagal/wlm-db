import { BASE_URL, generateResponse } from '../utils/appUtils';
import loadconfig from '../data/loadconfig.json';

const router = require('express').Router();

//Get all saved credentials mock response
router.get(`${BASE_URL}/v1/configs`, async (req: {}, res: any) => {
    const retData = [
        {
            id: 'id1',
            name: 'config1',
            user: 'TestUser',
            creationTime: 1694169731000
        },
        {
            id: 'id2',
            name: 'config2',
            user: 'TestUser',
            creationTime: 1694169730000
        },
    ];
    setTimeout(() => {
        generateResponse(res, 200, { items: retData });
    }, 30);
});

router.get(`${BASE_URL}/v1/configs/:configid`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, loadconfig);
    }, 30);
});

router.post(`${BASE_URL}/v1/configs`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, {'success': 'ok'});
    }, 30);
});

router.delete(`${BASE_URL}/v1/configs/:configid`, async (req: {}, res: any) => {
    generateResponse(res, 200, {'success': 'ok'});
});

router.patch(`${BASE_URL}/v1/configs/:configid`, async (req: {}, res: any) => {
    generateResponse(res, 200, {'id': 'id1'});
});

export default router;
