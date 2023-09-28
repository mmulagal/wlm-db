import { faker } from '@faker-js/faker';
import '../../simulator/scopes/aws/s3-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/opentelemetry-scope';
import { DEFAULT_AWS_REGION, SECRETS } from '../../../src/utils/consts';
import { getPreSignedUrl, putObjectBucket } from '../../../src/lib/aws/s3';

const credentialsId = `${faker.string.alpha(20)}`;
SECRETS.SIGNURL_ACCESS_KEY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
SECRETS.SIGNURL_SECRET_KEY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

describe('S3 Lib', () => {
    it('Get Pre signed url', async () => {
        const response = await getPreSignedUrl(credentialsId, DEFAULT_AWS_REGION);
        expect(response).toBeDefined();
    });
    it('Put object to bucket', async () => {
        const response = await putObjectBucket(credentialsId, DEFAULT_AWS_REGION, 'sample', 'sample.yaml', 'sample');
        expect(response).toBeDefined();
    });
});
