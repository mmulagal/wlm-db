import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import getLogger from '../../utils/logger';
import { BUCKET_NAME, MASTER_TEMPLATE_PATH, S3_BUCKET_SIGNED_URL_EXPIRTY } from '../../utils/consts';

const logger = getLogger();

async function getPreSignedUrl(region: string, key?: string) {
    logger.info('Getting presigned url', { region });

    const s3 = new S3Client({ region });
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key || MASTER_TEMPLATE_PATH
    });

    return await getSignedUrl(s3, command, { expiresIn: S3_BUCKET_SIGNED_URL_EXPIRTY });
}

async function putObjectBucket(
    credentialId: string,
    region: string,
    bucketName: string,
    objectName: string,
    objectData: string
) {
    logger.info('Uploading to bucket ', { credentialId, region, bucketName, objectName });

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

export { getPreSignedUrl, putObjectBucket };
