import getLogger from './logger';
import { listResources } from '../lib/database/db';
import { ResourceAssessmentData } from './common-types';
import { updateDatabaseHostAssessmentData } from '../operations/database/database-operations';

const logger = getLogger();

async function updateAssessmentErrorInResourceTable(
    accountId: string,
    databaseHostId: string,
    credentialsId: string,
    region: string,
    errorMessage: string,
    assessmentType: string
) {
    try {
        const [{ assessment_data: assessmentData } = {}] =
            (await listResources(accountId, databaseHostId, credentialsId, region)) || [];
        const existingAssessmentData = assessmentData as ResourceAssessmentData | undefined;
        let assessmentErrors = {};
        switch (assessmentType) {
            case 'compute':
                assessmentErrors = { ...existingAssessmentData?.errors, compute: errorMessage };
                break;
            case 'license':
                assessmentErrors = { ...existingAssessmentData?.errors, license: errorMessage };
                break;
            case 'mssqlPatch':
                assessmentErrors = { ...existingAssessmentData?.errors, mssqlPatch: errorMessage };
                break;
            case 'rssConfig':
                assessmentErrors = { ...existingAssessmentData?.errors, rssConfig: errorMessage };
                break;
            case 'hostOsPatch':
                assessmentErrors = { ...existingAssessmentData?.errors, hostOsPatch: errorMessage };
                break;
            default:
                assessmentErrors = { ...existingAssessmentData?.errors };
                break;
        }
        const newAssessmentData = {
            ...existingAssessmentData,
            errors: assessmentErrors,
            lastAssessedDate: new Date().getTime().toString()
        };
        return updateDatabaseHostAssessmentData(accountId, credentialsId, databaseHostId, newAssessmentData);
    } catch (error: any) {
        logger.error('Error updating assessment error in resource metadata', {
            accountId,
            databaseHostId,
            credentialsId,
            region,
            errorMessage,
            assessmentType,
            error
        });
    }
}

export { updateAssessmentErrorInResourceTable };
