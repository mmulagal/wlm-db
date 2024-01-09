
import { JOBSTATUS } from '@prisma/client';
import {
    Job,
    registerJobs,
    getJobs,
    getJobDetails,
    modifyJobDetails,
    deleteJobsWithAllSubJobs
} from '../../../src/operations/database/job-operations'
import { ACCOUNT_ID } from '../../utils/consts';
import { deleteJobsAtAccount, listJobs } from '../../../src/lib/database/job';

beforeEach(async () => {
    await registerJobs(ACCOUNT_ID, [{
        accountId: ACCOUNT_ID,
        name: 'test-job-ops-1',
        description: 'test-job-description',
        resourceName: 'test-resource',
        initiator: 'test-user',
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: 'Deployment'
    },
    {
        accountId: ACCOUNT_ID,
        name: 'test-job-ops-2',
        description: 'test-job-description',
        resourceName: 'test-resource',
        initiator: 'test-user',
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: 'Deployment'
    }]);
})
afterAll(async () => {
    await deleteJobsAtAccount(ACCOUNT_ID)
})
describe('Job operations', () => {
    it('Register Jobs', async () => {
        const response = await registerJobs(ACCOUNT_ID, [{
            accountId: ACCOUNT_ID,
            name: 'test-job-ops-register-1',
            description: 'test-job-description',
            resourceName: 'test-resource',
            initiator: 'test-user',
            startTime: Date.now(),
            status: JOBSTATUS.IN_PROGRESS,
            type: 'Deployment'
        },
        {
            accountId: ACCOUNT_ID,
            name: 'test-job-ops-register-2',
            description: 'test-job-description',
            resourceName: 'test-resource',
            initiator: 'test-user',
            startTime: Date.now(),
            status: JOBSTATUS.IN_PROGRESS,
            type: 'Deployment'
        }]);
        expect(response.count).toEqual(2);
    });

    it('Get Jobs', async () => {
        const response = await getJobs(ACCOUNT_ID);
        expect(response.count).toBeGreaterThanOrEqual(2);
    });

    it('Get Job Details', async () => {
        await registerJobs(ACCOUNT_ID, [{
            accountId: ACCOUNT_ID,
            name: 'test-job-ops-1',
            description: 'test-filtered-job-description',
            resourceName: 'test-resource',
            initiator: 'filterMe',
            startTime: Date.now(),
            status: JOBSTATUS.IN_PROGRESS,
            type: 'Deployment'
        }]);
        const [jobDetails] = await listJobs(ACCOUNT_ID, undefined, undefined, undefined, 'filterMe');
        const response = await getJobDetails(ACCOUNT_ID, jobDetails.id);
        expect(response.description).toEqual('test-filtered-job-description');
    });

    it('Modify Job Details', async () => {
        const [job] = await listJobs(ACCOUNT_ID);
        const jobDetails = await getJobDetails(ACCOUNT_ID, job.id);
        const response = await modifyJobDetails(ACCOUNT_ID, job.id, 'modified-description', JOBSTATUS.COMPLETED, Date.now());
        if (response.id) {
            expect(response.id).toEqual(jobDetails.id);
            expect(response.name).toEqual(jobDetails.name);
            expect(response.description).toEqual('modified-description');
            expect(response.status).toEqual(JOBSTATUS.COMPLETED);
        }
        await deleteJobsAtAccount(ACCOUNT_ID);
    });

    it('Delete all jobs with sub jobs', async () => {
        const jobs = await listJobs(ACCOUNT_ID);
        const [jobId] = jobs.map(({ id }) => id);

        //registering level 2 jobs
        await registerJobs(ACCOUNT_ID, [{
            accountId: ACCOUNT_ID,
            name: 'test-sub-job-1',
            description: 'test-sub-job-description',
            resourceName: 'test-resource',
            initiator: 'test-user',
            startTime: Date.now(),
            status: JOBSTATUS.IN_PROGRESS,
            type: 'Deployment',
            parentJobId: jobId
        },
        {
            accountId: ACCOUNT_ID,
            name: 'test-sub-job-2',
            description: 'test-sub-job-description',
            resourceName: 'test-resource',
            initiator: 'test-user',
            startTime: Date.now(),
            status: JOBSTATUS.IN_PROGRESS,
            type: 'Deployment',
            parentJobId: jobId
        }]);
        const jobDetails = await getJobDetails(ACCOUNT_ID, jobId);
        expect(jobDetails.subJobs?.length).toEqual(2);

        const level2Jobs = jobDetails.subJobs as Job[]
        const level2JobIds = level2Jobs?.map(({ id }) => id);
        console.log("level2JobIds", level2JobIds)
        if (level2JobIds) {
            //registering level 3 jobs
            await registerJobs(ACCOUNT_ID, [{
                accountId: ACCOUNT_ID,
                name: 'test-level-3-job-1',
                description: 'test-level-3-job-description',
                resourceName: 'test-resource',
                initiator: 'test-user',
                startTime: Date.now(),
                status: JOBSTATUS.IN_PROGRESS,
                type: 'Deployment',
                parentJobId: level2JobIds[0]
            },
            {
                accountId: ACCOUNT_ID,
                name: 'test-level-3-job-2',
                description: 'test-level-3-job-description',
                resourceName: 'test-resource',
                initiator: 'test-user',
                startTime: Date.now(),
                status: JOBSTATUS.IN_PROGRESS,
                type: 'Deployment',
                parentJobId: level2JobIds[0]
            },
            {
                accountId: ACCOUNT_ID,
                name: 'test-level-3-job-3',
                description: 'test-level-3-job-description',
                resourceName: 'test-resource',
                initiator: 'test-user',
                startTime: Date.now(),
                status: JOBSTATUS.IN_PROGRESS,
                type: 'Deployment',
                parentJobId: level2JobIds[1]
            },
            {
                accountId: ACCOUNT_ID,
                name: 'test-level-3-job-4',
                description: 'test-level-3-job-description',
                resourceName: 'test-resource',
                initiator: 'test-user',
                startTime: Date.now(),
                status: JOBSTATUS.IN_PROGRESS,
                type: 'Deployment',
                parentJobId: level2JobIds[1]
            }]);
        }

        const response = await deleteJobsWithAllSubJobs(ACCOUNT_ID, jobId);
        expect(response.count).toEqual(7);
    });
})
