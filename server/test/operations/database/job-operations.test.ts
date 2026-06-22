import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import {
    Job,
    registerJobs,
    registerJob,
    getJobs,
    getJobDetails,
    updateJobDetails,
    deleteJobsWithAllSubJobs,
    getJobSummary,
    getJobSummaryByTime,
    updateLongRunningJobs
} from '../../../src/operations/database/job-operations';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION, THIRTY_DAYS } from '../../utils/consts';
import { deleteJobsOfAccount, listJobs } from '../../../src/lib/database/job';

beforeEach(async () => {
    await registerJobs(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION, [
        {
            name: 'test-job-ops-1',
            description: 'test-job-description',
            resourceName: 'test-resource',
            initiator: 'test-user',
            startTime: Date.now(),
            status: JOBSTATUS.IN_PROGRESS,
            type: JOBTYPE.DEPLOYMENT
        },
        {
            name: 'test-job-ops-2',
            description: 'test-job-description',
            resourceName: 'test-resource',
            initiator: 'test-user',
            startTime: Date.now(),
            status: JOBSTATUS.IN_PROGRESS,
            type: JOBTYPE.DEPLOYMENT
        }
    ]);
});
afterAll(async () => {
    await deleteJobsOfAccount(ACCOUNT_ID);
});
describe('Job operations', () => {
    it('Register Jobs', async () => {
        const response = await registerJobs(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION, [
            {
                name: 'test-job-ops-register-1',
                description: 'test-job-description',
                resourceName: 'test-resource',
                initiator: 'test-user',
                startTime: Date.now(),
                status: JOBSTATUS.IN_PROGRESS,
                type: JOBTYPE.DEPLOYMENT
            },
            {
                name: 'test-job-ops-register-2',
                description: 'test-job-description',
                resourceName: 'test-resource',
                initiator: 'test-user',
                startTime: Date.now(),
                status: JOBSTATUS.IN_PROGRESS,
                type: JOBTYPE.DEPLOYMENT
            }
        ]);
        expect(response.count).toEqual(2);
    });

    it('Get Jobs', async () => {
        const response = await getJobs(ACCOUNT_ID);
        expect(response.count).toBeGreaterThanOrEqual(2);
    });

    it('Get Job Details', async () => {
        await registerJobs(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION, [
            {
                name: 'test-job-ops-1',
                description: 'test-filtered-job-description',
                resourceName: 'test-resource',
                initiator: 'filterMe',
                startTime: Date.now(),
                status: JOBSTATUS.IN_PROGRESS,
                type: JOBTYPE.DEPLOYMENT
            }
        ]);
        const [jobDetails] = await listJobs(
            ACCOUNT_ID,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            'filterMe'
        );
        const response = await getJobDetails(ACCOUNT_ID, jobDetails.id);
        expect(response.description).toEqual('test-filtered-job-description');
    });

    it('Modify Job Details', async () => {
        const [job] = await listJobs(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION);
        const jobDetails = await getJobDetails(ACCOUNT_ID, job.id, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION);
        const response = await updateJobDetails(ACCOUNT_ID, job.id, {
            description: 'modified-description',
            status: JOBSTATUS.COMPLETED,
            endTime: Date.now()
        });
        if (response.id) {
            expect(response.id).toEqual(jobDetails.id);
            expect(response.name).toEqual(jobDetails.name);
            expect(response.description).toEqual('modified-description');
            expect(response.status).toEqual(JOBSTATUS.COMPLETED);
        }
        await deleteJobsOfAccount(ACCOUNT_ID);
    });

    it('Delete all jobs with sub jobs', async () => {
        const jobs = await listJobs(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION);
        const [jobId] = jobs.map(({ id }) => id);

        // registering level 2 jobs
        await registerJobs(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION, [
            {
                name: 'test-sub-job-1',
                description: 'test-sub-job-description',
                resourceName: 'test-resource',
                initiator: 'test-user',
                startTime: Date.now(),
                status: JOBSTATUS.IN_PROGRESS,
                type: JOBTYPE.DEPLOYMENT,
                parentJobId: jobId
            },
            {
                name: 'test-sub-job-2',
                description: 'test-sub-job-description',
                resourceName: 'test-resource',
                initiator: 'test-user',
                startTime: Date.now(),
                status: JOBSTATUS.IN_PROGRESS,
                type: JOBTYPE.DEPLOYMENT,
                parentJobId: jobId
            }
        ]);
        const jobDetails = await getJobDetails(ACCOUNT_ID, jobId, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION);
        expect(jobDetails.subJobs?.length).toEqual(2);

        const level2Jobs = jobDetails.subJobs as Job[];
        const level2JobIds = level2Jobs?.map(({ id }) => id);
        if (level2JobIds) {
            // registering level 3 jobs
            await registerJobs(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION, [
                {
                    name: 'test-level-3-job-1',
                    description: 'test-level-3-job-description',
                    resourceName: 'test-resource',
                    initiator: 'test-user',
                    startTime: Date.now(),
                    status: JOBSTATUS.IN_PROGRESS,
                    type: JOBTYPE.DEPLOYMENT,
                    parentJobId: level2JobIds[0]
                },
                {
                    name: 'test-level-3-job-2',
                    description: 'test-level-3-job-description',
                    resourceName: 'test-resource',
                    initiator: 'test-user',
                    startTime: Date.now(),
                    status: JOBSTATUS.IN_PROGRESS,
                    type: JOBTYPE.DEPLOYMENT,
                    parentJobId: level2JobIds[0]
                },
                {
                    name: 'test-level-3-job-3',
                    description: 'test-level-3-job-description',
                    resourceName: 'test-resource',
                    initiator: 'test-user',
                    startTime: Date.now(),
                    status: JOBSTATUS.IN_PROGRESS,
                    type: JOBTYPE.DEPLOYMENT,
                    parentJobId: level2JobIds[1]
                },
                {
                    name: 'test-level-3-job-4',
                    description: 'test-level-3-job-description',
                    resourceName: 'test-resource',
                    initiator: 'test-user',
                    startTime: Date.now(),
                    status: JOBSTATUS.IN_PROGRESS,
                    type: JOBTYPE.DEPLOYMENT,
                    parentJobId: level2JobIds[1]
                }
            ]);
        }

        const response = await deleteJobsWithAllSubJobs(ACCOUNT_ID, jobId);
        expect(response.count).toEqual(7);
    });

    it('should get job summary', async () => {
        const response = await getJobSummary(ACCOUNT_ID, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            startTime: new Date('2024-01-01').valueOf(),
            endTime: Date.now()
        });
        expect(response).toHaveProperty('inProgress');
        expect(response).toHaveProperty('completed');
        expect(response).toHaveProperty('failed');
    });
    it('Register single job', async () => {
        const response = await registerJob(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION, {
            name: 'test-job-ops-1',
            description: 'test-filtered-job-description',
            resourceName: 'test-resource',
            initiator: 'filterMe',
            startTime: Date.now(),
            status: JOBSTATUS.IN_PROGRESS,
            type: JOBTYPE.DEPLOYMENT
        });
        expect(response).toBeDefined();
    });
});

describe('getJobSummaryByTime', () => {
    const jobSummaryAccountId = 'job-summary-by-time-account';
    let mockStartTime: number;
    let mockEndTime: number;

    beforeEach(async () => {
        mockStartTime = Date.now() - THIRTY_DAYS;
        mockEndTime = Date.now();
        await deleteJobsOfAccount(jobSummaryAccountId);
        await registerJobs(jobSummaryAccountId, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION, [
            {
                name: 'test-job-ops-1',
                resourceName: 'test-resource',
                startTime: mockStartTime,
                endTime: mockStartTime,
                status: JOBSTATUS.FAILED,
                type: JOBTYPE.DEPLOYMENT
            },
            {
                name: 'test-job-ops-2',
                resourceName: 'test-resource',
                startTime: mockEndTime,
                endTime: mockEndTime,
                status: JOBSTATUS.COMPLETED,
                type: JOBTYPE.DEPLOYMENT
            }
        ]);
    });

    it('should return job summary by time', async () => {
        const result = await getJobSummaryByTime(jobSummaryAccountId, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            startTime: mockStartTime,
            endTime: mockEndTime
        });

        expect(result.length).toEqual(2);
    });

    it('should handle error and throw an error', async () => {
        await deleteJobsOfAccount(jobSummaryAccountId);

        const result = await getJobSummaryByTime(jobSummaryAccountId, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            startTime: mockStartTime,
            endTime: mockEndTime
        });

        expect(result.length).toEqual(0);
    });
});

describe('updateLongRunningJobs', async () => {
    const startTime = Date.now() - 6 * 60 * 60 * 1000;
    beforeEach(async () => {
        await deleteJobsOfAccount(ACCOUNT_ID);
        await deleteJobsOfAccount(ACCOUNT_ID);
        await registerJobs(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION, [
            {
                name: 'test-job-ops-1',
                description: 'test-masterjob-description',
                resourceName: 'test-resource',
                initiator: 'test-user',
                startTime,
                status: JOBSTATUS.IN_PROGRESS,
                type: JOBTYPE.DEPLOYMENT,
                endTime: undefined
            }
        ]);
        const jobs = await getJobs(ACCOUNT_ID);
        const masterJob = jobs.items[0];
        await registerJobs(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION, [
            {
                parentJobId: masterJob.id,
                name: 'test-subjob-ops-1',
                description: 'test-job-description',
                resourceName: 'test-resource',
                initiator: 'test-user',
                startTime,
                status: JOBSTATUS.IN_PROGRESS,
                type: JOBTYPE.DEPLOYMENT,
                endTime: undefined
            },
            {
                parentJobId: masterJob.id,
                name: 'test-subjob-ops-2',
                description: 'test-job-description',
                resourceName: 'test-resource',
                initiator: 'test-user',
                startTime,
                status: JOBSTATUS.FAILED,
                type: JOBTYPE.DEPLOYMENT,
                endTime: Date.now()
            }
        ]);
    });

    it('should fail longrunning jobs and subjobs', async () => {
        await updateLongRunningJobs();
        const masterJob = (await getJobs(ACCOUNT_ID)).items[0];
        const subjobs = (await getJobDetails(ACCOUNT_ID, masterJob.id, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION))
            .subJobs;
        expect(masterJob.endTime).toBeDefined();
        expect(masterJob.status).toBe(JOBSTATUS.FAILED);
        expect(subjobs[0].endTime).toBeDefined();
        expect(subjobs[0].status).toBe(JOBSTATUS.FAILED);
        expect(subjobs[1].endTime).toBeDefined();
        expect(subjobs[1].status).toBe(JOBSTATUS.FAILED);
    });
});
