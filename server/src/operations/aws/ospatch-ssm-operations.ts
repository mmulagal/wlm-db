import createError from 'http-errors';
import getLogger from '../../utils/logger';
import { sleep } from '../../utils/utils';
import { executeSSMDocumentMultipleInstances } from './ssm-operations';
import { describeInstancePatchStates, describeInstancePatches } from '../../lib/aws/ssm';
import { DatabaseTypes } from '../../utils/consts';
import { HostOsPatchAssessmentObject } from '../../utils/common-types';

const logger = getLogger();
const MAX_PATCH_DETAILS_RETRY_ATTEMPTS = 3;
const PATCH_DETAILS_RETRY_DELAY_MS = 5000;

async function runAwsPatchBaseline(
    credentialId: string,
    region: string,
    instanceId: string[],
    operation: string[] = ['Scan']
) {
    logger.info('Run AWS Patch Baseline', { credentialId, region, instanceId, operation });

    try {
        const params = {
            DocumentName: 'AWS-RunPatchBaseline',
            InstanceIds: instanceId,
            Parameters: {
                Operation: operation
            }
        };
        return await executeSSMDocumentMultipleInstances(credentialId, region, params, undefined, 5000);
    } catch (error) {
        const errorMessage = `Failed to run AWS Patch Baseline. Reason: ${error}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

async function getMissingPatchDetails(
    credentialsId: string,
    region: string,
    instanceIds: string[],
    databaseType: DatabaseTypes
) {
    logger.info('Get Missing Patch Details', { credentialsId, region, instanceIds, databaseType });

    const filters =
        databaseType === DatabaseTypes.MS_SQL_SERVER
            ? [
                  {
                      Key: 'State',
                      Values: ['Missing', 'AvailableSecurityUpdate']
                  }
              ]
            : [
                  {
                      Key: 'State',
                      Values: ['Missing', 'InstalledPendingReboot', 'InstalledRejected', 'Failed']
                  }
              ];

    return Promise.all(
        instanceIds.map(async instanceId => {
            const params = {
                InstanceId: instanceId,
                Filters: filters
            };
            const missingPatches = (await describeInstancePatches(credentialsId, region, params)) || {};

            return {
                instanceId,
                missingPatches
            };
        })
    );
}

async function fetchPatchDetailsWithRetry(
    credentialsId: string,
    region: string,
    instanceIds: string[],
    databaseType: DatabaseTypes,
    expectedPatchCountByInstanceId: Map<string, number>
) {
    const maxAttempts = MAX_PATCH_DETAILS_RETRY_ATTEMPTS;
    let instanceMissingPatchDetails: Awaited<ReturnType<typeof getMissingPatchDetails>> = [];
    const expectedMissingPatchDetailsCountByInstanceId = Object.fromEntries(expectedPatchCountByInstanceId);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        // eslint-disable-next-line no-await-in-loop
        instanceMissingPatchDetails = await getMissingPatchDetails(credentialsId, region, instanceIds, databaseType);
        const actualMissingPatchDetailsCountByInstanceId = instanceMissingPatchDetails.map(
            ({ instanceId, missingPatches }) => ({
                instanceId,
                missingPatchDetailsCount: missingPatches?.length || 0
            })
        );
        const hasMismatchedMissingPatchDetailsCount = instanceMissingPatchDetails.some(
            ({ instanceId, missingPatches }) =>
                (missingPatches?.length || 0) !== (expectedPatchCountByInstanceId.get(instanceId) || 0)
        );

        if (!hasMismatchedMissingPatchDetailsCount) {
            break;
        }

        if (attempt >= maxAttempts) {
            logger.info('Missing patch details retry limit reached with mismatched counts', {
                credentialsId,
                region,
                maxAttempts,
                expectedMissingPatchDetailsCountByInstanceId,
                actualMissingPatchDetailsCountByInstanceId
            });
            break;
        }

        logger.info('Retrying missing patch details fetch due to mismatched count', {
            credentialsId,
            region,
            attempt,
            expectedMissingPatchDetailsCountByInstanceId,
            actualMissingPatchDetailsCountByInstanceId
        });

        // eslint-disable-next-line no-await-in-loop
        await sleep(PATCH_DETAILS_RETRY_DELAY_MS);
    }

    return instanceMissingPatchDetails;
}

async function getInstancesPatchStatus(
    credentialsId: string,
    region: string,
    instanceIds: string[],
    databaseType: DatabaseTypes,
    ec2InstanceNameMap?: Map<string, string>
): Promise<HostOsPatchAssessmentObject[]> {
    logger.info('Get Instance Patch Status', { credentialsId, region, instanceIds, databaseType });

    try {
        const { InstancePatchStates: instancePatchStates = [] } = await describeInstancePatchStates(
            credentialsId,
            region,
            { InstanceIds: instanceIds }
        );

        let isNotOptimized = false;
        const expectedPatchCountByInstanceId = new Map<string, number>();

        instancePatchStates.forEach(
            ({
                InstanceId,
                CriticalNonCompliantCount = 0,
                SecurityNonCompliantCount = 0,
                OtherNonCompliantCount = 0
            }) => {
                if (InstanceId) {
                    const nonCompliantCount =
                        CriticalNonCompliantCount + SecurityNonCompliantCount + OtherNonCompliantCount;
                    expectedPatchCountByInstanceId.set(InstanceId, nonCompliantCount);
                    if (nonCompliantCount > 0) {
                        isNotOptimized = true;
                    }
                }
            }
        );

        const missingPatchDetailsByInstance = new Map<
            string,
            NonNullable<HostOsPatchAssessmentObject['missingPatchDetails']>
        >();
        if (isNotOptimized) {
            const instanceMissingPatchDetails = await fetchPatchDetailsWithRetry(
                credentialsId,
                region,
                instanceIds,
                databaseType,
                expectedPatchCountByInstanceId
            );
            instanceMissingPatchDetails?.forEach(({ instanceId, missingPatches }) => {
                missingPatchDetailsByInstance.set(
                    instanceId,
                    (missingPatches ?? []).map(
                        ({
                            Classification: classification = '',
                            Severity: severity = '',
                            State: state = '',
                            Title: title = '',
                            KBId: kbId = '',
                            CVEIds: cveIds = ''
                        }) => ({ classification, kbId, cveIds, severity, state, title })
                    )
                );
            });
        }

        return instancePatchStates.map(
            ({
                BaselineId: baselineId,
                CriticalNonCompliantCount: criticalNonCompliantCount,
                OtherNonCompliantCount: otherNonCompliantCount,
                InstanceId: instanceId,
                OperationStartTime: operationStartTime,
                OperationEndTime: operationEndTime,
                SecurityNonCompliantCount: securityNonCompliantCount
            }) => ({
                baselineId: baselineId ?? '',
                criticalNonCompliantCount: criticalNonCompliantCount ?? 0,
                otherNonCompliantCount: otherNonCompliantCount ?? 0,
                ec2InstanceId: instanceId ?? '',
                ec2InstanceName: ec2InstanceNameMap?.get(instanceId ?? '') || 'Unknown',
                operationStartTime: operationStartTime ? new Date(operationStartTime).getTime() : 0,
                operationEndTime: operationEndTime ? new Date(operationEndTime).getTime() : 0,
                securityNonCompliantCount: securityNonCompliantCount ?? 0,
                missingPatchDetails: missingPatchDetailsByInstance.get(instanceId ?? '') ?? []
            })
        );
    } catch (error) {
        const errorMessage = `Failed to run get instance patch status. Reason: ${error}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

export { runAwsPatchBaseline, getInstancesPatchStatus, getMissingPatchDetails };
