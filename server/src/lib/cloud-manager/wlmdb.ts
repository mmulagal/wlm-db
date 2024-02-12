import { WF_CONSOLE_ENDPOINT } from '../../utils/consts';
import { gotInstanceForInternalRequest } from '../../utils/got';
import getLogger from '../../utils/logger';

const logger = getLogger();

interface PolicyStatement {
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

interface WlmdbPolicyResponse {
    _comment?: string;
    operate: {
        Version: string;
        Statement: [PolicyStatement];
    };
    view: {
        Version: string;
        Statement: [PolicyStatement];
    };
}

async function getWlmdbPolicy() {
    logger.info('Getting WLMDB policy');

    const response = await gotInstanceForInternalRequest
        .get('wlmdb/workload-policies.json', {
            prefixUrl: WF_CONSOLE_ENDPOINT
        })
        .json<WlmdbPolicyResponse>();
    return response;
}

export { PolicyStatement, getWlmdbPolicy };
