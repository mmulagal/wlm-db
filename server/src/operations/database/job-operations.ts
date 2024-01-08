import createError from 'http-errors';
import { JOBSTATUS, job } from "@prisma/client";
import { createJobs, deleteJobs, listJobs, listUniqueJob, modifyJob } from "../../lib/database/job";
import getLogger from '../../utils/logger';
import { trimAccountIdForDemo } from "./database-operations";
import { isEmpty } from 'lodash-es';
import moment from 'moment';
const logger = getLogger();

interface Job {
    id: string,
    accountId: string,
    name: string,
    description?: string | undefined,
    resourceName: string,
    initiator: string,
    startTime: number,
    endTime?: number,
    error?: string,
    parentJobId?: string,
    type: string,
    status: JOBSTATUS
}
interface JobRecord {
    accountId: string,
    name: string,
    description?: string | undefined,
    resourceName: string,
    initiator: string,
    startTime: number,
    endTime?: number,
    error?: string,
    parentJobId?: string,
    type: string,
    status: JOBSTATUS
}


function formatJob(job: job) {
    const { id, account_id, type, status, resource_name, name, description, error, start_time, initiator, end_time, parent_job_id } = job;
    return {
        id,
        accountId: account_id,
        type,
        status,
        resourceName: resource_name,
        name,
        ...description && { description },
        ...error && { error },
        startTime: moment(start_time).unix() * 1000,
        ...end_time && { endTime: moment(end_time).unix() * 1000 },
        initiator,
        ...parent_job_id && { parentJobId: parent_job_id }
    }
}

function formatJobDbSchema(job: JobRecord) {
    const { accountId, type, status, resourceName, name, description, error, startTime, endTime, initiator, parentJobId } = job;
    return {
        account_id: accountId, type, status: status as JOBSTATUS, resource_name: resourceName, name, description, error, start_time: new Date(startTime), initiator, end_time: endTime ? new Date(endTime) : undefined, parent_job_id: parentJobId
    }
}

async function registerJobs(
    accountId: string,
    jobs: JobRecord[] | []
) {
    logger.info('Registering jobs', { accountId, jobs: jobs?.length });
    logger.debug('Bulk creating jobs', jobs);
    if (isEmpty(jobs)) {
        const errMsg = 'No jobs to register';
        logger.error(errMsg);
        throw createError(400, errMsg)
    }
    const jobsToCreate = jobs.map(formatJobDbSchema);
    return createJobs(accountId, jobsToCreate);
}

async function getJobs(
    accountId: string,
    parentJobId?: string,
    sort?: string,
    sortOrder?: string,
    initiator?: string,
    type?: string,
    status?: string,
    startTime?: number,
    endTime?: number,
    pageSize: number = 50,
    nextToken?: string
) {
    logger.info(' Get jobs', { accountId, parentJobId, sort, sortOrder, initiator, type, status, startTime, endTime, pageSize, nextToken });

    let typeFilter;
    if (type) {
        typeFilter = type.split(',');
    }

    let statusFilter;
    if (status) {
        statusFilter = status.split(',') as JOBSTATUS[];
    }

    const records = await listJobs(accountId, parentJobId, sort, sortOrder, initiator, typeFilter, statusFilter, startTime, endTime, pageSize, nextToken);

    const jobs = trimAccountIdForDemo(records);
    const items = isEmpty(jobs) ? [] : jobs.map(formatJob);
    return {
        count: items?.length,
        items,
        nextToken: items?.length > 0 ? items[items.length - 1].id : undefined
    }

}

async function getJobDetails(
    accountId: string,
    jobId: string,
) {
    logger.info(' Get job details', { accountId, jobId });

    const record = await listUniqueJob(accountId, jobId)
    const [job] = trimAccountIdForDemo([record]);
    job.subJobs = [];

    let subJobs = await listJobs(accountId, jobId);
    if (isEmpty(subJobs)) {
        return job;
    }
    subJobs = trimAccountIdForDemo(subJobs);
    job.subJobs = subJobs
    return job;
}


async function modifyJobDetails(
    accountId: string, jobId: string, description?: string, status?: JOBSTATUS, endTime?: number, error?: string
) {
    logger.info(' Modifying job details', { accountId, jobId, description, status, endTime, error });
    const response = await modifyJob(accountId, jobId, description, status, endTime, error);
    if (response) {
        return formatJob(response);
    }
    throw createError(`Failed to modify job with ID ${jobId} in ${accountId}. Please ensure the Job ID is correct.`)

}

async function deleteJobsWithAllSubJobs(
    accountId: string, jobId: string
) {
    logger.info(' Deleting jobs with all its subjobs', { accountId, jobId });
    const allLevelJobs = await getAllDependantJobs(accountId, jobId);
    let jobIdsToDelete = [jobId];

    if (allLevelJobs?.subJobs) {
        const level2Jobs = allLevelJobs?.subJobs as Job[];
        const level3JobIds = level2Jobs.map(({ id }) => id);
        jobIdsToDelete = jobIdsToDelete.concat(level3JobIds);
    }

    return deleteJobs(accountId, jobIdsToDelete);
}


async function getAllDependantJobs(accountId: string, jobId: string) {
    const parentJobDetails = await getJobDetails(accountId, jobId);
    if (parentJobDetails?.subJobs?.length) {
        for (const subJob of parentJobDetails?.subJobs) {
            const { subJobs: level3Jobs } = await getJobDetails(accountId, subJob.id);

            subJob.subJobs = level3Jobs;

        }
    }
    return parentJobDetails;
}

export {
    Job,
    registerJobs,
    getJobs,
    getJobDetails,
    modifyJobDetails,
    deleteJobsWithAllSubJobs
}