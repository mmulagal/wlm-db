import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    PutBucketLifecycleConfigurationCommand,
    GetBucketLifecycleConfigurationCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import getLogger from '../../utils/logger';
import { MASTER_TEMPLATE_PATH, S3_BUCKET_SIGNED_URL_EXPIRY } from '../../utils/consts';

const logger = getLogger();

async function getPreSignedUrl(region: string, bucketname: string, key?: string) {
    logger.info('Getting presigned url', { region });

    // const credentials = {
    //     accessKeyId: SECRETS.SIGNURL_ACCESS_KEY as string,
    //     secretAccessKey: SECRETS.SIGNURL_SECRET_KEY as string
    // };
    const s3 = new S3Client({  region });
    const command = new GetObjectCommand({
        Bucket: bucketname,
        Key: key || MASTER_TEMPLATE_PATH
    });

    return getSignedUrl(s3, command, { expiresIn: S3_BUCKET_SIGNED_URL_EXPIRY });
}

async function putObjectBucket(region: string, bucketName: string, objectName: string, objectData: string) {
    logger.info('Uploading to bucket ', { region, bucketName, objectName });

    const s3 = new S3Client({ region });
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectName,
        Body: objectData
    });

    const response = await s3.send(command);

    logger.debug('putObjectBucket response:', response);

    return response;
}

async function getObjectBucket(region: string, bucketName: string, objectName: string) {
    logger.info('Reading from bucket ', { region, bucketName, objectName });

    const s3 = new S3Client({ region });
    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: objectName
    });

    const response = await s3.send(command);

    logger.debug('getObjectBucket response:', response);

    return response;
}

async function putBucketLifecycleConfiguration(region: string, config: any) {
    logger.info('Creating bucket lifcycle configuration', { region, config });
    const s3 = new S3Client({ region });
    const command = new PutBucketLifecycleConfigurationCommand(config);
    try {
        const response = await s3.send(command);
        logger.debug('Put Bucket Lifecycle Configuration response:', response);
        return response;
    } catch (error) {
        logger.debug('Error configuring lifecycle:', error);
    }
}

async function getBucketLifecycleConfiguration(region: string, bucketName: string) {
    logger.info('Fetching bucket lifcycle configuration', { region, bucketName });
    const s3 = new S3Client({ region });
    try {
        const command = new GetBucketLifecycleConfigurationCommand({ Bucket: bucketName });
        const response = await s3.send(command);
        logger.debug('Get Bucket Lifecycle Configuration response:', response);
        return response;
    } catch (error) {
        logger.debug(error);
    }
}

// Mock for getPresignedUrl from s3 sdk is not working as expected, because of that using stub to fake the presigned url
// To mock using stub it needs to be named export, so only the presigned url function is wrapped in different object
const preSignedUrl = { getPreSignedUrl };

export {
    preSignedUrl,
    putObjectBucket,
    putBucketLifecycleConfiguration,
    getBucketLifecycleConfiguration,
    getObjectBucket
};
