import createError from 'http-errors';
import { compact } from 'lodash-es';
import { listInferenceProfiles } from '../../lib/aws/bedrock';
import { HttpErrorCodes } from '../../utils/consts';
import getLogger from '../../utils/logger';
import { getParametersByPath } from '../../lib/aws/ssm';

const logger = getLogger();

async function getBedrockRegionsList() {
    logger.info('Getting Bedrock regions list');
    const bedrockRegionsResponse = await getParametersByPath(
        undefined,
        undefined,
        '/aws/service/global-infrastructure/services/bedrock/regions'
    );
    return compact(bedrockRegionsResponse.map(({ Value }) => Value));
}

async function getInferenceProfileFromModelId(
    accountId: string,
    credentialsId: string,
    region: string,
    modelId: string
) {
    logger.info('Get inference profile from model id:', { accountId, credentialsId, region, modelId });

    const inferenceProfiles = await listInferenceProfiles(accountId, credentialsId, region);

    const { inferenceProfileArn = '' } =
        inferenceProfiles.find(({ inferenceProfileId }) => inferenceProfileId?.includes(modelId)) || {};
    if (!inferenceProfileArn) {
        logger.error(`Inference profile not found for modelId: ${modelId}`);
        throw createError(HttpErrorCodes.NOT_FOUND, `Inference profile not found for modelId: ${modelId}`);
    }

    return inferenceProfileArn;
}

export { getBedrockRegionsList, getInferenceProfileFromModelId };
