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
import { ORACLE_CRR_ASSESSMENT_SCRIPT } from './ssm-scripts/resiliency-assessment-scripts';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from '../../workloads/oracle/consts';
import ORACLE_GOLDEN_CONFIG from './golden-config';
import type { AssessmentItemType, AssessmentErrorItemType } from '../../../routes/types/continuous-optimization.types';

const logger = getLogger();

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

        const command = [ORACLE_CRR_ASSESSMENT_SCRIPT(instanceRecord)];
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

export { initiateCrossRegionResiliencyAssessment, getCrrDriftData };
