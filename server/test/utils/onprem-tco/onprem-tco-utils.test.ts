/* eslint-disable no-useless-escape */
import {
    parseCpuUtilization,
    parseMemoryUtilization,
    parseLicenceUsageDetails,
    parseSqlVersion,
    parseIops,
    parseStorageDetailsByDb,
    convertToDate
} from '../../../src/utils/onprem-tco/onprem-tco-utils';

describe('onprem-tco-utils', () => {
    it('should parse valid number string', () => {
        expect(parseCpuUtilization('1')).toBe(1);
    });

    it('should parse valid JSON number', () => {
        expect(parseCpuUtilization('{"value": 42}')).toBeUndefined();
    });

    it('invalid CPU utilization', () => {
        expect(
            parseCpuUtilization(
                '{\r\n    "error":  "Error running query \\u0027cpuUtilization\\u0027 on instance FCI12"\r\n}'
            )
        ).toBeUndefined();
    });

    it('should parse valid memory utilization array', () => {
        const input = '[{"used":470822912,"total":8588910592,"remaining":8118087680,"percentUsed":5}]';
        expect(parseMemoryUtilization(input)).toEqual([
            { used: 470822912, total: 8588910592, remaining: 8118087680, percentUsed: 5 }
        ]);
    });

    it('invalid memory utilization', () => {
        expect(
            parseMemoryUtilization(
                '{\r\n    "error":  "Error running query \\u0027memUtilization\\u0027 on instance FCI12"\r\n}'
            )
        ).toBeUndefined();
    });

    it('should parse valid licence usage details array', () => {
        const input =
            '[{"IsUsingFeature":0,"FeatureDescription":"SQL Server has \u003e 128 GB Memory"},{"IsUsingFeature":0,"FeatureDescription":"SQL Server has \u003e 48 vCPU"},{"IsUsingFeature":0,"FeatureDescription":"Tempdb metadata memory-optimized is enabled"},{"IsUsingFeature":0,"FeatureDescription":"User Databases are using Enterprise Level Features"},{"IsUsingFeature":0,"FeatureDescription":"You are using asynchronous mirroring"},{"IsUsingFeature":0,"FeatureDescription":"You are using peer-to-peer replication"},{"IsUsingFeature":0,"FeatureDescription":"You are using R or Python extensions"},{"IsUsingFeature":0,"FeatureDescription":"You are using Resource Governor"},{"IsUsingFeature":0,"FeatureDescription":"You have Asynchronous commit Replicas"},{"IsUsingFeature":0,"FeatureDescription":"You have read-only Replicas"}]                                                                                                                                                                                                                             ';

        const licenseDetails = parseLicenceUsageDetails(input);
        expect(licenseDetails?.length).toBe(10);
    });

    it('invalid license usage details', () => {
        expect(
            parseLicenceUsageDetails(
                '{\r\n    "error":  "Error running query \\u0027licenceUsageDetails\\u0027 on instance FCI12"\r\n}'
            )
        ).toBeUndefined();
    });

    it('should join array of strings', () => {
        const response = parseSqlVersion([
            'Microsoft SQL Server 2022 (RTM) - 16.0.1000.6 (X64) ',
            '\tOct  8 2022 05:58:25 ',
            '\tCopyright (C) 2022 Microsoft Corporation',
            '\tEnterprise Evaluation Edition (64-bit) on Windows Server 2022 Standard 10.0 \u003cX64\u003e (Build 20348: ) (Hypervisor)',
            ''
        ]);
        expect(response?.includes('nterprise')).toBeDefined();
    });

    it('invalid sql version', () => {
        expect(
            parseSqlVersion('{\r\n    "error":  "Error running query \\u0027sqlVersion\\u0027 on instance FCI12"\r\n}')
        ).toBeUndefined();
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
        expect(
            parseIops('{\r\n    "error":  "Error running query \\u0027iops\\u0027 on instance FCI12"\r\n}')
        ).toBeUndefined();
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
        expect(
            parseStorageDetailsByDb(
                '{\r\n    "error":  "Error running query \\u0027iops\\u0027 on instance FCI12"\r\n}'
            )
        ).toBeUndefined();
    });

    it('should convert valid date string to Date object', () => {
        const dateString = '20230101123000';
        const expectedDate = new Date(2023, 0, 1, 12, 30, 0);
        expect(convertToDate(dateString)).toEqual(expectedDate);
    });
});
/* eslint-enable no-useless-escape */
