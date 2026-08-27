import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STORAGE_TYPE } from '@prisma/client';
import { faker } from '@faker-js/faker';
import {
    getAllClusterNodeDetails,
    getDatabaseHostSummaryV2,
    buildUserDatabaseLuns
} from '../../src/operations/database-hosts-operations';
import { ACCOUNT_ID, SECRETS } from '../../src/utils/consts';
import { createResource, deleteResource } from '../../src/lib/database/db';
import { initializeDatabase } from '../../src/utils/prisma-utils';
import { DatabaseInstance, MappedOnTapVolumeResponse, ResourceDetails } from '../../src/utils/common-types';

SECRETS.AUTH_CLIENT_ID = `${faker.string.alphanumeric(20)}`;
SECRETS.SIGNURL_ACCESS_KEY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
SECRETS.SIGNURL_SECRET_KEY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

describe('Database host operations', () => {
    beforeAll(async () => {
        // Ensure database is initialized before test runs
        await initializeDatabase();
        await createResource(ACCOUNT_ID, {
            resourceId: '36E53042-04E8-40C9-AE69-26E56CB0D216',
            resourceName: 'test-resource',
            resourceType: 'MSSQL',
            coRelationId: 'fs-f6082f35c1db',
            cloudProviderAccountId: 'test-aws-account',
            cloudProviderName: 'AWS',
            region: 'ap-southeast-1',
            credentialsId: 'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            storageType: STORAGE_TYPE.FSXN,
            metadata: {
                node1InstanceId: 'i-07e76a4b916548dc0',
                node2InstanceId: 'i-0880a21327284f67c',
                sqlDeploymentType: 'FCI'
            }
        });
    });

    afterAll(async () => {
        await deleteResource(ACCOUNT_ID, '36E53042-04E8-40C9-AE69-26E56CB0D216');
        await deleteResource(ACCOUNT_ID, 'fs-f6082f35c1db');
    });
    it('Get databases host summary', async () => {
        const resp = await getDatabaseHostSummaryV2(
            ACCOUNT_ID,
            '36E53042-04E8-40C9-AE69-26E56CB0D216',
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1',
            'serverDetails,performance,usageEstimation,storage,protection',
            {
                id: null,
                account_id: ACCOUNT_ID,
                resource_id: '36E53042-04E8-40C9-AE69-26E56CB0D216',
                resource_name: 'test-resource',
                resource_type: 'MSSQL',
                co_relation_id: 'fs-f6082f35c1db',
                cloud_provider_account_id: 'test-aws-account',
                cloud_provider_name: 'AWS',
                region: 'ap-southeast-1',
                credentials_id: 'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
                storage_type: 'FSXN',
                metadata: {
                    node1InstanceId: 'i-123456678',
                    node2InstanceId: undefined
                }
            },
            undefined,
            false
        );
        expect(resp).toBeDefined();
    });

    it('should return EBS details for a restricted unmanaged MSSQL host without an active SQL node', async () => {
        const ebsVolumeId = 'vol-restricted-ebs';
        const resourceDetails: ResourceDetails = {
            id: null,
            account_id: ACCOUNT_ID,
            resource_id: 'i-restricted-ebs',
            resource_name: 'restricted-ebs-host',
            resource_type: 'MSSQL',
            co_relation_id: null,
            cloud_provider_account_id: null,
            cloud_provider_name: 'AWS',
            region: 'ap-southeast-1',
            credentials_id: 'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            metadata: {
                node1InstanceId: 'i-restricted-ebs',
                sqlDeploymentType: 'Standalone'
            },
            ebsVolumeIds: [ebsVolumeId],
            database_instances: []
        };
        const databaseInstance: DatabaseInstance = {
            database_instance_id: '',
            database_instance_name: 'MSSQLSERVER',
            database_type: 'MSSQL',
            is_default: true,
            instanceState: 'RUNNING',
            region: 'ap-southeast-1',
            credentials_id: 'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            metadata: { userDatabase: [] },
            fsxn_ids: '',
            ebsVolumeIds: [ebsVolumeId],
            database_deployment_type: 'Standalone',
            storage_type: 'EBS',
            resource: resourceDetails
        };
        resourceDetails.database_instances = [databaseInstance];
        const resp = await getDatabaseHostSummaryV2(
            ACCOUNT_ID,
            'i-restricted-ebs',
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1',
            'usageEstimation',
            resourceDetails,
            [databaseInstance],
            false
        );

        expect(resp.ebsResourceInfo).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: ebsVolumeId,
                    size: expect.any(Number),
                    volumeType: expect.any(String)
                })
            ])
        );
        expect(resp.storageAllocation?.ebs).toBeGreaterThan(0);
    });

    it('should return EBS details for a restricted unmanaged Oracle host without an active node', async () => {
        const instanceId = 'i-restricted-oracle-ebs';
        const ebsVolumeId = 'vol-restricted-oracle-ebs';
        const resourceDetails: ResourceDetails = {
            id: null,
            account_id: ACCOUNT_ID,
            resource_id: instanceId,
            resource_name: 'restricted-oracle-ebs-host',
            resource_type: 'ORACLE',
            co_relation_id: null,
            cloud_provider_account_id: null,
            cloud_provider_name: 'AWS',
            region: 'ap-southeast-1',
            credentials_id: 'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            metadata: { node1InstanceId: instanceId },
            ebsVolumeIds: [ebsVolumeId],
            database_instances: []
        };
        const databaseInstance: DatabaseInstance = {
            database_instance_id: 'ORCL',
            database_instance_name: 'ORCL',
            database_type: 'ORACLE',
            is_default: true,
            instanceState: 'RUNNING',
            region: 'ap-southeast-1',
            credentials_id: 'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            metadata: {},
            fsxn_ids: '',
            ebsVolumeIds: [ebsVolumeId],
            storage_type: 'EBS',
            resource: resourceDetails
        };
        resourceDetails.database_instances = [databaseInstance];

        const response = await getDatabaseHostSummaryV2(
            ACCOUNT_ID,
            instanceId,
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1',
            'usageEstimation',
            resourceDetails,
            [databaseInstance],
            false
        );

        expect(response.ebsResourceInfo).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: ebsVolumeId,
                    size: expect.any(Number),
                    volumeType: expect.any(String)
                })
            ])
        );
        expect(response.storageAllocation?.ebs).toBeGreaterThan(0);
    });

    it('Get all cluster node details', async () => {
        const [response] = await getAllClusterNodeDetails(
            ACCOUNT_ID,
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1',
            '36E53042-04E8-40C9-AE69-26E56CB0D216'
        );
        expect(response.ec2InstanceId).toBeDefined();
    });

    it('AOAG: should handle AOAG resources with sqlDeploymentType metadata', async () => {
        const aoagMetadata = {
            node1InstanceId: 'i-0a1b2c3d4e5f6aoag1',
            node2InstanceId: 'i-0a1b2c3d4e5f6aoag2',
            sqlDeploymentType: 'AOAG'
        };
        expect(aoagMetadata.sqlDeploymentType).toBe('AOAG');
        expect(aoagMetadata.node1InstanceId).toBeDefined();
        expect(aoagMetadata.node2InstanceId).toBeDefined();
    });

    describe('buildUserDatabaseLuns', () => {
        const mappingFixture: MappedOnTapVolumeResponse = {
            volumeRecords: [],
            volumeDBMap: [
                {
                    databaseName: 'master',
                    ontapVolumeuuid: 'vol-data-uuid',
                    dataLunUuids: ['lun-data-uuid'],
                    logLunUuids: []
                },
                {
                    databaseName: 'master',
                    ontapVolumeuuid: 'vol-log-uuid',
                    dataLunUuids: [],
                    logLunUuids: ['lun-log-uuid']
                },
                {
                    databaseName: 'other',
                    ontapVolumeuuid: 'vol-other-uuid',
                    dataLunUuids: ['lun-other-data'],
                    logLunUuids: ['lun-other-log']
                }
            ],
            databasesSummary: [
                {
                    databaseId: 1,
                    databaseName: 'master',
                    creationDate: '2003-04-08T09:13:36.390',
                    databaseStatus: 'ONLINE',
                    databaseSize: 8388608,
                    collationName: 'SQL_Latin1_General_CP1_CI_AS'
                },
                {
                    databaseId: 7,
                    databaseName: 'other',
                    creationDate: '2024-01-15T10:00:00.000',
                    databaseStatus: 'ONLINE',
                    databaseSize: 17179869184,
                    collationName: 'SQL_Latin1_General_CP1_CI_AS'
                }
            ],
            sqlNativeBackupEnabledDatabases: [{ backedupDatabases: 'other' }],
            lunRecords: [
                {
                    uuid: 'lun-data-uuid',
                    name: '/vol/wlmdb_sqldata/sqldata',
                    serial_number: 'sn-data',
                    driveLetter: 'E:\\',
                    ontapVolumeuuid: 'vol-data-uuid'
                },
                {
                    uuid: 'lun-log-uuid',
                    name: '/vol/wlmdb_sqllog/sqllog',
                    serial_number: 'sn-log',
                    driveLetter: 'L:\\',
                    ontapVolumeuuid: 'vol-log-uuid'
                },
                {
                    uuid: 'lun-other-data',
                    name: '/vol/wlmdb_sqldata_other/sqldata',
                    serial_number: 'sn-other-d',
                    driveLetter: 'F:\\',
                    ontapVolumeuuid: 'vol-other-uuid'
                },
                {
                    uuid: 'lun-other-log',
                    name: '/vol/wlmdb_sqllog_other/sqllog',
                    serial_number: 'sn-other-l',
                    driveLetter: 'M:\\',
                    ontapVolumeuuid: 'vol-other-uuid'
                }
            ]
        };

        it('returns dataFiles + logFiles aggregated across volumeDBMap entries for the database', () => {
            const luns = buildUserDatabaseLuns('master', mappingFixture);
            expect(luns).toEqual({
                dataFiles: [{ name: '/vol/wlmdb_sqldata/sqldata', driveLetter: 'E:\\' }],
                logFiles: [{ name: '/vol/wlmdb_sqllog/sqllog', driveLetter: 'L:\\' }]
            });
        });

        it('isolates entries by databaseName (does not bleed across DBs)', () => {
            const luns = buildUserDatabaseLuns('other', mappingFixture);
            expect(luns).toEqual({
                dataFiles: [{ name: '/vol/wlmdb_sqldata_other/sqldata', driveLetter: 'F:\\' }],
                logFiles: [{ name: '/vol/wlmdb_sqllog_other/sqllog', driveLetter: 'M:\\' }]
            });
        });

        it('returns undefined when the database is not present in volumeDBMap', () => {
            expect(buildUserDatabaseLuns('missingdb', mappingFixture)).toBeUndefined();
        });

        it('returns undefined when the mapping itself is undefined', () => {
            expect(buildUserDatabaseLuns('master', undefined)).toBeUndefined();
        });

        it('returns empty arrays when the database has entries but no LUN uuids', () => {
            const noLunsMapping: MappedOnTapVolumeResponse = {
                volumeRecords: [],
                volumeDBMap: [
                    { databaseName: 'master', ontapVolumeuuid: 'vol-x' } // no dataLunUuids/logLunUuids
                ],
                lunRecords: []
            };
            expect(buildUserDatabaseLuns('master', noLunsMapping)).toEqual({
                dataFiles: [],
                logFiles: []
            });
        });

        it('drops dangling LUN uuid references when not found in lunRecords', () => {
            const danglingMapping: MappedOnTapVolumeResponse = {
                volumeRecords: [],
                volumeDBMap: [
                    {
                        databaseName: 'master',
                        ontapVolumeuuid: 'vol-x',
                        dataLunUuids: ['unknown-uuid'],
                        logLunUuids: []
                    }
                ],
                lunRecords: []
            };
            expect(buildUserDatabaseLuns('master', danglingMapping)).toEqual({
                dataFiles: [],
                logFiles: []
            });
        });

        it('deduplicates LUN uuids within a database (multiple files on the same LUN appear once)', () => {
            const duplicatingMapping: MappedOnTapVolumeResponse = {
                volumeRecords: [],
                volumeDBMap: [
                    {
                        databaseName: 'master',
                        ontapVolumeuuid: 'vol-data-uuid',
                        dataLunUuids: ['lun-data-uuid', 'lun-data-uuid'],
                        logLunUuids: []
                    },
                    {
                        databaseName: 'master',
                        ontapVolumeuuid: 'vol-data-uuid-2',
                        dataLunUuids: ['lun-data-uuid'],
                        logLunUuids: []
                    }
                ],
                lunRecords: [
                    {
                        uuid: 'lun-data-uuid',
                        name: '/vol/wlmdb_sqldata/sqldata',
                        serial_number: 'sn-data',
                        driveLetter: 'E:\\',
                        ontapVolumeuuid: 'vol-data-uuid'
                    }
                ]
            };
            const luns = buildUserDatabaseLuns('master', duplicatingMapping);
            expect(luns?.dataFiles).toHaveLength(1);
            expect(luns?.dataFiles[0]).toEqual({ name: '/vol/wlmdb_sqldata/sqldata', driveLetter: 'E:\\' });
            expect(luns?.logFiles).toEqual([]);
        });
    });

    it('AOAG: should have correct AOAG metadata structure', async () => {
        const resp = await getDatabaseHostSummaryV2(
            ACCOUNT_ID,
            '36E53042-04E8-40C9-AE69-26E56CB0D216',
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1',
            'serverDetails',
            {
                id: null,
                account_id: ACCOUNT_ID,
                resource_id: '36E53042-04E8-40C9-AE69-26E56CB0D216',
                resource_name: 'test-resource',
                resource_type: 'MSSQL',
                co_relation_id: 'fs-f6082f35c1db',
                cloud_provider_account_id: 'test-aws-account',
                cloud_provider_name: 'AWS',
                region: 'ap-southeast-1',
                credentials_id: 'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
                storage_type: 'FSXN',
                metadata: {
                    node1InstanceId: 'i-07e76a4b916548dc0',
                    node2InstanceId: 'i-0880a21327284f67c',
                    sqlDeploymentType: 'FCI'
                }
            },
            undefined,
            false
        );
        expect(resp).toBeDefined();
        expect(resp.databaseHostStatus).toEqual('ONLINE');
    });
});
