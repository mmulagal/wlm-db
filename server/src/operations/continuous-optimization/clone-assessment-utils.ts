import { isEmpty } from 'lodash-es';
import { DATABASE_TYPE } from '@prisma/client';

import { CloneAssessment, CloneDetail } from '../../utils/common-types';
import { CLONE_AGE, GENERIC_ASSESSMENT_ERROR_MESSAGE } from '../../utils/consts';
import { AssessmentCategories, AssessmentStatus } from '../../utils/continous-optimization-consts';
import getLogger from '../../utils/logger';
import type { AssessmentItemType, AssessmentErrorItemType } from '../../routes/types/continuous-optimization.types';
import { MSSQL_GOLDEN_CONFIG } from './mssql/golden-config';
import ORACLE_GOLDEN_CONFIG from './oracle/golden-config';

const logger = getLogger();

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

export default calculateOneTimeWADCloneDrift;
