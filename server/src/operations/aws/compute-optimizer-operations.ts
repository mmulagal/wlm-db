import { ResourceType, ScopeName, PreferredResourceName } from '@aws-sdk/client-compute-optimizer';
import {
    getEC2InstanceRecommendations,
    getEffectiveRecommendationPreferences,
    putRecommendationPreferences
} from '../../lib/aws/compute-optimizer';
import { derivePropertiesFromARN, getEc2Arn } from '../../utils/utils';
import getLogger from '../../utils/logger';
import { getCredentialsDetails } from '../cloud-manager/credentials-operations';
import { getInstanceTypesFromInstanceRequirements } from './ec2-operations';

const logger = getLogger();

async function createRecommendationForResource(
    region: string,
    credentialsId: string,
    accountId: string,
    instanceId: string,
    instanceTypes: string[] = [],
    awsAccountId: string
) {
    logger.info('Creating recommendation for resource', {
        region,
        credentialsId,
        accountId,
        instanceId,
        instanceTypes
    });
    const instanceArn = getEc2Arn(awsAccountId, region, instanceId);

    const putRecParams = {
        resourceType: ResourceType.EC2_INSTANCE,
        loopBackPeriod: 'DAYS_14',
        scope: {
            name: ScopeName.RESOURCE_ARN,
            value: instanceArn
        },
        preferredResources: [
            {
                name: PreferredResourceName.EC2_INSTANCE_TYPES,
                includeList: instanceTypes,
                excludeList: ['t*']
            }
        ]
    };

    await putRecommendationPreferences(region, credentialsId, accountId, putRecParams);
}

async function getInstanceRecommendations(
    region: string,
    credentialsId: string,
    accountId: string,
    instanceId: string,
    ebsVolumeIds: string[],
    sqlServerDeploymentType: string
) {
    logger.info('Getting instance recommendations', {
        region,
        credentialsId,
        accountId,
        instanceId,
        ebsVolumeIds,
        sqlServerDeploymentType
    });

    const { metadata: { arn } = {} } = await getCredentialsDetails(credentialsId, accountId);

    const { awsAccountId } = derivePropertiesFromARN(arn!) || {};
    if (awsAccountId) {
        try {
            const resourceArn = getEc2Arn(awsAccountId, region, instanceId);
            const { preferredResources: [{ includeList }] = [] } = await getEffectiveRecommendationPreferences(
                region,
                credentialsId,
                accountId,
                {
                    resourceArn: getEc2Arn(awsAccountId, region, instanceId)
                }
            );
            const isRecommendationPreferenceExists = includeList && includeList?.length > 1 && includeList?.[0] !== '*'; // includeList includes a list of ec2 instance types ; by default it is * so the length is 1; if its more than 1, that means we have added recommendation preferences
            if (isRecommendationPreferenceExists) {
                const coParams = {
                    instanceArns: [resourceArn],
                    recommendateionPreferences: {
                        cpuVendorArchitectures: ['CURRENT'] // CURRENT to view recommendations that are based on the same CPU vendor and architecture as the current instance.
                    },
                    Filters: [
                        {
                            name: 'Finding',
                            values: ['Overprovisioned']
                        },
                        {
                            name: 'InferredWorkloadTypes',
                            values: ['SQLServer']
                        },
                        {
                            name: 'FindingReasonCodes',
                            values: [
                                'CPUOverprovisioned',
                                'MemoryOverprovisioned',
                                'NetworkBandwidthOverprovisioned',
                                'NetworkPPSOverprovisioned'
                            ]
                        }
                    ]
                };
                const computeOptimizerInstanceRecommendations = await getEC2InstanceRecommendations(
                    region,
                    credentialsId,
                    accountId,
                    coParams
                );
                logger.debug(
                    'computeOptimizerInstanceRecommendations response:',
                    JSON.stringify(computeOptimizerInstanceRecommendations)
                );

                return computeOptimizerInstanceRecommendations?.instanceRecommendations?.map(recommendation => ({
                    instanceArn: recommendation.instanceArn,
                    currentInstanceType: recommendation.currentInstanceType,
                    finding: recommendation.finding,
                    findingReasonCodes: recommendation.findingReasonCodes,
                    lookBackPeriodInDays: recommendation.lookBackPeriodInDays,
                    recommendations: recommendation.recommendationOptions
                }));
            }
            const instanceTypes = await getInstanceTypesFromInstanceRequirements(
                credentialsId,
                region,
                [instanceId],
                ebsVolumeIds,
                sqlServerDeploymentType
            );
            if (instanceTypes?.length) {
                await createRecommendationForResource(
                    region,
                    credentialsId,
                    accountId,
                    instanceId,
                    instanceTypes,
                    awsAccountId
                );
                logger.info(
                    'Recommendation preference created for the instance; it takes about 24hours for compute optimizer to recommend an instance; skipping recommendations'
                );
            }

            logger.info('Recommendation preference not found for the instance; skipping recommendations');
        } catch (err) {
            logger.error('Failed to get instance recommendations', err);
        }
    }
    throw new Error('AWS Account ID details associated with the Database host not found');
}

export { createRecommendationForResource, getInstanceRecommendations };
