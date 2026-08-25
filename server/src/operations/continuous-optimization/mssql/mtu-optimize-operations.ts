import { cloneDeep, isEmpty, isUndefined } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { listResources } from '../../../lib/database/db';
import getLogger from '../../../utils/logger';
import { Metadata, WorkloadInstance } from '../../../utils/common-types';
import { handleOptimizeJobCreation } from '../assessment-utils';
import { AssessmentCategories, AssessmentTriggeredBy } from '../../../utils/continous-optimization-consts';
import { getServerNameWithHostname, retryWithDelay, sqlResponseParsing, IS_DEMO_FLOW } from '../../../utils/utils';
import { callSsmExecution } from '../../aws/ssm-operations';
import { getActiveSqlNode } from '../../workloads/mssql/mssql-operations';
import { OPTIMIZE_NETWORK_INTERFACE_MTU } from '../../workloads/mssql/mtu-scripts';
import { fetchFsxMtuData } from './mtu-assessment-operations';
import { updateJobDetails } from '../../database/job-operations';
import { getInstanceInfo, updateResourceMetaData } from '../../database/database-operations';
import { updateLongRunningAuditGroup } from '../../cloud-manager/audit-operations';
import { AuditStatus, SSM_COMMAND_CACHE_TYPE } from '../../../utils/consts';
import { resetCache } from '../../../utils/cache';
import { onDemandTriggerMssqlDriftAssessment } from './assessment-operations';

const logger = getLogger();
interface MTUOptimizationInterface {
    interfaceName: string;
}

interface MTUOptimizationRequest {
    accountId: string;
    credentialsId: string;
    region: string;
    databaseHostId: string;
    databaseInstanceId: string;
    interfaces: MTUOptimizationInterface[];
    parentJobId?: string;
}

async function optimizeMTUAlignment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    instanceId: string,
    targetMTU: number,
    interfaceNames: string[] = [],
    deploymentType: string
) {
    logger.info('Optimizing MTU alignment for database host', {
        databaseHostId,
        targetMTU,
        interfaceNames
    });

    let errMsg;
    try {
        const rawResponse = await retryWithDelay(
            callSsmExecution.bind(null, {
                credentialsId,
                region,
                commands: [OPTIMIZE_NETWORK_INTERFACE_MTU(targetMTU, interfaceNames, deploymentType)],
                ec2InstanceId: instanceId,
                comment: `Optimize MTU alignment for instance ${instanceId}`,
                accountId,
                shouldReadFromCloudWatchLogs: true
            }),
            3,
            2000
        );

        const parsedResponse = sqlResponseParsing(rawResponse);
        if (parsedResponse?.status === 'failed') {
            if (parsedResponse?.errors && parsedResponse.errors.length > 0) {
                errMsg = `MTU optimization failed: ${parsedResponse.errors.join('; ')}`;
            } else {
                errMsg = 'MTU optimization did not complete successfully';
            }
            logger.error(errMsg);
            throw new Error(errMsg);
        }

        logger.info('MTU optimization completed successfully', {
            databaseHostId,
            optimizedInterfaces: parsedResponse.optimizedInterfaces?.length || 0
        });

        return parsedResponse;
    } catch (error) {
        errMsg = `Error optimizing MTU alignment: ${(error as Error).message}`;
        logger.error(errMsg);
        throw new Error(errMsg);
    }
}

async function getFSxMTUValue(
    instanceRecord: WorkloadInstance,
    accountId: string,
    credentialsId: string
): Promise<number> {
    try {
        const fsxMtuData = await fetchFsxMtuData(accountId, credentialsId, instanceRecord);

        if (fsxMtuData?.error) {
            throw new Error(`Failed to get FSx MTU: ${fsxMtuData.error}`);
        }

        if (!fsxMtuData?.fsxInterfaces || fsxMtuData.fsxInterfaces.length === 0) {
            throw new Error('No FSx interfaces found');
        }

        // Get the minimum MTU from all FSx interfaces
        const fsxMTU = Math.min(...fsxMtuData.fsxInterfaces.map((iface: { MTU: number }) => iface.MTU));

        logger.info('Retrieved FSx MTU value', { fsxMTU, interfaceCount: fsxMtuData.fsxInterfaces.length });
        return fsxMTU;
    } catch (error) {
        logger.error('Failed to get FSx MTU value', { error: (error as Error).message });
        throw error;
    }
}

async function handleOptimizeMTUAlignment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    interfaces: MTUOptimizationInterface[],
    parentJobId?: string | undefined
) {
    logger.info('Optimizing MTU alignment for:', { databaseHostId, databaseInstanceId, credentialsId, region });

    const validationRequest: MTUOptimizationRequest = {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        interfaces,
        parentJobId
    };

    try {
        await validateMTUOptimizationRequest(validationRequest);
        logger.debug('MTU optimization request validation passed');
    } catch (error) {
        const errMsg = `MTU optimization request validation failed: ${(error as Error).message}`;
        logger.error(errMsg);
        throw new Error(errMsg);
    }

    let formattedInstanceName = '';
    let isAnySubjobFailed = false;
    let errorMessage = '';

    const [{ metadata, resource_name: resourceName }] = await listResources({
        accountId,
        resourceId: databaseHostId,
        credentialIds: credentialsId,
        region
    });

    if (isUndefined(resourceName) || isEmpty(metadata)) {
        const errMsg = `Resource not found for database host ${accountId}, ${databaseHostId}, ${credentialsId}, ${region}`;
        logger.error(errMsg);
        throw new Error(errMsg);
    }

    if (isEmpty(interfaces)) {
        const errMsg = 'No interfaces provided for MTU optimization';
        logger.error(errMsg);
        throw new Error(errMsg);
    }

    try {
        const { node1InstanceId, node2InstanceId } = metadata as Metadata;
        const { activeNodeInstanceId } = await getActiveSqlNode(credentialsId, region, {
            node1InstanceId,
            node2InstanceId,
            resourceId: databaseHostId,
            accountId
        });

        if (!activeNodeInstanceId) {
            const errMsg = `Active node instance ID not found for database host ${databaseHostId}`;
            logger.error(errMsg);
            throw new Error(errMsg);
        }

        // Get instance details for FSx MTU lookup
        const instanceInfo = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);
        const {
            fsxn_ids: fileSystemId,
            database_instance_name: instanceName,
            database_deployment_type: deploymentType
        } = instanceInfo;

        if (!fileSystemId) {
            throw new Error('FSx file system ID not found for MTU optimization');
        }

        const instanceRecord: WorkloadInstance = {
            id: databaseInstanceId,
            name: databaseInstanceId,
            type: 'MSSQL',
            fsxFileSystem: fileSystemId,
            region,
            sqlAuthEnabled: false,
            activeNodeInstanceid: activeNodeInstanceId,
            resourceName
        };

        // Get FSx MTU value
        const targetMTU = await getFSxMTUValue(instanceRecord, accountId, credentialsId);

        formattedInstanceName = getServerNameWithHostname(resourceName, instanceName);

        const optimizeJobId = await handleOptimizeJobCreation(
            accountId,
            credentialsId,
            region,
            formattedInstanceName,
            JOBTYPE.WELL_ARCHITECTED,
            `Optimize MTU alignment for instance ${formattedInstanceName}`,
            `Optimize MTU alignment for instance ${formattedInstanceName}`,
            parentJobId
        );

        logger.info(`Starting MTU optimization job ${optimizeJobId} for instance ${formattedInstanceName}`);

        // Extract interface names to optimize
        const interfaceNames = interfaces.map(iface => iface.interfaceName);

        // Perform MTU optimization
        const optimizationResult = await optimizeMTUAlignment(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            activeNodeInstanceId,
            targetMTU,
            interfaceNames,
            deploymentType
        );

        if (IS_DEMO_FLOW) {
            const updatedMetadata = cloneDeep(metadata) as unknown as Metadata;
            updatedMetadata.optimizedMtus = !updatedMetadata.optimizedMtus
                ? [...interfaceNames]
                : [...updatedMetadata.optimizedMtus, ...interfaceNames];
            await updateResourceMetaData(accountId, credentialsId, databaseHostId, updatedMetadata);
        }

        const status = optimizationResult?.status;
        const isWarning = status === 'warning';

        logger.info('MTU optimization completed', {
            databaseHostId,
            optimizedInterfaces: optimizationResult?.optimizedInterfaces?.length || 0,
            jobId: optimizeJobId,
            status,
            ...(isWarning && { errors: optimizationResult?.errors })
        });

        await updateJobDetails(accountId, optimizeJobId, {
            status: isWarning ? JOBSTATUS.WARNING : JOBSTATUS.COMPLETED,
            error: isWarning
                ? optimizationResult?.errors?.join('; ') || 'MTU optimization completed with warnings'
                : undefined,
            endTime: Date.now()
        });

        // Clear cache and trigger assessment
        resetCache(SSM_COMMAND_CACHE_TYPE);
        await onDemandTriggerMssqlDriftAssessment(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            AssessmentTriggeredBy.SYSTEM,
            AssessmentCategories.MTU_ALIGNMENT,
            parentJobId
        );
    } catch (error) {
        errorMessage = (error as Error).message;
        logger.error(errorMessage);
        isAnySubjobFailed = true;
        throw new Error(errorMessage);
    } finally {
        updateLongRunningAuditGroup(
            isAnySubjobFailed ? AuditStatus.FAILED : AuditStatus.SUCCESS,
            errorMessage,
            formattedInstanceName
        );

        if (parentJobId) {
            updateJobDetails(accountId, parentJobId, {
                status: isAnySubjobFailed ? JOBSTATUS.FAILED : JOBSTATUS.COMPLETED,
                endTime: Date.now(),
                error: errorMessage || undefined
            });
        }
    }
}

async function validateMTUOptimizationRequest(request: MTUOptimizationRequest): Promise<boolean> {
    const { accountId, credentialsId, region, databaseHostId, databaseInstanceId, interfaces } = request;

    if (!accountId || !credentialsId || !region || !databaseHostId || !databaseInstanceId) {
        throw new Error('Missing required parameters for MTU optimization');
    }

    if (!interfaces || interfaces.length === 0) {
        throw new Error('No interfaces specified for MTU optimization');
    }

    // Validate interface data
    for (const iface of interfaces) {
        if (!iface.interfaceName || iface.interfaceName.trim() === '') {
            throw new Error(`Invalid interface name: ${iface.interfaceName}`);
        }
    }

    // Verify resource exists
    try {
        const resources = await listResources({
            accountId,
            resourceId: databaseHostId,
            credentialIds: credentialsId,
            region
        });

        if (!resources || resources.length === 0) {
            throw new Error(`Database host ${databaseHostId} not found`);
        }
    } catch (error) {
        throw new Error(`Resource validation failed: ${(error as Error).message}`);
    }

    return true;
}

export {
    handleOptimizeMTUAlignment,
    validateMTUOptimizationRequest,
    optimizeMTUAlignment,
    getFSxMTUValue,
    type MTUOptimizationRequest,
    type MTUOptimizationInterface
};
