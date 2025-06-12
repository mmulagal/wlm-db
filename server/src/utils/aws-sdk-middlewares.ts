import { DeserializeHandlerArguments } from '@aws-sdk/types';
import Redis from 'ioredis';
import config from 'config';
import ms, { StringValue } from 'ms';
import { parse, stringify } from 'flatted';
import { generateHash, getRedisConnection } from './utils';
import { AWSSDKCacheParams } from './common-types';
import getLogger from './logger';

const logger = getLogger();

function isRedisConnected(redisClient: Redis) {
    return redisClient.status === 'ready';
}

const cacheMiddlewareConfig = {
    step: 'deserialize' as const,
    name: 'cacheMiddleware',
    priority: 'high' as const
};

function cacheMiddleware(ttl: number, credentialsId = '') {
    logger.debug(`Cache middleware initialized with TTL: ${ttl}ms and credentialsId: ${credentialsId}`);
    return (next: any, context: any) => async (args: DeserializeHandlerArguments<any>) => {
        const { commandName } = context || {};
        const { input } = args || {};
        const redisClient = getRedisConnection();

        const cacheKey = generateHash(stringify({ input, commandName, credentialsId }));
        if (cacheKey && isRedisConnected(redisClient)) {
            const cachedResponse = await redisClient.get(cacheKey);
            if (cachedResponse) {
                logger.debug(`Redis cache hit for ${commandName} with key: ${cacheKey}`);
                return parse(cachedResponse);
            }
        }

        // If not cached, proceed with the request
        const response = await next(args);
        const { output: { $metadata: sdkMetadata, ...rest } = {} } = response || {};

        // Cache the response
        if (sdkMetadata && rest && isRedisConnected(redisClient)) {
            try {
                await redisClient.set(cacheKey, stringify(response), 'EX', ttl);
            } catch (error) {
                logger.warn('Error setting cache:', error);
            }
        }

        return response;
    };
}

function addCacheMiddleware(client: any, { useCache, ttl, credentialsId }: AWSSDKCacheParams) {
    if (useCache) {
        client.middlewareStack.add(
            cacheMiddleware(ttl ?? ms(config.get<StringValue>('aws-sdk.cache.ttl')), credentialsId),
            cacheMiddlewareConfig
        );
    }
    return client;
}

export { addCacheMiddleware };
