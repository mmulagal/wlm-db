import createError from 'http-errors';
import moment from 'moment';
import { isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import type {
    AssessmentItemType,
    AssessmentErrorItemType,
    OntapVolumeType
} from '../../../routes/types/continuous-optimization.types';
import getLogger from '../../../utils/logger';
import { createDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import {
    AssessmentCategories,
    AssessmentStatus,
    OptimizeStorageConfigs
} from '../../../utils/continous-optimization-consts';
import { MSSQL_GOLDEN_CONFIG, MSSQL_HEARTBEAT_SETTINGS } from './golden-config';
import { GENERIC_ASSESSMENT_ERROR_MESSAGE, HttpErrorCodes, SqlServerDeploymentModel } from '../../../utils/consts';
import { IS_DEMO_FLOW, parseMultipleCommandResponse, sqlResponseParsing } from '../../../utils/utils';
import {
    DatabaseInstance,
    DatabaseInstanceMetadata,
    StorageAssessment,
    WorkloadInstance,
    MappedOnTapVolumeResponse,
    AWSBackupAssessment,
    CrrAssessment,
    CrrDetails,
    HighAvailabilityAssessment,
    Metadata,
    ResourceAssessmentData,
    HighAvailabilitySharedStorage,
    VolumeRecord,
    VolumeDBMapEntry
} from '../../../utils/common-types';
import { getInstanceInfo } from '../../database/database-operations';
import { CROSS_REGION_REPLICATION_SCRIPT } from '../../workloads/mssql/resiliency-scripts';
import { FETCH_MSSQL_INSTANCE_VOLUME_LUN_DRIVE_DETAILS } from '../../workloads/mssql/storage-scripts';
import { GET_SNAPSHOT_DETAILS } from '../../workloads/mssql/assessment-scripts';
import { callSsmExecution } from '../../aws/ssm-operations';
import { getMZFsxnNodePreference } from '../../aws/fsx-operations';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { resolveCrossRegionPeerIds, updateCrrDetailsWithCrossRegionStatus } from '../crr-assessment-utils';
import {
    initiateAwsBackupAssessment as initiateSharedAwsBackupAssessment,
    getAwsBackupDriftData as getSharedAwsBackupDriftData
} from '../resilience-awsBackup-operations';
import {
    CLUSTER_QUORUM_TYPE,
    SQL_SERVER_SERVICES,
    DRIVE_LETTER,
    HEARTBEAT_SETTINGS,
    GET_LUN_IGROUP_INITIATOR_NAMES_AND_HOSTIQN,
    AOAG_INSTANCE_ROLE
} from '../../workloads/mssql/high-availability-scripts';

const logger = getLogger();

function filterDataLogVolumes(instanceVolumeMapping: MappedOnTapVolumeResponse) {
    const volumeRecords =
        Object.values(instanceVolumeMapping)
            ?.map(i => i?.volumeRecords)
            .flat() || [];
    const volumeDBMap =
        Object.values(instanceVolumeMapping)
            ?.map(i => i?.volumeDBMap)
            .flat() || [];

    // Ignore tempdb volumes from resiliency assessment. If tempdb volume has a user database, it will be included in assessment.
    const nonTempDBVolumeUuids = [
        ...new Set(volumeDBMap.filter(volume => volume.databaseName !== 'tempdb').map(volume => volume.ontapVolumeuuid))
    ];

    const dataLogVolumeMap = new Map(
        volumeRecords
            .filter(volume => nonTempDBVolumeUuids.includes(volume.uuid))
            .map(volume => [volume.uuid, volume.name])
    );
    return { dataLogVolumeMap };
}

function getVolumesWithoutSnapshotPolicy(volumes: Array<{ Key?: string; Value?: string }> = []) {
    // if instance has volumes in violation list for snapshot-policy, collect snapshot copy data for additional checks.
    const violations: string[] = [];
    volumes.forEach((volDetails: Record<string, string>) => {
        if (
            isEmpty(volDetails[OptimizeStorageConfigs?.SNAPSHOT_POLICY]) ||
            volDetails[OptimizeStorageConfigs?.SNAPSHOT_POLICY] === 'none'
        ) {
            violations.push(volDetails?.name);
        }
    });
    return violations;
}

async function collectVolumeSnapshotCopiesData(
    credentialsId: string,
    accountId: string,
    instanceRecord: WorkloadInstance,
    volumeAssessmentData: Array<{ Key?: string; Value?: string }>,
    violations: string[]
) {
    logger.info('Checking for volume snapshot copies:', { volumeAssessmentData, violations });
    try {
        const { region } = instanceRecord;
        const fsxId = instanceRecord.fsxFileSystem.split(',')[0];
        const volumesToCheck = volumeAssessmentData
            .filter((vol: Record<string, string>) => violations?.includes(vol?.name))
            .map((vol: Record<string, string>) => vol?.uuid);

        const command = [GET_SNAPSHOT_DETAILS(volumesToCheck, fsxId, region)];
        const ssmComment = 'Get snapshot copy details for volumes';
        const rawResponse = await callSsmExecution({
            credentialsId,
            region: instanceRecord.region,
            commands: command,
            ec2InstanceId: instanceRecord.activeNodeInstanceid,
            comment: ssmComment,
            accountId,
            shouldReadFromCloudWatchLogs: true
        });
        const { response: ssmResponse, error: ssmError } = sqlResponseParsing(rawResponse);
        if (!isEmpty(ssmError)) {
            throw Error(
                `Error executing SSM command to retrieve snapshot copy details for volumes: ${volumesToCheck}. Error: ${ssmError}`
            );
        }
        return ssmResponse;
    } catch (error) {
        // Any error caught here shall not fail the resilience assessment as it is an additional check.
        logger.error('Error checking for volume snapshot copies', error);
    }
}

async function collectSnapshotCopyData(
    accountId: string,
    credentialsId: string,
    instanceRecord: WorkloadInstance,
    volumes: Array<{ Key?: string; Value?: string }> = []
) {
    logger.info('Collecting snapshot copy data for volumes:', instanceRecord?.name, volumes);
    const violatedVols = getVolumesWithoutSnapshotPolicy(volumes);
    try {
        if (violatedVols.length) {
            const res = await collectVolumeSnapshotCopiesData(
                credentialsId,
                accountId,
                instanceRecord,
                volumes,
                violatedVols
            );
            volumes.forEach((volDetail: Record<string, string>) => {
                const snapshotTimestamp = new Date(res?.[volDetail?.uuid]?.create_time).getTime().toString();
                volDetail[OptimizeStorageConfigs.MOST_RECENT_SNAPSHOT_TIMESTAMP] = snapshotTimestamp ?? null;
            });
        }
        return volumes;
    } catch (error) {
        // this is data collection for additional checks, don't throw error from here
        logger.error(
            'Error checking for volume snapshot objects details, using snapshot policy data for assessment',
            error
        );
    }
}

async function getResilienceDriftAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    resourceName: string,
    databaseInstanceId: string,
    fieldsValues: string[] = [],
    resourceAssessmentData: ResourceAssessmentData = {},
    databaseInstanceConfigData: Array<{ config_data_type: string; config_data: any }> = []
): Promise<(AssessmentItemType | AssessmentErrorItemType)[]> {
    logger.info('Getting resilience drift assessment for:', {
        credentialsId,
        databaseInstanceId,
        databaseHostId,
        resourceName,
        fieldsValues
    });
    const shouldTriggerSnapshotPolicyAssessment =
        isEmpty(fieldsValues) || fieldsValues.includes(AssessmentCategories.SNAPSHOT_POLICY);
    const shouldTriggerCrrAssessment = isEmpty(fieldsValues) || fieldsValues.includes(AssessmentCategories.CRR);
    const shouldTriggerAwsBackupAssessment =
        isEmpty(fieldsValues) || fieldsValues.includes(AssessmentCategories.AWS_BACKUP);
    const shouldTriggerHighAvailabilityAssessment =
        isEmpty(fieldsValues) || fieldsValues.includes(AssessmentCategories.HIGH_AVAILABILITY);

    // filter out the config data which is not required for assessment and listDatabaseInstanceConfigData returns in descending order of creation time
    const configDataMap = databaseInstanceConfigData.reduce((acc, config) => {
        if (!acc[config.config_data_type]) {
            acc[config.config_data_type] = config.config_data;
        }
        return acc;
    }, {} as Record<string, any>);

    const mappedVolumesData = configDataMap[AssessmentCategories.MAPPED_ONTAP_VOLUMES];
    const storageAssessmentData = configDataMap[AssessmentCategories.STORAGE];
    const awsbackupAssessmentData = configDataMap[AssessmentCategories.AWS_BACKUP];
    const crrAssessmentData = configDataMap[AssessmentCategories.CRR];
    const highAvailabilityAssessmentData = configDataMap[AssessmentCategories.HIGH_AVAILABILITY];

    try {
        const [snapshotPolicy, crrData, awsBackup, haChecks] = await Promise.all([
            shouldTriggerSnapshotPolicyAssessment
                ? getSnapshotPolicyDriftData(
                      accountId,
                      credentialsId,
                      region,
                      databaseHostId,
                      databaseInstanceId,
                      mappedVolumesData,
                      storageAssessmentData as unknown as StorageAssessment
                  )
                : Promise.resolve(undefined),
            shouldTriggerCrrAssessment
                ? getCrrDriftData(
                      accountId,
                      credentialsId,
                      region,
                      databaseHostId,
                      databaseInstanceId,
                      crrAssessmentData as unknown as CrrAssessment,
                      Boolean(resourceAssessmentData?.aoagDetails),
                      resourceAssessmentData?.aoagDetails?.databaseRoles,
                      mappedVolumesData
                  )
                : Promise.resolve(undefined),
            shouldTriggerAwsBackupAssessment
                ? getAwsBackupDriftDataForMssql(
                      accountId,
                      credentialsId,
                      region,
                      databaseHostId,
                      databaseInstanceId,
                      awsbackupAssessmentData as unknown as AWSBackupAssessment
                  )
                : Promise.resolve(undefined),
            shouldTriggerHighAvailabilityAssessment
                ? getHighAvailabilityDriftData(
                      accountId,
                      credentialsId,
                      region,
                      databaseHostId,
                      resourceName,
                      databaseInstanceId,
                      resourceAssessmentData,
                      highAvailabilityAssessmentData
                  )
                : Promise.resolve(undefined)
        ]);

        const haChecksArray = Array.isArray(haChecks) ? haChecks : haChecks ? [haChecks] : [];

        return [snapshotPolicy, crrData, awsBackup, ...haChecksArray].filter(
            (item): item is AssessmentItemType | AssessmentErrorItemType => !isEmpty(item)
        );
    } catch (error) {
        logger.error('Error getting resilience drift assessment', JSON.stringify(error));
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, JSON.stringify(error));
    }
}

async function getSnapshotPolicyDriftData(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    mappedVolumesData: MappedOnTapVolumeResponse[],
    storageAssessmentData: StorageAssessment
): Promise<AssessmentItemType | AssessmentErrorItemType> {
    logger.info('Calculate snapshot policy drift data for:', {
        accountId,
        credentialsId,
        region,
        databaseInstanceId,
        databaseHostId
    });
    let errorMessage;
    const [goldenConfig] = MSSQL_GOLDEN_CONFIG.filter(e => e.id === 'snapshot-policy');
    const snapshotPolicyAssessmentData: AssessmentItemType = {
        ...goldenConfig,
        recommended: goldenConfig.recommended ?? '',
        status: AssessmentStatus.NOT_OPTIMIZED,
        objectsInViolation: [],
        totalObjectsInViolation: 0
    };
    try {
        if (isEmpty(storageAssessmentData)) {
            errorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.SNAPSHOT_POLICY);
            return { ...goldenConfig, errorMessage };
        }

        const { volumes, errors } = storageAssessmentData as unknown as StorageAssessment;

        if (errors?.volumes) {
            return { ...goldenConfig, errorMessage: errors.volumes };
        }

        // Check if mapped volumes data is available and filter out only data and log volumes
        let dataLogVolumeUuids: string[] = [];
        if (!isEmpty(mappedVolumesData)) {
            const { dataLogVolumeMap } = filterDataLogVolumes(
                mappedVolumesData as unknown as MappedOnTapVolumeResponse
            );
            dataLogVolumeUuids = Array.from(dataLogVolumeMap.keys());
        }

        snapshotPolicyAssessmentData.totalObjectsAssessed = dataLogVolumeUuids.length;
        volumes.forEach(volume => {
            const volDetails = volume as Record<string, string>;

            const latestSnapshotTimestamp = new Date(
                parseInt(volDetails?.[OptimizeStorageConfigs.MOST_RECENT_SNAPSHOT_TIMESTAMP] ?? 0, 10)
            );
            if (
                (isEmpty(volDetails?.[OptimizeStorageConfigs.SNAPSHOT_POLICY]) ||
                    volDetails?.[OptimizeStorageConfigs.SNAPSHOT_POLICY] === 'none') &&
                latestSnapshotTimestamp <= new Date(moment().subtract(2, 'days').format())
            ) {
                const vol: OntapVolumeType = { ontapVolumeName: volDetails?.name, ontapVolumeUuid: volDetails?.uuid };
                if (isEmpty(dataLogVolumeUuids) || dataLogVolumeUuids.includes(volDetails?.uuid)) {
                    snapshotPolicyAssessmentData?.objectsInViolation?.push(vol);
                }
            }
        });
        if (IS_DEMO_FLOW) {
            snapshotPolicyAssessmentData.totalObjectsAssessed = volumes.length;
            const instanceDetail = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);
            const { configsOptimized } =
                ((instanceDetail as unknown as DatabaseInstance)?.metadata as DatabaseInstanceMetadata) ?? {};
            if (configsOptimized?.STORAGE?.includes(OptimizeStorageConfigs.SNAPSHOT_POLICY)) {
                snapshotPolicyAssessmentData.objectsInViolation = [];
            }
        }

        if (isEmpty(snapshotPolicyAssessmentData.objectsInViolation)) {
            snapshotPolicyAssessmentData.status = AssessmentStatus.OPTIMIZED;
        }
        snapshotPolicyAssessmentData.totalObjectsInViolation =
            snapshotPolicyAssessmentData?.objectsInViolation?.length ?? 0;
    } catch (error) {
        errorMessage = `Error getting snapshot policy drift data: ${error}`;
        return { ...goldenConfig, errorMessage };
    }
    return snapshotPolicyAssessmentData;
}

async function initiateAWSBackupAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    parentJobId: string,
    instanceRecord: WorkloadInstance,
    instanceVolumeMapping: MappedOnTapVolumeResponse[]
) {
    logger.info('MSSQL: Initiating Scheduled FSx for ONTAP backup assessment', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        parentJobId
    });

    const {
        resourceName,
        name: databaseInstanceName,
        id: databaseInstanceId,
        fsxFileSystem: fileSystemId
    } = instanceRecord;
    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;

    const { dataLogVolumeMap } = filterDataLogVolumes(instanceVolumeMapping as unknown as MappedOnTapVolumeResponse);
    const volumeUuids = Array.from(dataLogVolumeMap.keys());
    const volumeNames = volumeUuids.map(uuid => dataLogVolumeMap.get(uuid) || uuid);

    await initiateSharedAwsBackupAssessment(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        fileSystemId,
        resourceWithInstanceName,
        instanceRecord.name,
        parentJobId,
        volumeUuids,
        volumeNames
    );
}

function getAwsBackupDriftDataForMssql(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    awsBackupAssessmentData: AWSBackupAssessment
) {
    logger.info('MSSQL: Get Scheduled FSx for ONTAP backup drift data', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId
    });
    const [config] = MSSQL_GOLDEN_CONFIG.filter(e => e.id === 'backup-configuration');
    return getSharedAwsBackupDriftData(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        awsBackupAssessmentData,
        config
    );
}

async function initiateCrossRegionResiliencyAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    parentJobId: string,
    instanceRecord: WorkloadInstance,
    instanceVolumeMapping: MappedOnTapVolumeResponse[]
) {
    logger.info('Initiating cross region resiliency assessment for:', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        parentJobId
    });

    let errorMessageText = '';
    const { resourceName, name: databaseInstanceName } = instanceRecord;
    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;
    const jobName = 'Cross region replication assessment';
    const jobDescription = `${jobName}`;
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;

    const { id: crrAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: jobName,
        description: jobDescription,
        resourceName: resourceWithInstanceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    try {
        if (isEmpty(instanceRecord.mappedVolumesUuids)) {
            errorMessageText = `Found no FSx for ONTAP volumes for the instance ${instanceRecord.name}.`;
            logger.error(errorMessageText);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessageText);
        }

        const { dataLogVolumeMap } = filterDataLogVolumes(
            instanceVolumeMapping as unknown as MappedOnTapVolumeResponse
        );
        instanceRecord.mappedVolumesUuids = Array.from(dataLogVolumeMap.keys());
        instanceRecord.mappedVolumeNames = Array.from(dataLogVolumeMap.values());

        const command = [CROSS_REGION_REPLICATION_SCRIPT(instanceRecord)];
        const ssmComment = 'Get Cross Region Replication Assessment';

        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: command,
            ec2InstanceId: instanceRecord.activeNodeInstanceid,
            comment: ssmComment,
            accountId,
            shouldReadFromCloudWatchLogs: true
        });

        const { crrDetails, errorMessage } = response
            ? sqlResponseParsing(response)
            : { crrDetails: [], errorMessage: '' };

        const crossRegionPeerIds = await resolveCrossRegionPeerIds(crrDetails, credentialsId, region, accountId);
        updateCrrDetailsWithCrossRegionStatus(crrDetails, crossRegionPeerIds, true);

        await createDatabaseInstanceConfigData([
            {
                account_id: accountId,
                credentials_id: credentialsId,
                region,
                resource_id: databaseHostId,
                database_instance_id: instanceRecord.id,
                creation_time: new Date(Date.now()),
                config_data_type: AssessmentCategories.CRR,
                config_data: { crrDetails, errorMessage }
            }
        ]);
    } catch (error) {
        errorMessageText = `Error while initiating cross region resiliency assessment: ${error}`;
        logger.error(errorMessageText);
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, crrAssessmentJobId, {
            endTime: Date.now(),
            status: jobStatus,
            error: errorMessageText
        });
    }
}

const CRR_RECOMMENDATION_DEFAULT =
    'Workload Factory recommends enabling Cross-Region Replication (CRR) for your FSx for ONTAP filesystems. CRR ensures that your data is replicated to another AWS region, providing enhanced data durability and availability. It is recommended to configure CRR for disaster recovery and compliance requirements.';
const CRR_RECOMMENDATION_AOAG =
    'Workload Factory recommends enabling Cross-Region Replication (CRR) for your FSx for ONTAP filesystems. CRR ensures that your data is replicated to another AWS region, providing enhanced data durability and availability. In AOAG distributed groups, use CRR alongside asynchronous replicas and coordinate SnapMirror with AG seeding for effective multi-region support.';

async function getCrrDriftData(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    crrAssessmentData: CrrAssessment,
    isAoag?: boolean,
    aoagDatabaseRoles?: Array<{ databaseName: string; agName: string; replicaRole: string }>,
    mappedVolumesData?: Record<string, MappedOnTapVolumeResponse>
): Promise<AssessmentItemType | AssessmentErrorItemType> {
    logger.info('Calculate crr drift data for:', {
        accountId,
        region,
        credentialsId,
        databaseInstanceId,
        databaseHostId
    });

    const [goldenConfig] = MSSQL_GOLDEN_CONFIG.filter(e => e.id === 'crr');

    if (isEmpty(crrAssessmentData)) {
        const errorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.CRR);
        return { ...goldenConfig, errorMessage };
    }

    const { crrDetails } = crrAssessmentData;

    try {
        // For AOAG, filter out volumes that only host secondary databases (already replicated via AG)
        let filteredCrrDetails = crrDetails;
        if (isAoag && aoagDatabaseRoles?.length && mappedVolumesData) {
            const secondaryDbNames = new Set(
                aoagDatabaseRoles.filter(db => db.replicaRole === 'SECONDARY').map(db => db.databaseName)
            );

            const { volumeRecords, volumeDBMap } = Object.values(mappedVolumesData).reduce(
                (acc, item) => {
                    if (item?.volumeRecords) {
                        acc.volumeRecords.push(...item.volumeRecords);
                    }
                    if (item?.volumeDBMap) {
                        acc.volumeDBMap.push(...item.volumeDBMap);
                    }
                    return acc;
                },
                { volumeRecords: [] as VolumeRecord[], volumeDBMap: [] as VolumeDBMapEntry[] }
            );

            const volumeNameToDbNames = new Map<string, string[]>();
            for (const dbEntry of volumeDBMap) {
                const volRecord = volumeRecords.find(v => v.uuid === dbEntry.ontapVolumeuuid);
                if (volRecord) {
                    const dbNames = volumeNameToDbNames.get(volRecord.name) || [];
                    dbNames.push(dbEntry.databaseName);
                    volumeNameToDbNames.set(volRecord.name, dbNames);
                }
            }

            filteredCrrDetails = crrDetails.filter(detail => {
                const dbNames = volumeNameToDbNames.get(detail.volumeName) || [];
                if (dbNames.length === 0) {
                    return true;
                }
                return dbNames.some(dbName => !secondaryDbNames.has(dbName));
            });
        }

        const allVolumesOptimized: boolean = filteredCrrDetails.every((detail: CrrDetails) => detail.isCRREnabled);

        return {
            ...goldenConfig,
            status: allVolumesOptimized ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
            recommendation: isAoag ? CRR_RECOMMENDATION_AOAG : CRR_RECOMMENDATION_DEFAULT,
            objectsInViolation: allVolumesOptimized
                ? []
                : filteredCrrDetails.filter(detail => !detail.isCRREnabled).map(detail => detail.volumeName),
            totalObjectsAssessed: filteredCrrDetails.length,
            totalObjectsInViolation: allVolumesOptimized
                ? 0
                : filteredCrrDetails.filter(detail => !detail.isCRREnabled).length,
            recommended: 'crr-enabled'
        };
    } catch (error) {
        logger.error('Error fetching crr drift data:', error);
        return { ...goldenConfig, errorMessage: (error as Error).message };
    }
}

interface LunMapping {
    lunUuid: string;
    lunName: string;
    igroupUuid: string;
    igroupName: string;
    initiatorNames: string[];
}
interface LunIqnDetails {
    hostIqns: string;
    lunMappings: [LunMapping];
}

async function getSharedStorageAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    instanceRecord: WorkloadInstance
) {
    logger.info('Fetching shared storage details', { accountId, credentialsId, region, databaseHostId });

    let errorMessage;
    try {
        const { fsxFileSystem, databaseInstanceObject, mappedLunUuids, id: databaseInstanceId } = instanceRecord;

        const { metadata: resourceMetadata } = (databaseInstanceObject as DatabaseInstance).resource;
        const { node1InstanceId, node2InstanceId } = resourceMetadata as Metadata;

        if (!node1InstanceId || !node2InstanceId) {
            errorMessage = `Unable to fetch primary node and (or) standby node details for ${accountId}, ${credentialsId}, ${databaseHostId}, ${databaseInstanceId}.`;
            throw createError(HttpErrorCodes.VALIDATION_ERROR, errorMessage);
        }

        const command = GET_LUN_IGROUP_INITIATOR_NAMES_AND_HOSTIQN(fsxFileSystem, region, mappedLunUuids || []);
        const [primaryNodeResponse, standbyNodeResponse] = await Promise.all([
            callSsmExecution({
                credentialsId,
                region,
                commands: [command],
                ec2InstanceId: node1InstanceId,
                comment: `Get Host IQN and LUN mappings from node ${node1InstanceId}`,
                accountId,
                shouldReadFromCloudWatchLogs: true
            }),
            callSsmExecution({
                credentialsId,
                region,
                commands: [command],
                ec2InstanceId: node2InstanceId,
                comment: `Get Host IQN and LUN mappings from node ${node2InstanceId}`,
                accountId,
                shouldReadFromCloudWatchLogs: true
            })
        ]);

        let primaryNodeParsedResponse: LunIqnDetails | null = null;
        let standbyNodeParsedResponse: LunIqnDetails | null = null;

        try {
            primaryNodeParsedResponse =
                primaryNodeResponse &&
                typeof primaryNodeResponse === 'string' &&
                primaryNodeResponse.trim().startsWith('{')
                    ? (JSON.parse(primaryNodeResponse) as LunIqnDetails)
                    : null;
        } catch (e) {
            logger.error('Failed to parse primaryNodeResponse JSON:', e);
            primaryNodeParsedResponse = null;
        }

        try {
            standbyNodeParsedResponse =
                standbyNodeResponse &&
                typeof standbyNodeResponse === 'string' &&
                standbyNodeResponse.trim().startsWith('{')
                    ? (JSON.parse(standbyNodeResponse) as LunIqnDetails)
                    : null;
        } catch (e) {
            logger.error('Failed to parse standbyNodeResponse JSON:', e);
            standbyNodeParsedResponse = null;
        }

        if (!primaryNodeParsedResponse || !standbyNodeParsedResponse) {
            throw new Error('Unable to fetch LUN IQN details for shared storage assessment.');
        }

        const primaryHostIqns = primaryNodeParsedResponse?.hostIqns?.split(',').map((iqn: string) => iqn.trim()) || [];
        const standbyHostIqns = standbyNodeParsedResponse?.hostIqns?.split(',').map((iqn: string) => iqn.trim()) || [];
        const allHostIqns = [...new Set([...primaryHostIqns, ...standbyHostIqns])];

        const primaryNodeLunMappings = primaryNodeParsedResponse?.lunMappings || [];

        const lunDetails = primaryNodeLunMappings.map(lunMapping => ({
            ...lunMapping,
            lunName: lunMapping.lunName,
            status: allHostIqns.every(iqn => lunMapping.initiatorNames.includes(iqn))
                ? AssessmentStatus.OPTIMIZED
                : AssessmentStatus.NOT_OPTIMIZED
        }));

        return {
            status:
                lunDetails.length > 0 && lunDetails.every(lun => lun.status === AssessmentStatus.OPTIMIZED)
                    ? AssessmentStatus.OPTIMIZED
                    : AssessmentStatus.NOT_OPTIMIZED,
            lunDetails,
            allHostIqns
        };
    } catch (err) {
        logger.error('Exception running SSM for shared-storage:', err);
        return { status: AssessmentStatus.NOT_OPTIMIZED, lunDetails: null, error: err?.toString() };
    }
}

async function getDriveLetterAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    instanceRecord: WorkloadInstance
) {
    logger.info('Fetch drive letter assessment for', {
        credentialsId,
        region,
        accountId,
        databaseHostId,
        databaseInstanceId: instanceRecord.id
    });

    let errorMessage;
    try {
        const { databaseInstanceObject, id: databaseInstanceId, activeNodeInstanceid } = instanceRecord;
        const { metadata: resourceMetadata } = (databaseInstanceObject as DatabaseInstance).resource;
        const { node1InstanceId, node2InstanceId } = resourceMetadata as Metadata;
        if (!node1InstanceId || !node2InstanceId) {
            errorMessage = `Unable to fetch primary node and (or) standby node details for ${accountId}, ${credentialsId}, ${databaseHostId}, ${databaseInstanceId}.`;
            logger.error(errorMessage);
            throw new Error(errorMessage);
        }
        const isActiveNodePrimary = activeNodeInstanceid === node1InstanceId;
        const [primaryNodeResponse, standbyNodeResponse] = await Promise.all([
            callSsmExecution({
                credentialsId,
                region,
                commands: [FETCH_MSSQL_INSTANCE_VOLUME_LUN_DRIVE_DETAILS(instanceRecord)],
                ec2InstanceId: isActiveNodePrimary ? node1InstanceId : node2InstanceId,
                comment: `Fetch drive letters for mapped volumes on primary node ${
                    isActiveNodePrimary ? node1InstanceId : node2InstanceId
                }`,
                accountId,
                shouldReadFromCloudWatchLogs: true
            }),
            callSsmExecution({
                credentialsId,
                region,
                commands: [DRIVE_LETTER],
                ec2InstanceId: isActiveNodePrimary ? node2InstanceId : node1InstanceId,
                comment: `Fetch available drive letters on standby node ${
                    isActiveNodePrimary ? node2InstanceId : node1InstanceId
                }`,
                accountId,
                shouldReadFromCloudWatchLogs: true
            })
        ]);

        const primaryNodeParsedResponse = sqlResponseParsing(primaryNodeResponse);
        const standbyNodeParsedResponse = sqlResponseParsing(standbyNodeResponse);
        const driveLetterSections: string[] = ['data', 'log', 'tempDb'];

        const primaryNodeDriveLetters = driveLetterSections.flatMap(section =>
            (primaryNodeParsedResponse[section] || []).map((item: any) => item?.driveLetter).filter(Boolean)
        );
        const standbyNodeDriveLetters = Array.isArray(standbyNodeParsedResponse)
            ? standbyNodeParsedResponse.map(letter => (typeof letter === 'string' ? letter.trim().toUpperCase() : ''))
            : [];
        const missingDriveLetters = [
            ...new Set(
                primaryNodeDriveLetters
                    .map(letter => letter.replace(':', '').trim()) // remove colon and extra space
                    .filter(letter => !standbyNodeDriveLetters.map(l => l.trim()).includes(letter))
            )
        ];
        return {
            status: isEmpty(missingDriveLetters) ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
            details: { missingDriveLetters, primaryNodeDriveLetters }
        };
    } catch (err) {
        logger.error('Exception running SSM for drive-letter:', err);
        return { status: AssessmentStatus.NOT_OPTIMIZED, details: null, error: err?.toString() };
    }
}

async function getSqlServiceStartupAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceRecord: WorkloadInstance
) {
    logger.info('Fetch sql service status for instance', {
        accountId,
        credentialsId,
        region,
        databaseInstanceId: instanceRecord.id
    });

    try {
        const {
            databaseInstanceObject,
            fsxFileSystem,
            activeNodeInstanceid,
            name: databaseInstanceName
        } = instanceRecord;
        const { metadata: resourceMetadata } = (databaseInstanceObject as DatabaseInstance).resource;
        const { node1InstanceId, node2InstanceId } = resourceMetadata as Metadata;

        // Standalone AOAG: no FCI pair, check single node for automatic startup
        if (!node2InstanceId) {
            const ec2InstanceId = activeNodeInstanceid || node1InstanceId;
            if (!ec2InstanceId) {
                throw new Error('EC2 instance ID not available for SQL Server service assessment.');
            }

            logger.info(`Standalone AOAG SQL service check on node: ${ec2InstanceId}`);

            const rawResponse = await callSsmExecution({
                credentialsId,
                region,
                commands: [SQL_SERVER_SERVICES(databaseInstanceName)],
                ec2InstanceId,
                comment: `Fetch sql service status for instance ${databaseInstanceName} on node ${ec2InstanceId}`,
                accountId
            });

            const [parsedResponse] = parseMultipleCommandResponse(rawResponse);
            const services = (
                Array.isArray(parsedResponse) ? parsedResponse : parsedResponse ? [parsedResponse] : []
            ).map(svc => ({ ...svc, instanceId: ec2InstanceId }));

            const nodesInViolation = services.some((svc: any) => svc.StartType?.toLowerCase() !== 'automatic')
                ? [ec2InstanceId]
                : [];

            return {
                status: isEmpty(nodesInViolation) ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
                nodesInViolation,
                totalNodes: 1,
                details: services
            };
        }

        // FCI path: both nodes must exist
        if (!node1InstanceId) {
            throw new Error('Both node1InstanceId and node2InstanceId must be available for FCI instances.');
        }

        // Determine preferred and non-preferred nodes
        const { preferredNodeId, standbyNodeId } = await getMZFsxnNodePreference(
            accountId,
            credentialsId,
            region,
            node1InstanceId,
            node2InstanceId,
            fsxFileSystem
        );

        if (!preferredNodeId || !standbyNodeId) {
            throw new Error('Preferred or non-preferred node ID is not available.');
        }

        if (!activeNodeInstanceid) {
            throw new Error('Unable to determine active node instance ID for SQL Server service assessment.');
        }

        logger.info(
            `Preferred node: ${preferredNodeId}, Non-preferred node: ${standbyNodeId}, Active node: ${activeNodeInstanceid}`
        );

        // Run SSM command on both nodes in parallel
        const [preferredNodeRaw, nonPreferredNodeRaw] = await Promise.all([
            callSsmExecution({
                credentialsId,
                region,
                commands: [SQL_SERVER_SERVICES(databaseInstanceName)],
                ec2InstanceId: preferredNodeId,
                comment: `Fetch sql service status for instance ${databaseInstanceName} on preferred node ${preferredNodeId}`,
                accountId
            }),
            callSsmExecution({
                credentialsId,
                region,
                commands: [SQL_SERVER_SERVICES(databaseInstanceName)],
                ec2InstanceId: standbyNodeId,
                comment: `Fetch sql service status for instance ${databaseInstanceName} on non-preferred node ${standbyNodeId}`,
                accountId
            })
        ]);

        // Parse SSM outputs
        const [parsedPreferred] = parseMultipleCommandResponse(preferredNodeRaw);
        const [parsedNonPreferred] = parseMultipleCommandResponse(nonPreferredNodeRaw);

        const servicesPreferred = (
            Array.isArray(parsedPreferred) ? parsedPreferred : parsedPreferred ? [parsedPreferred] : []
        ).map(svc => ({ ...svc, instanceId: preferredNodeId }));

        const servicesNonPreferred = (
            Array.isArray(parsedNonPreferred) ? parsedNonPreferred : parsedNonPreferred ? [parsedNonPreferred] : []
        ).map(svc => ({ ...svc, instanceId: standbyNodeId }));

        const nodesInViolation = [
            ...(servicesPreferred.some((svc: any) => svc.StartType?.toLowerCase() !== 'manual')
                ? [preferredNodeId]
                : []),
            ...(servicesNonPreferred.some((svc: any) => svc.StartType?.toLowerCase() !== 'manual')
                ? [standbyNodeId]
                : []),
            ...(activeNodeInstanceid !== preferredNodeId ? [activeNodeInstanceid] : [])
        ].filter(Boolean);

        return {
            status: isEmpty(nodesInViolation) ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
            preferredNodeId,
            standbyNodeId,
            nodesInViolation: [...new Set(nodesInViolation)],
            totalNodes: 2,
            details: [...servicesPreferred, ...servicesNonPreferred]
        };
    } catch (err) {
        logger.error('Error high availability SQL server service assessment:', err);
        return { error: err?.toString() };
    }
}

function deriveAoagDetails(parsedAoagData: Record<string, unknown>) {
    if (!parsedAoagData || parsedAoagData.error) {
        logger.warn('Failed to fetch AOAG instance role details', { error: String(parsedAoagData?.error ?? '') });
        return undefined;
    }

    const baseDeploymentType = parsedAoagData.isClustered === 1 ? 'FCI' : 'Standalone';

    let replicaRoles: Array<{ agName: string; replicaRole: string }> = [];
    try {
        const rawRoles =
            typeof parsedAoagData.replicaRoles === 'string'
                ? JSON.parse(parsedAoagData.replicaRoles)
                : parsedAoagData.replicaRoles;
        if (Array.isArray(rawRoles)) {
            replicaRoles = rawRoles as Array<{ agName: string; replicaRole: string }>;
        }
    } catch {
        logger.warn('Failed to parse AOAG replica roles JSON');
    }

    let databaseRoles: Array<{ databaseName: string; agName: string; replicaRole: string }> = [];
    try {
        const rawDbRoles =
            typeof parsedAoagData.databaseRoles === 'string'
                ? JSON.parse(parsedAoagData.databaseRoles)
                : parsedAoagData.databaseRoles;
        if (Array.isArray(rawDbRoles)) {
            databaseRoles = rawDbRoles as Array<{ databaseName: string; agName: string; replicaRole: string }>;
        }
    } catch {
        logger.warn('Failed to parse AOAG database roles JSON');
    }

    const uniqueRoles = [...new Set(replicaRoles.map(r => r.replicaRole))];
    const [firstRole] = uniqueRoles;
    let replicaRole: string;
    if (!firstRole) {
        replicaRole = 'UNKNOWN';
    } else if (uniqueRoles.length === 1) {
        replicaRole = firstRole;
    } else {
        replicaRole = 'MIXED';
    }

    return { replicaRole, baseDeploymentType, replicaRoles, databaseRoles };
}

async function initiateHostLevelHighAvailabilityAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    instanceRecord: WorkloadInstance,
    parentJobId: string,
    metadata: Metadata,
    deploymentType?: string
) {
    logger.info('Fetch cluster quorum, heartbeat settings for instance', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        parentJobId
    });

    const { isHeartBeatOptimized, isClusterQuorumOptimized } = metadata;
    const { resourceName, name: databaseInstanceName, activeNodeInstanceid, sqlAuthEnabled } = instanceRecord;
    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;
    const isAoag = deploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT;

    const jobName = `Microsoft SQL server high availability assessment for heartbeat and quorum settings for ${resourceName}`;
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage;

    let response;
    const { id: highAvailabilityAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: jobName,
        description: jobName,
        resourceName: resourceWithInstanceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    try {
        const commands = isAoag
            ? [CLUSTER_QUORUM_TYPE, HEARTBEAT_SETTINGS, AOAG_INSTANCE_ROLE(databaseInstanceName, sqlAuthEnabled)]
            : [CLUSTER_QUORUM_TYPE, HEARTBEAT_SETTINGS];

        const rawResponses = await callSsmExecution({
            credentialsId,
            region,
            commands,
            ec2InstanceId: activeNodeInstanceid,
            comment: `Fetch cluster quorum, heartbeat settings${
                isAoag ? ', AOAG role' : ''
            } on node ${activeNodeInstanceid}`,
            accountId,
            shouldReadFromCloudWatchLogs: true
        });

        const rawResponsesParsed = parseMultipleCommandResponse(rawResponses);
        const [parsedQuorumData, parsedHeartSettingsData, parsedAoagData] = rawResponsesParsed;

        const aoagDetails = isAoag ? deriveAoagDetails(parsedAoagData as Record<string, unknown>) : undefined;

        let clusterQuorumResult: {
            status: AssessmentStatus;
            details: Record<string, unknown> | null;
            error?: string;
        };

        if (IS_DEMO_FLOW && isClusterQuorumOptimized) {
            clusterQuorumResult = {
                status: AssessmentStatus.OPTIMIZED,
                details: null
            };
        } else if (!parsedQuorumData || typeof parsedQuorumData !== 'object') {
            clusterQuorumResult = {
                status: AssessmentStatus.NOT_OPTIMIZED,
                details: null,
                error: 'Unable to parse quorum data from ssm response'
            };
        } else {
            clusterQuorumResult = {
                status: parsedQuorumData.IsPhysicalDiskAndMajority
                    ? AssessmentStatus.OPTIMIZED
                    : AssessmentStatus.NOT_OPTIMIZED,
                details: {
                    isMajority: parsedQuorumData.IsMajority,
                    quorumType: parsedQuorumData.QuorumType,
                    isPhysicalDisk: parsedQuorumData.IsPhysicalDisk,
                    quorumResourceName: parsedQuorumData.QuorumResourceName,
                    isPhysicalDiskAndMajority: parsedQuorumData.IsPhysicalDiskAndMajority
                }
            };
        }

        const recommendedHeartbeatSettings = MSSQL_HEARTBEAT_SETTINGS;
        let heartbeatResult: {
            status: AssessmentStatus;
            details: Record<string, { current: number; recommended: number; status: AssessmentStatus }> | null;
            error?: string;
        };

        if (IS_DEMO_FLOW && isHeartBeatOptimized) {
            heartbeatResult = {
                status: AssessmentStatus.OPTIMIZED,
                details: null
            };
        } else if (
            !parsedHeartSettingsData ||
            typeof parsedHeartSettingsData !== 'object' ||
            Array.isArray(parsedHeartSettingsData)
        ) {
            heartbeatResult = {
                status: AssessmentStatus.NOT_OPTIMIZED,
                details: null,
                error: 'Heartbeat settings are missing or invalid'
            };
        } else {
            const heartbeatDetails = Object.entries(recommendedHeartbeatSettings).reduce(
                (acc, [key, recommendedValue]) => {
                    const currentValue = parsedHeartSettingsData[key];
                    acc[key] = {
                        current: currentValue,
                        recommended: recommendedValue,
                        status:
                            currentValue === recommendedValue
                                ? AssessmentStatus.OPTIMIZED
                                : AssessmentStatus.NOT_OPTIMIZED
                    };
                    return acc;
                },
                {} as Record<string, { current: number; recommended: number; status: AssessmentStatus }>
            );

            const allOptimized = Object.values(heartbeatDetails).every(
                detail => detail.status === AssessmentStatus.OPTIMIZED
            );

            heartbeatResult = {
                status: allOptimized ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
                details: heartbeatDetails
            };
        }

        response = {
            clusterQuorum: clusterQuorumResult,
            heartbeat: heartbeatResult,
            ...(aoagDetails && { aoagDetails })
        };
    } catch (err: any) {
        errorMessage = `Error while running heartbeat settings and cluster quorum type assessment. Error:${err.message}`;
        logger.error(errorMessage);
        jobStatus = JOBSTATUS.FAILED;
        response = {
            clusterQuorum: { status: AssessmentStatus.NOT_OPTIMIZED, details: null, error: err?.toString() },
            heartbeat: { status: AssessmentStatus.NOT_OPTIMIZED, details: null, error: err?.toString() }
        };
    } finally {
        await updateJobDetails(accountId, highAvailabilityAssessmentJobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: errorMessage
        });
    }
    return response;
}

async function initiateInstanceLevelHighAvailabilityAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    instanceRecord: WorkloadInstance,
    parentJobId: string
) {
    logger.info('Initiating High availability resiliency assessment for:', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        parentJobId
    });

    const { resourceName, name: databaseInstanceName, id: databaseInstanceId } = instanceRecord;

    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;
    const jobName = 'Shared storage, drive mappings and SQL service configuration high availability assessment';
    const jobDescription = jobName;
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage = '';

    const { id: highAvailabilityAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: jobName,
        description: jobDescription,
        resourceName: resourceWithInstanceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    let sharedStorageResult: any;
    let driveLetterResult: any;
    let sqlServerServicesResult: any;

    try {
        const [sharedStorage, driveLetter, sqlService] = await Promise.all([
            getSharedStorageAssessment(accountId, credentialsId, region, databaseHostId, instanceRecord),
            getDriveLetterAssessment(accountId, credentialsId, region, databaseHostId, instanceRecord),
            getSqlServiceStartupAssessment(accountId, credentialsId, region, instanceRecord)
        ]);

        sharedStorageResult = sharedStorage;
        driveLetterResult = driveLetter;
        sqlServerServicesResult = sqlService;
    } catch (err) {
        logger.error('Error running high availability assessment:', err);
        errorMessage = err?.toString?.() || String(err);
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await createDatabaseInstanceConfigData([
            {
                account_id: accountId,
                credentials_id: credentialsId,
                region,
                resource_id: databaseHostId,
                database_instance_id: databaseInstanceId,
                creation_time: new Date(Date.now()),
                config_data_type: AssessmentCategories.HIGH_AVAILABILITY,
                config_data: {
                    sharedStorage: sharedStorageResult,
                    driveLetter: driveLetterResult,
                    sqlServerServices: sqlServerServicesResult
                }
            }
        ]);
    }
    await updateJobDetails(accountId, highAvailabilityAssessmentJobId, {
        endTime: Date.now(),
        status: jobStatus,
        error: errorMessage
    });
}

async function getHighAvailabilityDriftData(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    resourceName: string,
    databaseInstanceId: string,
    resourceAssessmentData: ResourceAssessmentData,
    highAvailabilityAssessmentData: HighAvailabilityAssessment
): Promise<(AssessmentItemType | AssessmentErrorItemType)[]> {
    logger.info('Initiating High availability resiliency assessment for:', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        resourceName,
        databaseInstanceId
    });

    if (isEmpty(highAvailabilityAssessmentData)) {
        const errorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.HIGH_AVAILABILITY);
        logger.error('No high availability assessment data found.');
        return MSSQL_GOLDEN_CONFIG.filter(e => e.type === 'resiliency' && e.subType === 'highAvailability').map(
            config => ({ ...config, errorMessage })
        );
    }

    try {
        const { highAvailability: { clusterQuorum, heartbeat } = {} } = resourceAssessmentData;

        const { sharedStorage, driveLetter, sqlServerServices } = highAvailabilityAssessmentData;

        logger.debug(
            `Assessment data found for: sharedStorage=${!!sharedStorage}, driveLetter=${!!driveLetter}, clusterQuorum=${!!clusterQuorum}, heartbeat=${!!heartbeat}, sqlServerServices=${!!sqlServerServices}`
        );

        if (IS_DEMO_FLOW) {
            try {
                const instanceDetail = await getInstanceInfo(
                    accountId,
                    credentialsId,
                    databaseHostId,
                    databaseInstanceId
                );
                const { configsOptimized } =
                    ((instanceDetail as unknown as DatabaseInstance)?.metadata as DatabaseInstanceMetadata) ?? {};
                if (configsOptimized?.HIGH_AVAILABILITY?.includes('shared-storage') && sharedStorage) {
                    (sharedStorage as HighAvailabilitySharedStorage).status = AssessmentStatus.OPTIMIZED;
                }
                if (configsOptimized?.HIGH_AVAILABILITY?.includes('sql-server-services') && sqlServerServices) {
                    sqlServerServices.status = AssessmentStatus.OPTIMIZED;
                }
            } catch (error) {
                // Instance doesn't exist for offline assessments - this is expected
                logger.debug('Instance not found for offline assessment, skipping configsOptimized check', {
                    accountId,
                    databaseHostId,
                    databaseInstanceId
                });
            }
        }
        const [sharedStorageConfig] = MSSQL_GOLDEN_CONFIG.filter(e => e.id === 'shared-storage');
        const [driveLetterConfig] = MSSQL_GOLDEN_CONFIG.filter(e => e.id === 'drive-letter');
        const [clusterQuorumConfig] = MSSQL_GOLDEN_CONFIG.filter(e => e.id === 'cluster-quorum');
        const [heartbeatConfig] = MSSQL_GOLDEN_CONFIG.filter(e => e.id === 'heartbeat-settings');
        const [sqlServerServiceConfig] = MSSQL_GOLDEN_CONFIG.filter(e => e.id === 'sql-server-service');

        const haChecks: (AssessmentItemType | AssessmentErrorItemType)[] = [
            isEmpty(sharedStorage)
                ? {
                      ...sharedStorageConfig,
                      errorMessage: GENERIC_ASSESSMENT_ERROR_MESSAGE('shared-storage')
                  }
                : sharedStorage.error
                ? { ...sharedStorageConfig, errorMessage: sharedStorage.error }
                : {
                      ...sharedStorageConfig,
                      name: 'shared-storage',
                      recommended: sharedStorageConfig.recommended ?? '',
                      status: sharedStorage.status as AssessmentStatus,
                      objectsInViolation:
                          sharedStorage.lunDetails
                              ?.filter(lun => lun.status !== AssessmentStatus.OPTIMIZED)
                              .map(lun => lun.lunName) || [],
                      totalObjectsInViolation:
                          sharedStorage.lunDetails?.filter(lun => lun.status !== AssessmentStatus.OPTIMIZED).length ||
                          0,
                      totalObjectsAssessed: sharedStorage.lunDetails?.length || 0
                  },
            isEmpty(driveLetter)
                ? { ...driveLetterConfig, errorMessage: GENERIC_ASSESSMENT_ERROR_MESSAGE('drive-letter') }
                : driveLetter.error
                ? { ...driveLetterConfig, errorMessage: driveLetter.error }
                : {
                      ...driveLetterConfig,
                      name: 'drive-letter',
                      recommended: driveLetterConfig.recommended ?? '',
                      status: driveLetter.status as AssessmentStatus,
                      objectsInViolation: [...new Set(driveLetter.details.missingDriveLetters || [])],
                      totalObjectsInViolation: [...new Set(driveLetter.details.missingDriveLetters || [])].length || 0,
                      totalObjectsAssessed: [...new Set(driveLetter.details.primaryNodeDriveLetters || [])].length || 0
                  },
            isEmpty(clusterQuorum)
                ? { ...clusterQuorumConfig, errorMessage: GENERIC_ASSESSMENT_ERROR_MESSAGE('cluster-quorum') }
                : clusterQuorum.error
                ? { ...clusterQuorumConfig, errorMessage: clusterQuorum.error }
                : {
                      ...clusterQuorumConfig,
                      name: 'cluster-quorum',
                      recommended: clusterQuorumConfig.recommended ?? '',
                      status: clusterQuorum.status as AssessmentStatus,
                      objectsInViolation: clusterQuorum.status === AssessmentStatus.OPTIMIZED ? [] : [resourceName],
                      violationDetails:
                          clusterQuorum.status !== AssessmentStatus.OPTIMIZED
                              ? [
                                    {
                                        objectName: 'isPhysicalDiskAndMajority',
                                        value: 'false',
                                        objectType: 'configuration'
                                    }
                                ]
                              : [],
                      totalObjectsAssessed: 1,
                      totalObjectsInViolation: clusterQuorum.status !== AssessmentStatus.OPTIMIZED ? 1 : 0
                  },
            isEmpty(heartbeat)
                ? { ...heartbeatConfig, errorMessage: GENERIC_ASSESSMENT_ERROR_MESSAGE('heartbeat') }
                : heartbeat.error
                ? { ...heartbeatConfig, errorMessage: heartbeat.error }
                : {
                      ...heartbeatConfig,
                      name: 'heartbeat-settings',
                      recommended: heartbeatConfig.recommended ?? '',
                      status: heartbeat.status as AssessmentStatus,
                      objectsInViolation: heartbeat.status === AssessmentStatus.OPTIMIZED ? [] : [resourceName],
                      violationDetails:
                          heartbeat.status !== AssessmentStatus.OPTIMIZED
                              ? Object.entries(heartbeat.details || {})
                                    .filter(([, value]) => value.status !== 'optimized')
                                    .map(([key, value]) => ({
                                        objectName: key,
                                        value: value.current.toString(),
                                        objectType: 'configuration'
                                    }))
                              : [],
                      totalObjectsAssessed: 1,
                      totalObjectsInViolation: heartbeat.status === AssessmentStatus.OPTIMIZED ? 0 : 1
                  },
            isEmpty(sqlServerServices) || !sqlServerServices.status
                ? { ...sqlServerServiceConfig, errorMessage: GENERIC_ASSESSMENT_ERROR_MESSAGE('sql-server-service') }
                : sqlServerServices.error
                ? { ...sqlServerServiceConfig, errorMessage: sqlServerServices.error }
                : {
                      ...sqlServerServiceConfig,
                      name: 'sqlServer-service',
                      recommended: sqlServerServiceConfig.recommended ?? '',
                      status: sqlServerServices.status as AssessmentStatus,
                      objectsInViolation:
                          sqlServerServices.status !== AssessmentStatus.OPTIMIZED
                              ? sqlServerServices.nodesInViolation
                              : [],
                      totalObjectsAssessed: sqlServerServices.totalNodes || 2,
                      totalObjectsInViolation: sqlServerServices.nodesInViolation?.length
                  }
        ];

        return haChecks;
    } catch (error) {
        logger.error('Error calculating high availability drift data:', error);
        const errorMessage = (error as Error).message;
        return MSSQL_GOLDEN_CONFIG.filter(e => e.type === 'resiliency' && e.subType === 'highAvailability').map(
            config => ({ ...config, errorMessage })
        );
    }
}

export {
    getResilienceDriftAssessment,
    initiateCrossRegionResiliencyAssessment,
    collectSnapshotCopyData,
    collectVolumeSnapshotCopiesData,
    getVolumesWithoutSnapshotPolicy,
    initiateAWSBackupAssessment,
    initiateInstanceLevelHighAvailabilityAssessment,
    getHighAvailabilityDriftData,
    getSnapshotPolicyDriftData,
    initiateHostLevelHighAvailabilityAssessment,
    getSqlServiceStartupAssessment
};
