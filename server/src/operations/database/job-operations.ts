import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE, job as jobDbSchema } from '@prisma/client';
import { camelCase, isEmpty } from 'lodash-es';
import moment from 'moment';
import ms from 'ms';
import {
    countParentJobs,
    createJobs,
    deleteJobs,
    getJobCountByStatus,
    groupJobsByTimeAndStatus,
    listJobs,
    listUniqueJob,
    updateJob
} from '../../lib/database/job';
import getLogger from '../../utils/logger';
import { trimAccountIdForDemo } from './database-operations';
import {
    JobRecordType,
    JobSummaryByTimeRecordType,
    JobSummaryResponseType,
    ListJobsQueryType,
    UpdateJobRecordType
} from '../../routes/types/jobs.types';
import { JOBS_DEFAULT_TIME_RANGE } from '../../utils/consts';

const logger = getLogger();

interface Job extends JobRecordType {
    id: string;
}
interface JobWithSubJobs extends Job {
    subJobs?: Job[];
}
interface JobSummary {
    [key: string]: number;
}
interface JobGroup {
    status: string;
    end_time?: Date;
    _count: {
        _all: number;
    };
}

interface JobSummaryByTime extends JobSummaryByTimeRecordType {
    [key: string]: number | undefined;
}

type JobWithSubJobsDbSchema = jobDbSchema & { subJobs?: jobDbSchema[] };

function formatJob(job: JobWithSubJobsDbSchema): JobWithSubJobs {
    const {
        id,
        account_id: accountId,
        type,
        status,
        resource_name: resourceName,
        name,
        description,
        error,
        start_time: startTime,
        initiator,
        end_time: endTime,
        parent_job_id: parentJobId,
        subJobs
    } = job;
    return {
        id,
        accountId,
        type,
        status,
        resourceName,
        name,
        ...(description && { description }),
        ...(error && { error }),
        startTime: moment(startTime).unix() * 1000,
        ...(endTime && { endTime: moment(endTime).unix() * 1000 }),
        initiator,
        ...(parentJobId && { parentJobId }),
        ...(subJobs && subJobs.length && { subJobs: subJobs.map(formatJob) })
    };
}

function isValidStartTime(startTime: number) {
    return Number(startTime) && !Number.isNaN(Number(startTime));
}

function formatJobDbSchema(job: JobRecordType) {
    const {
        accountId,
        type,
        status,
        resourceName,
        name,
        description,
        error,
        startTime,
        endTime,
        initiator,
        parentJobId
    } = job;
    return {
        account_id: accountId,
        type: type as JOBTYPE,
        status: status as JOBSTATUS,
        resource_name: resourceName,
        name,
        description,
        error,
        start_time: isValidStartTime(startTime) ? new Date(startTime) : new Date(),
        initiator,
        end_time: endTime ? new Date(endTime) : undefined,
        parent_job_id: parentJobId || undefined
    };
}

async function registerJobs(accountId: string, jobs: JobRecordType[] | []) {
    logger.info('Registering jobs', { accountId, jobs: jobs?.length });
    logger.debug('Bulk creating jobs', jobs);
    if (isEmpty(jobs)) {
        const errMsg = 'No jobs to register';
        logger.error(errMsg);
        throw createError(400, errMsg);
    }
    const jobsToCreate = jobs.map(formatJobDbSchema);
    return createJobs(accountId, jobsToCreate);
}

async function getJobs(accountId: string, filterParams: ListJobsQueryType = {}) {
    logger.info(' Get jobs', { accountId, filterParams });
    const {
        parentJobId,
        sort,
        sortOrder,
        initiator,
        type,
        status,
        startTime,
        endTime,
        limit = 50,
        nextToken,
        includeSubJobs = false
    } = filterParams;

    let typeFilter;
    if (type) {
        typeFilter = type.split(',') as JOBTYPE[];
    }

    let statusFilter;
    if (status) {
        statusFilter = status.split(',') as JOBSTATUS[];
    }

    const countPromise = countParentJobs(accountId);
    const listPromise = listJobs(
        accountId,
        parentJobId,
        sort,
        sortOrder,
        initiator,
        undefined,
        typeFilter,
        statusFilter,
        startTime,
        endTime,
        limit,
        nextToken
    );

    const {
        _count: { id: totalParentJobIdCount }
    } = await countPromise;
    const records = await listPromise;

    if (includeSubJobs) {
        await Promise.all(
            (records || []).map(async (record: JobWithSubJobsDbSchema) => {
                const allLevelSubJobs = await getSubJobs(accountId, record.id);
                record.subJobs = allLevelSubJobs;
            })
        );
    }

    const jobs = trimAccountIdForDemo(records);
    const items = isEmpty(jobs) ? [] : jobs.map(formatJob);
    return {
        count: items?.length,
        items,
        nextToken: totalParentJobIdCount > limit && records.length >= limit ? items[items.length - 1].id : undefined
    };
}

async function getJobDetails(accountId: string, jobId: string) {
    logger.info(' Get job details', { accountId, jobId });

    const record = await listUniqueJob(accountId, jobId);
    const [job] = trimAccountIdForDemo([record]);
    job.subJobs = [];

    const formattedJob = formatJob(job);
    const subJobsDbSchema = await getSubJobs(accountId, jobId); // 2nd arg in listJobs is parentJObId, the idea here is to list all subs of a jobId in context. Hence passing down jobId as parentJobId
    let subJobs = trimAccountIdForDemo(subJobsDbSchema);
    subJobs = isEmpty(subJobsDbSchema) ? [] : subJobsDbSchema.map(formatJob);

    const response = {
        ...formattedJob,
        subJobs
    };

    return response;
}

async function getSubJobs(accountId: string, jobId: string) {
    logger.info('Get subjobs', { accountId, jobId });

    const subJobs = await listJobs(accountId, jobId);
    await Promise.all(
        (subJobs || []).map(async (subJob: JobWithSubJobsDbSchema) => {
            const { id } = subJob;
            subJob.subJobs = await getSubJobs(accountId, id);
        })
    );
    return subJobs;
}

async function updateJobDetails(accountId: string, jobId: string, params: UpdateJobRecordType) {
    const { description, status, endTime, error } = params;
    logger.info(' Modifying job details', { accountId, jobId, description, status, endTime, error });
    const response = await updateJob(accountId, jobId, description, status as JOBSTATUS, endTime, error);
    if (response) {
        return formatJob(response);
    }
    throw createError(`Failed to modify job with ID ${jobId} in ${accountId}. Please ensure the Job ID is correct.`);
}

async function deleteJobsWithAllSubJobs(accountId: string, jobId: string) {
    logger.info(' Deleting jobs with all its subjobs', { accountId, jobId });
    const level2Jobs = await getSubJobs(accountId, jobId);
    let jobIdsToDelete = [jobId];
    if (level2Jobs.length > 0) {
        level2Jobs.forEach((level2Job: JobWithSubJobsDbSchema) => {
            const level3JobIds = level2Job?.subJobs?.map(({ id }: { id: string }) => id);
            if (level3JobIds && level3JobIds?.length > 0) {
                jobIdsToDelete = jobIdsToDelete.concat(level3JobIds);
            }
        });
    }

    return deleteJobs(accountId, jobIdsToDelete);
}

async function getJobSummary(
    accountId: string,
    startTime: number | undefined,
    endTime: number | undefined
): Promise<JobSummaryResponseType> {
    logger.info('Getting job summary', { accountId, startTime, endTime });

    if (startTime && endTime && startTime > endTime) {
        throw createError(400, 'Start time cannot be greater than end time');
    }

    // Default time range is 30 days
    startTime = startTime || Date.now() - ms(JOBS_DEFAULT_TIME_RANGE);
    endTime = endTime || Date.now();

    const groups = await getJobCountByStatus(accountId, startTime, endTime);

    const defaultSummary = Object.values(JOBSTATUS).reduce(
        (summary: JobSummary, status: string) => ({
            ...summary,
            [camelCase(status?.toLowerCase())]: 0
        }),
        {}
    );

    return groups.reduce((summary: JobSummary, group: JobGroup) => {
        const status = camelCase(group?.status?.toLowerCase());
        const count = group?._count?._all;
        return {
            ...summary,
            [status]: status in summary ? summary[status] + count : count
        };
    }, defaultSummary) as JobSummaryResponseType;
}

async function getJobSummaryByTime(
    accountId: string,
    startTime: number | undefined,
    endTime: number | undefined
): Promise<JobSummaryByTimeRecordType[]> {
    logger.info('Getting job summary by time', { accountId, startTime, endTime });

    if (startTime && endTime && startTime > endTime) {
        throw createError(400, 'Start time cannot be greater than end time');
    }

    // Default time range is 30 days
    startTime = startTime || Date.now() - ms(JOBS_DEFAULT_TIME_RANGE);
    endTime = endTime || Date.now();

    const groups = (await groupJobsByTimeAndStatus(accountId, startTime, endTime)) as JobGroup[];

    return groups.reduce((acc: JobSummaryByTime[], group: JobGroup) => {
        const status = camelCase(group?.status?.toLowerCase());
        const count = group?._count?._all;
        const endtime = new Date(group.end_time!)?.valueOf();

        const existingObj = acc.find(el => el.endTime === endtime);
        if (existingObj) {
            existingObj[status] = count;
        } else {
            acc.push({ endTime: endtime, [status]: count });
        }

        return acc;
    }, []);
}

export {
    Job,
    registerJobs,
    getJobs,
    getJobDetails,
    updateJobDetails,
    deleteJobsWithAllSubJobs,
    getJobSummary,
    getJobSummaryByTime
};
