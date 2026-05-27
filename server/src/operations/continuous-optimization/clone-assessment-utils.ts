import { isEmpty } from 'lodash-es';
import { DATABASE_TYPE } from '@prisma/client';

import { CloneAssessment, CloneDetail } from '../../utils/common-types';
import { CLONE_AGE, GENERIC_ASSESSMENT_ERROR_MESSAGE } from '../../utils/consts';
import { AssessmentCategories, AssessmentStatus } from '../../utils/continous-optimization-consts';
import getLogger from '../../utils/logger';
import MSSQL_GOLDEN_CONFIG from './mssql/golden-config';
import ORACLE_GOLDEN_CONFIG from './oracle/golden-config';

const logger = getLogger();

const CLONE_DRIFT_OPTIMIZED_RECOMMENDATION = 'All clones are up-to-date. No old FlexClone volumes detected.';

function calculateOneTimeWADCloneDrift(
    accountId: string,
    databaseHostId: string,
    databaseInstanceId: string,
    cloneAssessmentData: CloneAssessment,
    databaseType: DATABASE_TYPE
) {
    logger.info('Calculating one-time WAD clone drift', {
        accountId,
        databaseHostId,
        databaseInstanceId,
        databaseType
    });

    if (isEmpty(cloneAssessmentData)) {
        const errorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.CLONE);
        logger.warn(errorMessage);
        return { errorMessage };
    }

    const goldenConfig =
        databaseType === DATABASE_TYPE.oracle ? ORACLE_GOLDEN_CONFIG.cloneManagement : MSSQL_GOLDEN_CONFIG.cloning;

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

        const recommendation =
            status === AssessmentStatus.NOT_OPTIMIZED
                ? goldenConfig.recommendation
                : CLONE_DRIFT_OPTIMIZED_RECOMMENDATION;

        return {
            name: goldenConfig.name,
            status,
            recommended: AssessmentStatus.OPTIMIZED,
            severity: goldenConfig.severity,
            recommendation,
            tags: goldenConfig.tags,
            resourceType: goldenConfig.resourceType,
            cloneDetails,
            totalObjectsAssessed: cloneDetails.length,
            totalObjectsInViolation: oldClones,
            objectsInViolation: oldCloneDatabaseNames,
            oldCloneDetails,
            cloneDriftMessage: `${oldClones} out of ${cloneDetails.length} clones are old and divergent`
        };
    } catch (error) {
        const errorMessage = `Error while calculating one-time WAD clone drift: ${
            error instanceof Error ? error.message : String(error)
        }`;
        logger.error(errorMessage, { accountId, databaseHostId, databaseInstanceId, error });
        return { errorMessage };
    }
}

export default calculateOneTimeWADCloneDrift;
