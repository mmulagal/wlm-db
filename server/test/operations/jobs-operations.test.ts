import { faker } from '@faker-js/faker';
import { getDeploymentJobsCount, getDeploymentJobsSummary } from '../../src/operations/jobs-operations';
import jobsCountResposne from '../simulator/responses/deployment/deployment-jobs-count-response.json';
import jobsSummaryResponse from '../simulator/responses/deployment/deployment-jobs-summary-response.json';
import jobsSummaryDbResponse from '../simulator/responses/deployment/deplyment-jobs-summary-db-response.json';
import { DEPLOYMENT_JOBS_COUNT_RESPONSE } from '../utils/consts';

const accountId = `${faker.string.alphanumeric(10)}`;
const duration = 90;
const status = 'CREATE_IN_PROGRESS';

vi.mock('../../src/lib/database/db.ts', () => ({
    deploymentJobsCount() {
        return DEPLOYMENT_JOBS_COUNT_RESPONSE;
    }
}));

vi.mock('../../src/operations/database/database-operations.ts', () => ({
    getDeployments() {
        return jobsSummaryDbResponse;
    }
}));

describe('Deployment table operations', () => {
    it('Get deployment jobs count', async () => {
        const resp = await getDeploymentJobsCount(accountId, duration);
        expect(resp).toEqual(jobsCountResposne);
    });

    it('Get deployment jobs summary', async () => {
        const resp = await getDeploymentJobsSummary(accountId, status);
        expect(resp).toEqual(jobsSummaryResponse);
    });
});
