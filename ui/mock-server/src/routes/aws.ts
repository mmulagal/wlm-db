import { BASE_URL, generateResponse } from '../utils/appUtils';

import {
    AdsRes,
    AmisRes,
    FsxnRes,
    InstanceTypeRes,
    KeyPairRes,
    KmsKeysRes,
    RegionRes,
    SnsTopicsRes,
    VpcRes
} from '../types/awsTypes';

import vpcsData from '../data/vpcs.json';
import sgData from '../data/securityGroups.json';
import regionsData from '../data/regions.json';
import adsData from '../data/ads.json';
import amisData from '../data/amis.json';
import snsTopicsData from '../data/sns-topics.json';
import kmsKeysData from '../data/kms-keys.json';
import keyPairData from '../data/key-pairs.json';
import instanceTypeData from '../data/instance-types.json';
import fsxnData from '../data/fsxn.json';
import pricingData from '../data/pricing.json';

const router = require('express').Router();

//Get regions mock response
router.get(`${BASE_URL}/v1/credentials/:credentialsId/fsx/regions`, async (req: {}, res: RegionRes) => {
    const retData = regionsData;
    generateResponse(res, 200, retData);
});

// Get VPC mock response
router.get(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/vpcs`, async (req: {}, res: VpcRes) => {
    const retData = vpcsData;
    generateResponse(res, 200, retData);
});

// Get SG mock response
router.get(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/vpcs/:vpcId/security-groups`, async (req: {}, res: any) => {
    generateResponse(res, 200, sgData);
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
router.get(
    `${BASE_URL}/v1/credentials/:credentialsId/regions/:region/sns-topics`,
    async (req: {}, res: SnsTopicsRes) => {
        const retData = snsTopicsData;
        generateResponse(res, 200, retData);
    }
);

// Get KMS mock response
router.get(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/kms-keys`, async (req: {}, res: KmsKeysRes) => {
    const retData = kmsKeysData;
    generateResponse(res, 200, retData);
});

// Get Key Pair mock response
router.get(`${BASE_URL}/v1/credentials/:credentialsId/regions/:region/key-pairs`, async (req: {}, res: KeyPairRes) => {
    const retData = keyPairData;
    generateResponse(res, 200, retData);
});

// Get Instance Type mock response
router.get(
    `${BASE_URL}/v1/credentials/:credentialsId/regions/:region/instance-types`,
    async (req: {}, res: InstanceTypeRes) => {
        const retData = instanceTypeData;
        generateResponse(res, 200, retData);
    }
);

// Get FSxN mock response
router.get(
    `${BASE_URL}/v1/credentials/:credentialsId/fsx/regions/:region/vpcs/:vpcId/file-systems`,
    async (req: {}, res: FsxnRes) => {
        const retData = fsxnData;
        generateResponse(res, 200, retData);
    }
);

//Get Pricing Data
router.post(`${BASE_URL}/v1/pricing`, async (req: {}, res: any) => {
    const retData = pricingData;
    generateResponse(res, 200, retData);
});

export default router;
