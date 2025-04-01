import getLogger from './logger';
import { listResources, updateResourceMetaData } from '../lib/database/db';
import { Metadata } from './common-types';

const logger = getLogger();

async function updateAsssementErrorInResourceMetadata(
    accountId: string,
    databaseHostId: string,
    credentialsId: string,
    region: string,
    errorMessage: string,
    assesmentType: string
) {
    try {
        const [{ metadata = {} } = {}] = (await listResources(accountId, databaseHostId, credentialsId, region)) || [];
        const existingAssessmentData = (metadata as unknown as Metadata).assessment;
        let assessmentErrors = {};
        switch (assesmentType) {
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
        (metadata as unknown as Metadata).assessment = {
            ...existingAssessmentData,
            errors: assessmentErrors,
            lastAssessedDate: new Date().getTime().toString()
        };
        return updateResourceMetaData(accountId, credentialsId, databaseHostId, metadata);
    } catch (error: any) {
        logger.error('Error updating assessment error in resource metadata', {
            accountId,
            databaseHostId,
            credentialsId,
            region,
            errorMessage,
            assesmentType,
            error
        });
    }
}

export { updateAsssementErrorInResourceMetadata };
