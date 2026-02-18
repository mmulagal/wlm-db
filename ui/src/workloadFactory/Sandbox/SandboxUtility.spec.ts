import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
    generateCreateSandboxPayload,
    formatSandboxListData,
    getUniqueSourceDatabasesCount,
    getSandboxDistributionByAge,
    getSandboxDistributionByTag,
    getDefaultDriveLetters,
    getAggregatedSplitEstimate,
    isValidSandboxName,
    createUniqueSandboxTableData
} from './SandboxUtility';
import { formatSize, getTimeDifferenceInDays } from '../../utils/utilityFunctions';
import store from '../../store/store';

// Mock store before imports
vi.mock('../../store/store', () => ({
    default: {
        getState: vi.fn(() => ({
            inventoryV2: {
                inventoryTableData: {},
                getDatabaseHosts: {
                    fullHostDataLoading: false,
                    databaseHostsLoading: false
                }
            },
            headers: {
                headerSelectedMultiCredIdsList: [],
                headerSelectedMultiRegionIdsList: []
            }
        }))
    }
}));

vi.mock('../../store/notificationSlice', () => ({
    NOTIFICATION_TYPES: { ERROR: 'error', INFO: 'info' },
    addNotification: vi.fn(payload => ({ type: 'notification/addNotification', payload }))
}));

vi.mock('../../utils/appConstants', () => ({
    GENERAL: {
        CREATE_SANDBOX_SOURCE_DB_NOT_ISCSI: 'Source DB not iSCSI',
        AUTO_ASSIGN_MOUNT_POINT: 'Auto-assign mount point'
    }
}));

vi.mock('../../utils/utilityFunctions', () => ({
    formatDateWithTime: vi.fn(val => `formatted_${val}`),
    formatSize: vi.fn(val => `${val} GB`),
    getTimeDifferenceInDays: vi.fn((now, createdAt) => Math.floor((now - createdAt) / (1000 * 60 * 60 * 24)))
}));

vi.mock('../../utils/consts', () => ({
    DBType: { MSSQL: 'MSSQL' },
    INVENTORY_STATUS: { MANAGED: 'MANAGED' },
    STATUS_CONST: { DOWN: 'DOWN', UP: 'UP' }
}));

vi.mock('../InventoryV2/InventoryUtilsV2', () => ({
    uniqueHostRow: vi.fn((hostId, credId, regionId) => `${hostId}_${credId}_${regionId}`)
}));

describe('SandboxUtility', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateCreateSandboxPayload', () => {
        it('should generate correct payload from state', () => {
            const state = {
                source: {
                    selectedDatabaseHost: { value: 'host1' },
                    selectedDatabaseInstance: { value: 'instance1' },
                    selectedDatabase: { value: 'db1', label: 'DB1' }
                },
                target: {
                    selectedDatabaseHost: { value: 'targetHost' },
                    selectedDatabaseInstance: { value: 'targetInstance' },
                    selectedDatabase: 'targetDb'
                },
                dataDriveMountPoint: 'D',
                logDriveMountPoint: 'E',
                selectedTag: 'Development'
            };

            const result = generateCreateSandboxPayload(state);

            expect(result.source.host).toBe('host1');
            expect(result.source.instance).toBe('instance1');
            expect(result.source.database).toBe('db1');
            expect(result.destination.host).toBe('targetHost');
            expect(result.destination.instance).toBe('targetInstance');
            expect(result.destination.database).toBe('targetDb');
            expect(result.mountPoints.dataDrive).toBe('D');
            expect(result.mountPoints.logDrive).toBe('E');
            expect(result.tag).toBe('Development');
        });

        it('should use label as database when value is absent', () => {
            const state = {
                source: {
                    selectedDatabaseHost: { value: 'host1' },
                    selectedDatabaseInstance: { value: 'instance1' },
                    selectedDatabase: { value: null, label: 'DB_Label' }
                },
                target: {
                    selectedDatabaseHost: { value: null },
                    selectedDatabaseInstance: { value: null },
                    selectedDatabase: null
                },
                dataDriveMountPoint: null,
                logDriveMountPoint: null,
                selectedTag: null
            };

            const result = generateCreateSandboxPayload(state);
            expect(result.source.database).toBe('DB_Label');
        });

        it('should handle undefined state properties gracefully', () => {
            const state = {};
            const result = generateCreateSandboxPayload(state);
            expect(result.source.host).toBeUndefined();
            expect(result.destination.database).toBeUndefined();
            expect(result.tag).toBeUndefined();
        });
    });

    describe('formatSandboxListData', () => {
        it('should format sandbox list and filter out items with errors', () => {
            (getTimeDifferenceInDays as any).mockReturnValue(10);

            const data = [
                {
                    error: null,
                    databaseHostId: 'host1',
                    databaseInstanceName: 'instance1',
                    sandboxName: 'sandbox1',
                    databaseHostName: 'HOST1',
                    databaseInstanceId: 'instanceId1',
                    sourceDatabaseName: 'srcDb',
                    sourceDatabaseHostName: 'srcHost',
                    sourceDatabaseInstanceName: 'srcInstance',
                    updatedAt: '2023-01-01',
                    createdAt: '1672531200000',
                    tag: 'Development',
                    baseSnapshot: 'snapshot1'
                },
                {
                    error: 'Some error',
                    sandboxName: 'sandbox2'
                }
            ];

            const result = formatSandboxListData(data as any);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('host1_instance1_sandbox1');
            expect(result[0].name).toBe('sandbox1');
            expect(result[0].status).toBe('active');
            expect(result[0].tag).toBe('Development');
            expect(result[0].instanceName).toBe('HOST1\\instance1');
            expect(result[0].sourceInstanceName).toBe('srcHost\\srcInstance');
        });

        it('should set age and ageByRange correctly', () => {
            (getTimeDifferenceInDays as any).mockReturnValue(5);

            const data = [
                {
                    error: null,
                    databaseHostId: 'h1',
                    databaseInstanceName: 'i1',
                    sandboxName: 'sb1',
                    databaseHostName: 'H1',
                    databaseInstanceId: 'iid1',
                    sourceDatabaseName: 'sd',
                    sourceDatabaseHostName: 'sh',
                    sourceDatabaseInstanceName: 'si',
                    updatedAt: '',
                    createdAt: '1000000000',
                    tag: 'QA',
                    baseSnapshot: 'snap'
                }
            ];

            const result = formatSandboxListData(data as any);
            expect(result[0].age).toBe('5 days');
            expect(result[0].ageByRange).toBe('0-30 days');
        });

        it('should set ageByRange to 31-60 days correctly', () => {
            (getTimeDifferenceInDays as any).mockReturnValue(45);

            const data = [
                {
                    error: null,
                    databaseHostId: 'h1',
                    databaseInstanceName: 'i1',
                    sandboxName: 'sb1',
                    databaseHostName: 'H1',
                    databaseInstanceId: 'iid1',
                    sourceDatabaseName: 'sd',
                    sourceDatabaseHostName: 'sh',
                    sourceDatabaseInstanceName: 'si',
                    updatedAt: '',
                    createdAt: '1000000000',
                    tag: 'QA',
                    baseSnapshot: 'snap'
                }
            ];

            const result = formatSandboxListData(data as any);
            expect(result[0].ageByRange).toBe('31-60 days');
        });

        it('should set ageByRange to 61+ days correctly', () => {
            (getTimeDifferenceInDays as any).mockReturnValue(70);

            const data = [
                {
                    error: null,
                    databaseHostId: 'h1',
                    databaseInstanceName: 'i1',
                    sandboxName: 'sb1',
                    databaseHostName: 'H1',
                    databaseInstanceId: 'iid1',
                    sourceDatabaseName: 'sd',
                    sourceDatabaseHostName: 'sh',
                    sourceDatabaseInstanceName: 'si',
                    updatedAt: '',
                    createdAt: '1000000000',
                    tag: 'QA',
                    baseSnapshot: 'snap'
                }
            ];

            const result = formatSandboxListData(data as any);
            expect(result[0].ageByRange).toBe('61+ days');
        });

        it('should use empty string for updatedAt when not provided', () => {
            (getTimeDifferenceInDays as any).mockReturnValue(5);

            const data = [
                {
                    error: null,
                    databaseHostId: 'h1',
                    databaseInstanceName: 'i1',
                    sandboxName: 'sb1',
                    databaseHostName: 'H1',
                    databaseInstanceId: 'iid1',
                    sourceDatabaseName: 'sd',
                    sourceDatabaseHostName: 'sh',
                    sourceDatabaseInstanceName: 'si',
                    createdAt: '1000000000',
                    tag: 'QA',
                    baseSnapshot: 'snap'
                }
            ];

            const result = formatSandboxListData(data as any);
            expect(result[0].actualUpdated).toBe('');
        });
    });

    describe('getUniqueSourceDatabasesCount', () => {
        it('should count unique source databases', () => {
            const sandBoxList = [
                { sourceDatabaseHostName: 'h1', sourceDatabaseInstanceName: 'i1', sourceDatabaseName: 'db1' },
                { sourceDatabaseHostName: 'h1', sourceDatabaseInstanceName: 'i1', sourceDatabaseName: 'db1' },
                { sourceDatabaseHostName: 'h2', sourceDatabaseInstanceName: 'i2', sourceDatabaseName: 'db2' }
            ];

            const result = getUniqueSourceDatabasesCount(sandBoxList as any);
            expect(result).toBe(2);
        });

        it('should return 0 for empty list', () => {
            const result = getUniqueSourceDatabasesCount([] as any);
            expect(result).toBe(0);
        });

        it('should count each unique combination once', () => {
            const sandBoxList = [
                { sourceDatabaseHostName: 'h1', sourceDatabaseInstanceName: 'i1', sourceDatabaseName: 'db1' },
                { sourceDatabaseHostName: 'h1', sourceDatabaseInstanceName: 'i1', sourceDatabaseName: 'db2' },
                { sourceDatabaseHostName: 'h1', sourceDatabaseInstanceName: 'i2', sourceDatabaseName: 'db1' }
            ];
            const result = getUniqueSourceDatabasesCount(sandBoxList as any);
            expect(result).toBe(3);
        });
    });

    describe('getSandboxDistributionByAge', () => {
        it('should correctly distribute sandboxes by age range 0-30', () => {
            (getTimeDifferenceInDays as any).mockReturnValue(10);

            const sandBoxList = [{ createdAt: String(Date.now()) }];
            const result = getSandboxDistributionByAge(sandBoxList as any);
            expect(result['0-30']).toBe(1);
            expect(result['31-60']).toBe(0);
            expect(result['61+']).toBe(0);
        });

        it('should correctly distribute sandboxes by age range 31-60', () => {
            (getTimeDifferenceInDays as any).mockReturnValue(45);

            const sandBoxList = [{ createdAt: String(Date.now()) }];
            const result = getSandboxDistributionByAge(sandBoxList as any);
            expect(result['31-60']).toBe(1);
            expect(result['0-30']).toBe(0);
        });

        it('should correctly distribute sandboxes by age range 61+', () => {
            (getTimeDifferenceInDays as any).mockReturnValue(70);

            const sandBoxList = [{ createdAt: String(Date.now()) }];
            const result = getSandboxDistributionByAge(sandBoxList as any);
            expect(result['61+']).toBe(1);
        });

        it('should handle exactly 30 days - should be in 0-30 range', () => {
            (getTimeDifferenceInDays as any).mockReturnValue(30);

            const sandBoxList = [{ createdAt: String(Date.now()) }];
            const result = getSandboxDistributionByAge(sandBoxList as any);
            expect(result['0-30']).toBe(1);
        });

        it('should handle exactly 60 days - should be in 31-60 range', () => {
            (getTimeDifferenceInDays as any).mockReturnValue(60);

            const sandBoxList = [{ createdAt: String(Date.now()) }];
            const result = getSandboxDistributionByAge(sandBoxList as any);
            expect(result['31-60']).toBe(1);
        });

        it('should return zeros for empty list', () => {
            const result = getSandboxDistributionByAge([] as any);
            expect(result['0-30']).toBe(0);
            expect(result['31-60']).toBe(0);
            expect(result['61+']).toBe(0);
        });

        it('should handle null sandBoxList', () => {
            const result = getSandboxDistributionByAge(null as any);
            expect(result['0-30']).toBe(0);
        });
    });

    describe('getSandboxDistributionByTag', () => {
        it('should count sandboxes by known tags', () => {
            const sandBoxList = [
                { tag: 'Development' },
                { tag: 'Development' },
                { tag: 'QA' },
                { tag: 'Training' },
                { tag: 'Analytics' },
                { tag: 'Integration' },
                { tag: 'Other' }
            ];

            const result = getSandboxDistributionByTag(sandBoxList as any);
            expect(result.Development).toBe(2);
            expect(result.QA).toBe(1);
            expect(result.Training).toBe(1);
            expect(result.Analytics).toBe(1);
            expect(result.Integration).toBe(1);
            expect(result.Other).toBe(1);
        });

        it('should ignore unknown tags', () => {
            const sandBoxList = [{ tag: 'Unknown' }, { tag: 'Development' }];

            const result = getSandboxDistributionByTag(sandBoxList as any);
            expect(result.Development).toBe(1);
            expect(result.Unknown).toBeUndefined();
        });

        it('should return 0 for all tags with empty list', () => {
            const result = getSandboxDistributionByTag([] as any);
            expect(result.Development).toBe(0);
            expect(result.QA).toBe(0);
        });
    });

    describe('getDefaultDriveLetters', () => {
        const dispatch = vi.fn();

        beforeEach(() => {
            dispatch.mockClear();
        });

        it('should dispatch error and return drive letters when dataPathDrive does not match D-Z', () => {
            const dbMountPointsData = {
                databaseDataPath: ['C:\\path\\data'],
                databaseLogPath: ['C:\\path\\log']
            };

            const result = getDefaultDriveLetters(dbMountPointsData, {}, {}, 'Auto-assign mount point', {}, dispatch);
            expect(dispatch).toHaveBeenCalled();
            expect(result.dataDrive).toBe('C');
        });

        it('should return UNC path drive from split when drive is backslash', () => {
            const dbMountPointsData = {
                databaseDataPath: ['\\\\server\\share\\data'],
                databaseLogPath: ['\\\\server\\share\\log']
            };

            const result = getDefaultDriveLetters(dbMountPointsData, {}, {}, 'Auto-assign mount point', {}, dispatch);
            expect(dispatch).toHaveBeenCalled();
        });

        it('should dispatch error when data drive is not NetApp', () => {
            const dispatch = vi.fn();
            const dbMountPointsData = {
                databaseDataPath: ['D:\\path'],
                databaseLogPath: ['E:\\path']
            };
            const source = {
                selectedDatabaseHost: { value: 'sameHost' },
                selectedDatabaseInstance: { value: 'sameInstance' }
            };
            const target = {
                selectedDatabaseHost: { value: 'sameHost' },
                selectedDatabaseInstance: { value: 'sameInstance' }
            };
            const driveInfoData = {
                existingDriveInfo: [{ driveLetter: 'D', isNetappDrive: false }]
            };

            const result = getDefaultDriveLetters(
                dbMountPointsData,
                source,
                target,
                'Auto-assign mount point',
                driveInfoData,
                dispatch
            );

            // When drive is not NetApp in same host/instance mode, dispatch should be called with error
            expect(dispatch).toHaveBeenCalled();
        });

        it('should not dispatch error when drives are NetApp in auto-assign same source/target mode', () => {
            const dispatch = vi.fn();
            const dbMountPointsData = {
                databaseDataPath: ['D:\\path'],
                databaseLogPath: ['E:\\path']
            };
            const source = {
                selectedDatabaseHost: { value: 'sameHost' },
                selectedDatabaseInstance: { value: 'sameInstance' }
            };
            const target = {
                selectedDatabaseHost: { value: 'sameHost' },
                selectedDatabaseInstance: { value: 'sameInstance' }
            };
            const driveInfoData = {
                existingDriveInfo: [
                    { driveLetter: 'D', isNetappDrive: true },
                    { driveLetter: 'E', isNetappDrive: true }
                ]
            };

            const result = getDefaultDriveLetters(
                dbMountPointsData,
                source,
                target,
                'Auto-assign mount point',
                driveInfoData,
                dispatch
            );

            expect(result.dataDrive).toBe('D');
            expect(result.logDrive).toBe('E');
        });

        it('should select valid netapp drive for data when recommended drive is not netapp (different host)', () => {
            const dispatch = vi.fn();
            const dbMountPointsData = {
                databaseDataPath: ['D:\\path'],
                databaseLogPath: ['E:\\path']
            };
            const source = {
                selectedDatabaseHost: { value: 'sourceHost' },
                selectedDatabaseInstance: { value: 'sourceInstance' }
            };
            const target = {
                selectedDatabaseHost: { value: 'targetHost' },
                selectedDatabaseInstance: { value: 'targetInstance' }
            };
            const driveInfoData = {
                existingDriveInfo: [
                    { driveLetter: 'D', isNetappDrive: false },
                    { driveLetter: 'F', isNetappDrive: true }
                ]
            };

            const result = getDefaultDriveLetters(
                dbMountPointsData,
                source,
                target,
                'Auto-assign mount point',
                driveInfoData,
                dispatch
            );

            expect(result.dataDrive).toBe('F');
        });

        it('should use same drive for log if no valid drive found', () => {
            const dispatch = vi.fn();
            const dbMountPointsData = {
                databaseDataPath: ['D:\\path'],
                databaseLogPath: ['E:\\path']
            };
            const source = { selectedDatabaseHost: { value: 'src' }, selectedDatabaseInstance: { value: 'srcI' } };
            const target = { selectedDatabaseHost: { value: 'tgt' }, selectedDatabaseInstance: { value: 'tgtI' } };
            const driveInfoData = {
                existingDriveInfo: [{ driveLetter: 'D', isNetappDrive: true }]
            };

            const result = getDefaultDriveLetters(
                dbMountPointsData,
                source,
                target,
                'Auto-assign mount point',
                driveInfoData,
                dispatch
            );

            expect(result.logDrive).toBe(result.dataDrive);
        });

        it('should handle null dbMountPointsData', () => {
            const result = getDefaultDriveLetters(null, {}, {}, 'Auto-assign mount point', {}, dispatch);
            expect(result.dataDrive).toBeUndefined();
        });
    });

    describe('getAggregatedSplitEstimate', () => {
        it('should sum up split estimates from volumes', () => {
            (formatSize as any).mockReturnValue('10 GB');

            const volumes = [{ splitEstimate: 3 }, { splitEstimate: 7 }];

            const result = getAggregatedSplitEstimate(volumes);
            expect(formatSize).toHaveBeenCalledWith(10);
            expect(result).toBe('10 GB');
        });

        it('should handle null volumes', () => {
            (formatSize as any).mockReturnValue('0 GB');
            const result = getAggregatedSplitEstimate(null);
            expect(formatSize).toHaveBeenCalledWith(0);
            expect(result).toBe('0 GB');
        });

        it('should handle volumes with missing splitEstimate', () => {
            (formatSize as any).mockReturnValue('5 GB');

            const volumes = [{ splitEstimate: 5 }, {}];

            const result = getAggregatedSplitEstimate(volumes);
            expect(formatSize).toHaveBeenCalledWith(5);
        });
    });

    describe('isValidSandboxName', () => {
        it('should return true for valid sandbox names', () => {
            expect(isValidSandboxName('sandbox1')).toBe(true);
            expect(isValidSandboxName('Sandbox_Test')).toBe(true);
            expect(isValidSandboxName('abc123')).toBe(true);
            expect(isValidSandboxName('a/b')).toBe(true);
        });

        it('should return false for names longer than 27 characters', () => {
            expect(isValidSandboxName('a'.repeat(28))).toBe(false);
        });

        it('should return false for names with invalid characters', () => {
            expect(isValidSandboxName('invalid name')).toBe(false); // space
            expect(isValidSandboxName('invalid-name')).toBe(false); // hyphen
            expect(isValidSandboxName('invalid.name')).toBe(false); // dot
        });

        it('should return true for empty/falsy names', () => {
            expect(isValidSandboxName('')).toBe(true);
            expect(isValidSandboxName(null)).toBe(true);
            expect(isValidSandboxName(undefined)).toBe(true);
        });

        it('should return true for exactly 27 characters', () => {
            expect(isValidSandboxName('a'.repeat(27))).toBe(true);
        });
    });

    describe('createUniqueSandboxTableData', () => {
        it('should return empty array for null input', () => {
            const result = createUniqueSandboxTableData(null as any);
            expect(result).toEqual([]);
        });

        it('should return empty array for non-array input', () => {
            const result = createUniqueSandboxTableData('not an array' as any);
            expect(result).toEqual([]);
        });

        it('should return empty array when inventoryTableData is null', () => {
            (store.getState as any).mockReturnValue({
                inventoryV2: {
                    inventoryTableData: null,
                    getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false }
                },
                headers: {
                    headerSelectedMultiCredIdsList: ['cred1'],
                    headerSelectedMultiRegionIdsList: ['us-east-1']
                }
            });

            const result = createUniqueSandboxTableData([{ databaseHostId: 'h1', databaseInstanceName: 'i1' }]);
            expect(result).toEqual([]);
        });

        it('should build unique sandbox table data from inventory and sandbox data', () => {
            (store.getState as any).mockReturnValue({
                inventoryV2: {
                    inventoryTableData: {
                        'h1_cred1_us-east-1': {
                            resourceId: 'h1',
                            name: 'Host1',
                            credentialId: 'cred1',
                            regionId: 'us-east-1',
                            hostType: 'MSSQL',
                            managedInstance: 1,
                            sqlServerInstances: [
                                {
                                    databaseInstanceName: 'INSTANCE1',
                                    databaseInstanceId: 'iid1',
                                    statusColText: 'MANAGED',
                                    status: 'UP'
                                }
                            ]
                        }
                    },
                    getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false }
                },
                headers: {
                    headerSelectedMultiCredIdsList: ['cred1'],
                    headerSelectedMultiRegionIdsList: ['us-east-1']
                }
            });

            const tableData = [
                {
                    databaseHostId: 'h1',
                    databaseInstanceName: 'INSTANCE1',
                    databaseInstanceId: 'iid1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    databaseHostName: 'Host1',
                    status: 'active',
                    type: 'MSSQL'
                }
            ];

            const result = createUniqueSandboxTableData(tableData);
            expect(Array.isArray(result)).toBe(true);
        });

        it('should create new entry when instance not found in managed instances', () => {
            (store.getState as any).mockReturnValue({
                inventoryV2: {
                    inventoryTableData: {},
                    getDatabaseHosts: { fullHostDataLoading: true, databaseHostsLoading: false }
                },
                headers: {
                    headerSelectedMultiCredIdsList: [],
                    headerSelectedMultiRegionIdsList: []
                }
            });

            const tableData = [
                {
                    databaseHostId: 'unknownHost',
                    databaseInstanceName: 'INSTANCE1',
                    databaseInstanceId: 'iid1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    databaseHostName: 'UnknownHost',
                    status: 'active',
                    type: 'MSSQL'
                }
            ];

            const result = createUniqueSandboxTableData(tableData);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThanOrEqual(1);
        });

        it('should increment sandbox count when same instance appears multiple times in tableData', () => {
            (store.getState as any).mockReturnValue({
                inventoryV2: {
                    inventoryTableData: {
                        'h1_cred1_us-east-1': {
                            resourceId: 'h1',
                            name: 'Host1',
                            credentialId: 'cred1',
                            regionId: 'us-east-1',
                            hostType: 'MSSQL',
                            managedInstance: 1,
                            sqlServerInstances: [
                                {
                                    databaseInstanceName: 'INST',
                                    databaseInstanceId: 'iid1',
                                    statusColText: 'MANAGED',
                                    status: 'UP'
                                }
                            ]
                        }
                    },
                    getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false }
                },
                headers: {
                    headerSelectedMultiCredIdsList: ['cred1'],
                    headerSelectedMultiRegionIdsList: ['us-east-1']
                }
            });

            const tableData = [
                {
                    databaseHostId: 'h1',
                    databaseInstanceName: 'INST',
                    databaseInstanceId: 'iid1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    databaseHostName: 'Host1',
                    status: 'active',
                    type: 'MSSQL'
                },
                {
                    databaseHostId: 'h1',
                    databaseInstanceName: 'INST',
                    databaseInstanceId: 'iid1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    databaseHostName: 'Host1',
                    status: 'active',
                    type: 'MSSQL'
                }
            ];

            const result = createUniqueSandboxTableData(tableData);
            const entry = result.find((r: any) => r.databaseInstanceName === 'INST');
            expect(entry?.sandboxCount).toBe(2);
        });
    });
});
