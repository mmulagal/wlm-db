import {
    getLogsAnalyzerBedrockRegionsList,
    getInferenceProfileFromModelId
} from '../../../src/operations/aws/bedrock-operations';
import { LOGS_ANALYZER_MODEL_IDS } from '../../../src/utils/logs-analyzer/logs-analyzer-consts';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';

import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/aws/bedrock-scope';
import '../../simulator/scopes/aws/ssm-scope';

describe('getInferenceProfileFromModelId', () => {
    it('should return the inferenceProfileArn when modelId matches', async () => {
        const result = await getInferenceProfileFromModelId(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            LOGS_ANALYZER_MODEL_IDS[0]
        );

        expect(result).toContain(LOGS_ANALYZER_MODEL_IDS[0]);
    });

    it('should throw an error when modelId does not match', async () => {
        await expect(
            getInferenceProfileFromModelId(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                'non-existent-model-id'
            )
        ).rejects.toThrow('Inference profile not found for modelId: non-existent-model-id');
    });
});

describe('getLogsAnalyzerBedrockRegionsList', () => {
    it('Should list all regions with bedrock support', async () => {
        const regions = await getLogsAnalyzerBedrockRegionsList();
        expect(regions.length).toBeGreaterThan(0);
    });
});
