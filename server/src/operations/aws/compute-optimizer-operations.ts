import {
    ResourceType,
    ScopeName,
    PreferredResourceName,
    InstanceRecommendationOption,
    LookBackPeriodPreference,
    CpuVendorArchitecture
} from '@aws-sdk/client-compute-optimizer';
import { compact, isEmpty } from 'lodash-es';
import {
    getEC2InstanceRecommendations,
    getEffectiveRecommendationPreferences,
    putRecommendationPreferences
} from '../../lib/aws/compute-optimizer';
import { derivePropertiesFromARN, getEc2Arn } from '../../utils/utils';
import getLogger from '../../utils/logger';
import { getCredentialsDetails } from '../cloud-manager/credentials-operations';
import {
    getInstanceTypesFromInstanceRequirements,
    getInstanceTypesFromInstanceRequirementsForManagedInstances
} from './ec2-operations';
import { getSqlInstancePricingDetails } from './pricing-operations';
import { CONTINUOUS_ASSESSMENT_FEATURE, FINDING, TCO_FEATURE } from '../../utils/consts';
import { createTrackedEc2Records, updateTrackedEc2Record } from '../../lib/database/db';
import { NodeDetails } from '../../utils/common-types';
import { listTrackedEc2Operation } from '../database/database-operations';

const logger = getLogger();

async function createRecommendationForResource(
    region: string,
    credentialsId: string,
    accountId: string,
    instanceIds: string[],
    instanceTypes: string[] = [],
    awsAccountId: string
) {
    logger.info('Creating recommendation for resource', {
        region,
        credentialsId,
        accountId,
        instanceIds,
        instanceTypes
    });
    await Promise.all(
        instanceIds.map(async instanceId => {
            const instanceArn = getEc2Arn(awsAccountId, region, instanceId);

            const putRecParams = {
                resourceType: ResourceType.EC2_INSTANCE,
                lookBackPeriod: LookBackPeriodPreference.DAYS_14,
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
        })
    );
}

async function identifyComputeOptimizerRecommendationOptions(
    accountId: string,
    region: string,
    credentialsId: string,
    currentInstanceType: string,
    instanceRecommendationOptions: InstanceRecommendationOption[]
) {
    logger.info('Identifying compute optimiser recommendation options', {
        accountId,
        region,
        credentialsId,
        currentInstanceType,
        instanceRecommendationOptions
    });

    const recommendationOptionsWithPrices: {
        recommendationOption: InstanceRecommendationOption;
        price: number;
        pricingDetails: { [preInstalledSw: string]: { pricePerUnit: number; unit: string } };
    }[] = [];
    await Promise.all(
        instanceRecommendationOptions.map(async recommendationOption => {
            const { instanceType = '' } = recommendationOption;
            const { [instanceType]: pricingDetails } = await getSqlInstancePricingDetails(
                region,
                instanceType,
                'windows'
            ); // Assuming this function returns pricing details for a specific instance type
            if (pricingDetails?.NA?.pricePerUnit) {
                recommendationOptionsWithPrices.push({
                    recommendationOption,
                    price: pricingDetails.NA.pricePerUnit,
                    pricingDetails
                });
            }
        })
    );
    recommendationOptionsWithPrices.sort((a, b) => a.price - b.price);

    return recommendationOptionsWithPrices;
}

async function manageInstanceRecommendationPreReqsForManagedInstances(
    awsAccountId: string,
    region: string,
    credentialsId: string,
    instanceIds: string[],
    accountId: string,
    sqlServerDeploymentType: string
) {
    logger.info('Managing instance recommendation prerequisites for managed instances', {
        awsAccountId,
        region,
        credentialsId,
        instanceIds,
        accountId,
        sqlServerDeploymentType
    });

    let isRecommendationPreferenceExists = false;
    await Promise.all(
        instanceIds.map(async instanceId => {
            const resourceArn = getEc2Arn(awsAccountId, region, instanceId);
            const instanceTypes =
                (await getInstanceTypesFromInstanceRequirementsForManagedInstances(
                    credentialsId,
                    region,
                    instanceId
                )) || [];

            if (instanceTypes && instanceTypes.length <= 0) {
                throw new Error(
                    'Instance types not found for the instance requirements, unable to create recommendation preference'
                );
            }

            const { preferredResources: [{ includeList = [] }] = [] } = await getEffectiveRecommendationPreferences(
                region,
                credentialsId,
                accountId,
                {
                    resourceArn
                }
            );

            isRecommendationPreferenceExists =
                includeList &&
                instanceTypes &&
                includeList?.length > 1 &&
                instanceTypes.every(item => includeList.includes(item));
            if (!isRecommendationPreferenceExists) {
                await createRecommendationForResource(
                    region,
                    credentialsId,
                    accountId,
                    instanceIds,
                    instanceTypes,
                    awsAccountId
                );
                await addEc2InstancesToTrackedList(
                    accountId,
                    region,
                    credentialsId,
                    awsAccountId,
                    instanceIds,
                    CONTINUOUS_ASSESSMENT_FEATURE
                );
            }
        })
    );
}

async function manageInstanceRecommendationPreReqs(
    awsAccountId: string,
    region: string,
    credentialsId: string,
    resourceArn: string,
    accountId: string,
    instanceIds: string[],
    ebsVolumeIds: string[],
    sqlServerDeploymentType: string
) {
    logger.info('Managing instance recommendation prerequisites', {
        awsAccountId,
        region,
        credentialsId,
        resourceArn,
        accountId,
        instanceIds,
        ebsVolumeIds,
        sqlServerDeploymentType
    });

    const instanceTypes = await getInstanceTypesFromInstanceRequirements(
        credentialsId,
        region,
        instanceIds,
        ebsVolumeIds,
        sqlServerDeploymentType
    );

    if (instanceTypes && instanceTypes.length <= 0) {
        throw new Error(
            'Instance types not found for the instance requirements, unable to create recommendation preference'
        );
    }

    const { preferredResources: [{ includeList }] = [] } = await getEffectiveRecommendationPreferences(
        region,
        credentialsId,
        accountId,
        {
            resourceArn
        }
    );

    const isRecommendationPreferenceExists = includeList && includeList?.length > 1 && includeList?.[0] !== '*'; // includeList includes a list of ec2 instance types ; by default it is * so the length is 1; if its more than 1, that means we have added recommendation preferences
    await createRecommendationForResource(region, credentialsId, accountId, instanceIds, instanceTypes, awsAccountId);
    if (isRecommendationPreferenceExists) {
        logger.info('Recommendation preference already exists for the instance, updating the last updated time');
        await Promise.all(
            instanceIds.map(async instanceId => {
                await updateTrackedEc2Record(accountId, region, credentialsId, instanceId, TCO_FEATURE, {
                    last_updated: new Date()
                });
            })
        );
    } else {
        logger.info('Recommendation preference created for the instance, adding the instance to the tracked list');
        await addEc2InstancesToTrackedList(accountId, region, credentialsId, awsAccountId, instanceIds, TCO_FEATURE);
        throw new Error(
            'Recommendation preference created for the instance; it takes about 24hours for compute optimizer to recommend an instance; skipping recommendations'
        );
    }

    return instanceTypes;
}

async function addEc2InstancesToTrackedList(
    accountId: string,
    region: string,
    credentialsId: string,
    awsAccountId: string,
    instanceIds: string[],
    feature: string
) {
    logger.info('Adding instance to tracked list', {
        accountId,
        region,
        credentialsId,
        awsAccountId,
        instanceIds,
        feature
    });
    const { items: trackedEc2Instances } = await listTrackedEc2Operation({ feature, accountId, region, credentialsId });
    const records = instanceIds
        .map(instanceId => ({
            account_id: accountId,
            region,
            credentials_id: credentialsId,
            instance_id: instanceId,
            feature,
            cloud_provider_account_id: awsAccountId
        }))
        .filter(
            record => !trackedEc2Instances?.some(trackedInstance => trackedInstance.instance_id === record.instance_id)
        ); // filter out instances that are already tracked

    if (records && records.length > 0) {
        await createTrackedEc2Records(records);
    }
}

function getFindingMapping(finding: string) {
    switch (finding) {
        case 'OVER_PROVISIONED':
        case 'Overprovisioned':
            return FINDING.NOT_OPTIMIZED;
        case 'UNDER_PROVISIONED':
        case 'Underprovisioned':
            return FINDING.UNDER_PROVISIONED;
        case 'OPTIMIZED':
        case 'Optimized':
            return FINDING.OPTIMIZED;
        case 'NOT_OPTIMIZED':
        case 'NotOptimized':
            return FINDING.NOT_OPTIMIZED;
        default:
            return FINDING.INSUFFICIENT_DATA;
    }
}

async function getInstanceRecommendations(
    region: string,
    credentialsId: string,
    accountId: string,
    instanceId: string,
    nodeInstances: NodeDetails[],
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
        const resourceArn = getEc2Arn(awsAccountId, region, instanceId);
        const instanceIds = nodeInstances.map(({ ec2InstanceId }) => ec2InstanceId);
        let message: string | undefined;
        const instanceTypes: string[] =
            (await manageInstanceRecommendationPreReqs(
                awsAccountId,
                region,
                credentialsId,
                resourceArn,
                accountId,
                instanceIds,
                ebsVolumeIds,
                sqlServerDeploymentType
            )) || [];

        const coParams = {
            instanceArns: [resourceArn],
            recommendationPreferences: {
                cpuVendorArchitectures: [CpuVendorArchitecture.CURRENT] // CURRENT to view recommendations that are based on the same CPU vendor and architecture as the current instance.
            },
            Filters: [
                {
                    name: 'Finding',
                    values: ['Overprovisioned']
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

        const finding = computeOptimizerInstanceRecommendations?.instanceRecommendations?.[0]?.finding
            ? getFindingMapping(computeOptimizerInstanceRecommendations.instanceRecommendations[0].finding)
            : FINDING.INSUFFICIENT_DATA;

        logger.debug(
            'computeOptimizerInstanceRecommendations response:',
            JSON.stringify(computeOptimizerInstanceRecommendations)
        );

        if (isEmpty(computeOptimizerInstanceRecommendations?.instanceRecommendations)) {
            throw new Error('No instance recommendations available for the instance');
        }
        if (finding === FINDING.NOT_OPTIMIZED) {
            const [{ currentInstanceType = '', recommendationOptions = [] } = {}] =
                computeOptimizerInstanceRecommendations?.instanceRecommendations || [];
            const recommendationOptionsSortedByPrice = await identifyComputeOptimizerRecommendationOptions(
                accountId,
                region,
                credentialsId,
                currentInstanceType,
                recommendationOptions
            );

            const allRecommendedInstanceDetails = compact(
                recommendationOptionsSortedByPrice.map(optionWithPrice => {
                    const { pricingDetails, recommendationOption: { instanceType } = {} } = optionWithPrice;
                    return {
                        instanceType,
                        pricingDetails
                    };
                })
            );

            // return items present in both allRecommendedTypes and instanceTypes
            const recommendedInstanceTypes = allRecommendedInstanceDetails.filter(({ instanceType = '' }) =>
                instanceTypes?.includes(instanceType)
            );

            if (isEmpty(recommendedInstanceTypes)) {
                throw new Error('We are unable to recommend an instance type for the instance.');
            }
            return { finding, instanceRecommendations: allRecommendedInstanceDetails, message };
        }
        return { finding, message: 'Instance is already optimized or under provisioned. No recommendations available' };
    }
    throw new Error('AWS Account ID details associated with the Database host not found');
}

const translationMap: { [key: string]: string } = {
    CPUOverprovisioned: 'CPU over-provisioned',
    CPUUnderprovisioned: 'CPU under-provisioned',
    DiskIOPSOverprovisioned: 'Disk IOPS over-provisioned',
    DiskIOPSUnderprovisioned: 'Disk IOPS under-provisioned',
    DiskThroughputOverprovisioned: 'Disk throughput over-provisioned',
    DiskThroughputUnderprovisioned: 'Disk throughput under-provisioned',
    EBSIOPSOverprovisioned: 'EBS IOPS over-provisioned',
    EBSIOPSUnderprovisioned: 'EBS IOPS under-provisioned',
    EBSThroughputOverprovisioned: 'EBS throughput over-provisioned',
    EBSThroughputUnderprovisioned: 'EBS throughput under-provisioned',
    GPUMemoryOverprovisioned: 'GPU memory over-provisioned',
    GPUMemoryUnderprovisioned: 'GPU memory under-provisioned',
    GPUOverprovisioned: 'GPU over-provisioned',
    GPUUnderprovisioned: 'GPU under-provisioned',
    MemoryOverprovisioned: 'Memory over-provisioned',
    MemoryUnderprovisioned: 'Memory under-provisioned',
    NetworkBandwidthOverprovisioned: 'Network bandwidth over-provisioned',
    NetworkBandwidthUnderprovisioned: 'Network bandwidth under-provisioned',
    NetworkPPSOverprovisioned: 'Network PPS over-provisioned',
    NetworkPPSUnderprovisioned: 'Network PPS under-provisioned'
};

function translateFindingReasonCode(key: string): string {
    logger.info('Translating finding reason code', { key });
    return translationMap[key] || key; // Return the key itself if no translation is found
}

export {
    createRecommendationForResource,
    getInstanceRecommendations,
    manageInstanceRecommendationPreReqs,
    manageInstanceRecommendationPreReqsForManagedInstances,
    translateFindingReasonCode
};
