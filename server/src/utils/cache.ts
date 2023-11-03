import { LRUCache } from 'lru-cache';
import ms from 'ms';
import { USER_TENANCY_CACHE_TYPE } from './consts.js';
import getLogger from './logger.js';

const logger = getLogger();

const USER_TENANCY_CACHE = new LRUCache({
    max: 1000,
    ttl: ms('15m')
});

function getCacheByType(type: string) {
    logger.debug('Getting cache by type:', type);

    switch (type) {
        case USER_TENANCY_CACHE_TYPE:
            return USER_TENANCY_CACHE;
        default:
            logger.error('Could not found compatible cache');
    }
}

function writeToCache(type: string, key: string, data: any) {
    logger.debug('Writing to cache:', { key, data });

    const cache = getCacheByType(type);

    cache?.set(key, data);
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

export { writeToCache, readFromCacheByKey, hasCache };
