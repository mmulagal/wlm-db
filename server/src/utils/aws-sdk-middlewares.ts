import { DeserializeHandlerArguments } from '@aws-sdk/types';
import config from 'config';
import ms, { StringValue } from 'ms';
import { parse, stringify } from 'flatted';
import { generateHash, getRedisConnection, isRedisConnected } from './utils';
import { AWSSDKCacheParams } from './common-types';
import getLogger from './logger';

const logger = getLogger();

const cacheMiddlewareConfig = {
    step: 'deserialize' as const,
    name: 'cacheMiddleware',
    priority: 'high' as const
};

function cacheMiddleware(ttl: number, region: string, credentialsId = '') {
    logger.debug('Cache middleware initialized with', { ttl, region, credentialsId });
    return (next: any, context: any) => async (args: DeserializeHandlerArguments<any>) => {
        const { commandName, clientName } = context || {};
        const { input } = args || {};
        const redisClient = getRedisConnection();

        const cacheKey = generateHash(stringify({ input, region, clientName, commandName, credentialsId }));
        if (cacheKey && isRedisConnected(redisClient)) {
            const cachedResponse = await redisClient.get(cacheKey);
            if (cachedResponse) {
                logger.debug(`Redis cache hit for ${commandName} with key: ${cacheKey}`);
                return parse(cachedResponse);
            }
        }

        const response = await next(args);
        const { output: { $metadata: sdkMetadata, ...rest } = {} } = response || {};

        if (sdkMetadata && rest && isRedisConnected(redisClient)) {
            try {
                // 'EX' for setting expiration in seconds, 'PX' for milliseconds
                await redisClient.set(cacheKey, stringify(response), 'PX', ttl);
            } catch (error) {
                logger.warn('Error setting cache:', error);
            }
        }

        return response;
    };
}

async function addCacheMiddleware(client: any, { useCache, ttl, credentialsId }: AWSSDKCacheParams) {
    if (useCache) {
        const region = await client.config.region();
        client.middlewareStack.add(
            cacheMiddleware(ttl ?? ms(config.get<StringValue>('aws-sdk.cache.ttl')), region, credentialsId),
            cacheMiddlewareConfig
        );
    }
    return client;
}

export default addCacheMiddleware;
