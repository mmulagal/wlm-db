import { WORKLOAD_FACTORY_ENDPOINT, HEADERS, AI_LIMITER_MODE } from '../../utils/consts';
import { gotInstanceForInternalRequest } from '../../utils/got';
import getLogger from '../../utils/logger';
import { getWfServiceToken } from './auth';

const logger = getLogger();

const AI_LIMITER_API_PATH = 'ai-limiter/v1/account-configuration';

interface AiLimiterResponse {
    mode: {
        type: AI_LIMITER_MODE;
        model?: Record<string, unknown>;
    };
}

async function getAiLimiterConfig(accountId: string): Promise<{ aiAnalysisEnabled: boolean }> {
    try {
        const { token } = await getWfServiceToken();
        const response = await gotInstanceForInternalRequest
            .get(`accounts/${accountId}/${AI_LIMITER_API_PATH}`, {
                prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
                headers: { [HEADERS.AUTHORIZATION]: token }
            })
            .json<AiLimiterResponse>();

        const aiAnalysisEnabled = response.mode.type !== AI_LIMITER_MODE.DISABLED;
        return { aiAnalysisEnabled };
    } catch (error) {
        // ponytail: fail-open — a transient outage of the ai-limiter service must not block analysis
        logger.warn('Failed to fetch AI limiter config, defaulting to enabled', { accountId, error });
        return { aiAnalysisEnabled: true };
    }
}

export default getAiLimiterConfig;
