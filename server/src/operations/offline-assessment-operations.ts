import createError from 'http-errors';
import { OfflineAssessmentUploadResponseType } from '../routes/types/offline-assessment.types';
import {
    MSSQL_ONE_TIME_WAD,
    OFFLINE_ASSESSMENT_SCRIPT_VERSION
} from './continuous-optimization/mssql/ssm-scripts/offline-assessment';
import { uploadMssqlOfflineAssessment } from './continuous-optimization/mssql/offline-assessment-operations';
import { uploadOracleOfflineAssessment } from './continuous-optimization/oracle/offline-assessment-operations';
import {
    oracleOneTimeWadPythonScript,
    ORACLE_ONETIMEWAD_SCRIPT_VERSION
} from './continuous-optimization/oracle/ssm-scripts/one-time-wad/oracle-onetimewad';
import { createStreamingZip, ASSESSMENT_SCRIPT_FILENAMES, decodeBase64FileContent } from '../utils/utils';
import getLogger from '../utils/logger';
import { DatabaseTypes, HttpErrorCodes } from '../utils/consts';
import {
    MSSQL_ONE_TIME_ASSESSMENT_README,
    ORACLE_ONE_TIME_ASSESSMENT_README
} from './continuous-optimization/one-time-assessment-consts';

const logger = getLogger();

async function uploadOfflineAssessment(
    accountId: string,
    fileContent: string,
    fileName?: string,
    databaseType: string = 'mssql',
    credentialsId?: string,
    region?: string
): Promise<OfflineAssessmentUploadResponseType> {
    logger.info('Uploading offline assessment', {
        accountId,
        databaseType,
        credentialsId,
        region
    });

    const decodedContent = decodeBase64FileContent(fileContent);

    switch (databaseType.toLowerCase()) {
        case DatabaseTypes.MS_SQL_SERVER.toLowerCase():
            return uploadMssqlOfflineAssessment(accountId, decodedContent, fileName, credentialsId, region);
        case DatabaseTypes.ORACLE.toLowerCase():
            return uploadOracleOfflineAssessment(accountId, decodedContent, fileName, credentialsId, region);
        default:
            throw createError(
                HttpErrorCodes.BAD_REQUEST,
                `Offline assessment upload not yet implemented for database type: ${databaseType}`
            );
    }
}

async function downloadOfflineAssessmentScript(accountId: string, databaseType: string = 'mssql') {
    logger.info('Generating one-time WAD assessment script (streaming)', { accountId, databaseType });

    const supportedTypes = Object.keys(ASSESSMENT_SCRIPT_FILENAMES);
    if (!supportedTypes.includes(databaseType)) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            `Unsupported database type: ${databaseType}. Supported types: ${supportedTypes.join(', ')}`
        );
    }

    try {
        let scriptContent: string;
        let version: string | undefined;
        let readmeContent: string | undefined;

        switch (databaseType) {
            case DatabaseTypes.MS_SQL_SERVER.toLowerCase():
                scriptContent = MSSQL_ONE_TIME_WAD;
                version = OFFLINE_ASSESSMENT_SCRIPT_VERSION;
                readmeContent = MSSQL_ONE_TIME_ASSESSMENT_README;
                break;
            case DatabaseTypes.ORACLE.toLowerCase():
                scriptContent = oracleOneTimeWadPythonScript;
                version = ORACLE_ONETIMEWAD_SCRIPT_VERSION;
                readmeContent = ORACLE_ONE_TIME_ASSESSMENT_README;
                break;
            default:
                throw createError(
                    HttpErrorCodes.BAD_REQUEST,
                    `Script generation not yet implemented for database type: ${databaseType}`
                );
        }

        const { archive, filename } = await createStreamingZip({
            scriptContent,
            databaseType,
            version,
            readmeContent
        });

        return { archive, filename };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to generate offline assessment script ZIP', {
            error: errorMessage,
            accountId,
            databaseType
        });
        throw error;
    }
}

export { uploadOfflineAssessment, downloadOfflineAssessmentScript };
