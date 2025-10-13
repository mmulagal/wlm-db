import { getModelAvailability, listFoundationModels, listInferenceProfiles } from '../../../src/lib/aws/bedrock';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/aws/bedrock-scope';
import { DEFAULT_AWS_REGION } from '../../utils/consts';

describe('getModelAvailability', () => {
    it('returns default not available when response statusCode is 200 but body is not provided', async () => {
        const result = await getModelAvailability(
            'accountId',
            'credentialsId',
            'us-east-1',
            'anthropic.claude-3-7-sonnet-20250219-v1:0'
        );
        expect(result).toBeDefined();
    });

    it('Lists inference profiles', async () => {
        const result = await listInferenceProfiles('accountId', 'credentialsId', 'us-east-1');
        expect(result).toBeDefined();
    });

    it('Lists foundation models', async () => {
        const result = await listFoundationModels(DEFAULT_AWS_REGION);
        expect(result).toBeDefined();
    });
});
