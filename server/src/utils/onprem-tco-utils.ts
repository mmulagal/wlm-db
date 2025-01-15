import moment from 'moment';
import getLogger from './logger';

const logger = getLogger();

function parseCpuUtilization(value: string): number | null {
    try {
        const parsedValue = JSON.parse(value);
        if (typeof parsedValue === 'number') {
            return parsedValue;
        }
        if (typeof parsedValue === 'object' && parsedValue.error) {
            logger.error(`Error: ${parsedValue.error}`);
            return null;
        }
    } catch (error) {
        if (typeof value === 'string' && !Number.isNaN(Number(value))) {
            return Number(value);
        }
    }
    return null;
}

function parseMemUtilization(
    value: string
): { used: number; total: number; remaining: number; percentUsed: number }[] | null {
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
            return null;
        }
    } catch (error) {
        logger.error(`Error parsing memUtilization: ${error}`);
    }
    return null;
}

function parseLicenceUsageDetails(value: string): { IsUsingFeature: number; FeatureDescription: string }[] | null {
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
            return null;
        }
    } catch (error) {
        logger.error(`Error parsing licenceUsageDetails: ${error}`);
    }
    return null;
}

function parseSqlVersion(value: string | string[]): string | null {
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
            return null;
        }
    } catch (error) {
        logger.error(`Error parsing sqlVersion: ${error}`);
    }
    return null;
}

function parseIops(
    value: string
): { writeIops: string; readIops: string; writeBytesPerSec: string; readBytesPerSec: string }[] | null {
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
            return null;
        }
    } catch (error) {
        logger.error(`Error parsing iops: ${error}`);
    }
    return null;
}

function parseStorageDetailsByDb(value: string):
    | {
          databaseName: string;
          allocatedSizeMb: number;
          dataSizeMb: number;
          logSizeMb: number;
          driveLetter: string;
          driveTotalSizeMb: number;
          driveAvailableSizeMb: number;
      }[]
    | null {
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
            return null;
        }
    } catch (error) {
        logger.error(`Error parsing storageDetailsByDb: ${error}`);
    }
    return null;
}

function convertToDate(dateString: string): Date {
    return moment(dateString, 'YYYYMMDDHHmmss').toDate();
}

export {
    parseCpuUtilization,
    parseMemUtilization,
    parseLicenceUsageDetails,
    parseSqlVersion,
    parseIops,
    parseStorageDetailsByDb,
    convertToDate
};
