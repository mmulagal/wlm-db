import { generateResponse } from '../utils/appUtils';
import fsxDetailsForLink from '../data/fsxDetailsForLink.json';
import getExistingLinks from '../data/getExistingLinks.json';
import getAssociatedLinks from '../data/getAssociatedLinks.json';
import checkExistingLink from '../data/checkExistingLink.json';

const router = require('express').Router();

// getAssociatedLinks — filter + include=associatedTargets + onlyConnectedStatus=true
router.get('/accounts/:accountId/links/v1/links', async (req: any, res: any, next: any) => {
    if (req.query.filter && req.query.include?.includes('associatedTargets') && req.query.onlyConnectedStatus) {
        return setTimeout(() => generateResponse(res, 200, getAssociatedLinks), 2000);
    }
    next();
});

// checkExistingLink — filter + include=associatedTargets, no onlyConnectedStatus
router.get('/accounts/:accountId/links/v1/links', async (req: any, res: any, next: any) => {
    if (req.query.filter && req.query.include?.includes('associatedTargets') && !req.query.onlyConnectedStatus) {
        return setTimeout(() => generateResponse(res, 200, checkExistingLink), 2000);
    }
    next();
});

// getExistingLinks — include only, no filter
router.get('/accounts/:accountId/links/v1/links', async (req: any, res: any) => {
    if (req.query.include) {
        return setTimeout(() => generateResponse(res, 200, getExistingLinks), 2000);
    }

    setTimeout(() => {
        generateResponse(res, 200, {
            count: 0,
            items: [],
            nextToken: null
        });
    }, 2000);
});

router.get('/accounts/:accountId/fsx/v2/credentials/:credentialId/regions/:region/file-systems/:fileSystemId', async (req: any, res: any) => {
    setTimeout(() => generateResponse(res, 200, fsxDetailsForLink), 2000);
});

// deleteExistingLink — DELETE fsx/v2/credentials/:credentialId/regions/:region/file-systems/:fsxId/links/:linkId
router.delete('/accounts/:accountId/fsx/v2/credentials/:credentialId/regions/:region/file-systems/:fsxId/links/:linkId', async (req: any, res: any) => {
    setTimeout(() => generateResponse(res, 200, null), 2000);
});

// associateSelectedLink — POST fsx/v2/credentials/:credentialId/regions/:region/file-systems/:fsxId/links
router.post('/accounts/:accountId/fsx/v2/credentials/:credentialId/regions/:region/file-systems/:fsxId/links', async (req: any, res: any) => {
    setTimeout(() => generateResponse(res, 200, null), 2000);
});

export default router;
