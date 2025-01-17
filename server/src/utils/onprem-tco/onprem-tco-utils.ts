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
        }
    } catch (error) {
        if (typeof value === 'string' && !Number.isNaN(Number(value))) {
            return Number(value);
        }
        logger.error(`Error parsing cpuUtilization: ${error}`);
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
        }
    } catch (error) {
        logger.error(`Error parsing memUtilization: ${error}`);
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
        }
    } catch (error) {
        logger.error(`Error parsing licenceUsageDetails: ${error}`);
    }
}

function parseSqlVersion(value: string | string[]) {
    if (Array.isArray(value)) {
        return value.join(',');
    }

    try {
        const parsedValue = JSON.parse(value);
        if (Array.isArray(parsedValue)) {
            return parsedValue.join(',');
        }
        if (typeof parsedValue === 'object' && parsedValue.error) {
            logger.error(`Error: ${parsedValue.error}`);
        }
    } catch (error) {
        logger.error(`Error parsing sqlVersion: ${error}`);
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
        }
    } catch (error) {
        logger.error(`Error parsing iops: ${error}`);
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
        }
    } catch (error) {
        logger.error(`Error parsing storageDetailsByDb: ${error}`);
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
    convertToDate,
    generateUniqueId
};
