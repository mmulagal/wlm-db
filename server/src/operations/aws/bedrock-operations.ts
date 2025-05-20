import createError from 'http-errors';
import { listInferenceProfiles } from '../../lib/aws/bedrock';
import { HttpErrorCodes } from '../../utils/consts';
import getLogger from '../../utils/logger';

const logger = getLogger();

export default async function getInferenceProfileFromModelId(
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
