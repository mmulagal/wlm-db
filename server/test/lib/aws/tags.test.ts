import { faker } from '@faker-js/faker';
import { DEFAULT_AWS_REGION } from '../../utils/consts';
import { tagResource } from '../../../src/lib/aws/tags';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';

const resourceArn = `arn:aws:res:${DEFAULT_AWS_REGION}:${faker.number.int(8)}:res/${faker.string.alphanumeric(8)}`;
const tag = { key: 'value' };

describe('Tags Lib', () => {
    it('Create tag for given resource', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        await expect(tagResource(credentialsId, DEFAULT_AWS_REGION, resourceArn, tag)).resolves.not.toThrow();
    });
});
