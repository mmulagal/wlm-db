import createError from 'http-errors';
import { deploymentJobsCount } from '../lib/database/db';
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
    const currentDate = new Date();
    const fromDate = new Date(currentDate.getTime() - duration * 24 * 60 * 60 * 1000);

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
            failed: formattedCounts.CREATE_FAILED || 0
        };
    } catch (error) {
        logger.error('Unable to get deployment jobs counr:', error);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Unable to get deployment jobs counr: ${error}`);
    }
}

export { getDeploymentJobsCount };
