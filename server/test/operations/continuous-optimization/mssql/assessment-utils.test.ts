import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import '../../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../../simulator/scopes/aws/fsx-scope';
import '../../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../../simulator/scopes/opentelemetry-scope';
import '../../../simulator/scopes/aws/ssm-scope';
import '../../../simulator/scopes/aws/ec2-scope';
import '../../../simulator/scopes/aws/cloud-watch-scope';
import '../../../simulator/scopes/aws/compute-optimizer-scope';
import {
    getMatchingAssessmentStatus,
    handleOptimizeJobCreation
} from '../../../../src/operations/continuous-optimization/assessment-utils';
import { FINDING } from '../../../../src/utils/consts';
import { AssessmentStatus } from '../../../../src/utils/continous-optimization-consts';

describe('Assessment Utils', () => {
    it('Should return matching assessment status', async () => {
        const response = getMatchingAssessmentStatus(FINDING.NOT_OPTIMIZED);

        expect(response).toEqual(AssessmentStatus.NOT_OPTIMIZED);
    });

    it('Handle optimize job creation', async () => {
        const response = await handleOptimizeJobCreation(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            'test-server',
            'test-job',
            'test-job',
            'test-job'
        );
        expect(response).toBeDefined();
    });
});
