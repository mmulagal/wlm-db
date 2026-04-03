import { isEmpty } from 'lodash-es';
import { JOBSTATUS } from '@prisma/client';
import createError from 'http-errors';
import { CommandFilterKey } from '@aws-sdk/client-ssm';
import { getJobs, registerJob } from '../database/job-operations';
import { getServerNameWithHostname, getTimeDifferenceInMinutes } from '../../utils/utils';
import { updateLongRunningAuditGroup } from '../cloud-manager/audit-operations';
import { AssessmentCategoriesOracle, AssessmentStatus } from '../../utils/continous-optimization-consts';
import getLogger from '../../utils/logger';
import type {
    DatabaseInstance,
    HostOsPatchAssessmentObject,
    JobMetadata,
    Metadata,
    ResourceAssessmentData,
    ResourceDetails
} from '../../utils/common-types';
import { OracleJobMetadata } from './oracle/consts';
import { OracleMappedOntapVolumeRecordType } from '../workloads/oracle/common-types';
import getMissingPermissionsList from '../aws/iam-operations';
import { DatabaseTypes, HttpErrorCodes } from '../../utils/consts';
import { getInstanceInfo, updateDatabaseHostAssessmentData } from '../database/database-operations';
import { getActiveSqlNode } from '../workloads/mssql/mssql-operations';
import { listSsmCommands } from '../../lib/aws/ssm';
import { listResources } from '../../lib/database/db';
import { RESOURCE_DEFAULT_SELECT_FIELDS } from '../../utils/database-consts';

const logger = getLogger();

interface UnOptimizedDiskGroups {
    diskGroupName: string;
    svmName?: string;
    svmId?: string;
    volumeNames?: string[];
    lunsToAdd: number;
    lunSerials?: string[];
    asmDisks?: string[];
    iscsiIp?: string;
}

function getMatchingAssessmentStatus(finding: string) {
    logger.info('Getting matching assessment status for finding:', finding);
    switch (finding) {
        case 'NOT_OPTIMIZED':
            return AssessmentStatus.NOT_OPTIMIZED;
        case 'OVER_PROVISIONED':
            return AssessmentStatus.OVER_PROVISIONED;
        case 'UNDER_PROVISIONED':
            return AssessmentStatus.UNDER_PROVISIONED;
        case 'OPTIMIZED':
        default:
            return AssessmentStatus.OPTIMIZED;
    }
}

async function handleOptimizeJobCreation(
    accountId: string,
    credentialsId: string,
    region: string,
    serverNameWithHostName: string,
    jobType: string,
    jobName: string,
    jobDescription: string,
    parentJobId?: string,
    jobMetadata?: JobMetadata | OracleJobMetadata
) {
    updateLongRunningAuditGroup(undefined, undefined, serverNameWithHostName);

    const filterParams = {
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName,
        type: jobType,
        region,
        credentialsId,
        ...(parentJobId && { parentJobId })
    };
    const {
        items: [job]
    } = await getJobs(accountId, filterParams);

    if (job) {
        const timeDifferenceInMinutes = getTimeDifferenceInMinutes(job.startTime);
        if (timeDifferenceInMinutes <= 5) {
            throw createError(412, `A job is already in progress with ID: ${job.id}. Please wait for it to finish.`);
        }
    }

    // create the parent job for optimize operation
    const { id } = await registerJob(accountId, credentialsId, region, {
        type: jobType,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName,
        name: jobName,
        startTime: Date.now(),
        description: jobDescription,
        ...(parentJobId && { parentJobId }),
        ...(jobMetadata && { metadata: jobMetadata })
    });
    logger.debug(`Job created with id ${id}`);

    return id;
}

// Recursive function to check for any "not-optimized" status in the assessment results.
// It checks both arrays and objects, looking for the specific status in any nested structure.
// Returns true if any "not-optimized" status is found, otherwise false.
// This is used to determine if an instance has any assessment results that are not optimized.
function hasNotOptimizedStatus(obj: unknown): boolean {
    if (Array.isArray(obj)) {
        return obj.some(hasNotOptimizedStatus);
    }
    if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
        if (
            ('status' in obj && obj.status === AssessmentStatus.NOT_OPTIMIZED) ||
            ('errorMessage' in obj && !!obj.errorMessage)
        ) {
            return true;
        }
        return Object.values(obj).some(hasNotOptimizedStatus);
    }
    return false;
}

function getLatestInstanceAssessmentTime(
    databaseInstanceConfigData: { config_data_type: string; creation_time: Date }[]
) {
    return databaseInstanceConfigData
        .filter(config => config.config_data_type !== AssessmentCategoriesOracle.MAPPED_ONTAP_VOLUMES)
        .reduce((latest, { creation_time: currentCreationTime }) => {
            const creationTime = new Date(currentCreationTime || 0);
            return creationTime > latest ? creationTime : latest;
        }, new Date(0));
}

async function checkForMissingOptimizePermissions(credentialsId: string, region: string, permissions: string[]) {
    logger.info('Checking for missing optimize permissions', { credentialsId, region, permissions });
    try {
        const missingPermissions: string[] = [];
        const { implicitlyDenied, explicitlyDenied } = await getMissingPermissionsList(
            credentialsId,
            region,
            permissions
        );
        const combinedDeniedPermissions = [...implicitlyDenied, ...explicitlyDenied];
        if (combinedDeniedPermissions.length > 0) {
            combinedDeniedPermissions.forEach(permission => {
                missingPermissions.push(`${permission.service}:${permission.action}`);
            });
        }
        return missingPermissions;
    } catch (error) {
        logger.error('Error while checking for missing optimize permissions', {
            credentialsId,
            region,
            permissions,
            error
        });
    }
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

//  e.g., "NFSv3" -> 3, "NFSv4" -> 4, "3" -> 3, "4.0" -> 4, "4.1" -> 4.1
function normalizeNfsVersion(version: string | null): number | null {
    if (!version) {
        return null;
    }
    const cleaned = version.toLowerCase().replace(/nfsv?/i, '').trim();
    return parseFloat(cleaned);
}

async function checkIfPatchBaselineInProgress(
    credentialsId: string,
    region: string,
    instanceIds: string[]
): Promise<boolean> {
    logger.info('Checking if patch baseline is in progress', { credentialsId, region, instanceIds });

    for await (const instanceId of instanceIds) {
        const listPatchBaselineCommandParams = {
            InstanceId: instanceId,
            MaxResults: 50,
            Filters: [
                {
                    key: CommandFilterKey.DOCUMENT_NAME,
                    value: 'AWS-RunPatchBaseline'
                },
                {
                    key: CommandFilterKey.STATUS,
                    value: 'InProgress'
                }
            ]
        };

        const { Commands = [] } = await listSsmCommands(credentialsId, region, listPatchBaselineCommandParams);
        if (Commands.length > 0) {
            logger.warn('Patch baseline is already running on the instance', { instanceId, region, credentialsId });
            return true;
        }
    }
    return false;
}

async function updatePatchBaselineStatusForHost(
    accountId: string,
    databaseHostId: string,
    hostOsPatchAssessment?: HostOsPatchAssessmentObject[]
): Promise<void> {
    const resources =
        (await listResources({
            accountId,
            resourceId: databaseHostId,
            selectKeys: [...new Set([...RESOURCE_DEFAULT_SELECT_FIELDS, 'assessment_data'])]
        })) || [];

    if (!isEmpty(resources) && !isEmpty(hostOsPatchAssessment)) {
        await Promise.all(
            resources.map(async ({ credentials_id: credentialsId, assessment_data: assessmentData }) => {
                const existingAssessmentData = assessmentData as ResourceAssessmentData;
                const newAssessmentData = {
                    ...existingAssessmentData,
                    hostOsPatch: hostOsPatchAssessment,
                    lastAssessedDate: new Date().getTime().toString()
                };
                await updateDatabaseHostAssessmentData(accountId, credentialsId, databaseHostId, newAssessmentData);
            })
        );
    }
}

/**
 * Determines if ontapVolumes uses PDB-grouped structure (pdbName -> fileType -> volumes[])
 * vs flat structure (fileType -> volumes[]).
 * CDB instances without pdbMountDetails will have isCDB=true but flat ontapVolumes.
 */
function isPdbGroupedVolumes(isCDB: boolean, ontapVolumes: OracleMappedOntapVolumeRecordType['ontapVolumes']): boolean {
    const values = Object.values(ontapVolumes || {});
    return isCDB && values.length > 0 && !Array.isArray(values[0]);
}

export {
    getMatchingAssessmentStatus,
    handleOptimizeJobCreation,
    hasNotOptimizedStatus,
    getLatestInstanceAssessmentTime,
    UnOptimizedDiskGroups,
    checkForMissingOptimizePermissions,
    activeSqlNodeDetails,
    normalizeNfsVersion,
    checkIfPatchBaselineInProgress,
    updatePatchBaselineStatusForHost,
    isPdbGroupedVolumes,
    JobMetadata
};
