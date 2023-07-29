import { BASE_URL, generateResponse } from '../utils/appUtils';

import { AdsRes, AmisRes, RegionRes, SnsTopicsRes, VpcRes } from '../types/awsTypes';

import vpcsData from '../data/vpcs.json';
import regionsData from '../data/regions.json';
import adsData from '../data/ads.json';
import amisData from '../data/amis.json';
import snsTopicsData from '../data/sns-topics.json';

const router = require('express').Router();

//Get regions mock response
router.get(`${BASE_URL}/v1/credentials/:credentialsId/aws/fsx/regions`, async (req: {}, res: RegionRes) => {
    const retData = regionsData;
    generateResponse(res, 200, retData);
});

// Get VPC mock response
router.get(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/vpcs`, async (req: {}, res: VpcRes) => {
    const retData = vpcsData;
    generateResponse(res, 200, retData);
});

// Get ADs mock response
router.get(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/ads`, async (req: {}, res: AdsRes) => {
    const retData = adsData;
    generateResponse(res, 200, retData);
});

// Get AMI mock response
router.get(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/amis`, async (req: {}, res: AmisRes) => {
    const retData = amisData;
    generateResponse(res, 200, retData);
});

// Get SNS mock response
router.get(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/snsTopics`, async (req: {}, res: SnsTopicsRes) => {
    const retData = snsTopicsData;
    generateResponse(res, 200, retData);
});

export default router;
