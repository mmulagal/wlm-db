import { isEmpty } from 'lodash-es';
import { HEADERS, MARKETING_API_TCO, USER_TOKEN, WORKLOAD_FACTORY_ENDPOINT } from '../../utils/consts';
import { gotInstanceForInternalRequest } from '../../utils/got';
import getLogger from '../../utils/logger';
import { getAsyncLocalStorageResource } from '../../utils/async-local-storage';
import {
    CalculateEbsComparisonResponse,
    ManualModeMarketingRequestBody,
    StorageInstanceResponse,
    StorageVolumesResponse,
    AutomaticModeMarketingRequestBody
} from '../../utils/marketing-types';
import { hasCache, readFromCacheByKey, writeToCache } from '../../utils/cache';
import { generateHash } from '../../utils/utils';

const logger = getLogger();
const MARKETING_API_THROTTLING_ERROR = 'The caller does not have sufficient permissions to perform the operation.';

async function getStorageSavings(
    accountId: string,
    credentialsId: string,
    region: string,
    params: AutomaticModeMarketingRequestBody
) {
    logger.info('Get storage savings from marketing APIs:', { accountId, credentialsId, region, params });

    let url = `accounts/${accountId}/marketing/v2/credentials/${credentialsId}/regions/${region}/ebs/auto/calculate`;
    if (params?.fileSystemsIds) {
        url = `accounts/${accountId}/marketing/v1/credentials/${credentialsId}/regions/${region}/fsxw/auto/calculate`;
    }

    const cacheKey = generateHash(JSON.stringify(params));
    if (hasCache(MARKETING_API_TCO, cacheKey)) {
        return readFromCacheByKey(MARKETING_API_TCO, cacheKey) as CalculateEbsComparisonResponse;
    }

    const response = await gotInstanceForInternalRequest
        .post(url, {
            prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
            headers: {
                [HEADERS.AUTHORIZATION]: getAsyncLocalStorageResource(USER_TOKEN),
                ...((process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') && {
                    [HEADERS.SIMULATOR]: 'true'
                })
            },
            json: params
        })
        .json<CalculateEbsComparisonResponse>();

    if (!isEmpty(response) || !(response as unknown as string).includes(MARKETING_API_THROTTLING_ERROR)) {
        writeToCache(MARKETING_API_TCO, cacheKey, response);
    }
    return response;
}

async function getManualModeStorageSavings<T>(accountId: string, params: ManualModeMarketingRequestBody) {
    logger.info('Get manual mode storage savings from marketing APIs:', { accountId, params });
    let url = `accounts/${accountId}/marketing/v1/ebs/db/calculate`;
    if (!params.instances) {
        url = `accounts/${accountId}/marketing/v1/fsxw/calculate`;
    }

    logger.info('URL>>>', url);

    const cacheKey = generateHash(JSON.stringify(params));
    if (!process.env.TEST && hasCache(MARKETING_API_TCO, cacheKey)) {
        return readFromCacheByKey(MARKETING_API_TCO, cacheKey) as T;
    }

    const response = await gotInstanceForInternalRequest
        .post(url, {
            prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
            headers: {
                [HEADERS.AUTHORIZATION]: getAsyncLocalStorageResource(USER_TOKEN),
                ...((process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') && {
                    [HEADERS.SIMULATOR]: 'true'
                })
            },
            json: params
        })
        .json<T>();

    if (!isEmpty(response)) {
        writeToCache(MARKETING_API_TCO, cacheKey, response);
    }
    return response;
}

async function getInstanceListFromStorage(accountId: string, credentialsId: string, region: string) {
    logger.info('Get storage instance list from marketing APIs:', { accountId, credentialsId, region });

    const response = await gotInstanceForInternalRequest
        .get(
            `accounts/${accountId}/marketing/v1/credentials/${credentialsId}/regions/${region}/instances?limit=50&offset=0&force=false`,
            {
                prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
                headers: {
                    [HEADERS.AUTHORIZATION]: getAsyncLocalStorageResource(USER_TOKEN),
                    ...((process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') && {
                        [HEADERS.SIMULATOR]: 'true'
                    })
                }
            }
        )
        .json<StorageInstanceResponse>();
    return response;
}

async function getVolumesListFromStorage(accountId: string, credentialsId: string, region: string, instanceId: string) {
    logger.info('Get storage volumes list from marketing APIs:', { accountId, credentialsId, region, instanceId });

    const response = await gotInstanceForInternalRequest
        .get(
            `accounts/${accountId}/marketing/v1/credentials/${credentialsId}/regions/${region}/instances/${instanceId}/ebs-volumes`,
            {
                prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
                headers: {
                    [HEADERS.AUTHORIZATION]: getAsyncLocalStorageResource(USER_TOKEN),
                    ...((process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') && {
                        [HEADERS.SIMULATOR]: 'true'
                    })
                }
            }
        )
        .json<StorageVolumesResponse>();
    return response;
}

export { getStorageSavings, getManualModeStorageSavings, getVolumesListFromStorage, getInstanceListFromStorage };
