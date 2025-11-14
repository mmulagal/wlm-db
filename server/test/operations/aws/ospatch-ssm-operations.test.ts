import { faker } from '@faker-js/faker';
import { getInstancesPatchStatus, runAwsPatchBaseline } from '../../../src/operations/aws/ospatch-ssm-operations';

const credentialsId = `${faker.string.alpha(20)}`;

describe('OS Patch SSM operations', () => {
    it('Should run AWS patch baseline assessment', async () => {
        const instanceIds = ['i-test-ec2-1', 'i-test-ec2-2', 'i-test-ec2-3'];
        const response = await runAwsPatchBaseline(credentialsId, 'us-east-1', instanceIds);
        const allResponsesSucceeded = response?.every(({ response: { Status } = {} }) => Status === 'Success');
        expect(allResponsesSucceeded).toBeTruthy();
    });

    it('Get instances patch states', async () => {
        const instanceIds = ['i-test-ec2-1', 'i-test-ec2-2', 'i-test-ec2-3'];
        const response = await getInstancesPatchStatus(credentialsId, 'us-east-1', instanceIds);
        expect(response?.length).toEqual(instanceIds.length);
    });
});
