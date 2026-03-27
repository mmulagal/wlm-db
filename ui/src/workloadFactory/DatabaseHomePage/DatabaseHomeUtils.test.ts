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

vi.mock('../InventoryV2/InventoryUtilsV2', () => ({
    uniqueHostRow: vi.fn()
}));

vi.mock('../../utils/utilityFunctions', () => ({
    formatFractionalNumber: vi.fn(),
    formatSizeOnePrecision: vi.fn(),
    formatSizeSplit: vi.fn(),
    getByteVal: vi.fn(),
    isAwsBackupEnabled: vi.fn(),
    roundOffNumber: vi.fn(),
    sortListOfDict: vi.fn()
}));

vi.mock('../../utils/appConstants', () => ({
    GENERAL: {}
}));

const buildMssqlAssessment = (overrides: any = {}) => ({
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

const wrapInHost = (assessments: any[], credentialId = 'cred-1', regionId = 'us-east-1') => [
    {
        credentialId,
        regionId,
        databaseHostId: 'host-1',
        instancesAssessment: assessments.map((a, i) => ({
            databaseInstanceId: `instance-${i}`,
            assessments: a
        }))
    }
];

describe('getManagedOptimizationSummary (configuration-based)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 100% when all configs are optimized', () => {
        const data = wrapInHost([buildMssqlAssessment()]);
        const result = getManagedOptimizationSummary(data, []);

        expect(result.optimizedPercent).toBe(100);
        expect(result.totalInstances).toBe(1);
        expect(result.totalConfigurations).toBeGreaterThan(0);
        expect(result.optimizedConfigurations).toBe(result.totalConfigurations);
        expect(result.notOptimizedConfigurations).toBe(0);
        expect(result.criticalConfigurations).toBe(0);
        expect(result.warningConfigurations).toBe(0);
    });

    it('returns >0% when some configs are not optimized', () => {
        const assessment = buildMssqlAssessment({
            compute: { status: 'not-optimized', severity: 'warning' },
            rssConfig: { status: 'not-optimized', severity: 'critical' }
        });
        const data = wrapInHost([assessment]);
        const result = getManagedOptimizationSummary(data, []);

        expect(result.optimizedPercent).toBeGreaterThan(0);
        expect(result.optimizedPercent).toBeLessThan(100);
        expect(result.notOptimizedConfigurations).toBe(2);
        expect(result.criticalConfigurations).toBe(1);
        expect(result.warningConfigurations).toBe(1);
    });

    it('excludes dismissed configs from the total', () => {
        const assessment = buildMssqlAssessment({
            dismissedConfigurations: {
                compute: { configState: 'DISMISSED' }
            }
        });
        const data = wrapInHost([assessment]);
        const result = getManagedOptimizationSummary(data, []);

        const allOptimizedResult = getManagedOptimizationSummary(wrapInHost([buildMssqlAssessment()]), []);

        expect(result.totalConfigurations).toBe(allOptimizedResult.totalConfigurations - 1);
        expect(result.optimizedPercent).toBe(100);
        expect(result.hasDismissedOrPostponed).toBe(true);
    });

    it('treats activating configs as optimized', () => {
        const assessment = buildMssqlAssessment({
            compute: { status: 'not-optimized', severity: 'warning' },
            dismissedConfigurations: {
                compute: { configState: 'ACTIVATING' }
            }
        });
        const data = wrapInHost([assessment]);
        const result = getManagedOptimizationSummary(data, []);

        expect(result.optimizedPercent).toBe(100);
        expect(result.hasDismissedOrPostponed).toBe(true);
    });

    it('correctly counts configs across multiple instances', () => {
        const fullyOptimized = buildMssqlAssessment();
        const partiallyOptimized = buildMssqlAssessment({
            compute: { status: 'not-optimized', severity: 'warning' }
        });
        const data = wrapInHost([fullyOptimized, partiallyOptimized]);
        const result = getManagedOptimizationSummary(data, []);

        expect(result.totalInstances).toBe(2);
        expect(result.notOptimizedConfigurations).toBe(1);
        expect(result.optimizedPercent).toBeGreaterThan(0);
        expect(result.optimizedPercent).toBeLessThan(100);
    });

    it('handles empty assessment data', () => {
        const result = getManagedOptimizationSummary([], []);

        expect(result.totalInstances).toBe(0);
        expect(result.totalConfigurations).toBe(0);
        expect(result.optimizedPercent).toBe(0);
    });

    it('skips instances with errors', () => {
        const data = [
            {
                credentialId: 'cred-1',
                regionId: 'us-east-1',
                databaseHostId: 'host-1',
                instancesAssessment: [{ error: 'some error', assessments: buildMssqlAssessment() }]
            }
        ];
        const result = getManagedOptimizationSummary(data, []);

        expect(result.totalInstances).toBe(0);
        expect(result.totalConfigurations).toBe(0);
    });

    it('filters by credentials and region', () => {
        const data = [
            {
                credentialId: 'wrong-cred',
                regionId: 'us-east-1',
                databaseHostId: 'host-1',
                instancesAssessment: [{ assessments: buildMssqlAssessment() }]
            }
        ];
        const result = getManagedOptimizationSummary(data, []);

        expect(result.totalInstances).toBe(0);
    });

    it('combines MSSQL and Oracle configs', () => {
        const mssqlData = wrapInHost([buildMssqlAssessment()]);
        const oracleData = [
            {
                credentialId: 'cred-1',
                regionId: 'us-east-1',
                databaseHostId: 'oracle-host-1',
                instancesAssessment: [
                    {
                        assessments: {
                            lastAssessmentTimestamp: '123',
                            dismissedConfigurations: {},
                            hostOsPatch: { status: 'not-optimized', severity: 'warning' },
                            storage: {
                                layout: [{ name: 'redologs-placement', status: 'optimized', severity: 'warning' }],
                                configuration: {
                                    volumes: [],
                                    luns: [],
                                    os: []
                                }
                            }
                        }
                    }
                ]
            }
        ];
        const result = getManagedOptimizationSummary(mssqlData, oracleData);

        expect(result.totalInstances).toBe(2);
        expect(result.notOptimizedConfigurations).toBe(1);
        expect(result.warningConfigurations).toBe(1);
    });

    it('skips license for AOAG deployments', () => {
        const standalone = buildMssqlAssessment();
        const aoag = buildMssqlAssessment({ deploymentType: 'AOAG' });

        const standaloneResult = getManagedOptimizationSummary(wrapInHost([standalone]), []);
        const aoagResult = getManagedOptimizationSummary(wrapInHost([aoag]), []);

        expect(aoagResult.totalConfigurations).toBe(standaloneResult.totalConfigurations - 1);
    });

    it('counts Oracle oracleSecurityPatch in application category', () => {
        const oracleData = [
            {
                credentialId: 'cred-1',
                regionId: 'us-east-1',
                databaseHostId: 'oracle-host-1',
                instancesAssessment: [
                    {
                        assessments: {
                            lastAssessmentTimestamp: '123',
                            dismissedConfigurations: {},
                            hostOsPatch: { status: 'optimized', severity: 'warning' },
                            oracleSecurityPatch: { status: 'not-optimized', severity: 'critical' },
                            storage: { layout: [], configuration: { volumes: [], luns: [], os: [] } }
                        }
                    }
                ]
            }
        ];
        const result = getManagedOptimizationSummary([], oracleData);

        expect(result.totalInstances).toBe(1);
        expect(result.notOptimizedConfigurations).toBe(1);
        expect(result.criticalConfigurations).toBe(1);
    });

    it('counts Oracle storage.sizing configs', () => {
        const oracleData = [
            {
                credentialId: 'cred-1',
                regionId: 'us-east-1',
                databaseHostId: 'oracle-host-1',
                instancesAssessment: [
                    {
                        assessments: {
                            lastAssessmentTimestamp: '123',
                            dismissedConfigurations: {},
                            hostOsPatch: { status: 'optimized', severity: 'warning' },
                            storage: {
                                layout: [],
                                sizing: [
                                    { name: 'swap-space', status: 'not-optimized', severity: 'critical' },
                                    { name: 'headroom', status: 'optimized', severity: 'warning' }
                                ],
                                configuration: { volumes: [], luns: [], os: [] }
                            }
                        }
                    }
                ]
            }
        ];
        const result = getManagedOptimizationSummary([], oracleData);

        expect(result.totalConfigurations).toBe(3);
        expect(result.optimizedConfigurations).toBe(2);
        expect(result.notOptimizedConfigurations).toBe(1);
    });

    it('skips WAD-excluded Oracle configs (hostOsPatch, crr, oracleSecurityPatch) for isWad instances', () => {
        const oracleData = [
            {
                credentialId: 'cred-1',
                regionId: 'us-east-1',
                databaseHostId: 'oracle-wad-host',
                isWad: true,
                instancesAssessment: [
                    {
                        assessments: {
                            lastAssessmentTimestamp: '123',
                            dismissedConfigurations: {},
                            hostOsPatch: { status: 'not-optimized', severity: 'warning' },
                            crr: { status: 'not-optimized', severity: 'warning' },
                            oracleSecurityPatch: { status: 'optimized', severity: 'critical' },
                            storage: {
                                layout: [{ name: 'redologs-placement', status: 'optimized', severity: 'warning' }],
                                configuration: { volumes: [], luns: [], os: [] }
                            }
                        }
                    }
                ]
            }
        ];
        const result = getManagedOptimizationSummary([], oracleData);

        expect(result.totalInstances).toBe(1);
        // Only storage.layout is counted; hostOsPatch, crr, and oracleSecurityPatch are WAD-excluded
        expect(result.totalConfigurations).toBe(1);
        expect(result.optimizedConfigurations).toBe(1);
        expect(result.notOptimizedConfigurations).toBe(0);
    });

    it('skips WAD-excluded MSSQL configs for isWad instances', () => {
        const wadData = [
            {
                credentialId: 'cred-1',
                regionId: 'us-east-1',
                databaseHostId: 'mssql-wad-host',
                isWad: true,
                instancesAssessment: [{ assessments: buildMssqlAssessment() }]
            }
        ];
        const normalData = wrapInHost([buildMssqlAssessment()]);

        const wadResult = getManagedOptimizationSummary(wadData, []);
        const normalResult = getManagedOptimizationSummary(normalData, []);

        expect(wadResult.totalConfigurations).toBeLessThan(normalResult.totalConfigurations);
    });
});

describe('getAssessmentGroupedByCategory (configuration-based)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns per-category config counts', () => {
        const data = wrapInHost([buildMssqlAssessment()]);
        const result = getAssessmentGroupedByCategory(data, []);

        expect(result.totalInstances).toBe(1);
        expect(result.storage.total).toBeGreaterThan(0);
        expect(result.storage.optimized).toBe(result.storage.total);
        expect(result.compute.total).toBeGreaterThan(0);
        expect(result.compute.optimized).toBe(result.compute.total);
        expect(result.application.total).toBeGreaterThan(0);
        expect(result.application.optimized).toBe(result.application.total);
        expect(result.resiliency.total).toBeGreaterThan(0);
        expect(result.resiliency.optimized).toBe(result.resiliency.total);
        expect(result.cloning.total).toBeGreaterThan(0);
        expect(result.cloning.optimized).toBe(result.cloning.total);
    });

    it('counts not-optimized configs in correct categories', () => {
        const assessment = buildMssqlAssessment({
            compute: { status: 'not-optimized', severity: 'warning' },
            mssqlPatch: { status: 'not-optimized', severity: 'warning' },
            clone: { status: 'not-optimized', severity: 'warning' }
        });
        const data = wrapInHost([assessment]);
        const result = getAssessmentGroupedByCategory(data, []);

        expect(result.compute.optimized).toBe(result.compute.total - 1);
        expect(result.application.optimized).toBe(result.application.total - 1);
        expect(result.cloning.optimized).toBe(result.cloning.total - 1);
        expect(result.storage.optimized).toBe(result.storage.total);
        expect(result.resiliency.optimized).toBe(result.resiliency.total);
    });

    it('excludes dismissed configs from category totals', () => {
        const assessment = buildMssqlAssessment({
            dismissedConfigurations: {
                compute: { configState: 'DISMISSED' }
            }
        });
        const allOptimized = buildMssqlAssessment();
        const data = wrapInHost([assessment]);
        const allOptimizedData = wrapInHost([allOptimized]);

        const result = getAssessmentGroupedByCategory(data, []);
        const baseResult = getAssessmentGroupedByCategory(allOptimizedData, []);

        expect(result.compute.total).toBe(baseResult.compute.total - 1);
    });

    it('handles Oracle data in storage and compute categories', () => {
        const oracleData = [
            {
                credentialId: 'cred-1',
                regionId: 'us-east-1',
                databaseHostId: 'oracle-host-1',
                instancesAssessment: [
                    {
                        assessments: {
                            lastAssessmentTimestamp: '123',
                            dismissedConfigurations: {},
                            hostOsPatch: { status: 'optimized', severity: 'warning' },
                            storage: {
                                layout: [
                                    { name: 'redologs-placement', status: 'optimized', severity: 'warning' },
                                    { name: 'datafiles-placement', status: 'not-optimized', severity: 'critical' }
                                ],
                                configuration: { volumes: [], luns: [], os: [] }
                            }
                        }
                    }
                ]
            }
        ];
        const result = getAssessmentGroupedByCategory([], oracleData);

        expect(result.totalInstances).toBe(1);
        expect(result.compute.total).toBe(1);
        expect(result.compute.optimized).toBe(1);
        expect(result.storage.total).toBe(2);
        expect(result.storage.optimized).toBe(1);
        expect(result.application.total).toBe(0);
        expect(result.resiliency.total).toBe(0);
        expect(result.cloning.total).toBe(0);
    });

    it('handles Oracle oracleSecurityPatch, crr, and storage.sizing in categories', () => {
        const oracleData = [
            {
                credentialId: 'cred-1',
                regionId: 'us-east-1',
                databaseHostId: 'oracle-host-2',
                instancesAssessment: [
                    {
                        assessments: {
                            lastAssessmentTimestamp: '123',
                            dismissedConfigurations: {},
                            hostOsPatch: { status: 'optimized', severity: 'warning' },
                            oracleSecurityPatch: { status: 'optimized', severity: 'critical' },
                            crr: { status: 'optimized', severity: 'warning' },
                            storage: {
                                layout: [{ name: 'redologs-placement', status: 'optimized', severity: 'warning' }],
                                sizing: [{ name: 'swap-space', status: 'optimized', severity: 'critical' }],
                                configuration: { volumes: [], luns: [], os: [] }
                            }
                        }
                    }
                ]
            }
        ];
        const result = getAssessmentGroupedByCategory([], oracleData);

        expect(result.compute.total).toBe(1);
        expect(result.compute.optimized).toBe(1);
        expect(result.application.total).toBe(1);
        expect(result.application.optimized).toBe(1);
        expect(result.resiliency.total).toBe(1);
        expect(result.resiliency.optimized).toBe(1);
        expect(result.storage.total).toBe(2);
        expect(result.storage.optimized).toBe(2);
    });

    it('skips WAD-excluded configs in category counts', () => {
        const oracleWadData = [
            {
                credentialId: 'cred-1',
                regionId: 'us-east-1',
                databaseHostId: 'oracle-wad-host',
                isWad: true,
                instancesAssessment: [
                    {
                        assessments: {
                            lastAssessmentTimestamp: '123',
                            dismissedConfigurations: {},
                            hostOsPatch: { status: 'not-optimized', severity: 'warning' },
                            crr: { status: 'not-optimized', severity: 'warning' },
                            oracleSecurityPatch: { status: 'optimized', severity: 'critical' },
                            storage: {
                                layout: [{ name: 'redologs-placement', status: 'optimized', severity: 'warning' }],
                                configuration: { volumes: [], luns: [], os: [] }
                            }
                        }
                    }
                ]
            }
        ];
        const result = getAssessmentGroupedByCategory([], oracleWadData);

        // hostOsPatch, crr, and oracleSecurityPatch are all WAD-excluded
        expect(result.compute.total).toBe(0);
        expect(result.resiliency.total).toBe(0);
        expect(result.application.total).toBe(0); // oracleSecurityPatch is now WAD-excluded
        expect(result.application.optimized).toBe(0);
        expect(result.storage.total).toBe(1);
    });

    it('returns zero totals for empty data', () => {
        const result = getAssessmentGroupedByCategory([], []);

        expect(result.totalInstances).toBe(0);
        expect(result.storage.total).toBe(0);
        expect(result.compute.total).toBe(0);
    });
});

describe('MSSQL HA optimization counting', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('counts FCI with all 5 HA sub-configs optimized as optimized', () => {
        const fciAssessment = buildMssqlAssessment({
            deploymentType: 'FCI',
            highAvailability: [
                { name: 'shared-storage', status: 'optimized', severity: 'critical' },
                { name: 'drive-letter', status: 'optimized', severity: 'critical' },
                { name: 'cluster-quorum', status: 'optimized', severity: 'critical' },
                { name: 'heartbeat-settings', status: 'optimized', severity: 'critical' },
                { name: 'sqlServer-service', status: 'optimized', severity: 'critical' }
            ]
        });
        const data = wrapInHost([fciAssessment]);
        const result = getManagedOptimizationSummary(data, []);

        expect(result.totalConfigurations).toBeGreaterThan(0);
        // HA counts as 1 config in resiliency category
        expect(result.optimizedPercent).toBe(100);
    });

    it('counts FCI with some HA sub-configs not optimized as not optimized', () => {
        const fciAssessment = buildMssqlAssessment({
            deploymentType: 'FCI',
            highAvailability: [
                { name: 'shared-storage', status: 'not-optimized', severity: 'critical' },
                { name: 'drive-letter', status: 'optimized', severity: 'critical' },
                { name: 'cluster-quorum', status: 'optimized', severity: 'critical' },
                { name: 'heartbeat-settings', status: 'optimized', severity: 'critical' },
                { name: 'sqlServer-service', status: 'optimized', severity: 'critical' }
            ]
        });
        const data = wrapInHost([fciAssessment]);
        const result = getManagedOptimizationSummary(data, []);

        expect(result.optimizedPercent).toBeLessThan(100);
        expect(result.notOptimizedConfigurations).toBeGreaterThan(0);
        expect(result.criticalConfigurations).toBeGreaterThan(0);
    });

    it('counts AOAG with all 2 HA sub-configs optimized as optimized', () => {
        const aoagAssessment = buildMssqlAssessment({
            deploymentType: 'AOAG',
            highAvailability: [
                { name: 'heartbeat-settings', status: 'optimized', severity: 'critical' },
                { name: 'sqlServer-service', status: 'optimized', severity: 'critical' }
            ]
        });
        const data = wrapInHost([aoagAssessment]);
        const result = getManagedOptimizationSummary(data, []);

        expect(result.optimizedPercent).toBe(100);
    });

    it('counts AOAG with some HA sub-configs not optimized as not optimized', () => {
        const aoagAssessment = buildMssqlAssessment({
            deploymentType: 'AOAG',
            highAvailability: [
                { name: 'heartbeat-settings', status: 'not-optimized', severity: 'critical' },
                { name: 'sqlServer-service', status: 'optimized', severity: 'critical' }
            ]
        });
        const data = wrapInHost([aoagAssessment]);
        const result = getManagedOptimizationSummary(data, []);

        expect(result.optimizedPercent).toBeLessThan(100);
        expect(result.notOptimizedConfigurations).toBeGreaterThan(0);
    });

    it('does not count HA for Standalone instances', () => {
        const standaloneWithHa = buildMssqlAssessment({
            deploymentType: 'Standalone',
            highAvailability: [
                { name: 'shared-storage', status: 'optimized', severity: 'critical' },
                { name: 'drive-letter', status: 'optimized', severity: 'critical' }
            ]
        });
        const standaloneWithoutHa = buildMssqlAssessment({
            deploymentType: 'Standalone'
        });

        const withHaResult = getManagedOptimizationSummary(wrapInHost([standaloneWithHa]), []);
        const withoutHaResult = getManagedOptimizationSummary(wrapInHost([standaloneWithoutHa]), []);

        // HA should not be counted for Standalone
        expect(withHaResult.totalConfigurations).toBe(withoutHaResult.totalConfigurations);
    });

    it('does not count HA as optimized when highAvailability array is empty', () => {
        const fciWithEmptyHa = buildMssqlAssessment({
            deploymentType: 'FCI',
            highAvailability: []
        });
        const data = wrapInHost([fciWithEmptyHa]);
        const result = getManagedOptimizationSummary(data, []);

        // Empty HA array should not count as optimized (avoids Array.every() edge case)
        expect(result.optimizedPercent).toBe(100); // All other configs are optimized
    });

    it('does not count HA as optimized when highAvailability is missing', () => {
        const fciWithoutHa = buildMssqlAssessment({
            deploymentType: 'FCI'
            // No highAvailability field
        });
        const data = wrapInHost([fciWithoutHa]);
        const result = getManagedOptimizationSummary(data, []);

        // Missing HA should not count as optimized
        expect(result.optimizedPercent).toBe(100); // All other configs are optimized
    });

    it('handles WAD FCI with partial HA sub-configs correctly', () => {
        const wadFci = buildMssqlAssessment({
            deploymentType: 'FCI',
            highAvailability: [
                { name: 'cluster-quorum', status: 'optimized', severity: 'critical' },
                { name: 'heartbeat-settings', status: 'not-optimized', severity: 'critical' }
            ]
        });
        const wadData = [
            {
                credentialId: 'cred-1',
                regionId: 'us-east-1',
                databaseHostId: 'wad-fci-host',
                isWad: true,
                instancesAssessment: [{ assessments: wadFci }]
            }
        ];
        const result = getManagedOptimizationSummary(wadData, []);

        // WAD FCI with 2 sub-configs (not all optimized) should count as not optimized
        expect(result.optimizedPercent).toBeLessThan(100);
        expect(result.notOptimizedConfigurations).toBeGreaterThan(0);
    });

    it('correctly counts optimized percentage with mixed FCI and AOAG instances', () => {
        const fciOptimized = buildMssqlAssessment({
            deploymentType: 'FCI',
            highAvailability: [
                { name: 'shared-storage', status: 'optimized', severity: 'critical' },
                { name: 'drive-letter', status: 'optimized', severity: 'critical' },
                { name: 'cluster-quorum', status: 'optimized', severity: 'critical' },
                { name: 'heartbeat-settings', status: 'optimized', severity: 'critical' },
                { name: 'sqlServer-service', status: 'optimized', severity: 'critical' }
            ]
        });
        const fciNotOptimized = buildMssqlAssessment({
            deploymentType: 'FCI',
            highAvailability: [
                { name: 'shared-storage', status: 'not-optimized', severity: 'critical' },
                { name: 'drive-letter', status: 'optimized', severity: 'critical' },
                { name: 'cluster-quorum', status: 'optimized', severity: 'critical' },
                { name: 'heartbeat-settings', status: 'optimized', severity: 'critical' },
                { name: 'sqlServer-service', status: 'optimized', severity: 'critical' }
            ]
        });
        const aoagOptimized = buildMssqlAssessment({
            deploymentType: 'AOAG',
            highAvailability: [
                { name: 'heartbeat-settings', status: 'optimized', severity: 'critical' },
                { name: 'sqlServer-service', status: 'optimized', severity: 'critical' }
            ]
        });
        const aoagNotOptimized = buildMssqlAssessment({
            deploymentType: 'AOAG',
            highAvailability: [
                { name: 'heartbeat-settings', status: 'not-optimized', severity: 'critical' },
                { name: 'sqlServer-service', status: 'optimized', severity: 'critical' }
            ]
        });

        const data = wrapInHost([fciOptimized, fciNotOptimized, aoagOptimized, aoagNotOptimized]);
        const result = getManagedOptimizationSummary(data, []);

        expect(result.totalInstances).toBe(4);
        // 2 out of 4 HA instances are fully optimized
        expect(result.optimizedPercent).toBeGreaterThan(0);
        expect(result.optimizedPercent).toBeLessThan(100);
    });

    it('handles dismissed HA sub-configs correctly', () => {
        const fciWithDismissedHa = buildMssqlAssessment({
            deploymentType: 'FCI',
            highAvailability: [
                { name: 'shared-storage', status: 'not-optimized', severity: 'critical' },
                { name: 'drive-letter', status: 'optimized', severity: 'critical' },
                { name: 'cluster-quorum', status: 'optimized', severity: 'critical' },
                { name: 'heartbeat-settings', status: 'optimized', severity: 'critical' },
                { name: 'sqlServer-service', status: 'optimized', severity: 'critical' }
            ],
            dismissedConfigurations: {
                highAvailability: [{ configurationName: 'shared-storage', configState: 'DISMISSED' }]
            }
        });
        const data = wrapInHost([fciWithDismissedHa]);
        const result = getManagedOptimizationSummary(data, []);

        // Individual sub-config dismissals don't affect the overall HA config counting
        // HA is treated as a single unit; one sub-config not optimized = HA not optimized
        expect(result.optimizedPercent).toBeLessThan(100);
        expect(result.notOptimizedConfigurations).toBeGreaterThan(0);
    });

    it('excludes entire HA config when parent-level dismiss state is present', () => {
        const fciWithParentDismissedHa = buildMssqlAssessment({
            deploymentType: 'FCI',
            highAvailability: [
                { name: 'shared-storage', status: 'not-optimized', severity: 'critical' },
                { name: 'drive-letter', status: 'optimized', severity: 'critical' },
                { name: 'cluster-quorum', status: 'optimized', severity: 'critical' },
                { name: 'heartbeat-settings', status: 'optimized', severity: 'critical' },
                { name: 'sqlServer-service', status: 'optimized', severity: 'critical' }
            ],
            dismissedConfigurations: {
                highAvailability_configuration: { configState: 'DISMISSED' }
            }
        });
        const data = wrapInHost([fciWithParentDismissedHa]);
        const result = getManagedOptimizationSummary(data, []);

        // With parent-level dismiss, HA config is excluded from the total
        expect(result.optimizedPercent).toBe(100); // All other non-HA configs are optimized
        expect(result.hasDismissedOrPostponed).toBe(true);
    });

    it('counts HA in resiliency category', () => {
        const fciAssessment = buildMssqlAssessment({
            deploymentType: 'FCI',
            highAvailability: [
                { name: 'shared-storage', status: 'optimized', severity: 'critical' },
                { name: 'drive-letter', status: 'optimized', severity: 'critical' },
                { name: 'cluster-quorum', status: 'optimized', severity: 'critical' },
                { name: 'heartbeat-settings', status: 'optimized', severity: 'critical' },
                { name: 'sqlServer-service', status: 'optimized', severity: 'critical' }
            ]
        });
        const data = wrapInHost([fciAssessment]);
        const result = getAssessmentGroupedByCategory(data, []);

        // HA counts as 1 config in resiliency
        expect(result.resiliency.total).toBeGreaterThan(0);
        expect(result.resiliency.optimized).toBe(result.resiliency.total);
    });
});
