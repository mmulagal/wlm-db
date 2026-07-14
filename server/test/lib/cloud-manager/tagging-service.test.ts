import { callWlmHosts } from '../../../src/lib/cloud-manager/tagging-service';
import { ACCOUNT_ID } from '../../utils/consts';

describe('Tagging service lib', () => {
    const credentialsId = '61e20ee2-b623-47fc-9dde-df61c49a1064';
    const region = 'ap-southeast-1';

    describe('callWlmHosts', () => {
        it('Returns parsed JSON for fsxs via the generic caller', async () => {
            const response = await callWlmHosts(ACCOUNT_ID, credentialsId, region, 'fsxs');
            expect(response).toBeDefined();
        });

        it('Returns parsed JSON for ec2s via the generic caller', async () => {
            const response = await callWlmHosts(ACCOUNT_ID, credentialsId, region, 'ec2s');
            expect(response).toBeDefined();
        });
    });
});
