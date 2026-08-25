import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../../../utils/logger';
import { createDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentCategoriesOracle,
    AssessmentStatus
} from '../../../utils/continous-optimization-consts';
import { GENERIC_ASSESSMENT_ERROR_MESSAGE, HttpErrorCodes } from '../../../utils/consts';
import { sqlResponseParsing } from '../../../utils/utils';
import { CrrAssessment, CrrDetails, WorkloadInstance } from '../../../utils/common-types';
import { getFsxnVolIdsFromOntapVolIds } from '../../aws/fsx-operations';
import { resolveCrossRegionPeerIds, updateCrrDetailsWithCrossRegionStatus } from '../crr-assessment-utils';
import { callSsmExecution } from '../../aws/ssm-operations';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { ORACLE_CRR_ASSESSMENT_SCRIPT, type DirectOntapCrrData } from './ssm-scripts/resiliency-assessment-scripts';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from '../../workloads/oracle/consts';
import {
    collectAllOntapRecords,
    collectOntapRecordsBatched,
    buildOntapProxyBase
} from '../../../lib/ontap/ontap-gateway';
import ORACLE_GOLDEN_CONFIG from './golden-config';
import type { AssessmentItemType, AssessmentErrorItemType } from '../../../routes/types/continuous-optimization.types';

const logger = getLogger();

const CLUSTER_PEER_FIELDS = 'name,status.state,remote.ip_addresses';
const SVM_PEER_FIELDS = 'name,state,applications,peer.cluster.name,peer.svm.uuid,peer.svm.name,svm.name,svm.uuid';
const SNAPMIRROR_RELATIONSHIP_FIELDS =
    'policy.name,policy.type,state,source.path,source.svm.name,source.svm.uuid,destination.path,destination.svm.name,destination.svm.uuid';

interface OntapClusterPeerRecord {
    name?: string;
    status?: { state?: string };
}

interface OntapSvmPeerRecord {
    name?: string;
    state?: string;
    applications?: string[];
    peer?: { cluster?: { name?: string }; svm?: { uuid?: string; name?: string } };
    svm?: { name?: string; uuid?: string };
}

interface OntapSnapmirrorRelationshipRecord {
    policy?: { name?: string; type?: string };
    state?: string;
    source?: { path?: string; svm?: { name?: string; uuid?: string } };
    destination?: { path?: string; svm?: { name?: string; uuid?: string } };
}

function toClusterPeerRow(peer: OntapClusterPeerRecord) {
    return { peerClusterName: peer.name, availability: peer.status?.state };
}

function toSvmPeerRow(peer: OntapSvmPeerRecord) {
    return {
        name: peer.name,
        state: peer.state,
        applications: peer.applications,
        peerClusterName: peer.peer?.cluster?.name,
        peerSvmUuid: peer.peer?.svm?.uuid,
        peerSvmName: peer.peer?.svm?.name,
        svmname: peer.svm?.name,
        svmuuid: peer.svm?.uuid
    };
}

function toSnapmirrorRelationshipRow(relationship: OntapSnapmirrorRelationshipRecord) {
    return {
        policyName: relationship.policy?.name,
        policyType: relationship.policy?.type,
        state: relationship.state,
        sourceVserverName: relationship.source?.svm?.name,
        sourceVserverUuid: relationship.source?.svm?.uuid,
        sourcePath: relationship.source?.path,
        destinationVserverName: relationship.destination?.svm?.name,
        destinationVserverUuid: relationship.destination?.svm?.uuid,
        destinationPath: relationship.destination?.path
    };
}

async function fetchDirectOntapCrrData(
    accountId: string,
    credentialsId: string,
    instanceRecord: WorkloadInstance
): Promise<DirectOntapCrrData> {
    const base = await buildOntapProxyBase(
        accountId,
        credentialsId,
        instanceRecord.fsxFileSystem,
        instanceRecord.region
    );
    const svmNames = [
        ...new Set(
            (Array.isArray(instanceRecord.svmOntapName)
                ? instanceRecord.svmOntapName
                : [instanceRecord.svmOntapName]
            ).filter((name): name is string => !!name)
        )
    ];

    logger.info('Fetching direct ONTAP CRR assessment data via proxy-forwarder', {
        accountId,
        targetId: base.targetId,
        svmNames
    });

    const [clusterPeersRes, svmPeersRes, snapmirrorRes] = await Promise.allSettled([
        collectAllOntapRecords<OntapClusterPeerRecord>(base, 'api/cluster/peers', { fields: CLUSTER_PEER_FIELDS }),
        isEmpty(svmNames)
            ? Promise.reject(new Error('Unable to fetch ONTAP svm peers as the mapped SVM name is missing.'))
            : collectOntapRecordsBatched<OntapSvmPeerRecord>(base, 'api/svm/peers', 'svm.name', svmNames, {
                  fields: SVM_PEER_FIELDS
              }),
        isEmpty(svmNames)
            ? Promise.reject(
                  new Error('Unable to fetch ONTAP snapmirror relationships as the mapped SVM name is missing.')
              )
            : collectOntapRecordsBatched<OntapSnapmirrorRelationshipRecord>(
                  base,
                  'api/snapmirror/relationships',
                  'source.svm.name',
                  svmNames,
                  { list_destinations_only: true, fields: SNAPMIRROR_RELATIONSHIP_FIELDS }
              )
    ]);

    let clusterPeerDetails: ReturnType<typeof toClusterPeerRow>[] = [];
    if (clusterPeersRes.status === 'fulfilled') {
        clusterPeerDetails = clusterPeersRes.value.map(toClusterPeerRow);
    } else {
        logger.warn('Failed to fetch ONTAP cluster peers for CRR assessment', {
            targetId: base.targetId,
            err: clusterPeersRes.reason
        });
    }

    let vserverPeerDetails: ReturnType<typeof toSvmPeerRow>[] = [];
    if (svmPeersRes.status === 'fulfilled') {
        vserverPeerDetails = svmPeersRes.value.map(toSvmPeerRow);
    } else {
        logger.warn('Failed to fetch ONTAP svm peers for CRR assessment', {
            targetId: base.targetId,
            err: svmPeersRes.reason
        });
    }

    let snapMirrorDestinationDetails: ReturnType<typeof toSnapmirrorRelationshipRow>[] = [];
    if (snapmirrorRes.status === 'fulfilled') {
        snapMirrorDestinationDetails = snapmirrorRes.value.map(toSnapmirrorRelationshipRow);
    } else {
        logger.warn('Failed to fetch ONTAP snapmirror relationships for CRR assessment', {
            targetId: base.targetId,
            err: snapmirrorRes.reason
        });
    }

    return {
        clusterPeerDetailsJson: JSON.stringify(clusterPeerDetails),
        vserverPeerDetailsJson: JSON.stringify(vserverPeerDetails),
        snapMirrorDestinationDetailsJson: JSON.stringify(snapMirrorDestinationDetails)
    };
}

async function initiateCrossRegionResiliencyAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    parentJobId: string,
    instanceRecord: WorkloadInstance
) {
    logger.info('Initiating Oracle cross region resiliency assessment for:', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        parentJobId
    });

    let errorMessageText = '';
    const { resourceName, name: databaseInstanceName } = instanceRecord;
    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;

    const { id: crrAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: 'Cross region replication assessment',
        description: 'Cross region replication assessment for Oracle database',
        resourceName: resourceWithInstanceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    try {
        if (isEmpty(instanceRecord.mappedVolumesUuids)) {
            errorMessageText = `Found no FSx for ONTAP volumes for the Oracle instance ${instanceRecord.name}.`;
            logger.error(errorMessageText);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessageText);
        }

        const ontapCrrData = await fetchDirectOntapCrrData(accountId, credentialsId, instanceRecord);
        const command = [ORACLE_CRR_ASSESSMENT_SCRIPT(instanceRecord, ontapCrrData)];
        const ssmComment = 'Get Cross Region Replication Assessment for Oracle';

        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: command,
            ec2InstanceId: instanceRecord.activeNodeInstanceid,
            comment: ssmComment,
            accountId,
            shouldReadFromCloudWatchLogs: true,
            documentName: SSM_RUN_SHELL_SCRIPT_DOC,
            documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        });

        let crrDetails: CrrDetails[] = [];
        let errorMessage = '';

        if (response) {
            const parsedResponse = sqlResponseParsing(response);
            crrDetails = parsedResponse?.crrDetails || [];
            errorMessage = parsedResponse?.errorMessage || '';
        }

        const sourceFsxIds = new Set(instanceRecord.fsxFileSystem.split(',').map(id => id.trim()));
        const crossRegionPeerIds = await resolveCrossRegionPeerIds(
            crrDetails,
            credentialsId,
            region,
            accountId,
            sourceFsxIds
        );
        updateCrrDetailsWithCrossRegionStatus(crrDetails, crossRegionPeerIds);

        const volumeNameToUuid = new Map<string, string>();
        const { mappedVolumeNames = [], mappedVolumesUuids = [] } = instanceRecord;
        mappedVolumeNames.forEach((name, idx) => {
            if (name && mappedVolumesUuids[idx]) {
                volumeNameToUuid.set(name, mappedVolumesUuids[idx]);
            }
        });

        let ontapUuidToFsxVolId = new Map<string, string>();
        if (!isEmpty(mappedVolumesUuids)) {
            try {
                const fsxId = instanceRecord.fsxFileSystem.split(',')[0];
                const { fsxVolumeIdUuidMap } = await getFsxnVolIdsFromOntapVolIds(
                    credentialsId,
                    region,
                    fsxId,
                    mappedVolumesUuids,
                    accountId
                );
                ontapUuidToFsxVolId = fsxVolumeIdUuidMap;
            } catch (error) {
                logger.error('Error resolving FSx volume IDs for CRR details:', error);
            }
        }

        crrDetails.forEach(crrDetail => {
            crrDetail.volumeUuid = volumeNameToUuid.get(crrDetail.volumeName);
            crrDetail.fsxVolumeId = crrDetail.volumeUuid ? ontapUuidToFsxVolId.get(crrDetail.volumeUuid) : undefined;
        });

        await createDatabaseInstanceConfigData([
            {
                account_id: accountId,
                credentials_id: credentialsId,
                region,
                resource_id: databaseHostId,
                database_instance_id: instanceRecord.id,
                creation_time: new Date(Date.now()),
                config_data_type: AssessmentCategoriesOracle.CRR,
                config_data: { crrDetails, errorMessage }
            }
        ]);
    } catch (error) {
        errorMessageText = `Error while initiating Oracle cross region resiliency assessment: ${error}`;
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

function getCrrDriftData(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    crrAssessmentData: CrrAssessment,
    controlFileVolumeIds: string[] = [],
    controlFileOnlyVolumeIds: string[] = []
): AssessmentItemType | AssessmentErrorItemType {
    logger.info('Calculate Oracle CRR drift data for:', {
        accountId,
        region,
        credentialsId,
        databaseInstanceId,
        databaseHostId
    });

    const [goldenConfig] = ORACLE_GOLDEN_CONFIG.filter(e => e.id === 'crr');

    if (isEmpty(crrAssessmentData)) {
        const errorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategoriesOracle.CRR);
        return { ...goldenConfig, errorMessage };
    }

    const { crrDetails } = crrAssessmentData;

    try {
        const controlFileIdSet = new Set(controlFileVolumeIds);
        const controlFileOnlyIdSet = new Set(controlFileOnlyVolumeIds);

        const hasReplicatedControlFile = crrDetails.some(
            detail => detail.isCRREnabled && detail.volumeUuid && controlFileIdSet.has(detail.volumeUuid)
        );

        const isVolumeInViolation = (detail: CrrDetails): boolean => {
            if (detail.isCRREnabled) {
                return false;
            }
            if (hasReplicatedControlFile && detail.volumeUuid && controlFileOnlyIdSet.has(detail.volumeUuid)) {
                return false;
            }
            return true;
        };

        const volumesInViolation = crrDetails.filter(isVolumeInViolation);
        const allVolumesOptimized = volumesInViolation.length === 0;

        const crrRecommended = 'crr-enabled';
        return {
            ...goldenConfig,
            status: allVolumesOptimized ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
            recommended: crrRecommended,
            objectsInViolation: volumesInViolation.map(detail => ({
                ontapVolumeName: detail.volumeName,
                ontapVolumeUuid: detail.volumeUuid,
                fsxVolumeId: detail.fsxVolumeId
            })),
            totalObjectsAssessed: crrDetails.length,
            totalObjectsInViolation: volumesInViolation.length,
            violationDetails: volumesInViolation.map(detail => ({
                objectName: detail.volumeName ?? '',
                objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                value: 'Disabled',
                recommended: 'Enabled'
            }))
        };
    } catch (error) {
        logger.error('Error fetching Oracle CRR drift data:', error);
        return { ...goldenConfig, errorMessage: (error as Error).message };
    }
}

export { initiateCrossRegionResiliencyAssessment, getCrrDriftData, fetchDirectOntapCrrData };
