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
    updateJob,
    createJob,
    listLongRunningJobs,
    listLongRunningResourcePrepareJobs
} from '../../lib/database/job';
import getLogger from '../../utils/logger';
import { trimAccountIdForDemo } from './database-operations';
import {
    JobRecordType,
    JobSummaryByTimeRecordType,
    JobSummaryResponseType,
    ListJobsQueryType,
    JobSummaryQueryType
} from '../../routes/types/jobs.types';
import { GERERIC_JOB_ERROR_MESSAGE, JOBS_DEFAULT_TIME_RANGE } from '../../utils/consts';
import { getNextToken, getRegionDetails, isDemo, sleep } from '../../utils/utils';
import { RegionDetailsType } from '../../routes/types/generic.types';

const logger = getLogger();
const isDemoFlow = isDemo();

interface Job extends JobRecordType {
    id: string;
    accountId: string;
    credentialsId: string;
    region: RegionDetailsType;
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

interface UpdateJobRecord {
    status: string;
    description?: string;
    endTime?: number;
    error?: string;
    metadata?: any;
}

type JobWithSubJobsDbSchema = jobDbSchema & { subJobs?: jobDbSchema[] };

function formatJob(job: JobWithSubJobsDbSchema): JobWithSubJobs {
    const {
        id,
        account_id: accountId,
        credentials_id: credentialsId,
        region,
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
        subJobs,
        metadata
    } = job;

    return {
        id,
        accountId,
        credentialsId,
        ...{ region: getRegionDetails(region) },
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
        ...(subJobs && subJobs.length && { subJobs: subJobs.map(formatJob) }),
        ...(metadata && { metadata })
    };
}

function isValidStartTime(startTime: number) {
    return Number(startTime) && !Number.isNaN(Number(startTime));
}

function formatJobDbSchema(accountId: string, credentialsId: string, region: string, job: JobRecordType) {
    const {
        type,
        status,
        resourceName,
        name,
        description,
        error,
        startTime,
        endTime,
        initiator,
        parentJobId,
        metadata
    } = job;
    return {
        account_id: accountId,
        credentials_id: credentialsId,
        region,
        type: type as JOBTYPE,
        status: status as JOBSTATUS,
        resource_name: resourceName,
        name,
        description,
        error,
        start_time: isValidStartTime(startTime) ? new Date(startTime) : new Date(),
        initiator,
        end_time: endTime ? new Date(endTime) : undefined,
        parent_job_id: parentJobId || undefined,
        metadata
    };
}

async function registerJobs(
    accountId: string,
    credentialsId: string | undefined = '',
    region: string | undefined = '',
    jobs: JobRecordType[] | []
) {
    logger.info('Registering jobs', { accountId, credentialsId, region, jobs: jobs?.length });
    logger.debug('Bulk creating jobs', jobs);
    if (isEmpty(jobs)) {
        const errMsg = 'No jobs to register';
        logger.error(errMsg);
        throw createError(400, errMsg);
    }
    const jobsToCreate = jobs.map(job => formatJobDbSchema(accountId, credentialsId, region, job));
    return createJobs(accountId, jobsToCreate);
}

async function registerJob(accountId: string, credentialsId: string, region: string, job: JobRecordType) {
    logger.info('Registering job', { accountId, credentialsId, region, job });

    const jobToCreate = await createJob(accountId, formatJobDbSchema(accountId, credentialsId, region, job));
    return formatJob(jobToCreate);
}

async function getJobs(accountId: string, filterParams: ListJobsQueryType = {}) {
    logger.info(' Get jobs', { accountId, filterParams });
    const {
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
        limit = isDemoFlow ? undefined : 50,
        nextToken,
        includeSubJobs = false,
        resourceName
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
        credentialsId,
        region,
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
        nextToken,
        resourceName
    );

    const {
        _count: { id: totalParentJobIdCount }
    } = await countPromise;
    const records = await listPromise;

    if (includeSubJobs) {
        await Promise.all(
            (records || []).map(async (record: JobWithSubJobsDbSchema) => {
                const allLevelSubJobs = await getSubJobs(accountId, record.id, credentialsId, region);
                record.subJobs = allLevelSubJobs;
            })
        );
    }

    const jobs = trimAccountIdForDemo(records);
    const items = isEmpty(jobs) ? [] : jobs.map(formatJob);
    return {
        count: items?.length,
        items,
        ...(!isDemoFlow && { nextToken: getNextToken(items, totalParentJobIdCount, limit || 50) })
    };
}

async function getJobDetails(accountId: string, jobId: string, credentialsId?: string, region?: string) {
    logger.info(' Get job details', { accountId, credentialsId, region, jobId });

    try {
        const record = await listUniqueJob(accountId, credentialsId, region, jobId);
        const [job] = trimAccountIdForDemo([record]);
        job.subJobs = [];

        const formattedJob = formatJob(job);
        const subJobsDbSchema = await getSubJobs(accountId, jobId, credentialsId, region); // 2nd arg in listJobs is parentJObId, the idea here is to list all subs of a jobId in context. Hence passing down jobId as parentJobId
        let subJobs = trimAccountIdForDemo(subJobsDbSchema);
        subJobs = isEmpty(subJobs) ? [] : subJobs.map(formatJob);

        const response = {
            ...formattedJob,
            subJobs
        };

        return response;
    } catch (error) {
        logger.error('Error while getting job details', error);
        throw createError(404, `Job with ID ${jobId} not found in ${accountId}`);
    }
}

async function getSubJobs(
    accountId: string,
    jobId: string,
    credentialsId?: string,
    region?: string,
    flatten: boolean = false
) {
    logger.info('Get subjobs', { accountId, credentialsId, region, jobId });

    const subJobs = await listJobs(accountId, credentialsId, region, jobId);
    await Promise.all(
        (subJobs || []).map(async (subJob: JobWithSubJobsDbSchema) => {
            const { id } = subJob;
            if (flatten) {
                subJobs.concat(await getSubJobs(accountId, id, credentialsId, region));
            } else {
                subJob.subJobs = await getSubJobs(accountId, id, credentialsId, region);
            }
        })
    );
    return subJobs;
}

async function updateJobDetails(accountId: string, jobId: string, params: UpdateJobRecord) {
    const { description, status, endTime, error, metadata } = params;
    logger.info(' Modifying job details', {
        accountId,
        jobId,
        description,
        status,
        endTime,
        error
    });
    const response = await updateJob(accountId, jobId, description, status as JOBSTATUS, endTime, error, metadata);
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

async function getJobSummary(accountId: string, filters: JobSummaryQueryType): Promise<JobSummaryResponseType> {
    logger.info('Getting job summary', { accountId, ...filters });

    let { credentialsId = undefined, region = undefined, startTime, endTime } = filters;

    if (startTime && endTime && startTime > endTime) {
        throw createError(400, 'Start time cannot be greater than end time');
    }

    // Default time range is 30 days
    startTime = startTime || Date.now() - ms(JOBS_DEFAULT_TIME_RANGE);
    endTime = endTime || Date.now();

    const groups = await getJobCountByStatus(accountId, credentialsId, region, startTime, endTime);

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
    query: JobSummaryQueryType
): Promise<JobSummaryByTimeRecordType[]> {
    logger.info('Getting job summary by time', { accountId, ...query });

    let { credentialsId = undefined, region = undefined, startTime = undefined, endTime = undefined } = query;
    if (startTime && endTime && startTime > endTime) {
        throw createError(400, 'Start time cannot be greater than end time');
    }

    // Default time range is 30 days
    startTime = startTime || Date.now() - ms(JOBS_DEFAULT_TIME_RANGE);
    endTime = endTime || Date.now();

    const groups = (await groupJobsByTimeAndStatus(accountId, credentialsId, region, startTime, endTime)) as JobGroup[];

    return groups.map((group: JobGroup) => {
        const status = camelCase(group?.status?.toLowerCase());
        const count = group?._count?._all;
        const endtime = new Date(group.end_time!)?.valueOf();

        return { endTime: endtime, [status]: count };
    });
}

async function getLongRunningJobsAndSubjobs() {
    let runningJobs = await listLongRunningJobs();
    await Promise.all(
        runningJobs.map(async masterJob => {
            const subjobs = await getSubJobs(
                masterJob.account_id,
                masterJob.id,
                masterJob.credentials_id,
                masterJob.region,
                true
            );
            runningJobs = runningJobs.concat(subjobs);
        })
    );
    return runningJobs;
}

async function updateLongRunningJobs() {
    logger.info('Checking for long running (> 4 HOURS) parent deployment jobs');
    const runningJobs = await getLongRunningJobsAndSubjobs();
    try {
        await Promise.all(
            runningJobs.map(async runningJob => {
                logger.info('Marking job as failed ', runningJob.name);
                if (runningJob.end_time === null || runningJob.end_time === undefined) {
                    updateJobDetails(runningJob.account_id, runningJob.id, {
                        status: JOBSTATUS.FAILED,
                        endTime: new Date().valueOf(),
                        error: 'Stack creation failed. Check cloud formation for failure reason.'
                    });
                }
            })
        );
    } catch (error) {
        logger.info('Error while marking job as failed ', error);
    }
}

async function updateLongRunningResourcePrepareJobs() {
    logger.info('Checking for long running (> 1 hour) resource prepare jobs');
    const runningJobs = await listLongRunningResourcePrepareJobs();
    try {
        await Promise.all(
            runningJobs.map(async runningJob => {
                logger.info('Marking resource prepare job as failed: ', runningJob.name);
                updateJobDetails(runningJob.account_id, runningJob.id, {
                    status: JOBSTATUS.FAILED,
                    endTime: new Date().valueOf(),
                    error: 'Resource preparation failed due to timeout.'
                });
            })
        );
    } catch (error) {
        logger.info('Error while marking job as failed ', error);
    }
}

async function updateParentJobStatus(
    accountId: string,
    parentId: string,
    isSandboxJob: boolean = false,
    errorMsg?: string,
    jobMetadata?: any
) {
    logger.info('Updating parent job', { accountId, parentId, isSandboxJob });

    const parentJob = await getJobDetails(accountId, parentId);

    if (parentJob.status === JOBSTATUS.COMPLETED || parentJob.status === JOBSTATUS.FAILED) {
        return parentJob.status;
    }

    while (parentJob.status === JOBSTATUS.IN_PROGRESS) {
        // eslint-disable-next-line no-await-in-loop
        const allSubJobs = await listJobs(accountId, '', '', parentId);

        let jobStatus: JOBSTATUS = JOBSTATUS.IN_PROGRESS;

        if (allSubJobs.length) {
            if (allSubJobs.some(job => job.status === JOBSTATUS.IN_PROGRESS)) {
                jobStatus = JOBSTATUS.IN_PROGRESS;
            } else if (allSubJobs.every(job => job.status === JOBSTATUS.FAILED)) {
                jobStatus = JOBSTATUS.FAILED;
            } else if (allSubJobs.every(job => job.status === JOBSTATUS.COMPLETED)) {
                jobStatus = errorMsg ? JOBSTATUS.WARNING : JOBSTATUS.COMPLETED;
            } else if (
                isSandboxJob &&
                allSubJobs.some(
                    job => job.status === JOBSTATUS.FAILED && job.name?.includes('Clean up resources for sandbox')
                )
            ) {
                jobStatus = JOBSTATUS.WARNING;
            } else if (isSandboxJob && allSubJobs.some(job => job.status === JOBSTATUS.FAILED)) {
                jobStatus = JOBSTATUS.FAILED;
            } else if (allSubJobs.some(job => job.status === JOBSTATUS.FAILED || job.status === JOBSTATUS.WARNING)) {
                jobStatus = JOBSTATUS.WARNING;
            } else {
                jobStatus = JOBSTATUS.IN_PROGRESS;
            }
        } else {
            jobStatus = errorMsg ? JOBSTATUS.FAILED : JOBSTATUS.COMPLETED;
        }

        let errorField = {};
        if (errorMsg) {
            errorField = { error: errorMsg };
        } else if (jobStatus === JOBSTATUS.FAILED) {
            errorField = { error: GERERIC_JOB_ERROR_MESSAGE };
        }

        const modifiedJobData = {
            status: jobStatus,
            endTime: Date.now(),
            ...errorField,
            metadata: jobMetadata || parentJob.metadata || {}
        };

        if (jobStatus !== JOBSTATUS.IN_PROGRESS) {
            // eslint-disable-next-line no-await-in-loop
            await updateJobDetails(accountId, parentId, modifiedJobData);
            return jobStatus;
        }

        // eslint-disable-next-line no-await-in-loop
        await sleep(30000);
    }
}

export {
    Job,
    registerJobs,
    getJobs,
    getJobDetails,
    updateJobDetails,
    deleteJobsWithAllSubJobs,
    getJobSummary,
    getJobSummaryByTime,
    registerJob,
    updateLongRunningJobs,
    updateLongRunningResourcePrepareJobs,
    updateParentJobStatus
};
