import createError from 'http-errors';
import { deploymentJobsCount } from '../lib/database/db';
import { DEPLOYMENT_JOBS_STATUS_FILTER, HttpErrorCodes } from '../utils/consts';
import getLogger from '../utils/logger';

const logger = getLogger();

async function getDeploymentJobsCount(accountId: string, duration: number) {
    logger.debug(
        'Getting deployment status job count based on filter',
        accountId,
        duration,
        DEPLOYMENT_JOBS_STATUS_FILTER
    );
    const currentDate = new Date();
    const fromDate = new Date(currentDate.getTime() - duration * 24 * 60 * 60 * 1000);
    const resp = await deploymentJobsCount(accountId, fromDate, DEPLOYMENT_JOBS_STATUS_FILTER);
    try {
        // eslint-disable-next-line camelcase
        const formattedCounts = resp.reduce((count, { deployment_status, _count }) => {
            // eslint-disable-next-line camelcase
            count[deployment_status] = _count.deployment_status;
            return count;
        }, {} as { [key: string]: number });

        return {
            success: formattedCounts.UPDATE_COMPLETE + formattedCounts.CREATE_COMPLETE,
            initializing: formattedCounts.CREATE_IN_PROGRESS + formattedCounts.UPDATE_IN_PROGRESS,
            failed: formattedCounts.CREATE_FAILED
        };
    } catch (error) {
        logger.error('Unable to get deployment jobs counr:', error);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Unable to get deployment jobs counr: ${error}`);
    }
}

export { getDeploymentJobsCount };
