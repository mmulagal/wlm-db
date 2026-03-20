/**
 * Cross-validation test for Well-Architected configuration counting.
 * Ensures getManagedOptimizationSummary and getAssessmentGroupedByCategory
 * produce consistent totals for MSSQL, Oracle, and WAD scenarios.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getManagedOptimizationSummary, getAssessmentGroupedByCategory } from './DatabaseHomeUtils';

vi.mock('../../store/store', () => ({
    default: {
        getState: () => ({
            headers: {
                headerSelectedMultiCredIdsList: ['cred-1'],
                headerSelectedMultiRegionIdsList: ['us-east-1']
            }
        }),
        dispatch: vi.fn()
    }
}));

vi.mock('../../store/workloadFactory/inventoryV2Slice', () => ({
    setManagedHostInstanceLoading: vi.fn()
}));

vi.mock('../GetWell/GetWellUtils', () => ({
    isAoagDeployment: (type: string) => type === 'AOAG',
    isMssqlHaDeployment: (type: string) => type === 'FCI' || type === 'AOAG',
    formatOptimizationBreakDown: vi.fn(),
    getCardsData: vi.fn()
}));

vi.mock('../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils', () => ({
    formatOracleOptimizationBreakDown: vi.fn(),
    getOracleCardsData: vi.fn()
}));

// --- Data builders ---

const buildMssqlAssessment = (overrides: Record<string, unknown> = {}) => ({
    lastAssessmentTimestamp: '1730074791000',
    deploymentType: 'Standalone',
    dismissedConfigurations: {},
    compute: { status: 'optimized', severity: 'warning' },
    rssConfig: { status: 'optimized', severity: 'warning' },
    hostOsPatch: { status: 'optimized', severity: 'critical' },
    mtuAlignment: { status: 'optimized', severity: 'critical' },
    license: { status: 'optimized', severity: 'warning' },
    mssqlPatch: { status: 'optimized', severity: 'warning' },
    maxDOP: { status: 'optimized', severity: 'warning' },
    clone: { status: 'optimized', severity: 'warning' },
    snapshotPolicy: { status: 'optimized', severity: 'warning' },
    crr: { status: 'optimized', severity: 'warning' },
    awsBackup: { status: 'optimized', severity: 'warning' },
    storage: {
        layout: [
            { name: 'data-files-location', status: 'optimized', severity: 'critical' },
            { name: 'log-files-location', status: 'optimized', severity: 'critical' },
            { name: 'tempdb-files-location', status: 'optimized', severity: 'critical' }
        ],
        sizing: [
            { name: 'headroom', status: 'optimized', severity: 'critical' },
            { name: 'tempdb-drive-size', status: 'optimized', severity: 'critical' },
            { name: 'log-drive-size', status: 'optimized', severity: 'critical' },
            { name: 'performance-tier', status: 'optimized', severity: 'critical' }
        ],
        configuration: {
            volumes: [{ name: 'thin-provision', status: 'optimized', severity: 'critical' }],
            luns: [],
            os: []
        }
    },
    ...overrides
});

const buildOracleAssessment = (overrides: Record<string, unknown> = {}) => ({
    lastAssessmentTimestamp: '1730074791000',
    dismissedConfigurations: {},
    hostOsPatch: { status: 'optimized', severity: 'warning' },
    oracleSecurityPatch: { status: 'optimized', severity: 'critical' },
    crr: { status: 'optimized', severity: 'warning' },
    storage: {
        layout: [
            { name: 'redologs-placement', status: 'optimized', severity: 'warning' },
            { name: 'datafiles-placement', status: 'optimized', severity: 'critical' }
        ],
        sizing: [
            { name: 'swap-space', status: 'optimized', severity: 'critical' },
            { name: 'headroom', status: 'optimized', severity: 'warning' }
        ],
        configuration: { volumes: [], luns: [], os: [] }
    },
    ...overrides
});

const wrapMssqlHost = (assessments: Record<string, unknown>[], hostOverrides: Record<string, unknown> = {}) => ({
    credentialId: 'cred-1',
    regionId: 'us-east-1',
    databaseHostId: 'mssql-host-1',
    ...hostOverrides,
    instancesAssessment: assessments.map((a, i) => ({
        databaseInstanceId: `mssql-inst-${i}`,
        assessments: a
    }))
});

const wrapOracleHost = (assessments: Record<string, unknown>[], hostOverrides: Record<string, unknown> = {}) => ({
    credentialId: 'cred-1',
    regionId: 'us-east-1',
    databaseHostId: 'oracle-host-1',
    ...hostOverrides,
    instancesAssessment: assessments.map((a, i) => ({
        databaseInstanceId: `oracle-inst-${i}`,
        assessments: a
    }))
});

// --- Helper to sum category totals ---

const sumCategories = (result: ReturnType<typeof getAssessmentGroupedByCategory>, key: 'total' | 'optimized') =>
    result.storage[key] + result.compute[key] + result.application[key] + result.resiliency[key] + result.cloning[key];

// --- Tests ---

describe('Well-Architected Count Cross-Validation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('summary vs category consistency (MSSQL only)', () => {
        it('totals match for a single fully-optimized MSSQL instance', () => {
            const mssqlData = [wrapMssqlHost([buildMssqlAssessment()])];

            const summary = getManagedOptimizationSummary(mssqlData, []);
            const category = getAssessmentGroupedByCategory(mssqlData, []);

            expect(sumCategories(category, 'total')).toBe(summary.totalConfigurations);
            expect(sumCategories(category, 'optimized')).toBe(summary.optimizedConfigurations);
            expect(summary.totalInstances).toBe(1);
            expect(category.totalInstances).toBe(1);
        });

        it('totals match for a partially-optimized MSSQL instance', () => {
            const assessment = buildMssqlAssessment({
                compute: { status: 'not-optimized', severity: 'warning' },
                rssConfig: { status: 'not-optimized', severity: 'critical' },
                maxDOP: { status: 'not-optimized', severity: 'warning' }
            });
            const mssqlData = [wrapMssqlHost([assessment])];

            const summary = getManagedOptimizationSummary(mssqlData, []);
            const category = getAssessmentGroupedByCategory(mssqlData, []);

            expect(sumCategories(category, 'total')).toBe(summary.totalConfigurations);
            expect(sumCategories(category, 'optimized')).toBe(summary.optimizedConfigurations);
            expect(summary.notOptimizedConfigurations).toBe(3);
        });

        it('totals match across multiple MSSQL instances', () => {
            const fullyOptimized = buildMssqlAssessment();
            const partiallyOptimized = buildMssqlAssessment({
                clone: { status: 'not-optimized', severity: 'warning' }
            });
            const mssqlData = [wrapMssqlHost([fullyOptimized, partiallyOptimized])];

            const summary = getManagedOptimizationSummary(mssqlData, []);
            const category = getAssessmentGroupedByCategory(mssqlData, []);

            expect(sumCategories(category, 'total')).toBe(summary.totalConfigurations);
            expect(sumCategories(category, 'optimized')).toBe(summary.optimizedConfigurations);
            expect(summary.totalInstances).toBe(2);
        });
    });

    describe('summary vs category consistency (Oracle only)', () => {
        it('totals match for a single fully-optimized Oracle instance', () => {
            const oracleData = [wrapOracleHost([buildOracleAssessment()])];

            const summary = getManagedOptimizationSummary([], oracleData);
            const category = getAssessmentGroupedByCategory([], oracleData);

            expect(sumCategories(category, 'total')).toBe(summary.totalConfigurations);
            expect(sumCategories(category, 'optimized')).toBe(summary.optimizedConfigurations);
            expect(summary.totalInstances).toBe(1);
            expect(category.totalInstances).toBe(1);
        });

        it('totals match for a partially-optimized Oracle instance', () => {
            const assessment = buildOracleAssessment({
                hostOsPatch: { status: 'not-optimized', severity: 'warning' },
                oracleSecurityPatch: { status: 'not-optimized', severity: 'critical' }
            });
            const oracleData = [wrapOracleHost([assessment])];

            const summary = getManagedOptimizationSummary([], oracleData);
            const category = getAssessmentGroupedByCategory([], oracleData);

            expect(sumCategories(category, 'total')).toBe(summary.totalConfigurations);
            expect(sumCategories(category, 'optimized')).toBe(summary.optimizedConfigurations);
            expect(summary.notOptimizedConfigurations).toBe(2);
        });
    });

    describe('summary vs category consistency (MSSQL + Oracle combined)', () => {
        it('totals match when both MSSQL and Oracle data are present', () => {
            const mssqlData = [wrapMssqlHost([buildMssqlAssessment()])];
            const oracleData = [wrapOracleHost([buildOracleAssessment()])];

            const summary = getManagedOptimizationSummary(mssqlData, oracleData);
            const category = getAssessmentGroupedByCategory(mssqlData, oracleData);

            expect(sumCategories(category, 'total')).toBe(summary.totalConfigurations);
            expect(sumCategories(category, 'optimized')).toBe(summary.optimizedConfigurations);
            expect(summary.totalInstances).toBe(2);
        });

        it('totals match with mixed optimization states', () => {
            const mssqlAssessment = buildMssqlAssessment({
                compute: { status: 'not-optimized', severity: 'warning' }
            });
            const oracleAssessment = buildOracleAssessment({
                oracleSecurityPatch: { status: 'not-optimized', severity: 'critical' }
            });
            const mssqlData = [wrapMssqlHost([mssqlAssessment])];
            const oracleData = [wrapOracleHost([oracleAssessment])];

            const summary = getManagedOptimizationSummary(mssqlData, oracleData);
            const category = getAssessmentGroupedByCategory(mssqlData, oracleData);

            expect(sumCategories(category, 'total')).toBe(summary.totalConfigurations);
            expect(sumCategories(category, 'optimized')).toBe(summary.optimizedConfigurations);
            expect(summary.notOptimizedConfigurations).toBe(2);
        });
    });

    describe('summary vs category consistency (WAD scenarios)', () => {
        it('totals match for MSSQL WAD instance', () => {
            const wadData = [
                wrapMssqlHost([buildMssqlAssessment()], {
                    databaseHostId: 'mssql-wad-host',
                    isWad: true
                })
            ];

            const summary = getManagedOptimizationSummary(wadData, []);
            const category = getAssessmentGroupedByCategory(wadData, []);

            expect(sumCategories(category, 'total')).toBe(summary.totalConfigurations);
            expect(sumCategories(category, 'optimized')).toBe(summary.optimizedConfigurations);
            // WAD should have fewer configs than non-WAD
            const normalSummary = getManagedOptimizationSummary([wrapMssqlHost([buildMssqlAssessment()])], []);
            expect(summary.totalConfigurations).toBeLessThan(normalSummary.totalConfigurations);
        });

        it('totals match for Oracle WAD instance', () => {
            const wadData = [
                wrapOracleHost([buildOracleAssessment()], {
                    databaseHostId: 'oracle-wad-host',
                    isWad: true
                })
            ];

            const summary = getManagedOptimizationSummary([], wadData);
            const category = getAssessmentGroupedByCategory([], wadData);

            expect(sumCategories(category, 'total')).toBe(summary.totalConfigurations);
            expect(sumCategories(category, 'optimized')).toBe(summary.optimizedConfigurations);
            // WAD should have fewer configs than non-WAD
            const normalSummary = getManagedOptimizationSummary([], [wrapOracleHost([buildOracleAssessment()])]);
            expect(summary.totalConfigurations).toBeLessThan(normalSummary.totalConfigurations);
        });

        it('totals match for mixed WAD + non-WAD across MSSQL and Oracle', () => {
            const mssqlData = [
                wrapMssqlHost([buildMssqlAssessment()]),
                wrapMssqlHost([buildMssqlAssessment()], {
                    databaseHostId: 'mssql-wad-host',
                    isWad: true
                })
            ];
            const oracleData = [
                wrapOracleHost([buildOracleAssessment()]),
                wrapOracleHost([buildOracleAssessment()], {
                    databaseHostId: 'oracle-wad-host',
                    isWad: true
                })
            ];

            const summary = getManagedOptimizationSummary(mssqlData, oracleData);
            const category = getAssessmentGroupedByCategory(mssqlData, oracleData);

            expect(sumCategories(category, 'total')).toBe(summary.totalConfigurations);
            expect(sumCategories(category, 'optimized')).toBe(summary.optimizedConfigurations);
            expect(summary.totalInstances).toBe(4);
        });
    });

    describe('invariant: optimized never exceeds total', () => {
        it('holds for MSSQL-only data', () => {
            const mssqlData = [wrapMssqlHost([buildMssqlAssessment()])];
            const result = getManagedOptimizationSummary(mssqlData, []);

            expect(result.optimizedConfigurations).toBeLessThanOrEqual(result.totalConfigurations);
        });

        it('holds for Oracle-only data', () => {
            const oracleData = [wrapOracleHost([buildOracleAssessment()])];
            const result = getManagedOptimizationSummary([], oracleData);

            expect(result.optimizedConfigurations).toBeLessThanOrEqual(result.totalConfigurations);
        });

        it('holds per category for combined data', () => {
            const mssqlData = [wrapMssqlHost([buildMssqlAssessment()])];
            const oracleData = [wrapOracleHost([buildOracleAssessment()])];
            const result = getAssessmentGroupedByCategory(mssqlData, oracleData);

            expect(result.storage.optimized).toBeLessThanOrEqual(result.storage.total);
            expect(result.compute.optimized).toBeLessThanOrEqual(result.compute.total);
            expect(result.application.optimized).toBeLessThanOrEqual(result.application.total);
            expect(result.resiliency.optimized).toBeLessThanOrEqual(result.resiliency.total);
            expect(result.cloning.optimized).toBeLessThanOrEqual(result.cloning.total);
        });
    });
});
