import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';
import {
    getMatchingAssessmentStatus,
    handleOptimizeJobCreation,
    validateAssessment
} from '../../../src/operations/continuous-optimization/assessment-utils';
import { FINDING } from '../../../src/utils/consts';
import { AssessmentStatus } from '../../../src/utils/continous-optimization-consts';
import { MSSQLDriftAssessmentResponse } from '../../../src/routes/types/mssql-continuous-optimisation.types';
import {
    ASSESSMENT_AWS_BACKUP_DATA,
    ASSESSMENT_CRR_CONFIG_DATA,
    MSSQL_ASSESMENT_CONFIG_DATA,
    MSSQL_ASSESSMENT_CLONE_CONFIG_DATA,
    MSSQL_ASSESSMENT_HIGH_AVAILABILITY_CONFIG_DATA,
    MSSQL_ASSESSMENT_MAXDOP_CONFIG_DATA
} from '../../../src/utils/demo-utils/demoMockdata';

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

    it('Validate incorrect response', () => {
        const { isValid, errors } = validateAssessment(MSSQLDriftAssessmentResponse, {
            rssConfig: { rssConfigFinding: 'OPTIMIZED' }
        });
        expect(isValid).toBe(false);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('Validate correct response', () => {
        const { isValid, errors } = validateAssessment(MSSQLDriftAssessmentResponse, {
            ...MSSQL_ASSESMENT_CONFIG_DATA,
            ...ASSESSMENT_CRR_CONFIG_DATA,
            ...ASSESSMENT_AWS_BACKUP_DATA,
            ...MSSQL_ASSESSMENT_MAXDOP_CONFIG_DATA,
            ...MSSQL_ASSESSMENT_CLONE_CONFIG_DATA,
            ...MSSQL_ASSESSMENT_HIGH_AVAILABILITY_CONFIG_DATA
        });
        expect(isValid).toBe(true);
        expect(errors.length).toBe(0);
    });
});
