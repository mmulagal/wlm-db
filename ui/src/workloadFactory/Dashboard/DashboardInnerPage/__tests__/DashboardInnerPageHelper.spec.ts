import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
    checkSingleRowFix,
    bulkFixDisableCheck,
    sortOptimizeDashboardInnerTable,
    filterNotOptimizedRows,
    getAssessmentStatusConsistency,
    calculatePostponeInfo,
    callDashboardDismissApi
} from '../DashboardInnerPageHelper';

const {
    mockGetState,
    mockSetSelectedRowsForOptimize,
    mockSetInProgressStateData,
    mockAddNotification,
    mockCategorizeStateInstances,
    mockUpdateConfigStateStatus,
    mockUpdateConfigStateStatusOracle
} = vi.hoisted(() => ({
    mockGetState: vi.fn(() => ({
        getWellOptimize: {
            inProgressStateData: {},
            inProgressHostData: {}
        }
    })),
    mockSetSelectedRowsForOptimize: vi.fn((val: any) => ({ type: 'setSelectedRowsForOptimize', payload: val })),
    mockSetInProgressStateData: vi.fn((val: any) => ({ type: 'setInProgressStateData', payload: val })),
    mockAddNotification: vi.fn((val: any) => ({ type: 'addNotification', payload: val })),
    mockCategorizeStateInstances: vi.fn(() => ({ successList: [], failedList: [] })),
    mockUpdateConfigStateStatus: vi.fn(),
    mockUpdateConfigStateStatusOracle: vi.fn()
}));

// Mock store before importing helper
vi.mock('../../../../store/store', () => ({
    default: {
        getState: mockGetState,
        dispatch: vi.fn()
    }
}));

vi.mock('../../../../store/workloadFactory/databaseHomeSlice', () => ({
    setSelectedRowsForOptimize: mockSetSelectedRowsForOptimize
}));

vi.mock('../../../../store/workloadFactory/getWellOptimizeSlice', () => ({
    setInProgressStateData: mockSetInProgressStateData
}));

vi.mock('../../../../store/notificationSlice', () => ({
    addNotification: mockAddNotification,
    NOTIFICATION_TYPES: {
        SUCCESS: 'success',
        ERROR: 'error',
        INFO: 'info'
    }
}));

vi.mock('../../../../workloadFactory/DatabaseHomePage/DatabaseHomeUtils', () => ({
    categorizeStateInstances: mockCategorizeStateInstances
}));

vi.mock('../../../../workloadFactory/GetWell/GetWellUtils', () => ({
    updateConfigStateStatus: mockUpdateConfigStateStatus
}));

vi.mock('../../../../workloadFactory/InventoryV2/InventoryUtilsV2', () => ({
    uniqueHostRow: vi.fn((a: string, b: string, c: string) => `${a}_${b}_${c}`)
}));

vi.mock(
    '../../../../workloadFactory/Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils',
    () => ({
        updateConfigStateStatusOracle: mockUpdateConfigStateStatusOracle
    })
);

vi.mock('../../../../utils/consts', () => ({
    CONFIG_NAMES: {},
    ASSESSMENT_CONFIG_NAMES: {
        STORAGE_TIER: 'Storage tier',
        FILE_SYSTEM_HEADROOM: 'File system headroom',
        LOG_DRIVE_SIZE: 'Log drive size',
        TEMPDB_DRIVE_SIZE: 'TempDB drive size',
        COMPUTE_RIGHTSIZING: 'Compute rightsizing',
        OPERATING_SYSTEM: 'Operating system',
        MSSQL_HIGH_AVAILABILITY: 'Microsoft SQL Server High Availability',
        ONTAP_CAPS: 'ONTAP',
        OPERATING_SYSTEM_PATCH: 'Operating system patch',
        RSS_CONFIGURATION: 'Network adapter settings',
        SCHEDULED_LOCAL_SNAPSHOT: 'Scheduled local snapshot',
        SCHEDULED_FSX_FOR_ONTAP_BACKUPS: 'Backup Configuration',
        MAXDOP: 'MAXDOP',
        MICROSOFT_SQL_SERVER_PATCH: 'Microsoft SQL Server patch',
        LICENSE: 'License',
        CRR: 'Crr',
        CLONE_MANAGEMENT: 'Clone cleanup',
        MTU: 'MTU alignment',
        ORACLE_BINARY_PLACEMENT: 'Oracle binary placement',
        DATAFILES_PLACEMENT: 'Data files placement',
        CONTROLFILES_PLACEMENT: 'Control files placement',
        REDO_LOGS_PLACEMENT: 'Redo logs placement',
        TEMP_LOGS_PLACEMENT: 'Temp placement',
        ARCHIVE_PLACEMENT: 'Archive placement',
        DATA_DG_LUN_LAYOUT: 'ASM data disk group LUNs',
        LOG_DG_LUN_LAYOUT: 'ASM logs disk group LUNs',
        FRA_DG_LUN_LAYOUT: 'ASM FRA disk group LUNs',
        ARCHIVELOG_DG_LUN_LAYOUT: 'ASM archive log disk group LUNs',
        SWAP_SPACE: 'Swap space',
        DATA_FILES_MDF: 'Data files (.mdf)',
        LOG_FILES_LDF: 'Log files (.ldf)',
        TEMPDB_PLACEMENT: 'TempDB placement',
        TRANSPARENT_HUGEPAGES: 'Transparent hugepages',
        TCP_ADVANCED_OPTIONS: 'TCP advanced options',
        FILESYSTEMS_IO_OPTIONS: 'Filesystem I/O options',
        MULTIPATH_READCOUNT: 'Multiblock read count'
    },
    CONFIG_STATE_ACTIONS: {
        DISMISS: 'DISMISSED',
        POSTPONED: 'POSTPONED',
        ACTIVE: 'ACTIVE'
    },
    CONFIG_STATES: {
        ACTIVATING: 'ACTIVATING'
    },
    DBType: {
        ORACLE: 'ORACLE',
        MSSQL: 'MSSQL'
    },
    FINDINGS: {
        NOT_APPLICABLE: 'NOT_APPLICABLE'
    },
    GETWELL_STATUS: {
        NOT_OPTIMIZED: 'Not optimized',
        OPTIMIZED: 'Optimized',
        OVER_PROVISIONED: 'Over provisioned',
        UNDER_PROVISIONED: 'Under provisioned',
        NOT_APPLICABLE: 'not-applicable'
    },
    GETWELL_DISPLAY: {
        NOT_APPLICABLE: 'Not applicable'
    },
    WELL_ARCHITECTED_STATUS: {
        NOT_APPLICABLE: 'not-applicable',
        NOT_AVAILABLE: 'not-available'
    },
    INVENTORY_STATUS: {
        CASE_SENSITIVE_UP: 'Up',
        RUNNING: 'RUNNING'
    },
    STATUS_CONST: {
        UP: 'up'
    },
    WLF_TABS: {
        DASHBOARD: 'dashboard'
    }
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        UNAVAILABLE: 'Unavailable'
    }
}));

describe('DashboardInnerPageHelper', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetState.mockReturnValue({
            getWellOptimize: {
                inProgressStateData: {},
                inProgressHostData: {}
            }
        });
    });

    // ============ sortOptimizeDashboardInnerTable ============
    describe('sortOptimizeDashboardInnerTable', () => {
        it('returns data as-is when empty', () => {
            expect(sortOptimizeDashboardInnerTable([])).toEqual([]);
        });

        it('returns data as-is with single item', () => {
            const data = [{ assessmentStatus: 'Not optimized' }];
            expect(sortOptimizeDashboardInnerTable(data)).toEqual(data);
        });

        it('returns null/undefined as-is', () => {
            expect(sortOptimizeDashboardInnerTable(null)).toBeNull();
            expect(sortOptimizeDashboardInnerTable(undefined)).toBeUndefined();
        });

        it('sorts by assessmentStatus weight descending', () => {
            const data = [
                { assessmentStatus: 'Optimized' },
                { assessmentStatus: 'Not optimized' },
                { assessmentStatus: 'Over provisioned' }
            ];
            const result = sortOptimizeDashboardInnerTable(data);
            expect(result[0].assessmentStatus).toBe('Not optimized');
            expect(result[1].assessmentStatus).toBe('Over provisioned');
            expect(result[2].assessmentStatus).toBe('Optimized');
        });

        it('sorts empty status in middle', () => {
            const data = [
                { assessmentStatus: 'Optimized' },
                { assessmentStatus: '' },
                { assessmentStatus: 'Not optimized' }
            ];
            const result = sortOptimizeDashboardInnerTable(data);
            expect(result[0].assessmentStatus).toBe('Not optimized');
        });

        it('sorts Under provisioned correctly', () => {
            const data = [
                { assessmentStatus: 'Optimized' },
                { assessmentStatus: 'Under provisioned' },
                { assessmentStatus: 'Not optimized' }
            ];
            const result = sortOptimizeDashboardInnerTable(data);
            expect(result[0].assessmentStatus).toBe('Not optimized');
            expect(result[1].assessmentStatus).toBe('Under provisioned');
            expect(result[2].assessmentStatus).toBe('Optimized');
        });

        it('handles items with undefined assessmentStatus', () => {
            const data = [
                { assessmentStatus: 'Optimized' },
                { assessmentStatus: undefined },
                { assessmentStatus: 'Not optimized' }
            ];
            const result = sortOptimizeDashboardInnerTable(data);
            expect(result[0].assessmentStatus).toBe('Not optimized');
        });
    });

    // ============ filterNotOptimizedRows ============
    describe('filterNotOptimizedRows', () => {
        it('returns rows with Up status and non-optimized assessment', () => {
            const data = [
                { status: 'Up', assessmentStatus: 'Not optimized' },
                { status: 'Down', assessmentStatus: 'Not optimized' },
                { status: 'Up', assessmentStatus: 'Optimized' },
                { status: 'Up', assessmentStatus: 'Not optimized' }
            ];
            const result = filterNotOptimizedRows(data);
            expect(result.length).toBe(2);
        });

        it('returns empty array when no matching rows', () => {
            const data = [{ status: 'Down', assessmentStatus: 'Not optimized' }];
            expect(filterNotOptimizedRows(data)).toEqual([]);
        });

        it('filters out rows with no assessmentStatus', () => {
            const data = [{ status: 'Up', assessmentStatus: null }];
            expect(filterNotOptimizedRows(data)).toEqual([]);
        });

        it('includes Over provisioned rows', () => {
            const data = [{ status: 'Up', assessmentStatus: 'Over provisioned' }];
            expect(filterNotOptimizedRows(data)).toHaveLength(1);
        });

        it('includes Under provisioned rows', () => {
            const data = [{ status: 'Up', assessmentStatus: 'Under provisioned' }];
            expect(filterNotOptimizedRows(data)).toHaveLength(1);
        });
    });

    // ============ getAssessmentStatusConsistency ============
    describe('getAssessmentStatusConsistency', () => {
        it('returns false for empty array', () => {
            expect(getAssessmentStatusConsistency([])).toBe(false);
        });

        it('returns false for single item array', () => {
            expect(getAssessmentStatusConsistency([{ assessmentStatus: 'Optimized' }])).toBe(false);
        });

        it('returns false when all items have same status', () => {
            const data = [{ assessmentStatus: 'Optimized' }, { assessmentStatus: 'Optimized' }];
            expect(getAssessmentStatusConsistency(data)).toBe(false);
        });

        it('returns true when items have different status', () => {
            const data = [{ assessmentStatus: 'Optimized' }, { assessmentStatus: 'Not optimized' }];
            expect(getAssessmentStatusConsistency(data)).toBe(true);
        });

        it('returns false for non-array input', () => {
            expect(getAssessmentStatusConsistency({ assessmentStatus: 'Optimized' })).toBe(false);
        });

        it('returns false for null input', () => {
            expect(getAssessmentStatusConsistency(null)).toBe(false);
        });

        it('returns false for string input', () => {
            expect(getAssessmentStatusConsistency('test')).toBe(false);
        });

        it('returns true for 3 items with mixed statuses', () => {
            const data = [
                { assessmentStatus: 'Optimized' },
                { assessmentStatus: 'Optimized' },
                { assessmentStatus: 'Not optimized' }
            ];
            expect(getAssessmentStatusConsistency(data)).toBe(true);
        });
    });

    // ============ calculatePostponeInfo ============
    describe('calculatePostponeInfo', () => {
        it('returns null when configObj is null', () => {
            expect(calculatePostponeInfo(null)).toBeNull();
        });

        it('returns null when configObj is undefined', () => {
            expect(calculatePostponeInfo(undefined)).toBeNull();
        });

        it('returns postpone info with valid dates', () => {
            const configObj = {
                startTime: '2024-01-01T00:00:00Z',
                endTime: '2028-12-31T00:00:00Z'
            };
            const result = calculatePostponeInfo(configObj);
            expect(result).toBeTruthy();
            expect(result).toHaveProperty('postponeDate');
            expect(result).toHaveProperty('daysLeft');
            expect(result!.daysLeft).toBeGreaterThan(0);
        });

        it('returns daysLeft as 0 for past endTime', () => {
            const configObj = {
                startTime: '2020-01-01T00:00:00Z',
                endTime: '2020-01-02T00:00:00Z'
            };
            const result = calculatePostponeInfo(configObj);
            expect(result?.daysLeft).toBe(0);
        });

        it('returns formatted date string', () => {
            const configObj = {
                startTime: '2024-06-15T00:00:00Z',
                endTime: '2024-07-15T00:00:00Z'
            };
            const result = calculatePostponeInfo(configObj);
            expect(result?.postponeDate).toContain('June');
            expect(result?.postponeDate).toContain('2024');
        });
    });

    // ============ checkSingleRowFix ============
    describe('checkSingleRowFix', () => {
        it('returns true when inProgressHostData includes rowData hostId', () => {
            const inProgressHostData = { 'Storage tier': ['host123'] };
            const rowData = { databaseHostId: 'host123', status: 'up' };
            expect(checkSingleRowFix(inProgressHostData, 'Storage tier', rowData)).toBe(true);
        });

        it('returns true when row status is not up', () => {
            const rowData = { databaseHostId: 'host1', status: 'Down' };
            expect(checkSingleRowFix({}, 'Storage tier', rowData)).toBe(true);
        });

        it('returns true when configState is ACTIVATING', () => {
            const rowData = { databaseHostId: 'host1', status: 'up', configState: 'ACTIVATING' };
            expect(checkSingleRowFix({}, 'Storage tier', rowData)).toBe(true);
        });

        it('returns true when assessmentStatus is Optimized', () => {
            const rowData = { databaseHostId: 'host1', status: 'up', assessmentStatus: 'Optimized' };
            expect(checkSingleRowFix({}, 'Storage tier', rowData)).toBe(true);
        });

        it('returns true when no assessmentStatus', () => {
            const rowData = { databaseHostId: 'host1', status: 'up' };
            expect(checkSingleRowFix({}, 'Storage tier', rowData)).toBe(true);
        });

        it('returns true when assessmentStatus is Not applicable display value', () => {
            const rowData = { databaseHostId: 'host1', status: 'up', assessmentStatus: 'Not applicable' };
            expect(checkSingleRowFix({}, 'Storage tier', rowData)).toBe(true);
        });

        it('returns true when assessmentStatus is Unavailable', () => {
            const rowData = { databaseHostId: 'host1', status: 'up', assessmentStatus: 'Unavailable' };
            expect(checkSingleRowFix({}, 'Storage tier', rowData)).toBe(true);
        });

        it('returns true when assessmentStatus is not-applicable backend value', () => {
            const rowData = { databaseHostId: 'host1', status: 'up', assessmentStatus: 'not-applicable' };
            expect(checkSingleRowFix({}, 'Storage tier', rowData)).toBe(true);
        });

        it('returns false for valid fixable row', () => {
            const rowData = {
                databaseHostId: 'host1',
                status: 'up',
                assessmentStatus: 'Not optimized'
            };
            expect(checkSingleRowFix({}, 'Storage tier', rowData)).toBe(false);
        });

        it('returns true for LOG_DRIVE_SIZE with over-provisioned and no under-provisioned', () => {
            const rowData = {
                databaseHostId: 'host1',
                status: 'up',
                assessmentStatus: 'Over provisioned',
                sizingViolations: {
                    overProvisionedDrives: ['driveA'],
                    underProvisionedDrives: []
                }
            };
            expect(checkSingleRowFix({}, 'Log drive size', rowData)).toBe(true);
        });

        it('returns true for TEMPDB_DRIVE_SIZE with over-provisioned without under-provisioned', () => {
            const rowData = {
                databaseHostId: 'host1',
                status: 'up',
                assessmentStatus: 'Over provisioned',
                sizingViolations: {
                    overProvisionedDrives: ['driveA'],
                    underProvisionedDrives: []
                }
            };
            expect(checkSingleRowFix({}, 'TempDB drive size', rowData)).toBe(true);
        });

        it('returns true for FILE_SYSTEM_HEADROOM with over-provisioned', () => {
            const rowData = {
                databaseHostId: 'host1',
                status: 'up',
                assessmentStatus: 'Over provisioned',
                sizingViolations: {
                    overProvisionedDrives: ['driveA'],
                    underProvisionedDrives: []
                }
            };
            expect(checkSingleRowFix({}, 'File system headroom', rowData)).toBe(true);
        });

        it('returns false for LOG_DRIVE_SIZE with both over and under provisioned', () => {
            const rowData = {
                databaseHostId: 'host1',
                status: 'up',
                assessmentStatus: 'Not optimized',
                sizingViolations: {
                    overProvisionedDrives: ['driveA'],
                    underProvisionedDrives: ['driveB']
                }
            };
            expect(checkSingleRowFix({}, 'Log drive size', rowData)).toBe(false);
        });

        it('returns true for LOG_DRIVE_SIZE with shared drive (not optimized, no under, has ignored)', () => {
            const rowData = {
                databaseHostId: 'host1',
                status: 'up',
                assessmentStatus: 'Not optimized',
                sizingViolations: {
                    underProvisionedDrives: [],
                    ignoredDrives: ['sharedDrive1']
                }
            };
            expect(checkSingleRowFix({}, 'Log drive size', rowData)).toBe(true);
        });

        it('returns true for FILE_SYSTEM_HEADROOM with shared drive', () => {
            const rowData = {
                databaseHostId: 'host1',
                status: 'up',
                assessmentStatus: 'Not optimized',
                sizingViolations: {
                    underProvisionedDrives: [],
                    ignoredDrives: ['sharedDrive1']
                }
            };
            expect(checkSingleRowFix({}, 'File system headroom', rowData)).toBe(true);
        });

        it('returns false for non-drive-size config with Not optimized', () => {
            const rowData = {
                databaseHostId: 'host1',
                status: 'up',
                assessmentStatus: 'Not optimized'
            };
            expect(checkSingleRowFix({}, 'ONTAP', rowData)).toBe(false);
        });
    });

    // ============ bulkFixDisableCheck ============
    describe('bulkFixDisableCheck', () => {
        const mockT = (key: string) => key;

        it('returns isFixDisabled=true for SCHEDULED_FSX_FOR_ONTAP_BACKUPS', () => {
            const result = bulkFixDisableCheck('Backup Configuration', false, [], mockT);
            expect(result.isFixDisabled).toBe(true);
            expect(result.fixDisableMsg).toBeTruthy();
        });

        it('returns isFixDisabled=true for DATA_DG_LUN_LAYOUT', () => {
            const result = bulkFixDisableCheck('ASM data disk group LUNs', false, [], mockT);
            expect(result.isFixDisabled).toBe(true);
        });

        it('returns isFixDisabled=true for LOG_DG_LUN_LAYOUT', () => {
            const result = bulkFixDisableCheck('ASM logs disk group LUNs', false, [], mockT);
            expect(result.isFixDisabled).toBe(true);
        });

        it('returns isFixDisabled=true for FRA_DG_LUN_LAYOUT', () => {
            const result = bulkFixDisableCheck('ASM FRA disk group LUNs', false, [], mockT);
            expect(result.isFixDisabled).toBe(true);
        });

        it('returns isFixDisabled=true for ARCHIVELOG_DG_LUN_LAYOUT', () => {
            const result = bulkFixDisableCheck('ASM archive log disk group LUNs', false, [], mockT);
            expect(result.isFixDisabled).toBe(true);
        });

        it('returns isFixDisabled=true when supportsDashboardBulkFix is false', () => {
            const result = bulkFixDisableCheck(
                'Thin provisioning',
                false,
                [{ assessmentStatus: 'Not optimized' }],
                mockT,
                undefined,
                false
            );
            expect(result.isFixDisabled).toBe(true);
            expect(result.fixDisableMsg).toBe('databases.well-architect.bulk-fix-not-supported');
        });

        it('returns isFixDisabled=true for TRANSPARENT_HUGEPAGES with correct disable message', () => {
            const result = bulkFixDisableCheck('Transparent hugepages', false, [], mockT);
            expect(result.isFixDisabled).toBe(true);
            expect(result.fixDisableMsg).toBe('databases.well-architect.bulk-fix-disable-for-transparent-hugepages');
        });

        it('returns isFixDisabled=true for TCP_ADVANCED_OPTIONS with correct disable message', () => {
            const result = bulkFixDisableCheck('TCP advanced options', false, [], mockT);
            expect(result.isFixDisabled).toBe(true);
            expect(result.fixDisableMsg).toBe('databases.well-architect.bulk-fix-disable-for-tcp-advanced-options');
        });

        it('returns isFixDisabled=true for MULTIPATH_READCOUNT with correct disable message', () => {
            const result = bulkFixDisableCheck('Multiblock read count', false, [], mockT);
            expect(result.isFixDisabled).toBe(true);
            expect(result.fixDisableMsg).toBe('databases.well-architect.bulk-fix-disable-for-multiblock-readcount');
        });

        it('returns isFixDisabled=true for FILESYSTEMS_IO_OPTIONS when isFixNotSupported is true', () => {
            const result = bulkFixDisableCheck('Filesystem I/O options', true, [], mockT);
            expect(result.isFixDisabled).toBe(true);
            expect(result.fixDisableMsg).toBe('databases.well-architect.fix-disabled');
        });

        it('returns isFixDisabled=true when isFixNotSupported=true', () => {
            const result = bulkFixDisableCheck('Storage tier', true, [], mockT);
            expect(result.isFixDisabled).toBe(true);
        });

        it('returns bulk-fix-not-supported when supportsDashboardBulkFix is false (snapcenter-snapshot)', () => {
            const rows = [{ assessmentStatus: 'Not optimized', status: 'Up' }];
            const result = bulkFixDisableCheck('snapcenter-snapshot', true, rows, mockT, 'MSSQL', false);
            expect(result.isFixDisabled).toBe(true);
            expect(result.fixDisableMsg).toBe('databases.well-architect.bulk-fix-not-supported');
        });

        it('returns isFixDisabled=true when all rows are optimized', () => {
            const rows = [
                { assessmentStatus: 'Optimized', status: 'Up' },
                { assessmentStatus: 'Optimized', status: 'Up' }
            ];
            const result = bulkFixDisableCheck('Storage tier', false, rows, mockT);
            expect(result.isFixDisabled).toBe(true);
        });

        it('returns isFixDisabled=true when all rows have no assessment status', () => {
            const rows = [
                { assessmentStatus: null, status: 'Up' },
                { assessmentStatus: 'Not applicable', status: 'Up' }
            ];
            const result = bulkFixDisableCheck('Storage tier', false, rows, mockT);
            expect(result.isFixDisabled).toBe(true);
        });

        it('returns isFixDisabled=true when all rows are not online', () => {
            const rows = [{ assessmentStatus: 'Not optimized', status: 'Down' }];
            const result = bulkFixDisableCheck('Storage tier', false, rows, mockT);
            expect(result.isFixDisabled).toBe(true);
        });

        it('returns isFixDisabled=true for COMPUTE_RIGHTSIZING with different hosts', () => {
            const rows = [
                { assessmentStatus: 'Not optimized', status: 'Up', databaseHostId: 'host1' },
                { assessmentStatus: 'Not optimized', status: 'Up', databaseHostId: 'host2' }
            ];
            const result = bulkFixDisableCheck('Compute rightsizing', false, rows, mockT);
            expect(result.isFixDisabled).toBe(true);
        });

        it('returns isFixDisabled=false for COMPUTE_RIGHTSIZING with same host', () => {
            const rows = [
                { assessmentStatus: 'Not optimized', status: 'Up', databaseHostId: 'host1' },
                { assessmentStatus: 'Not optimized', status: 'Up', databaseHostId: 'host1' }
            ];
            const result = bulkFixDisableCheck('Compute rightsizing', false, rows, mockT);
            expect(result.isFixDisabled).toBe(false);
        });

        it('returns isFixDisabled=true for LOG_DRIVE_SIZE with all overprovisioned drives', () => {
            const rows = [
                {
                    assessmentStatus: 'Over provisioned',
                    status: 'Up',
                    databaseHostId: 'host1',
                    sizingViolations: { overProvisionedDrives: ['d1'], underProvisionedDrives: [] }
                }
            ];
            const result = bulkFixDisableCheck('Log drive size', false, rows, mockT);
            expect(result.isFixDisabled).toBe(true);
        });

        it('returns isFixDisabled=true for TEMPDB_DRIVE_SIZE with all overprovisioned drives', () => {
            const rows = [
                {
                    assessmentStatus: 'Over provisioned',
                    status: 'Up',
                    databaseHostId: 'host1',
                    sizingViolations: { overProvisionedDrives: ['d1'], underProvisionedDrives: [] }
                }
            ];
            const result = bulkFixDisableCheck('TempDB drive size', false, rows, mockT);
            expect(result.isFixDisabled).toBe(true);
        });

        it('returns isFixDisabled=true for FILE_SYSTEM_HEADROOM with all overprovisioned drives', () => {
            const rows = [
                {
                    assessmentStatus: 'Over provisioned',
                    status: 'Up',
                    databaseHostId: 'host1',
                    sizingViolations: { overProvisionedDrives: ['d1'], underProvisionedDrives: [] }
                }
            ];
            const result = bulkFixDisableCheck('File system headroom', false, rows, mockT);
            expect(result.isFixDisabled).toBe(true);
        });

        it('returns isFixDisabled=true for shared drives on drive size configs', () => {
            const rows = [
                {
                    assessmentStatus: 'Not optimized',
                    status: 'Up',
                    databaseHostId: 'host1',
                    sizingViolations: { underProvisionedDrives: [], ignoredDrives: ['shared1'] }
                }
            ];
            const result = bulkFixDisableCheck('Log drive size', false, rows, mockT);
            expect(result.isFixDisabled).toBe(true);
        });

        it('returns isFixDisabled=true for FILE_SYSTEM_HEADROOM shared drives', () => {
            const rows = [
                {
                    assessmentStatus: 'Not optimized',
                    status: 'Up',
                    databaseHostId: 'host1',
                    sizingViolations: { underProvisionedDrives: [], ignoredDrives: ['shared1'] }
                }
            ];
            const result = bulkFixDisableCheck('File system headroom', false, rows, mockT);
            expect(result.isFixDisabled).toBe(true);
        });

        it('returns isFixDisabled=true for TEMPDB_DRIVE_SIZE shared drives', () => {
            const rows = [
                {
                    assessmentStatus: 'Not optimized',
                    status: 'Up',
                    databaseHostId: 'host1',
                    sizingViolations: { underProvisionedDrives: [], ignoredDrives: ['shared1'] }
                }
            ];
            const result = bulkFixDisableCheck('TempDB drive size', false, rows, mockT);
            expect(result.isFixDisabled).toBe(true);
        });

        it('returns isFixDisabled=false for Storage tier with valid fixable rows', () => {
            const rows = [
                { assessmentStatus: 'Not optimized', status: 'Up', databaseHostId: 'host1' },
                { assessmentStatus: 'Not optimized', status: 'Up', databaseHostId: 'host2' }
            ];
            const result = bulkFixDisableCheck('Storage tier', false, rows, mockT);
            expect(result.isFixDisabled).toBe(false);
        });

        it('returns isFixDisabled=true when checkIfAllRowsNotFixable (all in progress)', () => {
            mockGetState.mockReturnValue({
                getWellOptimize: {
                    inProgressStateData: {},
                    inProgressHostData: { 'Storage tier': ['host1', 'host2'] }
                }
            });
            const rows = [
                { assessmentStatus: 'Not optimized', status: 'Up', databaseHostId: 'host1' },
                { assessmentStatus: 'Not optimized', status: 'Up', databaseHostId: 'host2' }
            ];
            const result = bulkFixDisableCheck('Storage tier', false, rows, mockT);
            expect(result.isFixDisabled).toBe(true);
        });
    });

    // ============ callDashboardDismissApi ============
    describe('callDashboardDismissApi', () => {
        it('dispatches setInProgressStateData and calls dismissApi', async () => {
            const dismissApi = vi.fn(() => Promise.resolve({ data: {} }));
            const dispatch = vi.fn();
            const translation = (key: string) => key;

            const rowData = [
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst1',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server1'
                }
            ];

            callDashboardDismissApi('Storage tier', rowData, 'DISMISSED', dismissApi, dispatch, translation);

            // Should call dismiss API
            expect(dismissApi).toHaveBeenCalled();
            // Should dispatch setInProgressStateData
            expect(dispatch).toHaveBeenCalled();
        });

        it('handles successful dismiss for single MSSQL row', async () => {
            const successList = [{ credentialId: 'c1', regionId: 'r1', hostId: 'h1', instanceId: 'i1' }];
            mockCategorizeStateInstances.mockReturnValue({ successList, failedList: [] });

            const dismissApi = vi.fn(() => Promise.resolve({ data: { configurations: [] } }));
            const dispatch = vi.fn();
            const translation = (key: string) => key;

            const rowData = [
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst1',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server1'
                }
            ];

            callDashboardDismissApi('Storage tier', rowData, 'DISMISSED', dismissApi, dispatch, translation, 'MSSQL');

            await new Promise(r => setTimeout(r, 50));
            expect(dismissApi).toHaveBeenCalled();
            expect(mockUpdateConfigStateStatus).toHaveBeenCalled();
        });

        it('handles successful dismiss for Oracle row', async () => {
            const successList = [{ credentialId: 'c1', regionId: 'r1', hostId: 'h1', instanceId: 'i1' }];
            mockCategorizeStateInstances.mockReturnValue({ successList, failedList: [] });

            const dismissApi = vi.fn(() => Promise.resolve({ data: {} }));
            const dispatch = vi.fn();
            const translation = (key: string) => key;

            const rowData = [
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst1',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server1'
                }
            ];

            callDashboardDismissApi('Storage tier', rowData, 'DISMISSED', dismissApi, dispatch, translation, 'ORACLE');

            await new Promise(r => setTimeout(r, 50));
            expect(dismissApi).toHaveBeenCalled();
            expect(mockUpdateConfigStateStatusOracle).toHaveBeenCalled();
        });

        it('handles API error response', async () => {
            const dismissApi = vi.fn(() => Promise.resolve({ error: 'some error' }));
            const dispatch = vi.fn();
            const translation = (key: string) => key;

            const rowData = [
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst1',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server1'
                }
            ];

            callDashboardDismissApi('Storage tier', rowData, 'DISMISSED', dismissApi, dispatch, translation);

            await new Promise(r => setTimeout(r, 50));
            expect(dispatch).toHaveBeenCalled();
        });

        it('handles API rejection', async () => {
            const dismissApi = vi.fn(() => Promise.reject('network error'));
            const dispatch = vi.fn();
            const translation = (key: string) => key;

            const rowData = [
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst1',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server1'
                }
            ];

            callDashboardDismissApi('Storage tier', rowData, 'DISMISSED', dismissApi, dispatch, translation);

            await new Promise(r => setTimeout(r, 50));
            expect(dispatch).toHaveBeenCalled();
        });

        it('handles POSTPONED action', async () => {
            const successList = [{ credentialId: 'c1', regionId: 'r1', hostId: 'h1', instanceId: 'i1' }];
            mockCategorizeStateInstances.mockReturnValue({ successList, failedList: [] });

            const dismissApi = vi.fn(() => Promise.resolve({ data: {} }));
            const dispatch = vi.fn();
            const translation = (key: string) => key;

            const rowData = [
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst1',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server1'
                }
            ];

            callDashboardDismissApi('Storage tier', rowData, 'POSTPONED', dismissApi, dispatch, translation);

            await new Promise(r => setTimeout(r, 50));
            expect(dismissApi).toHaveBeenCalled();
        });

        it('handles ACTIVE action', async () => {
            const successList = [{ credentialId: 'c1', regionId: 'r1', hostId: 'h1', instanceId: 'i1' }];
            mockCategorizeStateInstances.mockReturnValue({ successList, failedList: [] });

            const dismissApi = vi.fn(() => Promise.resolve({ data: {} }));
            const dispatch = vi.fn();
            const translation = (key: string) => key;

            const rowData = [
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst1',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'DISMISSED',
                    serverInstanceName: 'server1'
                }
            ];

            callDashboardDismissApi('Storage tier', rowData, 'ACTIVE', dismissApi, dispatch, translation);

            await new Promise(r => setTimeout(r, 50));
            expect(dismissApi).toHaveBeenCalled();
        });

        it('handles bulk dismiss with multiple rows', async () => {
            const successList = [
                { credentialId: 'c1', regionId: 'r1', hostId: 'h1', instanceId: 'i1' },
                { credentialId: 'c1', regionId: 'r1', hostId: 'h1', instanceId: 'i2' }
            ];
            mockCategorizeStateInstances.mockReturnValue({ successList, failedList: [] });

            const dismissApi = vi.fn(() => Promise.resolve({ data: {} }));
            const dispatch = vi.fn();
            const translation = (key: string) => key;

            const rowData = [
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst1',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server1'
                },
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst2',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server2'
                }
            ];

            callDashboardDismissApi('Storage tier', rowData, 'DISMISSED', dismissApi, dispatch, translation);

            await new Promise(r => setTimeout(r, 50));
            expect(dismissApi).toHaveBeenCalled();
        });

        it('handles mixed success and failure', async () => {
            const successList = [{ credentialId: 'c1', regionId: 'r1', hostId: 'h1', instanceId: 'i1' }];
            const failedList = [{ credentialId: 'c2', regionId: 'r2', hostId: 'h2', instanceId: 'i2' }];
            mockCategorizeStateInstances.mockReturnValue({ successList, failedList });

            const dismissApi = vi.fn(() => Promise.resolve({ data: {} }));
            const dispatch = vi.fn();
            const translation = (key: string) => key;

            const rowData = [
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst1',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server1'
                },
                {
                    databaseHostId: 'host2',
                    instanceId: 'inst2',
                    hostName: 'hostname2',
                    credentialId: 'cred2',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server2'
                }
            ];

            callDashboardDismissApi('Storage tier', rowData, 'DISMISSED', dismissApi, dispatch, translation, 'MSSQL');

            await new Promise(r => setTimeout(r, 50));
            expect(dismissApi).toHaveBeenCalled();
        });

        it('handles single row failure', async () => {
            const failedList = [{ credentialId: 'c1', regionId: 'r1', hostId: 'h1', instanceId: 'i1' }];
            mockCategorizeStateInstances.mockReturnValue({ successList: [], failedList });

            const dismissApi = vi.fn(() => Promise.resolve({ data: {} }));
            const dispatch = vi.fn();
            const translation = (key: string) => key;

            const rowData = [
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst1',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server1'
                }
            ];

            callDashboardDismissApi('Storage tier', rowData, 'DISMISSED', dismissApi, dispatch, translation);

            await new Promise(r => setTimeout(r, 50));
            expect(dismissApi).toHaveBeenCalled();
        });

        it('handles single row POSTPONED failure', async () => {
            const failedList = [{ credentialId: 'c1', regionId: 'r1', hostId: 'h1', instanceId: 'i1' }];
            mockCategorizeStateInstances.mockReturnValue({ successList: [], failedList });

            const dismissApi = vi.fn(() => Promise.resolve({ data: {} }));
            const dispatch = vi.fn();
            const translation = (key: string) => key;

            const rowData = [
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst1',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server1'
                }
            ];

            callDashboardDismissApi('Storage tier', rowData, 'POSTPONED', dismissApi, dispatch, translation);

            await new Promise(r => setTimeout(r, 50));
            expect(dismissApi).toHaveBeenCalled();
        });

        it('handles single row ACTIVE failure', async () => {
            const failedList = [{ credentialId: 'c1', regionId: 'r1', hostId: 'h1', instanceId: 'i1' }];
            mockCategorizeStateInstances.mockReturnValue({ successList: [], failedList });

            const dismissApi = vi.fn(() => Promise.resolve({ data: {} }));
            const dispatch = vi.fn();
            const translation = (key: string) => key;

            const rowData = [
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst1',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'DISMISSED',
                    serverInstanceName: 'server1'
                }
            ];

            callDashboardDismissApi('Storage tier', rowData, 'ACTIVE', dismissApi, dispatch, translation);

            await new Promise(r => setTimeout(r, 50));
            expect(dismissApi).toHaveBeenCalled();
        });

        it('handles bulk only failures for DISMISSED', async () => {
            const failedList = [
                { credentialId: 'c1', regionId: 'r1', hostId: 'h1', instanceId: 'i1' },
                { credentialId: 'c2', regionId: 'r2', hostId: 'h2', instanceId: 'i2' }
            ];
            mockCategorizeStateInstances.mockReturnValue({ successList: [], failedList });

            const dismissApi = vi.fn(() => Promise.resolve({ data: {} }));
            const dispatch = vi.fn();
            const translation = (key: string) => key;

            const rowData = [
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst1',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server1'
                },
                {
                    databaseHostId: 'host2',
                    instanceId: 'inst2',
                    hostName: 'hostname2',
                    credentialId: 'cred2',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server2'
                }
            ];

            callDashboardDismissApi('Storage tier', rowData, 'DISMISSED', dismissApi, dispatch, translation);

            await new Promise(r => setTimeout(r, 50));
            expect(dismissApi).toHaveBeenCalled();
        });

        it('handles bulk only failures for POSTPONED', async () => {
            const failedList = [
                { credentialId: 'c1', regionId: 'r1', hostId: 'h1', instanceId: 'i1' },
                { credentialId: 'c2', regionId: 'r2', hostId: 'h2', instanceId: 'i2' }
            ];
            mockCategorizeStateInstances.mockReturnValue({ successList: [], failedList });

            const dismissApi = vi.fn(() => Promise.resolve({ data: {} }));
            const dispatch = vi.fn();
            const translation = (key: string) => key;

            const rowData = [
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst1',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server1'
                },
                {
                    databaseHostId: 'host2',
                    instanceId: 'inst2',
                    hostName: 'hostname2',
                    credentialId: 'cred2',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server2'
                }
            ];

            callDashboardDismissApi('Storage tier', rowData, 'POSTPONED', dismissApi, dispatch, translation);

            await new Promise(r => setTimeout(r, 50));
            expect(dismissApi).toHaveBeenCalled();
        });

        it('handles bulk only failures for ACTIVE', async () => {
            const failedList = [
                { credentialId: 'c1', regionId: 'r1', hostId: 'h1', instanceId: 'i1' },
                { credentialId: 'c2', regionId: 'r2', hostId: 'h2', instanceId: 'i2' }
            ];
            mockCategorizeStateInstances.mockReturnValue({ successList: [], failedList });

            const dismissApi = vi.fn(() => Promise.resolve({ data: {} }));
            const dispatch = vi.fn();
            const translation = (key: string) => key;

            const rowData = [
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst1',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'DISMISSED',
                    serverInstanceName: 'server1'
                },
                {
                    databaseHostId: 'host2',
                    instanceId: 'inst2',
                    hostName: 'hostname2',
                    credentialId: 'cred2',
                    regionId: 'us-east-1',
                    configState: 'DISMISSED',
                    serverInstanceName: 'server2'
                }
            ];

            callDashboardDismissApi('Storage tier', rowData, 'ACTIVE', dismissApi, dispatch, translation);

            await new Promise(r => setTimeout(r, 50));
            expect(dismissApi).toHaveBeenCalled();
        });

        it('handles bulk success-only for DISMISSED', async () => {
            const successList = [
                { credentialId: 'c1', regionId: 'r1', hostId: 'h1', instanceId: 'i1' },
                { credentialId: 'c2', regionId: 'r2', hostId: 'h2', instanceId: 'i2' }
            ];
            mockCategorizeStateInstances.mockReturnValue({ successList, failedList: [] });

            const dismissApi = vi.fn(() => Promise.resolve({ data: {} }));
            const dispatch = vi.fn();
            const translation = (key: string) => key;

            const rowData = [
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst1',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server1'
                },
                {
                    databaseHostId: 'host2',
                    instanceId: 'inst2',
                    hostName: 'hostname2',
                    credentialId: 'cred2',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server2'
                }
            ];

            callDashboardDismissApi('Storage tier', rowData, 'DISMISSED', dismissApi, dispatch, translation);

            await new Promise(r => setTimeout(r, 50));
            expect(dismissApi).toHaveBeenCalled();
        });

        it('handles bulk success-only for POSTPONED', async () => {
            const successList = [
                { credentialId: 'c1', regionId: 'r1', hostId: 'h1', instanceId: 'i1' },
                { credentialId: 'c2', regionId: 'r2', hostId: 'h2', instanceId: 'i2' }
            ];
            mockCategorizeStateInstances.mockReturnValue({ successList, failedList: [] });

            const dismissApi = vi.fn(() => Promise.resolve({ data: {} }));
            const dispatch = vi.fn();
            const translation = (key: string) => key;

            const rowData = [
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst1',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server1'
                },
                {
                    databaseHostId: 'host2',
                    instanceId: 'inst2',
                    hostName: 'hostname2',
                    credentialId: 'cred2',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server2'
                }
            ];

            callDashboardDismissApi('Storage tier', rowData, 'POSTPONED', dismissApi, dispatch, translation);

            await new Promise(r => setTimeout(r, 50));
            expect(dismissApi).toHaveBeenCalled();
        });

        it('handles bulk success-only for ACTIVE', async () => {
            const successList = [
                { credentialId: 'c1', regionId: 'r1', hostId: 'h1', instanceId: 'i1' },
                { credentialId: 'c2', regionId: 'r2', hostId: 'h2', instanceId: 'i2' }
            ];
            mockCategorizeStateInstances.mockReturnValue({ successList, failedList: [] });

            const dismissApi = vi.fn(() => Promise.resolve({ data: {} }));
            const dispatch = vi.fn();
            const translation = (key: string) => key;

            const rowData = [
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst1',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'DISMISSED',
                    serverInstanceName: 'server1'
                },
                {
                    databaseHostId: 'host2',
                    instanceId: 'inst2',
                    hostName: 'hostname2',
                    credentialId: 'cred2',
                    regionId: 'us-east-1',
                    configState: 'DISMISSED',
                    serverInstanceName: 'server2'
                }
            ];

            callDashboardDismissApi('Storage tier', rowData, 'ACTIVE', dismissApi, dispatch, translation);

            await new Promise(r => setTimeout(r, 50));
            expect(dismissApi).toHaveBeenCalled();
        });

        it('handles mixed results for POSTPONED', async () => {
            const successList = [{ credentialId: 'c1', regionId: 'r1', hostId: 'h1', instanceId: 'i1' }];
            const failedList = [{ credentialId: 'c2', regionId: 'r2', hostId: 'h2', instanceId: 'i2' }];
            mockCategorizeStateInstances.mockReturnValue({ successList, failedList });

            const dismissApi = vi.fn(() => Promise.resolve({ data: {} }));
            const dispatch = vi.fn();
            const translation = (key: string) => key;

            const rowData = [
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst1',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server1'
                },
                {
                    databaseHostId: 'host2',
                    instanceId: 'inst2',
                    hostName: 'hostname2',
                    credentialId: 'cred2',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server2'
                }
            ];

            callDashboardDismissApi('Storage tier', rowData, 'POSTPONED', dismissApi, dispatch, translation);

            await new Promise(r => setTimeout(r, 50));
            expect(dismissApi).toHaveBeenCalled();
        });

        it('handles mixed results for ACTIVE', async () => {
            const successList = [{ credentialId: 'c1', regionId: 'r1', hostId: 'h1', instanceId: 'i1' }];
            const failedList = [{ credentialId: 'c2', regionId: 'r2', hostId: 'h2', instanceId: 'i2' }];
            mockCategorizeStateInstances.mockReturnValue({ successList, failedList });

            const dismissApi = vi.fn(() => Promise.resolve({ data: {} }));
            const dispatch = vi.fn();
            const translation = (key: string) => key;

            const rowData = [
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst1',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'DISMISSED',
                    serverInstanceName: 'server1'
                },
                {
                    databaseHostId: 'host2',
                    instanceId: 'inst2',
                    hostName: 'hostname2',
                    credentialId: 'cred2',
                    regionId: 'us-east-1',
                    configState: 'DISMISSED',
                    serverInstanceName: 'server2'
                }
            ];

            callDashboardDismissApi('Storage tier', rowData, 'ACTIVE', dismissApi, dispatch, translation);

            await new Promise(r => setTimeout(r, 50));
            expect(dismissApi).toHaveBeenCalled();
        });

        it('calls getPayloadType mapping for different config types', async () => {
            const dismissApi = vi.fn(() => Promise.resolve({ data: {} }));
            const dispatch = vi.fn();
            const translation = (key: string) => key;
            const rowData = [
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst1',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'ACTIVE',
                    serverInstanceName: 'server1'
                }
            ];

            // Test different config types to cover getPayloadType switch cases
            const configTypes = [
                'ONTAP',
                'Operating system',
                'Microsoft SQL Server High Availability',
                'Storage tier',
                'File system headroom',
                'Log drive size',
                'TempDB drive size',
                'Swap space',
                'Data files (.mdf)',
                'Log files (.ldf)',
                'TempDB placement',
                'Compute rightsizing',
                'Network adapter settings',
                'Scheduled local snapshot',
                'Backup Configuration',
                'MAXDOP',
                'Microsoft SQL Server patch',
                'Operating system patch',
                'License',
                'Crr',
                'Clone cleanup',
                'MTU alignment',
                'Oracle binary placement',
                'Data files placement',
                'Control files placement',
                'Redo logs placement',
                'Temp placement',
                'Archive placement',
                'ASM data disk group LUNs',
                'ASM logs disk group LUNs',
                'ASM FRA disk group LUNs',
                'ASM archive log disk group LUNs',
                'Transparent hugepages',
                'TCP advanced options',
                'Filesystem I/O options',
                'Multiblock read count',
                'UNKNOWN_TYPE'
            ];

            for (const configType of configTypes) {
                dismissApi.mockClear();
                callDashboardDismissApi(configType, rowData, 'DISMISSED', dismissApi, dispatch, translation);
                expect(dismissApi).toHaveBeenCalled();
            }
        });

        it('skips row in payload when configState matches action', async () => {
            const dismissApi = vi.fn(() => Promise.resolve({ data: {} }));
            const dispatch = vi.fn();
            const translation = (key: string) => key;

            const rowData = [
                {
                    databaseHostId: 'host1',
                    instanceId: 'inst1',
                    hostName: 'hostname1',
                    credentialId: 'cred1',
                    regionId: 'us-east-1',
                    configState: 'DISMISSED',
                    serverInstanceName: 'server1'
                }
            ];

            callDashboardDismissApi('Storage tier', rowData, 'DISMISSED', dismissApi, dispatch, translation);

            await new Promise(r => setTimeout(r, 50));
            expect(dismissApi).toHaveBeenCalled();
        });
    });
});
