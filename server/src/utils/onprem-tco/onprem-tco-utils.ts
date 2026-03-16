import createError from 'http-errors';
import moment from 'moment';
import getLogger from '../logger';
import { sizeInGigaBytes, generateHash } from '../utils';

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

function getPowerOfTwoVcpuCount(maxVcpuCount: number) {
    logger.info(`Check and update max vcpu count to power of 2 ${maxVcpuCount}`);
    const isATwoPowerValue = Number.isInteger(Math.log2(maxVcpuCount));
    if (!isATwoPowerValue) {
        maxVcpuCount = 2 ** Math.ceil(Math.log2(maxVcpuCount));
    }
    return maxVcpuCount;
}

interface ComputeOverrideRequest {
    id: string;
    vcpus: number | null | undefined;
    memoryBytes: number | null | undefined;
    networkPerformance: string | null | undefined;
}

interface StoredComputeEntry {
    id: string;
    vcpus: number;
    memoryBytes: number;
    networkPerformance: string;
}

/**
 * Determines whether any request-level compute overrides (vCPUs, memory, network)
 * differ from what is persisted, which would require re-deriving instance types
 * instead of using the cached assessment.
 *
 * Both MSSQL and Oracle callers normalise their workload-specific shapes into the
 * generic {@link ComputeOverrideRequest} / {@link StoredComputeEntry} before calling.
 *
 * Memory is compared at GiB granularity (floor) so sub-MiB floating-point drift
 * from the UI round-trip never causes a false cache bypass.
 */
function hasComputeOverrides(
    requestEntries: ComputeOverrideRequest[] | undefined,
    storedEntries: StoredComputeEntry[]
): boolean {
    if (!requestEntries?.length) {
        return false;
    }
    return requestEntries.some(req => {
        const stored = storedEntries.find(s => s.id === req.id);
        if (!stored) {
            return true;
        }
        return (
            (req.vcpus && req.vcpus !== stored.vcpus) ||
            (req.memoryBytes &&
                Math.floor(sizeInGigaBytes(req.memoryBytes, 'B')) !==
                    Math.floor(sizeInGigaBytes(stored.memoryBytes, 'B'))) ||
            (req.networkPerformance && req.networkPerformance !== stored.networkPerformance)
        );
    });
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
    generateUniqueId,
    getPowerOfTwoVcpuCount,
    hasComputeOverrides
};
