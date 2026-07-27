import { faker } from '@faker-js/faker';
import { isEmpty } from 'lodash-es';
import { afterEach, beforeEach, vi } from 'vitest';
import type { DescribeFileSystemsCommandOutput } from '@aws-sdk/client-fsx';

import { resetFsxSimulatorBackupRetention } from '../../simulator/scopes/aws/fsx-scope';
import {
    registerProxyGetResponse,
    resetProxyOverrides,
    getCapturedProxyGetUris
} from '../../simulator/scopes/cloud-manager/proxy-forwarder-scope';
import * as fsxLib from '../../../src/lib/aws/fsx';
import { DEFAULT_AWS_REGION, DEFAULT_INSTANCE_NAME } from '../../../src/utils/consts';
import {
    getFSxFileSystemsList,
    getOntapVolumesSnapshotCount,
    isFsxnAwsBackupEnabled,
    getMappedOntapVolumes,
    tagFsxResource,
    isFsxwAwsBackupEnabled,
    updateVolumeSizeAndWaitForUpdate,
    updateFsxBackup,
    isInstanceAppConsistentBackupEnabled,
    resolveOntapVolumeMappings,
    updateVolumeMappings
} from '../../../src/operations/aws/fsx-operations';
import { DEFAULT_AWS_CREDENTIALS_ID, INVENTORY_AWS_VPC_ID, ACCOUNT_ID, CREDENTIALS_ID } from '../../utils/consts';
import fsxResponse from '../../simulator/responses/aws/fsx-operations-response.json';

const FSX_FILESYSTEM_ID = 'fs-03773e21b2f0e39b4';
const credentialsId = `${faker.string.alpha(20)}`;
const awsAccountId = `${faker.string.alpha(8)}`;

/** Matches one of the demo FSx volumes returned by `describeFSxVolumes` for FSX_FILESYSTEM_ID, so
 *  `getMappedOntapVolumes`'s `fsxVolumeId` enrichment (via `demoGetFsxnVolIdsFromOntapVolIds`) has
 *  something to match against. */
const DEMO_FSX_VOLUME_UUID = '939a4ec9-7c14-11ee-b185-8329e8fcbf44';

/**
 * Stub `describeFSx` so mapped-volumes tests don't depend on whatever
 * `list-fsx-filesystems.json` currently exposes for `Endpoints.Management`
 * (fixture keys are `DNSName`/`IpAddresses`; this keeps the test self-contained).
 */
function mockFsxManagementEndpoint(): void {
    const resolvedValue: DescribeFileSystemsCommandOutput = {
        $metadata: {},
        FileSystems: [
            {
                FileSystemId: FSX_FILESYSTEM_ID,
                Lifecycle: 'AVAILABLE',
                OntapConfiguration: {
                    Endpoints: {
                        Management: {
                            DNSName: `management.${FSX_FILESYSTEM_ID}.fsx.${DEFAULT_AWS_REGION}.amazonaws.com`
                        }
                    }
                }
            }
        ]
    };
    vi.spyOn(fsxLib, 'describeFSx').mockResolvedValue(resolvedValue);
}

function registerMappedVolumesOntapMocks(): void {
    mockFsxManagementEndpoint();
    registerProxyGetResponse({
        targetId: FSX_FILESYSTEM_ID,
        ontapPath: 'api/storage/luns',
        body: {
            num_records: 2,
            records: [
                { uuid: 'lun-uuid-data', name: '/vol/wlmdb_sqldata_apr1/sqldata', serial_number: 'lWB5g?XW76kw' },
                { uuid: 'lun-uuid-log', name: '/vol/wlmdb_sqllog_apr1/sqllog', serial_number: 'lWB5g?XW76kx' }
            ]
        }
    });
    registerProxyGetResponse({
        targetId: FSX_FILESYSTEM_ID,
        ontapPath: 'api/storage/volumes',
        body: {
            num_records: 2,
            records: [
                { uuid: DEMO_FSX_VOLUME_UUID, name: 'wlmdb_sqldata_apr1', snapshot_count: 3 },
                { uuid: '88c5b3c6-0ebb-11f0-b44e-dff3c689d4ce', name: 'wlmdb_sqllog_apr1', snapshot_count: 1 }
            ]
        }
    });
}

describe('Testcases for Amazon FSx resources operations', () => {
    // FSx simulator retains UpdateFileSystem state in a module Map; reset so tests stay isolated (incl. parallel workers).
    beforeEach(() => {
        resetFsxSimulatorBackupRetention();
    });

    afterEach(() => {
        resetProxyOverrides();
        vi.restoreAllMocks();
    });

    // Its not mocked, we are making actual api call to fsx inventory, so headers wont be present to make this test works
    it('List FSx filesystems and volume details', async () => {
        const response = await getFSxFileSystemsList(
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            INVENTORY_AWS_VPC_ID
        );

        expect(response).toBeDefined();
    });

    it('AWS backup enabled check', async () => {
        const response = await isFsxnAwsBackupEnabled(
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            FSX_FILESYSTEM_ID,
            fsxResponse.volumeMap.volumeRecords.map(v => v.uuid),
            fsxResponse.volumeMap.volumeDBMap,
            `i-${faker.string.fromCharacters('abcdef0123456789', 17)}`
        );
        expect(response?.volumeDBMapWithBackupFlag.master).toEqual(true);
    });

    it('Get Ontap volume snapshots count', async () => {
        const response = await getOntapVolumesSnapshotCount(
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            FSX_FILESYSTEM_ID,
            fsxResponse.volumeMap.volumeRecords,
            fsxResponse.volumeMap.volumeDBMap
        );
        expect(response.master).toBeTruthy();
    });

    it('Get Ontap mapped volumes', async () => {
        registerMappedVolumesOntapMocks();

        const response = await getMappedOntapVolumes(
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            FSX_FILESYSTEM_ID,
            false,
            undefined,
            [DEFAULT_INSTANCE_NAME],
            false,
            false,
            ACCOUNT_ID
        );

        const fsxVolumeIds = response?.[DEFAULT_INSTANCE_NAME]?.volumeRecords?.filter(
            ({ fsxVolumeId }: { fsxVolumeId?: string }) => Boolean(fsxVolumeId)
        );

        expect(fsxVolumeIds?.length).toBeGreaterThan(0);
        expect(response?.[DEFAULT_INSTANCE_NAME]).toBeDefined();
        expect(response?.[DEFAULT_INSTANCE_NAME]?.volumeDBMap).toEqual([
            {
                databaseName: 'apr1',
                ontapVolumeuuid: DEMO_FSX_VOLUME_UUID,
                dataLunUuids: ['lun-uuid-data'],
                logLunUuids: []
            },
            {
                databaseName: 'apr1',
                ontapVolumeuuid: '88c5b3c6-0ebb-11f0-b44e-dff3c689d4ce',
                dataLunUuids: [],
                logLunUuids: ['lun-uuid-log']
            }
        ]);
        expect(response?.[DEFAULT_INSTANCE_NAME]?.lunRecords).toEqual([
            {
                uuid: 'lun-uuid-data',
                name: '/vol/wlmdb_sqldata_apr1/sqldata',
                serial_number: 'lWB5g?XW76kw',
                driveLetter: 'E:\\',
                ontapVolumeuuid: DEMO_FSX_VOLUME_UUID
            },
            {
                uuid: 'lun-uuid-log',
                name: '/vol/wlmdb_sqllog_apr1/sqllog',
                serial_number: 'lWB5g?XW76kx',
                driveLetter: 'L:\\',
                ontapVolumeuuid: '88c5b3c6-0ebb-11f0-b44e-dff3c689d4ce'
            }
        ]);
        expect(response?.[DEFAULT_INSTANCE_NAME]?.databasesSummary).toBeDefined();
        expect(Array.isArray(response?.[DEFAULT_INSTANCE_NAME]?.databasesSummary)).toBe(true);
        expect(response?.[DEFAULT_INSTANCE_NAME]?.sqlNativeBackupEnabledDatabases).toBeDefined();
        expect(Array.isArray(response?.[DEFAULT_INSTANCE_NAME]?.sqlNativeBackupEnabledDatabases)).toBe(true);
    });

    it('should return undefined (and log) when accountId is missing, required to resolve ONTAP volume mappings', async () => {
        // getMappedOntapVolumes swallows all errors internally (logs + returns undefined) rather
        // than rejecting, matching its pre-existing error-handling contract.
        const response = await getMappedOntapVolumes(
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            FSX_FILESYSTEM_ID,
            false,
            undefined,
            [DEFAULT_INSTANCE_NAME]
        );

        expect(response).toBeUndefined();
    });

    describe('updateVolumeMappings', () => {
        it('should group multi-file/multi-database rows, bucket LUN uuids by FileType, and dedupe repeated LUNs', () => {
            const databaseVolumeMap = [
                { DatabaseName: 'apr1', VolumeName: 'sqldata', VolumeId: 'E:\\', FileType: 0, MountPoint: 'E:\\' },
                // Second data file for apr1 on the same volume (e.g. a secondary NDF) — dedup case.
                { DatabaseName: 'apr1', VolumeName: 'sqldata', VolumeId: 'E:\\', FileType: 0, MountPoint: 'E:\\' },
                { DatabaseName: 'apr1', VolumeName: 'sqllog', VolumeId: 'L:\\', FileType: 1, MountPoint: 'L:\\' },
                { DatabaseName: 'model', VolumeName: 'sqldata', VolumeId: 'E:\\', FileType: 0, MountPoint: 'E:\\' }
            ];
            const volumeNameMapping = {
                'E:\\': { uuid: 'vol-uuid-data', name: 'sqldata' },
                'L:\\': { uuid: 'vol-uuid-log', name: 'sqllog' }
            };
            const volumeLunUuidMapping = { 'E:\\': 'lun-uuid-data', 'L:\\': 'lun-uuid-log' };

            const result = updateVolumeMappings(databaseVolumeMap, volumeNameMapping, volumeLunUuidMapping);

            // Grouped by databaseName+ontapVolumeuuid: 'apr1' gets separate entries for its data
            // volume and log volume (each on a distinct ONTAP volume); 'model' shares the same data
            // volume as 'apr1' but is a distinct database, so it gets its own entry.
            expect(result).toEqual([
                {
                    databaseName: 'apr1',
                    ontapVolumeuuid: 'vol-uuid-data',
                    dataLunUuids: ['lun-uuid-data'],
                    logLunUuids: []
                },
                {
                    databaseName: 'apr1',
                    ontapVolumeuuid: 'vol-uuid-log',
                    dataLunUuids: [],
                    logLunUuids: ['lun-uuid-log']
                },
                {
                    databaseName: 'model',
                    ontapVolumeuuid: 'vol-uuid-data',
                    dataLunUuids: ['lun-uuid-data'],
                    logLunUuids: []
                }
            ]);
        });

        it('should skip data/log LUN bucketing but keep the group when the LUN uuid is missing', () => {
            const databaseVolumeMap = [
                { DatabaseName: 'apr1', VolumeName: 'sqldata', VolumeId: 'E:\\', FileType: 0, MountPoint: 'E:\\' }
            ];
            const volumeNameMapping = { 'E:\\': { uuid: 'vol-uuid-data', name: 'sqldata' } };

            const result = updateVolumeMappings(databaseVolumeMap, volumeNameMapping, {});

            expect(result).toEqual([
                { databaseName: 'apr1', ontapVolumeuuid: 'vol-uuid-data', dataLunUuids: [], logLunUuids: [] }
            ]);
        });

        it('should skip rows with no matching volumeNameMapping entry', () => {
            const databaseVolumeMap = [
                { DatabaseName: 'apr1', VolumeName: 'sqldata', VolumeId: 'E:\\', FileType: 0, MountPoint: 'E:\\' }
            ];

            const result = updateVolumeMappings(databaseVolumeMap, {}, { 'E:\\': 'lun-uuid-data' });

            expect(result).toEqual([]);
        });
    });

    describe('resolveOntapVolumeMappings', () => {
        it('should resolve LUN/volume mappings for a host-collected instance payload', async () => {
            registerMappedVolumesOntapMocks();

            const hostData = {
                serialNumbers: ['lWB5g?XW76kw', 'lWB5g?XW76kx'],
                volumeSerialMapping: { 'E:\\': 'lWB5g?XW76kw', 'L:\\': 'lWB5g?XW76kx' },
                databaseVolumeMap: [
                    { DatabaseName: 'apr1', VolumeName: 'sqldata', VolumeId: 'E:\\', FileType: 0, MountPoint: 'E:\\' },
                    { DatabaseName: 'apr1', VolumeName: 'sqllog', VolumeId: 'L:\\', FileType: 1, MountPoint: 'L:\\' }
                ],
                cifsShareNames: [],
                databasesSummary: [],
                sqlNativeBackupEnabledDatabases: []
            };

            const result = await resolveOntapVolumeMappings(
                {
                    accountId: ACCOUNT_ID,
                    credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                    region: DEFAULT_AWS_REGION,
                    fsxId: FSX_FILESYSTEM_ID
                },
                hostData
            );

            expect(result.volumes.records).toEqual([
                { uuid: DEMO_FSX_VOLUME_UUID, name: 'wlmdb_sqldata_apr1', snapshot_count: 3 },
                { uuid: '88c5b3c6-0ebb-11f0-b44e-dff3c689d4ce', name: 'wlmdb_sqllog_apr1', snapshot_count: 1 }
            ]);
            expect(result.volumeDBMap).toEqual([
                {
                    databaseName: 'apr1',
                    ontapVolumeuuid: DEMO_FSX_VOLUME_UUID,
                    dataLunUuids: ['lun-uuid-data'],
                    logLunUuids: []
                },
                {
                    databaseName: 'apr1',
                    ontapVolumeuuid: '88c5b3c6-0ebb-11f0-b44e-dff3c689d4ce',
                    dataLunUuids: [],
                    logLunUuids: ['lun-uuid-log']
                }
            ]);
            expect(result.luns).toEqual([
                {
                    uuid: 'lun-uuid-data',
                    name: '/vol/wlmdb_sqldata_apr1/sqldata',
                    serial_number: 'lWB5g?XW76kw',
                    driveLetter: 'E:\\',
                    ontapVolumeuuid: DEMO_FSX_VOLUME_UUID
                },
                {
                    uuid: 'lun-uuid-log',
                    name: '/vol/wlmdb_sqllog_apr1/sqllog',
                    serial_number: 'lWB5g?XW76kx',
                    driveLetter: 'L:\\',
                    ontapVolumeuuid: '88c5b3c6-0ebb-11f0-b44e-dff3c689d4ce'
                }
            ]);
        });

        it('should query volumes by extracted volume name, not full LUN path', async () => {
            registerMappedVolumesOntapMocks();

            const hostData = {
                serialNumbers: ['lWB5g?XW76kw', 'lWB5g?XW76kx'],
                volumeSerialMapping: { 'E:\\': 'lWB5g?XW76kw', 'L:\\': 'lWB5g?XW76kx' },
                databaseVolumeMap: [
                    { DatabaseName: 'apr1', VolumeName: 'sqldata', VolumeId: 'E:\\', FileType: 0, MountPoint: 'E:\\' },
                    { DatabaseName: 'apr1', VolumeName: 'sqllog', VolumeId: 'L:\\', FileType: 1, MountPoint: 'L:\\' }
                ],
                cifsShareNames: [],
                databasesSummary: [],
                sqlNativeBackupEnabledDatabases: []
            };

            await resolveOntapVolumeMappings(
                {
                    accountId: ACCOUNT_ID,
                    credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                    region: DEFAULT_AWS_REGION,
                    fsxId: FSX_FILESYSTEM_ID
                },
                hostData
            );

            const volumesUris = getCapturedProxyGetUris().filter(uri => uri.includes('api/storage/volumes'));
            expect(volumesUris.length).toBeGreaterThan(0);
            const nameFilters = volumesUris.map(uri => new URL(uri, 'http://proxy.local').searchParams.get('name'));
            expect(nameFilters.some(name => name?.includes('wlmdb_sqldata_apr1'))).toBe(true);
            expect(nameFilters.some(name => name?.includes('wlmdb_sqllog_apr1'))).toBe(true);
            expect(nameFilters.every(name => name !== null && !name.includes('/vol/'))).toBe(true);
        });

        it('should return empty results without making ONTAP calls when the host data has no serials/volumes', async () => {
            const hostData = {
                serialNumbers: [],
                volumeSerialMapping: {},
                databaseVolumeMap: [],
                cifsShareNames: [],
                databasesSummary: [],
                sqlNativeBackupEnabledDatabases: []
            };

            const result = await resolveOntapVolumeMappings(
                {
                    accountId: ACCOUNT_ID,
                    credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                    region: DEFAULT_AWS_REGION,
                    fsxId: FSX_FILESYSTEM_ID
                },
                hostData
            );

            expect(result).toEqual({ volumes: { records: [] }, luns: [], volumeDBMap: [] });
        });
    });

    it('Tag Ec2 instance', async () => {
        await expect(
            tagFsxResource(credentialsId, DEFAULT_AWS_REGION, awsAccountId, ACCOUNT_ID, FSX_FILESYSTEM_ID, [
                { Key: 'key', Value: 'value' }
            ])
        ).resolves.not.toThrow();
    });

    it('Check if FSX for Windows AWS backup available', async () => {
        const response = await isFsxwAwsBackupEnabled(
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            FSX_FILESYSTEM_ID
        );
        expect(response).toEqual(true);
    });

    it('Update FSx volume and wait for update', async () => {
        try {
            await updateVolumeSizeAndWaitForUpdate(
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                ACCOUNT_ID,
                FSX_FILESYSTEM_ID,
                'fsvol-0b1b3b3b3b3b3b3b3',
                1048576
            );
        } catch (error) {
            expect(error).toBeUndefined();
        }
    });

    it('Update FSxN backup', async () => {
        await expect(
            updateFsxBackup(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION, FSX_FILESYSTEM_ID, {
                automaticBackupRetentionDays: 10,
                dailyAutomaticBackupStartTime: '10:00'
            })
        ).resolves.not.toThrow();
    });

    it('should test app consistent backup', async () => {
        const volumeDBMap: Array<{ ontapVolumeuuid: string; databaseName: string }> = [
            { ontapVolumeuuid: 'ad251a8f-da34-11ef-b315-11b9ce95d982', databaseName: 'salesdb' },
            { ontapVolumeuuid: '74a8a789-c5dd-11ef-b315-11b9ce95d982', databaseName: 'inventory' },
            { ontapVolumeuuid: '438cc269-edeb-11ef-994b-3b81e03bea3e', databaseName: 'analytics' }
        ];
        const volUuids = [
            'ad251a8f-da34-11ef-b315-11b9ce95d982',
            '74a8a789-c5dd-11ef-b315-11b9ce95d982',
            '438cc269-edeb-11ef-994b-3b81e03bea3e'
        ];
        const res = await isInstanceAppConsistentBackupEnabled(
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            'fs-4242424242',
            volUuids,
            volumeDBMap,
            'i-4242424242'
        );
        expect(res).toBeDefined();
        if (res && !isEmpty(res)) {
            expect(Object.values(res).every(Boolean)).toBe(true);
        }
    });
});
