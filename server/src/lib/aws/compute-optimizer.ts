import {
    ComputeOptimizerClient,
    GetEC2InstanceRecommendationsCommand,
    PutRecommendationPreferencesCommand,
    GetEC2InstanceRecommendationsRequest,
    PutRecommendationPreferencesRequest,
    GetEffectiveRecommendationPreferencesCommand,
    GetEffectiveRecommendationPreferencesRequest,
    GetEnrollmentStatusCommand,
    GetEnrollmentStatusCommandOutput
} from '@aws-sdk/client-compute-optimizer';
import { isEmpty } from 'lodash-es';
import getLogger from '../../utils/logger';
import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import { hasCache, readFromCacheByKey, writeToCache } from '../../utils/cache';
import { AWS_CO_TYPE, GOV_REGIONS } from '../../utils/consts';

const logger = getLogger();

async function getComputeOptimizerClient(region: string, credentialsId: string, accountId?: string) {
    logger.debug('Getting ComputeOptimizer client:', region);

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialsDetails(credentialsId, accountId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };
    const isGovCloud = GOV_REGIONS.includes(region as (typeof GOV_REGIONS)[number]);
    return new ComputeOptimizerClient({ credentials, region, ...(isGovCloud && { useFipsEndpoint: true }) });
}

async function getEnrollmentStatus(
    region: string,
    credentialsId: string,
    accountId: string
): Promise<GetEnrollmentStatusCommandOutput> {
    logger.info('Getting compute optimizer enrollment status', { region, credentialsId, accountId });
    const computeOptimizer = await getComputeOptimizerClient(region, credentialsId, accountId);

    const uniqueKey = `${region}|${credentialsId}|${accountId}`;
    if (hasCache(AWS_CO_TYPE, uniqueKey)) {
        logger.debug('Found compute optimizer entollment information in cache');

        return readFromCacheByKey(AWS_CO_TYPE, uniqueKey) as GetEnrollmentStatusCommandOutput;
    }
    const resp = await computeOptimizer.send(new GetEnrollmentStatusCommand({}));
    logger.debug('getEnrollmentStatus response:', resp);
    if (!isEmpty(resp)) {
        logger.debug('Writing enrollment status information to cache', { AWS_CO_TYPE, uniqueKey, resp });

        writeToCache(AWS_CO_TYPE, uniqueKey, resp);
    }
    return resp;
}

async function getEC2InstanceRecommendations(
    region: string,
    credentialsId: string,
    accountId: string,
    params: GetEC2InstanceRecommendationsRequest
) {
    logger.info('Getting compute optimizer EC2 instance recommendations', { region, credentialsId, accountId, params });
    const computeOptimizer = await getComputeOptimizerClient(region, credentialsId, accountId);

    const resp = await computeOptimizer.send(new GetEC2InstanceRecommendationsCommand(params));
    logger.debug('getEC2InstanceRecommendations response:', resp);

    return resp;
}

async function putRecommendationPreferences(
    region: string,
    credentialsId: string,
    accountId: string,
    params: PutRecommendationPreferencesRequest
) {
    logger.info('Putting compute optimizer recommendation preferences', { region, credentialsId, accountId, params });
    const computeOptimizer = await getComputeOptimizerClient(region, credentialsId, accountId);

    const resp = await computeOptimizer.send(new PutRecommendationPreferencesCommand(params));
    logger.debug('putRecommendationPreferences response:', resp);

    return resp;
}

async function getEffectiveRecommendationPreferences(
    region: string,
    credentialsId: string,
    accountId: string,
    params: GetEffectiveRecommendationPreferencesRequest
) {
    logger.info('Getting effective recommendation preferences', { region, credentialsId, accountId, params });

    const computeOptimizer = await getComputeOptimizerClient(region, credentialsId, accountId);
    const resp = await computeOptimizer.send(new GetEffectiveRecommendationPreferencesCommand(params));
    logger.debug('getRecommendationPreferences response:', resp);

    return resp;
}

export {
    getEnrollmentStatus,
    getEC2InstanceRecommendations,
    putRecommendationPreferences,
    getEffectiveRecommendationPreferences
};
