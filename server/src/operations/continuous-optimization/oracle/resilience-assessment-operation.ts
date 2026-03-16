import createError from 'http-errors';
import { compact, isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../../../utils/logger';
import { createDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import {
    AssessmentCategoriesOracle,
    AssessmentStatus,
    ASSESSMENT_RESOURCE_TYPE,
    AwsWellArchitecturedPillars,
    SEVERITY
} from '../../../utils/continous-optimization-consts';
import { GENERIC_ASSESSMENT_ERROR_MESSAGE, HttpErrorCodes } from '../../../utils/consts';
import { sqlResponseParsing } from '../../../utils/utils';
import { CrrAssessment, CrrDetails, WorkloadInstance } from '../../../utils/common-types';
import { describeFSx } from '../../../lib/aws/fsx';
import { callSsmExecution } from '../../aws/ssm-operations';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { ORACLE_CRR_ASSESSMENT_SCRIPT } from './ssm-scripts/resiliency-assessment-scripts';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from '../../workloads/oracle/consts';
import storageGoldenConfigData from './golden-config';
import { OracleGenericParameterDriftResponseType } from '../../../routes/types/oracle-continuous-optimization.types';

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

        // Determine cross-region status at the instance level (once per peer FSx ID),
        // then apply to all volumes that reference that peer.
        const peerFileSystemIds = [...new Set(compact(crrDetails.map(d => d.peerClusterFsxId).flat()) as string[])];
        const crossRegionPeerIds = new Set<string>();

        if (!isEmpty(peerFileSystemIds)) {
            await Promise.all(
                peerFileSystemIds.map(async (peerFileSystemId: string) => {
                    try {
                        const fsxInfo = await describeFSx(
                            credentialsId,
                            region,
                            { FileSystemIds: [peerFileSystemId] },
                            accountId,
                            { useCache: true }
                        );
                        const resourceArn = fsxInfo?.FileSystems?.[0]?.ResourceARN;
                        if (!resourceArn?.includes(region)) {
                            crossRegionPeerIds.add(peerFileSystemId);
                        }
                    } catch (error: any) {
                        if (error?.name === 'FileSystemNotFound') {
                            crossRegionPeerIds.add(peerFileSystemId);
                        } else {
                            logger.error(`Error describing peer FSx ${peerFileSystemId}:`, error);
                        }
                    }
                })
            );
        }

        crrDetails.forEach(crrDetail => {
            const peerIds = (
                Array.isArray(crrDetail.peerClusterFsxId) ? crrDetail.peerClusterFsxId : [crrDetail.peerClusterFsxId]
            ).filter((id): id is string => !!id);
            crrDetail.isCRREnabled = peerIds.some(id => crossRegionPeerIds.has(id));
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
    crrAssessmentData: CrrAssessment
): OracleGenericParameterDriftResponseType & { errorMessage?: string } {
    logger.info('Calculate Oracle CRR drift data for:', {
        accountId,
        region,
        credentialsId,
        databaseInstanceId,
        databaseHostId
    });

    if (isEmpty(crrAssessmentData)) {
        const errorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategoriesOracle.CRR);
        return { errorMessage } as OracleGenericParameterDriftResponseType & { errorMessage: string };
    }

    const { crrDetails } = crrAssessmentData;

    try {
        const allVolumesOptimized: boolean = crrDetails.every((detail: CrrDetails) => detail.isCRREnabled);

        const response: OracleGenericParameterDriftResponseType = {
            name: 'crr',
            status: allVolumesOptimized ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
            severity: SEVERITY.WARNING,
            recommendation: storageGoldenConfigData.resiliency.crr.recommendation,
            objectsInViolation: allVolumesOptimized
                ? []
                : crrDetails.filter(detail => !detail.isCRREnabled).map(detail => detail.volumeName),
            totalObjectsAssessed: crrDetails.length,
            totalObjectsInViolation: allVolumesOptimized ? 0 : crrDetails.filter(detail => !detail.isCRREnabled).length,
            tags: [AwsWellArchitecturedPillars.RELIABILITY],
            resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
            recommended: 'crr-enabled'
        };

        return response;
    } catch (error) {
        logger.error('Error fetching Oracle CRR drift data:', error);
        return { errorMessage: (error as Error).message } as OracleGenericParameterDriftResponseType & {
            errorMessage: string;
        };
    }
}

export { initiateCrossRegionResiliencyAssessment, getCrrDriftData };
