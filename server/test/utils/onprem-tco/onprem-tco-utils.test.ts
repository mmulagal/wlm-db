/* eslint-disable no-useless-escape */
import {
    parseCpuUtilization,
    parseMemoryUtilization,
    parseLicenceUsageDetails,
    parseIops,
    parseStorageDetailsByDb,
    convertToDate,
    generateUniqueId,
    parseAoagReadReplica,
    getPowerOfTwoVcpuCount,
    hasComputeOverrides
} from '../../../src/utils/onprem-tco/onprem-tco-utils';
import { convertGiBToBytes } from '../../../src/utils/utils';

describe('onprem-tco-utils', () => {
    it('should parse valid number string', () => {
        expect(parseCpuUtilization('1')).toBe(1);
    });

    it('should parse valid JSON number', () => {
        expect(parseCpuUtilization('{"value": 42}')).toBeUndefined();
    });

    it('invalid CPU utilization', () => {
        expect(() => {
            parseCpuUtilization(
                '{\r\n    "error":  "Error running query \\u0027cpuUtilization\\u0027 on instance FCI12"\r\n}'
            );
        }).toThrowError(/Error/);
    });

    it('should parse valid memory utilization array', () => {
        const input = '[{"used":470822912,"total":8588910592,"remaining":8118087680,"percentUsed":5}]';
        expect(parseMemoryUtilization(input)).toEqual([
            { used: 470822912, total: 8588910592, remaining: 8118087680, percentUsed: 5 }
        ]);
    });

    it('invalid memory utilization', () => {
        expect(() => {
            parseMemoryUtilization(
                '{\r\n    "error":  "Error running query \\u0027memUtilization\\u0027 on instance FCI12"\r\n}'
            );
        }).toThrowError(/Error/);
    });

    it('should parse valid licence usage details array', () => {
        const input =
            '[{"IsUsingFeature":0,"FeatureDescription":"SQL Server has \u003e 128 GB Memory"},{"IsUsingFeature":0,"FeatureDescription":"SQL Server has \u003e 48 vCPU"},{"IsUsingFeature":0,"FeatureDescription":"Tempdb metadata memory-optimized is enabled"},{"IsUsingFeature":0,"FeatureDescription":"User Databases are using Enterprise Level Features"},{"IsUsingFeature":0,"FeatureDescription":"You are using asynchronous mirroring"},{"IsUsingFeature":0,"FeatureDescription":"You are using peer-to-peer replication"},{"IsUsingFeature":0,"FeatureDescription":"You are using R or Python extensions"},{"IsUsingFeature":0,"FeatureDescription":"You are using Resource Governor"},{"IsUsingFeature":0,"FeatureDescription":"You have Asynchronous commit Replicas"},{"IsUsingFeature":0,"FeatureDescription":"You have read-only Replicas"}]                                                                                                                                                                                                                             ';

        const licenseDetails = parseLicenceUsageDetails(input);
        expect(licenseDetails?.length).toBe(10);
    });

    it('invalid license usage details', () => {
        expect(() => {
            parseLicenceUsageDetails(
                '{\r\n    "error":  "Error running query \\u0027licenceUsageDetails\\u0027 on instance FCI12"\r\n}'
            );
        }).toThrowError(/Error/);
    });

    it('should parse valid IOPS array', () => {
        const input =
            '[{"writeIops":"      0.01","readIops":"      0.02","writeBytesPerSec":"              138.89","readBytesPerSec":"             2030.27"}]';
        const [iops] = parseIops(input || '') || [];
        const writeIops = parseFloat(iops?.writeIops?.trim());
        const readIops = parseFloat(iops?.readIops?.trim());
        const totalIops = writeIops + readIops;
        expect(totalIops).toEqual(0.03);
    });

    it('invalid IOPS', () => {
        expect(() => {
            parseIops('{\r\n    "error":  "Error running query \\u0027iops\\u0027 on instance FCI12"\r\n}');
        }).toThrowError(/Error/);
    });

    it('should parse valid storage details array', () => {
        const input =
            '[{"databaseName":"test","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"F:","driveTotalSizeMb":26605,"driveAvailableSizeMb":25549}]';
        expect(parseStorageDetailsByDb(input)).toEqual([
            {
                databaseName: 'test',
                allocatedSizeMb: 16,
                dataSizeMb: 8,
                logSizeMb: 8,
                driveLetter: 'F:',
                driveTotalSizeMb: 26605,
                driveAvailableSizeMb: 25549
            }
        ]);
    });

    it('invalid storage details', () => {
        expect(() => {
            parseStorageDetailsByDb(
                '{\r\n    "error":  "Error running query \\u0027iops\\u0027 on instance FCI12"\r\n}'
            );
        }).toThrowError(/Error/);
    });

    it('should parse valid AOAG details array', () => {
        const input =
            '[{"databaseName":"AOAGDB22","replicaId":"4B08A481-D542-4168-9B1B-976CA6B1B1DE","replicaServerName":"WLMDBAOAG1\\AOAG1_NODE1","syncStateDesc":"SYNCHRONIZED","replicaRole":"SECONDARY"},{"databaseName":"AOAGDB22_DB2","replicaId":"9CECFD61-8D8F-4953-AB8F-6DCAFE1DB035","replicaServerName":"WLMDBAOAG1\\AOAG1_NODE1","syncStateDesc":"SYNCHRONIZED","replicaRole":"SECONDARY"}]';

        expect(parseAoagReadReplica(input)).toEqual([
            {
                databaseName: 'AOAGDB22',
                replicaId: '4B08A481-D542-4168-9B1B-976CA6B1B1DE',
                replicaServerName: 'WLMDBAOAG1\\AOAG1_NODE1',
                syncStateDesc: 'SYNCHRONIZED',
                replicaRole: 'SECONDARY'
            },
            {
                databaseName: 'AOAGDB22_DB2',
                replicaId: '9CECFD61-8D8F-4953-AB8F-6DCAFE1DB035',
                replicaServerName: 'WLMDBAOAG1\\AOAG1_NODE1',
                syncStateDesc: 'SYNCHRONIZED',
                replicaRole: 'SECONDARY'
            }
        ]);
    });
    it('should convert valid date string to Date object', () => {
        const dateString = '20230101123000';
        const expectedDate = new Date(2023, 0, 1, 12, 30, 0);
        expect(convertToDate(dateString)).toEqual(expectedDate);
    });

    it('should generate a unique id', () => {
        const hostIds = ['host1', 'host2', 'host3'];
        const instanceIds = ['instance1', 'instance2', 'instance3'];
        const id = generateUniqueId('account1', instanceIds, hostIds);

        expect(id).toBeDefined();
    });

    it('should return the same value if maxVcpuCount is already a power of 2', () => {
        expect(getPowerOfTwoVcpuCount(8)).toBe(8);
    });

    it('should update maxVcpuCount to the next power of 2 if it is not a power of 2', () => {
        expect(getPowerOfTwoVcpuCount(10)).toBe(16);
    });
});

// ============================================================================
// hasComputeOverrides
// ============================================================================

describe('hasComputeOverrides', () => {
    const GIB = convertGiBToBytes(1);

    const stored = [
        {
            id: 'inst-1',
            vcpus: 8,
            memoryBytes: 16 * GIB,
            networkPerformance: 'upTo10'
        }
    ];

    it('returns false when requestEntries is undefined', () => {
        expect(hasComputeOverrides(undefined, stored)).toBe(false);
    });

    it('returns false when requestEntries is empty', () => {
        expect(hasComputeOverrides([], stored)).toBe(false);
    });

    it('returns true when a request entry has no matching stored entry', () => {
        const req = [{ id: 'unknown-id', vcpus: 8, memoryBytes: 16 * GIB, networkPerformance: 'upTo10' }];
        expect(hasComputeOverrides(req, stored)).toBe(true);
    });

    it('returns false when all compute fields match exactly', () => {
        const req = [{ id: 'inst-1', vcpus: 8, memoryBytes: 16 * GIB, networkPerformance: 'upTo10' }];
        expect(hasComputeOverrides(req, stored)).toBe(false);
    });

    it('returns true when vcpus differ', () => {
        const req = [{ id: 'inst-1', vcpus: 16, memoryBytes: 16 * GIB, networkPerformance: 'upTo10' }];
        expect(hasComputeOverrides(req, stored)).toBe(true);
    });

    it('returns true when networkPerformance differs', () => {
        const req = [{ id: 'inst-1', vcpus: 8, memoryBytes: 16 * GIB, networkPerformance: 'above10' }];
        expect(hasComputeOverrides(req, stored)).toBe(true);
    });

    it('returns false when memory differs by less than 1 GiB (float drift absorbed)', () => {
        const driftBytes = 2 * 1024 * 1024; // 2 MiB -- sub-GiB drift from UI roundtrip
        const req = [
            { id: 'inst-1', vcpus: 8, memoryBytes: 16 * GIB + driftBytes, networkPerformance: 'upTo10' }
        ];
        expect(hasComputeOverrides(req, stored)).toBe(false);
    });

    it('returns true when memory differs by a full GiB', () => {
        const req = [{ id: 'inst-1', vcpus: 8, memoryBytes: 17 * GIB, networkPerformance: 'upTo10' }];
        expect(hasComputeOverrides(req, stored)).toBe(true);
    });

    it('returns false when vcpus is null (field not provided by caller)', () => {
        const req = [{ id: 'inst-1', vcpus: null, memoryBytes: 16 * GIB, networkPerformance: 'upTo10' }];
        expect(hasComputeOverrides(req, stored)).toBe(false);
    });

    it('returns false when memoryBytes is null (field not provided by caller)', () => {
        const req = [{ id: 'inst-1', vcpus: 8, memoryBytes: null, networkPerformance: 'upTo10' }];
        expect(hasComputeOverrides(req, stored)).toBe(false);
    });

    it('returns false when networkPerformance is null (field not provided by caller)', () => {
        const req = [{ id: 'inst-1', vcpus: 8, memoryBytes: 16 * GIB, networkPerformance: null }];
        expect(hasComputeOverrides(req, stored)).toBe(false);
    });

    it('returns true when any one entry in a multi-instance request differs', () => {
        const multiStored = [
            { id: 'inst-1', vcpus: 8, memoryBytes: 16 * GIB, networkPerformance: 'upTo10' },
            { id: 'inst-2', vcpus: 4, memoryBytes: 8 * GIB, networkPerformance: 'upTo10' }
        ];
        const req = [
            { id: 'inst-1', vcpus: 8, memoryBytes: 16 * GIB, networkPerformance: 'upTo10' },
            { id: 'inst-2', vcpus: 8, memoryBytes: 8 * GIB, networkPerformance: 'upTo10' } // vcpus changed
        ];
        expect(hasComputeOverrides(req, multiStored)).toBe(true);
    });

    it('returns false when all entries in a multi-instance request match', () => {
        const multiStored = [
            { id: 'inst-1', vcpus: 8, memoryBytes: 16 * GIB, networkPerformance: 'upTo10' },
            { id: 'inst-2', vcpus: 4, memoryBytes: 8 * GIB, networkPerformance: 'upTo10' }
        ];
        const req = [
            { id: 'inst-1', vcpus: 8, memoryBytes: 16 * GIB, networkPerformance: 'upTo10' },
            { id: 'inst-2', vcpus: 4, memoryBytes: 8 * GIB, networkPerformance: 'upTo10' }
        ];
        expect(hasComputeOverrides(req, multiStored)).toBe(false);
    });
});
/* eslint-enable no-useless-escape */
