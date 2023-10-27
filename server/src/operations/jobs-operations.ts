import createError from 'http-errors';
import moment from 'moment';
import { isEmpty } from 'lodash-es';
import { DEPLOYMENT_STATUS } from '@prisma/client';
import { JSONObject } from '@fastify/swagger';
import { deploymentJobsCount, listDeployments, deleteDeploymentJobById } from '../lib/database/db';
import { DEPLOYMENT_JOBS_STATUS_FILTER, HttpErrorCodes } from '../utils/consts';
import getLogger from '../utils/logger';

const logger = getLogger();

async function getDeploymentJobsCount(accountId: string, duration: number = 90) {
    logger.info(
        'Getting deployment status job count based on filter',
        accountId,
        duration,
        DEPLOYMENT_JOBS_STATUS_FILTER
    );
    const currentDate = moment();
    const fromDate = moment(currentDate).subtract(duration, 'days').toDate();
    try {
        const resp = await deploymentJobsCount(accountId, fromDate, DEPLOYMENT_JOBS_STATUS_FILTER);
        const counts: Record<DEPLOYMENT_STATUS, number> = {} as Record<DEPLOYMENT_STATUS, number>;

        resp.reduce((acc, { deployment_status: deploymentStatus }) => {
            acc[deploymentStatus] = (acc[deploymentStatus] || 0) + 1;
            return acc;
        }, counts);

        return {
            success: (counts.UPDATE_COMPLETE || 0) + (counts.CREATE_COMPLETE || 0),
            initializing: (counts.CREATE_IN_PROGRESS || 0) + (counts.UPDATE_IN_PROGRESS || 0),
            failed: (counts.CREATE_FAILED || 0) + (counts.UPDATE_FAILED || 0)
        };
    } catch (error) {
        logger.error('Unable to get deployment jobs counr:', error);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Unable to get deployment jobs count: ${error}`);
    }
}

async function getDeploymentJobsSummary(accountId: string, statuses?: string) {
    logger.info('Getting deployment jobs summary based on statuses', accountId, statuses);

    let deploymentStatuses: Array<DEPLOYMENT_STATUS> | undefined;

    if (statuses) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        deploymentStatuses = statuses?.toUpperCase()?.replace(/\s+/g, '')?.split(',') as Array<DEPLOYMENT_STATUS>;
    }
    const deploymentDetails = await listDeployments(accountId, undefined, undefined, deploymentStatuses, true);

    if (isEmpty(deploymentDetails)) {
        throw createError(
            HttpErrorCodes.NOT_FOUND,
            `No deployments found for account ${accountId} with statuses ${statuses}`
        );
    }
    const response = deploymentDetails.map(
        ({
            id,
            deployment_id: deploymentId,
            deployment_status: status,
            deployment_model: deploymentModel,
            region: deploymentRegion,
            data: metaData
        }) => ({
            id,
            deploymentId,
            name: (metaData as JSONObject).resourceName as string,
            status,
            metadata: {
                region: deploymentRegion,
                serverType: (metaData as JSONObject).databaseType as string,
                fileSystemType: (metaData as JSONObject).fileSystemType as string,
                serverInstallationMode: deploymentModel === null ? 'N/A' : deploymentModel
            }
        })
    );

    return { count: response.length, items: response, nextToken: '' };
}

async function deleteDeploymentJob(accountId: string, jobId: string) {
    // eslint-disable-next-line no-console
    console.log(accountId, jobId);
    try {
        const response = await deleteDeploymentJobById(accountId, jobId);
        if (response.count === 1) {
            return { message: 'Resource successfully deleted' };
        }

        throw new Error('Resource does not exist for tenancy account');
    } catch (err: any) {
        logger.error('Failed to remove resource. Reason:', err.message);

        const errorMessage = 'Resource does not exist for tenancy account';
        const statusCode =
            err.message === errorMessage ? HttpErrorCodes.NOT_FOUND : HttpErrorCodes.INTERNAL_SERVER_ERROR;
        return createError(statusCode, err.message);
    }
}

export { getDeploymentJobsCount, getDeploymentJobsSummary, deleteDeploymentJob };
