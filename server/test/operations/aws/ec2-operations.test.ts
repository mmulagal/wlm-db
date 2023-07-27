import { faker } from '@faker-js/faker';
import { getAmiList, getVpcsList } from '../../../src/operations/aws/ec2-operations';
import { DEFAULT_AWS_REGION } from '../../../src/utils/consts';

import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/aws/ec2-scope';

describe('EC2 Operations', () => {
    it('list of EC2 AMIs', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const resp = await getAmiList(credentialsId, DEFAULT_AWS_REGION);
        expect(resp).toBeDefined();
    });

    it('list of vpc', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const resp = await getVpcsList(credentialsId, DEFAULT_AWS_REGION);
        expect(resp).toBeDefined();
    });
});
