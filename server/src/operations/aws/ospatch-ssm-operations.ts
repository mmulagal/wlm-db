import createError from 'http-errors';
import getLogger from '../../utils/logger';
import { executeSSMDocumentMultipleInstances } from './ssm-operations';
import { describeInstancePatchStates, describeInstancePatches } from '../../lib/aws/ssm';
import { DatabaseTypes } from '../../utils/consts';

const logger = getLogger();

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
                      Key: 'Severity',
                      Values: ['Critical', 'Important']
                  },
                  {
                      Key: 'State',
                      Values: ['Missing']
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

async function getInstancesPatchStatus(
    credentialsId: string,
    region: string,
    instanceIds: string[],
    databaseType: DatabaseTypes
) {
    logger.info('Get Instance Patch Status', { credentialsId, region, instanceIds, databaseType });

    try {
        let response;
        const params = {
            InstanceIds: instanceIds
        };
        const { InstancePatchStates: instancePatchStates } = await describeInstancePatchStates(
            credentialsId,
            region,
            params
        );

        const isNotOptimized = instancePatchStates?.some(
            ({ CriticalNonCompliantCount: critical = 0, SecurityNonCompliantCount: security = 0 }) =>
                critical > 0 || security > 0
        );
        if (isNotOptimized) {
            const instanceMissingPatchDetails = await getMissingPatchDetails(
                credentialsId,
                region,
                instanceIds,
                databaseType
            );
            response = instanceMissingPatchDetails?.map(({ instanceId, missingPatches }) => {
                const instancePatchState = instancePatchStates?.find(({ InstanceId }) => InstanceId === instanceId);
                return {
                    ...instancePatchState,
                    missingPatchDetails: missingPatches?.map(
                        ({
                            Classification: classification,
                            Severity: severity,
                            State: state,
                            Title: title,
                            KBId: kbId,
                            CVEIds: cveIds
                        }) => ({
                            classification,
                            severity,
                            state,
                            title,
                            kbId,
                            cveIds
                        })
                    )
                };
            });
        } else {
            response = instancePatchStates?.map(instancePatchState => ({
                ...instancePatchState,
                missingPatchDetails: []
            }));
        }
        return response;
    } catch (error) {
        const errorMessage = `Failed to run get instance patch status. Reason: ${error}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

export { runAwsPatchBaseline, getInstancesPatchStatus, getMissingPatchDetails };
