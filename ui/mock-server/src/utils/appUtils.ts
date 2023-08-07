import Haikunator from 'haikunator';
const haikunator = new Haikunator();

export const BASE_URL = '/wlmdb/accounts/:accountId/api';

export const generateResponse = function generateResponse(res: any, statusCode: number, result: any) {
    const number = '123';
    const test = 12;
    console.log('asdfsafd');

    return res.status(statusCode).send(result);
};

export const generateRandomNumber = function generateRandomNumber(min = 100, max = 1000) {
    return Math.random() * (max - min) + min;
};

export const generateRandomFileSize = function generateRandomFileSize(min = 10485760, max = 5368709120) {
    return generateRandomNumber(min, max);
};

export const generateRandomTime = function generateRandomTime(min = 1603305000000, max = 1603823400000) {
    return Math.random() * (max - min) + min;
};

export const generateRandomName = function generateRandomName(options: any) {
    if (options) return haikunator.haikunate({ ...options });

    return haikunator.haikunate();
};

export const generateRandomUUID = function generateRandomUUID(tokenLength: number, isTokenHex: boolean) {
    return haikunator.haikunate({
        delimiter: '-',
        tokenLength: tokenLength ? tokenLength : 4,
        tokenHex: isTokenHex ? isTokenHex : false,
        tokenChars: '0123456789'
    });
};

export const delay = function delay(ms: number) {
    return new Promise(res => setTimeout(res, 0));
};

const appUtils = {
    BASE_URL,
    generateRandomFileSize,
    generateRandomNumber,
    generateRandomTime,
    generateResponse,
    generateRandomName,
    generateRandomUUID,
    delay
};
export default appUtils;
