import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../../utils/logger';
import { prisma } from '../../utils/prisma-utils';
import { checkAccount } from './db';

const logger = getLogger();

interface readOnlyJob {
    account_id: string;
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
    parentJobId: string | null = null,
    sort: string = 'start_time',
    sortOrder: string = 'desc',
    initiator?: string,
    type?: JOBTYPE[],
    status?: JOBSTATUS[],
    startTime?: number,
    endTime?: number,
    pageSize?: number,
    nextToken?: string
) {
    logger.info('Listing jobs', {
        accountId,
        parentJobId,
        sort,
        sortOrder,
        initiator,
        type,
        status,
        startTime,
        endTime,
        pageSize,
        nextToken
    });

    accountId = checkAccount(accountId);

    return prisma.client.job.findMany({
        where: {
            account_id: accountId,
            parent_job_id: parentJobId,
            ...(type && { type: { in: type } }),
            ...(status && { status: { in: status } }),
            ...(initiator && { initiator }),
            ...(startTime !== undefined && {
                start_time: {
                    gte: new Date(startTime)
                }
            }),
            ...(endTime !== undefined && {
                end_time: {
                    lte: new Date(endTime)
                }
            })
        },
        orderBy: {
            [sort]: `${sortOrder}`
        },
        take: pageSize,
        ...(nextToken && {
            skip: 1,
            cursor: {
                id: nextToken
            }
        })
    });
}

async function listUniqueJob(accountId: string, jobId: string) {
    logger.info('List unique job', { accountId, jobId });
    accountId = checkAccount(accountId);

    return prisma.client.job.findUniqueOrThrow({
        where: {
            id: jobId
        }
    });
}
async function createJobs(accountId: string, jobs: readOnlyJob[]) {
    logger.info('Creating jobs', { accountId, jobs: jobs?.length });

    logger.debug('Bulk creating jobs', { jobs });

    accountId = checkAccount(accountId);

    // createMany doesnt return the records created, but only the count, it suits our current requirement, in future if ther is an ask to return the created record Ids, refer to comments in https://github.com/prisma/prisma/issues/8131
    return prisma.client.job.createMany({
        data: jobs,
        skipDuplicates: true
    });
}

async function updateJob(
    accountId: string,
    jobId: string,
    description?: string,
    status?: JOBSTATUS,
    endTime?: number,
    error?: string
) {
    logger.info('Updating a job', { accountId, jobId, description, status, endTime, error });

    accountId = checkAccount(accountId);

    return prisma.client.job.update({
        where: {
            id: jobId
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

async function getJobCountByStatus(accountId: string, startTime: number, endTime: number) {
    logger.info('Getting Job Count By Status', { accountId, startTime, endTime });

    return prisma.client.job.groupBy({
        where: {
            account_id: accountId,
            parent_job_id: null,
            start_time: {
                gte: new Date(startTime)
            },
            end_time: {
                lte: new Date(endTime)
            }
        },
        by: ['status'],
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
    getJobCountByStatus
};
