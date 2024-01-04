import { JOBSTATUS, job } from '@prisma/client';
import getLogger from '../../utils/logger';
import { prisma } from '../../utils/prisma-utils';
import { checkAccount } from './db';

const logger = getLogger();

async function listJobs(
    accountId: string,
    parentJobId?: string,
    sort?: string,
    sortOrder?: string,
    initiator?: string,
    type?: [string],
    status?: [JOBSTATUS],
    startTime?: number,
    endTime?: number,
    pageSize?: number,
    nextToken?: string
) {
    logger.info('Listing jobs', { accountId, parentJobId, sort, sortOrder, initiator, type, status, startTime, endTime, pageSize, nextToken });

    accountId = checkAccount(accountId);

    sort = sort || 'start_time';
    sortOrder = sortOrder || 'desc';
    return prisma.client.job.findMany({
        where: {
            account_id: accountId,
            ...parentJobId && { parent_job_id: parentJobId },
            ...type && { type: { in: type } },
            ...status && { status: { in: status } },
            ...initiator && { initiator },
            ...(startTime !== undefined) && {
                start_time: {
                    gte: new Date(startTime)
                }
            },
            ...(endTime !== undefined) && {
                end_time: {
                    lte: new Date(endTime)
                }
            }
        },
        orderBy: {
            [sort]: `${sortOrder}`
        },
        take: pageSize,
        ...nextToken && {
            skip: 1,
            cursor: {
                id: nextToken
            }
        }
    })
}

async function createJobs(accountId: string, jobs: [job]) {
    logger.info('Creating jobs', { accountId, jobs: jobs?.length });

    logger.debug('Bulk creating jobs', { jobs });

    accountId = checkAccount(accountId);

    return prisma.client.job.createMany({
        data: jobs,
        skipDuplicates: true
    })
}

async function modifyJob(accountId: string, jobId: string, description?: string, status?: JOBSTATUS, endTime?: number, error?: string) {
    logger.info('Modifying a job', { accountId, jobId, description, status, endTime, error });


    accountId = checkAccount(accountId);

    return prisma.client.job.update({
        where: {
            id: jobId,
        },
        data: {
            ...description && { description },
            ...status && { status },
            ...endTime && { end_time: new Date(endTime) },
            ...error && { error }
        }
    })
}

async function deleteJobs(accountId: string, jobId: [string]) {
    logger.info('Deleting jobs and its first level sub jobs', { accountId, jobId });


    accountId = checkAccount(accountId);

    return prisma.client.job.deleteMany({
        where: {
            OR: [{
                id: { in: jobId }
            },
            {
                account_id: accountId,
                parent_job_id: { in: jobId }
            }]
        }
    })
}
export {
    listJobs,
    createJobs,
    modifyJob,
    deleteJobs
};
