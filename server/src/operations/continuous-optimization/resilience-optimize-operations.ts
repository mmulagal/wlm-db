import createError from 'http-errors';
import { isEmpty, isNil } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../../utils/logger';
import {
    AvailableSnapshotPoliciesResponseType,
    BulkOptimizeSnapshotPolicyParamsType,
    OntapVolumeType,
    SnapshotPolicyType
} from '../../routes/types/continuous-optimization.types';
import { WorkloadInstance } from '../../utils/common-types';
import { AuditStatus, CUSTOM_SSM_EXECUTION_TIMEOUT, HttpErrorCodes } from '../../utils/consts';
import { activeSqlNodeDetails } from '../cont-opt-optimize-operations';
import {
    GET_CLUSTER_SNAPSHOT_POLICIES,
    SET_VOLUME_SNAPSHOT_POLICY
} from '../workloads/mssql/continuous-optimization-scripts';
import { callSsmExecution } from '../aws/ssm-operations';
import { retryWithDelay, sqlResponseParsing } from '../../utils/utils';
import { describeFSxStorageVirtualMachines } from '../../lib/aws/fsx';
import { MappedOnTapVolumeResponse } from '../database-hosts-operations';
import { getMappedOntapVolumes } from '../aws/fsx-operations';
import { handleOptimizeJobCreation, JobMetadata } from './assessment-utils';
import { updateJobDetails } from '../database/job-operations';
import { updateLongRunningAuditGroup } from '../cloud-manager/audit-operations';

const logger = getLogger();

async function getMappedVolumeDetails(credentialsId: string, region: string, instanceRecord: WorkloadInstance) {
    return (
        ((await getMappedOntapVolumes(
            credentialsId,
            region,
            instanceRecord.fsxFileSystem,
            false,
            instanceRecord.activeNodeInstanceid,
            [instanceRecord.name],
            instanceRecord.sqlAuthEnabled,
            true
        )) as MappedOnTapVolumeResponse[]) || [{ volumeRecords: [], volumeDBMap: {} }]
    );
}

async function getActiveInstanceInfo(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    const {
        sqlAuthEnabled,
        activeNodeInstanceId,
        fsxId,
        instanceId,
        instanceName,
        databaseType,
        awsAccountId,
        serverNameWithHostName
    } = await activeSqlNodeDetails(credentialsId, region, accountId, databaseHostId, databaseInstanceId);

    const instanceRecord: WorkloadInstance = {
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

    return { instanceRecord, fsxId };
}

async function getAvailableSnapshotPolicyList(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
): Promise<AvailableSnapshotPoliciesResponseType> {
    logger.info('Getting available snapshot policy list', { credentialsId, databaseInstanceId, databaseHostId });
    const response: AvailableSnapshotPoliciesResponseType = {
        snapshotPolicies: [],
        errorMessage: ''
    };
    try {
        const { instanceRecord, fsxId } = await getActiveInstanceInfo(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId
        );
        const {
            StorageVirtualMachines: [{ UUID: svmUuid }]
        } = await describeFSxStorageVirtualMachines(credentialsId, region, fsxId);
        if (isNil(svmUuid)) {
            throw createError(HttpErrorCodes.NOT_FOUND, 'No SVM found for the given FSx ID');
        }
        const command = [GET_CLUSTER_SNAPSHOT_POLICIES(instanceRecord, svmUuid)];
        const ssmComment = 'Get available snapshot policies';

        const ssmResponse = await callSsmExecution(
            credentialsId,
            region,
            command,
            instanceRecord.activeNodeInstanceid,
            ssmComment,
            accountId,
            false
        );
        const parsedSsmResponse = sqlResponseParsing(ssmResponse);
        logger.info('SSM response', parsedSsmResponse);

        if (!isEmpty(parsedSsmResponse?.errors)) {
            logger.error('Error executing SSM command while getting snaphot policy list', parsedSsmResponse.errors);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, parsedSsmResponse.errors);
        }

        if (!isEmpty(parsedSsmResponse?.snapshotPolicies)) {
            response.snapshotPolicies = parsedSsmResponse.snapshotPolicies;
        }
        return response;
    } catch (error) {
        const errorStr = JSON.stringify(error);
        logger.error('Error getting available snapshot policy list', errorStr);
        response.errorMessage = errorStr;
        return response;
    }
}

async function setSnapshotPolicyForVolumes(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    snapshotPolicy: SnapshotPolicyType,
    volumesList?: OntapVolumeType[],
    parentJobId?: string | undefined
) {
    logger.info('Optimize snapshot policy for volumes', {
        region,
        accountId,
        credentialsId,
        databaseInstanceId,
        databaseHostId,
        parentJobId,
        snapshotPolicy,
        volumesList
    });
    const { instanceRecord, fsxId } = await getActiveInstanceInfo(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId
    );

    // create job
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError = '';
    const subJobsIds: string[] = [];
    const jobMetadata: JobMetadata = {
        hostsToOptimize: [
            {
                optimizationType: 'resiliency',
                resourceId: databaseHostId,
                sqlServerInstances: [databaseInstanceId]
            }
        ]
    };
    // check whether any jobs on the same resource running
    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        instanceRecord.resourceName,
        JOBTYPE.OPTIMIZATION,
        `Optimize resiliency for ${instanceRecord.resourceName}`,
        `Optimize resiliency for ${instanceRecord.resourceName}`,
        parentJobId,
        jobMetadata
    );
    try {
        const subJobId = await handleOptimizeJobCreation(
            accountId,
            credentialsId,
            region,
            instanceRecord.resourceName,
            JOBTYPE.OPTIMIZATION,
            `Optimize snapshot policy for ${instanceRecord.resourceName}`,
            `Optimize snapshot policy for ${instanceRecord.resourceName}`,
            jobId,
            jobMetadata
        );
        subJobsIds.push(subJobId);
        const instanceVolumeMapping = await getMappedVolumeDetails(credentialsId, region, instanceRecord);
        const volumeRecords =
            Object.values(instanceVolumeMapping)
                ?.map(i => i?.volumeRecords)
                .flat() || [];
        const volumeUuids = volumeRecords.map(volume => volume.uuid as string);

        const params: BulkOptimizeSnapshotPolicyParamsType = {
            fsxId,
            region,
            volUuids: JSON.stringify(volumeUuids),
            apiBody: JSON.stringify({ snapshot_policy: snapshotPolicy })
        };

        const command = [SET_VOLUME_SNAPSHOT_POLICY(params)];
        const ssmComment = 'Set snapshot policy for volumes';

        const ssmResponse = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                command,
                instanceRecord.activeNodeInstanceid,
                ssmComment,
                accountId,
                false,
                CUSTOM_SSM_EXECUTION_TIMEOUT
            )
        );
        const parsedSsmResponse = sqlResponseParsing(ssmResponse);
        if (!isEmpty(parsedSsmResponse?.errors)) {
            logger.error(
                'Error executing SSM command to set snapshot for volumes',
                parsedSsmResponse.errors,
                volumeUuids
            );
            jobError = `Failed to set snapshot policy for volumes: ${parsedSsmResponse.errors}`;
            jobStatus = JOBSTATUS.FAILED;
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, parsedSsmResponse.errors);
        }
        if (parsedSsmResponse?.response.length !== volumeUuids.length) {
            logger.error(
                'Error setting snapshot policy for volumes. ONTAP job IDs:',
                parsedSsmResponse.response,
                volumeUuids
            );
            jobError = `Failed to set snapshot policy for some volumes: ONTAP job IDs:', ${parsedSsmResponse.responseparsed}`;
            jobStatus = JOBSTATUS.WARNING;
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Error setting snapshot policy for volumes');
        }
    } catch (error) {
        const errMsg = JSON.stringify(error);
        logger.error('Error setting snapshot policy for volumes');
        jobStatus = JOBSTATUS.FAILED;
        jobError = errMsg;
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errMsg);
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
        subJobsIds.forEach(async subJobId => {
            await updateJobDetails(accountId, subJobId, {
                status: jobStatus,
                endTime: Date.now(),
                error: jobError
            });
        });
        const auditStatus = jobStatus === JOBSTATUS.COMPLETED ? AuditStatus.SUCCESS : AuditStatus.FAILED;
        updateLongRunningAuditGroup(auditStatus, jobError);
    }

    return { jobId };
}

export { getAvailableSnapshotPolicyList, setSnapshotPolicyForVolumes };
