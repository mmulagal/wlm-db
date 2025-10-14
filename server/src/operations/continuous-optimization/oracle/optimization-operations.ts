import { OptimizeRequestBodyType } from '../../../routes/types/oracle-continuous-optimization.types';
import getLogger from '../../../utils/logger';

const logger = getLogger();

async function optimizeOracleDatabase(accountId: string, params: OptimizeRequestBodyType) {
    const { type: optimizationType, hostsToOptimize } = params;

    if (!hostsToOptimize || hostsToOptimize.length === 0) {
        throw new Error('No hosts to optimize provided');
    }
    logger.info(
        `Starting optimization of type ${optimizationType} for account ${accountId} on ${hostsToOptimize.length} hosts`
    );

    return { jobId: '12345' };
}

export { optimizeOracleDatabase };
