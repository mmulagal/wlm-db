import {
    ComputeOptimizerClient,
    GetEC2InstanceRecommendationsCommand,
    PutRecommendationPreferencesCommand,
    GetEC2InstanceRecommendationsRequest,
    PutRecommendationPreferencesRequest,
    GetEffectiveRecommendationPreferencesCommand,
    GetEffectiveRecommendationPreferencesRequest
} from '@aws-sdk/client-compute-optimizer';
import getLogger from '../../utils/logger';
import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';

const logger = getLogger();

async function getComputeOptimizerClient(region: string, credentialsId: string, accountId?: string) {
    logger.debug('Getting ComputeOptimizer client:', region);

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialsDetails(credentialsId, accountId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };
    return new ComputeOptimizerClient({ credentials, region });
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

export { getEC2InstanceRecommendations, putRecommendationPreferences, getEffectiveRecommendationPreferences };
