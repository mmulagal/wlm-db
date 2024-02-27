import { faker } from '@faker-js/faker';
import {
    getDatabases,
    getDriveInfo,
    getManagedResources,
    deployDatabase,
    createDatabase,
    configureLuns,
    newDBInitialization,
    cleanUpDatabaseDeployment
} from '../../src/operations/database-hosts-operations';
import '../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../simulator/scopes/aws/fsx-scope';
import '../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../simulator/scopes/opentelemetry-scope';
import '../simulator/scopes/aws/ssm-scope';
import { ACCOUNT_ID, SECRETS } from '../../src/utils/consts';
import { createResource, deleteResource } from '../../src/lib/database/db';

SECRETS.AUTH_CLIENT_ID = `${faker.string.alphanumeric(20)}`;
SECRETS.SIGNURL_ACCESS_KEY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
SECRETS.SIGNURL_SECRET_KEY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const createDBRequest = {
    databaseName: 'tempdb8',
    dataFileConfig: {
        fileName: 'tempdb8_data.mdf',
        volumeSize: 1,
        drive: 'E',
        isExisting: true
    },
    logFileConfig: {
        fileName: 'tempdb8_log.ldf',
        volumeSize: 2,
        drive: 'F',
        isExisting: true
    }
};

const reqData = {
    accountId: 'account-13rAEYet',
    credentialsId: '2626c05d-364c-4196-bec9-0317c4d53d81',
    region: 'ap-southeast-1',
    parentJobId: '4015cc3a-b7cf-40f6-8afd-d9462fd4ef42',
    activeNodeInstanceId: 'i-0ac64c292872877c7',
    sqlServerName: 'Draculla',
    databaseName: 'tempdb9',
    dataDrivePath: 'J:\\MSSQL\\data\\tempdb9_data.mdf',
    logDrivePath: 'K:\\MSSQL\\data\\tempdb9_log.ldf',
    iGroup: 'wlmdb_sqligroup_1708791218786',
    fsxDataVolumeName: 'wlmdb_sqldata_1708948249',
    fsxLogVolumeName: 'wlmdb_sqllog_1708948249',
    fileSystemId: 'fs-0d5efc3057c4f12cb',
    sqlVMName: 'wlmdb_sqlsvm_1708791218786',
    isClustered: 'false',
    dataDrive: 'J',
    logDrive: 'K'
};

beforeAll(async () => {
    await createResource(ACCOUNT_ID, {
        resourceId: '36E53042-04E8-40C9-AE69-26E56CB0D216',
        resourceName: 'test-resource',
        resourceType: 'MSSQL',
        coRelationId: 'fs-f6082f35c1db',
        cloudProviderAccountId: 'test-aws-account',
        cloudProviderName: 'AWS',
        region: 'ap-southeast-1',
        credentialsId: 'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
        storageType: 'FSXN',
        metadata: {
            node1InstanceId: 'i-07e76a4b916548dc0',
            node2InstanceId: 'i-0880a21327284f67c'
        }
    });
});

afterAll(async () => {
    await deleteResource(ACCOUNT_ID, '36E53042-04E8-40C9-AE69-26E56CB0D216');
    await deleteResource(ACCOUNT_ID, 'fs-f6082f35c1db');
});

describe('Database host operations', () => {
    it('Get databases in a server', async () => {
        const resp = await getDatabases(ACCOUNT_ID, '36E53042-04E8-40C9-AE69-26E56CB0D216');
        expect(resp).toBeDefined();
    });
    it('Get drive info for a database host', async () => {
        const resp = await getDriveInfo(
            ACCOUNT_ID,
            '36E53042-04E8-40C9-AE69-26E56CB0D216',
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1'
        );
        expect(resp).toBeDefined();
    });

    it('Create user databases in a server', async () => {
        const resp = await deployDatabase(
            ACCOUNT_ID,
            '36E53042-04E8-40C9-AE69-26E56CB0D216',
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1',
            createDBRequest.databaseName,
            createDBRequest.dataFileConfig,
            createDBRequest.logFileConfig
        );
        expect(resp.jobId).toBeDefined();
    });

    it('Create database in a host', async () => {
        const resp = await createDatabase(
            reqData.accountId,
            reqData.credentialsId,
            reqData.region,
            reqData.parentJobId,
            reqData.activeNodeInstanceId,
            reqData.sqlServerName,
            reqData.databaseName,
            reqData.dataDrivePath,
            reqData.logDrivePath
        );

        expect(resp.Status).toBe('Complete');
    });

    it('Configure luns in a host', async () => {
        const resp = await configureLuns(
            reqData.accountId,
            reqData.credentialsId,
            reqData.region,
            reqData.parentJobId,
            reqData.activeNodeInstanceId,
            reqData.sqlServerName,
            reqData.fileSystemId,
            reqData.sqlVMName,
            1074,
            1074,
            'false',
            'false'
        );

        expect(resp.Status).toBe('Complete');
    });

    it('New DB Initialise in server', async () => {
        const resp = await newDBInitialization(
            reqData.accountId,
            reqData.credentialsId,
            reqData.region,
            reqData.parentJobId,
            reqData.activeNodeInstanceId,
            reqData.sqlServerName,
            reqData.databaseName,
            reqData.isClustered,
            reqData.dataDrive,
            reqData.logDrive,
            'true',
            'true',
            reqData.iGroup,
            reqData.fsxDataVolumeName,
            reqData.fsxLogVolumeName
        );

        expect(resp.Status).toBe('Complete');
    });

    it('Clean up DB in server', async () => {
        const resp = await cleanUpDatabaseDeployment(
            reqData.accountId,
            reqData.credentialsId,
            reqData.region,
            reqData.fileSystemId,
            reqData.sqlVMName,
            reqData.fsxDataVolumeName,
            reqData.fsxLogVolumeName,
            reqData.iGroup,
            reqData.activeNodeInstanceId,
            reqData.sqlServerName,
            reqData.parentJobId
        );

        expect(resp.Status).toBe('Complete');
    });

    it('Get drive info for a database host', async () => {
        const expected = {
            count: 1,
            items: [
                {
                    resourceId: '36E53042-04E8-40C9-AE69-26E56CB0D216',
                    instances: ['i-07e76a4b916548dc0', 'i-0880a21327284f67c']
                }
            ],
            nextToken: undefined
        };

        const resp = await getManagedResources(ACCOUNT_ID, 'f6082f35-c1db-4619-bb5c-84bcb5bf3286', 'ap-southeast-1');

        expect(resp).toEqual(expected);
    });
});
