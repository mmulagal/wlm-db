import { DeserializeHandlerArguments } from '@aws-sdk/types';
import Redis from 'ioredis';
import config from 'config';
import ms, { StringValue } from 'ms';
import { parse, stringify } from 'flatted';
import { generateHash, getRedisDetails } from './utils';
import { AWSSDKCacheParams } from './common-types';
import getLogger from './logger';

const logger = getLogger();

const redisClient = new Redis(getRedisDetails().url, {
    maxRetriesPerRequest: 2
});

const cacheMiddlewareConfig = {
    step: 'deserialize' as const,
    name: 'cacheMiddleware',
    priority: 'high' as const
};

function cacheMiddleware(ttl: number, credentialsId = '') {
    return (next: any, context: any) => async (args: DeserializeHandlerArguments<any>) => {
        const { commandName } = context || {};
        const { input } = args || {};

        const cacheKey = generateHash(stringify({ input, commandName, credentialsId }));
        const cachedResponse = await redisClient.get(cacheKey);
        if (cachedResponse) {
            return parse(cachedResponse);
        }

        // If not cached, proceed with the request
        const response = await next(args);
        const { output: { $metadata: sdkMetadata, ...rest } = {} } = response || {};

        // Cache the response
        if (sdkMetadata && rest) {
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
