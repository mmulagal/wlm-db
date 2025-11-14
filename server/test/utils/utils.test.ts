import { isEmpty } from 'lodash-es';
import { faker } from '@faker-js/faker';
import { Instance } from '@aws-sdk/client-ec2';
import { createSecrets } from '../../src/operations/aws/secrets-manager-operations';
import { DatabaseTypes, DEFAULT_AWS_REGION, FCI } from '../../src/utils/consts';
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
    isCidrContained
} from '../../src/utils/utils';
import { ACTIVE_INSTANCE_ID, STANDBY_INSTANCE_ID } from './consts';

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
});
