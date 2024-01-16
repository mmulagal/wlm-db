import { JOBSTATUS, JOBTYPE } from '@prisma/client';

import moment from 'moment';
import {
    createJobs,
    deleteJobs,
    deleteJobsOfAccount,
    deleteOlderJobs,
    getJobCountByStatus,
    listJobs,
    listUniqueJob,
    updateJob
} from '../../../src/lib/database/job';
import { ACCOUNT_ID } from '../../utils/consts';

beforeEach(async () => {
    await createJobs(ACCOUNT_ID, [
        {
            account_id: ACCOUNT_ID,
            name: 'test-job',
            description: 'test-job-description',
            resource_name: 'test-resource',
            initiator: 'test-user',
            start_time: new Date(),
            status: JOBSTATUS.IN_PROGRESS,
            type: JOBTYPE.DEPLOYMENT
        }
    ]);
});
afterAll(async () => {
    await deleteJobsOfAccount(ACCOUNT_ID);
});
describe('Create jobs', () => {
    it('should create a job', async () => {
        const response = await createJobs(ACCOUNT_ID, [
            {
                account_id: ACCOUNT_ID,
                name: 'test-job-1',
                description: 'test-job-description',
                resource_name: 'test-resource',
                initiator: 'test-user',
                start_time: new Date(),
                status: JOBSTATUS.IN_PROGRESS,
                type: JOBTYPE.DEPLOYMENT
            }
        ]);
        expect(response.count).toEqual(1);
    });

    it('should create multiple jobs', async () => {
        const response = await createJobs(ACCOUNT_ID, [
            {
                account_id: ACCOUNT_ID,
                name: 'test-job-2',
                description: 'test-job-description',
                resource_name: 'test-resource',
                initiator: 'test-user',
                start_time: new Date(),
                status: JOBSTATUS.IN_PROGRESS,
                type: JOBTYPE.DEPLOYMENT
            },
            {
                account_id: ACCOUNT_ID,
                name: 'test-job-3',
                description: 'test-job-description',
                resource_name: 'test-resource',
                initiator: 'test-user',
                start_time: new Date(),
                status: JOBSTATUS.IN_PROGRESS,
                type: JOBTYPE.DEPLOYMENT
            }
        ]);

        expect(response.count).toEqual(2);
    });

    it.skip('should not create duplicate jobs', async () => {
        // skipping as skipDuplicates functionality not supported in Prisma mock
        const startTime = new Date();
        const response = await createJobs(ACCOUNT_ID, [
            {
                account_id: ACCOUNT_ID,
                name: 'test-job',
                description: 'test-job-description',
                resource_name: 'test-resource',
                initiator: 'test-user',
                start_time: startTime,
                status: JOBSTATUS.IN_PROGRESS,
                type: JOBTYPE.DEPLOYMENT
            },
            {
                account_id: ACCOUNT_ID,
                name: 'test-job',
                description: 'test-job-description',
                resource_name: 'test-resource',
                initiator: 'test-user',
                start_time: startTime,
                status: JOBSTATUS.IN_PROGRESS,
                type: JOBTYPE.DEPLOYMENT
            }
        ]);

        expect(response.count).toEqual(0);
    });
});

describe('Delete jobs', () => {
    it('should delete a job', async () => {
        const jobs = await listJobs(ACCOUNT_ID);
        const jobIds = jobs.map(({ id }) => id);
        const response = await deleteJobs(ACCOUNT_ID, [jobIds[0]]);
        expect(response.count).equal(1);
    });

    it('should delete job and first level child job', async () => {
        await createJobs(ACCOUNT_ID, [
            {
                account_id: ACCOUNT_ID,
                name: 'test-job-4',
                description: 'test-job-description',
                resource_name: 'test-resource',
                initiator: 'test-user',
                start_time: new Date(),
                status: JOBSTATUS.IN_PROGRESS,
                type: JOBTYPE.DEPLOYMENT
            }
        ]);
        const [jobs] = await listJobs(ACCOUNT_ID);
        await createJobs(ACCOUNT_ID, [
            {
                account_id: ACCOUNT_ID,
                name: 'test-job-5',
                description: 'test-job-description',
                resource_name: 'test-resource',
                initiator: 'test-user',
                start_time: new Date(),
                status: JOBSTATUS.IN_PROGRESS,
                type: JOBTYPE.DEPLOYMENT,
                parent_job_id: jobs.id
            }
        ]);

        const response = await deleteJobs(ACCOUNT_ID, [jobs.id]);
        expect(response.count).equal(2);
    });

    it('should delete multiple jobs with invalid ID', async () => {
        const response = await deleteJobs(ACCOUNT_ID, ['a', 'b']);
        expect(response.count).equal(0);
    });
});

describe('Modify jobs', () => {
    it('should modify a job', async () => {
        const jobs = await listJobs(ACCOUNT_ID);
        const [jobIds] = jobs.map(({ id }) => id);
        const endTime = moment(new Date()).valueOf();
        const response = await updateJob(ACCOUNT_ID, jobIds, 'modified-description', JOBSTATUS.COMPLETED, endTime);
        expect(response.description).equal('modified-description');
        expect(response.status, JOBSTATUS.COMPLETED);
    });

    it('should fail to modify a job invalid Job Id', async () => {
        try {
            await updateJob(ACCOUNT_ID, 'a', 'modified-description', JOBSTATUS.COMPLETED);
        } catch (error: any) {
            expect(error?.meta?.cause).toEqual('Record to update not found.');
        }
    });
});

describe('List jobs', () => {
    it('should list all jobs in an account', async () => {
        const jobs = await listJobs(ACCOUNT_ID);
        expect(jobs.length).toBeGreaterThan(0);
    });

    it('should list all sub jobs of a parent job with sort', async () => {
        const jobs = await listJobs(ACCOUNT_ID);
        const [jobId] = jobs.map(({ id }) => id);
        await createJobs(ACCOUNT_ID, [
            {
                account_id: ACCOUNT_ID,
                name: 'a-test-sub-job-1',
                description: 'test-sub-job-description',
                resource_name: 'test-resource',
                initiator: 'abc',
                start_time: new Date(),
                status: JOBSTATUS.IN_PROGRESS,
                type: JOBTYPE.DEPLOYMENT,
                parent_job_id: jobId
            },
            {
                account_id: ACCOUNT_ID,
                name: 'b-test-sub-job-2',
                description: 'test-sub-job-description',
                resource_name: 'test-resource',
                initiator: 'test-user',
                start_time: new Date(),
                status: JOBSTATUS.IN_PROGRESS,
                type: JOBTYPE.DEPLOYMENT,
                parent_job_id: jobId
            }
        ]);
        const subJobs = await listJobs(ACCOUNT_ID, jobId, 'name', 'desc');
        expect(subJobs.length).equal(2);
        expect(subJobs[0].name).equal('b-test-sub-job-2');
    });

    it('should list an individual job', async () => {
        const [jobs] = await listJobs(ACCOUNT_ID);
        const response = await listUniqueJob(ACCOUNT_ID, jobs.id);
        expect(response.id).toEqual(jobs.id);
    });

    it('fail to list a job invalid job Id', async () => {
        try {
            await listUniqueJob(ACCOUNT_ID, 'a');
        } catch (error) {
            // expect(error.code).toEqual('P2025')
            expect(error).toBeDefined(); // prismock returns undefined instead of actual error code
        }
    });
});

describe('Group jobs by status', () => {
    it('should group jobs by status', async () => {
        const response = await getJobCountByStatus(ACCOUNT_ID, new Date('2024-01-01').valueOf(), Date.now());
        expect(response[0]).toHaveProperty(['status']);
        expect(response[0]).toHaveProperty(['_count']);
    });
});

// This test case should be the last one in this file
it('should delete jobs lesser than a time', async () => {
    await deleteOlderJobs(Date.now());
    const jobs = await listJobs(ACCOUNT_ID);
    expect(jobs.length).toBe(0);
});
