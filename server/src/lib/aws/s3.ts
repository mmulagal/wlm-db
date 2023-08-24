import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getCredentialDetails } from '../cloud-manager/credentials';
import getLogger from '../../utils/logger';
import { BUCKET_NAME, MASTER_TEMPLATE_PATH, S3_BUCKET_SIGNED_URL_EXPIRTY } from '../../utils/consts';

const logger = getLogger();

async function getS3Client(region: string, credentialsId: string) {
    logger.debug('Getting S3 client:', region, credentialsId);

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialDetails(credentialsId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };

    return new S3Client({ credentials, region });
}

async function getPreSignedUrl(credentialId: string, region: string, key?: string) {
    logger.info('Getting presigned url', { credentialId, region });
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key || MASTER_TEMPLATE_PATH
    });
    const s3 = await getS3Client(region, credentialId);

    return await getSignedUrl(s3, command, { expiresIn: S3_BUCKET_SIGNED_URL_EXPIRTY });
}

async function putObjectBucket(
    credentialId: string,
    region: string,
    bucketName: string,
    objectName: string,
    objectData: string
) {
    logger.info('Uploading to bucket ', { credentialId, region, bucketName, objectName, objectData });

    const s3 = new S3Client({ region });
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectName,
        Body: objectData
    });
    const { VersionId: versionId } = await s3.send(command);
    logger.debug('putObjectBucket response:', versionId);
}

export { getPreSignedUrl, putObjectBucket };
