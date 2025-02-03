import createError from 'http-errors';
import getLogger from '../../utils/logger';
import { callSsmExecution, executeSSMDocumentMultipleInstances } from './ssm-operations';
import { describeAvailablePatches, describeInstancePatchStates, describeInstancePatches } from '../../lib/aws/ssm';
import { extractVersionYear, sqlResponseParsing } from '../../utils/utils';
import {
    GET_INSTALLED_MSSQL_VERSION,
    GET_INSTALLED_SQL_PATCHES
} from '../workloads/mssql/continuous-optimization-scripts';

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

async function getMissingPatchDetails(credentialsId: string, region: string, instanceIds: string[]) {
    logger.info('Get Missing Patch Details', { credentialsId, region, instanceIds });

    return Promise.all(
        instanceIds.map(async instanceId => {
            const params = {
                InstanceId: instanceId,
                Filters: [
                    {
                        Key: 'Severity',
                        Values: ['Critical', 'Important']
                    },
                    {
                        Key: 'State',
                        Values: ['Missing']
                    }
                ]
            };
            const missingPatches = (await describeInstancePatches(credentialsId, region, params)) || {};

            return {
                instanceId,
                missingPatches
            };
        })
    );
}

async function getInstancesPatchStatus(credentialsId: string, region: string, instanceIds: string[]) {
    logger.info('Get Instance Patch Status', { credentialsId, region, instanceIds });

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
            const instanceMissingPatchDetails = await getMissingPatchDetails(credentialsId, region, instanceIds);
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
                            KBId: kbId
                        }) => ({ classification, severity, state, title, kbId })
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

async function getAvailablePatches(credentialsId: string, region: string, instanceIds: string[]) {
    logger.info('Get Available Patch Details', { credentialsId, region, instanceIds });

    return Promise.all(
        instanceIds.map(async instanceId => {
            const sqlServerYear = await getTheMSSqlversion(credentialsId, region, instanceId);

            const params = {
                Filters: [
                    {
                        Key: 'PATCH_SET',
                        Values: ['APPLICATION']
                    },
                    {
                        Key: 'PRODUCT_FAMILY',
                        Values: ['SQL Server']
                    },
                    {
                        Key: 'MSRC_SEVERITY',
                        Values: ['Important', 'Critical']
                    },
                    {
                        Key: 'CLASSIFICATION',
                        Values: ['SecurityUpdates']
                    },
                    {
                        Key: 'PRODUCT',
                        Values: [`Microsoft SQL Server ${sqlServerYear}`]
                    }
                ]
            };

            const availablePatches = (await describeAvailablePatches(region, params)) || {};

            return {
                instanceId,
                availablePatches
            };
        })
    );
}

async function getTheMSSqlversion(credentialsId: string, region: string, instanceId: string) {
    const ssmCommand = GET_INSTALLED_MSSQL_VERSION();

    const response = await callSsmExecution(
        credentialsId,
        region,
        [ssmCommand],
        instanceId,
        'Get Installed SQL version'
    );
    const parsedResponse = sqlResponseParsing(response);
    const { sqlVersion } = parsedResponse;
    const versionYear = extractVersionYear(sqlVersion);

    return versionYear;
}

async function getInstalledSQLPatchDetails(credentialsId: string, region: string, instanceIds: string[]) {
    logger.info('Get Installed SQL Patch Details', { credentialsId, region, instanceIds });
    const ssmCommand = GET_INSTALLED_SQL_PATCHES();

    return Promise.all(
        instanceIds.map(async instanceId => {
            const response = await callSsmExecution(
                credentialsId,
                region,
                [ssmCommand],
                instanceId,
                'Get Installed SQL patches'
            );
            const parsedResponse = sqlResponseParsing(response);
            const { installedPatches } = parsedResponse;

            return {
                instanceId,
                installedPatches
            };
        })
    );
}

export {
    runAwsPatchBaseline,
    getInstancesPatchStatus,
    getAvailablePatches,
    getMissingPatchDetails,
    getInstalledSQLPatchDetails,
    getTheMSSqlversion
};
