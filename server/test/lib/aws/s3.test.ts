import { faker } from '@faker-js/faker';
import '../../simulator/scopes/aws/s3-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/opentelemetry-scope';
import { DEFAULT_AWS_REGION } from '../../../src/utils/consts';
import { getPreSignedUrl } from '../../../src/lib/aws/s3';

const credentialsId = `${faker.string.alpha(20)}`;

describe('S3 Lib', () => {
    it('Get Pre signed url', async () => {
        const response = await getPreSignedUrl(credentialsId, DEFAULT_AWS_REGION);
        expect(response).toBeDefined();
    });
});
