import {
    ComputeOptimizerClient,
    GetEC2InstanceRecommendationsCommand,
    GetEC2InstanceRecommendationsCommandOutput,
    GetEffectiveRecommendationPreferencesCommand,
    GetEffectiveRecommendationPreferencesCommandOutput,
    PutRecommendationPreferencesCommand
} from '@aws-sdk/client-compute-optimizer';
import { mockClient } from 'aws-sdk-client-mock';
import getEffectiveRecommendationResponse from '../../responses/aws/compute-optimizer-instance-recommendation-preferences.json';
import instanceRecommendationsResponse from '../../responses/aws/compute-optimizer-instance-recommendations.json';

const computeOptimizerMock = mockClient(ComputeOptimizerClient);

computeOptimizerMock
    .on(GetEffectiveRecommendationPreferencesCommand)
    .resolves(getEffectiveRecommendationResponse as GetEffectiveRecommendationPreferencesCommandOutput)
    .on(PutRecommendationPreferencesCommand)
    .resolves({})
    .on(GetEC2InstanceRecommendationsCommand)
    .resolves(instanceRecommendationsResponse as unknown as GetEC2InstanceRecommendationsCommandOutput);
