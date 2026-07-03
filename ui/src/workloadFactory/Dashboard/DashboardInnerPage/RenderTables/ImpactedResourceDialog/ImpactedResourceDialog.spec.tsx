import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ImpactedResourceDialog from './ImpactedResourceDialog';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k })
}));

vi.mock('../../../../../utils/consts', async importOriginal => ({
    ...(await importOriginal<typeof import('../../../../../utils/consts')>()),
    SQL_DEPLOYMENT_MODE: {
        FAILOVER_CLUSTER_VALUE: 'fci',
        SINGLE_INSTANCE_VALUE: 'standalone',
        AOAG: 'aoag',
        HA: 'ha',
        FAILOVER_CLUSTER_VALUE_CAPS: 'FCI'
    },
    FORM_OPTIONS: {
        FSXN_NEW: 'fsxn_new',
        FSXN_EXISTING: 'fsxn_existing',
        LICENSE_AMI: 'License included AMI',
        CUSTOM_AMI: 'Use custom AMI'
    },
    FSXADMIN: 'fsxadmin',
    SQL_USERNAME: 'sqlsa',
    PATCH_SCAN_FIELD: {
        MSSQL_PATCH: 'mssql-patch',
        HOST_OS_PATCH: 'host-os-patch',
        ORACLE_SECURITY_PATCH: 'oracle-security-patch'
    },
    WIZARD_TYPE: {
        PGSQL: 'pgsql',
        MSSQL: 'mssql',
        ORACLE: 'oracle'
    },
    ASSESSMENT_CONFIG_NAMES: {
        NTFS_ALLOCATION_UNIT_SIZE: 'NTFS allocation unit size',
        MULTIPATH_IO_POLICY: 'Multipath I/O Policy',
        OS_TYPE: 'OS type',
        THIN_PROVISIONING: 'Thin provisioning',
        AUTOSIZE: 'Autosize',
        AUTOSIZE_MODE: 'Autosize-mode',
        FRACTIONAL_RESERVE: 'Fractional reserve',
        SNAPSHOT_AUTODELETE: 'Snapshot autodelete',
        SPACE_MANAGEMENT: 'Space management',
        SNAPSHOT_COPY_RESERVE: 'Snapshot copy reserve',
        TIERING_POLICY: 'Tiering policy',
        TIERING_MINIMUM_COOLING_DAYS: 'Tiering minimum cooling days',
        SPACE_RESERVATION: 'Space reservation',
        SPACE_ALLOCATION: 'Space allocation',
        DRIVE_LETTER: 'Drive letter',
        SHARED_STORAGE: 'Shared storage',
        OPERATING_SYSTEM_PATCH: 'Operating system patch',
        MICROSOFT_SQL_SERVER_PATCH: 'Microsoft SQL Server patch',
        ORACLE_SECURITY_PATCH: 'Oracle Critical Patch Updates'
    },
    DBType: { MSSQL: 'MSSQL', ORACLE: 'ORACLE' }
}));

vi.mock('../../../../../common/Lib/Table/useTable', () => ({
    useTable: (config: { rows?: unknown[]; columns?: unknown[]; isLazyLoading?: boolean }) => ({
        rows: config.rows ?? [],
        columns: config.columns ?? [],
        selectionState: { rows: {} },
        toggleRowSelection: () => () => {},
        sortState: {},
        isLoading: config.isLazyLoading
    })
}));

vi.mock('../../../../../store/storeHooks', () => ({
    useAppSelector: (selector: (state: { getWellOptimize: { configEngineType: string } }) => unknown) =>
        selector({ getWellOptimize: { configEngineType: 'MSSQL' } })
}));

vi.mock('../../../../../common/Lib/Table/TableLazyLoading.module.scss', () => ({
    default: {
        lazyLoadingInline: 'lazyLoadingInline'
    }
}));

vi.mock('./ImpactedResourceDialog.module.scss', () => ({
    default: {
        tableWrapper: 'tableWrapper',
        headerRow: 'headerRow',
        headerCell: 'headerCell',
        bodyRow: 'bodyRow',
        bodyCell: 'bodyCell',
        cellLine: 'cellLine'
    }
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsTypography: ({ children }: any) => <span>{children}</span>,
    DsFlashingDotsLoader: () => <span>loader</span>
}));

vi.mock('@netapp/design-system/dist/components/Table', () => ({
    Table: ({
        tableProps
    }: {
        tableProps: { rows?: Record<string, unknown>[]; columns?: { Header?: React.ReactNode; id?: string }[] };
    }) => {
        const rows = tableProps?.rows ?? [];
        const columns = tableProps?.columns ?? [];
        return (
            <div data-testid="impacted-dialog-table">
                <div data-testid="impacted-dialog-table-headers">
                    {columns.map((col, i: number) => (
                        <span key={col.id ?? i}>{col.Header}</span>
                    ))}
                </div>
                {rows.map((row: Record<string, unknown>, idx: number) => (
                    <div key={(row.id as string) ?? String(idx)}>
                        {Object.entries(row)
                            .filter(([key]) => key !== 'id' && key !== 'cellProps')
                            .map(([key, val]) => (
                                <span key={key}>{val as React.ReactNode}</span>
                            ))}
                    </div>
                ))}
            </div>
        );
    }
}));

vi.mock('../../../../../utils/apiService', () => ({
    useGetMissingPatchAssessmentDataQuery: () => ({ data: undefined, isFetching: false })
}));

describe('ImpactedResourceDialog', () => {
    it('renders null for unknown config', () => {
        const { container } = render(<ImpactedResourceDialog data={{ configurationName: 'unknown-config' } as any} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders database name column for data-files-location without additionalInfo', () => {
        const data = {
            configurationName: 'data-files-location',
            objectsInViolation: ['db1', 'db2'],
            violationDetails: []
        };
        render(<ImpactedResourceDialog data={data as any} />);
        expect(screen.getByText('databases.well-architect.database-name')).toBeTruthy();
        expect(screen.getByText('db1')).toBeTruthy();
        expect(screen.getByText('db2')).toBeTruthy();
    });

    it('renders drive and LUN path columns for data-files-location with additionalInfo', () => {
        const data = {
            configurationName: 'data-files-location',
            objectsInViolation: ['testdb'],
            violationDetails: [
                {
                    objectName: 'placement',
                    value: 'testdb',
                    objectType: 'Database',
                    additionalInfo: { lunPath: '/vol/data/lun1', driveLetter: 'D:' }
                }
            ]
        };
        render(<ImpactedResourceDialog data={data as any} />);
        expect(screen.getByText('databases.well-architect.database-name')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.drive-name')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.lun-path')).toBeTruthy();
        expect(screen.getByText('testdb')).toBeTruthy();
    });

    it('renders for tempdb-files-location with additionalInfo', () => {
        const data = {
            configurationName: 'tempdb-files-location',
            objectsInViolation: ['tempdb'],
            violationDetails: [
                {
                    objectName: 'placement',
                    value: 'tempdb',
                    objectType: 'Database',
                    additionalInfo: { lunPath: '/vol/tempdb/lun1', driveLetter: 'T:' }
                },
                {
                    objectName: 'placement',
                    value: 'tempdb',
                    objectType: 'Database',
                    additionalInfo: { lunPath: '/vol/tempdb/lun2', driveLetter: 'U:' }
                }
            ]
        };
        render(<ImpactedResourceDialog data={data as any} />);
        expect(screen.getByText('databases.well-architect.database-name')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.drive-name')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.lun-path')).toBeTruthy();
        expect(screen.getByText('tempdb')).toBeTruthy();
    });

    it('renders for log-files-location without additionalInfo', () => {
        const data = {
            configurationName: 'log-files-location',
            objectsInViolation: ['logdb1'],
            violationDetails: []
        };
        render(<ImpactedResourceDialog data={data as any} />);
        expect(screen.getByText('databases.well-architect.database-name')).toBeTruthy();
        expect(screen.getByText('logdb1')).toBeTruthy();
    });

    it('renders aggregated current/recommended columns for storage-efficiencies sub-configs', () => {
        const data = {
            configurationName: 'storage-efficiencies',
            violationDetails: [{ objectName: 'vol1', violatedConfigs: [{ name: 'deduplication', current: 'none' }] }],
            configItem: {
                configDetails: [
                    { name: 'deduplication', recommended: 'enabled' },
                    { name: 'compaction', recommended: 'enabled' }
                ]
            }
        };
        render(<ImpactedResourceDialog data={data as any} />);
        expect(screen.getByText('databases.well-architect.volume-name')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.current')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.recommended')).toBeTruthy();
        expect(screen.getByText('vol1')).toBeTruthy();
        expect(screen.getByText('deduplication=none, compaction=enabled')).toBeTruthy();
        expect(screen.getByText('deduplication=enabled, compaction=enabled')).toBeTruthy();
    });

    it('falls back to top-level recommended when violationDetails rows omit it (MSSQL autosize)', () => {
        const data = {
            configurationName: 'autosize',
            recommended: 'true',
            violationDetails: [
                { objectName: 'vol1', value: '', objectType: 'Volume' },
                { objectName: 'vol2', value: '', objectType: 'Volume' }
            ],
            configItem: { recommended: 'true' }
        };
        render(<ImpactedResourceDialog data={data as any} />);
        expect(screen.getByText('vol1')).toBeTruthy();
        expect(screen.getByText('vol2')).toBeTruthy();
        expect(screen.getAllByText('true')).toHaveLength(2);
        // Blank `value` (current value) should render as "not available", not an empty cell
        expect(screen.getAllByText('databases.general.not-available')).toHaveLength(2);
    });

    it('renders log-drive-size rows for ignoredDrives (shared drive) without n/a placeholder row', () => {
        const data = {
            configurationName: 'log-drive-size',
            sizingViolations: {
                overProvisionedDrives: [],
                underProvisionedDrives: [],
                ignoredDrives: [
                    {
                        logAccessPath: 'D:\\',
                        lunPath: '/vol/vol1/lun0',
                        databases: ['A3228DB1', 'msdb'],
                        sizePercentToDataDrive: 100
                    }
                ]
            }
        };
        render(<ImpactedResourceDialog data={data as any} />);
        expect(screen.getByText('D:\\')).toBeTruthy();
        expect(screen.getByText('/vol/vol1/lun0')).toBeTruthy();
        expect(screen.getByText('A3228DB1, msdb')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.shared-drive')).toBeTruthy();
        expect(screen.getByText('100%')).toBeTruthy();
    });
});
