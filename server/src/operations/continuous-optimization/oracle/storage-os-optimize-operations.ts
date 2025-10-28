import createError from 'http-errors';
import { JOBTYPE, JOBSTATUS } from '@prisma/client';
import { isEmpty } from 'lodash-es';
import { Metadata, DatabaseInstance, WorkloadInstance } from '../../../utils/common-types';
import {
    RESOURCESTYPE,
    HttpErrorCodes,
    DatabaseTypes,
    AuditStatus,
    LINUX_HOST_UTILITIES_RELATIVE_PATH
} from '../../../utils/consts';
import {
    AssessmentCategories,
    OptimizeOracleiSCSIStorageOperatingSystem,
    OptimizeOracleNFSStorageOperatingSystem
} from '../../../utils/continous-optimization-consts';
import { IS_DEMO_FLOW, retryWithDelay, sqlResponseParsing, getArtifactsRegionBucketName } from '../../../utils/utils';
import { callSsmExecution } from '../../aws/ssm-operations';
import { updateLongRunningAuditGroup } from '../../cloud-manager/audit-operations';
import { triggerAssessmentAfterOptimization } from '../../cont-opt-optimize-operations';
import { getResources } from '../../database/database-operations';
import { updateJobDetails, registerJob } from '../../database/job-operations';
import { updateOptimizedConfigNameInInstanceTable } from '../../demo-operations';
import { getActiveSqlNode } from '../../workloads/mssql/mssql-operations';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from '../../workloads/oracle/consts';
import {
    optimizeTcpOptionsCommand,
    optimizeIscsiReplacementTimeoutCommand,
    optimizeMultipathIoSessionsCommand,
    installHostUtilitiesCommand,
    fixTransparentHugepageCommand,
    enableMultipathIoCommand,
    disableSelinuxCommand,
    optimizeMultiblockReadCountCommand,
    optimizeFilesystemioOptionsCommand,
    optimizeMultipathIoConfigCommand,
    optimizeMultiPathConfigFriendlyNamesCommand
} from './ssm-scripts/os-optimization-scripts';
import { handleOptimizeJobCreation } from '../assessment-utils';
import getLogger from '../../../utils/logger';
import {
    OracleJobMetadata,
    TcpFeatures,
    TcpOptimizationResponse,
    InstallHostUtilitiesResponse,
    GenericOptimizationResponse
} from './consts';
import { handleAfdDriftOptimization, handleAsmLibDriftOptimization } from './storage-optimize-operations';
import { preSignedUrl } from '../../../lib/aws/s3';
import { oracleOptimizeStorageOSForNfs } from './storage-os-nfs-optimise-operations';
import { OptimizeOSParams } from './common-types';

const logger = getLogger();
const { getPreSignedUrl } = preSignedUrl;

async function oracleOptimizeStorageOS(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    configurationName: string,
    masterJobId?: string,
    shouldRestart: boolean = false
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
        resourceType: RESOURCESTYPE.ORACLE
    });

    if (isEmpty(resourceDetail)) {
        const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const { metadata, resource_name: resourceName } = resourceDetail;
    const oracleResourceName = resourceName || '';
    const metadataTyped = metadata as unknown as Metadata;
    const { node1InstanceId, node2InstanceId } = metadataTyped;

    const {
        isSSMConnected,
        activeNodeInstanceId: activeNode,
        instancesDetails
    } = await getActiveSqlNode(credentialsId, region, {
        node1InstanceId,
        node2InstanceId,
        resourceType: DatabaseTypes.ORACLE
    });

    const activeNodeInstanceId = activeNode;

    if (!activeNodeInstanceId || !isSSMConnected) {
        const errorMessage = !activeNodeInstanceId
            ? `Unable to fix host ${oracleResourceName} in account ${accountId}. Cannot retrieve active node ID from the Oracle configuration.`
            : `Unable to fix host ${oracleResourceName} in account ${accountId} due to SSM connection issues.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    if (
        Object.values(OptimizeOracleNFSStorageOperatingSystem).includes(
            configurationName as OptimizeOracleNFSStorageOperatingSystem
        )
    ) {
        await oracleOptimizeStorageOSForNfs(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            configurationName,
            activeNodeInstanceId,
            instancesDetails as DatabaseInstance[],
            resourceDetail,
            masterJobId
        );
        return;
    }

    const [instanceDetail] = instancesDetails || [];
    const {
        fsxn_ids: fsxId,
        database_instance_name: instanceName,
        metadata: instanceMetadata
    } = instanceDetail as unknown as DatabaseInstance;

    const serverNameWithHostName = instanceName
        ? `${oracleResourceName}\\${instanceName}`
        : (oracleResourceName as string);
    updateLongRunningAuditGroup(undefined, undefined, serverNameWithHostName);

    let jobDescription = '';
    switch (configurationName) {
        case OptimizeOracleiSCSIStorageOperatingSystem.TCP_OPTIONS:
            jobDescription = `Fix Storage Operating System TCP options for ${serverNameWithHostName}`;
            break;
        case OptimizeOracleiSCSIStorageOperatingSystem.ISCSI_REPLACEMENT_TIMEOUT:
            jobDescription = `Fix Storage Operating System iSCSI replacement timeout for ${serverNameWithHostName}`;
            break;
        case OptimizeOracleiSCSIStorageOperatingSystem.MULTIPATH_IO_SESSIONS:
            jobDescription = `Fix Storage Operating System multipath IO sessions for ${serverNameWithHostName}`;
            break;
        case OptimizeOracleiSCSIStorageOperatingSystem.THP_DISABLE:
            jobDescription = `Fix Storage Operating System transparent huge pages for ${serverNameWithHostName}`;
            break;
        case OptimizeOracleiSCSIStorageOperatingSystem.MULTIPATH_ENABLE:
            jobDescription = `Fix Storage Operating System multipath IO enable for ${serverNameWithHostName}`;
            break;
        case OptimizeOracleiSCSIStorageOperatingSystem.SELINUX_DISABLE:
            jobDescription = `Fix Storage Operating System SELinux disable for ${serverNameWithHostName}`;
            break;
        case OptimizeOracleiSCSIStorageOperatingSystem.MULTIPATH_CONFIGURATION:
            jobDescription = `Fix Storage Operating System multipath configuration for ${serverNameWithHostName}`;
            break;
        case OptimizeOracleiSCSIStorageOperatingSystem.MULTIPATH_FRIENDLY_NAMES:
            jobDescription = `Fix Storage Operating System multipath friendly names for ${serverNameWithHostName}`;
            break;
        case OptimizeOracleiSCSIStorageOperatingSystem.MULTIBLOCK_READCOUNT:
            jobDescription = `Fix Storage Operating System Oracle multiblock read count for ${serverNameWithHostName}`;
            break;
        case OptimizeOracleiSCSIStorageOperatingSystem.FILESYSTEM_IO_OPTIONS:
            jobDescription = `Fix Storage Operating System Oracle filesystem I/O options for ${serverNameWithHostName}`;
            break;
        case OptimizeOracleiSCSIStorageOperatingSystem.HOST_UTILITIES:
            jobDescription = `Fix Storage Operating System Install Host Utilities for ${serverNameWithHostName}`;
            break;

        default:
            jobDescription = '';
            break;
    }

    const jobMetadata: OracleJobMetadata = {
        hostsToOptimize: [
            {
                optimizationType: configurationName,
                resourceId: databaseHostId,
                databases: [databaseInstanceId]
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
        masterJobId,
        jobMetadata
    );

    let parentJobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let parentJobError = '';
    switch (configurationName) {
        case OptimizeOracleiSCSIStorageOperatingSystem.TCP_OPTIONS: {
            try {
                await optimizeTcpOptions({
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    serverNameWithHostName,
                    parentJobId,
                    databaseInstanceId,
                    activeNodeInstanceId,
                    instanceMetadata
                });
            } catch (error) {
                parentJobError = String(error);
                logger.error(parentJobError);
                parentJobStatus = JOBSTATUS.WARNING;
            }
            break;
        }
        case OptimizeOracleiSCSIStorageOperatingSystem.HOST_UTILITIES: {
            try {
                await installHostUtilities({
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    serverNameWithHostName,
                    parentJobId,
                    databaseInstanceId,
                    databaseInstanceName: instanceName,
                    fsxId,
                    activeNodeInstanceId: activeNodeInstanceId!,
                    instanceMetadata
                });
            } catch (error) {
                parentJobError = String(error);
                logger.error(parentJobError);
                parentJobStatus = JOBSTATUS.WARNING;
            }
            break;
        }

        case OptimizeOracleiSCSIStorageOperatingSystem.ISCSI_REPLACEMENT_TIMEOUT: {
            try {
                await optimizeIscsiReplacementTimeout({
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    serverNameWithHostName,
                    parentJobId,
                    databaseInstanceId,
                    activeNodeInstanceId,
                    instanceMetadata
                });
            } catch (error) {
                parentJobError = String(error);
                logger.error(parentJobError);
                parentJobStatus = JOBSTATUS.WARNING;
            }
            break;
        }

        case OptimizeOracleiSCSIStorageOperatingSystem.MULTIPATH_IO_SESSIONS: {
            try {
                await optimizeMultipathIoSessions({
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    serverNameWithHostName,
                    parentJobId,
                    databaseInstanceId,
                    activeNodeInstanceId,
                    instanceMetadata
                });
            } catch (error) {
                parentJobError = String(error);
                logger.error(parentJobError);
                parentJobStatus = JOBSTATUS.WARNING;
            }
            break;
        }

        case OptimizeOracleiSCSIStorageOperatingSystem.ORACLE_AFD_LOGICAL_BLOCK_SIZE: {
            try {
                await handleAfdDriftOptimization({
                    accountId,
                    region,
                    credentialsId,
                    resourceId: databaseHostId,
                    databaseInstanceId,
                    node1InstanceId,
                    instanceMetadata,
                    parentJobId,
                    shouldRestart
                });
            } catch (error) {
                parentJobError = String(error);
                logger.error(parentJobError);
                parentJobStatus = JOBSTATUS.WARNING;
            }
            break;
        }

        case OptimizeOracleiSCSIStorageOperatingSystem.ORACLE_ASM_LOGICAL_BLOCK_SIZE: {
            try {
                await handleAsmLibDriftOptimization({
                    accountId,
                    region,
                    credentialsId,
                    resourceId: databaseHostId,
                    databaseInstanceId,
                    node1InstanceId,
                    instanceMetadata,
                    parentJobId,
                    shouldRestart
                });
            } catch (error) {
                parentJobError = String(error);
                logger.error(parentJobError);
                parentJobStatus = JOBSTATUS.WARNING;
            }
            break;
        }

        case OptimizeOracleiSCSIStorageOperatingSystem.THP_DISABLE: {
            try {
                await optimizeTransparentHugePages({
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    serverNameWithHostName,
                    parentJobId,
                    databaseInstanceId,
                    activeNodeInstanceId,
                    instanceMetadata
                });
            } catch (error) {
                parentJobError = String(error);
                logger.error(parentJobError);
                parentJobStatus = JOBSTATUS.WARNING;
            }
            break;
        }
        case OptimizeOracleiSCSIStorageOperatingSystem.MULTIPATH_CONFIGURATION: {
            try {
                await optimizeMultipathConfig({
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    serverNameWithHostName,
                    parentJobId,
                    databaseInstanceId,
                    activeNodeInstanceId,
                    instanceMetadata
                });
            } catch (error) {
                parentJobError = String(error);
                logger.error(parentJobError);
                parentJobStatus = JOBSTATUS.WARNING;
            }
            break;
        }

        case OptimizeOracleiSCSIStorageOperatingSystem.MULTIPATH_FRIENDLY_NAMES: {
            try {
                await optimizeMultipathFriendlyNames({
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    serverNameWithHostName,
                    parentJobId,
                    databaseInstanceId,
                    activeNodeInstanceId,
                    instanceMetadata
                });
            } catch (error) {
                parentJobError = String(error);
                logger.error(parentJobError);
                parentJobStatus = JOBSTATUS.WARNING;
            }
            break;
        }

        case OptimizeOracleiSCSIStorageOperatingSystem.MULTIPATH_ENABLE: {
            try {
                await enableMultipathIo({
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    serverNameWithHostName,
                    parentJobId,
                    databaseInstanceId,
                    databaseInstanceName: instanceName,
                    fsxId,
                    activeNodeInstanceId: activeNodeInstanceId!,
                    instanceMetadata
                });
            } catch (error) {
                parentJobError = String(error);
                logger.error(parentJobError);
                parentJobStatus = JOBSTATUS.WARNING;
            }
            break;
        }
        case OptimizeOracleiSCSIStorageOperatingSystem.SELINUX_DISABLE: {
            try {
                await disableSelinux({
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    serverNameWithHostName,
                    parentJobId,
                    databaseInstanceId,
                    databaseInstanceName: instanceName,
                    fsxId,
                    activeNodeInstanceId: activeNodeInstanceId!,
                    instanceMetadata
                });
            } catch (error) {
                parentJobError = String(error);
                logger.error(parentJobError);
                parentJobStatus = JOBSTATUS.WARNING;
            }
            break;
        }

        case OptimizeOracleiSCSIStorageOperatingSystem.MULTIBLOCK_READCOUNT: {
            try {
                await optimizeMultiblockReadcount({
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    serverNameWithHostName,
                    parentJobId,
                    databaseInstanceId,
                    activeNodeInstanceId,
                    instanceMetadata
                });
            } catch (error) {
                parentJobError = String(error);
                logger.error(parentJobError);
                parentJobStatus = JOBSTATUS.WARNING;
            }
            break;
        }

        case OptimizeOracleiSCSIStorageOperatingSystem.FILESYSTEM_IO_OPTIONS: {
            try {
                await optimizeFilesystemioOptions({
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    serverNameWithHostName,
                    parentJobId,
                    databaseInstanceId,
                    activeNodeInstanceId,
                    instanceMetadata
                });
            } catch (error) {
                parentJobError = String(error);
                logger.error(parentJobError);
                parentJobStatus = JOBSTATUS.WARNING;
            }
            break;
        }

        default:
    }

    // Update audit status based on final job status
    await updateLongRunningAuditGroup(
        parentJobStatus === JOBSTATUS.COMPLETED || parentJobStatus === JOBSTATUS.WARNING
            ? AuditStatus.SUCCESS
            : AuditStatus.FAILED,
        parentJobStatus === JOBSTATUS.COMPLETED ? '' : parentJobError
    );

    // Common assessment trigger logic for all successful optimizations
    try {
        const instanceToAssess: WorkloadInstance = {
            id: databaseInstanceId,
            name: instanceName,
            type: RESOURCESTYPE.ORACLE,
            region,
            sqlAuthEnabled: false,
            fsxFileSystem: fsxId,
            activeNodeInstanceid: activeNodeInstanceId,
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
            AssessmentCategories.STORAGE,
            RESOURCESTYPE.ORACLE
        );
    } catch (error) {
        logger.error(`Error triggering assessment after optimization for databaseHost ${databaseHostId}: ${error}`);
        parentJobStatus = JOBSTATUS.WARNING;
    }

    await updateJobDetails(accountId, parentJobId, {
        status: parentJobStatus,
        endTime: Date.now(),
        error: parentJobError
    });
    if (parentJobStatus !== JOBSTATUS.COMPLETED) {
        throw new Error(parentJobError);
    }
}

async function optimizeTcpOptions(params: OptimizeOSParams) {
    const {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        serverNameWithHostName,
        parentJobId,
        databaseInstanceId,
        activeNodeInstanceId,
        instanceMetadata
    } = params;

    logger.info('Optimizing TCP Options', { accountId, databaseHostId, serverNameWithHostName, databaseInstanceId });

    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: `Fix TCP Options for ${serverNameWithHostName}`,
        description: `Fix TCP options for ${serverNameWithHostName}`,
        resourceName: serverNameWithHostName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.WELL_ARCHITECTED,
        parentJobId
    });
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;

    try {
        const ssmCommand = optimizeTcpOptionsCommand;
        const ssmComment = 'Optimize TCP options';
        const response = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                [ssmCommand],
                activeNodeInstanceId,
                ssmComment,
                accountId,
                false,
                undefined,
                undefined,
                SSM_RUN_SHELL_SCRIPT_DOC,
                SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            ),
            3,
            5000
        );

        const parsedResponse = sqlResponseParsing(response) as TcpOptimizationResponse;
        logger.debug(`Updated tcp options ${activeNodeInstanceId}`, { response });

        // Check if all TCP parameters are optimized successfully
        const tcpParams: Array<keyof TcpFeatures> = ['tcp-timestamps', 'tcp-sack', 'tcp-window-scaling'];
        const errors: string[] = [];

        if (parsedResponse.error) {
            throw new Error(parsedResponse.error);
        }
        if (parsedResponse['already-optimized'] === true) {
            const errMsg = 'All TCP options are already optimized, no further action done.';
            jobError = errMsg;
            throw new Error(errMsg);
        }

        tcpParams.forEach(param => {
            const paramData = parsedResponse['tcp-features'][param];
            if (paramData?.error) {
                errors.push(`${param}: ${paramData.error}`);
            }
        });

        const status =
            errors.length === 0 && tcpParams.every(param => parsedResponse['tcp-features'][param]?.enabled === true);

        if (errors.length > 0) {
            jobError = `TCP optimization failed: ${errors.join(', ')}`;
            jobStatus = JOBSTATUS.FAILED;
            logger.error(jobError);
            throw new Error(jobError);
        }

        logger.info(`TCP optimization status: ${status ? 'SUCCESS' : 'FAILED'}`, { status, errors });

        if (IS_DEMO_FLOW) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                databaseInstanceId,
                ['tcp-advanced-options'],
                'OS',
                instanceMetadata || {}
            );
        }
    } catch (error) {
        jobError = jobError || `Error while updating tcp options ${error}`;
        jobStatus = jobError ? JOBSTATUS.WARNING : JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
    }

    if (jobStatus !== JOBSTATUS.COMPLETED) {
        logger.info(
            `Skipping assessment trigger for databaseHost ${databaseHostId} as optimization job did not complete successfully.`
        );
        throw new Error(jobError);
    }
}

async function optimizeIscsiReplacementTimeout(params: OptimizeOSParams) {
    const {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        serverNameWithHostName,
        parentJobId,
        databaseInstanceId,
        activeNodeInstanceId,
        instanceMetadata
    } = params;

    logger.info('Optimizing iSCSI Replacement Timeout', {
        accountId,
        databaseHostId,
        serverNameWithHostName,
        databaseInstanceId
    });

    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: `Fix iSCSI Replacement Timeout for ${serverNameWithHostName}`,
        description: `Fix iSCSI replacement timeout for ${serverNameWithHostName}`,
        resourceName: serverNameWithHostName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.WELL_ARCHITECTED,
        parentJobId
    });
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;

    try {
        const ssmCommand = optimizeIscsiReplacementTimeoutCommand;
        const ssmComment = 'Optimize iSCSI replacement timeout';
        const response = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                [ssmCommand],
                activeNodeInstanceId,
                ssmComment,
                accountId,
                false,
                undefined,
                undefined,
                SSM_RUN_SHELL_SCRIPT_DOC,
                SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            ),
            3,
            5000
        );

        const parsedResponse = sqlResponseParsing(response);

        if (parsedResponse.error) {
            throw new Error(parsedResponse.error);
        }

        const status = parsedResponse?.status;
        if (status === 'success') {
            logger.info('iSCSI replacement timeout optimization completed successfully');
        } else if (status === 'skipped') {
            const skippedMessage = 'iSCSI replacement timeout is 5 as per recommendations. No changes needed';
            logger.info(skippedMessage);
            jobError = skippedMessage;
            jobStatus = JOBSTATUS.WARNING;
        }
        if (IS_DEMO_FLOW) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                databaseInstanceId,
                ['iscsi-replacement-timeout'],
                'OS',
                instanceMetadata || {}
            );
        }
    } catch (error) {
        jobError = jobError || `Error while fixing iSCSI replacement timeout ${error}`;
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
    }

    if (jobStatus !== JOBSTATUS.COMPLETED && jobStatus !== JOBSTATUS.WARNING) {
        logger.info(
            `Skipping assessment trigger for databaseHost ${databaseHostId} as iscsi replacement timeout optimization job did not complete successfully.`
        );
        throw new Error(jobError);
    }
}

interface MultipathIoSessionSummaryItem {
    status: string;
    target: string;
    portal: string;
    error?: string;
}

async function optimizeMultipathIoSessions(params: OptimizeOSParams) {
    const {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        serverNameWithHostName,
        parentJobId,
        databaseInstanceId,
        activeNodeInstanceId,
        instanceMetadata
    } = params;

    logger.info('Optimizing Multipath IO Sessions', {
        accountId,
        databaseHostId,
        serverNameWithHostName,
        databaseInstanceId
    });

    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: `Fix Multipath IO Sessions for ${serverNameWithHostName}`,
        description: `Fix multipath IO sessions for ${serverNameWithHostName}`,
        resourceName: serverNameWithHostName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.WELL_ARCHITECTED,
        parentJobId
    });
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;

    try {
        const ssmCommand = optimizeMultipathIoSessionsCommand;
        const ssmComment = 'Optimize multipath IO sessions';
        const response = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                [ssmCommand],
                activeNodeInstanceId,
                ssmComment,
                accountId,
                false,
                undefined,
                undefined,
                SSM_RUN_SHELL_SCRIPT_DOC,
                SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            ),
            3,
            5000
        );

        const parsedResponse = sqlResponseParsing(response);

        if (parsedResponse.error) {
            throw new Error(parsedResponse.error);
        }

        const status = parsedResponse?.overall_status;
        const summary: MultipathIoSessionSummaryItem[] = parsedResponse?.summary || [];

        if (status === 'success') {
            logger.info('Multipath IO sessions optimization completed successfully');
            jobStatus = JOBSTATUS.COMPLETED;
        } else if (status === 'skipped') {
            const skippedCount = summary.filter(item => item.status === 'skipped').length;
            logger.info('Multipath IO sessions optimization skipped');
            jobStatus = JOBSTATUS.WARNING;
            jobError = `Multipath IO sessions optimization skipped. ${skippedCount} target(s) already had 4 sessions configured.`;
        } else if (status === 'partial') {
            const updatedCount = summary.filter(item => item.status === 'updated').length;
            const failedCount = summary.filter(item => item.status === 'failed').length;
            const failedTargets = summary
                .filter(item => item.status === 'failed')
                .map(item => `${item.target} (${item.portal})`)
                .join(', ');

            logger.warn(
                `Multipath IO sessions optimization partially successful: ${updatedCount} succeeded, ${failedCount} failed`
            );
            jobStatus = JOBSTATUS.WARNING;
            jobError = `Multipath IO sessions optimization failed for few targets. Successfully updated: ${updatedCount}, Failed: ${failedCount}. Failed targets: ${failedTargets}`;
        } else if (status === 'failed') {
            const failedTargets = summary
                .filter(item => item.status === 'failed')
                .map(item => `${item.target} (${item.portal}): ${item.error || 'Unknown error'}`)
                .join('; ');

            logger.error('Multipath IO sessions optimization failed for all targets');
            jobStatus = JOBSTATUS.FAILED;
            jobError = `Multipath IO sessions optimization failed. Failed targets: ${failedTargets}`;
        } else {
            logger.warn(`Unexpected multipath IO sessions optimization status: ${status}`);
            jobStatus = JOBSTATUS.WARNING;
            jobError = `Multipath IO sessions optimization completed with unexpected status: ${status}`;
        }

        if (IS_DEMO_FLOW) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                databaseInstanceId,
                ['multipath-io-sessions'],
                'OS',
                instanceMetadata || {}
            );
        }
    } catch (error) {
        jobError = jobError || `Error while fixing multipath IO sessions ${error}`;
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
    }

    if (jobStatus !== JOBSTATUS.COMPLETED && jobStatus !== JOBSTATUS.WARNING) {
        logger.info(
            `Skipping assessment trigger for databaseHost ${databaseHostId} as multipath IO sessions optimization job did not complete successfully.`
        );
        throw new Error(jobError);
    }
}

async function optimizeTransparentHugePages(params: OptimizeOSParams) {
    const {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        serverNameWithHostName,
        parentJobId,
        databaseInstanceId,
        activeNodeInstanceId,
        instanceMetadata
    } = params;

    logger.info('Optimizing Transparent Huge Pages', {
        accountId,
        databaseHostId,
        serverNameWithHostName,
        databaseInstanceId
    });

    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: `Disable transaparent huge pages(THP) for ${serverNameWithHostName}`,
        description: `Disable transaparent huge pages(THP) settings for ${serverNameWithHostName}`,
        resourceName: serverNameWithHostName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.WELL_ARCHITECTED,
        parentJobId
    });
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;

    try {
        const ssmCommand = fixTransparentHugepageCommand;
        const ssmComment = 'Disable transaparent huge pages(THP) settings';
        const response = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                [ssmCommand],
                activeNodeInstanceId,
                ssmComment,
                accountId,
                false,
                undefined,
                undefined,
                SSM_RUN_SHELL_SCRIPT_DOC,
                SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            ),
            3,
            5000
        );

        const parsedResponse = sqlResponseParsing(response);

        if (parsedResponse.error) {
            throw new Error(parsedResponse.error);
        }

        const status = parsedResponse?.status;
        if (status === 'success') {
            logger.info('Transparent Huge Pages optimization completed successfully');
        } else if (status === 'already-optimized') {
            const skippedMessage =
                'Transparent Huge Pages are already disabled as per recommendations. No changes needed';
            logger.info(skippedMessage);
            jobError = skippedMessage;
            jobStatus = JOBSTATUS.WARNING;
        } else {
            const failureMessage = parsedResponse?.error || 'Failed to optimize Transparent Huge Pages';
            logger.error(failureMessage);
            jobError = failureMessage;
            jobStatus = JOBSTATUS.FAILED;
        }

        if (IS_DEMO_FLOW) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                databaseInstanceId,
                ['transparent-hugepages'],
                'OS',
                instanceMetadata || {}
            );
        }
    } catch (error) {
        jobError = jobError || `Error while fixing transparent huge pages settings ${error}`;
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
        updateLongRunningAuditGroup(
            jobStatus === JOBSTATUS.COMPLETED || jobStatus === JOBSTATUS.WARNING
                ? AuditStatus.SUCCESS
                : AuditStatus.FAILED,
            jobStatus === JOBSTATUS.COMPLETED || jobStatus === JOBSTATUS.WARNING ? '' : jobError
        );
    }

    if (jobStatus === JOBSTATUS.FAILED) {
        logger.info(
            `Skipping assessment trigger for databaseHost ${databaseHostId} as transparent huge pages optimization job did not complete successfully.`
        );
        throw new Error(jobError);
    }
}
async function optimizeMultipathConfig(params: OptimizeOSParams) {
    const {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        serverNameWithHostName,
        parentJobId,
        databaseInstanceId,
        activeNodeInstanceId,
        instanceMetadata
    } = params;

    logger.info('Optimizing Multipath Configuration', {
        accountId,
        databaseHostId,
        serverNameWithHostName,
        databaseInstanceId
    });

    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: `Fix Multipath Configuration for ${serverNameWithHostName}`,
        description: `Fix multipath configuration for ${serverNameWithHostName}`,
        resourceName: serverNameWithHostName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.WELL_ARCHITECTED,
        parentJobId
    });
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;

    try {
        const ssmCommand = optimizeMultipathIoConfigCommand;
        const ssmComment = 'Optimize multipath configuration';
        const response = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                [ssmCommand],
                activeNodeInstanceId,
                ssmComment,
                accountId,
                false,
                undefined,
                undefined,
                SSM_RUN_SHELL_SCRIPT_DOC,
                SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            ),
            3,
            5000
        );

        const parsedResponse = sqlResponseParsing(response);
        const status = parsedResponse?.status;

        if (parsedResponse.error || status === 'failed') {
            throw new Error(parsedResponse.error);
        }

        if (status === 'success') {
            logger.info('Multipath configuration optimization completed successfully');
        }

        if (IS_DEMO_FLOW) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                databaseInstanceId,
                ['multipath-configuration'],
                'OS',
                instanceMetadata || {}
            );
        }
    } catch (error) {
        jobError = `Error while fixing multipath configuration ${error}`;
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
        updateLongRunningAuditGroup(
            jobStatus === JOBSTATUS.COMPLETED ? AuditStatus.SUCCESS : AuditStatus.FAILED,
            jobStatus === JOBSTATUS.COMPLETED ? '' : jobError
        );
    }

    if (jobStatus !== JOBSTATUS.COMPLETED) {
        logger.info(
            `Skipping assessment trigger for databaseHost ${databaseHostId} as multipath configuration optimization job did not complete successfully.`
        );
        throw new Error(jobError);
    }
}

async function optimizeMultipathFriendlyNames(params: OptimizeOSParams) {
    const {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        serverNameWithHostName,
        parentJobId,
        databaseInstanceId,
        activeNodeInstanceId,
        instanceMetadata
    } = params;

    logger.info('Optimizing Multipath Friendly Names Configuration', {
        accountId,
        databaseHostId,
        serverNameWithHostName,
        databaseInstanceId
    });

    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: `Fix Multipath Friendly Names Configuration for ${serverNameWithHostName}`,
        description: `Fix multipath friendly names configuration for ${serverNameWithHostName}`,
        resourceName: serverNameWithHostName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.WELL_ARCHITECTED,
        parentJobId
    });
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;

    try {
        const ssmCommand = optimizeMultiPathConfigFriendlyNamesCommand;
        const ssmComment = 'Optimize multipath friendly names configuration';
        const response = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                [ssmCommand],
                activeNodeInstanceId,
                ssmComment,
                accountId,
                false,
                undefined,
                undefined,
                SSM_RUN_SHELL_SCRIPT_DOC,
                SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            ),
            3,
            5000
        );

        const parsedResponse = sqlResponseParsing(response);

        if (parsedResponse.error) {
            throw new Error(parsedResponse.error);
        }

        const status = parsedResponse?.status;
        if (status === 'success') {
            logger.info('Multipath friendly names configuration optimization completed successfully');
        } else if (status === 'skipped') {
            const skippedMessage =
                'Multipath friendly names configuration is already optimized as per recommendations. No changes needed';
            logger.info(skippedMessage);
            jobError = skippedMessage;
            jobStatus = JOBSTATUS.WARNING;
        }

        if (IS_DEMO_FLOW) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                databaseInstanceId,
                ['multipath-friendly-names'],
                'OS',
                instanceMetadata || {}
            );
        }
    } catch (error) {
        jobError = `Error while fixing multipath friendly names configuration ${error}`;
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
        updateLongRunningAuditGroup(
            jobStatus === JOBSTATUS.COMPLETED || jobStatus === JOBSTATUS.WARNING
                ? AuditStatus.SUCCESS
                : AuditStatus.FAILED,
            jobStatus === JOBSTATUS.COMPLETED || jobStatus === JOBSTATUS.WARNING ? '' : jobError
        );
    }

    if (jobStatus !== JOBSTATUS.COMPLETED && jobStatus !== JOBSTATUS.WARNING) {
        logger.info(
            `Skipping assessment trigger for databaseHost ${databaseHostId} as multipath friendly names optimization job did not complete successfully.`
        );
        throw new Error(jobError);
    }
}

async function installHostUtilities(params: OptimizeOSParams) {
    const {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        serverNameWithHostName,
        parentJobId,
        databaseInstanceId,
        activeNodeInstanceId,
        instanceMetadata
    } = params;

    logger.info('Installing host utilities', { accountId, databaseHostId, serverNameWithHostName, databaseInstanceId });

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;

    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: `Install Host Utilities for ${serverNameWithHostName}`,
        description: `Install Host Utilities for ${serverNameWithHostName}`,
        resourceName: serverNameWithHostName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.WELL_ARCHITECTED,
        parentJobId
    });

    try {
        // Generate presigned URL based on OS
        const artifactsBucketName = getArtifactsRegionBucketName(region);
        const linuxHostUtilitiesSignedUrl = await getPreSignedUrl(
            region,
            artifactsBucketName,
            LINUX_HOST_UTILITIES_RELATIVE_PATH
        );

        if (!linuxHostUtilitiesSignedUrl) {
            throw new Error('Failed to generate presigned URL for host utilities package');
        }

        const ssmCommand = installHostUtilitiesCommand(linuxHostUtilitiesSignedUrl);
        const ssmComment = 'Installing NetApp Host Utilities';
        const response = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                [ssmCommand],
                activeNodeInstanceId,
                ssmComment,
                accountId,
                false,
                undefined,
                undefined,
                SSM_RUN_SHELL_SCRIPT_DOC,
                SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            ),
            3,
            5000
        );

        const parsedResponse = sqlResponseParsing(response) as InstallHostUtilitiesResponse;
        logger.debug(`Installed host utilities on ${activeNodeInstanceId}`, { parsedResponse });

        const { status, error } = parsedResponse;

        if (error || status === 'failed') {
            throw new Error(`Host utilities installation failed: ${error}`);
        }
        if (status === 'optimised-offline') {
            jobError = 'Host utilities are already installed. No further action needed.';
            logger.info(jobError);
            jobStatus = JOBSTATUS.WARNING;
        }

        if (IS_DEMO_FLOW) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                databaseInstanceId,
                ['host-utilities'],
                'OS',
                instanceMetadata || {}
            );
        }
    } catch (error) {
        logger.error(`Error while installing host utilities: ${error}`);
        jobError = `Error while installing host utilities: ${error}`;
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
    }

    if (jobStatus !== JOBSTATUS.COMPLETED) {
        throw new Error(jobError);
    }
}

async function enableMultipathIo(params: OptimizeOSParams) {
    const {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        serverNameWithHostName,
        parentJobId,
        databaseInstanceId,
        activeNodeInstanceId,
        instanceMetadata
    } = params;

    logger.info('Enabling multipath IO', { accountId, databaseHostId, serverNameWithHostName, databaseInstanceId });

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;

    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: `Enable Multipath IO for ${serverNameWithHostName}`,
        description: `Enable Multipath IO for ${serverNameWithHostName}`,
        resourceName: serverNameWithHostName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.WELL_ARCHITECTED,
        parentJobId
    });

    try {
        const ssmCommand = enableMultipathIoCommand;
        const ssmComment = 'Enabling Multipath IO';
        const response = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                [ssmCommand],
                activeNodeInstanceId,
                ssmComment,
                accountId,
                false,
                undefined,
                undefined,
                SSM_RUN_SHELL_SCRIPT_DOC,
                SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            ),
            3,
            5000
        );

        const parsedResponse = sqlResponseParsing(response) as GenericOptimizationResponse;
        logger.debug(`Enabled multipath IO on ${activeNodeInstanceId}`, { parsedResponse });

        const { status, error } = parsedResponse;

        switch (status) {
            case 'failed':
                throw new Error(`Multipath IO enabling failed: ${error}`);
            case 'optimised-offline':
                jobError = 'Multipath IO is already enabled. No further action needed.';
                logger.info(jobError);
                jobStatus = JOBSTATUS.WARNING;
                break;
            case 'restart-required':
                jobError = 'Aborting the fix, it requires restart to take effect.';
                logger.info(jobError);
                jobStatus = JOBSTATUS.WARNING;
                break;

            default:
        }

        if (IS_DEMO_FLOW) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                databaseInstanceId,
                ['multipath-io'],
                'OS',
                instanceMetadata || {}
            );
        }
    } catch (error) {
        logger.error(`Error while enabling multipath IO: ${error}`);
        jobError = `Error while enabling multipath IO: ${error}`;
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
    }

    if (jobStatus !== JOBSTATUS.COMPLETED) {
        throw new Error(jobError);
    }
}

async function disableSelinux(params: OptimizeOSParams) {
    const {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        serverNameWithHostName,
        parentJobId,
        databaseInstanceId,
        activeNodeInstanceId,
        instanceMetadata
    } = params;

    logger.info('Disabling SELinux', { accountId, databaseHostId, serverNameWithHostName, databaseInstanceId });

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;

    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: `Disable SELinux for ${serverNameWithHostName}`,
        description: `Disable SELinux for ${serverNameWithHostName}`,
        resourceName: serverNameWithHostName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.WELL_ARCHITECTED,
        parentJobId
    });

    try {
        const ssmCommand = disableSelinuxCommand;
        const ssmComment = 'Disabling SELinux';
        const response = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                [ssmCommand],
                activeNodeInstanceId,
                ssmComment,
                accountId,
                false,
                undefined,
                undefined,
                SSM_RUN_SHELL_SCRIPT_DOC,
                SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            ),
            3,
            5000
        );

        const parsedResponse = sqlResponseParsing(response) as GenericOptimizationResponse;
        logger.debug(`Disabling SELinux on ${activeNodeInstanceId}`, { parsedResponse });

        const { status, error } = parsedResponse;

        if (error || status === 'failed') {
            throw new Error(`SELinux disabling failed: ${error}`);
        }
        if (status === 'optimised-offline') {
            jobError = 'SELinux is already disabled. No further action needed.';
            logger.info(jobError);
            jobStatus = JOBSTATUS.WARNING;
        }

        if (IS_DEMO_FLOW) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                databaseInstanceId,
                ['selinux'],
                'OS',
                instanceMetadata || {}
            );
        }
    } catch (error) {
        logger.error(`Error while disabling SELinux: ${error}`);
        jobError = `Error while disabling SELinux: ${error}`;
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
    }

    if (jobStatus !== JOBSTATUS.COMPLETED) {
        throw new Error(jobError);
    }
}

async function optimizeMultiblockReadcount(params: OptimizeOSParams) {
    const {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        serverNameWithHostName,
        parentJobId,
        databaseInstanceId,
        activeNodeInstanceId,
        instanceMetadata
    } = params;

    logger.info('Optimizing Oracle multiblock read count', {
        accountId,
        databaseHostId,
        serverNameWithHostName,
        databaseInstanceId
    });

    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: `Fix Oracle multiblock read count for ${serverNameWithHostName}`,
        description: `Remove db_file_multiblock_read_count parameter for automatic optimization on ${serverNameWithHostName}`,
        resourceName: serverNameWithHostName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.WELL_ARCHITECTED,
        parentJobId
    });
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;

    try {
        const ssmCommand = optimizeMultiblockReadCountCommand(activeNodeInstanceId, databaseInstanceId);
        const ssmComment = 'Optimize Oracle multiblock read count parameter';
        const response = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                [ssmCommand],
                activeNodeInstanceId,
                ssmComment,
                accountId,
                false,
                undefined,
                undefined,
                SSM_RUN_SHELL_SCRIPT_DOC,
                SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            ),
            3,
            5000
        );

        const parsedResponse = sqlResponseParsing(response);

        if (parsedResponse.error) {
            throw new Error(parsedResponse.error);
        }

        const status = parsedResponse?.status;
        if (status === 'success') {
            logger.info('Oracle multiblock read count fix completed successfully');
        } else if (status === 'already-optimized') {
            jobError =
                'db_file_multiblock_read_count parameter is not set - Oracle will use automatic optimization. No changes needed';
            logger.info(jobError);
            jobStatus = JOBSTATUS.WARNING;
        } else if (status === 'skipped') {
            jobError = parsedResponse?.message || 'Multiblock read count fix was skipped';
            logger.info(jobError);
            jobStatus = JOBSTATUS.WARNING;
        } else {
            jobError = parsedResponse?.error || 'Failed to fix multiblock read count parameter';
            logger.error(jobError);
            jobStatus = JOBSTATUS.FAILED;
        }

        if (IS_DEMO_FLOW) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                databaseInstanceId,
                ['multiblock-readcount'],
                'Oracle',
                instanceMetadata || {}
            );
        }
    } catch (error) {
        jobError = jobError || `Error while optimizing multiblock read count ${error}`;
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
        updateLongRunningAuditGroup(
            jobStatus === JOBSTATUS.COMPLETED || jobStatus === JOBSTATUS.WARNING
                ? AuditStatus.SUCCESS
                : AuditStatus.FAILED,
            jobStatus === JOBSTATUS.COMPLETED || jobStatus === JOBSTATUS.WARNING ? '' : jobError
        );
    }

    if (jobStatus === JOBSTATUS.FAILED) {
        logger.info(
            `Skipping assessment trigger for databaseHost ${databaseHostId} as multiblock read count optimization job did not complete successfully.`
        );
        throw new Error(jobError);
    }
}

async function optimizeFilesystemioOptions(params: OptimizeOSParams) {
    const {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        serverNameWithHostName,
        parentJobId,
        databaseInstanceId,
        activeNodeInstanceId,
        instanceMetadata
    } = params;

    logger.info('Optimizing Oracle filesystem I/O options', {
        accountId,
        databaseHostId,
        serverNameWithHostName,
        databaseInstanceId
    });

    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: `Fix Oracle filesystem I/O options for ${serverNameWithHostName}`,
        description: `Set filesystemio_options = setall for optimal I/O performance on ${serverNameWithHostName}`,
        resourceName: serverNameWithHostName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.WELL_ARCHITECTED,
        parentJobId
    });
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;

    try {
        const ssmCommand = optimizeFilesystemioOptionsCommand(activeNodeInstanceId, databaseInstanceId);
        const ssmComment = 'Optimize Oracle filesystem I/O options parameter';
        const response = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                [ssmCommand],
                activeNodeInstanceId,
                ssmComment,
                accountId,
                false,
                undefined,
                undefined,
                SSM_RUN_SHELL_SCRIPT_DOC,
                SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            ),
            3,
            5000
        );

        const parsedResponse = sqlResponseParsing(response);

        if (parsedResponse.error) {
            throw new Error(parsedResponse.error);
        }

        const status = parsedResponse?.status;
        if (status === 'success') {
            logger.info('Oracle filesystem I/O options optimization completed successfully');
        } else if (status === 'already-optimized') {
            jobError =
                'filesystemio_options is already set to setall - optimal I/O performance configuration. No changes needed';
            logger.info(jobError);
            jobStatus = JOBSTATUS.WARNING;
        } else if (status === 'skipped') {
            jobError = parsedResponse?.message || 'Filesystem I/O options optimization was skipped';
            logger.info(jobError);
            jobStatus = JOBSTATUS.WARNING;
        } else {
            jobError = parsedResponse?.error || 'Failed to optimize filesystem I/O options parameter';
            logger.error(jobError);
            jobStatus = JOBSTATUS.FAILED;
        }

        if (IS_DEMO_FLOW) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                databaseInstanceId,
                ['filesystem-io-options'],
                'Oracle',
                instanceMetadata || {}
            );
        }
    } catch (error) {
        jobError = jobError || `Error while optimizing filesystem I/O options ${error}`;
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
        updateLongRunningAuditGroup(
            jobStatus === JOBSTATUS.COMPLETED || jobStatus === JOBSTATUS.WARNING
                ? AuditStatus.SUCCESS
                : AuditStatus.FAILED,
            jobStatus === JOBSTATUS.COMPLETED || jobStatus === JOBSTATUS.WARNING ? '' : jobError
        );
    }

    if (jobStatus === JOBSTATUS.FAILED) {
        logger.info(
            `Skipping assessment trigger for databaseHost ${databaseHostId} as filesystem I/O options optimization job did not complete successfully.`
        );
        throw new Error(jobError);
    }
}
export { oracleOptimizeStorageOS };
