import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import createError from 'http-errors';
import { compact, isEmpty } from 'lodash-es';
import { Volume } from '@aws-sdk/client-fsx';
import throat from 'throat';
import {
    Metadata,
    DatabaseInstance,
    WorkloadInstance,
    StorageAssessment,
    DatabaseInstanceMetadata,
    OptimizeMpioPolicyParams,
    LogDriveDetails,
    TempDbDriveDetails,
    OptimizeMpioIscsiSessionsParams,
    StorageTierParams,
    MaxDOPAssesment,
    AwsFsxNBackupConfig,
    OptimizeMpioTimeoutParams,
    ResourceDetails
} from '../utils/common-types';
import {
    HttpErrorCodes,
    AuditStatus,
    SqlServerDeploymentModel,
    RESOURCESTYPE,
    SSM_COMMAND_CACHE_TYPE,
    DatabaseTypes
} from '../utils/consts';
import {
    IS_DEMO_FLOW,
    sqlResponseParsing,
    convertToBytes,
    getResourceNameFromTags,
    calculateFsxStorageCapacityForHeadroomOptimization,
    sleep,
    retryWithDelay,
    getServerNameWithHostname,
    parseMultipleCommandResponse
} from '../utils/utils';
import { callSsmExecution } from './aws/ssm-operations';
import { getInstanceInfo, getResources } from './database/database-operations';
import { GET_ONTAP_LUN_DETAILS, RESCAN_EXTEND_LUN } from './workloads/mssql/storage-scripts';
import { OPTIMIZE_STORAGE_PARAMS_SCRIPT, SET_MAXDOP } from './workloads/mssql/optimization-scripts';
import { getActiveSqlNode } from './workloads/mssql/mssql-operations';
import { registerJob, updateJobDetails } from './database/job-operations';
import { describeFSx, describeFSxStorageVirtualMachines, updateFsxCapacity } from '../lib/aws/fsx';
import { updateLongRunningAuditGroup } from './cloud-manager/audit-operations';
import {
    OptimizeStorageParams,
    QUERY_PARAMS,
    OptimizeStorageConfigs,
    OptimizeStorageApiData,
    AssessmentCategories,
    AssessmentStatus,
    OPTIMIZE_SIZING_CONFIGS,
    OptimizeOperatingSystemParams,
    AssessmentTriggeredBy,
    OptimizeStorageConfigsJobNames,
    STORAGE_OPTIMIZE_JOB_PARAM,
    OptimizeStorageRequestParamsType
} from '../utils/continous-optimization-consts';
import getLogger from '../utils/logger';
import { paginateListInstanceConfigData } from './database/instance-config-operations';
import {
    OptimizePerHostRequestBodyType,
    SizingViolationResponseType
} from '../routes/types/mssql-continuous-optimisation.types';
import {
    getFsxVolumeDetails,
    getFsxnVolIdsFromOntapVolIds,
    getIscsiTargetAddresses,
    getMappedOntapVolumes,
    updateFsxBackup,
    updateVolumeSizeAndWaitForUpdate
} from './aws/fsx-operations';
import { updateOptimizedConfigNameInInstanceTable } from './demo-operations';
import {
    CHECK_IF_MPIO_INSTALLED,
    CHECK_MPIO_POLICY,
    ENABLE_MPIO_AND_CONFIGURE,
    MPIO_ISCSI_SESSIONS,
    REMEDIATE_MPIO_ISCSI_SESSIONS,
    REMEDIATE_MPIO_POLICY,
    MPIO_TIMEOUT
} from './workloads/mssql/mpio-remediation-scripts';
import { describeInstance } from '../lib/aws/ec2';
import {
    getHeadroomDrift,
    getLogVolumeDrift,
    getTempDbVolumeDrift
} from './continuous-optimization/mssql/storage-assessment-operations';
import { handleOptimizeJobCreation, JobMetadata } from './continuous-optimization/assessment-utils';
import { listJobs } from '../lib/database/job';
import { resetCache } from '../utils/cache';
import { onDemandTriggerMssqlDriftAssessment } from './continuous-optimization/mssql/assessment-operations';
import { SSM_RUN_POWERSHELL_SCRIPT_DOC, SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION } from './workloads/mssql/const';

import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from './workloads/oracle/consts';
import { onDemandTriggerOracleDriftAssessment } from './continuous-optimization/oracle/assessment-operations';
import {
    getOracleStorageConfigRecommendationMap,
    oracleSpecialStorageConfigNames
} from './continuous-optimization/oracle/storage-optimize-operations';
import { optimizeStorageConfigParamsOracle } from './continuous-optimization/oracle/ssm-scripts/storage-optimize-scripts';

const logger = getLogger();

interface OptimizeStorageAttributeParams {
    accountId: string;
    region: string;
    credentialsId: string;
    fsxId: string;
    activeNodeInstanceId: string;
    parentJobId: string;
    optimizationTargets: OptimizeStorageRequestParamsType[];
    optimizationConfigs: Record<string, any>;
    apiRequestData: typeof OptimizeStorageApiData;
    svmName: string;
    serverNameWithHostName: string;
    resourceType: RESOURCESTYPE;
    recommendationMap?: {
        [key: string]: { objectsToOptimize: string[]; recommended: string; additionalInfo: Record<string, unknown> };
    };
}

interface OptimizeStorageOperationParams {
    accountId: string;
    region: string;
    credentialsId: string;
    awsAccountId: string;
    fsxId: string;
    activeNodeInstanceId: string;
    parentJobId: string;
    serverNameWithHostName: string;
    instanceId: string;
    databaseHostId: string;
    databaseType: string;
    instanceName: string;
    sqlAuthEnabled: boolean;
    svmName: string;
    optimizationTargets: OptimizeStorageRequestParamsType[];
    instanceMetadata?: DatabaseInstanceMetadata;
    volumeTypeMap?: Map<string, string[]>;
}

function getApiQueryFilter(
    svmName: string,
    objectsToOptimize: string[],
    configKey: string,
    value: string,
    queryParamKey: string
) {
    return ['DEDUPLICATION', 'COMPACTION', 'EXPORT_POLICY'].includes(configKey) ||
        (value === 'none' && configKey === 'COMPRESSION')
        ? `svm=${svmName}&name=${objectsToOptimize.join('|')}`
        : ['NFS_ROOTONLY'].includes(configKey)
        ? `vserver=${svmName}`
        : `vserver=${svmName}&${queryParamKey}=${objectsToOptimize.join(',')}`;
}

async function getExportPolicyRules(
    credentialsId: string,
    region: string,
    fsxId: string,
    activeNodeInstanceId: string,
    svmName: string,
    existingPolicyName: string
) {
    logger.info(`Getting export policy rules for policy ${existingPolicyName} in SVM ${svmName}`);

    const commandToFetchExistingPolicyDetails = [
        optimizeStorageConfigParamsOracle({
            fsxId,
            region,
            apiEndpoint: '/protocols/nfs/export-policies',
            apiQueryFilter: `svm=${svmName}&name=${existingPolicyName}&fields=rules`,
            apiBody: '',
            apiType: 'GET'
        })
    ];

    const existingPolicyResponse = await retryWithDelay(
        callSsmExecution.bind(null, {
            credentialsId,
            region,
            commands: commandToFetchExistingPolicyDetails,
            ec2InstanceId: activeNodeInstanceId,
            comment: 'Fetch existing export policy details',
            documentName: SSM_RUN_SHELL_SCRIPT_DOC,
            documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        })
    );

    const parsedExistingPolicyResponse = sqlResponseParsing(existingPolicyResponse);

    let existingRules = [];
    if (parsedExistingPolicyResponse?.records?.[0]?.rules) {
        existingRules = parsedExistingPolicyResponse.records[0].rules;
    }

    return existingRules;
}

async function createExportPolicy(
    accountId: string,
    region: string,
    credentialsId: string,
    fsxId: string,
    activeNodeInstanceId: string,
    svmName: string,
    clients: string[],
    existingPolicyName: string,
    policyName: string,
    parentJobId?: string
) {
    logger.info(`Creating new export policy in SVM ${svmName} for FSx ${fsxId} `);
    const jobDescription = `Create export policy in SVM ${svmName} for FSx ${fsxId} `;
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError: string = '';
    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: jobDescription,
        description: jobDescription,
        resourceName: fsxId,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.OPTIMIZATION,
        parentJobId
    });

    try {
        const existingRules = await getExportPolicyRules(
            credentialsId,
            region,
            fsxId,
            activeNodeInstanceId,
            svmName,
            existingPolicyName
        );

        let newRules = [];
        newRules = clients.map(client => {
            const existingRule = existingRules.find(
                (rule: any) => rule.clients && rule.clients.some((c: any) => c.match === client)
            );

            if (existingRule) {
                return {
                    ...existingRule,
                    clients: [{ match: client }],
                    allow_suid: true,
                    superuser: ['sys']
                };
            }
            // Not excepting this case will ever be hit
            const templateRule = existingRules[0] || {};
            return {
                ...templateRule,
                clients: [{ match: client }],
                allow_suid: true,
                superuser: ['sys']
            };
        });

        const commands = [
            optimizeStorageConfigParamsOracle({
                fsxId,
                region,
                apiEndpoint: '/protocols/nfs/export-policies',
                apiQueryFilter: '',
                apiBody: JSON.stringify({
                    name: policyName,
                    svm: { name: svmName },
                    rules: newRules
                }),
                apiType: 'POST'
            })
        ];

        const resp = await retryWithDelay(
            callSsmExecution.bind(null, {
                credentialsId,
                region,
                commands,
                ec2InstanceId: activeNodeInstanceId,
                comment: jobDescription,
                documentName: SSM_RUN_SHELL_SCRIPT_DOC,
                documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            })
        );

        const parsedResp = sqlResponseParsing(resp);
        // Check if parsedResp is empty object
        if (!parsedResp.hasOwnProperty('error')) {
            jobStatus = JOBSTATUS.COMPLETED;
            logger.info(`Export policy ${policyName} created successfully in SVM ${svmName}`);
        } else {
            jobStatus = JOBSTATUS.FAILED;
            jobError = `Failed to create export policy: ${
                parsedResp.hasOwnProperty('error') ? JSON.stringify(parsedResp.error) : 'unknown error'
            }`;
        }
    } catch (error) {
        jobError = `Error while creating export policy: ${error}`;
        logger.error(jobError);
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
    }

    if (jobStatus === JOBSTATUS.FAILED) {
        throw new Error(jobError);
    }
}

async function optimizeStorageAttributes(params: OptimizeStorageOperationParams) {
    logger.info('Optimizing storage for', params);
    try {
        const {
            accountId,
            region,
            credentialsId,
            awsAccountId,
            fsxId,
            activeNodeInstanceId,
            parentJobId,
            serverNameWithHostName,
            instanceId,
            databaseHostId,
            databaseType,
            instanceName,
            sqlAuthEnabled,
            svmName,
            optimizationTargets,
            instanceMetadata
        } = params;
        let recommendationMap;
        if (optimizationTargets && optimizationTargets.length > 0) {
            if (
                databaseType === RESOURCESTYPE.ORACLE &&
                optimizationTargets.some(target =>
                    oracleSpecialStorageConfigNames.includes(
                        target.configurationName as unknown as OptimizeStorageConfigs
                    )
                )
            ) {
                recommendationMap = await getOracleStorageConfigRecommendationMap(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    instanceId,
                    instanceName,
                    instanceMetadata?.oracleDeploymentType || '',
                    activeNodeInstanceId,
                    fsxId,
                    optimizationTargets,
                    serverNameWithHostName,
                    parentJobId
                );
            }

            await optimizeOntapStorage({
                accountId,
                region,
                credentialsId,
                fsxId,
                activeNodeInstanceId: activeNodeInstanceId!,
                parentJobId,
                optimizationTargets,
                optimizationConfigs: OptimizeStorageConfigs,
                apiRequestData: OptimizeStorageApiData,
                svmName,
                serverNameWithHostName,
                resourceType: databaseType as RESOURCESTYPE,
                recommendationMap
            });
        }

        const instanceToAssess: WorkloadInstance = {
            id: instanceId,
            name: instanceName,
            type: databaseType,
            region,
            sqlAuthEnabled: sqlAuthEnabled || false,
            fsxFileSystem: fsxId,
            activeNodeInstanceid: activeNodeInstanceId,
            cloudProviderAccountId: awsAccountId,
            resourceName: serverNameWithHostName
        };

        if (IS_DEMO_FLOW) {
            // update metadata in instances table to mark optimized configuration
            const configurationNames: string[] = optimizationTargets.map(config => config.configurationName);

            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                instanceId,
                configurationNames,
                'STORAGE',
                instanceMetadata || ({} as DatabaseInstanceMetadata)
            );
        }
        await triggerAssessmentAfterOptimization(
            credentialsId,
            region,
            accountId,
            databaseHostId,
            serverNameWithHostName,
            parentJobId,
            instanceToAssess,
            AssessmentCategories.STORAGE,
            databaseType as RESOURCESTYPE
        );
    } catch (error) {
        logger.error('Failed to optimize storage', { params, error });
    }
}

async function optimizeOntapStorage(params: OptimizeStorageAttributeParams) {
    const {
        accountId,
        region,
        credentialsId,
        fsxId,
        activeNodeInstanceId,
        parentJobId,
        optimizationTargets,
        optimizationConfigs,
        apiRequestData,
        svmName,
        serverNameWithHostName,
        resourceType,
        recommendationMap
    } = params;
    logger.info(
        `Optimizing ONTAP storage for ${accountId} in ${region} for configuration ${JSON.stringify(
            optimizationTargets
        )}`
    );
    const jobDescription =
        resourceType === RESOURCESTYPE.MSSQL
            ? `Fix MSSQL Storage Configuration for ${serverNameWithHostName}`
            : `Fix Oracle Storage Configuration for ${serverNameWithHostName}`;

    await Promise.all(
        optimizationTargets.map(async data => {
            const { id: jobId } = await registerJob(accountId, credentialsId, region, {
                name: jobDescription,
                description: jobDescription,
                startTime: Date.now(),
                type: JOBTYPE.WELL_ARCHITECTED,
                status: JOBSTATUS.IN_PROGRESS,
                resourceName: serverNameWithHostName,
                parentJobId
            });

            logger.debug(`Job created with id ${jobId}`);

            let newJobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
            let newJobError;
            let newJobDescription;

            try {
                const { configurationName, objectsToOptimize } = data;
                const configKey = Object.keys(optimizationConfigs).find(
                    key => optimizationConfigs[key as keyof typeof optimizationConfigs] === configurationName
                );

                if (!configurationName) {
                    throw new Error('Storage configuration not found');
                }

                const recommendedValues: Record<
                    string,
                    { objectsToOptimize: string[]; additionalInfo: Record<string, unknown> }
                > = {};
                if (
                    resourceType === RESOURCESTYPE.ORACLE &&
                    oracleSpecialStorageConfigNames.includes(configurationName as OptimizeStorageConfigs)
                ) {
                    if (!recommendationMap?.[configurationName]) {
                        newJobError = 'Failed to fetch latest well-architected recommendations';
                        if (OptimizeStorageConfigs.NFS_ROOTONLY === configurationName) {
                            newJobError =
                                'NFS rootonly configuration not applicable when dNFS is not enabled and NFSv4 is not in use.';
                        }
                        throw new Error(newJobError);
                    }
                    const map = recommendationMap[configurationName];
                    recommendedValues[map.recommended] = {
                        objectsToOptimize: map.objectsToOptimize,
                        additionalInfo: map.additionalInfo
                    };
                } else {
                    recommendedValues[''] = {
                        objectsToOptimize,
                        additionalInfo: {}
                    };
                }

                let objectsOptimized = 0;
                let jobParamKey = '';
                let parsedResp: any;

                const apiResults = await Promise.all(
                    Object.entries(recommendedValues).map(
                        throat(3, async ([value, { objectsToOptimize: volumesLunsToOptimize, additionalInfo }]) => {
                            if (configurationName === OptimizeStorageConfigs.EXPORT_POLICY) {
                                const { vserverName, exportPolicyName: existingPolicyName, clients } = additionalInfo;
                                value = `wlmdb_export_policy_${Date.now()}`;
                                await createExportPolicy(
                                    accountId,
                                    region,
                                    credentialsId,
                                    fsxId,
                                    activeNodeInstanceId,
                                    vserverName as string,
                                    clients as string[],
                                    existingPolicyName as string,
                                    value,
                                    jobId
                                );
                            }

                            const result = await callOntapApi(
                                apiRequestData,
                                configKey!,
                                volumesLunsToOptimize,
                                svmName,
                                resourceType,
                                fsxId,
                                region,
                                credentialsId,
                                activeNodeInstanceId,
                                jobDescription,
                                value
                            );
                            return result;
                        })
                    )
                );

                apiResults.forEach(result => {
                    ({ parsedResp, jobParamKey } = result);
                    objectsOptimized += parsedResp?.num_records || 0;
                });

                objectsOptimized = IS_DEMO_FLOW ? objectsToOptimize.length : objectsOptimized;
                // with bulk optimization of volumes, user can send 1/2/3 vol ids to optimize but ssm response will hardcoded to reply with 3 as optimized.

                const optimizeMessage = `Fixed ${objectsOptimized}/${
                    objectsToOptimize.length
                } ${jobParamKey} in ${serverNameWithHostName} for configuration parameter '${
                    OptimizeStorageConfigsJobNames[configKey as keyof typeof OptimizeStorageConfigsJobNames]
                }'`;

                if (objectsOptimized !== objectsToOptimize.length) {
                    if (objectsOptimized === 0) {
                        const optimizeErrorMessage = `Failed to fix ${objectsToOptimize.length} objects, ${objectsToOptimize} for ${serverNameWithHostName}`;
                        logger.error(`Optimization failed for ${serverNameWithHostName}, ${parsedResp}`);
                        newJobStatus = JOBSTATUS.FAILED;
                        newJobError = optimizeErrorMessage;
                    } else {
                        const unOptimizedObjects = parsedResp?.cli_output
                            ? objectsToOptimize.filter(obj => !parsedResp.cli_output.includes(obj))
                            : objectsToOptimize.slice(objectsOptimized);
                        const optimizeErrorMessage = `Failed to fix ${unOptimizedObjects.length} objects, ${unOptimizedObjects} for ${serverNameWithHostName}.`;
                        newJobStatus = JOBSTATUS.FAILED;
                        newJobError = optimizeErrorMessage;
                    }
                } else {
                    newJobDescription = optimizeMessage;
                    newJobStatus = JOBSTATUS.COMPLETED;
                }
            } catch (error) {
                const errorMessage = `Error while fixing storage ${error}`;
                logger.error(errorMessage);
                newJobStatus = JOBSTATUS.FAILED;
                newJobError = errorMessage;
            } finally {
                await updateJobDetails(accountId, jobId, {
                    status: newJobStatus,
                    endTime: Date.now(),
                    error: newJobError,
                    description: newJobDescription
                });
            }
        })
    );
}

async function callOntapApi(
    apiRequestData: typeof OptimizeStorageApiData,
    configKey: string,
    objectsToOptimize: string[],
    svmName: string,
    resourceType: RESOURCESTYPE,
    fsxId: string,
    region: string,
    credentialsId: string,
    activeNodeInstanceId: string,
    jobDescription: string,
    value?: string
) {
    let apiData;
    if (
        oracleSpecialStorageConfigNames.includes(
            OptimizeStorageConfigs[configKey as keyof typeof OptimizeStorageConfigs]
        )
    ) {
        if (
            OptimizeStorageConfigs[configKey as keyof typeof OptimizeStorageConfigs] ===
            OptimizeStorageConfigs.TIERING_MINIMUM_COOLING_DAYS
        ) {
            apiData = apiRequestData[configKey as unknown as keyof typeof apiRequestData](value, 'auto');
        } else {
            apiData = apiRequestData[configKey as keyof typeof apiRequestData](value);
        }
    } else {
        const api = apiRequestData[configKey as keyof typeof apiRequestData];
        if (!api) {
            logger.error(`Storage-Optimization type ${configKey} is not supported yet`);
            throw new Error(`API configuration not found for key: ${configKey}`);
        }
        apiData = api();
    }

    if (!Array.isArray(objectsToOptimize) || objectsToOptimize.some(obj => !obj)) {
        throw new Error('objectsToOptimize must be an array with non-empty string elements.');
    }
    const apiBody = JSON.stringify(apiData.body);
    const optimizeType = apiData.type;
    const queryParamKey = QUERY_PARAMS[optimizeType as keyof typeof QUERY_PARAMS];
    const jobParamKey = STORAGE_OPTIMIZE_JOB_PARAM[optimizeType as keyof typeof STORAGE_OPTIMIZE_JOB_PARAM];
    const apiQueryFilter = getApiQueryFilter(svmName, objectsToOptimize, configKey, value || '', queryParamKey);
    const apiEndpoint = apiData.api;

    let commands: string[] = [];
    let ssmDocument: string;
    let ssmVersion: string;

    switch (resourceType) {
        case RESOURCESTYPE.MSSQL:
            commands = [
                OPTIMIZE_STORAGE_PARAMS_SCRIPT({
                    fsxId,
                    region,
                    apiEndpoint,
                    apiQueryFilter,
                    apiBody
                })
            ];
            ssmDocument = SSM_RUN_POWERSHELL_SCRIPT_DOC;
            ssmVersion = SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION;
            break;
        case RESOURCESTYPE.ORACLE:
            commands = [
                optimizeStorageConfigParamsOracle({
                    fsxId,
                    region,
                    apiEndpoint,
                    apiQueryFilter,
                    apiBody
                })
            ];
            ssmDocument = SSM_RUN_SHELL_SCRIPT_DOC;
            ssmVersion = SSM_RUN_SHELL_SCRIPT_DOC_VERSION;
            break;
        default:
            throw new Error(`Unsupported resourceType for SSM command: ${resourceType}`);
    }

    if (commands.length === 0 || !ssmDocument || !ssmVersion) {
        logger.error('Invalid SSM command configuration', commands, ssmDocument, ssmVersion);
        throw new Error('Invalid SSM command configuration');
    }

    const resp = await retryWithDelay(
        callSsmExecution.bind(null, {
            credentialsId,
            region,
            commands,
            ec2InstanceId: activeNodeInstanceId,
            comment: jobDescription,
            documentName: ssmDocument,
            documentVersion: ssmVersion
        })
    );

    const parsedResp = sqlResponseParsing(resp);
    return { parsedResp, jobParamKey };
}

async function activeSqlNodeDetails(
    credentialsId: string,
    region: string,
    accountId: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    logger.info('Getting active node details', {
        credentialsId,
        region,
        accountId,
        databaseHostId,
        databaseInstanceId
    });

    const instanceDetail = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);

    const {
        fsxn_ids: fsxId,
        database_instance_name: instanceName,
        database_instance_id: instanceId,
        database_type: databaseType,
        fsx_svm_id: svmDetails,
        resource: resourceDetail,
        metadata: instanceMetadata,
        database_deployment_type: databaseDeploymentType
    } = instanceDetail as unknown as DatabaseInstance;

    const { metadata, resource_name: sqlServerName } = resourceDetail! as unknown as ResourceDetails;
    const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;

    const { isSSMConnected, activeNodeInstanceId, instancesDetails } = await getActiveSqlNode(credentialsId, region, {
        node1InstanceId,
        node2InstanceId,
        accountId,
        resourceType: databaseType as DatabaseTypes
    });
    logger.info('instancesDetails', { instanceIds: instancesDetails?.map(instance => instance?.instanceName) });
    const sqlAuthEnabled =
        instancesDetails && instanceDetail
            ? instancesDetails.some(
                  instance =>
                      instance.instanceName === instanceDetail.database_instance_name &&
                      instance.sqlAuthEnabled === true
              )
            : false;

    if (!isSSMConnected && activeNodeInstanceId === undefined) {
        const errorMessage = `Unable to fix instance ${instanceName} in host ${sqlServerName} in account ${accountId} due to SSM connection issues.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    const serverNameWithHostName = getServerNameWithHostname(sqlServerName!, instanceName);

    return {
        sqlAuthEnabled,
        activeNodeInstanceId,
        fsxId,
        instanceId,
        instanceName,
        sqlServerName,
        databaseType,
        svmDetails,
        awsAccountId: resourceDetail!.cloud_provider_account_id,
        serverNameWithHostName,
        instanceMetadata,
        databaseDeploymentType
    };
}

async function getSvmNameFromId(credentialsId: string, region: string, fsxId: string, svmId: string) {
    logger.info('Getting SVM name from id', { credentialsId, region, fsxId, svmId });

    const { StorageVirtualMachines: fsxSVMs } = await describeFSxStorageVirtualMachines(
        credentialsId,
        region,
        [fsxId as string],
        { useCache: true }
    );

    const { Name: svmName } = fsxSVMs?.find(svm => svm.StorageVirtualMachineId === svmId) || {};

    return svmName;
}

async function optimizeStorage(params: OptimizeStorageParams, bulkOptimizeJobId?: string) {
    const { accountId, credentialsId, region, databaseHostId, databaseInstanceId, optimizationTargets } = params;
    logger.info(
        `Optimizing storage for ${accountId}  ${databaseInstanceId} in ${region} for configuration  ${JSON.stringify(
            optimizationTargets
        )}`
    );

    if (optimizationTargets && optimizationTargets.length === 0) {
        logger.info(`Optimization body is empty ${databaseInstanceId} in ${region}`);
        throw createError(HttpErrorCodes.BAD_REQUEST, 'Optimization body is empty');
    }

    const {
        sqlAuthEnabled,
        activeNodeInstanceId,
        fsxId,
        instanceId,
        instanceName,
        databaseType,
        svmDetails,
        awsAccountId,
        serverNameWithHostName,
        instanceMetadata
    } = await activeSqlNodeDetails(credentialsId, region, accountId, databaseHostId, databaseInstanceId);

    const jobDescription =
        databaseType === RESOURCESTYPE.MSSQL
            ? `Fix MSSQL Storage Configuration for ${serverNameWithHostName}`
            : `Fix Oracle Storage Configuration for ${serverNameWithHostName}`;
    // check whether any jobs on the same resource running
    const parentJobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        serverNameWithHostName,
        JOBTYPE.WELL_ARCHITECTED,
        jobDescription,
        jobDescription,
        bulkOptimizeJobId
    );

    const svmDetailsObject = svmDetails as Record<string, string>;
    const svmId = svmDetailsObject ? svmDetailsObject[fsxId] : '';
    try {
        const svmName = await getSvmNameFromId(credentialsId, region, fsxId, svmId);
        if (!svmName && !IS_DEMO_FLOW) {
            const errorMessage = `No SVM with id ${svmId} found for ${fsxId} in ${region}`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }
        optimizeStorageAttributes({
            accountId,
            region,
            credentialsId,
            fsxId,
            activeNodeInstanceId,
            parentJobId,
            serverNameWithHostName,
            instanceId,
            databaseHostId,
            databaseType,
            instanceName,
            sqlAuthEnabled: sqlAuthEnabled || false,
            svmName,
            optimizationTargets,
            awsAccountId,
            instanceMetadata
        } as OptimizeStorageOperationParams);
        await updateLongRunningAuditGroup(AuditStatus.SUCCESS);
    } catch (error) {
        const errorMessage = `Error while fixing storage ${error}`;
        logger.error(errorMessage);
        await updateJobDetails(accountId, parentJobId, {
            status: JOBSTATUS.FAILED,
            endTime: Date.now(),
            error: errorMessage
        });
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);

        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
    return { jobId: parentJobId };
}

async function modifySizingAttributes(
    accountId: string,
    credentialsId: string,
    region: string,
    filesystemId: string,
    typesList: OPTIMIZE_SIZING_CONFIGS[],
    parentJobId: string,
    configData: StorageAssessment,
    serverNameWithHostName: string,
    databaseHostId: string,
    databaseInstanceId: string,
    objectsToOptimize?: string[]
) {
    logger.info('Modifying sizing attributes ', {
        accountId,
        credentialsId,
        region,
        filesystemId,
        typesList,
        parentJobId,
        configData,
        serverNameWithHostName,
        databaseHostId,
        databaseInstanceId
    });
    let errorMessage = '';
    let jobStatus;
    try {
        const {
            sqlAuthEnabled,
            activeNodeInstanceId,
            fsxId,
            instanceId,
            instanceName,
            databaseType,
            awsAccountId,
            instanceMetadata
        } = await activeSqlNodeDetails(credentialsId, region, accountId, databaseHostId, databaseInstanceId);

        if (!activeNodeInstanceId) {
            errorMessage = `Cannot retrieve active node ID from the Microsoft SQL configuration. Drive size optimization for database instance  ${databaseInstanceId} isn't possible.`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }

        const childJobsStatus = [];
        for await (const type of typesList) {
            switch (type) {
                case OPTIMIZE_SIZING_CONFIGS.HEADROOM: {
                    const result = await headroomOptimization(
                        accountId,
                        credentialsId,
                        region,
                        filesystemId,
                        parentJobId,
                        serverNameWithHostName
                    );
                    childJobsStatus.push(result);
                    break;
                }
                case OPTIMIZE_SIZING_CONFIGS.LOG_DRIVE_SIZE: {
                    const {
                        sizing: { 'data-log-drive-details': logDriveDetails }
                    } = configData as unknown as StorageAssessment;
                    const result = await logDriveOptimization(
                        accountId,
                        credentialsId,
                        region,
                        filesystemId,
                        logDriveDetails,
                        parentJobId,
                        serverNameWithHostName,
                        databaseHostId,
                        databaseInstanceId,
                        activeNodeInstanceId,
                        objectsToOptimize
                    );
                    childJobsStatus.push(result);
                    break;
                }
                case OPTIMIZE_SIZING_CONFIGS.TEMPDB_DRIVE_SIZE: {
                    const {
                        sizing: { 'data-tempdb-drive-details': tempdbDriveDetails }
                    } = configData as unknown as StorageAssessment;
                    const result = await tempDbDriveOptimization(
                        accountId,
                        credentialsId,
                        region,
                        filesystemId,
                        tempdbDriveDetails,
                        parentJobId,
                        serverNameWithHostName,
                        databaseHostId,
                        databaseInstanceId,
                        activeNodeInstanceId
                    );
                    childJobsStatus.push(result);
                    break;
                }
                default:
                    throw createError('Invalid optimization type');
            }
        }

        if (IS_DEMO_FLOW) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                instanceId,
                typesList,
                'SIZING',
                instanceMetadata as DatabaseInstanceMetadata
            );
        }

        if (childJobsStatus.some(job => job?.jobStatus !== JOBSTATUS.FAILED)) {
            // run assessment only if any of the child jobs are not failed (completed or warning - run assessment if its either of them)
            const instanceToAssess: WorkloadInstance = {
                id: instanceId,
                name: instanceName,
                type: databaseType,
                region,
                sqlAuthEnabled: sqlAuthEnabled || false,
                fsxFileSystem: fsxId,
                activeNodeInstanceid: activeNodeInstanceId!,
                cloudProviderAccountId: awsAccountId!,
                resourceName: serverNameWithHostName
            };

            await triggerAssessmentAfterOptimization(
                credentialsId,
                region,
                accountId,
                databaseHostId,
                serverNameWithHostName,
                parentJobId,
                instanceToAssess,
                AssessmentCategories.STORAGE
            );
            errorMessage = ` ${childJobsStatus.map(job => job?.errorMessage)}`;
            jobStatus = childJobsStatus.some(job => job?.jobStatus === JOBSTATUS.WARNING)
                ? JOBSTATUS.WARNING
                : JOBSTATUS.COMPLETED;
            updateLongRunningAuditGroup(AuditStatus.SUCCESS);
        } else {
            errorMessage = ` ${childJobsStatus.map(job => job?.errorMessage)}`;
            jobStatus = JOBSTATUS.FAILED;
            updateLongRunningAuditGroup(AuditStatus.FAILED, 'Failed to Fix sizing');
        }
    } catch (error) {
        errorMessage = `Error while fixing sizing: ${error}`;
        logger.error(errorMessage);
        jobStatus = JOBSTATUS.FAILED;
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);
    } finally {
        // Update parent job status only if assessment is skipped which is true when actual optimization fails
        if (jobStatus === JOBSTATUS.FAILED) {
            await updateJobDetails(accountId, parentJobId, {
                status: jobStatus,
                endTime: Date.now(),
                error: errorMessage
            });
        }
    }
}

async function headroomOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    fileSystemId: string,
    parentJobId: string,
    serverNameWithHostName: string
) {
    logger.info('Optimizing FSx for NetApp ONTAP headroom ', { accountId, credentialsId, region, fileSystemId });
    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        serverNameWithHostName,
        JOBTYPE.WELL_ARCHITECTED,
        'Fix FSx for NetApp ONTAP headroom',
        'Fix FSx for NetApp ONTAP headroom',
        parentJobId
    );

    let jobStatus;
    let errorMessage;
    try {
        const { headroomPercent, ssdStorageCapacityInBytes, totalUsed } = await getHeadroomDrift(
            credentialsId,
            region,
            fileSystemId
        );

        if (headroomPercent < 35) {
            logger.info('Under provisioned: Headroom is less than 35%');

            const fsxInfo = await describeFSx(credentialsId, region, { FileSystemIds: [fileSystemId] }, undefined, {
                useCache: true
            });
            const [fileSystem = {}] = fsxInfo?.FileSystems || []; // first item in the list
            const existingFsxStorageCapacityGiB = fileSystem?.StorageCapacity;
            const newFsxStorageCapactiyGiB = calculateFsxStorageCapacityForHeadroomOptimization(
                totalUsed,
                ssdStorageCapacityInBytes
            );
            if (existingFsxStorageCapacityGiB && existingFsxStorageCapacityGiB < newFsxStorageCapactiyGiB) {
                return updateFsxCapacity(credentialsId, region, accountId, fileSystemId, newFsxStorageCapactiyGiB);
            }
            errorMessage =
                'Headroom configuration changed since the last assessment and meets best practices. No action required.';
            jobStatus = JOBSTATUS.WARNING;
        }
        errorMessage = 'Headroom is more than 35%, no action required';
        jobStatus = JOBSTATUS.WARNING;
    } catch (error) {
        errorMessage = `Error while fixing headroom sizing ${error}`;
        jobStatus = JOBSTATUS.FAILED;
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus || JOBSTATUS.COMPLETED,
            endTime: Date.now(),
            error: errorMessage
        });
    }
    return { jobStatus, errorMessage };
}

async function resizeLun(
    credentialsId: string,
    region: string,
    fileSystemId: string,
    lunUuid: string,
    diskSerialNumber: string,
    requiredLunSizeBytes: number,
    activeNodeInstanceId: string
) {
    logger.info('Resizing LUN ', {
        credentialsId,
        region,
        fileSystemId,
        lunUuid,
        diskSerialNumber,
        requiredLunSizeBytes,
        activeNodeInstanceId
    });

    const apiEndpoint = `/storage/luns/${lunUuid}`;

    const ssmCommand = OPTIMIZE_STORAGE_PARAMS_SCRIPT({
        fsxId: fileSystemId,
        region,
        apiEndpoint,
        apiQueryFilter: '',
        apiBody: JSON.stringify({ space: { size: requiredLunSizeBytes } })
    });
    const rescanExtendLunSsmCommand = RESCAN_EXTEND_LUN(diskSerialNumber);
    try {
        const response = await retryWithDelay(
            callSsmExecution.bind(null, {
                credentialsId,
                region,
                commands: [ssmCommand, rescanExtendLunSsmCommand],
                ec2InstanceId: activeNodeInstanceId,
                comment: 'Optimizing storage'
            })
        );

        const [{ error: optimiseStorageParamsCommandError } = {}, { error: rescanExtendLunSsmCommandError } = {}] =
            parseMultipleCommandResponse(response);
        const errorMessages = [];

        if (optimiseStorageParamsCommandError) {
            errorMessages.push(`Optimise Storage Params Command Error: ${optimiseStorageParamsCommandError}`);
        }

        if (rescanExtendLunSsmCommandError) {
            errorMessages.push(`Rescan Extend LUN SSM Command Error: ${rescanExtendLunSsmCommandError}`);
        }

        if (errorMessages.length > 0) {
            throw new Error(errorMessages.join(' | '));
        }
    } catch (error) {
        throw createError(400, `Error while resizing LUN ${error}`);
    }
}

async function logDriveOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    fileSystemId: string,
    logDriveDetails: LogDriveDetails[],
    parentJobId: string,
    serverNameWithHostName: string,
    databaseHostId: string,
    databaseInstanceId: string,
    activeNodeInstanceId: string,
    objectsToOptimize?: string[]
) {
    logger.info('Optimizing log drive ', {
        accountId,
        credentialsId,
        region,
        fileSystemId,
        parentJobId,
        serverNameWithHostName,
        databaseHostId,
        databaseInstanceId,
        activeNodeInstanceId,
        objectsToOptimize
    });
    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        serverNameWithHostName,
        JOBTYPE.WELL_ARCHITECTED,
        'Fix log drive sizing',
        'Fix log drive sizing',
        parentJobId
    );

    let { underProvisionedDrives } = getLogVolumeDrift(
        logDriveDetails,
        AssessmentStatus.UNDER_PROVISIONED,
        'log-drive-size'
    );

    let jobStatus: string = '';
    let errorMessage: string = '';
    try {
        if (underProvisionedDrives.length > 0) {
            let underProvisionedOntapVolIds = compact(underProvisionedDrives.map(drive => drive.ontapVolumeUuid)) || [];
            if (objectsToOptimize && !isEmpty(objectsToOptimize)) {
                underProvisionedDrives = underProvisionedDrives.filter(
                    drive => drive.logAccessPath && objectsToOptimize.includes(drive.logAccessPath)
                );
                underProvisionedOntapVolIds = compact(underProvisionedDrives.map(drive => drive.ontapVolumeUuid)) || [];
            }
            const { volumeIds: fsxVolumeIdList, uuidVolumeIdMap } = await getFsxnVolIdsFromOntapVolIds(
                credentialsId,
                region,
                fileSystemId,
                underProvisionedOntapVolIds
            );

            const underProvisionedVolumeDetails = await getFsxVolumeDetails(
                credentialsId,
                region,
                fileSystemId,
                fsxVolumeIdList
            );

            await Promise.all(
                underProvisionedDrives.map(async (drive: SizingViolationResponseType) => {
                    const { dataDriveTotalSizeMB = 0, lunUuid, diskSerialNumber, ontapVolumeUuid } = drive;
                    if (dataDriveTotalSizeMB > 0) {
                        const requiredLogLunSizeBytes = convertToBytes(dataDriveTotalSizeMB * 0.25, 'MiB') || 0;
                        const requiredLogVolumeSizeBytes = 1.1 * requiredLogLunSizeBytes;

                        const [matchingFsxVolumeId] =
                            Object.entries(uuidVolumeIdMap).find(
                                ([, ontapVolumeId]) => ontapVolumeId === ontapVolumeUuid
                            ) || [];
                        const existingVolumeDetails = underProvisionedVolumeDetails.find(
                            volume => volume.VolumeId === matchingFsxVolumeId
                        );

                        if (matchingFsxVolumeId && existingVolumeDetails && lunUuid && diskSerialNumber) {
                            ({ errorMessage, jobStatus } = await resizeVolumeAndLunSize(
                                'Log',
                                existingVolumeDetails,
                                requiredLogVolumeSizeBytes,
                                credentialsId,
                                region,
                                accountId,
                                fileSystemId,
                                matchingFsxVolumeId,
                                lunUuid,
                                activeNodeInstanceId,
                                requiredLogLunSizeBytes,
                                diskSerialNumber,
                                errorMessage,
                                jobStatus
                            ));
                        } else if (IS_DEMO_FLOW) {
                            logger.error('Cannot find matching FSx volume or LUN for the log drive');
                        } else {
                            throw createError(400, 'Cannot find matching FSx volume or LUN for the log drive');
                        }
                    } else {
                        throw createError(400, 'Data drive size is unavailable, cannot calculate log drive size');
                    }
                })
            );
        } else {
            errorMessage = 'Log drives are not under provisioned, no action required';
            jobStatus = JOBSTATUS.WARNING;
        }
    } catch (error) {
        errorMessage = `Error while fixing log volume sizing ${error}`;
        jobStatus = JOBSTATUS.FAILED;
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus || JOBSTATUS.COMPLETED,
            endTime: Date.now(),
            error: errorMessage
        });
    }
    return { jobStatus, errorMessage };
}

async function resizeVolumeAndLunSize(
    driveType: string,
    existingVolumeDetails: Volume,
    requiredVolumeSizeBytes: number,
    credentialsId: string,
    region: string,
    accountId: string,
    fileSystemId: string,
    matchingFsxVolumeId: string,
    lunUuid: string,
    activeNodeInstanceId: string,
    requiredLunSizeBytes: number,
    diskSerialNumber: string,
    errorMessage: string,
    jobStatus: string
) {
    logger.info('Resizing volume and LUN size ', {
        driveType,
        existingVolumeDetails,
        requiredVolumeSizeBytes,
        credentialsId,
        region,
        accountId,
        fileSystemId,
        matchingFsxVolumeId,
        lunUuid,
        activeNodeInstanceId,
        requiredLunSizeBytes,
        diskSerialNumber,
        errorMessage,
        jobStatus
    });

    if (
        existingVolumeDetails?.OntapConfiguration?.SizeInBytes &&
        existingVolumeDetails.OntapConfiguration.SizeInBytes < requiredVolumeSizeBytes
    ) {
        requiredVolumeSizeBytes = Math.round(requiredVolumeSizeBytes); // rounding off to nearest integer
        await updateVolumeSizeAndWaitForUpdate(
            credentialsId,
            region,
            accountId,
            fileSystemId,
            matchingFsxVolumeId,
            requiredVolumeSizeBytes
        );
        logger.info(`${driveType} volume size increased to ${requiredVolumeSizeBytes} bytes.`);
    } else {
        logger.info(
            `${driveType} drives were reconfigured since the last assessment and meet best practices. No action required.`
        );
    }

    const ssmCommand = GET_ONTAP_LUN_DETAILS({
        fsxId: fileSystemId,
        region,
        apiEndpoint: `/storage/luns/${lunUuid}`,
        apiQueryFilter: 'fields=space'
    });
    const ssmComment = 'Get ONTAP LUN details';

    const resp = await callSsmExecution({
        credentialsId,
        region,
        commands: [ssmCommand],
        ec2InstanceId: activeNodeInstanceId!,
        comment: ssmComment
    });
    const parsedResp = sqlResponseParsing(resp);
    const {
        space: { size: existingLogLunSizeBytes }
    } = parsedResp || {};
    if (existingLogLunSizeBytes < requiredLunSizeBytes) {
        await resizeLun(
            credentialsId,
            region,
            fileSystemId,
            lunUuid!,
            diskSerialNumber!,
            requiredLunSizeBytes,
            activeNodeInstanceId
        );
        logger.info(`${driveType} LUN size increased to ${requiredLunSizeBytes} bytes.`);
    } else {
        logger.info(`${driveType} LUN size changed since we last assessed, no action required`);
    }

    if (
        existingVolumeDetails?.OntapConfiguration?.SizeInBytes &&
        existingVolumeDetails.OntapConfiguration.SizeInBytes >= requiredLunSizeBytes &&
        existingLogLunSizeBytes >= requiredLunSizeBytes
    ) {
        errorMessage = `${driveType} drives size changed since the last assessment and meets best practices. No action required.`;
        jobStatus = JOBSTATUS.WARNING;
    }
    return { errorMessage, jobStatus };
}

async function tempDbDriveOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    fileSystemId: string,
    tempDbDriveDetails: TempDbDriveDetails,
    parentJobId: string,
    serverNameWithHostName: string,
    databaseHostId: string,
    databaseInstanceId: string,
    activeNodeInstanceId: string
) {
    logger.info('Optimizing temp db drive ', {
        accountId,
        credentialsId,
        region,
        fileSystemId,
        tempDbDriveDetails,
        parentJobId,
        serverNameWithHostName,
        databaseHostId,
        databaseInstanceId,
        activeNodeInstanceId
    });
    let errorMessage = '';
    let jobStatus = '';
    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        serverNameWithHostName,
        JOBTYPE.WELL_ARCHITECTED,
        'Fix tempdb drive sizing',
        'Fix tempdb drive sizing',
        parentJobId
    );

    try {
        const { dataDriveTotalSizeMB, tempdbPercent, ontapVolumeUuid, underProvisionedDrives } = getTempDbVolumeDrift(
            tempDbDriveDetails,
            AssessmentStatus.UNDER_PROVISIONED,
            'tempdb-drive-size'
        );

        if (tempdbPercent < 10) {
            const [{ diskSerialNumber, lunUuid }] = underProvisionedDrives;
            const requiredTempDbLunSizeBytes = convertToBytes(dataDriveTotalSizeMB * 0.1, 'MiB') || 0;
            const requiredTempDbVolumeSizeBytes = 1.1 * requiredTempDbLunSizeBytes;

            // get the volume ID from the drive details, make a get call to check if the volume size is less than requiredTempDbVolumeSizeBytes and update the volume size
            const {
                volumeIds: [tempDbFsxVolumeId]
            } = await getFsxnVolIdsFromOntapVolIds(credentialsId, region, fileSystemId, [ontapVolumeUuid]);

            const [existingVolumeDetails] = await getFsxVolumeDetails(credentialsId, region, fileSystemId, [
                tempDbFsxVolumeId
            ]);

            if (diskSerialNumber && lunUuid) {
                ({ errorMessage, jobStatus } = await resizeVolumeAndLunSize(
                    'TempDb',
                    existingVolumeDetails,
                    requiredTempDbVolumeSizeBytes,
                    credentialsId,
                    region,
                    accountId,
                    fileSystemId,
                    tempDbFsxVolumeId,
                    lunUuid,
                    activeNodeInstanceId,
                    requiredTempDbLunSizeBytes,
                    diskSerialNumber,
                    errorMessage,
                    jobStatus
                ));
            } else {
                throw createError(400, 'Cannot find LUN for the tempdb drive');
            }
        } else {
            errorMessage = 'TempDB drives are not under provisioned, no action required';
            jobStatus = JOBSTATUS.WARNING;
        }
    } catch (error) {
        errorMessage = `Error while fixing tempDb sizing ${error}`;
        jobStatus = JOBSTATUS.FAILED;
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus || JOBSTATUS.COMPLETED,
            endTime: Date.now(),
            error: errorMessage
        });
    }
    return { jobStatus, errorMessage };
}

async function optimizeSizing(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    types: OPTIMIZE_SIZING_CONFIGS[],
    masterOptimizeParentId?: string,
    objectsToOptimize?: string[]
) {
    logger.info('Optimizing sizing ', { accountId, credentialsId, region, databaseHostId, databaseInstanceId, types });

    if (types.length === 0) {
        logger.info(`Optimization body is empty ${databaseInstanceId} in ${region}`);
        throw createError(HttpErrorCodes.BAD_REQUEST, 'Optimization body is empty');
    }

    const {
        items: [persistedConfigurationData]
    } = await paginateListInstanceConfigData({
        accountId,
        region,
        credentialsId,
        resourceId: databaseHostId,
        databaseInstanceId,
        configDataType: AssessmentCategories.STORAGE,
        pageSize: 1,
        includeResource: true,
        includeDatabaseInstance: true
    });
    const {
        config_data: configData,
        database_instances: { database_instance_name: instanceName = '' } = {},
        resource: { resource_name: sqlServerName = '' } = {}
    } = persistedConfigurationData || {};
    const storageAssessmentConfigData = configData as unknown as StorageAssessment;
    const { filesystemId = '' } = storageAssessmentConfigData || {};

    if (!instanceName || !sqlServerName) {
        logger.error('Instance name or sql server name is missing');
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Instance name or sql server name is missing');
    }

    const jobMetadata: JobMetadata = {
        hostsToOptimize: [
            { optimizationType: types[0], resourceId: databaseHostId, sqlServerInstances: [databaseInstanceId] }
        ]
    };

    const serverNameWithHostName = getServerNameWithHostname(sqlServerName, instanceName);
    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        serverNameWithHostName,
        JOBTYPE.WELL_ARCHITECTED,
        `Fix ${types} sizing for ${serverNameWithHostName}`,
        `Fix ${types} sizing for ${serverNameWithHostName}`,
        masterOptimizeParentId,
        jobMetadata
    );

    modifySizingAttributes(
        accountId,
        credentialsId,
        region,
        filesystemId,
        types,
        jobId,
        storageAssessmentConfigData,
        serverNameWithHostName,
        databaseHostId,
        databaseInstanceId,
        objectsToOptimize
    );

    return { jobId };
}

async function validateMpioPolicyToRoundRobin(
    optimizeMpioPolicyParams: OptimizeMpioPolicyParams,
    preCheck: boolean = false,
    runningOnPrimaryNode: boolean = true
) {
    logger.info(`Validate MPIO policy to Round Robin for ${optimizeMpioPolicyParams} on ${runningOnPrimaryNode}`);
    const {
        accountId,
        credentialsId,
        region,
        parentJobId,
        serverNameWithHostName,
        activeNodeInstanceId,
        standbyNodeInstanceId
    } = optimizeMpioPolicyParams;

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;
    const jobDescription =
        optimizeMpioPolicyParams.sqlDeploymentType !== 'Standalone'
            ? `Check current MPIO policy on ${
                  runningOnPrimaryNode ? 'primary node' : 'standby node'
              } in ${serverNameWithHostName}.`
            : `Check current MPIO policy in ${serverNameWithHostName}`;
    let parsedValidateMPIOPolicyChangeResponse;

    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        serverNameWithHostName,
        JOBTYPE.WELL_ARCHITECTED,
        jobDescription,
        jobDescription,
        parentJobId
    );

    try {
        const ssmComment = 'Check MPIO policy';
        const validateMPIOPolicyChangeResponse = await callSsmExecution({
            credentialsId,
            region,
            commands: [CHECK_MPIO_POLICY],
            ec2InstanceId: runningOnPrimaryNode ? activeNodeInstanceId! : standbyNodeInstanceId!,
            comment: ssmComment,
            accountId
        });
        parsedValidateMPIOPolicyChangeResponse = sqlResponseParsing(validateMPIOPolicyChangeResponse);
        if (!parsedValidateMPIOPolicyChangeResponse.remediated && !preCheck) {
            const errorMessage = `Failed to set MPIO policy to Round Robin on ${serverNameWithHostName}.`;
            logger.error(errorMessage);
            jobStatus = JOBSTATUS.FAILED;
            jobError = errorMessage;
            throw errorMessage;
        } else {
            await updateJobDetails(accountId, jobId, {
                status: JOBSTATUS.COMPLETED,
                endTime: Date.now()
            });
        }
    } catch (error) {
        const errorMessage = `Error while validating MPIO policy to Round Robin ${error}`;
        logger.error(errorMessage);
        jobStatus = JOBSTATUS.FAILED;
        jobError = errorMessage;
        throw errorMessage;
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
    }
    return parsedValidateMPIOPolicyChangeResponse;
}

async function setMpioPolicyToRoundRobin(
    optimizeMpioPolicyParams: OptimizeMpioPolicyParams,
    runningOnPrimaryNode: boolean = true
) {
    logger.info(`Setting MPIO policy to Round Robin for ${optimizeMpioPolicyParams} on ${runningOnPrimaryNode}`);
    const {
        accountId,
        credentialsId,
        region,
        parentJobId,
        serverNameWithHostName,
        sqlDeploymentType,
        activeNodeInstanceId,
        standbyNodeInstanceId
    } = optimizeMpioPolicyParams;

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    const jobDescription =
        sqlDeploymentType !== SqlServerDeploymentModel.SQL_STANDALONE_SHORT
            ? `Setting MPIO policy to Round Robin on ${serverNameWithHostName} and changing cluster ownership on ${
                  runningOnPrimaryNode ? 'primary node' : 'standby node'
              }.`
            : `Setting MPIO policy to Round Robin on ${serverNameWithHostName}.`;
    let jobError;

    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        serverNameWithHostName,
        JOBTYPE.WELL_ARCHITECTED,
        jobDescription,
        jobDescription,
        parentJobId
    );

    try {
        // Set MPIO policy to Round Robin
        const ssmCommand = REMEDIATE_MPIO_POLICY(optimizeMpioPolicyParams, runningOnPrimaryNode);
        const ssmComment = 'Remediate MPIO policy';
        await retryWithDelay(
            callSsmExecution.bind(null, {
                credentialsId,
                region,
                commands: [ssmCommand],
                ec2InstanceId: runningOnPrimaryNode ? activeNodeInstanceId! : standbyNodeInstanceId!,
                comment: ssmComment
            })
        );
    } catch (error) {
        const errorMessage = `Error while setting MPIO policy to Round Robin ${error}`;
        logger.error(errorMessage);
        jobStatus = JOBSTATUS.FAILED;
        jobError = errorMessage;
        throw errorMessage;
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError,
            description: jobDescription
        });
    }
}

async function validateAndRemediateMpioPolicy(
    optimizeMpioPolicyParams: OptimizeMpioPolicyParams,
    runningOnPrimaryNode: boolean
) {
    logger.info(
        `Validating and remediating MPIO policy to Round Robin for ${optimizeMpioPolicyParams} ${runningOnPrimaryNode}`
    );
    const validateMpioPolicyToRoundRobinResponse = await validateMpioPolicyToRoundRobin(
        optimizeMpioPolicyParams,
        true,
        runningOnPrimaryNode
    );

    // Policy set on the node
    optimizeMpioPolicyParams.activeNodeCurrentPolicy = validateMpioPolicyToRoundRobinResponse.policy;

    if (!validateMpioPolicyToRoundRobinResponse.remediated) {
        optimizeMpioPolicyParams.changeClusterOwnership = !validateMpioPolicyToRoundRobinResponse.remediated;
        await setMpioPolicyToRoundRobin(optimizeMpioPolicyParams, runningOnPrimaryNode);
        await validateMpioPolicyToRoundRobin(optimizeMpioPolicyParams, false, runningOnPrimaryNode);
    }
}

async function optimizeMpio(optimizeMpioPolicyParams: OptimizeMpioPolicyParams) {
    const {
        accountId,
        credentialsId,
        region,
        parentJobId,
        fsxId,
        instanceId,
        instanceName,
        databaseType,
        sqlAuthEnabled,
        serverNameWithHostName,
        databaseHostId,
        awsAccountId,
        activeNodeInstanceId,
        sqlDeploymentType,
        instanceMetadata
    } = optimizeMpioPolicyParams;

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;
    try {
        // For primary node
        // Check if MPIO policy is set to Round Robin
        // If not, set MPIO policy to Round Robin
        // If FCI, change cluster ownership
        await validateAndRemediateMpioPolicy(optimizeMpioPolicyParams, true);

        if (sqlDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT) {
            // For standby node
            // Check if MPIO policy is set to Round Robin
            // Case Not set to RR on standby
            // 1. Check if ownership was changed from primary to standby, if yes change back to primary
            // Case set to RR on standby
            // 1. Check if ownership was changed from primary to standby, if yes change back to primary. Else no action needed
            await validateAndRemediateMpioPolicy(optimizeMpioPolicyParams, false);
        }

        if (IS_DEMO_FLOW) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                instanceId,
                ['mpio-load-balance-policy'],
                'OS',
                instanceMetadata || {}
            );
        }

        // Trigger assessment after optimization
        const instanceToAssess: WorkloadInstance = {
            id: instanceId,
            name: instanceName,
            type: databaseType,
            region,
            sqlAuthEnabled: sqlAuthEnabled || false,
            fsxFileSystem: fsxId,
            activeNodeInstanceid: activeNodeInstanceId!,
            resourceName: serverNameWithHostName,
            cloudProviderAccountId: awsAccountId
        };
        await triggerAssessmentAfterOptimization(
            credentialsId,
            region,
            accountId,
            databaseHostId,
            serverNameWithHostName,
            parentJobId,
            instanceToAssess,
            AssessmentCategories.STORAGE
        );
    } catch (error) {
        jobError = `Error while fixing mpio configuration ${error}`;
        jobStatus = JOBSTATUS.FAILED;
        await updateJobDetails(accountId, parentJobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
    } finally {
        updateLongRunningAuditGroup(
            jobStatus === JOBSTATUS.COMPLETED ? AuditStatus.SUCCESS : AuditStatus.FAILED,
            JOBSTATUS.COMPLETED ? '' : jobError
        );
    }
}

async function configureMpio(
    optimizeMpioParams: OptimizeMpioIscsiSessionsParams,
    runningOnPrimaryNode: boolean = true
) {
    const {
        accountId,
        credentialsId,
        region,
        parentJobId,
        serverNameWithHostName,
        activeNodeInstanceId,
        standbyNodeInstanceId,
        sqlDeploymentType,
        iscsiTargetAddresses
    } = optimizeMpioParams;

    logger.info(`Configure MPIO on ${optimizeMpioParams}`);

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;
    const jobDescription =
        sqlDeploymentType !== 'Standalone'
            ? `Configure MPIO on ${
                  runningOnPrimaryNode ? 'primary node' : 'standby node'
              } in ${serverNameWithHostName}.`
            : `Configure MPIO on ${serverNameWithHostName}`;

    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        serverNameWithHostName,
        JOBTYPE.WELL_ARCHITECTED,
        jobDescription,
        jobDescription,
        parentJobId
    );

    try {
        const response = await retryWithDelay(
            callSsmExecution.bind(null, {
                credentialsId,
                region,
                commands: [ENABLE_MPIO_AND_CONFIGURE(iscsiTargetAddresses)],
                ec2InstanceId: runningOnPrimaryNode ? activeNodeInstanceId! : standbyNodeInstanceId!,
                comment: jobDescription,
                accountId
            })
        );
        const { status, error } = sqlResponseParsing(response);
        if (status === 'failed') {
            jobError = `Error while configuring MPIO iscsi sessions on ${serverNameWithHostName}. ${error}.`;
            jobStatus = JOBSTATUS.FAILED;
        } else if (status === 'warning') {
            jobError = error;
            jobStatus = JOBSTATUS.WARNING;
        } else {
            jobStatus = JOBSTATUS.COMPLETED;
        }
    } catch (error) {
        jobError = `Error while configuring MPIO iscsi sessions on ${error}`;
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
    }
    return jobStatus;
}

async function checkMpioInstallation(
    optimizeMpioParams: OptimizeMpioIscsiSessionsParams,
    runningOnPrimaryNode: boolean = true
) {
    logger.info(`Check if MPIO is installed ${optimizeMpioParams}`);
    const {
        accountId,
        credentialsId,
        region,
        parentJobId,
        serverNameWithHostName,
        activeNodeInstanceId,
        standbyNodeInstanceId,
        sqlDeploymentType
    } = optimizeMpioParams;

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;
    const jobDescription =
        sqlDeploymentType !== 'Standalone'
            ? `Check if MPIO is installed on ${
                  runningOnPrimaryNode ? 'primary node' : 'standby node'
              } in ${serverNameWithHostName}.`
            : `Check if MPIO is installed on ${serverNameWithHostName}`;

    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        serverNameWithHostName,
        JOBTYPE.WELL_ARCHITECTED,
        jobDescription,
        jobDescription,
        parentJobId
    );

    let mpioInstalled = false;
    try {
        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: [CHECK_IF_MPIO_INSTALLED],
            ec2InstanceId: runningOnPrimaryNode ? activeNodeInstanceId! : standbyNodeInstanceId!,
            comment: jobDescription,
            accountId
        });
        const parsedResponse = sqlResponseParsing(response);
        mpioInstalled = parsedResponse.mpioInstalled;
        if (!mpioInstalled) {
            const errorMessage = `MPIO is not installed on ${serverNameWithHostName}.`;
            logger.error(errorMessage);
            jobStatus = JOBSTATUS.FAILED;
            jobError = errorMessage;
            throw errorMessage;
        } else {
            jobStatus = JOBSTATUS.COMPLETED;
        }
    } catch (error) {
        jobError = `Error while checking MPIO installation ${error}`;
        logger.error(jobError);
        jobStatus = JOBSTATUS.FAILED;
        throw new Error(jobError);
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
    }
    return mpioInstalled;
}

async function enableMpioAndConfigureSessions(optimizeMpioParams: OptimizeMpioIscsiSessionsParams) {
    const {
        accountId,
        credentialsId,
        region,
        parentJobId,
        fsxId,
        instanceId,
        instanceName,
        serverNameWithHostName,
        databaseHostId,
        awsAccountId,
        activeNodeInstanceId,
        sqlDeploymentType,
        instanceMetadata,
        databaseType,
        sqlAuthEnabled
    } = optimizeMpioParams;

    logger.info(`Enabling MPIO and configuring iSCSI sessions for ${optimizeMpioParams}`);

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;

    try {
        // Run validation and configuration on primary node
        const isMpioInstalledOnPrimary = await checkMpioInstallation(optimizeMpioParams);
        let primaryConfigureMpioJobStatus;
        if (isMpioInstalledOnPrimary) {
            primaryConfigureMpioJobStatus = await configureMpio(optimizeMpioParams);
        }

        // Run validation and configuration on standby node
        let standbyConfigureMpioJobStatus;
        if (sqlDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT) {
            const isMpioInstalledOnStandby = await checkMpioInstallation(optimizeMpioParams, false);
            if (isMpioInstalledOnStandby) {
                standbyConfigureMpioJobStatus = await configureMpio(optimizeMpioParams, false);
            }
        }

        if (sqlDeploymentType !== SqlServerDeploymentModel.SQL_FCI_SHORT) {
            if (primaryConfigureMpioJobStatus === JOBSTATUS.FAILED) {
                jobStatus = JOBSTATUS.FAILED;
                jobError = `Error while enabling MPIO and configuring MPIO sessions on ${serverNameWithHostName}.`;
            }
        } else if (
            primaryConfigureMpioJobStatus === JOBSTATUS.FAILED ||
            standbyConfigureMpioJobStatus === JOBSTATUS.FAILED
        ) {
            jobStatus = JOBSTATUS.FAILED;
            jobError = `Error while enabling MPIO and configuring MPIO sessions on ${serverNameWithHostName}.`;
        }

        if (IS_DEMO_FLOW) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                instanceId,
                [OptimizeOperatingSystemParams.MPIO_ENABLE],
                'OS',
                instanceMetadata || {}
            );
        }

        if (jobStatus !== JOBSTATUS.FAILED) {
            // Trigger assessment after optimization
            const instanceToAssess: WorkloadInstance = {
                id: instanceId,
                name: instanceName,
                type: databaseType,
                region,
                sqlAuthEnabled: sqlAuthEnabled || false,
                fsxFileSystem: fsxId,
                activeNodeInstanceid: activeNodeInstanceId!,
                resourceName: serverNameWithHostName,
                cloudProviderAccountId: awsAccountId
            };
            await triggerAssessmentAfterOptimization(
                credentialsId,
                region,
                accountId,
                databaseHostId,
                serverNameWithHostName,
                parentJobId,
                instanceToAssess,
                AssessmentCategories.STORAGE
            );
        }
    } catch (error) {
        jobError = `Error while enabling MPIO and configuring MPIO sessions ${error}`;
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, parentJobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
        if (jobStatus === JOBSTATUS.FAILED) {
            updateLongRunningAuditGroup(AuditStatus.FAILED, jobError);
        }
    }
}

async function validateMpioSessions(
    optimizeMpioisSessionsParams: OptimizeMpioIscsiSessionsParams,
    runningOnPrimaryNode: boolean = true
) {
    logger.info(`Validating MPIO iSCSI sessions for ${optimizeMpioisSessionsParams}`);
    const {
        accountId,
        credentialsId,
        region,
        parentJobId,
        serverNameWithHostName,
        activeNodeInstanceId,
        standbyNodeInstanceId,
        sqlDeploymentType,
        iscsiTargetAddresses
    } = optimizeMpioisSessionsParams;

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;
    const jobDescription =
        sqlDeploymentType !== 'Standalone'
            ? `Validate MPIO iSCSI sessions on ${
                  runningOnPrimaryNode ? 'primary node' : 'standby node'
              } in ${serverNameWithHostName}.`
            : `Validate MPIO iSCSI sessions in ${serverNameWithHostName}`;
    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        serverNameWithHostName,
        JOBTYPE.WELL_ARCHITECTED,
        jobDescription,
        jobDescription,
        parentJobId
    );

    let parsedResponse;
    try {
        const ssmCommand = MPIO_ISCSI_SESSIONS(iscsiTargetAddresses);
        const ssmComment = 'Remediate MPIO ICSI session';
        const validateMpioSessionsResponse = await retryWithDelay(
            callSsmExecution.bind(null, {
                credentialsId,
                region,
                commands: [ssmCommand],
                ec2InstanceId: runningOnPrimaryNode ? activeNodeInstanceId! : standbyNodeInstanceId!,
                comment: ssmComment,
                accountId
            })
        );
        parsedResponse = sqlResponseParsing(validateMpioSessionsResponse);
        jobStatus = JOBSTATUS.COMPLETED;
    } catch (error) {
        jobError = `Error while validating MPIO iSCSI sessions  ${error}`;
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
    }
    if (jobStatus === JOBSTATUS.FAILED) {
        throw new Error(jobError);
    }
    return parsedResponse;
}

async function remediateMpioSessions(
    optimizeMpioisSessionsParams: OptimizeMpioIscsiSessionsParams,
    runningOnPrimaryNode: boolean = true
) {
    const {
        accountId,
        credentialsId,
        region,
        parentJobId,
        serverNameWithHostName,
        activeNodeInstanceId,
        standbyNodeInstanceId,
        sqlDeploymentType
    } = optimizeMpioisSessionsParams;

    logger.info(
        `Remediating MPIO iSCSI sessions for ${accountId}, ${credentialsId}, ${region}, ${parentJobId}, ${serverNameWithHostName}, ${activeNodeInstanceId}, ${standbyNodeInstanceId}`
    );

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;
    const jobDescription =
        sqlDeploymentType !== 'Standalone'
            ? `Remediate MPIO iSCSI sessions on ${
                  runningOnPrimaryNode ? 'primary node' : 'standby node'
              } in ${serverNameWithHostName}.`
            : `Remediate MPIO iSCSI sessions in ${serverNameWithHostName}`;
    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        serverNameWithHostName,
        JOBTYPE.WELL_ARCHITECTED,
        jobDescription,
        jobDescription,
        parentJobId
    );

    let parsedResponse;
    try {
        const ssmCommand = REMEDIATE_MPIO_ISCSI_SESSIONS(optimizeMpioisSessionsParams.currentMpioSessionsCount);
        const remediateResponse = await retryWithDelay(
            callSsmExecution.bind(null, {
                credentialsId,
                region,
                commands: [ssmCommand],
                ec2InstanceId: runningOnPrimaryNode ? activeNodeInstanceId! : standbyNodeInstanceId!,
                comment: jobDescription,
                accountId
            })
        );
        parsedResponse = sqlResponseParsing(remediateResponse);
        jobStatus = parsedResponse.every((address: { status: string }) => address.status === 'success')
            ? JOBSTATUS.COMPLETED
            : parsedResponse.every((address: { status: string }) => address.status === 'failed')
            ? JOBSTATUS.FAILED
            : JOBSTATUS.WARNING;
    } catch (error) {
        jobError = `Error while remediating MPIO iSCSI sessions  ${error}`;
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
    }
    return jobStatus;
}

async function optimizeMpioSessions(optimizeMpioisSessionsParams: OptimizeMpioIscsiSessionsParams) {
    const {
        accountId,
        credentialsId,
        region,
        parentJobId,
        fsxId,
        svmId,
        instanceId,
        instanceName,
        serverNameWithHostName,
        databaseHostId,
        awsAccountId,
        activeNodeInstanceId,
        sqlDeploymentType,
        databaseType,
        instanceMetadata,
        sqlAuthEnabled,
        standbyNodeInstanceId
    } = optimizeMpioisSessionsParams;

    logger.info(
        `Optimizing MPIO iSCSI sessions for ${accountId}, ${credentialsId}, ${region}, ${parentJobId}, ${fsxId}, ${svmId}, ${instanceId}, ${instanceName}, ${serverNameWithHostName}, ${databaseHostId}, ${awsAccountId}, ${activeNodeInstanceId}, ${sqlDeploymentType}, ${standbyNodeInstanceId}`
    );

    let violationsPrimaryNode = [];
    let violationsStandbyNode = [];

    // Run validation on primary node
    try {
        const sessionsPerTargetOnPrimaryNode = await validateMpioSessions(optimizeMpioisSessionsParams);
        violationsPrimaryNode = sessionsPerTargetOnPrimaryNode.filter(
            (address: { count: number }) => address.count !== 5
        );

        if (sqlDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT) {
            // Run validation on standby node
            const sessionsPerTargetOnStandbyNode = await validateMpioSessions(optimizeMpioisSessionsParams, false);
            violationsStandbyNode = sessionsPerTargetOnStandbyNode.filter(
                (address: { count: number }) => address.count !== 5
            );
        }
    } catch (error) {
        const errorMessage = `Error while validating MPIO iSCSI sessions ${error}`;
        await updateJobDetails(accountId, parentJobId, {
            status: JOBSTATUS.FAILED,
            endTime: Date.now(),
            error: errorMessage
        });
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);
        return;
    }
    if (isEmpty(violationsPrimaryNode) && isEmpty(violationsStandbyNode)) {
        const instanceToAssess: WorkloadInstance = {
            id: instanceId,
            name: instanceName,
            type: databaseType,
            region,
            sqlAuthEnabled: sqlAuthEnabled || false,
            fsxFileSystem: fsxId,
            activeNodeInstanceid: activeNodeInstanceId!,
            cloudProviderAccountId: awsAccountId,
            resourceName: serverNameWithHostName
        };

        if (IS_DEMO_FLOW) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                instanceId,
                [OptimizeOperatingSystemParams.MPIO_SESSIONS],
                'OS',
                instanceMetadata || {}
            );
        }

        await triggerAssessmentAfterOptimization(
            credentialsId,
            region,
            accountId,
            databaseHostId,
            serverNameWithHostName,
            parentJobId,
            instanceToAssess,
            AssessmentCategories.STORAGE
        );
    } else {
        // Run remediation on primary node
        let primaryRemediateJobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
        let standbyRemediateJobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;

        if (!isEmpty(violationsPrimaryNode)) {
            optimizeMpioisSessionsParams.currentMpioSessionsCount = violationsPrimaryNode;
            primaryRemediateJobStatus = await remediateMpioSessions(optimizeMpioisSessionsParams);
        }

        // Run remediation on standby node
        if (sqlDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT && !isEmpty(violationsStandbyNode)) {
            optimizeMpioisSessionsParams.currentMpioSessionsCount = violationsStandbyNode;

            standbyRemediateJobStatus = await remediateMpioSessions(optimizeMpioisSessionsParams, false);
        }

        if (primaryRemediateJobStatus === JOBSTATUS.FAILED || standbyRemediateJobStatus === JOBSTATUS.FAILED) {
            await updateJobDetails(accountId, parentJobId, {
                status: JOBSTATUS.FAILED,
                endTime: Date.now()
            });
            await updateLongRunningAuditGroup(
                AuditStatus.FAILED,
                `Failed to remediate MPIO iSCSI sessions on ${serverNameWithHostName}`
            );
        } else {
            const instanceToAssess: WorkloadInstance = {
                id: instanceId,
                name: instanceName,
                type: databaseType,
                region,
                sqlAuthEnabled: sqlAuthEnabled || false,
                fsxFileSystem: fsxId,
                activeNodeInstanceid: activeNodeInstanceId!,
                cloudProviderAccountId: awsAccountId,
                resourceName: serverNameWithHostName
            };

            if (IS_DEMO_FLOW) {
                await updateOptimizedConfigNameInInstanceTable(
                    accountId,
                    instanceId,
                    [OptimizeOperatingSystemParams.MPIO_SESSIONS],
                    'OS',
                    instanceMetadata || {}
                );
            }

            await triggerAssessmentAfterOptimization(
                credentialsId,
                region,
                accountId,
                databaseHostId,
                serverNameWithHostName,
                parentJobId,
                instanceToAssess,
                AssessmentCategories.STORAGE
            );
        }
    }
}

async function enableMpioTimeout(optimizeMpioTimeoutParams: OptimizeMpioTimeoutParams) {
    const {
        credentialsId,
        region,
        accountId,
        activeNodeInstanceId,
        standbyNodeInstanceId,
        sqlDeploymentType,
        ssmCommand,
        instanceId,
        instanceName,
        databaseType,
        sqlAuthEnabled,
        fsxId,
        serverNameWithHostName,
        parentJobId,
        databaseHostId,
        instanceMetadata
    } = optimizeMpioTimeoutParams;

    logger.info(
        `Optimizing MPIO timeout for ${accountId}, ${credentialsId}, ${region}, ${parentJobId}, ${fsxId}, ${instanceId}, ${instanceName}, ${serverNameWithHostName}, ${databaseHostId}, ${activeNodeInstanceId}, ${sqlDeploymentType}, ${standbyNodeInstanceId}`
    );

    let jobError: string | undefined;
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;

    // Helper to run SSM command and update job
    const runOnNode = async (
        nodeInstanceId: string | undefined,
        jobName: string,
        jobDesc: string
    ): Promise<JOBSTATUS> => {
        if (!nodeInstanceId) {
            return JOBSTATUS.COMPLETED;
        }
        const jobId = await handleOptimizeJobCreation(
            accountId,
            credentialsId,
            region,
            serverNameWithHostName,
            JOBTYPE.WELL_ARCHITECTED,
            jobName,
            jobDesc,
            parentJobId
        );
        try {
            await retryWithDelay(
                callSsmExecution.bind(null, {
                    credentialsId,
                    region,
                    commands: [ssmCommand],
                    ec2InstanceId: nodeInstanceId,
                    comment: jobName,
                    accountId
                })
            );
            await updateJobDetails(accountId, jobId, {
                status: JOBSTATUS.COMPLETED,
                endTime: Date.now()
            });
            return JOBSTATUS.COMPLETED;
        } catch (error) {
            const errMsg = `Error while setting MPIO timeout on ${jobName.toLowerCase()}: ${error}`;
            logger.error(errMsg);
            await updateJobDetails(accountId, jobId, {
                status: JOBSTATUS.FAILED,
                endTime: Date.now(),
                error: errMsg
            });
            jobError = errMsg;
            return JOBSTATUS.FAILED;
        }
    };

    // Run on primary node
    const primaryStatus = await runOnNode(
        activeNodeInstanceId,
        'Set MPIO timeout on primary node',
        'Set MPIO timeout on primary node'
    );

    // Run on standby node if FCI
    let standbyStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    if (sqlDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT && standbyNodeInstanceId) {
        standbyStatus = await runOnNode(
            standbyNodeInstanceId,
            'Set MPIO timeout on standby node',
            'Set MPIO timeout on standby node'
        );
    }

    // If either job failed, mark parent as failed
    if (primaryStatus === JOBSTATUS.FAILED || standbyStatus === JOBSTATUS.FAILED) {
        jobStatus = JOBSTATUS.FAILED;
        await updateJobDetails(accountId, parentJobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
        await updateLongRunningAuditGroup(
            AuditStatus.FAILED,
            `Failed to set MPIO timeout on ${serverNameWithHostName}`
        );
    } else {
        // Trigger assessment after optimization
        const instanceToAssess: WorkloadInstance = {
            id: instanceId,
            name: instanceName,
            type: databaseType,
            region,
            sqlAuthEnabled: sqlAuthEnabled || false,
            fsxFileSystem: fsxId,
            activeNodeInstanceid: activeNodeInstanceId!,
            resourceName: serverNameWithHostName
        };
        if (IS_DEMO_FLOW) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                instanceId,
                [OptimizeOperatingSystemParams.MPIO_TIMEOUT],
                'OS',
                instanceMetadata || {}
            );
        }
        await triggerAssessmentAfterOptimization(
            credentialsId,
            region,
            accountId,
            databaseHostId,
            serverNameWithHostName,
            parentJobId,
            instanceToAssess,
            AssessmentCategories.STORAGE
        );
    }
}

async function optimizeOperatingSystemSettings(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    configurationName: string,
    masterOptimizeParentId?: string
) {
    logger.info(
        `Optimizing operating system settings for ${accountId}, ${credentialsId} ${databaseHostId} ${databaseInstanceId} in ${region} for configuration ${configurationName}`
    );

    const {
        items: [resourceDetail]
    } = await getResources({
        accountId,
        resourceId: databaseHostId,
        credentialsId,
        region,
        resourceType: RESOURCESTYPE.MSSQL
    });

    if (isEmpty(resourceDetail)) {
        const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const { metadata, resource_name: sqlServerName } = resourceDetail;
    const { sqlDeploymentType = '', node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;

    const { isSSMConnected, activeNodeInstanceId, standbyNodeInstanceId, instancesDetails } = await getActiveSqlNode(
        credentialsId,
        region,
        {
            node1InstanceId,
            node2InstanceId
        }
    );

    if (!isSSMConnected && activeNodeInstanceId === undefined) {
        const errorMessage = `Unable to fix host ${sqlServerName} in account ${accountId} due to SSM connection issues.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    const instanceDetail = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);
    const {
        fsxn_ids: fsxId,
        database_instance_name: instanceName,
        database_instance_id: instanceId,
        database_type: databaseType,
        metadata: instanceMetadata,
        fsx_svm_id: svmDetails
    } = instanceDetail as unknown as DatabaseInstance;

    const sqlAuthEnabled =
        instancesDetails && instanceDetail
            ? instancesDetails.some(
                  instance =>
                      instance.instanceName === instanceDetail.database_instance_name &&
                      instance.sqlAuthEnabled === true
              )
            : false;

    const serverNameWithHostName = instanceName ? `${sqlServerName}\\${instanceName}` : (sqlServerName as string);
    updateLongRunningAuditGroup(undefined, undefined, serverNameWithHostName);

    // Fetch instance node names for FCI
    let activeNodeName;
    let standbyNodeName;
    if (sqlDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT) {
        const { Reservations = [] } = await describeInstance(credentialsId, region, {
            InstanceIds: [activeNodeInstanceId!, standbyNodeInstanceId!]
        });
        activeNodeName = getResourceNameFromTags(Reservations?.[0].Instances?.[0].Tags);
        standbyNodeName = getResourceNameFromTags(Reservations?.[1]?.Instances?.[0].Tags);
    }

    const svmDetailsObject = svmDetails as Record<string, string>;
    const svmId = svmDetailsObject ? svmDetailsObject[fsxId] : '';

    const jobDescription =
        configurationName === OptimizeOperatingSystemParams.MPIO_POLICY
            ? `Fix operating system MPIO load balancing policy for ${serverNameWithHostName}`
            : configurationName === OptimizeOperatingSystemParams.MPIO_SESSIONS
            ? `Fix operating system MPIO iSCSI sessions for ${serverNameWithHostName}`
            : configurationName === OptimizeOperatingSystemParams.MPIO_ENABLE
            ? `Enable MPIO and configure for MPIO iSCSI sessions ${serverNameWithHostName}`
            : configurationName === OptimizeOperatingSystemParams.MPIO_TIMEOUT
            ? `Set MPIO timeout for ${serverNameWithHostName}`
            : '';
    const jobMetadata: JobMetadata = {
        hostsToOptimize: [
            {
                optimizationType: configurationName,
                resourceId: databaseHostId,
                sqlServerInstances: [databaseInstanceId]
            }
        ]
    };
    const parentJobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        serverNameWithHostName,
        JOBTYPE.WELL_ARCHITECTED,
        jobDescription,
        jobDescription,
        masterOptimizeParentId,
        jobMetadata
    );
    switch (configurationName) {
        case OptimizeOperatingSystemParams.MPIO_POLICY: {
            try {
                optimizeMpio({
                    accountId,
                    region,
                    credentialsId,
                    parentJobId,
                    serverNameWithHostName,
                    sqlDeploymentType,
                    activeNodeInstanceId,
                    databaseHostId,
                    fsxId,
                    instanceId,
                    instanceName,
                    databaseType,
                    databaseInstanceId,
                    sqlAuthEnabled,
                    awsAccountId: resourceDetail.cloud_provider_account_id!,
                    standbyNodeInstanceId,
                    activeNodeName,
                    standbyNodeName,
                    instanceMetadata
                });
                await updateLongRunningAuditGroup(AuditStatus.SUCCESS);
            } catch (error) {
                const errorMessage = `Error while fixing operating system settings ${error}`;
                logger.error(errorMessage);
                await updateJobDetails(accountId, parentJobId, {
                    status: JOBSTATUS.FAILED,
                    endTime: Date.now(),
                    error: errorMessage
                });
                updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);

                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
            }
            break;
        }
        case OptimizeOperatingSystemParams.MPIO_SESSIONS: {
            try {
                // Fetch iSCSCI target addresses
                const iscsiTargetAddresses = await getIscsiTargetAddresses(credentialsId, region, fsxId, svmId);

                if (!IS_DEMO_FLOW && isEmpty(iscsiTargetAddresses)) {
                    const errorMessage = `iSCSI target addresses are not available for ${serverNameWithHostName}.`;
                    throw createError(400, errorMessage);
                }

                optimizeMpioSessions({
                    accountId,
                    region,
                    credentialsId,
                    parentJobId,
                    serverNameWithHostName,
                    activeNodeInstanceId,
                    databaseHostId,
                    fsxId,
                    instanceId,
                    instanceName,
                    databaseInstanceId,
                    awsAccountId: resourceDetail.cloud_provider_account_id!,
                    svmId,
                    databaseType,
                    instanceMetadata,
                    sqlAuthEnabled,
                    standbyNodeInstanceId,
                    sqlDeploymentType,
                    iscsiTargetAddresses,
                    currentMpioSessionsCount: []
                });
                await updateLongRunningAuditGroup(AuditStatus.SUCCESS);
            } catch (error: any) {
                const errorMessage = `Error while fixing iscsi sessions ${error}`;
                logger.error(errorMessage);
                await updateJobDetails(accountId, parentJobId, {
                    status: JOBSTATUS.FAILED,
                    endTime: Date.now(),
                    error: errorMessage
                });
                updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);
            }
            break;
        }
        case OptimizeOperatingSystemParams.MPIO_ENABLE: {
            try {
                // Fetch iSCSCI target addresses
                const iscsiTargetAddresses = await getIscsiTargetAddresses(credentialsId, region, fsxId, svmId);

                if (!IS_DEMO_FLOW && isEmpty(iscsiTargetAddresses)) {
                    const errorMessage = `iSCSI target addresses are not available for ${serverNameWithHostName}.`;
                    throw createError(400, errorMessage);
                }
                enableMpioAndConfigureSessions({
                    accountId,
                    credentialsId,
                    region,
                    parentJobId,
                    serverNameWithHostName,
                    activeNodeInstanceId,
                    databaseHostId,
                    fsxId,
                    instanceId,
                    instanceName,
                    databaseType,
                    databaseInstanceId,
                    sqlAuthEnabled,
                    awsAccountId: resourceDetail.cloud_provider_account_id!,
                    standbyNodeInstanceId,
                    instanceMetadata,
                    svmId,
                    sqlDeploymentType,
                    iscsiTargetAddresses,
                    currentMpioSessionsCount: []
                });
                await updateLongRunningAuditGroup(AuditStatus.SUCCESS);
            } catch (error) {
                const errorMessage = `Error while enabling MPIO and configuring MPIO sessions: ${error}`;
                logger.error(errorMessage);
                await updateJobDetails(accountId, parentJobId, {
                    status: JOBSTATUS.FAILED,
                    endTime: Date.now(),
                    error: errorMessage
                });
                updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);
                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
            }

            break;
        }
        case OptimizeOperatingSystemParams.MPIO_TIMEOUT: {
            const jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
            try {
                const ssmCommand = MPIO_TIMEOUT;
                await enableMpioTimeout({
                    credentialsId,
                    region,
                    accountId,
                    activeNodeInstanceId,
                    standbyNodeInstanceId,
                    sqlDeploymentType,
                    ssmCommand,
                    instanceId,
                    instanceName,
                    databaseType,
                    sqlAuthEnabled,
                    fsxId,
                    serverNameWithHostName,
                    parentJobId,
                    databaseHostId,
                    databaseInstanceId,
                    awsAccountId: resourceDetail.cloud_provider_account_id!,
                    instanceMetadata
                });
                await updateLongRunningAuditGroup(AuditStatus.SUCCESS);
            } catch (error) {
                const errorMessage = `Error while setting MPIO timeout: ${error}`;
                logger.error(errorMessage);
                await updateJobDetails(accountId, parentJobId, {
                    status: JOBSTATUS.FAILED,
                    endTime: Date.now(),
                    error: errorMessage
                });
                updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);
                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
            } finally {
                await updateJobDetails(accountId, parentJobId, {
                    status: jobStatus,
                    endTime: Date.now()
                });
            }
            break;
        }
        default: {
            const errorMessage = `Invalid configuration name ${configurationName}`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
        }
    }

    return { jobId: parentJobId };
}

async function handleStorageTierRemediation(storageTierParams: StorageTierParams) {
    const {
        accountId,
        credentialsId,
        region,
        fsxId,
        activeNodeInstanceId,
        instanceName,
        parentJobId,
        serverNameWithHostName,
        sqlAuthEnabled,
        svmName,
        instanceId,
        databaseType,
        awsAccountId,
        instanceMetadata,
        databaseHostId,
        volumesToOptimize
    } = storageTierParams;

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError = '';
    const jobDescription = `Set volume tiering-policy to snapshot-only and cloud-retrieval-policy to promote for ${serverNameWithHostName}`;
    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        serverNameWithHostName!,
        JOBTYPE.WELL_ARCHITECTED,
        `Set volume tiering-policy to snapshot-only and cloud-retrieval-policy to promote for ${serverNameWithHostName}`,
        jobDescription,
        parentJobId
    );

    let volumeNames = volumesToOptimize ?? [];
    try {
        const missingVolumes: string[] = [];
        const instanceVolumeMapping =
            (await getMappedOntapVolumes(
                credentialsId,
                region,
                fsxId,
                false,
                activeNodeInstanceId!,
                [instanceName],
                sqlAuthEnabled,
                true
            )) || [];
        const mappedVolumeNames = (
            Object.values(instanceVolumeMapping)
                ?.map(i => i?.volumeRecords)
                .flat() || []
        )?.map(volume => volume.name as string);
        if (isEmpty(volumesToOptimize)) {
            volumeNames = mappedVolumeNames;
        } else {
            volumeNames = volumeNames.filter(volumeName => {
                const isMapped = mappedVolumeNames.includes(volumeName);
                if (!isMapped) {
                    missingVolumes.push(volumeName);
                }
                return isMapped;
            });
        }
        if (!isEmpty(volumeNames)) {
            const apiQueryFilter = `vserver=${svmName}&volume=${volumeNames.join(',')}`;
            const apiEndpoint = '/private/cli/volume';

            const ssmCommand = OPTIMIZE_STORAGE_PARAMS_SCRIPT({
                fsxId,
                region,
                apiEndpoint,
                apiQueryFilter,
                apiBody: JSON.stringify({ 'tiering-policy': 'snapshot-only', 'cloud-retrieval-policy': 'promote' })
            });
            const resp = await retryWithDelay(
                callSsmExecution.bind(null, {
                    credentialsId,
                    region,
                    commands: [ssmCommand],
                    ec2InstanceId: activeNodeInstanceId!,
                    comment: jobDescription
                })
            );
            const parsedResp = sqlResponseParsing(resp);
            const objectsOptimized = parsedResp.num_records || 0;
            if (objectsOptimized !== volumeNames.length && !IS_DEMO_FLOW) {
                if (objectsOptimized === 0) {
                    jobError = `Failed to fix storage-tier ${volumeNames.length} objects, ${volumeNames} for ${serverNameWithHostName}`;
                    logger.error(`Optimization failed for ${serverNameWithHostName}, ${parsedResp}`);
                    jobStatus = JOBSTATUS.FAILED;
                } else {
                    const unOptimizedObjects = volumeNames.filter(obj => !parsedResp.cli_output.includes(obj));
                    jobError = `Failed to fix storage-tier ${unOptimizedObjects.length} objects, ${unOptimizedObjects} for ${serverNameWithHostName}.`;
                    jobStatus = JOBSTATUS.WARNING;
                }
            } else {
                jobStatus = JOBSTATUS.COMPLETED;
            }
        }
        if (missingVolumes.length > 0 && !IS_DEMO_FLOW) {
            jobError += `Volumes ${missingVolumes} not found for ${serverNameWithHostName}.`;
            jobStatus = JOBSTATUS.WARNING;
        }
    } catch (error) {
        jobStatus = JOBSTATUS.FAILED;
        jobError = `Error while fixing storage-tier ${error}`;
        logger.error(jobError);
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
        if (jobStatus === JOBSTATUS.FAILED) {
            updateLongRunningAuditGroup(AuditStatus.FAILED, jobError);
            await updateJobDetails(accountId, parentJobId, {
                status: JOBSTATUS.FAILED,
                endTime: Date.now(),
                error: jobError
            });
        } else {
            const instanceToAssess: WorkloadInstance = {
                id: instanceId,
                name: instanceName,
                type: databaseType,
                region,
                sqlAuthEnabled: sqlAuthEnabled || false,
                fsxFileSystem: fsxId,
                activeNodeInstanceid: activeNodeInstanceId!,
                cloudProviderAccountId: awsAccountId,
                resourceName: serverNameWithHostName
            };

            if (IS_DEMO_FLOW) {
                // update metadata in nstances table to mark optimized configuration
                await updateOptimizedConfigNameInInstanceTable(
                    accountId,
                    instanceId,
                    ['performance-tier'],
                    'SIZING',
                    instanceMetadata || { configsOptimized: {} }
                );
            }
            await triggerAssessmentAfterOptimization(
                credentialsId,
                region,
                accountId,
                databaseHostId,
                serverNameWithHostName,
                parentJobId,
                instanceToAssess,
                AssessmentCategories.STORAGE
            );
            await updateLongRunningAuditGroup(AuditStatus.SUCCESS);
        }
    }
}

async function optimizeStorageTier(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    objectsToOptimize?: string[],
    masterOptimizeParentId?: string
) {
    logger.info(
        `Optimizing storage tier for ${accountId}, ${credentialsId}, ${region}, ${databaseHostId}, ${databaseInstanceId}, ${masterOptimizeParentId}`
    );

    const {
        sqlAuthEnabled,
        activeNodeInstanceId,
        fsxId,
        instanceId,
        instanceName,
        databaseType,
        svmDetails,
        awsAccountId,
        serverNameWithHostName,
        instanceMetadata
    } = await activeSqlNodeDetails(credentialsId, region, accountId, databaseHostId, databaseInstanceId);

    const jobMetadata: JobMetadata = {
        hostsToOptimize: [
            {
                optimizationType: 'storage-tier',
                resourceId: databaseHostId,
                sqlServerInstances: [databaseInstanceId]
            }
        ]
    };
    // check whether any jobs on the same resource running
    const parentJobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        serverNameWithHostName,
        JOBTYPE.WELL_ARCHITECTED,
        `Fix storage-tier for ${serverNameWithHostName}`,
        `Fix storage-tier for ${serverNameWithHostName}`,
        masterOptimizeParentId,
        jobMetadata
    );

    const svmDetailsObject = svmDetails as Record<string, string>;
    const svmId = svmDetailsObject ? svmDetailsObject[fsxId] : '';
    try {
        const svmName = await getSvmNameFromId(credentialsId, region, fsxId, svmId);
        if (!svmName && !IS_DEMO_FLOW) {
            const errorMessage = `No SVM with id ${svmId} found for ${fsxId} in ${region}`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }
        handleStorageTierRemediation({
            accountId,
            region,
            credentialsId,
            fsxId,
            activeNodeInstanceId,
            parentJobId,
            serverNameWithHostName,
            instanceId,
            databaseHostId,
            databaseType,
            instanceName,
            sqlAuthEnabled: sqlAuthEnabled || false,
            svmName,
            svmId,
            awsAccountId,
            instanceMetadata,
            volumesToOptimize: objectsToOptimize
        } as StorageTierParams);
    } catch (error) {
        const errorMessage = `Error while fixing storage-tier ${error}`;
        logger.error(errorMessage);
        await updateJobDetails(accountId, parentJobId, {
            status: JOBSTATUS.FAILED,
            endTime: Date.now(),
            error: errorMessage
        });
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);

        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
    return { jobId: parentJobId };
}

async function handleMaxDopRemediation(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    configData: MaxDOPAssesment,
    serverNameWithHostName: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    logger.info('Setting Max Dop ', {
        accountId,
        credentialsId,
        region,
        parentJobId,
        configData,
        serverNameWithHostName,
        databaseHostId,
        databaseInstanceId
    });

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError = '';
    const jobDescription = `Set the max dop to the recommended value for ${serverNameWithHostName}`;
    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        serverNameWithHostName!,
        JOBTYPE.WELL_ARCHITECTED,
        jobDescription,
        jobDescription,
        parentJobId
    );

    const {
        sqlAuthEnabled,
        activeNodeInstanceId,
        fsxId,
        instanceId,
        instanceName,
        databaseType,
        awsAccountId,
        instanceMetadata,
        databaseDeploymentType
    } = await activeSqlNodeDetails(credentialsId, region, accountId, databaseHostId, databaseInstanceId);

    try {
        if (!activeNodeInstanceId) {
            const errorMessage = `Cannot retrieve active node ID from the Microsoft SQL configuration. Max DOP optimization for database instance  ${databaseInstanceId} isn't possible.`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }

        const isClustered = databaseDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT;

        const ssmCommand = SET_MAXDOP(
            instanceName,
            sqlAuthEnabled as boolean,
            Number(configData?.recommendedMaxDOP),
            isClustered
        );
        const resp = await retryWithDelay(
            callSsmExecution.bind(null, {
                credentialsId,
                region,
                commands: [ssmCommand],
                ec2InstanceId: activeNodeInstanceId!,
                comment: jobDescription
            })
        );
        const parsedResp = sqlResponseParsing(resp);
        jobStatus = parsedResp.status === 'success' ? JOBSTATUS.COMPLETED : JOBSTATUS.FAILED;
    } catch (error) {
        jobStatus = JOBSTATUS.FAILED;
        jobError = `Error while fixing max-dop ${error}`;
        logger.error(jobError);
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
        if (jobStatus === JOBSTATUS.FAILED) {
            updateLongRunningAuditGroup(AuditStatus.FAILED, jobError);
            await updateJobDetails(accountId, parentJobId, {
                status: JOBSTATUS.FAILED,
                endTime: Date.now(),
                error: jobError
            });
        } else {
            const instanceToAssess: WorkloadInstance = {
                id: instanceId,
                name: instanceName,
                type: databaseType,
                region,
                sqlAuthEnabled: sqlAuthEnabled || false,
                fsxFileSystem: fsxId,
                activeNodeInstanceid: activeNodeInstanceId!,
                cloudProviderAccountId: awsAccountId as string,
                resourceName: serverNameWithHostName
            };

            if (IS_DEMO_FLOW) {
                // update metadata in instances table to mark optimized configuration
                const metadata: DatabaseInstanceMetadata = isDatabaseInstanceMetadata(instanceMetadata)
                    ? instanceMetadata
                    : { configsOptimized: {} };

                await updateOptimizedConfigNameInInstanceTable(accountId, instanceId, ['maxdop'], 'maxdop', metadata);
            }
            // clearning all the ssm command cache so that we will get the fresh data in assessment
            resetCache(SSM_COMMAND_CACHE_TYPE);
            await triggerAssessmentAfterOptimization(
                credentialsId,
                region,
                accountId,
                databaseHostId,
                serverNameWithHostName,
                parentJobId,
                instanceToAssess,
                AssessmentCategories.MAXDOP
            );
            await updateLongRunningAuditGroup(AuditStatus.SUCCESS);
        }
    }
}

async function optimizeMaxDop(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    masterOptimizeParentId?: string
) {
    logger.info(
        `Optimizing max dop for ${accountId}, ${credentialsId}, ${region}, ${databaseHostId}, ${databaseInstanceId}, ${masterOptimizeParentId}`
    );

    let parentJobId = '';
    try {
        const {
            items: [persistedConfigurationData]
        } = await paginateListInstanceConfigData({
            accountId,
            region,
            credentialsId,
            resourceId: databaseHostId,
            databaseInstanceId,
            configDataType: AssessmentCategories.MAXDOP,
            pageSize: 1,
            includeDatabaseInstance: true,
            includeResource: true
        });

        const {
            config_data: configData,
            database_instances: { database_instance_name: instanceName = '' } = {},
            resource: { resource_name: sqlServerName = '' } = {}
        } = persistedConfigurationData || {};
        const maxDopConfigData = configData as unknown as MaxDOPAssesment;

        if (!instanceName || !sqlServerName) {
            logger.error('Instance name or sql server name is missing');
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Instance name or sql server name is missing');
        }

        const serverNameWithHostName = getServerNameWithHostname(sqlServerName, instanceName);
        const jobMetadata: JobMetadata = {
            hostsToOptimize: [
                {
                    optimizationType: 'max-dop',
                    resourceId: databaseHostId,
                    sqlServerInstances: [databaseInstanceId]
                }
            ]
        };
        // check whether any jobs on the same resource running
        parentJobId = await handleOptimizeJobCreation(
            accountId,
            credentialsId,
            region,
            serverNameWithHostName,
            JOBTYPE.WELL_ARCHITECTED,
            `Fix max-dop for ${serverNameWithHostName}`,
            `Fix max-dop for ${serverNameWithHostName}`,
            masterOptimizeParentId,
            jobMetadata
        );

        await handleMaxDopRemediation(
            accountId,
            credentialsId,
            region,
            parentJobId,
            maxDopConfigData,
            serverNameWithHostName,
            databaseHostId,
            databaseInstanceId
        );
    } catch (error) {
        const errorMessage = `Error while fixing max-dop ${error}`;
        logger.error(errorMessage);
        await updateJobDetails(accountId, parentJobId, {
            status: JOBSTATUS.FAILED,
            endTime: Date.now(),
            error: errorMessage
        });
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);

        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
    return { jobId: parentJobId };
}

async function handleUpdateAwsBackup(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHosts: OptimizePerHostRequestBodyType[],
    masterOptimizeParentId: string
) {
    const fsxFilesystemIds: string[] = [];
    const fsxBackupConfigMap = new Map<string, AwsFsxNBackupConfig>();
    databaseHosts.forEach(host => {
        if (
            host.fsxFileSystemId &&
            !fsxBackupConfigMap.get(host.fsxFileSystemId) &&
            host.backupRetentionDays &&
            host.backupStartTime
        ) {
            fsxBackupConfigMap.set(host.fsxFileSystemId, {
                automaticBackupRetentionDays: host.backupRetentionDays,
                dailyAutomaticBackupStartTime: host.backupStartTime
            });
            fsxFilesystemIds.push(host.fsxFileSystemId);
        }
    });

    const jobDescription = `Enable AWS FSx for ONTAP automatic backup for filesystems ${fsxFilesystemIds.join(', ')}`;

    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        '',
        JOBTYPE.WELL_ARCHITECTED,
        'Update AWS FSx for ONTAP backup',
        jobDescription,
        masterOptimizeParentId,
        {
            hostsToOptimize: [
                {
                    optimizationType: 'aws-backup',
                    resourceId: databaseHosts[0].id,
                    sqlServerInstances: [databaseHosts[0].sqlServerInstances[0]]
                }
            ]
        }
    );
    let jobstatus: JOBSTATUS = JOBSTATUS.COMPLETED as JOBSTATUS;
    const errMsg: string[] = [];

    await Promise.all(
        Array.from(fsxBackupConfigMap.entries()).map(
            throat(2, async ([fsxFileSystemId, configuration]) => {
                try {
                    await updateFsxBackup(accountId, credentialsId, region, fsxFileSystemId, configuration);
                } catch (err: any) {
                    errMsg.push(
                        `Error occurred while updating AWS FSx for ONTAP backup for fsxFileSystemId ${fsxFileSystemId}. Error: ${err}`
                    );
                    jobstatus = JOBSTATUS.FAILED;
                }
            })
        )
    );

    if (errMsg.length !== 0) {
        logger.error(errMsg);
    }
    await updateJobDetails(accountId, jobId, { status: jobstatus, endTime: new Date().getTime() });
    await updateLongRunningAuditGroup(
        jobstatus === JOBSTATUS.COMPLETED ? AuditStatus.SUCCESS : AuditStatus.FAILED,
        errMsg.join(', ')
    );
}

async function triggerAssessmentAfterOptimization(
    credentialsId: string,
    region: string,
    accountId: string,
    databaseHostId: string,
    serverNameWithHostName: string,
    parentJobId: string,
    instanceToAssess: { id: string },
    fields?: string,
    databaseType?: RESOURCESTYPE
) {
    logger.info('Triggering assessment after optimization', {
        credentialsId,
        region,
        accountId,
        databaseHostId,
        serverNameWithHostName,
        parentJobId,
        instanceId: instanceToAssess?.id,
        fields
    });

    if (databaseType === RESOURCESTYPE.MSSQL) {
        await onDemandTriggerMssqlDriftAssessment(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            instanceToAssess.id,
            AssessmentTriggeredBy.SYSTEM,
            fields || '',
            parentJobId
        );
    } else if (databaseType === RESOURCESTYPE.ORACLE) {
        await onDemandTriggerOracleDriftAssessment(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            instanceToAssess.id,
            AssessmentTriggeredBy.SYSTEM,
            fields || '',
            parentJobId
        );
    }

    let masterJobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage = '';
    if (!IS_DEMO_FLOW) {
        let retries = 10;
        while (retries > 0) {
            retries -= 1;
            // eslint-disable-next-line no-await-in-loop
            const allSubJobs = await listJobs(accountId, '', '', parentJobId);
            masterJobStatus = allSubJobs.some(job => job.status === JOBSTATUS.IN_PROGRESS)
                ? JOBSTATUS.IN_PROGRESS
                : allSubJobs.every(job => job.status === JOBSTATUS.FAILED)
                ? JOBSTATUS.FAILED
                : allSubJobs.every(job => job.status === JOBSTATUS.COMPLETED)
                ? JOBSTATUS.COMPLETED
                : allSubJobs.some(job => job.status === JOBSTATUS.FAILED || job.status === JOBSTATUS.WARNING)
                ? JOBSTATUS.WARNING
                : JOBSTATUS.IN_PROGRESS;
            if (masterJobStatus !== JOBSTATUS.IN_PROGRESS || retries === 0) {
                errorMessage = allSubJobs.find(job => job.status === JOBSTATUS.FAILED)?.error || '';
                break;
            }
            // eslint-disable-next-line no-await-in-loop
            await sleep(30000);
        }
    }

    await updateJobDetails(accountId, parentJobId, {
        status: masterJobStatus,
        endTime: Date.now(),
        error: errorMessage
    });

    updateLongRunningAuditGroup(AuditStatus.SUCCESS);
}

function isDatabaseInstanceMetadata(value: any): value is DatabaseInstanceMetadata {
    return value && typeof value === 'object' && 'configsOptimized' in value;
}

export {
    optimizeStorage,
    optimizeSizing,
    optimizeOperatingSystemSettings,
    optimizeStorageTier,
    activeSqlNodeDetails,
    optimizeMaxDop,
    handleUpdateAwsBackup,
    triggerAssessmentAfterOptimization
};
