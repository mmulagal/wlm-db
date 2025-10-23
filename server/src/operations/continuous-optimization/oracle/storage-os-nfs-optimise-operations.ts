import { JOBTYPE, JOBSTATUS } from '@prisma/client';
import { DatabaseInstance, ResourceDetails, WorkloadInstance } from '../../../utils/common-types';
import {
    AssessmentCategories,
    OptimizeOracleNFSStorageOperatingSystem
} from '../../../utils/continous-optimization-consts';
import getLogger from '../../../utils/logger';
import { updateLongRunningAuditGroup } from '../../cloud-manager/audit-operations';
import { handleOptimizeJobCreation } from '../assessment-utils';
import { KernelTcpSlotOptimiseResponse, OracleJobMetadata } from './consts';
import { OptimizeOSParams } from './common-types';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { optimiseTcpSunrpcSlotsScript } from './ssm-scripts/os-nfs-optimize-scripts';
import { AuditStatus, RESOURCESTYPE } from '../../../utils/consts';
import { isDemo, retryWithDelay, sqlResponseParsing } from '../../../utils/utils';
import { callSsmExecution } from '../../aws/ssm-operations';
import { updateOptimizedConfigNameInInstanceTable } from '../../demo-operations';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from '../../workloads/oracle/consts';
import { triggerAssessmentAfterOptimization } from '../../cont-opt-optimize-operations';

const logger = getLogger();
const isDemoFlow = isDemo();

async function optimiseKernelTcpSunrpcSlots(params: OptimizeOSParams) {
    const {
        accountId,
        credentialsId,
        region,
        databaseInstanceId,
        serverNameWithHostName,
        activeNodeInstanceId,
        instanceMetadata,
        parentJobId
    } = params;

    logger.info(`Optimizing kernel TCP sunrpc slots for ${serverNameWithHostName}`);

    const jobName = `Fix tcp sunrpc slots for ${serverNameWithHostName}`;
    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: jobName,
        description: jobName,
        resourceName: serverNameWithHostName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.WELL_ARCHITECTED,
        parentJobId
    });

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;

    try {
        const response = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                [optimiseTcpSunrpcSlotsScript],
                activeNodeInstanceId,
                'Fix kernel TCP sunrpc slot table entries for Oracle NFS storage optimization',
                accountId,
                false,
                undefined,
                undefined,
                SSM_RUN_SHELL_SCRIPT_DOC,
                SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            )
        );

        const { status: optimisationStatus, error } = sqlResponseParsing(response) as KernelTcpSlotOptimiseResponse;

        if (optimisationStatus === 'partial' || optimisationStatus === 'optimized-offline') {
            jobStatus = JOBSTATUS.WARNING;
            jobError = error;
        } else if (optimisationStatus === 'failed') {
            jobStatus = JOBSTATUS.FAILED;
            jobError = error;
        }

        // Update demo instance if needed
        if (isDemoFlow) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                databaseInstanceId,
                [OptimizeOracleNFSStorageOperatingSystem.KERNEL_PARAMETERS],
                'OS',
                instanceMetadata || {}
            );
        }
    } catch (error) {
        jobError = `Error fixing kernel TCP sunrpc slots: ${error}`;
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
}
async function oracleOptimizeStorageOSForNfs(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    configurationName: string,
    activeNodeInstanceId: string,
    instancesDetails: DatabaseInstance[],
    resourceDetail: ResourceDetails,
    masterJobId?: string
) {
    logger.info(
        `Optimizing storage OS for NFS on ${accountId}, ${credentialsId} ${databaseHostId} ${databaseInstanceId} in ${region} for configuration ${configurationName}`
    );

    const [instanceDetail] = instancesDetails;
    logger.info(`Instance detail for optimization: ${JSON.stringify(instanceDetail)}`);
    const { fsxn_ids: fsxId } = instanceDetail;
    const { resource_name: oracleResourceName } = resourceDetail;
    const { database_instance_name: instanceName } = instanceDetail as unknown as DatabaseInstance;

    const serverNameWithHostName = instanceName
        ? `${oracleResourceName}\\${instanceName}`
        : (oracleResourceName as string);
    updateLongRunningAuditGroup(undefined, undefined, serverNameWithHostName);

    let jobDescription = '';
    switch (configurationName) {
        case OptimizeOracleNFSStorageOperatingSystem.KERNEL_PARAMETERS:
            jobDescription = `Fix storage operating system kernel parameters for ${serverNameWithHostName}`;
            break;
        default:
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
        case OptimizeOracleNFSStorageOperatingSystem.KERNEL_PARAMETERS: {
            try {
                await optimiseKernelTcpSunrpcSlots({
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    serverNameWithHostName,
                    activeNodeInstanceId,
                    instanceMetadata: instanceDetail,
                    parentJobId
                });
            } catch (error) {
                const errorMessage = `Error while fixing operating system settings ${error}`;
                logger.error(errorMessage);
                jobError = errorMessage;
                jobStatus = JOBSTATUS.FAILED;
            } finally {
                if (jobStatus === JOBSTATUS.FAILED) {
                    await updateJobDetails(accountId, parentJobId, {
                        status: jobStatus,
                        endTime: Date.now(),
                        error: jobError
                    });
                }
                await updateLongRunningAuditGroup(
                    jobStatus === JOBSTATUS.FAILED ? AuditStatus.FAILED : AuditStatus.SUCCESS,
                    jobError
                );
            }
            break;
        }
        default:
            jobStatus = JOBSTATUS.FAILED;
            jobError = `Unsupported optimization configuration name: ${configurationName}`;
            logger.error(jobError);
            break;
    }

    if (jobStatus !== JOBSTATUS.FAILED) {
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

export { oracleOptimizeStorageOSForNfs };
