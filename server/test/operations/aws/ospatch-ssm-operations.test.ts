import { faker } from '@faker-js/faker';
import { getInstancesPatchStatus, runAwsPatchBaseline } from '../../../src/operations/aws/ospatch-ssm-operations';
import { DatabaseTypes } from '../../../src/utils/consts';

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
        const response = await getInstancesPatchStatus(
            credentialsId,
            'us-east-1',
            instanceIds,
            DatabaseTypes.MS_SQL_SERVER
        );
        expect(response?.length).toEqual(instanceIds.length);
    });
});
