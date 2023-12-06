import { faker } from '@faker-js/faker';
import { tagEc2Resource, tagFsxResource } from '../../../src/operations/aws/tags-operations';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import { DEFAULT_AWS_REGION } from '../../utils/consts';

const credentialsId = `${faker.string.alpha(20)}`;
const awsAccountId = `${faker.string.alpha(8)}`;
const ec2Id = `i-${faker.string.alpha(8)}`;
const fsxId = `fs-${faker.string.alpha(8)}`;

describe('Tags Operations', () => {
    it('Tag Ec2 instance', async () => {
        await expect(
            tagEc2Resource(credentialsId, DEFAULT_AWS_REGION, awsAccountId, ec2Id, { key: 'value' })
        ).resolves.not.toThrow();
    });

    it('Tag Ec2 instance', async () => {
        await expect(
            tagFsxResource(credentialsId, DEFAULT_AWS_REGION, awsAccountId, fsxId, { key: 'value' })
        ).resolves.not.toThrow();
    });
});
