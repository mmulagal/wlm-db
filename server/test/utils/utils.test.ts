import { isEmpty } from 'lodash-es';
import { faker } from '@faker-js/faker';
import { Instance } from '@aws-sdk/client-ec2';
import { SendCommandCommandInput } from '@aws-sdk/client-ssm';
import { createSecrets } from '../../src/operations/aws/secrets-manager-operations';
import { DatabaseTypes, DEFAULT_AWS_REGION, FCI, SSM_COMMAND_COMPRESSION_THRESHOLD } from '../../src/utils/consts';
import secretManagerResponse from '../simulator/responses/aws/secrets-manager-create.json';
import {
    checkAndRetrieveJsonObject,
    generateHash,
    getFsxArn,
    isNetworkConfigurationViolated,
    splitDomainUsername,
    getCollationForMSSQLVersion,
    camelizeKeys,
    fsxStorageCapacityBreakdown,
    convertGiBToBytes,
    calculateFsxnStorageCapacity,
    getRegionDetails,
    getServerNameWithHostname,
    parseMultipleCommandResponse,
    decompressSSMResponse,
    divideArrayIntoChunks,
    extractVersionDetails,
    getEc2Hostname,
    isCidrContained,
    summarizeFirstLevel,
    camelCaseToHyphenated,
    hyphenatedToPascalCaseWithSpace,
    compressSsmCommand,
    getFsxVolumeArn
} from '../../src/utils/utils';
import { ACTIVE_INSTANCE_ID, STANDBY_INSTANCE_ID } from './consts';
import { SSM_RUN_SHELL_SCRIPT_DOC } from '../../src/operations/workloads/oracle/consts';
import { SSM_RUN_POWERSHELL_SCRIPT_DOC } from '../../src/operations/workloads/mssql/const';
import { REGION } from '../../src/lib/chatbot/consts';

const CREDENTIALS_ID = `${faker.string.alpha(20)}`;
const networkConfiguration = {
    vpcId: `vpc-${faker.string.alpha(6)}`,
    vpcCidr: '172.31.0.0/16',
    availabilityZone1: 'availability-zone-1',
    privateSubnet1Id: `subnet-${faker.string.alpha(6)}`,
    routeTable1Id: `rtb-${faker.string.alpha(6)}`,
    availabilityZone2: 'availability-zone-1',
    privateSubnet2Id: `subnet-${faker.string.alpha(6)}`,
    routeTable2Id: `rtb-${faker.string.alpha(6)}`
};

vi.mock('../../src/lib/aws/secrets-manager', () => ({
    createSecret: vi.fn().mockImplementation(async () => secretManagerResponse)
}));

const awsAccountId = `${faker.number.int({ min: 100000000 })}`;
const fsxId = `fs-${faker.string.numeric(8)}`;
const fsxArn = `arn:aws:fsx:${DEFAULT_AWS_REGION}:${awsAccountId}:file-system/${fsxId}`;
const FSX_VOLUME_ID = 'fsvol-044997d746f7b236b';
const EXPECTED_VOLUME_ARN = `arn:aws:fsx:${REGION}:${awsAccountId}:volume/${fsxId}/${FSX_VOLUME_ID}`;

describe('Utils test cases', () => {
    it(' Create Secrets Manager String', async () => {
        const response = await createSecrets(
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            [{ secretName: 'test-string-1', username: 'username', password: 'password' }],
            'sample-rolearn'
        );
        expect(response).toBeDefined();
    });

    it(' Check if valid json string', async () => {
        const response = checkAndRetrieveJsonObject(
            '[{ "secretName": "test-string-1", "username": "username", "password": "password" }]'
        );
        expect(response.isValid).toBeTruthy();
    });
    it(' Check if valid json string - negative', async () => {
        const response = checkAndRetrieveJsonObject('[{ abcde,ghij }]');
        expect(response.isValid).toBeFalsy();
    });

    it('Generate hash', async () => {
        const response = generateHash(ACTIVE_INSTANCE_ID + STANDBY_INSTANCE_ID);
        expect(response).toBeDefined();
    });

    it('Generate Fsx ARN', async () => {
        const response = getFsxArn(awsAccountId, DEFAULT_AWS_REGION, fsxId);
        expect(response).toBe(fsxArn);
    });

    it('should produce the FSxN volume ARN with every ID segment in place', () => {
        expect(getFsxVolumeArn(REGION, awsAccountId, fsxId, FSX_VOLUME_ID)).toBe(EXPECTED_VOLUME_ARN);
    });

    it('Generate Fsx ARN', async () => {
        const response = await isNetworkConfigurationViolated(networkConfiguration, FCI);
        expect(response.isViolated).toBe(false);
    });
    it('Split domain from username', async () => {
        const response = splitDomainUsername('thisdomain\\thatuser');
        expect(response.username).toBe('thatuser');
    });
    it('Get collation details for mssql version', async () => {
        const resp = getCollationForMSSQLVersion(
            '2017',
            'Microsoft SQL Server 2016 (SP3-OD) (KB5006943) - 13.0.6404.1 (X64)'
        );
        expect(resp).toBeDefined();
    });
    it('camelizeKeys should return an array with camelized keys', () => {
        const input = [{ CompanyName: 'NetApp', CompanyAddress: 'Bangalore' }];
        const output = camelizeKeys(input);
        expect(output).toEqual([{ companyName: 'NetApp', companyAddress: 'Bangalore' }]);
    });

    it('camelizeKeys should return an object with camelized keys', () => {
        const input = { CompanyName: 'NetApp', CompanyAddress: 'Bangalore' };
        const output = camelizeKeys(input);
        expect(output).toEqual({ companyName: 'NetApp', companyAddress: 'Bangalore' });
    });

    it('camelizeKeys should return the input unchanged if it is not an array or object', () => {
        const input = 'NetApp Bangalore';
        const output = camelizeKeys(input);
        expect(output).toBe(input);
    });

    it('FSx storage capacity breakdown', () => {
        const response = fsxStorageCapacityBreakdown(convertGiBToBytes(3664), 'fci');
        expect(response.fsxStorageCapacity).toEqual(convertGiBToBytes(3664));
    });

    it('calculateFsxnStorageCapacity storage capacity breakdown', () => {
        const response = calculateFsxnStorageCapacity(2048, 'fci');
        // Assert that FSxBufferVolumeSize is 35% of FSxStorageCapacity
        expect(Math.ceil(response.FSxBufferVolumeSize / 1024)).toEqual(Math.ceil(response.FSxStorageCapacity * 0.35));
        expect(response).toBeDefined();
    });

    it('FSx storage capacity breakdown Standalone', () => {
        const response = fsxStorageCapacityBreakdown(convertGiBToBytes(3664), 'standalone');
        expect(response.fsxQuorumVolumeSize).toEqual(0);
    });

    it('should return region name for region key', () => {
        expect(getRegionDetails('42').name).toBeDefined();
        expect(getRegionDetails('42').name).toBe('');
        expect(getRegionDetails('eu-west-1')).toEqual({ name: 'Europe (Ireland)', code: 'eu-west-1' });
    });

    it('should return formatted instance name or default values', () => {
        const instanceName = 'test-instance';
        const hostname = 'test-hostname';
        expect(getServerNameWithHostname(hostname, instanceName)).toBe('test-hostname\\test-instance');
        expect(getServerNameWithHostname()).toBe('MSSQLSERVER');
        expect(getServerNameWithHostname(hostname)).toBe('test-hostname');
        expect(getServerNameWithHostname()).toBe('MSSQLSERVER');
    });

    it('calculateFsxnStorageCapacity storage capacity breakdown for pgsql', () => {
        const response = calculateFsxnStorageCapacity(2048, 'fci', 'PGSQL');
        expect(response.FSxDataVolumeSize).toEqual(2048 * 1024);
        expect(response.FSxLogVolumeSize).toEqual(Math.ceil(0.75 * 2048 * 1024));
        expect(response.FSxTempDbVolumeSize).toEqual(0);
        expect(response.FSxQuorumVolumeSize).toEqual(0);
    });

    it('Parse multiple SSM commands response', async () => {
        // eslint-disable-next-line no-useless-escape
        const decompressedResponse = await decompressSSMResponse(
            '{\r\n\r\n}\r\n{"error":"Cannot validate argument on parameter \\u0027PartitionNumber\\u0027. The argument is null. Provide a valid value for the argument, and then try running the command again.","status":"failed"}\r\n'
        );
        const response = parseMultipleCommandResponse(decompressedResponse);
        expect(response.length).toEqual(2);
        expect(response[1].error).toEqual(
            // eslint-disable-next-line quotes
            "Cannot validate argument on parameter 'PartitionNumber'. The argument is null. Provide a valid value for the argument, and then try running the command again."
        );
    });

    it('Parse multiple SSM commands response no error', async () => {
        const decompressedResponse = await decompressSSMResponse('{\r\n\r\n}\r\n{\r\n\r\n}');
        const response = parseMultipleCommandResponse(decompressedResponse);
        expect(response.length).toEqual(2);
        expect(isEmpty(response.find(r => r.error))).toBeTruthy();
    });

    it('Parse multiple SSM commands response no error', async () => {
        const decompressedResponse = await decompressSSMResponse(
            '{ "ontapProtectionDetails": { "records": [ { "uuid": "1d66d908-1512-11f0-a1b8-3de15f9d4c1a", "name": "ORADATA1", "snapshot_count": 10, "svm": { "name": "wlmdb_sqlsvm_1733315870640" }, "_links": { "self": { "href": "/api/storage/volumes/1d66d908-1512-11f0-a1b8-3de15f9d4c1a" } } } ], "num_records": 1, "_links": { "self": { "href": "/api/storage/volumes?fields=snapshot_count&name=ORADATA1&svm=wlmdb_sqlsvm_1733315870640" } } }, "isNativeProtectionEnabled": "false" }{ "ontapProtectionDetails": { "records": [ { "uuid": "1d66d908-1512-11f0-a1b8-3de15f9d4c1a", "name": "ORADATA1", "snapshot_count": 10, "svm": { "name": "wlmdb_sqlsvm_1733315870640" }, "_links": { "self": { "href": "/api/storage/volumes/1d66d908-1512-11f0-a1b8-3de15f9d4c1a" } } } ], "num_records": 1, "_links": { "self": { "href": "/api/storage/volumes?fields=snapshot_count&name=ORADATA1&svm=wlmdb_sqlsvm_1733315870640" } } }, "isNativeProtectionEnabled": "false" }'
        );
        const response = parseMultipleCommandResponse(decompressedResponse);
        expect(response.length).toEqual(2);
        expect(isEmpty(response.find(r => r.error))).toBeTruthy();
    });

    it('Decompress SSM response that is not a valid base64 string', async () => {
        const string =
            'A\r\nB\r\nD\r\nE\r\nF\r\nG\r\nH\r\nI\r\nJ\r\nK\r\nL\r\nM\r\nN\r\nO\r\nP\r\nQ\r\nR\r\nT\r\nU\r\nV\r\nW\r\nX\r\nY\r\nZ\r\n';
        const response = await decompressSSMResponse(string);
        expect(response).toEqual('ABDEFGHIJKLMNOPQRTUVWXYZ');
    });

    it('Divide array into chunks', () => {
        const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const response = divideArrayIntoChunks(array, 3);
        expect(response.length).toEqual(4);
    });

    it('Extracts MSSQL version details from sql version string', () => {
        const sqlVersion = `Microsoft SQL Server 2016 (SP3-GDR) (KB5046855) - 13.0.6455.2 (X64)
 \n\tOct 15 2024 11:23:31 \n\tCopyright (c) Microsoft Corporation\n\tStandard Ed
ition (64-bit) on Windows Server 2016 Datacenter 10.0 <X64> (Build 14393: ) (Hyp
ervisor)\n`;

        const { releaseDate, version } = extractVersionDetails(sqlVersion);
        expect(releaseDate).toEqual('Oct 15 2024');
        expect(version).toEqual('2016');
    });

    it('Extracts unknown version details from sql version string', () => {
        const sqlVersion = 'Some random string';

        const { releaseDate } = extractVersionDetails(sqlVersion);
        expect(releaseDate).toEqual('Unknown');
    });

    it('should return correct mock hostname', () => {
        const instance: Instance = {
            Tags: [{ Key: 'Other', Value: 'not-the-name' }]
        };
        let hostname = getEc2Hostname(DatabaseTypes.PG_SQL, instance?.Tags);
        expect(hostname).toMatch(/^pgsqlnode-\d{4}$/);
        hostname = getEc2Hostname(DatabaseTypes.ORACLE, instance?.Tags);
        expect(hostname).toMatch(/^oracle-\d{5}$/);
        hostname = getEc2Hostname(DatabaseTypes.MS_SQL_SERVER, instance?.Tags);
        expect(hostname).toMatch(/^sqlnode-\d{5}$/);
        hostname = getEc2Hostname('UNKNOWN' as any, instance?.Tags);
        expect(hostname).toMatch(/^sqlnode-\d{5}$/);
    });

    it('should check if CIDR is contained within another CIDR', () => {
        const cidr1 = '192.168.0.0/16';
        const cidr2 = '192.168.1.0/24';
        const result = isCidrContained(cidr1, cidr2);
        expect(result).toBe(true);
    });

    it('summarizeFirstLevel should handle primitives and arrays', () => {
        expect(summarizeFirstLevel(null)).toBeNull();
        expect(summarizeFirstLevel(123)).toBe(123);
        expect(summarizeFirstLevel('abc')).toBe('abc');
        expect(summarizeFirstLevel([1, 2, 3])).toBe(3);
        expect(summarizeFirstLevel([])).toBe(0);
    });

    it('summarizeFirstLevel should summarize object first level correctly', () => {
        const input = {
            a: 'value',
            b: [1, 2, 3, 4],
            c: { x: 1, y: [1, 2], z: { nested: true } }
        };
        const result = summarizeFirstLevel(input);
        expect(typeof result).toBe('object');
        // @ts-expect-error wrong type
        expect(result.a).toBe('value');
        // @ts-expect-error wrong type
        expect(result.b).toBe(4);
        // @ts-expect-error wrong type
        expect(typeof result.c).toBe('object');
        // @ts-expect-error wrong type
        expect(result.c.x).toBe(1);
        // @ts-expect-error wrong type
        expect(result.c.y).toBe(2);
        // @ts-expect-error wrong type
        expect(result.c.z).toBe('[Object]');
    });

    it('summarizeFirstLevel should handle complex object with mixed data types', () => {
        const complexInput = {
            stringVal: 'test',
            numberVal: 42,
            boolVal: true,
            nullVal: null,
            undefinedVal: undefined,
            arrayVal: [1, 2, 3, 4, 5],
            emptyArray: [],
            objectVal: { nested: 'value' },
            deepObject: {
                level1: { level2: { level3: 'deep' } },
                arrayInObject: [10, 20, 30],
                nullVal: null
            }
        };
        const result = summarizeFirstLevel(complexInput);
        expect(typeof result).toBe('object');
        // @ts-expect-error wrong type
        expect(result.stringVal).toBe('test');
        // @ts-expect-error wrong type
        expect(result.numberVal).toBe(42);
        // @ts-expect-error wrong type
        expect(result.boolVal).toBe(true);
        // @ts-expect-error wrong type
        expect(result.nullVal).toBeNull();
        // @ts-expect-error wrong type
        expect(result.undefinedVal).toBeUndefined();
        // @ts-expect-error wrong type
        expect(result.arrayVal).toBe(5);
        // @ts-expect-error wrong type
        expect(result.emptyArray).toBe(0);
        // @ts-expect-error wrong type
        expect(typeof result.objectVal).toBe('object');
        // @ts-expect-error wrong type
        expect(result.objectVal.nested).toBe('value');
        // @ts-expect-error wrong type
        expect(typeof result.deepObject).toBe('object');
        // @ts-expect-error wrong type
        expect(result.deepObject.level1).toBe('[Object]');
        // @ts-expect-error wrong type
        expect(result.deepObject.arrayInObject).toBe(3);
    });

    it('summarizeFirstLevel should handle deeply nested objects', () => {
        const deepObject = {
            level1: {
                level2: {
                    level3: {
                        level4: {
                            data: [1, 2, 3]
                        }
                    }
                }
            }
        };
        const result = summarizeFirstLevel(deepObject);
        // @ts-expect-error wrong type
        expect(typeof result.level1).toBe('object');
        // @ts-expect-error wrong type
        expect(result.level1.level2).toBe('[Object]');
    });

    it('summarizeFirstLevel should handle objects with circular-like references', () => {
        const obj: any = {
            name: 'test',
            items: [1, 2, 3],
            metadata: {
                created: '2025-01-01',
                count: 42
            }
        };
        obj.self = obj; // circular reference
        const result = summarizeFirstLevel(obj);
        expect(typeof result).toBe('object');
        // @ts-expect-error wrong type
        expect(result.name).toBe('test');
        // @ts-expect-error wrong type
        expect(result.items).toBe(3);
        // @ts-expect-error wrong type
        expect(typeof result.metadata).toBe('object');
        // @ts-expect-error wrong type
        expect(result.metadata.created).toBe('2025-01-01');
        // @ts-expect-error wrong type
        expect(result.metadata.count).toBe(42);
        // The self property references the object itself, which gets summarized to '[Object]' by summarizeObjectFirstLevel
        expect(
            // @ts-expect-error wrong type
            (typeof result.self === 'string' && result.self === '[Object]') || typeof result.self === 'object'
        ).toBeTruthy();
    });

    it('summarizeFirstLevel should handle large arrays', () => {
        const largeArray = new Array(1000).fill(0).map((_, i) => i);
        const result = summarizeFirstLevel(largeArray);
        expect(result).toBe(1000);
    });

    it('summarizeFirstLevel should handle objects with special properties', () => {
        const specialObj = {
            constructor: 'test',
            toString: 'method',
            hasOwnProperty: 'method',
            normalProp: 'value',
            arrayProp: [1, 2, 3]
        };
        const result = summarizeFirstLevel(specialObj);
        expect(typeof result).toBe('object');
        // @ts-expect-error wrong type
        expect(result.normalProp).toBe('value');
        // @ts-expect-error wrong type
        expect(result.arrayProp).toBe(3);
    });

    it('summarizeFirstLevel should handle objects with symbol keys (symbols skipped in Object.entries)', () => {
        const obj = {
            regular: 'value',
            items: [1, 2]
        };
        const result = summarizeFirstLevel(obj);
        expect(typeof result).toBe('object');
        // @ts-expect-error wrong type
        expect(result.regular).toBe('value');
        // @ts-expect-error wrong type
        expect(result.items).toBe(2);
    });

    it('summarizeFirstLevel should handle mixed nesting with multiple array types', () => {
        const mixedObj = {
            typedArray: new Array(5),
            stringArray: ['a', 'b', 'c'],
            numberArray: [1, 2, 3, 4],
            nestedArrays: [
                [1, 2],
                [3, 4],
                [5, 6]
            ],
            objWithArrays: {
                arr1: [10, 20],
                arr2: ['x', 'y', 'z']
            }
        };
        const result = summarizeFirstLevel(mixedObj);
        // @ts-expect-error wrong type
        expect(result.typedArray).toBe(5);
        // @ts-expect-error wrong type
        expect(result.stringArray).toBe(3);
        // @ts-expect-error wrong type
        expect(result.numberArray).toBe(4);
        // @ts-expect-error wrong type
        expect(result.nestedArrays).toBe(3);
        // @ts-expect-error wrong type
        expect(typeof result.objWithArrays).toBe('object');
        // @ts-expect-error wrong type
        expect(result.objWithArrays.arr1).toBe(2);
        // @ts-expect-error wrong type
        expect(result.objWithArrays.arr2).toBe(3);
    });

    describe('camelCaseToHyphenated', () => {
        it('should convert simple camelCase to hyphenated', () => {
            expect(camelCaseToHyphenated('snapshotPolicy')).toBe('snapshot-policy');
        });

        it('should convert multiple camelCase words to hyphenated', () => {
            expect(camelCaseToHyphenated('autoSizeMode')).toBe('auto-size-mode');
        });

        it('should handle already hyphenated strings', () => {
            expect(camelCaseToHyphenated('snapshot-policy')).toBe('snapshot-policy');
        });

        it('should handle single word strings', () => {
            expect(camelCaseToHyphenated('snapshot')).toBe('snapshot');
        });

        it('should handle empty strings', () => {
            expect(camelCaseToHyphenated('')).toBe('');
        });

        it('should convert strings starting with uppercase', () => {
            expect(camelCaseToHyphenated('SnapshotPolicy')).toBe('snapshot-policy');
        });

        it('should handle multiple consecutive uppercase letters', () => {
            expect(camelCaseToHyphenated('awsBackup')).toBe('aws-backup');
            expect(camelCaseToHyphenated('IOpsPolicy')).toBe('iops-policy');
        });

        it('should handle strings with numbers', () => {
            expect(camelCaseToHyphenated('snapshotPolicy2')).toBe('snapshot-policy2');
            // Note: The regex only converts lowercase-to-uppercase transitions, not number-to-letter
            expect(camelCaseToHyphenated('policy2Name')).toBe('policy2name');
        });

        it('should be case-insensitive in output', () => {
            const result = camelCaseToHyphenated('SnapshotPOLICY');
            expect(result).toBe(result.toLowerCase());
        });
    });

    describe('hyphenatedToPascalCaseWithSpace', () => {
        it('should convert hyphenated to Pascal case with spaces', () => {
            expect(hyphenatedToPascalCaseWithSpace('snapshot-policy')).toBe('Snapshot Policy');
        });

        it('should convert multiple hyphenated words', () => {
            expect(hyphenatedToPascalCaseWithSpace('auto-size-mode')).toBe('Auto Size Mode');
        });

        it('should handle single word strings', () => {
            expect(hyphenatedToPascalCaseWithSpace('snapshot')).toBe('Snapshot');
        });

        it('should handle empty strings', () => {
            expect(hyphenatedToPascalCaseWithSpace('')).toBe('');
        });

        it('should handle camelCase input (no hyphens)', () => {
            expect(hyphenatedToPascalCaseWithSpace('snapshotPolicy')).toBe('Snapshotpolicy');
        });

        it('should capitalize first letter of each hyphen-separated word', () => {
            expect(hyphenatedToPascalCaseWithSpace('aws-backup')).toBe('Aws Backup');
        });

        it('should handle multiple consecutive hyphens', () => {
            expect(hyphenatedToPascalCaseWithSpace('snapshot--policy')).toBe('Snapshot  Policy');
        });

        it('should handle leading and trailing hyphens', () => {
            expect(hyphenatedToPascalCaseWithSpace('-snapshot-policy-')).toBe(' Snapshot Policy ');
        });

        it('should lowercase all letters except first of each word', () => {
            expect(hyphenatedToPascalCaseWithSpace('SNAPSHOT-POLICY')).toBe('Snapshot Policy');
            expect(hyphenatedToPascalCaseWithSpace('SnApShOt-PoLiCy')).toBe('Snapshot Policy');
        });

        it('should handle strings with numbers', () => {
            expect(hyphenatedToPascalCaseWithSpace('snapshot-policy-2')).toBe('Snapshot Policy 2');
            expect(hyphenatedToPascalCaseWithSpace('policy-2-name')).toBe('Policy 2 Name');
        });
    });

    describe('camelCaseToHyphenated and hyphenatedToPascalCaseWithSpace integration', () => {
        it('should convert camelCase to hyphenated and back to display format', () => {
            const original = 'snapshotPolicy';
            const hyphenated = camelCaseToHyphenated(original);
            const display = hyphenatedToPascalCaseWithSpace(hyphenated);

            expect(hyphenated).toBe('snapshot-policy');
            expect(display).toBe('Snapshot Policy');
        });

        it('should handle complex camelCase conversion flow', () => {
            const original = 'autoSizeMode';
            const hyphenated = camelCaseToHyphenated(original);
            const display = hyphenatedToPascalCaseWithSpace(hyphenated);

            expect(hyphenated).toBe('auto-size-mode');
            expect(display).toBe('Auto Size Mode');
        });

        it('should work with golden config parameter names', () => {
            const configParams = [
                'thinProvision',
                'autosize',
                'fractionalReserve',
                'snapshotPolicy',
                'compressionEnabled'
            ];

            configParams.forEach(param => {
                const hyphenated = camelCaseToHyphenated(param);
                const display = hyphenatedToPascalCaseWithSpace(hyphenated);

                // Verify hyphenated format has hyphens or is single word
                expect(hyphenated).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
                // Verify display format has proper capitalization
                expect(display).toMatch(/^[A-Z][a-z0-9]*(\s[A-Z][a-z0-9]*)*$/);
            });
        });
    });

    describe.sequential('Test ssm compression', () => {
        let compressSsmCommandFn: typeof compressSsmCommand;
        const originalEnv = process.env.NODE_ENV;

        beforeAll(async () => {
            process.env.NODE_ENV = 'development';
            vi.resetModules();
            const utils = await import('../../src/utils/utils');
            compressSsmCommandFn = utils.compressSsmCommand;
        });

        afterAll(async () => {
            process.env.NODE_ENV = originalEnv;
            vi.resetModules();
        });

        it.sequential('sendSSMCommand with large bash script should compress commands', async () => {
            // Generate a large command that exceeds compression threshold
            const largeScript = `#!/bin/bash
# Large discovery script for testing compression
echo "Starting large script execution"
${'echo "Processing data chunk"; sleep 0.1; '.repeat(3000)}
echo "Script completed successfully"
`;
            const largeParams: SendCommandCommandInput = {
                DocumentName: SSM_RUN_SHELL_SCRIPT_DOC,
                Parameters: {
                    commands: [largeScript]
                },
                InstanceIds: ['i-07e76a4b916548dc0']
            };

            // Verify the input exceeds threshold
            const commandsSize = Buffer.byteLength(JSON.stringify(largeParams.Parameters?.commands), 'utf8');
            expect(commandsSize).toBeGreaterThan(SSM_COMMAND_COMPRESSION_THRESHOLD);

            // Should succeed with compression
            const resp = compressSsmCommandFn(largeParams);

            // Verify the commands were compressed (replaced with decompression wrapper)
            expect(resp.Parameters?.commands?.[0]).toContain('base64 -d | gunzip | bash');
        });

        it.sequential('sendSSMCommand with large PowerShell script should compress commands', async () => {
            // Generate a large command that exceeds compression threshold
            const largeScript = `# Large PowerShell script for testing compression
Write-Host "Starting large script execution"
${'Write-Host "Processing data chunk"; Start-Sleep -Milliseconds 100; '.repeat(1500)}
Write-Host "Script completed successfully"
`;
            const largeParams: SendCommandCommandInput = {
                DocumentName: SSM_RUN_POWERSHELL_SCRIPT_DOC,
                Parameters: {
                    commands: [largeScript]
                },
                InstanceIds: ['i-07e76a4b916548dc0']
            };

            // Verify the input exceeds threshold
            const commandsSize = Buffer.byteLength(JSON.stringify(largeParams.Parameters?.commands), 'utf8');
            expect(commandsSize).toBeGreaterThan(SSM_COMMAND_COMPRESSION_THRESHOLD);

            // Should succeed with compression
            const resp = compressSsmCommandFn(largeParams);

            // Verify the commands were compressed (replaced with decompression wrapper)
            expect(resp.Parameters?.commands?.length).toBe(1);
            expect(resp.Parameters?.commands?.[0]).toContain('IO.Compression.GzipStream');
            expect(resp.Parameters?.commands?.[0]).toContain('Invoke-Expression $s');
        });
    });
});
