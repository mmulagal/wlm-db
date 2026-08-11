import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
    isOptimized,
    isOptimizedDashInner,
    isActivating,
    isDismissed,
    hasPostponedOrDismissed,
    checkConfigState,
    setConfigState,
    getTotalManagedAggrCost,
    getManagedHostCountFromInventory,
    getManagedHostCount,
    getManagedAggrProtection,
    getManagedAggrStorageSavings,
    getManageAggrCost,
    getPotentialSavingsValues,
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
    uniqueHostRow: vi.fn(() => []),
    shouldSkipWellArchAssessmentItem: vi.fn(() => false),
    shouldSkipDuplicateAssessmentInstance: vi.fn(() => false),
    resolveInventoryRowForAssessmentInstance: vi.fn(() => null)
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
        expect(result.totalEbsCost).toBe(1000);
        expect(result.totalFsxnCostForEbsHost).toBe(600);
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
        expect(result.storage.optimized).toBe(0);
        expect(result.totalInstances).toBe(0);
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
        expect(result.totalInstances).toBe(0);
    });
});

// ─── getManagedOptimizationSummary ───────────────────────────────────────────
describe('getManagedOptimizationSummary', () => {
    it('returns zero counts for empty data', () => {
        const result = getManagedOptimizationSummary([], []);
        expect(result.totalInstances).toBe(0);
        expect(result.totalConfigurations).toBe(0);
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

// ─── Shared test data factories (flat assessment model) ───────────────────────
// Factories accept the legacy nested override shape (compute, storage.sizing/layout,
// dismissedConfigurations as a map, highAvailability array) for test readability and
// convert it into the flat `assessments`/`metadata`/`dismissedConfigurations` shape
// that getAssessmentGroupedByConfigurations (and friends) consume in production.

const MSSQL_PATCH_KEY_TO_ID: Record<string, string> = {
    compute: 'compute-rightsizing',
    rssConfig: 'rss-config',
    hostOsPatch: 'host-os-patch',
    mtuAlignment: 'mtu-alignment',
    license: 'sql-license',
    mssqlPatch: 'mssql-patch',
    maxDOP: 'maxdop',
    clone: 'clone-management',
    snapshotPolicy: 'snapshot-policy',
    awsBackup: 'backup-configuration',
    crr: 'crr'
};

const MSSQL_DEFAULT_ITEMS: Array<{ id: string; type: string; severity: string }> = [
    { id: 'compute-rightsizing', type: 'compute', severity: 'warning' },
    { id: 'rss-config', type: 'compute', severity: 'warning' },
    { id: 'host-os-patch', type: 'compute', severity: 'critical' },
    { id: 'mtu-alignment', type: 'compute', severity: 'critical' },
    { id: 'sql-license', type: 'application', severity: 'warning' },
    { id: 'mssql-patch', type: 'application', severity: 'warning' },
    { id: 'maxdop', type: 'application', severity: 'warning' },
    { id: 'clone-management', type: 'cloning', severity: 'warning' },
    { id: 'snapshot-policy', type: 'resiliency', severity: 'warning' },
    { id: 'backup-configuration', type: 'resiliency', severity: 'warning' },
    { id: 'crr', type: 'resiliency', severity: 'warning' },
    { id: 'performance-tier', type: 'storage', severity: 'warning' },
    { id: 'headroom', type: 'storage', severity: 'warning' },
    { id: 'log-drive-size', type: 'storage', severity: 'warning' },
    { id: 'tempdb-drive-size', type: 'storage', severity: 'warning' },
    { id: 'data-files-location', type: 'storage', severity: 'warning' },
    { id: 'log-files-location', type: 'storage', severity: 'warning' },
    { id: 'tempdb-files-location', type: 'storage', severity: 'warning' }
];

/** Converts a nested `dismissedConfigurations` override (direct key or `storage.sizing/layout` entries) to the flat array. */
const normalizeDismissedConfigurations = (dismissed: any): any[] => {
    if (Array.isArray(dismissed)) {
        return dismissed;
    }
    if (!dismissed || typeof dismissed !== 'object') {
        return [];
    }
    const entries: any[] = [];
    Object.entries(dismissed).forEach(([key, value]: [string, any]) => {
        if (key === 'storage' && value && typeof value === 'object') {
            [...(value.sizing ?? []), ...(value.layout ?? [])].forEach((item: any) => {
                entries.push({ id: item.configurationName, configState: item.configState });
            });
            return;
        }
        if (value && typeof value === 'object' && 'configState' in value) {
            entries.push({ id: MSSQL_PATCH_KEY_TO_ID[key] ?? key, configState: value.configState });
        }
    });
    return entries;
};

/** Applies `storage.sizing`/`storage.layout` name-matched overrides onto the flat assessment items. */
const applyStoragePatches = (assessments: any[], storage: any) => {
    if (!storage) {
        return;
    }
    [...(storage.sizing ?? []), ...(storage.layout ?? [])].forEach((patch: any) => {
        const idx = assessments.findIndex(item => item.id === patch.name);
        if (idx >= 0) {
            assessments[idx] = {
                ...assessments[idx],
                status: patch.status,
                severity: patch.severity ?? assessments[idx].severity
            };
        }
    });
};

const makeOptimizedMssqlAssessment = (overrides: any = {}) => {
    const {
        lastAssessmentTimestamp = 'lastAssessmentTimestamp' in overrides
            ? overrides.lastAssessmentTimestamp
            : '2024-01-01T00:00:00Z',
        deploymentType = 'STANDALONE',
        dismissedConfigurations = {},
        highAvailability,
        storage,
        excludeIds = [],
        extraItems = [],
        ...configOverrides
    } = overrides;

    const assessments = MSSQL_DEFAULT_ITEMS.filter(item => !excludeIds.includes(item.id)).map(item => ({
        ...item,
        status: 'OPTIMIZED'
    }));

    Object.entries(configOverrides).forEach(([key, value]: [string, any]) => {
        const id = MSSQL_PATCH_KEY_TO_ID[key];
        const idx = id ? assessments.findIndex(item => item.id === id) : -1;
        if (idx >= 0 && value && typeof value === 'object') {
            assessments[idx] = { ...assessments[idx], ...value };
        }
    });

    applyStoragePatches(assessments, storage);

    if (Array.isArray(highAvailability)) {
        highAvailability.forEach((item: any) => {
            assessments.push({
                id: item.name,
                type: 'resiliency',
                status: item.status ?? 'OPTIMIZED',
                severity: item.severity ?? 'critical'
            });
        });
    }

    extraItems.forEach((item: any) => assessments.push({ status: 'OPTIMIZED', ...item }));

    return {
        metadata: { lastAssessmentTimestamp, deploymentType },
        assessments,
        dismissedConfigurations: normalizeDismissedConfigurations(dismissedConfigurations)
    };
};

const makeNotOptimizedMssqlAssessment = () =>
    makeOptimizedMssqlAssessment({
        compute: { status: 'NOT_OPTIMIZED', severity: 'warning' },
        hostOsPatch: { status: 'NOT_OPTIMIZED', severity: 'critical' },
        storage: { sizing: [{ name: 'performance-tier', status: 'NOT_OPTIMIZED', severity: 'warning' }] }
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

const ORACLE_PATCH_KEY_TO_ID: Record<string, string> = {
    hostOsPatch: 'host-os-patch'
};

const ORACLE_DEFAULT_ITEMS: Array<{ id: string; type: string; severity: string }> = [
    { id: 'host-os-patch', type: 'compute', severity: 'critical' },
    { id: 'headroom', type: 'storage', severity: 'warning' },
    { id: 'swap-space', type: 'storage', severity: 'warning' },
    { id: 'oracle-binary-placement', type: 'storage', severity: 'warning' },
    { id: 'datafiles-placement', type: 'storage', severity: 'warning' },
    { id: 'controlfiles-placement', type: 'storage', severity: 'warning' },
    { id: 'redologs-placement', type: 'storage', severity: 'warning' },
    { id: 'templogs-placement', type: 'storage', severity: 'warning' },
    { id: 'archive-placement', type: 'storage', severity: 'warning' }
];

const ORACLE_ASM_ITEMS: Array<{ id: string; type: string; severity: string }> = [
    { id: 'data-dg-lun-layout', type: 'storage', severity: 'warning' },
    { id: 'redolog-dg-lun-layout', type: 'storage', severity: 'warning' },
    { id: 'fra-dg-lun-layout', type: 'storage', severity: 'warning' },
    { id: 'archivelog-dg-lun-layout', type: 'storage', severity: 'warning' }
];

const makeOracleAssessment = (overrides: any = {}) => {
    const {
        lastAssessmentTimestamp = '2024-01-01T00:00:00Z',
        dismissedConfigurations = {},
        storage,
        ...configOverrides
    } = overrides;

    const assessments = ORACLE_DEFAULT_ITEMS.map(item => ({ ...item, status: 'OPTIMIZED' }));

    Object.entries(configOverrides).forEach(([key, value]: [string, any]) => {
        const id = ORACLE_PATCH_KEY_TO_ID[key];
        const idx = id ? assessments.findIndex(item => item.id === id) : -1;
        if (idx >= 0 && value && typeof value === 'object') {
            assessments[idx] = { ...assessments[idx], ...value };
        }
    });

    applyStoragePatches(assessments, storage);

    return {
        metadata: { lastAssessmentTimestamp },
        assessments,
        dismissedConfigurations: normalizeDismissedConfigurations(dismissedConfigurations)
    };
};

const makeAsmOracleAssessment = (overrides: any = {}) => {
    const base = makeOracleAssessment(overrides);
    return {
        ...base,
        assessments: [...base.assessments, ...ORACLE_ASM_ITEMS.map(item => ({ ...item, status: 'OPTIMIZED' }))]
    };
};

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
        expect(result.mssqlStats).toEqual({});
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
        const assess = makeOptimizedMssqlAssessment({ lastAssessmentTimestamp: undefined });
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

    it('increments mssqlStats[performance-tier].optimized for OPTIMIZED performance-tier', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlStats['performance-tier'].optimized).toBe(1);
    });

    it('does not increment mssqlStats[performance-tier].optimized for NOT_OPTIMIZED performance-tier', () => {
        const assess = makeOptimizedMssqlAssessment({
            storage: { sizing: [{ name: 'performance-tier', status: 'NOT_OPTIMIZED', severity: 'warning' }] }
        });
        const host = makeMssqlHost('h1', assess);
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlStats['performance-tier'].optimized).toBe(0);
    });

    it('increments mssqlStats[performance-tier].dismissed when configState is DISMISSED', () => {
        const assess = makeOptimizedMssqlAssessment({
            dismissedConfigurations: {
                storage: { sizing: [{ configurationName: 'performance-tier', configState: 'DISMISSED' }] }
            }
        });
        const host = makeMssqlHost('h1', assess);
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlStats['performance-tier'].dismissed).toBe(1);
    });

    it('increments mssqlStats[performance-tier].activating when configState is ACTIVATING', () => {
        const assess = makeOptimizedMssqlAssessment({
            dismissedConfigurations: {
                storage: { sizing: [{ configurationName: 'performance-tier', configState: 'ACTIVATING' }] }
            }
        });
        const host = makeMssqlHost('h1', assess);
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlStats['performance-tier'].activating).toBe(1);
    });

    it('increments mssqlStats[headroom].optimized for headroom OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlStats.headroom.optimized).toBe(1);
    });

    it('increments mssqlStats[log-drive-size].optimized for log-drive-size OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlStats['log-drive-size'].optimized).toBe(1);
    });

    it('increments mssqlStats[tempdb-drive-size].optimized for tempdb-drive-size OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlStats['tempdb-drive-size'].optimized).toBe(1);
    });

    it('increments mssqlStats[data-files-location].optimized for data-files-location OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlStats['data-files-location'].optimized).toBe(1);
    });

    it('increments mssqlStats[log-files-location].optimized for log-files-location OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlStats['log-files-location'].optimized).toBe(1);
    });

    it('increments mssqlStats[tempdb-files-location].optimized for tempdb-files-location OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlStats['tempdb-files-location'].optimized).toBe(1);
    });

    it('increments mssqlStats[compute-rightsizing].optimized for compute OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlStats['compute-rightsizing'].optimized).toBe(1);
    });

    it('increments mssqlStats[compute-rightsizing].dismissed for dismissed compute', () => {
        const assess = makeOptimizedMssqlAssessment({
            compute: { status: 'NOT_OPTIMIZED', severity: 'warning' },
            dismissedConfigurations: { compute: { configState: 'DISMISSED' } }
        });
        const host = makeMssqlHost('h1', assess);
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlStats['compute-rightsizing'].dismissed).toBe(1);
    });

    it('increments mssqlStats[host-os-patch].optimized for hostOsPatch OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlStats['host-os-patch'].optimized).toBe(1);
    });

    it('increments mssqlStats[rss-config].optimized for rssConfig OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlStats['rss-config'].optimized).toBe(1);
    });

    it('increments mssqlStats[mtu-alignment].optimized for mtuAlignment OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlStats['mtu-alignment'].optimized).toBe(1);
    });

    it('increments mssqlStats[mssql-patch].optimized for mssqlPatch OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlStats['mssql-patch'].optimized).toBe(1);
    });

    it('increments mssqlStats[maxdop].optimized for maxDOP OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlStats.maxdop.optimized).toBe(1);
    });

    it('increments mssqlStats[snapshot-policy].optimized for snapshotPolicy OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlStats['snapshot-policy'].optimized).toBe(1);
    });

    it('increments mssqlStats[backup-configuration].optimized for awsBackup OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlStats['backup-configuration'].optimized).toBe(1);
    });

    it('increments mssqlStats[clone-management].optimized for clone OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlStats['clone-management'].optimized).toBe(1);
    });

    it('increments mssqlStats[crr].optimized for crr OPTIMIZED', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlStats.crr.optimized).toBe(1);
    });

    it('increments mssqlStats total for HA config items present in the assessment', () => {
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
        expect(result.mssqlStats['shared-storage'].total).toBe(1);
        expect(result.mssqlConfigIds).toContain('shared-storage');
    });

    it('processes multiple MSSQL hosts correctly', () => {
        const host1 = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const host2 = makeMssqlHost('h2', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host1, host2], []);
        expect(result.total).toBe(2);
        expect(result.mssqlStats['performance-tier'].optimized).toBe(2);
        expect(result.mssqlStats['compute-rightsizing'].optimized).toBe(2);
    });

    it('handles empty storage.sizing gracefully', () => {
        const assess = makeOptimizedMssqlAssessment({ excludeIds: ['performance-tier'] });
        const host = makeMssqlHost('h1', assess);
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.total).toBe(1);
        expect(result.mssqlStats['performance-tier']).toBeUndefined();
    });

    it('handles empty storage.layout gracefully', () => {
        const assess = makeOptimizedMssqlAssessment({
            excludeIds: ['data-files-location', 'log-files-location']
        });
        const host = makeMssqlHost('h1', assess);
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlStats['data-files-location']).toBeUndefined();
        expect(result.mssqlStats['log-files-location']).toBeUndefined();
    });

    it('returns mssqlConfigState object with arrays', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByConfigurations([host], []);
        expect(result.mssqlConfigState).toBeDefined();
        expect(Array.isArray(result.mssqlConfigState['performance-tier'])).toBe(true);
        expect(Array.isArray(result.mssqlConfigState['compute-rightsizing'])).toBe(true);
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

    it('increments oracleStats[oracle-binary-placement].optimized for oracle-binary-placement OPTIMIZED', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.oracleStats['oracle-binary-placement'].optimized).toBe(1);
    });

    it('increments oracleStats[datafiles-placement].optimized for datafiles-placement OPTIMIZED', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.oracleStats['datafiles-placement'].optimized).toBe(1);
    });

    it('increments oracleStats[controlfiles-placement].optimized for controlfiles-placement OPTIMIZED', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.oracleStats['controlfiles-placement'].optimized).toBe(1);
    });

    it('increments oracleStats[redologs-placement].optimized for redologs-placement OPTIMIZED', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.oracleStats['redologs-placement'].optimized).toBe(1);
    });

    it('increments oracleStats[headroom].optimized for headroom OPTIMIZED', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.oracleStats.headroom.optimized).toBe(1);
    });

    it('increments oracleStats[swap-space].optimized for swap-space OPTIMIZED', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.oracleStats['swap-space'].optimized).toBe(1);
    });

    it('increments oracleStats[host-os-patch].optimized for hostOsPatch OPTIMIZED', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.oracleStats['host-os-patch'].optimized).toBe(1);
    });

    it('increments oracleStats total when ASM LUN configs are in assessment', () => {
        const host = makeOracleHost('oh1', makeAsmOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.oracleStats['data-dg-lun-layout'].total).toBe(1);
        expect(result.oracleStats['redolog-dg-lun-layout'].total).toBe(1);
    });

    it('increments oracleStats[fra-dg-lun-layout].total for ASM with fra', () => {
        const host = makeOracleHost('oh1', makeAsmOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.oracleStats['fra-dg-lun-layout'].total).toBe(1);
        expect(result.oracleConfigIds).toContain('fra-dg-lun-layout');
    });

    it('increments oracleStats[archivelog-dg-lun-layout].total for ASM with archive', () => {
        const host = makeOracleHost('oh1', makeAsmOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.oracleStats['archivelog-dg-lun-layout'].total).toBe(1);
        expect(result.oracleConfigIds).toContain('archivelog-dg-lun-layout');
    });

    it('processes both MSSQL and Oracle hosts correctly', () => {
        const mssqlHost = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const oracleHost = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([mssqlHost], [oracleHost]);
        expect(result.total).toBe(1);
        expect(result.oracleTotal).toBe(1);
    });

    it('handles dismissed oracleStats[headroom]', () => {
        const assess = makeOracleAssessment({
            dismissedConfigurations: {
                storage: { sizing: [{ configurationName: 'headroom', configState: 'DISMISSED' }] }
            }
        });
        const host = makeOracleHost('oh1', assess);
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.oracleStats.headroom.dismissed).toBe(1);
    });

    it('handles activating oracleStats[swap-space]', () => {
        const assess = makeOracleAssessment({
            dismissedConfigurations: {
                storage: { sizing: [{ configurationName: 'swap-space', configState: 'ACTIVATING' }] }
            }
        });
        const host = makeOracleHost('oh1', assess);
        const result = getAssessmentGroupedByConfigurations([], [host]);
        expect(result.oracleStats['swap-space'].activating).toBe(1);
    });

    it('skips duplicate Oracle hosts', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByConfigurations([], [host, host]);
        expect(result.oracleTotal).toBe(1);
    });

    it('returns empty mssqlConfigIds/oracleConfigIds for empty input', () => {
        const result = getAssessmentGroupedByConfigurations([], []);
        expect(result.mssqlConfigIds).toEqual([]);
        expect(result.oracleConfigIds).toEqual([]);
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

    it('counts optimized MSSQL configurations', () => {
        const data = [makeMssqlHost('h1', makeOptimizedMssqlAssessment())];
        const result = getManagedOptimizationSummary(data, []);
        expect(result.totalInstances).toBe(1);
        expect(result.optimizedConfigurations).toBeGreaterThan(0);
        expect(result.totalConfigurations).toBeGreaterThan(0);
    });

    it('counts critical not-optimized MSSQL configurations (hostOsPatch critical)', () => {
        const assess = makeNotOptimizedMssqlAssessment();
        const data = [makeMssqlHost('h1', assess)];
        const result = getManagedOptimizationSummary(data, []);
        expect(result.criticalConfigurations).toBeGreaterThanOrEqual(1);
    });

    it('counts warning not-optimized MSSQL configurations (compute warning)', () => {
        const assess = makeOptimizedMssqlAssessment({
            compute: { status: 'NOT_OPTIMIZED', severity: 'warning' }
        });
        const data = [makeMssqlHost('h1', assess)];
        const result = getManagedOptimizationSummary(data, []);
        expect(result.warningConfigurations).toBeGreaterThanOrEqual(1);
    });

    it('processes Oracle instances alongside MSSQL', () => {
        const mssqlData = [makeMssqlHost('h1', makeOptimizedMssqlAssessment())];
        const oracleData = [makeOracleHost('oh1', makeOracleAssessment())];
        const result = getManagedOptimizationSummary(mssqlData, oracleData);
        expect(result.totalInstances).toBeGreaterThanOrEqual(1);
    });

    it('counts Oracle flat assessment items with capitalized category type', () => {
        const flatOracleAssessment = {
            metadata: { lastAssessmentTimestamp: '2024-01-01T00:00:00Z' },
            assessments: [
                {
                    id: 'oracle-security-patch',
                    type: 'Application',
                    status: 'not-optimized',
                    severity: 'critical'
                },
                {
                    id: 'thin-provision',
                    type: 'storage',
                    status: 'optimized',
                    severity: 'warning'
                }
            ]
        };
        const oracleData = [makeOracleHost('oh1', flatOracleAssessment)];
        const result = getManagedOptimizationSummary([], oracleData);
        expect(result.totalInstances).toBe(1);
        expect(result.totalConfigurations).toBe(2);
        expect(result.criticalConfigurations).toBe(1);
        expect(result.optimizedConfigurations).toBe(1);
    });

    it('calculates optimizedPercent correctly for multiple instances', () => {
        const host1 = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const host2 = makeMssqlHost('h2', makeNotOptimizedMssqlAssessment());
        const result = getManagedOptimizationSummary([host1, host2], []);
        expect(result.totalInstances).toBe(2);
        expect(result.totalConfigurations).toBeGreaterThan(0);
        expect(result.optimizedPercent).toBeGreaterThanOrEqual(0);
        expect(result.optimizedPercent).toBeLessThanOrEqual(100);
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

    it('increments compute.optimized for fully compute-optimized instance', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByCategory([host], []);
        expect(result.compute.optimized).toBeGreaterThan(0);
        expect(result.compute.total).toBeGreaterThan(0);
        expect(result.compute.optimized).toBe(result.compute.total);
    });

    it('has fewer compute.optimized when compute is NOT_OPTIMIZED', () => {
        const assess = makeOptimizedMssqlAssessment({
            compute: { status: 'NOT_OPTIMIZED', severity: 'warning' }
        });
        const host = makeMssqlHost('h1', assess);
        const result = getAssessmentGroupedByCategory([host], []);
        expect(result.compute.optimized).toBeLessThan(result.compute.total);
    });

    it('increments storage.optimized for storage-optimized instance', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByCategory([host], []);
        expect(result.storage.optimized).toBeGreaterThan(0);
        expect(result.storage.total).toBeGreaterThan(0);
        expect(result.storage.optimized).toBe(result.storage.total);
    });

    it('has fewer storage.optimized when storage has NOT_OPTIMIZED items', () => {
        const assess = makeOptimizedMssqlAssessment({
            storage: {
                sizing: [
                    { name: 'performance-tier', status: 'NOT_OPTIMIZED', severity: 'warning' },
                    { name: 'headroom', status: 'NOT_OPTIMIZED', severity: 'warning' },
                    { name: 'log-drive-size', status: 'NOT_OPTIMIZED', severity: 'warning' },
                    { name: 'tempdb-drive-size', status: 'NOT_OPTIMIZED', severity: 'warning' }
                ],
                layout: [
                    { name: 'data-files-location', status: 'NOT_OPTIMIZED', severity: 'warning' },
                    { name: 'log-files-location', status: 'NOT_OPTIMIZED', severity: 'warning' },
                    { name: 'tempdb-files-location', status: 'NOT_OPTIMIZED', severity: 'warning' }
                ],
                configuration: {}
            }
        });
        const host = makeMssqlHost('h1', assess);
        const result = getAssessmentGroupedByCategory([host], []);
        expect(result.storage.optimized).toBe(0);
    });

    it('increments application.optimized for license + mssqlPatch + maxDOP all optimized', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByCategory([host], []);
        expect(result.application.optimized).toBeGreaterThan(0);
        expect(result.application.optimized).toBe(result.application.total);
    });

    it('increments resiliency.optimized for snapshot + crr + awsBackup all optimized (non-HA)', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByCategory([host], []);
        expect(result.resiliency.optimized).toBeGreaterThan(0);
        expect(result.resiliency.optimized).toBe(result.resiliency.total);
    });

    it('increments cloning.optimized for clone optimized', () => {
        const host = makeMssqlHost('h1', makeOptimizedMssqlAssessment());
        const result = getAssessmentGroupedByCategory([host], []);
        expect(result.cloning.optimized).toBe(1);
    });

    it('does NOT increment cloning.optimized when clone is NOT_OPTIMIZED', () => {
        const assess = makeOptimizedMssqlAssessment({
            clone: { status: 'NOT_OPTIMIZED', severity: 'warning' }
        });
        const host = makeMssqlHost('h1', assess);
        const result = getAssessmentGroupedByCategory([host], []);
        expect(result.cloning.optimized).toBe(0);
    });

    it('increments oracleTotal for valid Oracle instance', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByCategory([], [host]);
        expect(result.oracleTotal).toBe(1);
    });

    it('increments compute.optimized for hostOsPatch OPTIMIZED in Oracle', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByCategory([], [host]);
        expect(result.compute.optimized).toBe(1);
    });

    it('does NOT increment compute.optimized when Oracle hostOsPatch is NOT_OPTIMIZED', () => {
        const host = makeOracleHost(
            'oh1',
            makeOracleAssessment({
                hostOsPatch: { status: 'NOT_OPTIMIZED', severity: 'critical' }
            })
        );
        const result = getAssessmentGroupedByCategory([], [host]);
        expect(result.compute.optimized).toBe(0);
    });

    it('increments storage.optimized for Oracle storage-optimized instance', () => {
        const host = makeOracleHost('oh1', makeOracleAssessment());
        const result = getAssessmentGroupedByCategory([], [host]);
        expect(result.storage.optimized).toBeGreaterThan(0);
        expect(result.storage.optimized).toBe(result.storage.total);
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
