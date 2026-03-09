import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
    isOptimized,
    isOptimizedDashInner,
    isActivating,
    isDismissed,
    hasPostponedOrDismissed,
    checkConfigState,
    setConfigState,
    filterDatabaseRowsForNonAsm,
    getTotalManagedAggrCost,
    getManagedHostCountFromInventory,
    getManagedHostCount,
    getManagedAggrProtection,
    getManagedAggrStorageSavings,
    getManageAggrCost,
    getPotentialSavingsValues,
    getManagedInstanceOptimizationSummary,
    getErrorInvestigationSummary,
    getAssessmentGroupedByCategory,
    getAssessmentGroupedByConfigurations,
    getConfigStateList,
    disableOfflineRows,
    mapHostStatusToAssessmentData,
    formatAssessmentTableData,
    categorizeStateInstances,
    createLogAnalyzerNotActiveInstance,
    createLogAnalyzerActiveInstance,
    getManagedOptimizationSummary,
    getAssessmentHostListGroupedByCategory
} from '../DatabaseHomeUtils';

import {
    isAoagDeployment as mockIsAoagDeployment,
    isMssqlHaDeployment as mockIsMssqlHaDeployment
} from '../../GetWell/GetWellUtils';

// ── Mock store & dependencies before importing utils ────────────────────────
const { mockGetState } = vi.hoisted(() => ({
    mockGetState: vi.fn(() => ({
        headers: {
            headerSelectedMultiCredIdsList: ['cred1'],
            headerSelectedMultiRegionIdsList: ['us-east-1']
        },
        inventoryV2: {
            inventoryTableData: null,
            allLogAnalysisData: [],
            allLogAnalysisLoading: false
        }
    }))
}));

vi.mock('../../../store/store', () => ({
    default: { getState: mockGetState, dispatch: vi.fn() }
}));

vi.mock('../../../store/workloadFactory/inventoryV2Slice', () => ({
    setManagedHostInstanceLoading: vi.fn((v: any) => ({ type: 'setManagedHostInstanceLoading', payload: v }))
}));

vi.mock('../../GetWell/GetWellUtils', () => ({
    isAoagDeployment: vi.fn(() => false),
    isMssqlHaDeployment: vi.fn(() => false),
    formatOptimizationBreakDown: vi.fn(),
    getCardsData: vi.fn()
}));

vi.mock('../../InventoryV2/InventoryUtilsV2', () => ({
    uniqueHostRow: vi.fn(() => [])
}));

vi.mock('../../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils', () => ({
    formatOracleOptimizationBreakDown: vi.fn(),
    getOracleCardsData: vi.fn()
}));

describe('isOptimized', () => {
    it('returns true when status is OPTIMIZED', () => {
        expect(isOptimized('OPTIMIZED')).toBe(true);
    });

    it('returns true when status is optimized (case-insensitive)', () => {
        expect(isOptimized('optimized')).toBe(true);
    });

    it('returns true when status is ANALYZING', () => {
        expect(isOptimized('ANALYZING')).toBe(true);
    });

    it('returns true when dismissState is DISMISSED', () => {
        expect(isOptimized('NOT_OPTIMIZED', 'DISMISSED')).toBe(true);
    });

    it('returns true when dismissState is POSTPONED', () => {
        expect(isOptimized('NOT_OPTIMIZED', 'POSTPONED')).toBe(true);
    });

    it('returns true when dismissState is ACTIVATING', () => {
        expect(isOptimized('NOT_OPTIMIZED', 'ACTIVATING')).toBe(true);
    });

    it('returns false when status is NOT_OPTIMIZED and no dismiss state', () => {
        expect(isOptimized('NOT_OPTIMIZED')).toBe(false);
    });

    it('returns false when undefined', () => {
        expect(isOptimized(undefined)).toBe(false);
    });
});

describe('isOptimizedDashInner', () => {
    it('returns true when optimized and no dismiss state', () => {
        expect(isOptimizedDashInner('OPTIMIZED')).toBe(true);
    });

    it('returns false when status is OPTIMIZED but dismissed', () => {
        expect(isOptimizedDashInner('OPTIMIZED', 'DISMISSED')).toBe(false);
    });

    it('returns false when status is OPTIMIZED but postponed', () => {
        expect(isOptimizedDashInner('OPTIMIZED', 'POSTPONED')).toBe(false);
    });

    it('returns false when status is OPTIMIZED but activating', () => {
        expect(isOptimizedDashInner('OPTIMIZED', 'ACTIVATING')).toBe(false);
    });

    it('returns false when status is NOT_OPTIMIZED', () => {
        expect(isOptimizedDashInner('NOT_OPTIMIZED')).toBe(false);
    });
});

describe('isActivating', () => {
    it('returns true when state is ACTIVATING', () => {
        expect(isActivating('ACTIVATING')).toBe(true);
    });

    it('returns false when state is DISMISSED', () => {
        expect(isActivating('DISMISSED')).toBe(false);
    });

    it('returns false when state is undefined', () => {
        expect(isActivating(undefined)).toBe(false);
    });
});

describe('isDismissed', () => {
    it('returns true when state is DISMISSED', () => {
        expect(isDismissed('DISMISSED')).toBe(true);
    });

    it('returns true when state is POSTPONED', () => {
        expect(isDismissed('POSTPONED')).toBe(true);
    });

    it('returns false when state is ACTIVE', () => {
        expect(isDismissed('ACTIVE')).toBe(false);
    });

    it('returns false when undefined', () => {
        expect(isDismissed(undefined)).toBe(false);
    });
});

describe('hasPostponedOrDismissed', () => {
    it('returns false for null', () => {
        expect(hasPostponedOrDismissed(null)).toBe(false);
    });

    it('returns false for primitive', () => {
        expect(hasPostponedOrDismissed('string')).toBe(false);
    });

    it('returns true when nested configState is POSTPONED', () => {
        const obj = { compute: { configState: 'POSTPONED' } };
        expect(hasPostponedOrDismissed(obj)).toBe(true);
    });

    it('returns true when nested configState is DISMISSED', () => {
        const obj = { compute: { configState: 'DISMISSED' } };
        expect(hasPostponedOrDismissed(obj)).toBe(true);
    });

    it('returns false when no POSTPONED or DISMISSED state', () => {
        const obj = { compute: { configState: 'ACTIVE' } };
        expect(hasPostponedOrDismissed(obj)).toBe(false);
    });

    it('returns false for empty object', () => {
        expect(hasPostponedOrDismissed({})).toBe(false);
    });
});

describe('checkConfigState', () => {
    it('returns true for DISMISSED when list contains DISMISSED only', () => {
        expect(checkConfigState(['DISMISSED'], 'DISMISSED')).toBe(true);
    });

    it('returns false for DISMISSED when ACTIVE is also in list', () => {
        expect(checkConfigState(['DISMISSED', 'ACTIVE'], 'DISMISSED')).toBe(false);
    });

    it('returns true for ACTIVATING when only ACTIVATING in list', () => {
        expect(checkConfigState(['ACTIVATING'], 'ACTIVATING')).toBe(true);
    });

    it('returns false for ACTIVATING when ACTIVE also present', () => {
        expect(checkConfigState(['ACTIVATING', 'ACTIVE'], 'ACTIVATING')).toBe(false);
    });

    it('returns true for ACTIVE when only ACTIVE in list', () => {
        expect(checkConfigState(['ACTIVE'], 'ACTIVE')).toBe(true);
    });

    it('returns false for ACTIVE when DISMISSED also present', () => {
        expect(checkConfigState(['ACTIVE', 'DISMISSED'], 'ACTIVE')).toBe(false);
    });

    it('returns true for PARTIAL when ACTIVE and DISMISSED both present', () => {
        expect(checkConfigState(['ACTIVE', 'DISMISSED'], 'PARTIAL')).toBe(true);
    });

    it('returns false for PARTIAL when only ACTIVE in list', () => {
        expect(checkConfigState(['ACTIVE'], 'PARTIAL')).toBe(false);
    });

    it('returns false for unknown state', () => {
        expect(checkConfigState(['ACTIVE'], 'UNKNOWN')).toBe(false);
    });
});

describe('setConfigState', () => {
    it('initializes array and adds state', () => {
        const configState: any = {};
        setConfigState(configState, 'compute', 'DISMISSED');
        expect(configState.compute).toContain('DISMISSED');
    });

    it('does not duplicate state', () => {
        const configState: any = { compute: ['DISMISSED'] };
        setConfigState(configState, 'compute', 'DISMISSED');
        expect(configState.compute).toEqual(['DISMISSED']);
    });

    it('adds ACTIVE when state is empty string', () => {
        const configState: any = {};
        setConfigState(configState, 'compute', '');
        expect(configState.compute).toContain('ACTIVE');
    });

    it('returns the configState object', () => {
        const configState: any = {};
        const result = setConfigState(configState, 'rss', 'POSTPONED');
        expect(result).toBe(configState);
    });
});

describe('filterDatabaseRowsForNonAsm', () => {
    it('returns true for non-ASM config names', () => {
        expect(filterDatabaseRowsForNonAsm('compute', {})).toBe(true);
    });

    it('returns false for data-dg-lun-layout when not ASM managed', () => {
        expect(filterDatabaseRowsForNonAsm('data-dg-lun-layout', { isASMManaged: false })).toBe(false);
    });

    it('returns false for data-dg-lun-layout when not iSCSI protocol', () => {
        expect(filterDatabaseRowsForNonAsm('data-dg-lun-layout', { isASMManaged: true, storageProtocol: 'NFS' })).toBe(
            false
        );
    });

    it('returns true for data-dg-lun-layout when ASM managed and iSCSI', () => {
        expect(
            filterDatabaseRowsForNonAsm('data-dg-lun-layout', { isASMManaged: true, storageProtocol: 'iSCSI' })
        ).toBe(true);
    });

    it('returns false for fra-dg-lun-layout when not in storage layout', () => {
        const data = {
            isASMManaged: true,
            storageProtocol: 'iSCSI',
            storage: { layout: [{ name: 'data-dg-lun-layout' }] }
        };
        expect(filterDatabaseRowsForNonAsm('fra-dg-lun-layout', data)).toBe(false);
    });

    it('returns true for fra-dg-lun-layout when present in storage layout', () => {
        const data = {
            isASMManaged: true,
            storageProtocol: 'iSCSI',
            storage: { layout: [{ name: 'fra-dg-lun-layout' }] }
        };
        expect(filterDatabaseRowsForNonAsm('fra-dg-lun-layout', data)).toBe(true);
    });

    it('returns false for archivelog-dg-lun-layout when not in storage layout', () => {
        const data = {
            isASMManaged: true,
            storageProtocol: 'iSCSI',
            storage: { layout: [{ name: 'data-dg-lun-layout' }] }
        };
        expect(filterDatabaseRowsForNonAsm('archivelog-dg-lun-layout', data)).toBe(false);
    });
});

describe('getTotalManagedAggrCost', () => {
    it('sums costs from two cost objects', () => {
        const mssql = {
            storageCost: '100',
            computeCost: '200',
            connectivityCost: '50',
            otherCost: '10',
            totalCost: '360',
            requireBillingPerm: false,
            noDeploymentChk: false
        };
        const pgsql = {
            storageCost: '50',
            computeCost: '100',
            connectivityCost: '25',
            otherCost: '5',
            totalCost: '180',
            requireBillingPerm: false,
            noDeploymentChk: false
        };
        const result = getTotalManagedAggrCost(mssql, pgsql);
        expect(parseInt(result.storageCost)).toBe(150);
        expect(parseInt(result.computeCost)).toBe(300);
    });

    it('returns requireBillingPerm true when either source has it', () => {
        const mssql = {
            storageCost: '0',
            computeCost: '0',
            connectivityCost: '0',
            otherCost: '0',
            totalCost: '0',
            requireBillingPerm: true,
            noDeploymentChk: false
        };
        const pgsql = {
            storageCost: '0',
            computeCost: '0',
            connectivityCost: '0',
            otherCost: '0',
            totalCost: '0',
            requireBillingPerm: false,
            noDeploymentChk: false
        };
        const result = getTotalManagedAggrCost(mssql, pgsql);
        expect(result.requireBillingPerm).toBe(true);
    });
});

describe('getManagedHostCountFromInventory', () => {
    const mockDispatch = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns empty array when inventoryTableData is null', () => {
        const result = getManagedHostCountFromInventory(null, mockDispatch);
        expect(result).toEqual([]);
    });

    it('counts managed MSSQL hosts correctly', () => {
        const inventoryTableData = {
            host1: {
                credentialId: 'cred1',
                regionId: 'us-east-1',
                resourceId: 'res1',
                managedInstance: 1,
                hostType: 'MSSQL',
                sqlServerInstances: [{ statusColText: 'Managed', databaseCount: 3 }]
            }
        };
        const result: any = getManagedHostCountFromInventory(inventoryTableData, mockDispatch, 'MSSQL');
        expect(result.totalHosts).toBe(1);
        expect(result.managedInstances).toBe(1);
        expect(result.totalDatabases).toBe(3);
        expect(result.managedDatabases).toBe(3);
    });

    it('skips entries not in selected creds/regions', () => {
        const inventoryTableData = {
            host1: {
                credentialId: 'other-cred',
                regionId: 'eu-west-1',
                resourceId: 'res1',
                managedInstance: 1,
                hostType: 'MSSQL',
                sqlServerInstances: [{ statusColText: 'MANAGED', databaseCount: 2 }]
            }
        };
        const result: any = getManagedHostCountFromInventory(inventoryTableData, mockDispatch, 'MSSQL');
        expect(result.totalHosts).toBe(0);
    });

    it('skips entries where managedInstance is 0', () => {
        const inventoryTableData = {
            host1: {
                credentialId: 'cred1',
                regionId: 'us-east-1',
                resourceId: 'res1',
                managedInstance: 0,
                hostType: 'MSSQL',
                sqlServerInstances: [{ statusColText: 'MANAGED', databaseCount: 2 }]
            }
        };
        const result: any = getManagedHostCountFromInventory(inventoryTableData, mockDispatch, 'MSSQL');
        expect(result.totalHosts).toBe(0);
    });
});

describe('getManagedAggrProtection', () => {
    it('returns zero counts for empty data', () => {
        const result = getManagedAggrProtection({});
        expect(result.protectedDb).toBe(0);
        expect(result.unprotectedDb).toBe(0);
    });

    it('counts protected hosts correctly', () => {
        const data = {
            'host1_cred1_us-east-1': {
                databaseInstancesSummary: [
                    {
                        status: 'UP',
                        protection: {
                            isFsxOntapSnapshotsEnabled: true,
                            isAwsBackupEnabled: {},
                            isSqlNativeEnabled: false
                        }
                    }
                ]
            }
        };
        const result = getManagedAggrProtection(data);
        expect(result.protectedDb).toBe(1);
    });

    it('skips hosts not in selected credentials', () => {
        const data = {
            'host1_othercred_us-east-1': {
                databaseInstancesSummary: [{ status: 'UP', protection: { isFsxOntapSnapshotsEnabled: true } }]
            }
        };
        const result = getManagedAggrProtection(data);
        expect(result.protectedDb).toBe(0);
    });
});

describe('getManagedAggrStorageSavings', () => {
    it('returns zero savings for empty data', () => {
        const result = getManagedAggrStorageSavings({});
        expect(result.storageSavingsPercent).toBe(0);
    });

    it('calculates storage savings correctly for fsxn', () => {
        const data = {
            'host1_cred1_us-east-1': {
                databaseInstancesSummary: [
                    {
                        databaseInstanceTopology: {
                            fileSystemId: 'fs-1',
                            fileSystemType: 'FSx for ONTAP'
                        },
                        storage: {
                            fsxn: { used: 100, spaceSavings: 30 }
                        }
                    }
                ]
            }
        };
        const result = getManagedAggrStorageSavings(data);
        expect(result.storageSavingsPercent).toBeGreaterThan(0);
    });
});

describe('getManageAggrCost', () => {
    it('returns zero costs for empty data', () => {
        const result = getManageAggrCost({});
        expect(result.totalCost).toBe(0);
    });

    it('aggregates compute cost from host data', () => {
        const data = {
            'host1_cred1_us-east-1': {
                estimatedUsageCost: {
                    compute: 500,
                    estimationType: 'billing',
                    storage: { fsxnBreakDownById: [], fsxw: 0, ebs: 0 },
                    connectivity: 0,
                    others: 0
                }
            }
        };
        const result = getManageAggrCost(data);
        expect(parseFloat(result.computeCost)).toBe(500);
    });
});

describe('getPotentialSavingsValues', () => {
    it('returns default result for empty data', () => {
        const result = getPotentialSavingsValues({});
        expect(result.loading).toBe(false);
        expect(result.savings).toBe(0);
    });

    it('calculates EBS savings', () => {
        const data = {
            'host1_cred1_us-east-1': {
                loading: false,
                storageType: 'EBS',
                data: {
                    totalSummary: {
                        existing: 1000,
                        recommended: 600
                    }
                }
            }
        };
        const result = getPotentialSavingsValues(data);
        expect(result.savings).toBeGreaterThan(0);
        expect(result.ebsCost).toBe(1000);
        expect(result.fsxnCostForEbsHost).toBe(600);
    });

    it('sets noSavings true when fsxnCost >= total cost', () => {
        const data = {
            'host1_cred1_us-east-1': {
                loading: false,
                storageType: 'EBS',
                data: {
                    totalSummary: {
                        existing: 500,
                        recommended: 600
                    }
                }
            }
        };
        const result = getPotentialSavingsValues(data);
        expect(result.noSavings).toBe(true);
        expect(result.savings).toBe(0);
    });
});

// ─── getManagedHostCount ─────────────────────────────────────────────────────
describe('getManagedHostCount', () => {
    const mockDispatch = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetState.mockReturnValue({
            headers: {
                headerSelectedMultiCredIdsList: ['cred1'],
                headerSelectedMultiRegionIdsList: ['us-east-1']
            },
            inventoryV2: {
                inventoryTableData: null,
                allLogAnalysisData: [],
                allLogAnalysisLoading: false
            }
        });
    });

    it('returns zero counts for empty data', () => {
        const result = getManagedHostCount({}, mockDispatch);
        expect(result.totalHosts).toBe(0);
        expect(result.totalDatabases).toBe(0);
    });

    it('counts hosts matching cred and region', () => {
        const data = {
            'res1_cred1_us-east-1': {
                databaseInstanceDetails: [{ isManaged: true }],
                databaseInstancesSummary: [{ databaseCount: 2, databaseInstanceId: 'i1' }]
            }
        };
        const result = getManagedHostCount(data, mockDispatch);
        expect(result.totalHosts).toBe(1);
        expect(result.managedInstances).toBe(1);
    });

    it('skips hosts not in selected creds', () => {
        const data = {
            'res1_other_us-east-1': {
                databaseInstanceDetails: [],
                databaseInstancesSummary: []
            }
        };
        const result = getManagedHostCount(data, mockDispatch);
        expect(result.totalHosts).toBe(0);
    });

    it('handles MSSQL inventoryTableData with sqlServerInstances', () => {
        const inventoryTableData: Record<string, any> = {
            'res1_cred1_us-east-1': {
                loading: false,
                sqlServerInstances: [{ statusColText: 'Managed', databaseCount: 5 }]
            }
        };
        mockGetState.mockReturnValue({
            headers: {
                headerSelectedMultiCredIdsList: ['cred1'],
                headerSelectedMultiRegionIdsList: ['us-east-1']
            },
            inventoryV2: { inventoryTableData }
        });
        const data = {
            'res1_cred1_us-east-1': {
                databaseInstanceDetails: [],
                databaseInstancesSummary: []
            }
        };
        // WIZARD_TYPE.MSSQL is lowercase 'mssql'
        const result = getManagedHostCount(data, mockDispatch, 'mssql');
        expect(result.totalDatabases).toBe(5);
        expect(result.managedDatabases).toBe(5);
    });
});

// ─── disableOfflineRows ──────────────────────────────────────────────────────
describe('disableOfflineRows', () => {
    it('disables rows with STOPPED status', () => {
        const data = [{ status: 'Stopped', configStateList: [] }];
        const result = disableOfflineRows(data);
        expect(result[0].cellProps?.isDisabled).toBe(true);
    });

    it('disables rows with Down status (CASE_SENSITIVE_DOWN)', () => {
        // INVENTORY_STATUS.CASE_SENSITIVE_DOWN = 'Down'
        const data = [{ status: 'Down', configStateList: [] }];
        const result = disableOfflineRows(data);
        expect(result[0].cellProps?.isDisabled).toBe(true);
    });

    it('disables rows with loadingStatus', () => {
        const data = [{ loadingStatus: true, configStateList: [] }];
        const result = disableOfflineRows(data);
        expect(result[0].cellProps?.isDisabled).toBe(true);
    });

    it('disables rows with 0 out of 0 configuration and no dismissed state', () => {
        const data = [{ configuration: '0 out of 0', configStateList: [] }];
        const result = disableOfflineRows(data);
        expect(result[0].cellProps?.isDisabled).toBe(true);
    });

    it('does NOT disable rows with 0 out of 0 that are dismissed', () => {
        const data = [{ configuration: '0 out of 0', configStateList: ['DISMISSED'] }];
        const result = disableOfflineRows(data);
        expect(result[0].cellProps).toBeUndefined();
    });

    it('returns item unchanged for normal rows', () => {
        const data = [{ status: 'ONLINE', configuration: '2 out of 5', configStateList: ['ACTIVE'] }];
        const result = disableOfflineRows(data);
        expect(result[0].cellProps).toBeUndefined();
    });
});

// ─── formatAssessmentTableData ───────────────────────────────────────────────
describe('formatAssessmentTableData', () => {
    it('returns empty array for empty data', () => {
        const result = formatAssessmentTableData([], []);
        expect(result).toEqual([]);
    });

    it('skips items with error', () => {
        const data = [{ error: true, name: 'compute' }];
        const result = formatAssessmentTableData(data, []);
        expect(result).toHaveLength(0);
    });

    it('skips items with errorMessage', () => {
        const data = [{ errorMessage: 'some error', name: 'compute' }];
        const result = formatAssessmentTableData(data, []);
        expect(result).toHaveLength(0);
    });

    it('formats valid assessment item with ACTIVE state when no dismissed match', () => {
        const data = [{ name: 'compute', status: 'OPTIMIZED', severity: 'CRITICAL' }];
        const result = formatAssessmentTableData(data, []);
        expect(result).toHaveLength(1);
        expect(result[0].configState).toBe('ACTIVE');
        expect(result[0].dismissedObj.configState).toBe('ACTIVE');
    });

    it('merges dismissed data when matching dismissed item found', () => {
        const data = [{ name: 'compute', status: 'NOT_OPTIMIZED', severity: 'WARNING' }];
        const dismissedData = [
            {
                configurationName: 'compute',
                configState: 'DISMISSED',
                startTime: '2024-01-01',
                endTime: '2024-12-31'
            }
        ];
        const result = formatAssessmentTableData(data, dismissedData);
        expect(result).toHaveLength(1);
        expect(result[0].configState).toBe('DISMISSED');
        expect(result[0].dismissedObj.configState).toBe('DISMISSED');
    });

    it('adds dismissed-only items when data is empty but dismissedData has entries', () => {
        const dismissedData = [
            {
                configurationName: 'storage-tier',
                configState: 'POSTPONED',
                startTime: '2024-01-01',
                endTime: '2024-12-31'
            }
        ];
        const result = formatAssessmentTableData([], dismissedData);
        expect(result).toHaveLength(1);
        expect(result[0].configState).toBe('POSTPONED');
    });

    it('handles Oracle snapshot-policy renaming', () => {
        const data = [{ name: 'snapshot-policy', status: 'OPTIMIZED' }];
        const result = formatAssessmentTableData(data, [], 'ORACLE');
        expect(result).toHaveLength(1);
    });
});

// ─── categorizeStateInstances ────────────────────────────────────────────────
describe('categorizeStateInstances', () => {
    it('returns empty lists for empty dismissedConfigurations', () => {
        const data = { dismissedConfigurations: [] };
        const result = categorizeStateInstances(data, 'compute');
        expect(result.successList).toHaveLength(0);
        expect(result.failedList).toHaveLength(0);
    });

    it('categorizes success instances', () => {
        const data = {
            dismissedConfigurations: [
                {
                    configurationName: 'compute',
                    configState: 'DISMISSED',
                    startTime: '2024-01-01',
                    endTime: '2024-12-31',
                    databaseHosts: [
                        {
                            id: 'host1',
                            credentialsId: 'cred1',
                            region: 'us-east-1',
                            status: 'SUCCESS',
                            sqlServerInstances: ['instance1', 'instance2']
                        }
                    ]
                }
            ]
        };
        const result = categorizeStateInstances(data, 'compute');
        expect(result.successList).toHaveLength(2);
        expect(result.successList[0].hostId).toBe('host1');
    });

    it('categorizes failed instances', () => {
        const data = {
            dismissedConfigurations: [
                {
                    configurationName: 'storage',
                    configState: 'ACTIVATING',
                    startTime: '2024-01-01',
                    endTime: '2024-12-31',
                    databaseHosts: [
                        {
                            id: 'host2',
                            credentialsId: 'cred1',
                            region: 'us-east-1',
                            status: 'FAILED',
                            sqlServerInstances: ['inst1']
                        }
                    ]
                }
            ]
        };
        const result = categorizeStateInstances(data, 'storage');
        expect(result.failedList).toHaveLength(1);
        expect(result.failedList[0].instanceId).toBe('inst1');
    });

    it('categorizes partial instances correctly', () => {
        const data = {
            dismissedConfigurations: [
                {
                    configurationName: 'compute',
                    configState: 'ACTIVATING',
                    startTime: '2024-01-01',
                    endTime: null,
                    databaseHosts: [
                        {
                            id: 'host3',
                            credentialsId: 'cred1',
                            region: 'us-east-1',
                            status: 'PARTIAL',
                            failedInstances: { inst1: true },
                            sqlServerInstances: ['inst1', 'inst2']
                        }
                    ]
                }
            ]
        };
        const result = categorizeStateInstances(data, 'compute');
        expect(result.failedList).toHaveLength(1);
        expect(result.successList).toHaveLength(1);
    });
});

// ─── getConfigStateList ──────────────────────────────────────────────────────
describe('getConfigStateList', () => {
    it('returns ACTIVE when no config states found', () => {
        const result = getConfigStateList([], []);
        expect(result).toContain('ACTIVE');
    });

    it('collects config states from formatted data', () => {
        const formattedData = [{ configState: 'DISMISSED' }, { configState: 'ACTIVE' }];
        const result = getConfigStateList([], [], undefined, formattedData);
        expect(result).toContain('DISMISSED');
        expect(result).toContain('ACTIVE');
    });

    it('returns unique config states', () => {
        const formattedData = [{ configState: 'DISMISSED' }, { configState: 'DISMISSED' }, { configState: 'ACTIVE' }];
        const result = getConfigStateList([], [], undefined, formattedData);
        const dismissedCount = result.filter(s => s === 'DISMISSED').length;
        expect(dismissedCount).toBe(1);
    });
});

// ─── mapHostStatusToAssessmentData ───────────────────────────────────────────
describe('mapHostStatusToAssessmentData', () => {
    it('returns sorted list of assessment data', () => {
        const assessmentData = [
            { databaseHostId: 'host1', credentialId: 'cred1', regionId: 'us-east-1', instanceId: 'inst1' }
        ];
        const result = mapHostStatusToAssessmentData(null, assessmentData, false);
        expect(result).toHaveLength(1);
        expect(result[0].loadingStatus).toBe(false);
    });

    it('sets loadingStatus when host not found in hostData', () => {
        const assessmentData = [
            { databaseHostId: 'host1', credentialId: 'cred1', regionId: 'us-east-1', instanceId: 'inst1' }
        ];
        const result = mapHostStatusToAssessmentData({}, assessmentData, true);
        expect(result[0].loadingStatus).toBe(true);
    });
});

// ─── getManagedInstanceOptimizationSummary ───────────────────────────────────
describe('getManagedInstanceOptimizationSummary', () => {
    it('returns zero counts for empty assessment data', () => {
        const result = getManagedInstanceOptimizationSummary([]);
        expect(result.totalInstances).toBe(0);
        expect(result.optimizedInstances).toBe(0);
    });

    it('returns zero counts when no matching cred/region', () => {
        const data = [
            {
                credentialId: 'other-cred',
                regionId: 'eu-west-1',
                databaseHostId: 'host1',
                instancesAssessment: [{ assessments: { lastAssessmentTimestamp: '2024-01-01' } }]
            }
        ];
        const result = getManagedInstanceOptimizationSummary(data);
        expect(result.totalInstances).toBe(0);
    });

    it('counts instances for matching cred/region', () => {
        const data = [
            {
                credentialId: 'cred1',
                regionId: 'us-east-1',
                databaseHostId: 'host1',
                instancesAssessment: [
                    {
                        assessments: {
                            lastAssessmentTimestamp: '2024-01-01',
                            compute: { status: 'OPTIMIZED' },
                            rssConfig: { status: 'OPTIMIZED' },
                            hostOsPatch: { status: 'OPTIMIZED' },
                            mtuAlignment: { status: 'OPTIMIZED' },
                            license: { status: 'OPTIMIZED' },
                            mssqlPatch: { status: 'OPTIMIZED' },
                            maxDOP: { status: 'OPTIMIZED' },
                            clone: { status: 'OPTIMIZED' },
                            storage: {
                                layout: [],
                                sizing: [
                                    { name: 'headroom', status: 'OPTIMIZED' },
                                    { name: 'tempdb-drive-size', status: 'OPTIMIZED' },
                                    { name: 'log-drive-size', status: 'OPTIMIZED' },
                                    { name: 'performance-tier', status: 'OPTIMIZED' }
                                ],
                                configuration: {}
                            },
                            dismissedConfigurations: {}
                        }
                    }
                ]
            }
        ];
        const result = getManagedInstanceOptimizationSummary(data);
        expect(result.totalInstances).toBe(1);
    });

    it('skips instances with errors', () => {
        const data = [
            {
                credentialId: 'cred1',
                regionId: 'us-east-1',
                databaseHostId: 'host1',
                instancesAssessment: [{ error: true, assessments: {} }]
            }
        ];
        const result = getManagedInstanceOptimizationSummary(data);
        expect(result.totalInstances).toBe(0);
    });
});

// ─── getErrorInvestigationSummary ────────────────────────────────────────────
describe('getErrorInvestigationSummary', () => {
    it('returns empty array when inventoryTableData is null', () => {
        mockGetState.mockReturnValue({
            headers: {
                headerSelectedMultiCredIdsList: ['cred1'],
                headerSelectedMultiRegionIdsList: ['us-east-1']
            },
            inventoryV2: {
                inventoryTableData: null,
                allLogAnalysisData: [],
                allLogAnalysisLoading: false
            }
        });
        const result = getErrorInvestigationSummary([]);
        expect(result).toEqual([]);
    });

    it('returns emptyState true when no log analysis data (null)', () => {
        mockGetState.mockReturnValue({
            headers: {
                headerSelectedMultiCredIdsList: ['cred1'],
                headerSelectedMultiRegionIdsList: ['us-east-1']
            },
            inventoryV2: {
                inventoryTableData: {},
                allLogAnalysisData: [],
                allLogAnalysisLoading: false
            }
        });
        const result = getErrorInvestigationSummary(null);
        expect((result as any).emptyState).toBe(true);
        expect((result as any).totalResource).toBe(0);
    });

    it('returns emptyState true for empty log analysis data array', () => {
        mockGetState.mockReturnValue({
            headers: {
                headerSelectedMultiCredIdsList: ['cred1'],
                headerSelectedMultiRegionIdsList: ['us-east-1']
            },
            inventoryV2: {
                inventoryTableData: {},
                allLogAnalysisData: [],
                allLogAnalysisLoading: false
            }
        });
        const result = getErrorInvestigationSummary([]);
        expect((result as any).emptyState).toBe(true);
    });

    it('aggregates error investigation data from matching inventory', () => {
        mockGetState.mockReturnValue({
            headers: {
                headerSelectedMultiCredIdsList: ['cred1'],
                headerSelectedMultiRegionIdsList: ['us-east-1']
            },
            inventoryV2: {
                inventoryTableData: {
                    'res1_cred1_us-east-1': {
                        credentialId: 'cred1',
                        regionId: 'us-east-1',
                        resourceId: 'res1',
                        managedInstance: 1,
                        // DBType.MSSQL = 'Microsoft SQL Server'
                        hostType: 'Microsoft SQL Server',
                        sqlServerInstances: [
                            {
                                statusColText: 'Managed',
                                databaseInstanceId: 'inst1'
                            }
                        ]
                    }
                },
                allLogAnalysisData: [],
                allLogAnalysisLoading: false
            }
        });
        const logData = [
            {
                databaseHostId: 'res1',
                databaseInstanceId: 'inst1',
                credentialId: 'cred1',
                regionId: 'us-east-1',
                dbType: 'Microsoft SQL Server',
                // ERROR_ANALYZER_STATUS.ACTIVE = 'Active'
                status: 'Active',
                latestReport: {
                    errorCount: 5,
                    severityCounts: { critical: 2, severe: 1, important: 2 }
                }
            }
        ];
        const result: any = getErrorInvestigationSummary(logData);
        expect(result.totalResource).toBe(1);
        expect(result.activeResource).toBe(1);
        expect(result.totalEvents).toBe(5);
    });
});

// ─── getAssessmentGroupedByCategory ─────────────────────────────────────────
describe('getAssessmentGroupedByCategory', () => {
    it('returns zero counts for empty assessment data', () => {
        const result = getAssessmentGroupedByCategory([], []);
        expect(result.mssqlStorage).toBe(0);
        expect(result.total).toBe(0);
    });

    it('skips hosts not in selected cred/region', () => {
        const data = [
            {
                credentialId: 'other',
                regionId: 'eu-west-1',
                databaseHostId: 'h1',
                instancesAssessment: [{ assessments: { lastAssessmentTimestamp: '2024-01-01' } }]
            }
        ];
        const result = getAssessmentGroupedByCategory(data, []);
        expect(result.total).toBe(0);
    });
});

// ─── getManagedOptimizationSummary ───────────────────────────────────────────
describe('getManagedOptimizationSummary', () => {
    it('returns zero counts for empty data', () => {
        const result = getManagedOptimizationSummary([], []);
        expect(result.totalInstances).toBe(0);
        expect(result.optimizedInstances).toBe(0);
        expect(result.optimizedPercent).toBe(0);
    });

    it('returns hasDismissedOrPostponed false for empty data', () => {
        const result = getManagedOptimizationSummary([], []);
        expect(result.hasDismissedOrPostponed).toBe(false);
    });
});

// ─── createLogAnalyzerNotActiveInstance ─────────────────────────────────────
describe('createLogAnalyzerNotActiveInstance', () => {
    it('returns empty array when inventoryTableData is null', () => {
        mockGetState.mockReturnValue({
            headers: {
                headerSelectedMultiCredIdsList: ['cred1'],
                headerSelectedMultiRegionIdsList: ['us-east-1']
            },
            inventoryV2: {
                inventoryTableData: null,
                allLogAnalysisData: [],
                allLogAnalysisLoading: false
            }
        });
        const result = createLogAnalyzerNotActiveInstance({});
        expect(result).toEqual([]);
    });

    it('builds not-active log analyzer rows from managed instances', () => {
        mockGetState.mockReturnValue({
            headers: {
                headerSelectedMultiCredIdsList: ['cred1'],
                headerSelectedMultiRegionIdsList: ['us-east-1']
            },
            inventoryV2: {
                inventoryTableData: {
                    'res1_cred1_us-east-1': {
                        credentialId: 'cred1',
                        regionId: 'us-east-1',
                        resourceId: 'res1',
                        managedInstance: 1,
                        // DBType.MSSQL = 'Microsoft SQL Server'
                        hostType: 'Microsoft SQL Server',
                        name: 'host-1',
                        ec2InstanceId: 'ec2-1',
                        sqlServerInstances: [
                            {
                                statusColText: 'Managed',
                                databaseInstanceId: 'inst1',
                                databaseInstanceName: 'db-inst-1',
                                status: 'ONLINE',
                                fsxId: 'fsx-1',
                                sqlServerDeploymentType: 'STANDALONE'
                            }
                        ]
                    }
                },
                allLogAnalysisData: [],
                allLogAnalysisLoading: false
            }
        });
        const result = createLogAnalyzerNotActiveInstance({});
        expect(result).toHaveLength(1);
        expect(result[0].databaseHostName).toBe('host-1');
        // ERROR_ANALYZER_STATUS.NOT_ACTIVE = 'Not active'
        expect(result[0].logAnalyzer.status).toBe('Not active');
    });

    it('skips unmanaged instances', () => {
        mockGetState.mockReturnValue({
            headers: {
                headerSelectedMultiCredIdsList: ['cred1'],
                headerSelectedMultiRegionIdsList: ['us-east-1']
            },
            inventoryV2: {
                inventoryTableData: {
                    'res1_cred1_us-east-1': {
                        credentialId: 'cred1',
                        regionId: 'us-east-1',
                        resourceId: 'res1',
                        managedInstance: 1,
                        hostType: 'Microsoft SQL Server',
                        sqlServerInstances: [{ statusColText: 'Unmanaged', databaseInstanceId: 'inst2' }]
                    }
                },
                allLogAnalysisData: [],
                allLogAnalysisLoading: false
            }
        });
        const result = createLogAnalyzerNotActiveInstance({});
        expect(result).toHaveLength(0);
    });
});

// ─── createLogAnalyzerActiveInstance ────────────────────────────────────────
describe('createLogAnalyzerActiveInstance', () => {
    it('returns empty array when inventoryTableData is null', () => {
        mockGetState.mockReturnValue({
            headers: {
                headerSelectedMultiCredIdsList: ['cred1'],
                headerSelectedMultiRegionIdsList: ['us-east-1']
            },
            inventoryV2: {
                inventoryTableData: null,
                allLogAnalysisData: [],
                allLogAnalysisLoading: false
            }
        });
        const result = createLogAnalyzerActiveInstance([]);
        expect(result).toEqual([]);
    });

    it('builds active log analyzer rows when matching ACTIVE log entry exists', () => {
        const hostKey = 'res1_cred1_us-east-1';
        mockGetState.mockReturnValue({
            headers: {
                headerSelectedMultiCredIdsList: ['cred1'],
                headerSelectedMultiRegionIdsList: ['us-east-1']
            },
            inventoryV2: {
                inventoryTableData: {
                    [hostKey]: {
                        credentialId: 'cred1',
                        regionId: 'us-east-1',
                        resourceId: 'res1',
                        managedInstance: 1,
                        // DBType.MSSQL = 'Microsoft SQL Server'
                        hostType: 'Microsoft SQL Server',
                        name: 'host-1',
                        ec2InstanceId: 'ec2-1',
                        sqlServerInstances: [
                            {
                                statusColText: 'Managed',
                                databaseInstanceId: 'inst1',
                                databaseInstanceName: 'db-inst-1',
                                // resourceId used for secondary log match
                                resourceId: 'res1',
                                status: 'ONLINE',
                                fsxId: 'fsx-1',
                                sqlServerDeploymentType: 'STANDALONE'
                            }
                        ]
                    }
                },
                allLogAnalysisData: [
                    {
                        databaseHostId: 'res1',
                        databaseInstanceId: 'inst1',
                        credentialId: 'cred1',
                        regionId: 'us-east-1',
                        // ERROR_ANALYZER_STATUS.ACTIVE = 'Active'
                        status: 'Active',
                        latestReport: {
                            errorCount: 3,
                            creationTime: '2024-01-01',
                            severityCounts: { critical: 1, severe: 1, important: 1 }
                        }
                    }
                ],
                allLogAnalysisLoading: false
            }
        });
        const result = createLogAnalyzerActiveInstance([]);
        expect(result).toHaveLength(1);
        expect(result[0].logAnalyzer.status).toBe('Active');
        expect(result[0].logAnalyzerErrorCount).toBe(3);
    });

    it('excludes instances where log status is NOT_ACTIVE', () => {
        mockGetState.mockReturnValue({
            headers: {
                headerSelectedMultiCredIdsList: ['cred1'],
                headerSelectedMultiRegionIdsList: ['us-east-1']
            },
            inventoryV2: {
                inventoryTableData: {
                    'res1_cred1_us-east-1': {
                        credentialId: 'cred1',
                        regionId: 'us-east-1',
                        resourceId: 'res1',
                        managedInstance: 1,
                        hostType: 'Microsoft SQL Server',
                        sqlServerInstances: [{ statusColText: 'Managed', databaseInstanceId: 'inst1' }]
                    }
                },
                allLogAnalysisData: [],
                allLogAnalysisLoading: false
            }
        });
        const result = createLogAnalyzerActiveInstance([]);
        expect(result).toHaveLength(0);
    });
});

// ─── getAssessmentHostListGroupedByCategory ──────────────────────────────────
describe('getAssessmentHostListGroupedByCategory', () => {
    beforeEach(() => {
        mockGetState.mockReturnValue({
            headers: {
                headerSelectedMultiCredIdsList: ['cred1'],
                headerSelectedMultiRegionIdsList: ['us-east-1']
            },
            inventoryV2: {
                inventoryTableData: {},
                getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false },
                allLogAnalysisData: [],
                allLogAnalysisLoading: false
            }
        });
    });

    it('returns empty array for empty assessment data', () => {
        const result = getAssessmentHostListGroupedByCategory([], []);
        expect(Array.isArray(result)).toBe(true);
    });

    it('skips hosts not in selected cred/region', () => {
        const data = [
            {
                credentialId: 'other',
                regionId: 'eu-west-1',
                databaseHostId: 'h1',
                databaseHostName: 'host1',
                instancesAssessment: [{ assessments: { lastAssessmentTimestamp: '2024-01-01' } }]
            }
        ];
        const result = getAssessmentHostListGroupedByCategory(data, []);
        expect(result).toHaveLength(0);
    });
});

// ─── Shared test data factories ───────────────────────────────────────────────

const makeOptimizedMssqlAssessment = (overrides: any = {}) => ({
    lastAssessmentTimestamp: '2024-01-01T00:00:00Z',
    deploymentType: 'STANDALONE',
    compute: { status: 'OPTIMIZED', severity: 'warning' },
    rssConfig: { status: 'OPTIMIZED', severity: 'warning' },
    hostOsPatch: { status: 'OPTIMIZED', severity: 'critical' },
    mtuAlignment: { status: 'OPTIMIZED', severity: 'critical' },
    license: { status: 'OPTIMIZED', severity: 'warning' },
    mssqlPatch: { status: 'OPTIMIZED', severity: 'warning' },
    maxDOP: { status: 'OPTIMIZED', severity: 'warning' },
    clone: { status: 'OPTIMIZED', severity: 'warning' },
    snapshotPolicy: { status: 'OPTIMIZED', severity: 'warning' },
    awsBackup: { status: 'OPTIMIZED', severity: 'warning' },
    crr: { status: 'OPTIMIZED', severity: 'warning' },
    storage: {
        sizing: [
            { name: 'performance-tier', status: 'OPTIMIZED', severity: 'warning' },
            { name: 'headroom', status: 'OPTIMIZED', severity: 'warning' },
            { name: 'log-drive-size', status: 'OPTIMIZED', severity: 'warning' },
            { name: 'tempdb-drive-size', status: 'OPTIMIZED', severity: 'warning' }
        ],
        layout: [
            { name: 'data-files-location', status: 'OPTIMIZED', severity: 'warning' },
            { name: 'log-files-location', status: 'OPTIMIZED', severity: 'warning' },
            { name: 'tempdb-files-location', status: 'OPTIMIZED', severity: 'warning' }
        ],
        configuration: {
            luns: [{ name: 'lun1', status: 'OPTIMIZED' }],
            volumes: [{ name: 'vol1', status: 'OPTIMIZED' }],
            os: [{ name: 'os1', status: 'OPTIMIZED' }]
        }
    },
    dismissedConfigurations: {},
    ...overrides
});

const makeNotOptimizedMssqlAssessment = (overrides: any = {}) => ({
    ...makeOptimizedMssqlAssessment(),
    compute: { status: 'NOT_OPTIMIZED', severity: 'warning' },
    hostOsPatch: { status: 'NOT_OPTIMIZED', severity: 'critical' },
    storage: {
        sizing: [{ name: 'performance-tier', status: 'NOT_OPTIMIZED', severity: 'warning' }],
        layout: [],
        configuration: {}
    },
    ...overrides
});

const makeMssqlHost = (hostId: string, assessment: any, credentialId = 'cred1', regionId = 'us-east-1') => ({
    credentialId,
    regionId,
    databaseHostId: hostId,
    databaseHostName: `Host-${hostId}`,
    instancesAssessment: [
        { databaseInstanceId: `inst-${hostId}`, databaseInstanceName: `SQL-${hostId}`, assessments: assessment }
    ]
});

const makeOracleAssessment = (overrides: any = {}) => ({
    lastAssessmentTimestamp: '2024-01-01T00:00:00Z',
    isASMManaged: false,
    storageProtocol: 'NFS',
    hostOsPatch: { status: 'OPTIMIZED', severity: 'critical' },
    storage: {
        sizing: [
            { name: 'headroom', status: 'OPTIMIZED', severity: 'warning' },
            { name: 'swap-space', status: 'OPTIMIZED', severity: 'warning' }
        ],
        layout: [
            { name: 'oracle-binary-placement', status: 'OPTIMIZED', severity: 'warning' },
            { name: 'datafiles-placement', status: 'OPTIMIZED', severity: 'warning' },
            { name: 'controlfiles-placement', status: 'OPTIMIZED', severity: 'warning' },
            { name: 'redologs-placement', status: 'OPTIMIZED', severity: 'warning' },
            { name: 'templogs-placement', status: 'OPTIMIZED', severity: 'warning' },
            { name: 'archive-placement', status: 'OPTIMIZED', severity: 'warning' }
        ],
        configuration: { luns: [], volumes: [], os: [] }
    },
    dismissedConfigurations: {},
    ...overrides
});

const makeAsmOracleAssessment = (overrides: any = {}) => ({
    ...makeOracleAssessment(),
    isASMManaged: true,
    storageProtocol: 'iSCSI',
    storage: {
        ...makeOracleAssessment().storage,
        layout: [
            { name: 'oracle-binary-placement', status: 'OPTIMIZED' },
            { name: 'datafiles-placement', status: 'OPTIMIZED' },
            { name: 'controlfiles-placement', status: 'OPTIMIZED' },
            { name: 'redologs-placement', status: 'OPTIMIZED' },
            { name: 'templogs-placement', status: 'OPTIMIZED' },
            { name: 'archive-placement', status: 'OPTIMIZED' },
            { name: 'data-dg-lun-layout', status: 'OPTIMIZED', severity: 'warning' },
            { name: 'redolog-dg-lun-layout', status: 'OPTIMIZED', severity: 'warning' },
            { name: 'fra-dg-lun-layout', status: 'OPTIMIZED', severity: 'warning' },
            { name: 'archivelog-dg-lun-layout', status: 'OPTIMIZED', severity: 'warning' }
        ]
    },
    ...overrides
});

const makeOracleHost = (hostId: string, assessment: any, credentialId = 'cred1', regionId = 'us-east-1') => ({
    credentialId,
    regionId,
    databaseHostId: hostId,
    databaseHostName: `OracleHost-${hostId}`,
    instancesAssessment: [
        { databaseInstanceId: `oinst-${hostId}`, databaseInstanceName: `ORA-${hostId}`, assessments: assessment }
    ]
});

// ─── getAssessmentGroupedByConfigurations ─────────────────────────────────────
describe('getAssessmentGroupedByConfigurations', () => {
    beforeEach(() => {
        mockGetState.mockReturnValue({
            headers: {
                headerSelectedMultiCredIdsList: ['cred1'],
                headerSelectedMultiRegionIdsList: ['us-east-1']
            },
            inventoryV2: { inventoryTableData: {} }
        });
    });

    it('returns zero totals for empty input arrays', () => {
        const result = getAssessmentGroupedByConfigurations([], []);
        expect(result.total).toBe(0);
        expect(result.oracleTotal).toBe(0);
        expect(result.storageTier.optimized).toBe(0);
    });

    it('skips MSSQL hosts not matching selected cred/region', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment(), 'other-cred', 'eu-west-1');
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.total).toBe(0);
    });

    it('skips Oracle hosts not matching selected cred/region', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment(), 'other-cred', 'eu-west-1');
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.oracleTotal).toBe(0);
    });

    it('skips MSSQL instances with errors', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        host.instancesAssessment[0] = { ...host.instancesAssessment[0], error: true } as any;
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.total).toBe(0);
    });

    it('skips MSSQL instances without lastAssessmentTimestamp', () => {
        const assess = { ...makeOptimizedMssqlAssessment(), lastAssessmentTimestamp: undefined };
        const host = makeMssqlHost('h1', assess);
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.total).toBe(0);
    });

    it('skips duplicate MSSQL hosts', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host, host], []);
        expect(result.total).toBe(1);
    });

    it('increments total for valid MSSQL instance', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.total).toBe(1);
    });

    it('increments storageTier.optimized for OPTIMIZED performance-tier', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.storageTier.optimized).toBe(1);
    });

    it('does not increment storageTier.optimized for NOT_OPTIMIZED performance-tier', () => {
        const assess = makeOptimizedMssqlAssessment({
            storage: {
                ...makeOptimizedMssqlAssessment().storage,
                sizing: [{ name: 'performance-tier', status: 'NOT_OPTIMIZED', severity: 'warning' }]
            }
        });
        const host = makeMssqlHost('h1', assess);
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.storageTier.optimized).toBe(0);
    });

    it('increments storageTier.dismissed when configState is DISMISSED', () => {
        const assess = makeOptimizedMssqlAssessment({
            dismissedConfigurations: {
                storage: {
                    sizing: [{ configurationName: 'performance-tier', configState: 'DISMISSED' }]
                }
            }
        });
        const host = makeMssqlHost('h1', assess);
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.storageTier.dismissed).toBe(1);
    });

    it('increments storageTier.activating when configState is ACTIVATING', () => {
        const assess = makeOptimizedMssqlAssessment({
            dismissedConfigurations: {
                storage: {
                    sizing: [{ configurationName: 'performance-tier', configState: 'ACTIVATING' }]
                }
            }
        });
        const host = makeMssqlHost('h1', assess);
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.storageTier.activating).toBe(1);
    });

    it('increments fileSystemHeadroom.optimized for headroom OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.fileSystemHeadroom.optimized).toBe(1);
    });

    it('increments logDriveSize.optimized for log-drive-size OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.logDriveSize.optimized).toBe(1);
    });

    it('increments tempdbDriveSize.optimized for tempdb-drive-size OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.tempdbDriveSize.optimized).toBe(1);
    });

    it('increments userDataFiles.optimized for data-files-location OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.userDataFiles.optimized).toBe(1);
    });

    it('increments logFiles.optimized for log-files-location OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.logFiles.optimized).toBe(1);
    });

    it('increments tempdbPlacement.optimized for tempdb-files-location OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.tempdbPlacement.optimized).toBe(1);
    });

    it('increments computeRightsizing.optimized for compute OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.computeRightsizing.optimized).toBe(1);
    });

    it('increments computeRightsizing.dismissed for dismissed compute', () => {
        const assess = makeOptimizedMssqlAssessment({
            compute: { status: 'NOT_OPTIMIZED', severity: 'warning' },
            dismissedConfigurations: { compute: { configState: 'DISMISSED' } }
        });
        const host = makeMssqlHost('h1', assess);
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.computeRightsizing.dismissed).toBe(1);
    });

    it('increments operatingSystemPatch.optimized for hostOsPatch OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.operatingSystemPatch.optimized).toBe(1);
    });

    it('increments rssConfiguration.optimized for rssConfig OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.rssConfiguration.optimized).toBe(1);
    });

    it('increments mtuConfiguration.optimized for mtuAlignment OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mtuConfiguration.optimized).toBe(1);
    });

    it('increments applicationSqlServer.total for non-AOAG deployment', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment({ deploymentType: 'STANDALONE' }));
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.applicationSqlServer.total).toBe(1);
        expect(result.applicationSqlServer.optimized).toBe(1);
    });

    it('does NOT increment applicationSqlServer for AOAG deployment', () => {
        vi.mocked(mockIsAoagDeployment).mockReturnValueOnce(true);
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment({ deploymentType: 'AOAG' }));
        const result = getAssessmentGroupedByConfigurations([host], []);
        // applicationSqlServer.total should not be incremented for AOAG
        expect(result.applicationSqlServer.total).toBe(0);
        vi.mocked(mockIsAoagDeployment).mockReturnValue(false);
    });

    it('increments mssqlPatch.optimized for mssqlPatch OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlPatch.optimized).toBe(1);
    });

    it('increments maxdopPatch.optimized for maxDOP OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.maxdopPatch.optimized).toBe(1);
    });

    it('increments scheduledLocalSnapshot.optimized for snapshotPolicy OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.scheduledLocalSnapshot.optimized).toBe(1);
    });

    it('increments scheduledawsBackup.optimized for awsBackup OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.scheduledawsBackup.optimized).toBe(1);
    });

    it('increments clone.optimized for clone OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.clone.optimized).toBe(1);
    });

    it('increments crr.optimized for crr OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.crr.optimized).toBe(1);
    });

    it('sets isHaMssqlEnable=true and increments mssqlhighAvailability.total for HA deployment', () => {
        vi.mocked(mockIsMssqlHaDeployment).mockReturnValue(true);
        const assess = makeOptimizedMssqlAssessment({
            highAvailability: [
                { name: 'shared-storage', status: 'OPTIMIZED' },
                { name: 'drive-letter', status: 'OPTIMIZED' },
                { name: 'cluster-quorum', status: 'OPTIMIZED' },
                { name: 'heartbeat-settings', status: 'OPTIMIZED' },
                { name: 'sqlServer-service', status: 'OPTIMIZED' }
            ]
        });
        const host = makeMssqlHost('h1', assess);
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.isHaMssqlEnable).toBe(true);
        expect(result.mssqlhighAvailability.total).toBe(1);
        vi.mocked(mockIsMssqlHaDeployment).mockReturnValue(false);
    });

    it('processes multiple MSSQL hosts correctly', () => {
        const host1 = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const host2 = makeMssqlHost('h2', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host1, host2], []);
        expect(result.total).toBe(2);
        expect(result.storageTier.optimized).toBe(2);
        expect(result.computeRightsizing.optimized).toBe(2);
    });

    it('handles ontapConfiguration with luns and volumes', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        // lun1 and vol1 are both OPTIMIZED so ontapConfiguration.optimized = 1
        expect(result.ontapConfiguration.optimized).toBe(1);
    });

    it('handles operatingSystem with OS config', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.operatingSystem.optimized).toBe(1);
    });

    it('handles empty storage.sizing gracefully', () => {
        const assess = makeOptimizedMssqlAssessment({
            storage: { ...makeOptimizedMssqlAssessment().storage, sizing: [] }
        });
        const host = makeMssqlHost('h1', assess);
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.total).toBe(1);
        expect(result.storageTier.optimized).toBe(0);
    });

    it('handles empty storage.layout gracefully', () => {
        const assess = makeOptimizedMssqlAssessment({
            storage: { ...makeOptimizedMssqlAssessment().storage, layout: [] }
        });
        const host = makeMssqlHost('h1', assess);
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.userDataFiles.optimized).toBe(0);
        expect(result.logFiles.optimized).toBe(0);
    });

    it('returns configState object with arrays', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.configState).toBeDefined();
        expect(Array.isArray(result.configState.storageTier)).toBe(true);
        expect(Array.isArray(result.configState.computeRightsizing)).toBe(true);
    });

    // ── Oracle paths ─────────────────────────────────────────────────────────

    it('increments oracleTotal for valid Oracle instance', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.oracleTotal).toBe(1);
    });

    it('skips Oracle instances with errors', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        host.instancesAssessment[0] = { ...host.instancesAssessment[0], error: true } as any;
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.oracleTotal).toBe(0);
    });

    it('increments oracleBinaryPlacement.optimized for oracle-binary-placement OPTIMIZED', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.oracleBinaryPlacement.optimized).toBe(1);
    });

    it('increments datafilesPlacement.optimized for datafiles-placement OPTIMIZED', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.datafilesPlacement.optimized).toBe(1);
    });

    it('increments controlfilesPlacement.optimized for controlfiles-placement OPTIMIZED', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.controlfilesPlacement.optimized).toBe(1);
    });

    it('increments redoLogsPlacement.optimized for redologs-placement OPTIMIZED', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.redoLogsPlacement.optimized).toBe(1);
    });

    it('increments oracleFileSystemHeadroom.optimized for headroom OPTIMIZED', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.oracleFileSystemHeadroom.optimized).toBe(1);
    });

    it('increments oracleSwapSpace.optimized for swap-space OPTIMIZED', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.oracleSwapSpace.optimized).toBe(1);
    });

    it('increments oracleOperatingSystemPatch.optimized for hostOsPatch OPTIMIZED', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.oracleOperatingSystemPatch.optimized).toBe(1);
    });

    it('sets isAsmEnable=true and increments dataDgLunLayout.total for iSCSI ASM', () => {
        const host = makeOracleHost('oh1', makeAsmOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.isAsmEnable).toBe(true);
        expect(result.dataDgLunLayout.total).toBe(1);
        expect(result.logDgLunLayout.total).toBe(1);
    });

    it('sets isFraEnable=true and increments fraDgLunLayout.total for ASM with fra', () => {
        const host = makeOracleHost('oh1', makeAsmOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.isFraEnable).toBe(true);
        expect(result.fraDgLunLayout.total).toBe(1);
    });

    it('sets isArchiveEnable=true and increments archiveLogDgLunLayout.total for ASM with archive', () => {
        const host = makeOracleHost('oh1', makeAsmOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.isArchiveEnable).toBe(true);
        expect(result.archiveLogDgLunLayout.total).toBe(1);
    });

    it('does NOT set isAsmEnable for non-iSCSI even if isASMManaged', () => {
        const host = makeOracleHost('oh1', makeAsmOracleAssessment({ storageProtocol: 'NFS', isASMManaged: true }));
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.isAsmEnable).toBe(false);
    });

    it('processes both MSSQL and Oracle hosts correctly', () => {
        const mssqlHost = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const oracleHost = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([mssqlHost], [oracleHost]);
        expect(result.total).toBe(1);
        expect(result.oracleTotal).toBe(1);
    });

    it('handles dismissed oracleFileSystemHeadroom', () => {
        const assess = makeOracleAssessment({
            dismissedConfigurations: {
                storage: {
                    sizing: [{ configurationName: 'headroom', configState: 'DISMISSED' }]
                }
            }
        });
        const host = makeOracleHost('oh1', assess);
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.oracleFileSystemHeadroom.dismissed).toBe(1);
    });

    it('handles activating oracleSwapSpace', () => {
        const assess = makeOracleAssessment({
            dismissedConfigurations: {
                storage: {
                    sizing: [{ configurationName: 'swap-space', configState: 'ACTIVATING' }]
                }
            }
        });
        const host = makeOracleHost('oh1', assess);
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.oracleSwapSpace.activating).toBe(1);
    });

    it('skips duplicate Oracle hosts', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host, host]);
        expect(result.oracleTotal).toBe(1);
    });

    it('initial isAsmEnable, isFraEnable, isArchiveEnable, isHaMssqlEnable are false', () => {
        const result = getAssessmentGroupedByConfigurations([], []);
        expect(result.isAsmEnable).toBe(false);
        expect(result.isFraEnable).toBe(false);
        expect(result.isArchiveEnable).toBe(false);
        expect(result.isHaMssqlEnable).toBe(false);
    });
});

// ─── Enhanced getManagedInstanceOptimizationSummary ───────────────────────────
describe('getManagedInstanceOptimizationSummary (extended)', () => {
    beforeEach(() => {
        mockGetState.mockReturnValue({
            headers: {
                headerSelectedMultiCredIdsList: ['cred1'],
                headerSelectedMultiRegionIdsList: ['us-east-1']
            },
            inventoryV2: { inventoryTableData: {} }
        });
    });

    it('counts optimized instances when fully optimized', () => {
        const data = [makeMssqlHost('h1', makeOptimizedMssqlAssessment())];
        const result = getManagedInstanceOptimizationSummary(data);
        expect(result.totalInstances).toBe(1);
        expect(result.optimizedInstances).toBe(1);
        expect(result.notOptimizedInstances).toBe(0);
    });

    it('counts not-optimized instances when compute is NOT_OPTIMIZED', () => {
        const assess = makeOptimizedMssqlAssessment({
            compute: { status: 'NOT_OPTIMIZED', severity: 'warning' }
        });
        const data = [makeMssqlHost('h1', assess)];
        const result = getManagedInstanceOptimizationSummary(data);
        expect(result.optimizedInstances).toBe(0);
        expect(result.notOptimizedInstances).toBe(1);
    });

    it('detects dismissed config and sets hasDismissedOrPostponed=true', () => {
        const assess = makeOptimizedMssqlAssessment({
            compute: { status: 'NOT_OPTIMIZED', severity: 'warning' },
            dismissedConfigurations: { compute: { configState: 'DISMISSED' } }
        });
        const data = [makeMssqlHost('h1', assess)];
        const result = getManagedInstanceOptimizationSummary(data);
        expect(result.hasDismissedOrPostponed).toBe(true);
    });

    it('calculates optimizedPercent correctly', () => {
        const optimizedHost = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const notOptimizedAssess = makeOptimizedMssqlAssessment({
            compute: { status: 'NOT_OPTIMIZED', severity: 'warning' }
        });
        const notOptimizedHost = makeMssqlHost('h2', notOptimizedAssess);
        const result = getManagedInstanceOptimizationSummary([optimizedHost, notOptimizedHost]);
        expect(result.totalInstances).toBe(2);
        expect(result.optimizedPercent).toBe(50);
    });

    it('returns NaN optimizedPercent for zero totalInstances', () => {
        const result = getManagedInstanceOptimizationSummary([]);
        // Math.round(0/0) = NaN
        expect(isNaN(result.optimizedPercent)).toBe(true);
    });

    it('considers AOAG deployments as optimized for license (always true)', () => {
        vi.mocked(mockIsAoagDeployment).mockReturnValueOnce(true);
        const assess = makeOptimizedMssqlAssessment({
            deploymentType: 'AOAG',
            license: { status: 'NOT_OPTIMIZED', severity: 'warning' }
        });
        const data = [makeMssqlHost('h1', assess)];
        const result = getManagedInstanceOptimizationSummary(data);
        // license is always considered optimized for AOAG, so instance should still be optimized
        expect(result.optimizedInstances).toBe(1);
        vi.mocked(mockIsAoagDeployment).mockReturnValue(false);
    });
});

// ─── Enhanced getManagedOptimizationSummary ───────────────────────────────────
describe('getManagedOptimizationSummary (extended)', () => {
    beforeEach(() => {
        mockGetState.mockReturnValue({
            headers: {
                headerSelectedMultiCredIdsList: ['cred1'],
                headerSelectedMultiRegionIdsList: ['us-east-1']
            },
            inventoryV2: { inventoryTableData: {} }
        });
    });

    it('counts optimized MSSQL instances', () => {
        const data = [makeMssqlHost('h1', makeOptimizedMssqlAssessment())];
        const result = getManagedOptimizationSummary(data, []);
        expect(result.totalInstances).toBe(1);
        expect(result.optimizedInstances).toBe(1);
    });

    it('counts critical not-optimized MSSQL instances (hostOsPatch critical)', () => {
        const assess = makeNotOptimizedMssqlAssessment();
        const data = [makeMssqlHost('h1', assess)];
        const result = getManagedOptimizationSummary(data, []);
        expect(result.criticalNotOptimizedInstances).toBe(1);
    });

    it('counts warning not-optimized MSSQL instances (compute warning)', () => {
        const assess = makeOptimizedMssqlAssessment({
            compute: { status: 'NOT_OPTIMIZED', severity: 'warning' }
        });
        const data = [makeMssqlHost('h1', assess)];
        const result = getManagedOptimizationSummary(data, []);
        expect(result.warningNotOptimizedInstances).toBe(1);
        expect(result.criticalNotOptimizedInstances).toBe(0);
    });

    it('processes Oracle instances alongside MSSQL', () => {
        const mssqlData = [makeMssqlHost('h1', makeOptimizedMssqlAssessment())];
        const oracleData = [makeOracleHost('oh1', makeOracleAssessment())];
        const result = getManagedOptimizationSummary(mssqlData, oracleData);
        expect(result.totalInstances).toBeGreaterThanOrEqual(1);
    });

    it('calculates optimizedPercent correctly for multiple instances', () => {
        const host1 = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const host2 = makeMssqlHost('h2', makeNotOptimizedMssqlAssessment());
        const result = getManagedOptimizationSummary([host1, host2], []);
        expect(result.totalInstances).toBe(2);
        expect(result.optimizedPercent).toBe(50);
    });

    it('skips instances from non-matching cred/region', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment(), 'other-cred', 'eu-west-1');
        const result = getManagedOptimizationSummary([host], []);
        expect(result.totalInstances).toBe(0);
    });

    it('sets hasDismissedOrPostponed when MSSQL instance has dismissed config', () => {
        const assess = makeOptimizedMssqlAssessment({
            dismissedConfigurations: { compute: { configState: 'POSTPONED' } }
        });
        const data = [makeMssqlHost('h1', assess)];
        const result = getManagedOptimizationSummary(data, []);
        expect(result.hasDismissedOrPostponed).toBe(true);
    });
});

// ─── Enhanced getAssessmentGroupedByCategory ─────────────────────────────────
describe('getAssessmentGroupedByCategory (extended)', () => {
    beforeEach(() => {
        mockGetState.mockReturnValue({
            headers: {
                headerSelectedMultiCredIdsList: ['cred1'],
                headerSelectedMultiRegionIdsList: ['us-east-1']
            },
            inventoryV2: { inventoryTableData: {} }
        });
    });

    it('increments mssqlTotal for valid MSSQL instance', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByCategory([host], []);
        expect(result.mssqlTotal).toBe(1);
    });

    it('increments mssqlCompute for fully compute-optimized instance', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByCategory([host], []);
        expect(result.mssqlCompute).toBe(1);
    });

    it('does NOT increment mssqlCompute when compute is NOT_OPTIMIZED', () => {
        const assess = makeOptimizedMssqlAssessment({
            compute: { status: 'NOT_OPTIMIZED', severity: 'warning' }
        });
        const host = makeMssqlHost('h1', assess);
        const result = getAssessmentGroupedByCategory([host], []);
        expect(result.mssqlCompute).toBe(0);
    });

    it('increments mssqlStorage for storage-optimized instance', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByCategory([host], []);
        expect(result.mssqlStorage).toBe(1);
    });

    it('does NOT increment mssqlStorage when storage sizing is incomplete', () => {
        const assess = makeOptimizedMssqlAssessment({
            storage: {
                ...makeOptimizedMssqlAssessment().storage,
                sizing: [{ name: 'headroom', status: 'OPTIMIZED' }] // only 1 item, not 4
            }
        });
        const host = makeMssqlHost('h1', assess);
        const result = getAssessmentGroupedByCategory([host], []);
        expect(result.mssqlStorage).toBe(0);
    });

    it('increments application for license + mssqlPatch + maxDOP all optimized', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByCategory([host], []);
        expect(result.application).toBe(1);
    });

    it('increments resiliency for snapshot + crr + awsBackup all optimized (non-HA)', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByCategory([host], []);
        expect(result.resiliency).toBe(1);
    });

    it('increments cloning for clone optimized', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByCategory([host], []);
        expect(result.cloning).toBe(1);
    });

    it('does NOT increment cloning when clone is NOT_OPTIMIZED', () => {
        const assess = makeOptimizedMssqlAssessment({
            clone: { status: 'NOT_OPTIMIZED', severity: 'warning' }
        });
        const host = makeMssqlHost('h1', assess);
        const result = getAssessmentGroupedByCategory([host], []);
        expect(result.cloning).toBe(0);
    });

    it('increments oracleTotal for valid Oracle instance', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByCategory([], [host]);
        expect(result.oracleTotal).toBe(1);
    });

    it('increments oracleCompute for hostOsPatch OPTIMIZED in Oracle', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByCategory([], [host]);
        expect(result.oracleCompute).toBe(1);
    });

    it('does NOT increment oracleCompute when Oracle hostOsPatch is NOT_OPTIMIZED', () => {
        const host = makeOracleHost(
            'oh1',
            makeOracleAssessment({
                hostOsPatch: { status: 'NOT_OPTIMIZED', severity: 'critical' }
            })
        );
        const result = getAssessmentGroupedByCategory([], [host]);
        expect(result.oracleCompute).toBe(0);
    });

    it('increments oracleStorage for Oracle storage-optimized instance', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByCategory([], [host]);
        expect(result.oracleStorage).toBe(1);
    });

    it('processes both MSSQL and Oracle in the same call', () => {
        const mssqlHost = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const oracleHost = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByCategory([mssqlHost], [oracleHost]);
        expect(result.mssqlTotal).toBe(1);
        expect(result.oracleTotal).toBe(1);
    });

    it('skips instances with errors in Oracle assessment', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        host.instancesAssessment[0] = { ...host.instancesAssessment[0], error: true } as any;
        const result = getAssessmentGroupedByCategory([], [host]);
        expect(result.oracleTotal).toBe(0);
    });
});
