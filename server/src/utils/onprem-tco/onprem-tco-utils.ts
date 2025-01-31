import createError from 'http-errors';
import moment from 'moment';
import getLogger from '../logger';
import { generateHash } from '../utils';

const logger = getLogger();

function parseCpuUtilization(value: string) {
    try {
        const parsedValue = JSON.parse(value);
        if (typeof parsedValue === 'number') {
            return parsedValue;
        }
        if (typeof parsedValue === 'object' && parsedValue.error) {
            logger.error(`Error: ${parsedValue.error}`);
            throw parsedValue?.error;
        }
    } catch (error) {
        if (typeof value === 'string' && !Number.isNaN(Number(value))) {
            return Number(value);
        }
        const errorMessage = `Error parsing cpuUtilization: ${error}`;
        throw createError(500, errorMessage);
    }
}

function parseMemoryUtilization(value: string) {
    try {
        const parsedValue = JSON.parse(value);
        if (
            Array.isArray(parsedValue) &&
            parsedValue.every(item => 'used' in item && 'total' in item && 'remaining' in item && 'percentUsed' in item)
        ) {
            return parsedValue;
        }
        if (typeof parsedValue === 'object' && parsedValue.error) {
            logger.error(`Error: ${parsedValue.error}`);
            throw parsedValue?.error;
        }
    } catch (error) {
        const errorMessage = `Error parsing memUtilization: ${error}`;
        throw createError(500, errorMessage);
    }
}

function parseLicenceUsageDetails(value: string) {
    try {
        const parsedValue = JSON.parse(value);
        if (
            Array.isArray(parsedValue) &&
            parsedValue.every(item => 'IsUsingFeature' in item && 'FeatureDescription' in item)
        ) {
            return parsedValue;
        }
        if (typeof parsedValue === 'object' && parsedValue.error) {
            logger.error(`Error: ${parsedValue.error}`);
            throw parsedValue?.error;
        }
    } catch (error) {
        const errorMessage = `Error parsing licenceUsageDetails: ${error}`;
        throw createError(500, errorMessage);
    }
}

function parseSqlVersion(value: string | string[]) {
    if (Array.isArray(value)) {
        return value.join(',');
    }
    try {
        if (typeof value === 'object') {
            const parsedValue = JSON.parse(value);
            if (parsedValue.error) {
                logger.error(`Error: ${parsedValue.error}`);
                throw parsedValue?.error;
            }
        }
        return value.replace(/\t/g, ' ') || '';
    } catch (error) {
        const errorMessage = `Error parsing sqlVersion: ${error}`;
        throw createError(500, errorMessage);
    }
}

function parseIops(value: string) {
    try {
        const parsedValue = JSON.parse(value);
        if (
            Array.isArray(parsedValue) &&
            parsedValue.every(
                item =>
                    'writeIops' in item && 'readIops' in item && 'writeBytesPerSec' in item && 'readBytesPerSec' in item
            )
        ) {
            return parsedValue;
        }
        if (typeof parsedValue === 'object' && parsedValue.error) {
            logger.error(`Error: ${parsedValue.error}`);
            throw parsedValue?.error;
        }
    } catch (error) {
        const errorMessage = `Error parsing iops: ${error}`;
        throw createError(500, errorMessage);
    }
}

function parseStorageDetailsByDb(value: string) {
    try {
        const parsedValue = JSON.parse(value);
        if (
            Array.isArray(parsedValue) &&
            parsedValue.every(
                item =>
                    'databaseName' in item &&
                    'allocatedSizeMb' in item &&
                    'dataSizeMb' in item &&
                    'logSizeMb' in item &&
                    'driveLetter' in item &&
                    'driveTotalSizeMb' in item &&
                    'driveAvailableSizeMb' in item
            )
        ) {
            return parsedValue;
        }
        if (typeof parsedValue === 'object' && parsedValue.error) {
            logger.error(`Error: ${parsedValue.error}`);
            throw parsedValue?.error;
        }
    } catch (error) {
        const errorMessage = `Error parsing storageDetailsByDb: ${error}`;
        throw createError(500, errorMessage);
    }
}

function parseAoagReadReplica(value: string) {
    try {
        const correctedValue = value.replace(/\\/g, '\\\\');
        const parsedValue = JSON.parse(correctedValue);
        if (
            Array.isArray(parsedValue) &&
            parsedValue.every(
                item =>
                    'databaseName' in item &&
                    'replicaId' in item &&
                    'replicaServerName' in item &&
                    'syncStateDesc' in item &&
                    'replicaRole' in item
            )
        ) {
            return parsedValue;
        }
        if (typeof parsedValue === 'object' && parsedValue.error) {
            logger.error(`Error: ${parsedValue.error}`);
            throw parsedValue?.error;
        }
    } catch (error) {
        const errorMessage = `Error parsing aoagReadReplica: ${error}`;
        throw createError(500, errorMessage);
    }
}

function convertToDate(dateString: string): Date {
    return moment(dateString, 'YYYYMMDDHHmmss').toDate();
}

function generateUniqueId(accountId: string, instanceIds: string[], hostIds: string[]): string {
    const combinedIds = [accountId, ...instanceIds, ...hostIds].sort();
    const combinedString = combinedIds.join('-');
    return generateHash(combinedString);
}

export {
    parseCpuUtilization,
    parseMemoryUtilization,
    parseLicenceUsageDetails,
    parseSqlVersion,
    parseIops,
    parseStorageDetailsByDb,
    parseAoagReadReplica,
    convertToDate,
    generateUniqueId
};
