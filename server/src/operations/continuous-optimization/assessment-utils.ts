import { JOBSTATUS } from '@prisma/client';
import createError from 'http-errors';
import moment from 'moment';
import { getJobs, registerJob } from '../database/job-operations';
import { getTimeDifferenceInMinutes } from '../../utils/utils';
import { updateLongRunningAuditGroup } from '../cloud-manager/audit-operations';
import { AssessmentStatus } from '../../utils/continous-optimization-consts';
import getLogger from '../../utils/logger';
import { listResources } from '../../lib/database/db';
import { Metadata } from '../../utils/common-types';
import { listDatabaseInstanceConfigData } from '../../lib/database/database-instance-config';

const logger = getLogger();

interface PerHostJobMetadata {
    optimizationType: string;
    resourceId: string;
    sqlServerInstances: Array<string>;
}
interface JobMetadata {
    hostsToOptimize: Array<PerHostJobMetadata>;
}

function getMatchingAssessmentStatus(finding: string) {
    logger.info('Getting matching assessment status for finding:', finding);
    switch (finding) {
        case 'NOT_OPTIMIZED':
            return AssessmentStatus.NOT_OPTIMIZED;
        case 'OVER_PROVISIONED':
            return AssessmentStatus.OVER_PROVISIONED;
        case 'UNDER_PROVISIONED':
            return AssessmentStatus.UNDER_PROVISIONED;
        case 'OPTIMIZED':
        default:
            return AssessmentStatus.OPTIMIZED;
    }
}

async function handleOptimizeJobCreation(
    accountId: string,
    credentialsId: string,
    region: string,
    serverNameWithHostName: string,
    jobType: string,
    jobName: string,
    jobDescription: string,
    parentJobId?: string,
    jobMetadata?: JobMetadata
) {
    updateLongRunningAuditGroup(undefined, undefined, serverNameWithHostName);

    const filterParams = {
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName as string,
        typeFilter: jobType,
        region,
        credentialsId,
        ...(parentJobId && { parentJobId })
    };
    const {
        items: [job]
    } = await getJobs(accountId, filterParams);

    if (job) {
        const timeDifferenceInMinutes = getTimeDifferenceInMinutes(job.startTime);
        if (timeDifferenceInMinutes <= 5) {
            throw createError(
                412,
                `The following optimization is running: Job ID:  ${job.id}. Wait until it completes.`
            );
        }
    }

    // create the parent job for optimize operation
    const { id } = await registerJob(accountId, credentialsId, region, {
        type: jobType,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName as string,
        name: jobName,
        startTime: Date.now(),
        description: jobDescription,
        ...(parentJobId && { parentJobId }),
        ...(jobMetadata && { metadata: jobMetadata })
    });
    logger.debug(`Job created with id ${id}`);

    return id;
}

async function getLastAssessedTime(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    const [[{ creation_time: latestInstanceLevelAssessedTime } = {}], [{ metadata = {} } = {}]] = await Promise.all([
        listDatabaseInstanceConfigData(accountId, region, credentialsId, databaseHostId, databaseInstanceId),
        listResources(accountId, databaseHostId, credentialsId, region)
    ]);

    const { assessment: { lastAssessedDate: latestHostLevelAssessedTime } = {} } = metadata as unknown as Metadata;
    const latestAssessmentTimestamp = Math.max(
        latestInstanceLevelAssessedTime ? latestInstanceLevelAssessedTime.getTime() : 0,
        latestHostLevelAssessedTime ? Number(latestHostLevelAssessedTime) : 0
    );

    return moment(Number(latestAssessmentTimestamp)).unix() * 1000;
}

export { getMatchingAssessmentStatus, handleOptimizeJobCreation, JobMetadata, getLastAssessedTime };
