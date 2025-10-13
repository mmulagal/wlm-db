import createError from 'http-errors';
import { compact } from 'lodash-es';
import throat from 'throat';
import { FoundationModelSummary } from '@aws-sdk/client-bedrock';
import { listInferenceProfiles, listFoundationModels } from '../../lib/aws/bedrock';
import { HttpErrorCodes, RESTRICTED_FSX_REGIONS } from '../../utils/consts';
import getLogger from '../../utils/logger';
import { getParametersByPath } from '../../lib/aws/ssm';
import { LOGS_ANALYZER_MODEL_IDS } from '../../utils/logs-analyzer/logs-analyzer-consts';

const logger = getLogger();

async function getLogsAnalyzerBedrockRegionsList() {
    logger.info('Getting Bedrock regions list');

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
                throat(3, async region => {
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

    return compact(logsAnalyserSupportedRegions);
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
