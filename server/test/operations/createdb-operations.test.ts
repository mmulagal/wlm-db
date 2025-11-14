import {
    getDriveInfo,
    deployDatabase,
    createDatabase,
    configureLuns,
    newDBInitialization,
    cleanUpDatabaseDeployment,
    getCollationDetails
} from '../../src/operations/createdb-operations';
import { ACCOUNT_ID, DEFAULT_INSTANCE_NAME, DEFAULT_MSSQL_INSTANCE_NAME } from '../../src/utils/consts';
import { createResource, deleteResource, upsertDatabaseInstance } from '../../src/lib/database/db';
import createDbResponse from '../simulator/responses/workload/createdb-response.json';

const createDBRequest = {
    databaseName: 'tempdb8',
    dataFileConfig: {
        fileName: 'tempdb8_data.mdf',
        volumeSize: 1,
        drive: 'E',
        isExisting: true,
        isVirtualMount: false
    },
    logFileConfig: {
        fileName: 'tempdb8_log.ldf',
        volumeSize: 2,
        drive: 'F',
        isExisting: true,
        isVirtualMount: false
    }
};

const reqData = {
    accountId: 'account-13rAEYet',
    resourceId: '36E53042-04E8-40C9-AE69-26E56CB0D216',
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
    logDrive: 'K',
    dataSerial: 'lWB2/$WRmB4k',
    logSerial: 'lWB2/$WRmB4l',
    serverNameWithHostName: 'test-resourceName\\test-instance'
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
            node2InstanceId: 'i-0880a21327284f67c',
            sqlDeploymentType: 'FCI'
        }
    });

    await upsertDatabaseInstance(ACCOUNT_ID, {
        credentialsId: 'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
        region: 'ap-southeast-1',
        resourceId: '36E53042-04E8-40C9-AE69-26E56CB0D216',
        databaseInstanceId: 'D5A2D0E6-0AF2-4228-97E7-B627ACEE10E8',
        databaseInstanceName: 'MSSQLSERVER',
        isDefault: true,
        source: 'deployment',
        sqlDeploymentType: 'FCI',
        fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
        fsxnIds: 'fs-0f53fbecdd3d85fb2',
        databaseType: '' // Add the missing property 'databaseType'
    });
});

afterAll(async () => {
    await deleteResource(ACCOUNT_ID, '36E53042-04E8-40C9-AE69-26E56CB0D216');
    await deleteResource(ACCOUNT_ID, 'fs-f6082f35c1db');
});

describe('Create database operations', () => {
    it('Get drive info for a database instance', async () => {
        const resp = await getDriveInfo(
            ACCOUNT_ID,
            '36E53042-04E8-40C9-AE69-26E56CB0D216',
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1',
            false,
            undefined,
            'D5A2D0E6-0AF2-4228-97E7-B627ACEE10E8'
        );
        expect(resp).toEqual(createDbResponse.getInstanceLevelDriveInfo);
    });

    it('Create user databases in a server', async () => {
        const resp = await deployDatabase(
            ACCOUNT_ID,
            '36E53042-04E8-40C9-AE69-26E56CB0D216',
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1',
            createDBRequest.databaseName,
            createDBRequest.dataFileConfig,
            createDBRequest.logFileConfig,
            'SQL_Latin1_General_CP1_CI_AS'
        );
        expect(resp.jobId).toBeDefined();
    });

    it('Create database in a host', async () => {
        const resp = await createDatabase(
            reqData.accountId,
            reqData.credentialsId,
            reqData.resourceId,
            reqData.region,
            reqData.parentJobId,
            reqData.activeNodeInstanceId,
            reqData.sqlServerName,
            reqData.databaseName,
            reqData.dataDrivePath,
            reqData.logDrivePath,
            'SQL_Latin1_General_CP1_CI_AS',
            { name: DEFAULT_INSTANCE_NAME, executableName: DEFAULT_MSSQL_INSTANCE_NAME, sqlAuthEnabled: false },
            reqData.serverNameWithHostName
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
            'false',
            reqData.serverNameWithHostName
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
            reqData.fsxLogVolumeName,
            reqData.dataSerial,
            reqData.logSerial,
            'false',
            'MSSQLSERVER',
            'true',
            reqData.serverNameWithHostName
        );

        expect(resp.Status).toBe('Complete');
    });

    it('Clean up DB in server', async () => {
        const resp = await cleanUpDatabaseDeployment(
            reqData.accountId,
            reqData.credentialsId,
            reqData.resourceId,
            reqData.region,
            reqData.fileSystemId,
            reqData.sqlVMName,
            reqData.fsxDataVolumeName,
            reqData.fsxLogVolumeName,
            reqData.iGroup,
            reqData.activeNodeInstanceId,
            reqData.sqlServerName,
            reqData.parentJobId,
            reqData.databaseName,
            reqData.isClustered,
            reqData.serverNameWithHostName,
            'MSSQLSERVER',
            'true'
        );

        expect(resp.Status).toBe('Complete');
    });

    it('Get collation details for a database host', async () => {
        const resp = await getCollationDetails(
            ACCOUNT_ID,
            '36E53042-04E8-40C9-AE69-26E56CB0D216',
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1'
        );
        expect(resp).toBeDefined();
    });
});
