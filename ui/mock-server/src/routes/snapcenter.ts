import { BASE_URL, generateResponse } from '../utils/appUtils';
import Connectors from '../data/listConnector.json';

const router = require('express').Router();

router.get(`/agents-mgmt/list-connectors/:accountID`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, Connectors);
    }, 2000);
});

export default router;
