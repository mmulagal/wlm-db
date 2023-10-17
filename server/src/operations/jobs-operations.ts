import createError from 'http-errors';
import moment from 'moment';
import { isEmpty } from 'lodash-es';
import { DEPLOYMENT_STATUS } from '@prisma/client';
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

async function getDeploymentJobsSummary(accountId: string, status?: string) {
    logger.info('Getting deployment jobs summary based on statuses', accountId, status);

    let deploymentStatuses: Array<DEPLOYMENT_STATUS> | undefined;

    if (status) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        deploymentStatuses = status?.replace(/\s+/g, '')?.split(',') as Array<DEPLOYMENT_STATUS>;
    } else {
        deploymentStatuses = undefined;
    }
    const deploymentDetails = await listDeployments(accountId, undefined, undefined, deploymentStatuses);

    if (isEmpty(deploymentDetails)) {
        throw createError(
            HttpErrorCodes.NOT_FOUND,
            `No deployments found for account ${accountId} with statuses ${status}`
        );
    }
    try {
        const response = deploymentDetails.map(item => ({
            deploymentId: item.deployment_id,
            deploymentStatus: item.deployment_status,
            deploymentModel: item.deployment_model,
            region: item.region,
            data: item.data
        }));

        const extractedValues = response.map(({ deploymentId, deploymentStatus, deploymentModel, region, data }) => ({
            id: deploymentId,
            name: (data as any).resourceName,
            status: deploymentStatus,
            metadata: {
                region: region!,
                serverType: (data as any).databaseType,
                fileSystemType: (data as any).fileSystemType,
                serverInstallationMode: deploymentModel
            }
        }));

        const responseValue = { count: extractedValues.length, items: extractedValues, nextToken: '' };
        return responseValue;
    } catch (error) {
        logger.error(error);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Error fetching deployment jobs summary ${error}`);
    }
}

export { getDeploymentJobsCount, getDeploymentJobsSummary };
