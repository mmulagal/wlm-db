import Ajv, { ValidateFunction } from 'ajv';
import { JOBSTATUS } from '@prisma/client';
import createError from 'http-errors';
import { getJobs, registerJob } from '../database/job-operations';
import { getTimeDifferenceInMinutes } from '../../utils/utils';
import { updateLongRunningAuditGroup } from '../cloud-manager/audit-operations';
import { AssessmentCategoriesOracle, AssessmentStatus } from '../../utils/continous-optimization-consts';
import getLogger from '../../utils/logger';
import type { JobMetadata } from '../../utils/common-types';

const logger = getLogger();

const ajv = new Ajv();
const validatorCache = new WeakMap<object, ValidateFunction>();

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
        resourceName: serverNameWithHostName,
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
            throw createError(412, `A job is already in progress with ID: ${job.id}. Please wait for it to finish.`);
        }
    }

    // create the parent job for optimize operation
    const { id } = await registerJob(accountId, credentialsId, region, {
        type: jobType,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName,
        name: jobName,
        startTime: Date.now(),
        description: jobDescription,
        ...(parentJobId && { parentJobId }),
        ...(jobMetadata && { metadata: jobMetadata })
    });
    logger.debug(`Job created with id ${id}`);

    return id;
}

// Recursive function to check for any "not-optimized" status in the assessment results.
// It checks both arrays and objects, looking for the specific status in any nested structure.
// Returns true if any "not-optimized" status is found, otherwise false.
// This is used to determine if an instance has any assessment results that are not optimized.
function hasNotOptimizedStatus(obj: unknown): boolean {
    if (Array.isArray(obj)) {
        return obj.some(hasNotOptimizedStatus);
    }
    if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
        if (
            ('status' in obj && obj.status === AssessmentStatus.NOT_OPTIMIZED) ||
            ('errorMessage' in obj && !!obj.errorMessage)
        ) {
            return true;
        }
        return Object.values(obj).some(hasNotOptimizedStatus);
    }
    return false;
}

function getLatestInstanceAssessmentTime(
    databaseInstanceConfigData: { config_data_type: string; creation_time: Date }[]
) {
    return databaseInstanceConfigData
        .filter(config => config.config_data_type !== AssessmentCategoriesOracle.MAPPED_ONTAP_VOLUMES)
        .reduce((latest, { creation_time: currentCreationTime }) => {
            const creationTime = new Date(currentCreationTime || 0);
            return creationTime > latest ? creationTime : latest;
        }, new Date(0));
}

function validateAssessment(schema: object, assessmentData: unknown) {
    let validate = validatorCache.get(schema);

    if (!validate) {
        validate = ajv.compile(schema);
        validatorCache.set(schema, validate);
    }

    const isValid = validate(assessmentData);

    return {
        isValid,
        errors: validate.errors || []
    };
}

export {
    getMatchingAssessmentStatus,
    handleOptimizeJobCreation,
    hasNotOptimizedStatus,
    getLatestInstanceAssessmentTime,
    validateAssessment
};

// Re-export type for external usage without creating a runtime export
export type { JobMetadata };
