import { LRUCache } from 'lru-cache';
import ms from 'ms';
import {
    BXP_USER_CRED_TYPE,
    USER_TENANCY_CACHE_TYPE,
    SSM_COMMAND_CACHE_TYPE,
    WF_USER_CRED_TYPE,
    WF_SVC_TOKEN_TYPE,
    BXP_SVC_TOKEN_TYPE,
    REQUEST_IN_PROGRESS_TYPE,
    AWS_PRICING_TYPE,
    AWS_FSX_TYPE
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
    ttl: ms('60m')
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

function getCacheByType(type: string) {
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
        default:
            logger.error('Could not found compatible cache');
    }
}

function writeToCache(type: string, key: string, data: any, ttl?: number | string) {
    logger.info('Writing to cache:', { key, data });

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

    const cache = getCacheByType(type);

    const response = cache?.has(key);
    logger.debug('Has cache ?', response);

    return response;
}

function deleteFromCache(type: string, key: string) {
    logger.info('Delete cache', { key });

    const cache = getCacheByType(type);

    cache?.delete(key);
}

function resetCache(type: string) {
    logger.info('Resetting cache', type);

    const cache = getCacheByType(type);
    cache?.clear();
}

export { writeToCache, readFromCacheByKey, hasCache, deleteFromCache, resetCache };
