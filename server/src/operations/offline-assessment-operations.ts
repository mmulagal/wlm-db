import createError from 'http-errors';
import { decompressSync } from 'fflate';
import { OfflineAssessmentUploadResponseType } from '../routes/types/offline-assessment.types';
import {
    MSSQL_ONE_TIME_WAD,
    OFFLINE_ASSESSMENT_SCRIPT_VERSION
} from './continuous-optimization/mssql/ssm-scripts/offline-assessment';
import { uploadMssqlOfflineAssessment } from './continuous-optimization/mssql/offline-assessment-operations';
import { createStreamingZip, ASSESSMENT_SCRIPT_FILENAMES } from '../utils/utils';
import getLogger from '../utils/logger';
import { DatabaseTypes, HttpErrorCodes } from '../utils/consts';
import { MSSQL_ONE_TIME_ASSESSMENT_README } from './continuous-optimization/one-time-assessment-consts';

const logger = getLogger();

/**
 * Decode file content supporting multiple formats:
 * 1. Raw JSON string
 * 2. Base64 compressed format (like TCO upload): base64 -> decompress -> base64 -> JSON
 */
function decodeBase64FileContent(fileContent: string): string {
    // First, try to parse as raw JSON
    try {
        JSON.parse(fileContent);
        return fileContent;
    } catch {
        // Not raw JSON, continue with base64 decoding
    }

    try {
        // Try compressed format (same as uploadOnpremTcoData):
        // base64 -> decompress -> base64 -> JSON
        const compressedUint8Array = Uint8Array.from(
            atob(fileContent)
                .split('')
                .map(char => char.charCodeAt(0))
        );

        const decompressedData = decompressSync(compressedUint8Array);
        const decompressedBase64 = new TextDecoder().decode(decompressedData);

        // Remove BOM characters if present and decode inner base64
        const cleanedBase64 = decompressedBase64.replace(/^ÿþ/, '');
        const originalJsonString = atob(cleanedBase64);

        return originalJsonString;
    } catch (error) {
        logger.debug('Failed to decode compressed base64, assuming raw content', { error });
        return fileContent;
    }
}

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
    } catch (error: any) {
        logger.error('Failed to generate offline assessment script ZIP', {
            error: error.message,
            accountId,
            databaseType
        });
        throw error;
    }
}

export { uploadOfflineAssessment, downloadOfflineAssessmentScript };
