import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream } from 'fs';
import { gzipSync } from 'node:zlib';
import getLogger from '../../utils/logger';
import { MASTER_TEMPLATE_PATH, S3_BUCKET_SIGNED_URL_EXPIRY, SECRETS } from '../../utils/consts';

const logger = getLogger();

async function getPreSignedUrl(region: string, bucketname: string, key?: string) {
    logger.info('Getting presigned url', { region });

    const credentials = {
        accessKeyId: SECRETS.SIGNURL_ACCESS_KEY as string,
        secretAccessKey: SECRETS.SIGNURL_SECRET_KEY as string
    };
    const s3 = new S3Client({ credentials, region });
    const command = new GetObjectCommand({
        Bucket: bucketname,
        Key: key || MASTER_TEMPLATE_PATH
    });

    return getSignedUrl(s3, command, { expiresIn: S3_BUCKET_SIGNED_URL_EXPIRY });
}

async function putObjectBucket(
    region: string,
    bucketName: string,
    objectName: string,
    objectData?: string,
    filePath?: string,
    gzipData: boolean = false
) {
    logger.info('Uploading to bucket ', { region, bucketName, objectName, filePath, gzipData });

    const s3 = new S3Client({ region });
    let body;
    let contentEncoding;

    if (objectData) {
        if (gzipData) {
            // Gzip the objectData if gzipData is true
            body = gzipSync(objectData);
            contentEncoding = 'gzip';
        } else {
            body = objectData;
        }
    } else if (filePath) {
        // Read the file from filePath if objectData is not provided
        body = createReadStream(filePath);
    } else {
        throw new Error('Either objectData or filePath must be provided');
    }

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectName,
        Body: body,
        ...(contentEncoding && { ContentEncoding: contentEncoding })
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

// Mock for getPresignedUrl from s3 sdk is not working as expected, because of that using stub to fake the presigned url
// To mock using stub it needs to be named export, so only the presigned url function is wrapped in different object
const preSignedUrl = { getPreSignedUrl };

export { preSignedUrl, putObjectBucket, getObjectBucket };
