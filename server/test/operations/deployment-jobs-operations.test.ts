import { faker } from '@faker-js/faker';
import { getDeploymentJobsCount } from '../../src/operations/deployment-jobs-operations';
import jobsCountResposne from '../simulator/responses/deployment/deployment-jobs-count-response.json';
import { DEPLOYMENT_JOBS_COUNT_RESPONSE } from '../utils/consts';

const accountId = `${faker.string.alphanumeric(10)}`;
const duration = 90;

vi.mock('../../src/lib/database/db.ts', () => ({
    deploymentJobsCount() {
        return DEPLOYMENT_JOBS_COUNT_RESPONSE;
    }
}));

describe('Deployment table operations', () => {
    it('Get eployment jobs count', async () => {
        const resp = await getDeploymentJobsCount(accountId, duration);
        expect(resp).toEqual(jobsCountResposne);
    });
});
