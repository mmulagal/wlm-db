import createError from 'http-errors';
import { compact, isEmpty } from 'lodash-es';
import throat from 'throat';
import { FoundationModelSummary } from '@aws-sdk/client-bedrock';
import { listInferenceProfiles, listFoundationModels } from '../../lib/aws/bedrock';
import { AWS_FSX_TYPE, HttpErrorCodes, RESTRICTED_FSX_REGIONS } from '../../utils/consts';
import getLogger from '../../utils/logger';
import { getParametersByPath } from '../../lib/aws/ssm';
import { LOGS_ANALYZER_MODEL_IDS } from '../../utils/logs-analyzer/logs-analyzer-consts';
import { hasCache, readFromCacheByKey, writeToCache } from '../../utils/cache';

const logger = getLogger();

async function getLogsAnalyzerBedrockRegionsList() {
    logger.info('Getting Bedrock regions list');

    const cacheKey = 'bedrock-regions-list';

    if (hasCache(AWS_FSX_TYPE, cacheKey)) {
        const response = readFromCacheByKey(AWS_FSX_TYPE, cacheKey) as string[];
        if (response && !isEmpty(response)) {
            return response;
        }
    }

    const bedrockRegionsResponse = await getParametersByPath(
        undefined,
        undefined,
        '/aws/service/global-infrastructure/services/bedrock/regions'
    );

    const bedrockSupportedRegionsList = compact(
        bedrockRegionsResponse.filter(({ Value }) => !RESTRICTED_FSX_REGIONS.includes(Value!)).map(({ Value }) => Value)
    );

    const logsAnalyserSupportedRegions = await Promise.all(
        compact(
            bedrockSupportedRegionsList.map(
                throat(5, async region => {
                    const response = await listFoundationModels(region, { useCache: true });
                    const { modelSummaries } = response || {};
                    const regionSupportedModels =
                        compact(modelSummaries?.map(({ modelId }: FoundationModelSummary) => modelId)) || [];

                    if (LOGS_ANALYZER_MODEL_IDS.some(id => regionSupportedModels.includes(id))) {
                        return region;
                    }
                })
            )
        )
    );
    const regionsList = compact(logsAnalyserSupportedRegions);

    writeToCache(AWS_FSX_TYPE, cacheKey, regionsList);

    return regionsList;
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
export { getLogsAnalyzerBedrockRegionsList, getInferenceProfileFromModelId };
