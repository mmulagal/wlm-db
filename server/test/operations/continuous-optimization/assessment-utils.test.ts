import { JOBSTATUS, JOBTYPE } from '@prisma/client';
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
import { createJob, deleteJobs } from '../../../src/lib/database/job';

describe('Assessment Utils', () => {
    const createdJobIds: string[] = [];

    afterEach(async () => {
        if (createdJobIds.length > 0) {
            await deleteJobs(ACCOUNT_ID, createdJobIds);
            createdJobIds.length = 0;
        }
    });
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
        createdJobIds.push(response);
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

    it('Should throw 412 error when job is running for less than 5 minutes', async () => {
        const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
        const recentJob = await createJob(ACCOUNT_ID, {
            account_id: ACCOUNT_ID,
            credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            type: JOBTYPE.WELL_ARCHITECTED,
            status: JOBSTATUS.IN_PROGRESS,
            resource_name: 'test-server-recent',
            name: 'test-job',
            description: 'test-job',
            start_time: new Date(twoMinutesAgo)
        });
        createdJobIds.push(recentJob.id);

        await expect(
            handleOptimizeJobCreation(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                'test-server-recent',
                JOBTYPE.WELL_ARCHITECTED,
                'test-job',
                'test-job'
            )
        ).rejects.toThrow(/A job is already in progress/);
    });

    it('Should allow creating new job when existing job is running for more than 5 minutes', async () => {
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
        const staleJob = await createJob(ACCOUNT_ID, {
            account_id: ACCOUNT_ID,
            credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            type: JOBTYPE.WELL_ARCHITECTED,
            status: JOBSTATUS.IN_PROGRESS,
            resource_name: 'test-server-stale',
            name: 'stale-job',
            description: 'stale-job',
            start_time: new Date(tenMinutesAgo)
        });
        createdJobIds.push(staleJob.id);

        const newJobId = await handleOptimizeJobCreation(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            'test-server-stale',
            JOBTYPE.WELL_ARCHITECTED,
            'new-job',
            'new-job'
        );

        expect(newJobId).toBeDefined();
        expect(newJobId).not.toBe(staleJob.id);
        createdJobIds.push(newJobId);
    });
});
