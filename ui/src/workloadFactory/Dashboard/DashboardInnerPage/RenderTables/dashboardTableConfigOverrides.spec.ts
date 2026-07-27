import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetConfigEntry } = vi.hoisted(() => ({
    mockGetConfigEntry: vi.fn(() => undefined)
}));

vi.mock('../../../../utils/consts', async importOriginal => ({
    ...(await importOriginal<typeof import('../../../../utils/consts')>()),
    ASSESSMENT_CONFIG_IDS: {
        FILE_SYSTEM_HEADROOM: 'headroom',
        FILE_SYSTEM_HEADROOM_MSSQL: 'file-system-headroom',
        MAXDOP: 'maxdop',
        OPERATING_SYSTEM_PATCH: 'host-os-patch',
        MICROSOFT_SQL_SERVER_PATCH: 'mssql-patch',
        ORACLE_SECURITY_PATCH: 'oracle-security-patch',
        LICENSE: 'sql-license',
        COMPUTE_RIGHTSIZING: 'compute-rightsizing',
        RSS_CONFIGURATION: 'rss-config',
        MTU: 'mtu-alignment',
        SWAP_SPACE: 'swap-space',
        CLONE_MANAGEMENT: 'clone-management',
        SNAPCENTER_SNAPSHOT: 'snapcenter-snapshot',
        DATA_FILES_MDF: 'data-files-location',
        LOG_FILES_LDF: 'log-files-location',
        TEMPDB_PLACEMENT: 'tempdb-files-location',
        CRR: 'crr',
        ONLINE_INSTANCE_STATUSES: new Set(['running', 'online'])
    },
    ONLINE_INSTANCE_STATUSES: new Set(['running', 'online']),
    SQL_SERVER_EDITION_LABELS: {
        STANDARD: 'Standard',
        ENTERPRISE: 'Enterprise',
        DEVELOPER: 'Developer'
    },
    DBType: { MSSQL: 'MSSQL', ORACLE: 'ORACLE' }
}));

vi.mock('../../../../utils/configRegistry/configRegistryHelper', () => ({
    getConfigEntry: (...args: unknown[]) => mockGetConfigEntry(...args)
}));

vi.mock('../../../../workloadFactory/WellArchitectedTab/assessmentFormatUtils', () => ({
    createDashboardTableConfig: (id: string) => ({
        id,
        isFixSupported: true,
        dataMapping: (item: any, instanceData?: any) => item
    }),
    resolveConfigTypeId: (id: string) => id
}));

vi.mock('./ImpactedResourceDialog/impactedResourceViewConfig', () => ({
    isFixTableImpactedViewSupported: () => true
}));

vi.mock('./ImpactedResourceDialog/impactedResourceHeaderUtils', () => ({
    resolveImpactedColumnHeader: () => ({ header: 'Impacted resources', headerIsI18nKey: false })
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k })
}));

vi.mock('../../../../utils/configRegistry', () => ({
    buildSubConfigValues: () => ({ current: '', recommended: '' }),
    getColumnConfig: () => null,
    pluralizeResourceType: (s: string) => s
}));

// Import after mocks
const getModule = async () => {
    const mod = await import('./dashboardTableConfigOverrides');
    return mod.resolveDashboardTableConfig;
};

describe('dashboardTableConfigOverrides - dataMapping', () => {
    beforeEach(() => {
        mockGetConfigEntry.mockReturnValue(undefined);
    });

    describe('resolveDashboardTableConfig - fixSupported from registry', () => {
        it('disables Fix when registry fixSupported is false', async () => {
            mockGetConfigEntry.mockReturnValue({ fixSupported: false });
            const resolveDashboardTableConfig = await getModule();
            expect(resolveDashboardTableConfig('snapcenter-snapshot', 'MSSQL').isFixSupported).toBe(false);
            expect(resolveDashboardTableConfig('headroom', 'MSSQL').isFixSupported).toBe(false);
        });
    });
    describe('FILE_SYSTEM_HEADROOM (MSSQL) - totalObjectsInViolation fallback', () => {
        it('uses totalObjectsInViolation when present', async () => {
            const resolveDashboardTableConfig = await getModule();
            const config = resolveDashboardTableConfig('headroom', 'MSSQL');
            const mapped = config.dataMapping!(
                {
                    current: '36%',
                    recommended: '36-100%',
                    totalObjectsInViolation: 2,
                    objectsInViolation: ['fs-001', 'fs-002']
                },
                undefined
            );
            expect(mapped.totalObjectsInViolation).toBe(2);
        });

        it('falls back to objectsInViolation.length when totalObjectsInViolation is absent', async () => {
            const resolveDashboardTableConfig = await getModule();
            const config = resolveDashboardTableConfig('headroom', 'MSSQL');
            const mapped = config.dataMapping!(
                {
                    current: '36%',
                    recommended: '36-100%',
                    objectsInViolation: ['fs-07a22f282fd4f5a20']
                    // totalObjectsInViolation intentionally absent
                },
                undefined
            );
            expect(mapped.totalObjectsInViolation).toBe(1);
        });

        it('returns 0 when both totalObjectsInViolation and objectsInViolation are absent', async () => {
            const resolveDashboardTableConfig = await getModule();
            const config = resolveDashboardTableConfig('headroom', 'MSSQL');
            const mapped = config.dataMapping!(
                {
                    current: '150%',
                    recommended: '36-100%'
                    // no totalObjectsInViolation, no objectsInViolation
                },
                undefined
            );
            expect(mapped.totalObjectsInViolation).toBe(0);
        });

        it('maps current and recommended correctly', async () => {
            const resolveDashboardTableConfig = await getModule();
            const config = resolveDashboardTableConfig('headroom', 'MSSQL');
            const mapped = config.dataMapping!(
                {
                    current: '36%',
                    recommended: '36-100%',
                    objectsInViolation: ['fs-001']
                },
                undefined
            );
            expect(mapped.current).toBe('36%');
            expect(mapped.recommended).toBe('36-100%');
            expect(mapped.configurationName).toBe('headroom');
        });
    });

    describe('MAXDOP - dataMapping', () => {
        it('maps current and totalObjectsInViolation', async () => {
            const resolveDashboardTableConfig = await getModule();
            const config = resolveDashboardTableConfig('maxdop', 'MSSQL');
            const mapped = config.dataMapping!(
                {
                    current: 3,
                    recommended: 4,
                    totalObjectsInViolation: 1,
                    objectsInViolation: ['MSSQLSERVER']
                },
                undefined
            );
            expect(mapped.current).toBe(3);
            expect(mapped.totalObjectsInViolation).toBe(1);
            expect(mapped.objectsInViolation).toEqual(['MSSQLSERVER']);
            expect(mapped.configurationName).toBe('maxdop');
        });

        it('returns 0 totalObjectsInViolation when absent (view button hidden)', async () => {
            const resolveDashboardTableConfig = await getModule();
            const config = resolveDashboardTableConfig('maxdop', 'MSSQL');
            const mapped = config.dataMapping!(
                {
                    current: 3,
                    recommended: 4
                    // no totalObjectsInViolation
                },
                undefined
            );
            expect(mapped.totalObjectsInViolation).toBe(0);
        });
    });

    describe('OPERATING_SYSTEM_PATCH - dataMapping', () => {
        it('computes current from ec2InstancesToPatch patch counts', async () => {
            const resolveDashboardTableConfig = await getModule();
            const config = resolveDashboardTableConfig('host-os-patch', 'MSSQL');
            const mapped = config.dataMapping!(
                {
                    id: 'host-os-patch',
                    totalObjectsInViolation: 1,
                    ec2InstancesToPatch: [
                        { criticalNonCompliantCount: 2, securityNonCompliantCount: 1, otherNonCompliantCount: 0 }
                    ]
                },
                undefined
            );
            expect(mapped.current).toBe('3');
            expect(mapped.configurationName).toBe('host-os-patch');
            expect(mapped.totalObjectsInViolation).toBe(1);
        });

        it('returns "0" current when ec2InstancesToPatch is absent', async () => {
            const resolveDashboardTableConfig = await getModule();
            const config = resolveDashboardTableConfig('host-os-patch', 'MSSQL');
            const mapped = config.dataMapping!({ id: 'host-os-patch' }, undefined);
            expect(mapped.current).toBe('0');
        });
    });

    describe('MICROSOFT_SQL_SERVER_PATCH - dataMapping', () => {
        it('computes current from missingPatchesInEc2Instances counts', async () => {
            const resolveDashboardTableConfig = await getModule();
            const config = resolveDashboardTableConfig('mssql-patch', 'MSSQL');
            const mapped = config.dataMapping!(
                {
                    id: 'mssql-patch',
                    totalObjectsInViolation: 1,
                    missingPatchesInEc2Instances: [{ criticalMissingPatchesCount: 1, importantMissingPatchesCount: 2 }]
                },
                undefined
            );
            expect(mapped.current).toBe(3);
            expect(mapped.configurationName).toBe('mssql-patch');
        });

        it('returns 0 current when missingPatchesInEc2Instances is absent', async () => {
            const resolveDashboardTableConfig = await getModule();
            const config = resolveDashboardTableConfig('mssql-patch', 'MSSQL');
            const mapped = config.dataMapping!({ id: 'mssql-patch' }, undefined);
            expect(mapped.current).toBe(0);
        });
    });

    describe('ORACLE_SECURITY_PATCH - dataMapping', () => {
        it('maps current from missingPatchesCount', async () => {
            const resolveDashboardTableConfig = await getModule();
            const config = resolveDashboardTableConfig('oracle-security-patch', 'ORACLE');
            const mapped = config.dataMapping!(
                { id: 'oracle-security-patch', missingPatchesCount: 5, totalObjectsInViolation: 2 },
                undefined
            );
            expect(mapped.current).toBe('5');
            expect(mapped.configurationName).toBe('oracle-security-patch');
            expect(mapped.totalObjectsInViolation).toBe(2);
        });

        it('defaults current to "0" when missingPatchesCount is absent', async () => {
            const resolveDashboardTableConfig = await getModule();
            const config = resolveDashboardTableConfig('oracle-security-patch', 'ORACLE');
            const mapped = config.dataMapping!({ id: 'oracle-security-patch' }, undefined);
            expect(mapped.current).toBe('0');
        });
    });

    describe('LICENSE - dataMapping', () => {
        it('maps license edition label from matching sql instance', async () => {
            const resolveDashboardTableConfig = await getModule();
            const config = resolveDashboardTableConfig('sql-license', 'MSSQL');
            const mapped = config.dataMapping!(
                {
                    sqlServerInstances: [{ sqlServerInstance: 'MSSQLSERVER', sqlServerEdition: 'Standard Edition' }]
                },
                { databaseInstanceName: 'MSSQLSERVER' }
            );
            expect(mapped.current).toBe('Standard');
            expect(mapped.configurationName).toBe('sql-license');
        });

        it('returns empty string when no matching instance found', async () => {
            const resolveDashboardTableConfig = await getModule();
            const config = resolveDashboardTableConfig('sql-license', 'MSSQL');
            const mapped = config.dataMapping!({ sqlServerInstances: [] }, { databaseInstanceName: 'OTHER' });
            expect(mapped.current).toBe('');
        });
    });

    describe('COMPUTE_RIGHTSIZING - dataMapping', () => {
        it('formats findingReasons from objectsInViolation length', async () => {
            const resolveDashboardTableConfig = await getModule();
            const config = resolveDashboardTableConfig('compute-rightsizing', 'MSSQL');
            const mapped = config.dataMapping!({ objectsInViolation: ['finding1', 'finding2', 'finding3'] }, undefined);
            expect(mapped.findingReasons).toBe('3 Findings');
            expect(mapped.configurationName).toBe('compute-rightsizing');
        });

        it('returns "0 Findings" when objectsInViolation is absent', async () => {
            const resolveDashboardTableConfig = await getModule();
            const config = resolveDashboardTableConfig('compute-rightsizing', 'MSSQL');
            const mapped = config.dataMapping!({}, undefined);
            expect(mapped.findingReasons).toBe('0 Findings');
        });
    });

    describe('MTU - dataMapping', () => {
        it('maps totalObjectsInViolation and configurationName', async () => {
            const resolveDashboardTableConfig = await getModule();
            const config = resolveDashboardTableConfig('mtu-alignment', 'MSSQL');
            const mapped = config.dataMapping!(
                { current: '9001', totalObjectsInViolation: 3, objectsInViolation: ['eth0', 'eth1', 'eth2'] },
                undefined
            );
            expect(mapped.current).toBe('9001');
            expect(mapped.totalObjectsInViolation).toBe(3);
            expect(mapped.configurationName).toBe('mtu-alignment');
        });

        it('defaults totalObjectsInViolation to 0 when absent', async () => {
            const resolveDashboardTableConfig = await getModule();
            const config = resolveDashboardTableConfig('mtu-alignment', 'MSSQL');
            const mapped = config.dataMapping!({}, undefined);
            expect(mapped.totalObjectsInViolation).toBe(0);
        });
    });

    describe('SWAP_SPACE - dataMapping', () => {
        it('maps current, recommended and totalObjectsInViolation', async () => {
            const resolveDashboardTableConfig = await getModule();
            const config = resolveDashboardTableConfig('swap-space', 'ORACLE');
            const mapped = config.dataMapping!(
                { current: '2 GB', recommended: '8 GB', totalObjectsInViolation: 1, objectsInViolation: ['i-0abc'] },
                undefined
            );
            expect(mapped.current).toBe('2 GB');
            expect(mapped.recommended).toBe('8 GB');
            expect(mapped.totalObjectsInViolation).toBe(1);
            expect(mapped.configurationName).toBe('swap-space');
        });

        it('defaults totalObjectsInViolation to 0 when absent', async () => {
            const resolveDashboardTableConfig = await getModule();
            const config = resolveDashboardTableConfig('swap-space', 'ORACLE');
            const mapped = config.dataMapping!({}, undefined);
            expect(mapped.totalObjectsInViolation).toBe(0);
        });
    });

    describe('DATA_FILES_MDF / LOG_FILES_LDF / TEMPDB_PLACEMENT - dataMapping', () => {
        const cases = [
            { configId: 'data-files-location', label: 'data-files-location' },
            { configId: 'log-files-location', label: 'log-files-location' },
            { configId: 'tempdb-files-location', label: 'tempdb-files-location' }
        ];

        cases.forEach(({ configId, label }) => {
            it(`maps totalObjectsInViolation and configurationName for ${label}`, async () => {
                const resolveDashboardTableConfig = await getModule();
                const config = resolveDashboardTableConfig(configId, 'MSSQL');
                const mapped = config.dataMapping!(
                    { totalObjectsInViolation: 2, objectsInViolation: ['db1', 'db2'] },
                    undefined
                );
                expect(mapped.totalObjectsInViolation).toBe(2);
                expect(mapped.configurationName).toBe(configId);
            });

            it(`defaults totalObjectsInViolation to 0 when absent for ${label}`, async () => {
                const resolveDashboardTableConfig = await getModule();
                const config = resolveDashboardTableConfig(configId, 'MSSQL');
                const mapped = config.dataMapping!({}, undefined);
                expect(mapped.totalObjectsInViolation).toBe(0);
            });
        });
    });

    describe('CLONE_MANAGEMENT - dataMapping', () => {
        it('maps totalObjectsInViolation, cloneDetails and configurationName', async () => {
            const resolveDashboardTableConfig = await getModule();
            const config = resolveDashboardTableConfig('clone-management', 'MSSQL');
            const mapped = config.dataMapping!(
                {
                    totalObjectsInViolation: 4,
                    objectsInViolation: ['c1', 'c2', 'c3', 'c4'],
                    cloneDetails: [{ name: 'clone1' }],
                    tags: ['tag1']
                },
                undefined
            );
            expect(mapped.totalObjectsInViolation).toBe(4);
            expect(mapped.configurationName).toBe('clone-management');
            expect(mapped.cloneDetails).toEqual([{ name: 'clone1' }]);
        });

        it('defaults totalObjectsInViolation to 0 when absent', async () => {
            const resolveDashboardTableConfig = await getModule();
            const config = resolveDashboardTableConfig('clone-management', 'MSSQL');
            const mapped = config.dataMapping!({}, undefined);
            expect(mapped.totalObjectsInViolation).toBe(0);
        });
    });
});
