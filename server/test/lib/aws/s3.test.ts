import { faker } from '@faker-js/faker';
import { DEFAULT_AWS_REGION, SECRETS } from '../../../src/utils/consts';
import { preSignedUrl, putObjectBucket, getObjectBucket } from '../../../src/lib/aws/s3';

const { getPreSignedUrl } = preSignedUrl;

const credentialsId = `${faker.string.alpha(20)}`;
SECRETS.SIGNURL_ACCESS_KEY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
SECRETS.SIGNURL_SECRET_KEY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

describe('S3 Lib', () => {
    it('Get Pre signed url', async () => {
        const response = await getPreSignedUrl(credentialsId, DEFAULT_AWS_REGION);
        expect(response).toBeDefined();
    });
    it('Put object to bucket', async () => {
        const response = await putObjectBucket(DEFAULT_AWS_REGION, 'sample', 'sample.yaml', 'sample');
        expect(response).toBeDefined();
    });
    it('Get Bucket object', async () => {
        const response = await getObjectBucket(DEFAULT_AWS_REGION, 'sample', 'sample.yaml');
        expect(response).toBeDefined();
    });
});
