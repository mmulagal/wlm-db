import { listUniqueJob } from '../../src/lib/database/job';
import { sleep } from '../../src/utils/utils';

export default async function waitForJobCompletion(
    accountId: string,
    credentialsId: string,
    region: string,
    jobId: string,
    attempts: number = 0
): Promise<void> {
    const maxRetries = 10;
    const retryDelay = 5000;

    if (attempts >= maxRetries) {
        throw new Error(`Job ${jobId} did not complete within ${(maxRetries * retryDelay) / 1000} seconds`);
    }

    const jobStatus = await listUniqueJob(accountId, credentialsId, region, jobId);
    if (jobStatus && ['COMPLETED', 'WARNING', 'FAILED'].includes(jobStatus.status) ) {
        return;
    }

    await sleep(retryDelay);
    return waitForJobCompletion(accountId, credentialsId, region, jobId, attempts + 1);
}
