import { LRUCache } from 'lru-cache';
import ms, { StringValue } from 'ms';
import {
    BXP_USER_CRED_TYPE,
    USER_TENANCY_CACHE_TYPE,
    SSM_COMMAND_CACHE_TYPE,
    WF_USER_CRED_TYPE,
    WF_SVC_TOKEN_TYPE,
    BXP_SVC_TOKEN_TYPE,
    REQUEST_IN_PROGRESS_TYPE,
    AWS_PRICING_TYPE,
    AWS_FSX_TYPE,
    AWS_CE_TYPE,
    AWS_SSM_PARAMETER,
    AWS_SECRET_ARN_TYPE,
    AWS_CO_TYPE,
    MARKETING_API_TCO,
    EMAIL_RATE_LIMIT_TYPE
} from './consts.js';
import getLogger from './logger.js';

const logger = getLogger();

const USER_TENANCY_CACHE = new LRUCache({
    max: 1000,
    ttl: ms('15m')
});

const WF_USER_CRED_CACHE = new LRUCache({
    max: 1000,
    ttl: ms('10m')
});

const BXP_USER_CRED_CACHE = new LRUCache({
    max: 1000,
    ttl: ms('10m')
});

const WF_SVC_TOKEN_CACHE = new LRUCache({
    max: 100
});

const BXP_SVC_TOKEN_CACHE = new LRUCache({
    max: 100
});

const SSM_COMMAND_CACHE = new LRUCache({
    max: 1000,
    ttl: ms('10m')
});

const REQUEST_IN_PROGRESS_CACHE = new LRUCache({
    max: 100,
    ttl: ms('30s')
});

const AWS_PRICING_CACHE = new LRUCache({
    max: 1000,
    ttl: ms('10d')
});

const AWS_FSX_CACHE = new LRUCache({
    max: 1000,
    ttl: ms('1d')
});

const AWS_CE_CACHE = new LRUCache({
    max: 1000,
    ttl: ms('1d')
});

const AWS_SSM_PARAMETER_CACHE = new LRUCache({
    max: 1000,
    ttl: ms('1d')
});
const AWS_SECRET_ARN_CACHE = new LRUCache({
    max: 1000,
    ttl: ms('6h')
});
const AWS_CO_CACHE = new LRUCache({
    max: 1000,
    ttl: ms('1d')
});
const EMAIL_RATE_LIMIT_CACHE = new LRUCache({
    max: 20,
    ttl: ms('1d')
});

const MARKETING_API_TCO_CACHE = new LRUCache({
    max: 1000,
    ttl: ms('10m')
});

function getCacheByType(type: string, checkCache: boolean = false) {
    logger.debug('Getting cache by type:', type);

    switch (type) {
        case USER_TENANCY_CACHE_TYPE:
            return USER_TENANCY_CACHE;
        case WF_USER_CRED_TYPE:
            return WF_USER_CRED_CACHE;
        case BXP_USER_CRED_TYPE:
            return BXP_USER_CRED_CACHE;
        case WF_SVC_TOKEN_TYPE:
            return WF_SVC_TOKEN_CACHE;
        case BXP_SVC_TOKEN_TYPE:
            return BXP_SVC_TOKEN_CACHE;
        case SSM_COMMAND_CACHE_TYPE:
            return SSM_COMMAND_CACHE;
        case REQUEST_IN_PROGRESS_TYPE:
            return REQUEST_IN_PROGRESS_CACHE;
        case AWS_PRICING_TYPE:
            return AWS_PRICING_CACHE;
        case AWS_FSX_TYPE:
            return AWS_FSX_CACHE;
        case AWS_CE_TYPE:
            return AWS_CE_CACHE;
        case AWS_SSM_PARAMETER:
            return AWS_SSM_PARAMETER_CACHE;
        case AWS_SECRET_ARN_TYPE:
            return AWS_SECRET_ARN_CACHE;
        case AWS_CO_TYPE:
            return AWS_CO_CACHE;
        case MARKETING_API_TCO:
            return MARKETING_API_TCO_CACHE;
        case EMAIL_RATE_LIMIT_TYPE:
            return EMAIL_RATE_LIMIT_CACHE;
        default:
            if (!checkCache) {
                logger.error('Could not found compatible cache: ', type);
            }
    }
}

function writeToCache(type: string, key: string, data: any, ttl?: StringValue | number) {
    logger.debug('Writing to cache:', { key, data });

    const cache = getCacheByType(type);

    const opts = {
        ...(ttl && { ttl: typeof ttl === 'string' ? ms(ttl) : ttl })
    };

    cache?.set(key, data, opts);
}

function readFromCacheByKey(type: string, key: string) {
    logger.debug('Reading from cache by key:', key);

    const cache = getCacheByType(type);

    return cache?.get(key);
}

function hasCache(type: string, key: string) {
    logger.debug('Has cache', { key });

    const cache = getCacheByType(type, true);

    const response = cache?.has(key);
    logger.debug('Has cache ?', response);

    return response;
}

function deleteFromCache(type: string, key: string) {
    logger.info('Delete cache', { key });

    const cache = getCacheByType(type, true);

    cache?.delete(key);
}

function resetCache(type: string) {
    logger.info('Resetting cache', type);

    const cache = getCacheByType(type);
    cache?.clear();
}

export { writeToCache, readFromCacheByKey, hasCache, deleteFromCache, resetCache };
