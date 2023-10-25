import createError from 'http-errors';
import moment from 'moment';
import { isEmpty } from 'lodash-es';
import { DEPLOYMENT_STATUS } from '@prisma/client';
import { JSONObject } from '@fastify/swagger';
import { deploymentJobsCount, listDeployments } from '../lib/database/db';
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

        const result = resp.map(item => ({
            deploymentStatus: item.deployment_status,
            count: item._count.deployment_status
        }));

        const formattedCounts = result.reduce((counts, { deploymentStatus, count }) => {
            counts[deploymentStatus] = count;
            return counts;
        }, {} as { [key: string]: number });

        return {
            success: (formattedCounts.UPDATE_COMPLETE || 0) + (formattedCounts.CREATE_COMPLETE || 0),
            initializing: (formattedCounts.CREATE_IN_PROGRESS || 0) + (formattedCounts.UPDATE_IN_PROGRESS || 0),
            failed: (formattedCounts.CREATE_FAILED || 0) + (formattedCounts.UPDATE_FAILED || 0)
        };
    } catch (error) {
        logger.error('Unable to get deployment jobs counr:', error);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Unable to get deployment jobs counr: ${error}`);
    }
}

async function getDeploymentJobsSummary(accountId: string, statuses?: string) {
    logger.info('Getting deployment jobs summary based on statuses', accountId, statuses);

    let deploymentStatuses: Array<DEPLOYMENT_STATUS> | undefined;

    if (statuses) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        deploymentStatuses = statuses?.toUpperCase()?.replace(/\s+/g, '')?.split(',') as Array<DEPLOYMENT_STATUS>;
    }
    const deploymentDetails = await listDeployments(accountId, undefined, undefined, deploymentStatuses);

    if (isEmpty(deploymentDetails)) {
        throw createError(
            HttpErrorCodes.NOT_FOUND,
            `No deployments found for account ${accountId} with statuses ${statuses}`
        );
    }
    try {
        const response = deploymentDetails.map(
            ({
                deployment_id: id,
                deployment_status: status,
                deployment_model: deploymentModel,
                region: deploymentRegion,
                metadata
            }) => ({
                id,
                name: (metadata as JSONObject).resourceName as string,
                status,
                metadata: {
                    region: deploymentRegion,
                    serverType: (metadata as JSONObject).databaseType as string,
                    fileSystemType: (metadata as JSONObject).fileSystemType as string,
                    serverInstallationMode: deploymentModel === null ? 'null' : deploymentModel
                }
            })
        );

        return { count: response.length, items: response, nextToken: '' };
    } catch (error) {
        logger.error(error);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Error fetching deployment jobs summary ${error}`);
    }
}

export { getDeploymentJobsCount, getDeploymentJobsSummary };
