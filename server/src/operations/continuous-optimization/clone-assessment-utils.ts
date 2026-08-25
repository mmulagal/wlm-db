import { isEmpty } from 'lodash-es';
import { DATABASE_TYPE } from '@prisma/client';

import { CloneAssessment, CloneDetail, ClonedVolumeDetail, VolumeRecord } from '../../utils/common-types';
import { CLONE_AGE, GENERIC_ASSESSMENT_ERROR_MESSAGE } from '../../utils/consts';
import { AssessmentCategories, AssessmentStatus } from '../../utils/continous-optimization-consts';
import getLogger from '../../utils/logger';
import { calculateDaysSince } from '../../utils/utils';
import type { AssessmentItemType, AssessmentErrorItemType } from '../../routes/types/continuous-optimization.types';
import { MSSQL_GOLDEN_CONFIG } from './mssql/golden-config';
import ORACLE_GOLDEN_CONFIG from './oracle/golden-config';

const logger = getLogger();

interface CloneAssessmentContext {
    databaseHostName: string;
    databaseHostId: string;
    databaseInstanceName: string;
}

function buildCloneAssessmentFromOntapVolumes(
    volumeRecords: VolumeRecord[],
    context: CloneAssessmentContext,
    parentVolumeNames?: string[]
): CloneAssessment {
    const parentVolumeSet = parentVolumeNames ? new Set(parentVolumeNames) : undefined;
    const relevantClones = volumeRecords.filter(
        record =>
            record.clone?.is_flexclone === true &&
            (!parentVolumeSet || parentVolumeSet.has(record.clone.parent_volume?.name ?? ''))
    );

    const cloneDetails: CloneDetail[] = relevantClones.map(record => {
        const {
            uuid: cloneVolumeUuid,
            create_time: cloneVolumeCreateTime,
            name: cloneVolumeName,
            clone: { parent_volume: { name: parentVolumeName = '' } = {} } = {},
            space
        } = record;
        const cloneAge = cloneVolumeCreateTime ? calculateDaysSince(cloneVolumeCreateTime) : 0;
        const clonedVolumeInfo: ClonedVolumeDetail = {
            sourceVolumeName: parentVolumeName,
            cloneVolumeName,
            cloneVolumeUuid,
            cloneVolumeCreateTime,
            cloneDatabaseName: cloneVolumeName
        };

        return {
            ...context,
            cloneDatabaseName: cloneVolumeName,
            clonedBy: 'other',
            cloneAge,
            cloneSize: space?.physical_used ?? space?.used ?? 0,
            clonedVolumeDetails: [clonedVolumeInfo]
        };
    });
    const oldCloneDetails = cloneDetails.filter(({ cloneAge }) => cloneAge !== undefined && cloneAge > CLONE_AGE);
    const oldCloneDatabaseNames = oldCloneDetails.flatMap(({ cloneDatabaseName }) =>
        cloneDatabaseName ? [cloneDatabaseName] : []
    );

    logger.info('Built clone assessment from ONTAP volumes', {
        ...context,
        volumeRecordCount: volumeRecords.length,
        cloneCount: cloneDetails.length,
        oldCloneCount: oldCloneDetails.length
    });

    return {
        cloneDetails,
        status: oldCloneDetails.length === 0 ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
        oldClones: oldCloneDetails.length,
        oldCloneDetails,
        oldCloneDatabaseNames
    };
}

function calculateOneTimeWADCloneDrift(
    accountId: string,
    databaseHostId: string,
    databaseInstanceId: string,
    cloneAssessmentData: CloneAssessment,
    databaseType: DATABASE_TYPE
): AssessmentItemType | AssessmentErrorItemType {
    logger.info('Calculating one-time WAD clone drift', {
        accountId,
        databaseHostId,
        databaseInstanceId,
        databaseType
    });

    const goldenConfig = (databaseType === DATABASE_TYPE.oracle ? ORACLE_GOLDEN_CONFIG : MSSQL_GOLDEN_CONFIG).filter(
        e => e.id === 'clone-management'
    )[0];

    if (isEmpty(cloneAssessmentData)) {
        const errorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.CLONE);
        logger.warn(errorMessage);
        return { ...goldenConfig, errorMessage };
    }

    try {
        const cloneDetails = cloneAssessmentData.cloneDetails ?? [];
        const oldCloneDetails: CloneDetail[] = [];
        const oldCloneDatabaseNames: string[] = [];
        cloneDetails.forEach(detail => {
            if (detail.cloneAge !== undefined && detail.cloneAge > CLONE_AGE) {
                oldCloneDetails.push(detail);
                if (detail.cloneDatabaseName) {
                    oldCloneDatabaseNames.push(detail.cloneDatabaseName);
                }
            }
        });
        const oldClones = oldCloneDetails.length;
        const status = oldClones === 0 ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;

        return {
            ...goldenConfig,
            status,
            recommended: AssessmentStatus.OPTIMIZED,
            cloneDetails: cloneDetails.map(detail => ({
                ...detail,
                tag: detail.tag ?? undefined
            })),
            totalObjectsAssessed: cloneDetails.length,
            totalObjectsInViolation: oldClones,
            objectsInViolation: oldCloneDatabaseNames,
            oldCloneDetails: oldCloneDetails.map(detail => ({
                ...detail,
                tag: detail.tag ?? undefined
            })),
            cloneDriftMessage: `${oldClones} out of ${cloneDetails.length} clones are old and divergent`
        };
    } catch (error) {
        const errorMessage = `Error while calculating one-time WAD clone drift: ${
            error instanceof Error ? error.message : String(error)
        }`;
        logger.error(errorMessage, { accountId, databaseHostId, databaseInstanceId, error });
        return { ...goldenConfig, errorMessage };
    }
}

export { calculateOneTimeWADCloneDrift, buildCloneAssessmentFromOntapVolumes };
