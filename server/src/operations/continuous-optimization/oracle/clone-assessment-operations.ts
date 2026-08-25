import { isEmpty } from 'lodash-es';

import { JOBSTATUS, JOBTYPE } from '@prisma/client';

import getLogger from '../../../utils/logger';
import { CloneAssessment, VolumeRecord, WorkloadInstance } from '../../../utils/common-types';
import { GENERIC_ASSESSMENT_ERROR_MESSAGE } from '../../../utils/consts';
import { AssessmentCategoriesOracle, AssessmentStatus } from '../../../utils/continous-optimization-consts';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { createDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import ORACLE_GOLDEN_CONFIG from './golden-config';
import type { AssessmentItemType, AssessmentErrorItemType } from '../../../routes/types/continuous-optimization.types';
import { buildCloneAssessmentFromOntapVolumes } from '../clone-assessment-utils';
import { collectAllOntapRecords, buildOntapProxyBase } from '../../../lib/ontap/ontap-gateway';

const logger = getLogger();

const FLEXCLONE_VOLUMES_FIELDS =
    'clone.parent_volume.name,clone.is_flexclone,create_time,name,uuid,svm.name,svm.uuid,space.size,space.used,space.physical_used';

async function fetchOracleFlexCloneVolumes(
    accountId: string,
    credentialsId: string,
    fsxFileSystem: string,
    region: string
): Promise<VolumeRecord[]> {
    const base = await buildOntapProxyBase(accountId, credentialsId, fsxFileSystem, region);
    return collectAllOntapRecords<VolumeRecord>(base, 'api/storage/volumes', {
        'clone.is_flexclone': true,
        fields: FLEXCLONE_VOLUMES_FIELDS
    });
}

/**
 * Queries ONTAP for FlexClone volumes, correlates with Oracle mapped volumes,
 * and builds the clone assessment identifying old clones beyond the configured threshold.
 */
async function runOracleCloneAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    instanceRecord: WorkloadInstance
) {
    const {
        id: databaseInstanceId,
        name: databaseInstanceName,
        resourceName,
        fsxFileSystem,
        mappedVolumeNames = [],
        svmOntapName
    } = instanceRecord;

    logger.info('Running Oracle clone assessment', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        databaseInstanceName,
        fsxFileSystem,
        mappedVolumeNames
    });

    const svmName = Array.isArray(svmOntapName) ? svmOntapName[0] : svmOntapName;
    if (!svmName || isEmpty(mappedVolumeNames)) {
        logger.info('Skipping clone assessment — no SVM or mapped volumes available', {
            accountId,
            databaseHostId,
            databaseInstanceId,
            svmName,
            mappedVolumeNames
        });
        return;
    }

    const flexCloneRecords = await fetchOracleFlexCloneVolumes(accountId, credentialsId, fsxFileSystem, region);

    return buildCloneAssessmentFromOntapVolumes(
        flexCloneRecords,
        { databaseHostName: resourceName, databaseHostId, databaseInstanceName },
        mappedVolumeNames
    );
}

async function initiateOracleCloneAssessmentCollection(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    parentJobId: string,
    instanceRecord: WorkloadInstance
) {
    const { id: databaseInstanceId, name: databaseInstanceName, resourceName } = instanceRecord;

    logger.info('Initiating Oracle clone assessment collection', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        parentJobId
    });

    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;
    const { id: cloneJobId } = await registerJob(accountId, credentialsId, region, {
        name: `Oracle clone assessment for ${resourceWithInstanceName}`,
        description: `Clone assessment for Oracle database ${resourceWithInstanceName}`,
        resourceName: resourceWithInstanceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    let jobStatus!: JOBSTATUS;
    let errorMessage = '';

    try {
        const cloneAssessment = await runOracleCloneAssessment(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            instanceRecord
        );

        if (!isEmpty(cloneAssessment)) {
            await createDatabaseInstanceConfigData([
                {
                    account_id: accountId,
                    credentials_id: credentialsId,
                    region,
                    resource_id: databaseHostId,
                    database_instance_id: databaseInstanceId,
                    creation_time: new Date(Date.now()),
                    config_data_type: AssessmentCategoriesOracle.CLONE,
                    config_data: cloneAssessment
                }
            ]);
        }

        jobStatus = JOBSTATUS.COMPLETED;
    } catch (error) {
        errorMessage = `Error while performing Oracle clone assessment for ${databaseInstanceName}`;
        logger.error(errorMessage, { accountId, databaseHostId, databaseInstanceId, error });
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, cloneJobId, {
            endTime: Date.now(),
            status: jobStatus,
            error: errorMessage
        });
    }
}

function calculateOracleCloneDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    cloneAssessmentData: CloneAssessment
): AssessmentItemType | AssessmentErrorItemType {
    logger.info('Calculating Oracle clone drift', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId
    });

    const [goldenConfig] = ORACLE_GOLDEN_CONFIG.filter(e => e.id === 'clone-management');

    if (isEmpty(cloneAssessmentData)) {
        const errorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategoriesOracle.CLONE);
        logger.warn(errorMessage);
        return { ...goldenConfig, errorMessage };
    }

    try {
        const { cloneDetails, status, oldClones, oldCloneDetails, oldCloneDatabaseNames } = cloneAssessmentData;

        return {
            ...goldenConfig,
            status: status as AssessmentStatus,
            recommended: AssessmentStatus.OPTIMIZED,
            cloneDetails: cloneDetails?.map(detail => ({
                ...detail,
                tag: detail.tag ?? undefined
            })),
            totalObjectsAssessed: cloneDetails?.length ?? 0,
            totalObjectsInViolation: oldClones ?? oldCloneDatabaseNames?.length ?? 0,
            objectsInViolation: oldCloneDatabaseNames ?? [],
            oldCloneDetails: oldCloneDetails?.map(detail => ({
                ...detail,
                tag: detail.tag ?? undefined
            })),
            cloneDriftMessage: `${oldClones} out of ${cloneDetails?.length ?? 0} clones are old and divergent`
        };
    } catch (error) {
        const errorMessage = 'Error while calculating Oracle clone drift';
        logger.error(errorMessage, { accountId, databaseHostId, databaseInstanceId, error });
        return { ...goldenConfig, errorMessage };
    }
}

export { initiateOracleCloneAssessmentCollection, calculateOracleCloneDrift, fetchOracleFlexCloneVolumes };
