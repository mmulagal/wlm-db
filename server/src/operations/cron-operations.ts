import config from 'config';
import ms from 'ms';
import { deleteOlderJobs } from '../lib/database/job';
import getLogger from '../utils/logger';

const logger = getLogger();

export default function purgeOlderJobs() {
    logger.info('Purging older jobs');

    const purgeInterval = ms(config.get('db.jobs.purge.interval'));
    const purgeAfter = ms(config.get('db.jobs.purge.older-than'));

    setInterval(async () => deleteOlderJobs(Date.now() - Number(purgeAfter)), Number(purgeInterval));
}
