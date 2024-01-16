import config from 'config';
import ms from 'ms';
import { deleteOlderJobs } from '../lib/database/job';
import getLogger from '../utils/logger';

const logger = getLogger();

export default function purgeOlderJobs() {
    logger.info('Purging older jobs');

    const purgeInterval = ms(config.get('db.jobs.purge.interval'));
    const purgeThresholdDays = ms(config.get('db.jobs.purge.older-than')); // in days

    const date = new Date();
    date.setDate(date.getDate() - Number(purgeThresholdDays));
    setInterval(async () => deleteOlderJobs(date), Number(purgeInterval));
}
