import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import ms from 'ms';
import getLogger from '../../utils/logger';
import { prisma } from '../../utils/prisma-utils';
import { checkAccount } from './db';
import { JOBS_DEFAULT_TIME_RANGE } from '../../utils/consts';

const logger = getLogger();

interface readOnlyJob {
    account_id: string;
    credentials_id: string;
    region: string;
    type: JOBTYPE;
    status: JOBSTATUS;
    resource_name: string;
    name: string;
    description?: string;
    error?: string;
    start_time: Date;
    end_time?: Date;
    parent_job_id?: string;
    initiator?: string;
}

async function countParentJobs(accountId: string) {
    logger.info('Counting parent jobs', accountId);

    accountId = checkAccount(accountId);

    return prisma.client.job.aggregate({
        _count: {
            id: true
        },
        where: {
            account_id: accountId,
            parent_job_id: null
        }
    });
}

async function listJobs(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string | null = null,
    sort: string = 'start_time',
    sortOrder: string = 'desc',
    jobname?: string,
    initiator?: string,
    type?: JOBTYPE[],
    status?: JOBSTATUS[],
    startTime?: number,
    endTime?: number,
    pageSize?: number,
    nextToken?: string,
    resourceName?: string
) {
    logger.info('Listing jobs', {
        accountId,
        credentialsId,
        region,
        parentJobId,
        sort,
        sortOrder,
        initiator,
        type,
        status,
        startTime,
        endTime,
        pageSize,
        nextToken,
        resourceName
    });

    accountId = checkAccount(accountId);

    // Default time range is 30 days
    startTime = startTime || Date.now() - ms(JOBS_DEFAULT_TIME_RANGE);
    endTime = endTime || Date.now();

    return prisma.client.job.findMany({
        where: {
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            parent_job_id: parentJobId,
            ...(type && { type: { in: type } }),
            ...(status && { status: { in: status } }),
            ...(jobname && {
                name: {
                    contains: jobname
                }
            }),
            ...(initiator && { initiator }),
            ...(resourceName && { resource_name: resourceName }),
            start_time: {
                gte: new Date(startTime),
                lte: new Date(endTime)
            }
        },
        orderBy: [
            {
                [sort]: `${sortOrder}`
            },
            {
                id: 'desc'
            }
        ],
        take: pageSize,
        ...(nextToken && {
            skip: 1,
            cursor: {
                id: nextToken
            }
        })
    });
}

async function listUniqueJob(accountId: string, credentialsId: string, region: string, jobId: string) {
    logger.info('List unique job', { accountId, credentialsId, region, jobId });
    accountId = checkAccount(accountId);

    return prisma.client.job.findUniqueOrThrow({
        where: {
            id: jobId,
            credentials_id: credentialsId,
            region
        }
    });
}
async function createJobs(accountId: string, jobs: readOnlyJob[]) {
    logger.info('Creating jobs', { accountId, jobs: jobs?.length });

    logger.debug('Bulk creating jobs', { jobs });

    // createMany doesnt return the records created, but only the count, it suits our current requirement, in future if ther is an ask to return the created record Ids, refer to comments in https://github.com/prisma/prisma/issues/8131
    return prisma.client.job.createMany({
        data: jobs,
        skipDuplicates: true
    });
}

async function createJob(accountId: string, job: readOnlyJob) {
    logger.info('Creating job', { accountId, job });

    return prisma.client.job.create({
        data: job
    });
}

async function updateJob(
    accountId: string,
    credentialsId: string,
    region: string,
    jobId: string,
    description?: string,
    status?: JOBSTATUS,
    endTime?: number,
    error?: string
) {
    logger.info('Updating a job', { accountId, credentialsId, region, jobId, description, status, endTime, error });

    accountId = checkAccount(accountId);

    return prisma.client.job.update({
        where: {
            id: jobId,
            credentials_id: credentialsId,
            region
        },
        data: {
            ...(description && { description }),
            ...(status && { status }),
            ...(endTime && { end_time: new Date(endTime) }),
            ...(error && { error })
        }
    });
}

async function deleteJobs(accountId: string, jobId: string[]) {
    logger.info('Deleting jobs and its first level sub jobs', { accountId, jobId });
    accountId = checkAccount(accountId);
    const response = await prisma.client.job.deleteMany({
        where: {
            OR: [
                {
                    id: { in: jobId }
                },
                {
                    parent_job_id: { in: jobId }
                }
            ]
        }
    });
    return response;
}

async function deleteJobsOfAccount(accountId: string) {
    logger.info('Deleting all jobs in an account', accountId);
    accountId = checkAccount(accountId);
    return prisma.client.job.deleteMany({
        where: {
            account_id: accountId
        }
    });
}

async function deleteOlderJobs(olderDate: number) {
    logger.info('Delete Older Jobs ', { olderDate });
    return prisma.client.job.deleteMany({
        where: {
            start_time: {
                lt: new Date(olderDate)
            }
        }
    });
}

async function getJobCountByStatus(
    accountId: string,
    credentialsId: string,
    region: string,
    startTime: number,
    endTime: number
) {
    logger.info('Getting Job Count By Status', { accountId, credentialsId, region, startTime, endTime });

    accountId = checkAccount(accountId);

    return prisma.client.job.groupBy({
        where: {
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            parent_job_id: null,
            start_time: {
                gte: new Date(startTime),
                lte: new Date(endTime)
            }
        },
        by: ['status'],
        _count: {
            _all: true
        }
    });
}

async function groupJobsByTimeAndStatus(
    accountId: string,
    credentialsId: string,
    region: string,
    startTime: number,
    endTime: number
) {
    logger.info('Group Jobs By Time And Status', { accountId, credentialsId, region, startTime, endTime });

    accountId = checkAccount(accountId);

    return prisma.client.job.groupBy({
        where: {
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            parent_job_id: null,
            end_time: {
                not: null
            },
            start_time: {
                gte: new Date(startTime),
                lte: new Date(endTime)
            }
        },
        by: ['end_time', 'status'],
        _count: {
            _all: true
        }
    });
}

export {
    countParentJobs,
    listJobs,
    listUniqueJob,
    createJobs,
    updateJob,
    deleteJobs,
    deleteJobsOfAccount,
    deleteOlderJobs,
    getJobCountByStatus,
    groupJobsByTimeAndStatus,
    createJob
};
