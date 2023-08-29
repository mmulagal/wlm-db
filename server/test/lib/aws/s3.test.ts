import { faker } from '@faker-js/faker';
import '../../simulator/scopes/aws/s3-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/opentelemetry-scope';
import { DEFAULT_AWS_REGION } from '../../../src/utils/consts';
import { getPreSignedUrl, putObjectBucket } from '../../../src/lib/aws/s3';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';

const credentialsId = `${faker.string.alpha(20)}`;

describe('S3 Lib', () => {
    it('Get Pre signed url', async () => {
        const response = await getPreSignedUrl(credentialsId, DEFAULT_AWS_REGION);
        expect(response).toBeDefined();
    });
    it('Put object to bucket', async () => {
        const s3Client = mockClient(S3Client);
        s3Client.on(PutObjectCommand).resolves({});

        const response = await putObjectBucket(credentialsId, DEFAULT_AWS_REGION, 'sample', 'sample.yaml', 'sample');
        expect(response).toBeDefined();
    });
});
