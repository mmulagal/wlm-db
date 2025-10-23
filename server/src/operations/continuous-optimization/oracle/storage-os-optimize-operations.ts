import createError from 'http-errors';
import { JOBTYPE, JOBSTATUS } from '@prisma/client';
import { isEmpty } from 'lodash-es';
import { Metadata, DatabaseInstance, WorkloadInstance } from '../../../utils/common-types';
import { RESOURCESTYPE, HttpErrorCodes, DatabaseTypes, AuditStatus } from '../../../utils/consts';
import {
    AssessmentCategories,
    OptimizeOracleiSCSIStorageOperatingSystem,
    OptimizeOracleNFSStorageOperatingSystem
} from '../../../utils/continous-optimization-consts';
import { isDemo, retryWithDelay, sqlResponseParsing } from '../../../utils/utils';
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
    fixTransparentHugepageCommand
} from './ssm-scripts/os-optimization-scripts';
import { handleOptimizeJobCreation } from '../assessment-utils';
import getLogger from '../../../utils/logger';
import { OracleJobMetadata, TcpFeatures, TcpOptimizationResponse } from './consts';
import { handleAfdDriftOptimization, handleAsmLibDriftOptimization } from './storage-optimize-operations';
import { oracleOptimizeStorageOSForNfs } from './storage-os-nfs-optimise-operations';
import { OptimizeOSParams } from './common-types';

const logger = getLogger();
const isDemoFlow = isDemo();

async function oracleOptimizeStorageOS(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    configurationName: string,
    masterJobId?: string
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

    const { metadata, resource_name: oracleResourceName } = resourceDetail;
    const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;

    const { isSSMConnected, activeNodeInstanceId, instancesDetails } = await getActiveSqlNode(credentialsId, region, {
        node1InstanceId,
        node2InstanceId,
        resourceType: DatabaseTypes.ORACLE
    });

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

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError = '';
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
                const errorMessage = `Error while fixing operating system settings ${error}`;
                logger.error(errorMessage);
                jobError = errorMessage;
                jobStatus = JOBSTATUS.WARNING;
            } finally {
                await updateJobDetails(accountId, parentJobId, {
                    status: jobStatus,
                    endTime: Date.now(),
                    error: jobError
                });
                await updateLongRunningAuditGroup(AuditStatus.FAILED, jobError);
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
                const errorMessage = `Error while fixing iSCSI replacement timeout settings ${error}`;
                logger.error(errorMessage);
                jobError = errorMessage;
                jobStatus = JOBSTATUS.FAILED;
            } finally {
                await updateJobDetails(accountId, parentJobId, {
                    status: jobStatus,
                    endTime: Date.now(),
                    error: jobError
                });
                if (jobStatus === JOBSTATUS.FAILED) {
                    await updateLongRunningAuditGroup(AuditStatus.FAILED, jobError);
                }
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
                const errorMessage = `Error while fixing multipath IO sessions settings ${error}`;
                logger.error(errorMessage);
                jobError = errorMessage;
                jobStatus = JOBSTATUS.FAILED;
            } finally {
                await updateJobDetails(accountId, parentJobId, {
                    status: jobStatus,
                    endTime: Date.now(),
                    error: jobError
                });
                if (jobStatus === JOBSTATUS.FAILED) {
                    await updateLongRunningAuditGroup(AuditStatus.FAILED, jobError);
                }
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
                    parentJobId
                });
            } catch (error) {
                const errorMessage = `Error while fixing AFD logical block size settings ${error}`;
                logger.error(errorMessage);
                jobError = errorMessage;
                jobStatus = JOBSTATUS.WARNING;
            } finally {
                await updateJobDetails(accountId, parentJobId, {
                    status: jobStatus,
                    endTime: Date.now(),
                    error: jobError
                });
                await updateLongRunningAuditGroup(AuditStatus.FAILED, jobError);
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
                    parentJobId
                });
            } catch (error) {
                const errorMessage = `Error while fixing Asm lib logical block size settings ${error}`;
                logger.error(errorMessage);
                jobError = errorMessage;
                jobStatus = JOBSTATUS.WARNING;
            } finally {
                await updateJobDetails(accountId, parentJobId, {
                    status: jobStatus,
                    endTime: Date.now(),
                    error: jobError
                });
                await updateLongRunningAuditGroup(AuditStatus.FAILED, jobError);
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
                const errorMessage = `Error while fixing transparent huge pages settings ${error}`;
                logger.error(errorMessage);
                jobError = errorMessage;
                jobStatus = JOBSTATUS.FAILED;
            } finally {
                await updateJobDetails(accountId, parentJobId, {
                    status: jobStatus,
                    endTime: Date.now(),
                    error: jobError
                });
                if (jobStatus === JOBSTATUS.FAILED) {
                    await updateLongRunningAuditGroup(AuditStatus.FAILED, jobError);
                }
            }
            break;
        }

        default: {
            const errorMessage = `Configuration name ${configurationName} is not supported`;
            jobStatus = JOBSTATUS.FAILED;
            jobError = errorMessage;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
        }
    }

    // Common assessment trigger logic for all successful optimizations
    if (jobStatus === JOBSTATUS.COMPLETED || jobStatus === JOBSTATUS.WARNING) {
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
        logger.info(`Updated tcp options ${activeNodeInstanceId}`, { response });

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

        if (isDemoFlow) {
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
        updateLongRunningAuditGroup(
            jobStatus === JOBSTATUS.COMPLETED ? AuditStatus.SUCCESS : AuditStatus.FAILED,
            jobStatus === JOBSTATUS.COMPLETED ? '' : jobError
        );
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
        if (isDemoFlow) {
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
        updateLongRunningAuditGroup(
            jobStatus === JOBSTATUS.COMPLETED || jobStatus === JOBSTATUS.WARNING
                ? AuditStatus.SUCCESS
                : AuditStatus.FAILED,
            jobStatus === JOBSTATUS.COMPLETED || jobStatus === JOBSTATUS.WARNING ? '' : jobError
        );
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

        if (isDemoFlow) {
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
        updateLongRunningAuditGroup(
            jobStatus === JOBSTATUS.COMPLETED || jobStatus === JOBSTATUS.WARNING
                ? AuditStatus.SUCCESS
                : AuditStatus.FAILED,
            jobStatus === JOBSTATUS.COMPLETED || jobStatus === JOBSTATUS.WARNING ? '' : jobError
        );
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

        if (isDemoFlow) {
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

export { oracleOptimizeStorageOS };
