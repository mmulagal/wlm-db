import { WORKLOAD_FACTORY_ENDPOINT } from '../../utils/consts';
import { gotInstanceForInternalRequest } from '../../utils/got';
import getLogger from '../../utils/logger';

const logger = getLogger();

interface policyStatement {
    Sid: string;
    Effect: string;
    Action: [string];
    Resource: string;
    Condition?: {
        [key: string]: {
            [key: string]: string;
        };
    };
}

interface wlmdbPolicyResponse {
    _comment?: string;
    operate: {
        Version: string;
        Statement: [policyStatement];
    };
    view: {
        Version: string;
        Statement: [policyStatement];
    };
}

async function getWlmdbPolicy() {
    logger.info('Getting WLMDB policy');

    const response = await gotInstanceForInternalRequest
        .get('wlmdb/workload-policies.json', {
            prefixUrl: WORKLOAD_FACTORY_ENDPOINT
        })
        .json<wlmdbPolicyResponse>();
    return response;
}

export { policyStatement, wlmdbPolicyResponse, getWlmdbPolicy };
