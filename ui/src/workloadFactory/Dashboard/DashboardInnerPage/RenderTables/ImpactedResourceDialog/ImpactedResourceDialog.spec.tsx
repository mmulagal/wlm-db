import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const engineTypeMock = vi.hoisted(() => ({
    type: 'MSSQL' as string,
    driftAssessmentData: null as { metadata?: Record<string, unknown> } | null,
    selectedHostname: '' as string
}));

vi.mock('../../../../../store/storeHooks', () => ({
    useAppSelector: (
        selector: (state: {
            getWellOptimize: {
                configEngineType: string;
                driftAssessmentData: { metadata?: Record<string, unknown> } | null;
                selectedHostname: string;
            };
        }) => unknown
    ) =>
        selector({
            getWellOptimize: {
                configEngineType: engineTypeMock.type,
                driftAssessmentData: engineTypeMock.driftAssessmentData,
                selectedHostname: engineTypeMock.selectedHostname
            }
        })
}));

vi.mock('../../../../../utils/resourceUtils', () => ({
    normalizeResourceTypeCasing: (s: string) => s
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
    useGetMissingPatchAssessmentDataQuery: ({ field }: { field?: string }, options?: { skip?: boolean }) => {
        if (options?.skip) return { data: undefined, isFetching: false };
        if (field === 'host-os-patch') {
            return {
                data: {
                    ec2InstancesToPatch: [
                        {
                            ec2InstanceName: 'sqlserver-01',
                            missingPatchDetails: [
                                {
                                    kbId: 'KB123456',
                                    title: 'Security Update',
                                    classification: 'Security',
                                    severity: 'Critical'
                                }
                            ]
                        }
                    ]
                },
                isFetching: false
            };
        }
        if (field === 'mssql-patch') {
            return {
                data: {
                    missingPatchesInEc2Instances: [
                        {
                            ec2InstanceName: 'sqlserver-02',
                            missingPatchDetails: [
                                {
                                    kbId: 'KB789012',
                                    title: 'MSSQL Patch',
                                    classification: 'Important',
                                    severity: 'High'
                                }
                            ]
                        }
                    ]
                },
                isFetching: false
            };
        }
        if (field === 'oracle-security-patch') {
            return {
                data: {
                    ec2InstancesToPatch: [
                        {
                            missingPatchDetails: [
                                {
                                    cveId: 'CVE-2024-1234',
                                    component: 'Oracle DB',
                                    description: 'Critical vulnerability',
                                    releaseDate: '2024-01-15'
                                }
                            ]
                        }
                    ]
                },
                isFetching: false
            };
        }
        return { data: undefined, isFetching: false };
    }
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
        expect(screen.getByText('Volume name')).toBeTruthy();
        expect(screen.getByText('Current')).toBeTruthy();
        expect(screen.getByText('Recommended')).toBeTruthy();
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
        // Blank `value` (current value) should render as unavailable, not an empty cell
        expect(screen.getAllByText('databases.general.unavailable')).toHaveLength(2);
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

    // === FILE SYSTEM HEADROOM (MSSQL) ===
    describe('FILE_SYSTEM_HEADROOM MSSQL (headroom id)', () => {
        it('renders current and recommended from objectsInViolation when violationDetails is empty', () => {
            const data = {
                configurationName: 'headroom',
                objectsInViolation: ['fs-07a22f282fd4f5a20'],
                violationDetails: [],
                current: '36%',
                recommended: '36-100%'
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('File system')).toBeTruthy();
            expect(screen.getByText('Current value')).toBeTruthy();
            expect(screen.getByText('Recommended value')).toBeTruthy();
            expect(screen.getByText('fs-07a22f282fd4f5a20')).toBeTruthy();
            expect(screen.getByText('36%')).toBeTruthy();
            expect(screen.getByText('36-100%')).toBeTruthy();
        });

        it('renders current and recommended from violationDetails when present', () => {
            const data = {
                configurationName: 'headroom',
                objectsInViolation: [],
                violationDetails: [{ objectName: 'fs-abc', current: '20%', recommended: '36-100%' }],
                current: '20%',
                recommended: '36-100%'
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('fs-abc')).toBeTruthy();
            expect(screen.getByText('20%')).toBeTruthy();
            expect(screen.getByText('36-100%')).toBeTruthy();
        });

        it('falls back to top-level current/recommended when violationDetail row omits them', () => {
            const data = {
                configurationName: 'headroom',
                objectsInViolation: [],
                violationDetails: [{ objectName: 'fs-xyz' }],
                current: '25%',
                recommended: '36-100%'
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('fs-xyz')).toBeTruthy();
            expect(screen.getByText('25%')).toBeTruthy();
            expect(screen.getByText('36-100%')).toBeTruthy();
        });
    });

    // === MAXDOP (MSSQL) ===
    describe('MAXDOP MSSQL', () => {
        it('renders SQL instance, current and recommended values from objectsInViolation', () => {
            const data = {
                configurationName: 'maxdop',
                objectsInViolation: ['MSSQLSERVER'],
                violationDetails: [],
                current: '3',
                recommended: '4'
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('SQL instance')).toBeTruthy();
            expect(screen.getByText('Current value')).toBeTruthy();
            expect(screen.getByText('Recommended value')).toBeTruthy();
            expect(screen.getByText('MSSQLSERVER')).toBeTruthy();
            expect(screen.getByText('3')).toBeTruthy();
            expect(screen.getByText('4')).toBeTruthy();
        });

        it('renders unavailable placeholder when objectsInViolation is empty', () => {
            const data = {
                configurationName: 'maxdop',
                objectsInViolation: [],
                violationDetails: [],
                current: '3',
                recommended: '4'
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('SQL instance')).toBeTruthy();
            expect(screen.getAllByText('databases.general.unavailable').length).toBeGreaterThan(0);
        });
    });

    // === FILE SYSTEM HEADROOM (Oracle) ===
    describe('FILE_SYSTEM_HEADROOM Oracle', () => {
        it('renders Oracle headroom with objectsInViolation and top-level current/recommended', () => {
            const data = {
                configurationName: 'headroom',
                objectsInViolation: ['oracle-fs-001'],
                violationDetails: [],
                current: '40%',
                recommended: '36-100%'
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('File system')).toBeTruthy();
            expect(screen.getByText('oracle-fs-001')).toBeTruthy();
            expect(screen.getByText('40%')).toBeTruthy();
            expect(screen.getByText('36-100%')).toBeTruthy();
        });
    });

    // === HOST OS PATCH (MSSQL) ===
    describe('HOST OS PATCH (host-os-patch)', () => {
        it('renders patch columns and rows from missingPatchList when patch IDs are provided', () => {
            const data = {
                configurationName: 'host-os-patch',
                credentialId: 'cred-1',
                regionId: 'us-east-1',
                databaseHostId: 'host-1',
                instanceId: 'inst-1'
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('databases.well-architect.kb-id')).toBeTruthy();
            expect(screen.getByText('databases.well-architect.name')).toBeTruthy();
            expect(screen.getByText('databases.well-architect.classification')).toBeTruthy();
            expect(screen.getByText('databases.well-architect.severity')).toBeTruthy();
            expect(screen.getByText('KB123456')).toBeTruthy();
            expect(screen.getByText('Security Update')).toBeTruthy();
            expect(screen.getByText('Security')).toBeTruthy();
            expect(screen.getByText('Critical')).toBeTruthy();
        });

        it('renders unavailable placeholder row when no patch IDs provided', () => {
            const data = {
                configurationName: 'host-os-patch'
                // no credentialId/regionId/databaseHostId/instanceId
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('databases.well-architect.kb-id')).toBeTruthy();
            expect(screen.getAllByText('databases.general.unavailable').length).toBeGreaterThan(0);
        });
    });

    // === MSSQL SERVER PATCH (mssql-patch) ===
    describe('MSSQL SERVER PATCH (mssql-patch)', () => {
        it('renders patch columns and rows from missingPatchesInEc2Instances', () => {
            const data = {
                configurationName: 'mssql-patch',
                credentialId: 'cred-1',
                regionId: 'us-east-1',
                databaseHostId: 'host-1',
                instanceId: 'inst-1'
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('databases.well-architect.kb-id')).toBeTruthy();
            expect(screen.getByText('KB789012')).toBeTruthy();
            expect(screen.getByText('MSSQL Patch')).toBeTruthy();
            expect(screen.getByText('Important')).toBeTruthy();
            expect(screen.getByText('High')).toBeTruthy();
        });

        it('renders unavailable placeholder row when no patch IDs provided', () => {
            const data = { configurationName: 'mssql-patch' };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('databases.well-architect.kb-id')).toBeTruthy();
            expect(screen.getAllByText('databases.general.unavailable').length).toBeGreaterThan(0);
        });
    });

    // === HEARTBEAT SETTINGS (registry-based fallback) ===
    describe('HEARTBEAT SETTINGS (heartbeat-settings)', () => {
        afterEach(() => {
            engineTypeMock.driftAssessmentData = null;
            engineTypeMock.selectedHostname = '';
        });

        it('renders Host name / Current value / Recommended value columns with combineRows', () => {
            const data = {
                configurationName: 'heartbeat-settings',
                objectsInViolation: ['i-0a1f31a39bd2d9362'],
                violationDetails: [
                    { objectName: 'CrossSubnetDelay', value: '500', recommended: '2000' },
                    { objectName: 'CrossSubnetThreshold', value: '5', recommended: '20' }
                ],
                hostName: 'my-db-host.example.com'
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('Host name')).toBeTruthy();
            expect(screen.getByText('Current heartbeat setting')).toBeTruthy();
            expect(screen.getByText('Recommended heartbeat setting')).toBeTruthy();
            // Combined rows: name=value pairs
            expect(screen.getByText('CrossSubnetDelay=500, CrossSubnetThreshold=5')).toBeTruthy();
            expect(screen.getByText('CrossSubnetDelay=2000, CrossSubnetThreshold=20')).toBeTruthy();
        });

        it('shows hostname from data.hostName (Dashboard row fallback)', () => {
            const data = {
                configurationName: 'heartbeat-settings',
                objectsInViolation: ['i-0a1f31a39bd2d9362'],
                violationDetails: [{ objectName: 'SameSubnetDelay', value: '2000', recommended: '1000' }],
                hostName: 'host-from-row.example.com'
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('host-from-row.example.com')).toBeTruthy();
        });

        it('shows hostname from selectedHostname store fallback when data.hostName is absent', () => {
            engineTypeMock.selectedHostname = 'host-from-store.example.com';
            const data = {
                configurationName: 'heartbeat-settings',
                objectsInViolation: ['i-0a1f31a39bd2d9362'],
                violationDetails: [{ objectName: 'SameSubnetDelay', value: '2000', recommended: '1000' }]
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('host-from-store.example.com')).toBeTruthy();
        });

        it('shows hostname from driftAssessmentData.metadata (GetWell page context)', () => {
            // In GetWell context data.hostName is undefined; metadata is the authoritative source.
            engineTypeMock.driftAssessmentData = { metadata: { databaseHostName: 'host-from-metadata.example.com' } };
            const data = {
                configurationName: 'heartbeat-settings',
                objectsInViolation: ['i-0a1f31a39bd2d9362'],
                violationDetails: [{ objectName: 'SameSubnetDelay', value: '2000', recommended: '1000' }]
                // hostName intentionally absent — simulates GetWell inner page context
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('host-from-metadata.example.com')).toBeTruthy();
        });

        it('shows unavailable when no hostname source is available', () => {
            const data = {
                configurationName: 'heartbeat-settings',
                objectsInViolation: ['i-0a1f31a39bd2d9362'],
                violationDetails: [{ objectName: 'SameSubnetDelay', value: '2000', recommended: '1000' }]
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('Host name')).toBeTruthy();
            expect(screen.getAllByText('databases.general.unavailable').length).toBeGreaterThan(0);
        });

        it('renders cluster-quorum with configuration-name / current / recommended columns', () => {
            const data = {
                configurationName: 'cluster-quorum',
                recommended: 'NodeMajority',
                objectsInViolation: ['SQL-DEV-FCI-CLUSTER'],
                violationDetails: [{ objectName: 'QuorumType', value: 'NodeAndDiskMajority' }]
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('Cluster name')).toBeTruthy();
            expect(screen.getByText('Current value')).toBeTruthy();
            expect(screen.getByText('Recommended value')).toBeTruthy();
            expect(screen.getByText('SQL-DEV-FCI-CLUSTER')).toBeTruthy();
            expect(screen.getByText('QuorumType')).toBeTruthy();
            expect(screen.getByText('NodeAndDiskMajority')).toBeTruthy();
            expect(screen.getByText('NodeMajority')).toBeTruthy();
        });

        it('renders sql-server-service with top-level recommended fallback', () => {
            const data = {
                configurationName: 'sql-server-service',
                recommended: 'LocalSystem',
                violationDetails: [{ objectName: 'ServiceAccount', value: 'Administrator' }]
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('ServiceAccount')).toBeTruthy();
            expect(screen.getByText('Administrator')).toBeTruthy();
            expect(screen.getByText('LocalSystem')).toBeTruthy();
        });
    });

    // === TEMPDB DRIVE SIZE (MSSQL) ===
    describe('TEMPDB_DRIVE_SIZE MSSQL', () => {
        it('renders tempdb drive name, lun path, databases, status and percentage', () => {
            const data = {
                configurationName: 'tempdb-drive-size',
                sizingViolations: {
                    overProvisionedDrives: [],
                    underProvisionedDrives: [
                        {
                            tempdbAccessPath: 'T:\\',
                            lunPath: '/vol/tempdb/lun0',
                            databases: ['tempdb'],
                            sizePercentToDataDrive: 25
                        }
                    ],
                    ignoredDrives: []
                }
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('T:\\')).toBeTruthy();
            expect(screen.getByText('/vol/tempdb/lun0')).toBeTruthy();
            expect(screen.getByText('tempdb')).toBeTruthy();
            expect(screen.getByText('databases.well-architect.under-provisioned')).toBeTruthy();
            expect(screen.getByText('25%')).toBeTruthy();
        });
    });

    // === MULTIPATH I/O SESSIONS (MSSQL) ===
    describe('MULTIPATH_IO_SESSIONS MSSQL', () => {
        it('renders multipath configuration, current value and top-level recommended', () => {
            const data = {
                configurationName: 'mpio-iscsi-count',
                recommended: '5',
                violationDetails: [{ objectName: 'sessions', value: '2' }]
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('Multipath configuration')).toBeTruthy();
            expect(screen.getByText('Current value')).toBeTruthy();
            expect(screen.getByText('Recommended value')).toBeTruthy();
            expect(screen.getByText('sessions')).toBeTruthy();
            expect(screen.getByText('2')).toBeTruthy();
            expect(screen.getByText('5')).toBeTruthy();
        });

        it('renders unavailable placeholder row when violationDetails is empty', () => {
            const data = {
                configurationName: 'mpio-iscsi-count',
                recommended: '5',
                violationDetails: []
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('Multipath configuration')).toBeTruthy();
            expect(screen.getAllByText('databases.general.unavailable').length).toBeGreaterThan(0);
        });
    });

    // === RSS CONFIGURATION (MSSQL) ===
    describe('RSS_CONFIGURATION MSSQL (rss-config)', () => {
        it('renders non-optimized adapters with RSS columns', () => {
            const data = {
                configurationName: 'rss-config',
                rssAdapters: [
                    {
                        adapterName: 'Ethernet0',
                        rssEnabled: false,
                        rssProfile: 'NUMAScaling',
                        baseProcessorNumber: 0,
                        numberOfReceiveQueues: 2
                    }
                ],
                recommendedAdapterSettings: {
                    recommendedRssProfile: 'ClosestProcessor',
                    recommendedBaseProcessorNumber: 0,
                    recommendedReceiveQueues: 4
                }
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('databases.well-architect.network-adapter-name')).toBeTruthy();
            expect(screen.getByText('databases.well-architect.rss-status')).toBeTruthy();
            expect(screen.getByText('databases.well-architect.rss-profile')).toBeTruthy();
            expect(screen.getByText('databases.well-architect.base-processor-number')).toBeTruthy();
            expect(screen.getByText('databases.well-architect.receive-queues')).toBeTruthy();
            expect(screen.getByText('Ethernet0')).toBeTruthy();
            expect(screen.getByText('Disabled')).toBeTruthy();
            expect(screen.getByText('NUMAScaling')).toBeTruthy();
        });

        it('filters out optimized adapters and shows placeholder when all are compliant', () => {
            const data = {
                configurationName: 'rss-config',
                rssAdapters: [
                    {
                        adapterName: 'Ethernet0',
                        rssEnabled: true,
                        rssProfile: 'ClosestProcessor',
                        baseProcessorNumber: 0,
                        numberOfReceiveQueues: 4
                    }
                ],
                recommendedAdapterSettings: {
                    recommendedRssProfile: 'ClosestProcessor',
                    recommendedBaseProcessorNumber: 0,
                    recommendedReceiveQueues: 4
                }
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('databases.well-architect.network-adapter-name')).toBeTruthy();
            expect(screen.getAllByText('databases.general.unavailable').length).toBeGreaterThan(0);
        });
    });

    // === MTU (MSSQL) ===
    describe('MTU MSSQL (mtu-alignment)', () => {
        it('renders interface name, current MTU and recommended MTU from ec2InterfacesToFix', () => {
            const data = {
                configurationName: 'mtu-alignment',
                ec2InterfacesToFix: [{ name: 'eth0', currentMTU: 1500, recommendedMTU: 9000, interfaceIndex: 1 }]
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('databases.well-architect.network-interface-name')).toBeTruthy();
            expect(screen.getByText('eth0')).toBeTruthy();
            expect(screen.getByText('1500')).toBeTruthy();
            expect(screen.getByText('9000')).toBeTruthy();
        });

        it('falls back to violationDetails when ec2InterfacesToFix is empty', () => {
            const data = {
                configurationName: 'mtu-alignment',
                ec2InterfacesToFix: [],
                violationDetails: [{ objectName: 'eth1', value: '1500', recommended: '9000' }]
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('databases.well-architect.network-interface-name')).toBeTruthy();
            expect(screen.getByText('eth1')).toBeTruthy();
            expect(screen.getByText('1500')).toBeTruthy();
            expect(screen.getByText('9000')).toBeTruthy();
        });
    });

    // === SCHEDULED FSX FOR ONTAP BACKUPS (MSSQL) ===
    describe('SCHEDULED_FSX_FOR_ONTAP_BACKUPS MSSQL (backup-configuration)', () => {
        it('renders volume names from objectsInViolation using ontapVolumeName or string', () => {
            const data = {
                configurationName: 'backup-configuration',
                objectsInViolation: [{ ontapVolumeName: 'vol-1', objectName: 'obj-1' }, 'vol-2']
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('Volume name')).toBeTruthy();
            expect(screen.getByText('vol-1')).toBeTruthy();
            expect(screen.getByText('vol-2')).toBeTruthy();
        });
    });

    // === ORACLE CONFIGS ===
    describe('Oracle configs', () => {
        beforeEach(() => {
            engineTypeMock.type = 'ORACLE';
        });
        afterEach(() => {
            engineTypeMock.type = 'MSSQL';
        });

        // --- SWAP SPACE ---
        describe('swap-space', () => {
            it('renders ec2-instance, current and recommended from violationDetails', () => {
                const data = {
                    configurationName: 'swap-space',
                    violationDetails: [{ objectName: 'i-0abc123', value: '2 GB', recommended: '8 GB' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('EC2 instance')).toBeTruthy();
                expect(screen.getByText('i-0abc123')).toBeTruthy();
                expect(screen.getByText('2 GB')).toBeTruthy();
                expect(screen.getByText('8 GB')).toBeTruthy();
            });

            it('renders placeholder row when violationDetails and objectsInViolation are both empty', () => {
                const data = { configurationName: 'swap-space', violationDetails: [], objectsInViolation: [] };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('EC2 instance')).toBeTruthy();
                expect(screen.getAllByText('databases.general.unavailable').length).toBeGreaterThan(0);
            });
        });

        // --- AFD LOGICAL BLOCK SIZE ---
        describe('afd-logical-block-size', () => {
            it('renders configuration, current value and recommended value from violationDetails', () => {
                const data = {
                    configurationName: 'afd-logical-block-size',
                    violationDetails: [{ objectName: 'AFD_disk1', value: '512', recommended: '4096' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('AFD_disk1')).toBeTruthy();
                expect(screen.getByText('512')).toBeTruthy();
                expect(screen.getByText('4096')).toBeTruthy();
            });
        });

        // --- ASMLIB LOGICAL BLOCK SIZE ---
        describe('asmlib-logical-block-size', () => {
            it('renders configuration name, current value and recommended value from violationDetails', () => {
                const data = {
                    configurationName: 'asmlib-logical-block-size',
                    violationDetails: [{ objectName: 'ORCL_ASM1', value: '512', recommended: '4096' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('ORCL_ASM1')).toBeTruthy();
                expect(screen.getByText('512')).toBeTruthy();
                expect(screen.getByText('4096')).toBeTruthy();
            });
        });

        // --- DNFS CONSISTENT IP RESOLUTION ---
        describe('dnfs-consistent-ip-resolution', () => {
            it('renders EC2 instance, current value and recommended value from violationDetails', () => {
                const data = {
                    configurationName: 'dnfs-consistent-ip-resolution',
                    violationDetails: [{ objectName: 'i-0dnfs01', value: 'disabled', recommended: 'enabled' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('i-0dnfs01')).toBeTruthy();
                expect(screen.getByText('disabled')).toBeTruthy();
                expect(screen.getByText('enabled')).toBeTruthy();
            });
        });

        // --- FILESYSTEMS IO OPTIONS ---
        describe('filesystems-io-options', () => {
            it('renders configuration name, current value and recommended value from violationDetails', () => {
                const data = {
                    configurationName: 'filesystems-io-options',
                    violationDetails: [{ objectName: '/oradata', value: 'relatime', recommended: 'noatime' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('/oradata')).toBeTruthy();
                expect(screen.getByText('relatime')).toBeTruthy();
                expect(screen.getByText('noatime')).toBeTruthy();
            });
        });

        // --- NFS CACHING OPTIONS ---
        describe('nfs-caching-options', () => {
            it('renders mount options, current value and recommended value from violationDetails', () => {
                const data = {
                    configurationName: 'nfs-caching-options',
                    violationDetails: [{ objectName: '/u01/app', value: 'actimeo=0', recommended: 'actimeo=600' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('/u01/app')).toBeTruthy();
                expect(screen.getByText('actimeo=0')).toBeTruthy();
                expect(screen.getByText('actimeo=600')).toBeTruthy();
            });
        });

        // --- NFS MOUNT OPTIONS ADR HOME ---
        describe('nfs-mount-options-adrhome', () => {
            it('renders mount options, current value and recommended value from violationDetails', () => {
                const data = {
                    configurationName: 'nfs-mount-options-adrhome',
                    violationDetails: [{ objectName: '/u01/adr', value: 'rw', recommended: 'rw,noatime' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('/u01/adr')).toBeTruthy();
                expect(screen.getByText('rw')).toBeTruthy();
                expect(screen.getByText('rw,noatime')).toBeTruthy();
            });
        });

        // --- ORACLE SECURITY PATCH ---
        describe('oracle-security-patch', () => {
            it('renders CVE ID, component, description and published date from patch API', () => {
                const data = {
                    configurationName: 'oracle-security-patch',
                    credentialId: 'cred-1',
                    regionId: 'us-east-1',
                    databaseHostId: 'host-1',
                    instanceId: 'inst-1'
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('CVE-2024-1234')).toBeTruthy();
                expect(screen.getByText('Oracle DB')).toBeTruthy();
                expect(screen.getByText('Critical vulnerability')).toBeTruthy();
                expect(screen.getByText('2024-01-15')).toBeTruthy();
            });

            it('renders placeholder row when patch IDs are missing', () => {
                const data = { configurationName: 'oracle-security-patch' };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('CVE ID')).toBeTruthy();
                expect(screen.getAllByText('databases.general.unavailable').length).toBeGreaterThan(0);
            });
        });

        // --- ISCSI REPLACEMENT TIMEOUT ---
        describe('iscsi-replacement-timeout', () => {
            afterEach(() => {
                engineTypeMock.driftAssessmentData = null;
                engineTypeMock.selectedHostname = '';
            });

            it('renders Host name, Configuration name, current and recommended columns', () => {
                engineTypeMock.driftAssessmentData = { metadata: { databaseHostName: 'oracle-host-01' } };
                const data = {
                    configurationName: 'iscsi-replacement-timeout',
                    violationDetails: [{ objectName: 'replacement_timeout', value: '120', recommended: '5' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('Host name')).toBeTruthy();
                expect(screen.getByText('Current iSCSI replacement timeout')).toBeTruthy();
                expect(screen.getByText('oracle-host-01')).toBeTruthy();
                expect(screen.getByText('120')).toBeTruthy();
                expect(screen.getByText('5')).toBeTruthy();
            });

            it('shows hostname from data.hostName when metadata is absent', () => {
                const data = {
                    configurationName: 'iscsi-replacement-timeout',
                    violationDetails: [{ objectName: 'replacement_timeout', value: '120', recommended: '5' }],
                    hostName: 'oracle-host-from-row'
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('oracle-host-from-row')).toBeTruthy();
            });

            it('shows unavailable for Host name when no hostname source', () => {
                const data = {
                    configurationName: 'iscsi-replacement-timeout',
                    violationDetails: [{ objectName: 'replacement_timeout', value: '120', recommended: '5' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('Host name')).toBeTruthy();
                expect(screen.getAllByText('databases.general.unavailable').length).toBeGreaterThan(0);
            });
        });

        // --- KERNEL PARAMETERS ---
        describe('kernel-parameters', () => {
            it('renders configuration name, current value and recommended value from violationDetails', () => {
                const data = {
                    configurationName: 'kernel-parameters',
                    violationDetails: [{ objectName: 'vm.swappiness', value: '60', recommended: '1' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                // combineRows: true — violationDetails collapsed into name=value pairs
                // kernel-parameters uses combineRows: aggregates violationDetails into a single objectName=value row
                expect(screen.getByText('vm.swappiness=60')).toBeTruthy();
                expect(screen.getByText('vm.swappiness=1')).toBeTruthy();
            });
        });

        // --- MULTIPATH CONFIGURATION ---
        describe('multipath-configuration', () => {
            it('renders configuration name, current value and recommended value from violationDetails', () => {
                const data = {
                    configurationName: 'multipath-configuration',
                    violationDetails: [
                        { objectName: 'path_grouping_policy', value: 'multibus', recommended: 'group_by_prio' }
                    ]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('path_grouping_policy')).toBeTruthy();
                expect(screen.getByText('multibus')).toBeTruthy();
                expect(screen.getByText('group_by_prio')).toBeTruthy();
            });
        });

        // --- MULTIPATH FRIENDLY NAMES ---
        describe('multipath-friendly-names', () => {
            afterEach(() => {
                engineTypeMock.driftAssessmentData = null;
                engineTypeMock.selectedHostname = '';
            });

            it('renders Host name, Configuration name, current and recommended columns', () => {
                engineTypeMock.driftAssessmentData = { metadata: { databaseHostName: 'oracle-host-02' } };
                const data = {
                    configurationName: 'multipath-friendly-names',
                    violationDetails: [{ objectName: 'use_friendly_names', value: 'yes', recommended: 'no' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('Host name')).toBeTruthy();
                expect(screen.getByText('Current value')).toBeTruthy();
                expect(screen.getByText('oracle-host-02')).toBeTruthy();
                expect(screen.getByText('yes')).toBeTruthy();
                expect(screen.getByText('no')).toBeTruthy();
            });

            it('shows hostname from data.hostName when metadata is absent', () => {
                const data = {
                    configurationName: 'multipath-friendly-names',
                    violationDetails: [{ objectName: 'use_friendly_names', value: 'yes', recommended: 'no' }],
                    hostName: 'oracle-row-host'
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('oracle-row-host')).toBeTruthy();
            });
        });

        // --- MULTIPATH IO SESSIONS ---
        describe('multipath-io-sessions', () => {
            it('renders configuration name, current value and recommended value from violationDetails', () => {
                const data = {
                    configurationName: 'multipath-io-sessions',
                    violationDetails: [{ objectName: 'nr_requests', value: '64', recommended: '256' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('nr_requests')).toBeTruthy();
                expect(screen.getByText('64')).toBeTruthy();
                expect(screen.getByText('256')).toBeTruthy();
            });
        });

        // --- THIN PROVISIONING ---
        describe('thin-provision', () => {
            it('renders volume name, configName as middle header and recommended from violationDetails', () => {
                const data = {
                    configurationName: 'thin-provision',
                    violationDetails: [{ objectName: 'vol1', value: 'thick', recommended: 'thin' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('databases.well-architect.volume-name')).toBeTruthy();
                expect(screen.getByText('thin-provision')).toBeTruthy();
                expect(screen.getByText('vol1')).toBeTruthy();
                expect(screen.getByText('thick')).toBeTruthy();
                expect(screen.getByText('databases.well-architect.recommended-value')).toBeTruthy();
            });
        });

        // --- COMPACTION ---
        describe('compaction', () => {
            it('renders volume name, configName as middle header and recommended from violationDetails', () => {
                const data = {
                    configurationName: 'compaction',
                    violationDetails: [{ objectName: 'vol2', value: 'disabled', recommended: 'enabled' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('databases.well-architect.volume-name')).toBeTruthy();
                expect(screen.getByText('compaction')).toBeTruthy();
                expect(screen.getByText('vol2')).toBeTruthy();
                expect(screen.getByText('disabled')).toBeTruthy();
                expect(screen.getByText('enabled')).toBeTruthy();
            });
        });

        // --- DNFS CONFIGURATION FILE ---
        describe('dnfs-configuration-file', () => {
            it('renders NFS mount, current dNFS configuration and recommended dNFS configuration', () => {
                const data = {
                    configurationName: 'dnfs-configuration-file',
                    violationDetails: [{ objectName: '/nfs/mount1', value: 'disabled', recommended: 'enabled' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('NFS mount')).toBeTruthy();
                expect(screen.getByText('Status')).toBeTruthy();
                expect(screen.getByText('Recommended dNFS configuration')).toBeTruthy();
                expect(screen.getByText('/nfs/mount1')).toBeTruthy();
                expect(screen.getByText('disabled')).toBeTruthy();
                expect(screen.getByText('enabled')).toBeTruthy();
            });

            it('falls back to nfsMount field when objectName is absent', () => {
                const data = {
                    configurationName: 'dnfs-configuration-file',
                    violationDetails: [{ nfsMount: '/nfs/mount2', value: 'partial', recommended: 'full' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('/nfs/mount2')).toBeTruthy();
                expect(screen.getByText('partial')).toBeTruthy();
                expect(screen.getByText('full')).toBeTruthy();
            });
        });

        // --- DNFS NO SHARED CACHE ---
        describe('dnfs-no-shared-cache', () => {
            it('renders NFS mount, current and recommended mount options', () => {
                const data = {
                    configurationName: 'dnfs-no-shared-cache',
                    violationDetails: [{ objectName: '/nfs/mount3', value: 'enabled', recommended: 'disabled' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('NFS mount')).toBeTruthy();
                expect(screen.getByText('Current mount options')).toBeTruthy();
                expect(screen.getByText('Recommended mount options')).toBeTruthy();
                expect(screen.getByText('/nfs/mount3')).toBeTruthy();
            });
        });

        // --- NFS MOUNT OPTIONS DATABASEFILES ---
        describe('nfs-mount-options-databasefiles', () => {
            it('renders NFS mount from nfsMount fallback, current and recommended mount options', () => {
                const data = {
                    configurationName: 'nfs-mount-options-databasefiles',
                    violationDetails: [{ nfsMount: '/u01/oradata', value: 'rw', recommended: 'rw,noatime' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('NFS mount')).toBeTruthy();
                expect(screen.getByText('Current mount options')).toBeTruthy();
                expect(screen.getByText('Recommended mount options')).toBeTruthy();
                expect(screen.getByText('/u01/oradata')).toBeTruthy();
                expect(screen.getByText('rw')).toBeTruthy();
                expect(screen.getByText('rw,noatime')).toBeTruthy();
            });
        });

        // --- ORACLE OS PATCH (Oracle engine uses Component/Package name/Update type/Severity headers) ---
        describe('host-os-patch (Oracle engine)', () => {
            it('renders Component/Package name/Update type/Severity column headers', () => {
                const data = {
                    configurationName: 'host-os-patch',
                    credentialId: 'cred-1',
                    regionId: 'us-east-1',
                    databaseHostId: 'host-1',
                    instanceId: 'inst-1'
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('Component')).toBeTruthy();
                expect(screen.getByText('Package name')).toBeTruthy();
                expect(screen.getByText('Update type')).toBeTruthy();
                expect(screen.getByText('Severity')).toBeTruthy();
                expect(screen.getByText('Security Update')).toBeTruthy();
            });

            it('renders placeholder row when patch IDs are not provided', () => {
                const data = { configurationName: 'host-os-patch' };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('Component')).toBeTruthy();
                expect(screen.getAllByText('databases.general.unavailable').length).toBeGreaterThan(0);
            });
        });

        // --- ORACLE PLACEMENT CONFIGS ---
        describe('oracle-binary-placement', () => {
            it('renders volume name, current and recommended from violationDetails', () => {
                const data = {
                    configurationName: 'oracle-binary-placement',
                    violationDetails: [{ objectName: '/oracle/home', value: 'wrong-vol', recommended: 'oracle-vol' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('Volume name')).toBeTruthy();
                expect(screen.getByText('Current value')).toBeTruthy();
                expect(screen.getByText('Recommended value')).toBeTruthy();
                expect(screen.getByText('/oracle/home')).toBeTruthy();
                expect(screen.getByText('wrong-vol')).toBeTruthy();
                expect(screen.getByText('oracle-vol')).toBeTruthy();
            });

            it('falls back to ontapVolumeName from objectsInViolation when violationDetails is empty', () => {
                const data = {
                    configurationName: 'oracle-binary-placement',
                    violationDetails: [],
                    objectsInViolation: [{ ontapVolumeName: 'vol-oracle', objectName: 'obj1' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('vol-oracle')).toBeTruthy();
            });
        });

        describe('datafiles-placement', () => {
            it('renders volume name, current and recommended from violationDetails', () => {
                const data = {
                    configurationName: 'datafiles-placement',
                    violationDetails: [{ objectName: 'vol-data', value: 'bad-vol', recommended: 'data-vol' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('vol-data')).toBeTruthy();
                expect(screen.getByText('bad-vol')).toBeTruthy();
                expect(screen.getByText('data-vol')).toBeTruthy();
            });
        });

        // --- CRR ---
        describe('crr', () => {
            it('renders volume name, current and recommended from violationDetails', () => {
                const data = {
                    configurationName: 'crr',
                    violationDetails: [{ objectName: 'vol-a', value: 'disabled', recommended: 'enabled' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('File system')).toBeTruthy();
                expect(screen.getByText('vol-a')).toBeTruthy();
                expect(screen.getByText('disabled')).toBeTruthy();
                expect(screen.getByText('enabled')).toBeTruthy();
            });

            it('falls back to ontapVolumeName from objectsInViolation when violationDetails is empty', () => {
                const data = {
                    configurationName: 'crr',
                    violationDetails: [],
                    objectsInViolation: [{ ontapVolumeName: 'crr-vol' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('crr-vol')).toBeTruthy();
            });
        });

        // --- SNAPCENTER SNAPSHOT ---
        describe('snapcenter-snapshot', () => {
            it('renders volume name, snapshot status and recommended from violationDetails', () => {
                const data = {
                    configurationName: 'snapcenter-snapshot',
                    violationDetails: [{ objectName: 'vol-snap', value: 'not-configured', recommended: 'enabled' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('Volume name')).toBeTruthy();
                expect(screen.getByText('Snapshot status')).toBeTruthy();
                expect(screen.getByText('Recommended value')).toBeTruthy();
                expect(screen.getByText('vol-snap')).toBeTruthy();
                expect(screen.getByText('not-configured')).toBeTruthy();
                expect(screen.getByText('enabled')).toBeTruthy();
            });

            it('falls back to ontapVolumeName from objectsInViolation when violationDetails is empty', () => {
                const data = {
                    configurationName: 'snapcenter-snapshot',
                    violationDetails: [],
                    objectsInViolation: [{ ontapVolumeName: 'snap-vol' }]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('snap-vol')).toBeTruthy();
            });
        });

        // --- SCHEDULED FSX FOR ONTAP BACKUPS (Oracle) ---
        describe('backup-configuration (Oracle)', () => {
            it('renders volume names from violationDetails when present', () => {
                const data = {
                    configurationName: 'backup-configuration',
                    violationDetails: [{ objectName: 'vol-backup' }],
                    objectsInViolation: []
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('databases.well-architect.volume-name')).toBeTruthy();
                expect(screen.getByText('vol-backup')).toBeTruthy();
            });

            it('falls back to ontapVolumeName from objectsInViolation when violationDetails is empty', () => {
                const data = {
                    configurationName: 'backup-configuration',
                    violationDetails: [],
                    objectsInViolation: [{ ontapVolumeName: 'oracle-backup-vol', objectName: 'obj1' }, 'direct-vol']
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('oracle-backup-vol')).toBeTruthy();
                expect(screen.getByText('direct-vol')).toBeTruthy();
            });
        });

        // --- TCP ADVANCED OPTIONS ---
        describe('tcp-advanced-options', () => {
            it('renders 3 columns (EC2 instance, Current value, Recommended value) with violationDetails', () => {
                const data = {
                    configurationName: 'tcp-advanced-options',
                    objectsInViolation: ['i-0abc123'],
                    violationDetails: [
                        { objectName: 'net.ipv4.tcp_timestamps', value: '0', recommended: '1' },
                        { objectName: 'net.ipv4.tcp_sack', value: '0', recommended: '1' }
                    ]
                };
                render(<ImpactedResourceDialog data={data as any} />);
                // Headers come from registry labels (English), not i18n keys
                expect(screen.getByText('EC2 instance')).toBeTruthy();
                expect(screen.getByText('Current value')).toBeTruthy();
                expect(screen.getByText('Recommended value')).toBeTruthy();
                expect(screen.getByText('i-0abc123')).toBeTruthy();
                expect(screen.getByText('net.ipv4.tcp_timestamps=0, net.ipv4.tcp_sack=0')).toBeTruthy();
                expect(screen.getByText('net.ipv4.tcp_timestamps=1, net.ipv4.tcp_sack=1')).toBeTruthy();
            });

            it('renders 3 columns with fallback when only objectsInViolation is provided', () => {
                const data = {
                    configurationName: 'tcp-advanced-options',
                    objectsInViolation: ['i-0abc123', 'i-0def456']
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('EC2 instance')).toBeTruthy();
                expect(screen.getByText('Current value')).toBeTruthy();
                expect(screen.getByText('Recommended value')).toBeTruthy();
                expect(screen.getByText('i-0abc123')).toBeTruthy();
                expect(screen.getByText('i-0def456')).toBeTruthy();
            });

            it('renders placeholder row when objectsInViolation is empty', () => {
                const data = {
                    configurationName: 'tcp-advanced-options',
                    objectsInViolation: []
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('EC2 instance')).toBeTruthy();
                expect(screen.getByText('Current value')).toBeTruthy();
                expect(screen.getByText('Recommended value')).toBeTruthy();
                expect(screen.getAllByText('databases.general.unavailable').length).toBeGreaterThan(0);
            });
        });

        // --- SWAP SPACE objectsInViolation fallback ---
        describe('swap-space objectsInViolation fallback', () => {
            it('renders from objectsInViolation with top-level current and recommended when violationDetails is empty', () => {
                const data = {
                    configurationName: 'swap-space',
                    violationDetails: [],
                    objectsInViolation: ['i-0ec2inst'],
                    current: '1 GB',
                    recommended: '8 GB'
                };
                render(<ImpactedResourceDialog data={data as any} />);
                expect(screen.getByText('EC2 instance')).toBeTruthy();
                expect(screen.getByText('i-0ec2inst')).toBeTruthy();
                expect(screen.getByText('1 GB')).toBeTruthy();
                expect(screen.getByText('8 GB')).toBeTruthy();
            });
        });
    });

    // === mapAssessmentViolations MSSQL fallback (config not in registry) ===
    describe('mapAssessmentViolations MSSQL fallback (config not in registry)', () => {
        it('renders single volume-name column from violationDetails for an unmapped config', () => {
            const data = {
                configurationName: 'unmapped-mssql-config',
                violationDetails: [{ objectName: 'vol-x', objectType: 'Volume', value: 'some-val' }]
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('databases.well-architect.volume-name')).toBeTruthy();
            expect(screen.getByText('vol-x')).toBeTruthy();
        });

        it('renders lun-name column when objectType is LUN', () => {
            const data = {
                configurationName: 'unmapped-lun-config',
                violationDetails: [{ objectName: 'lun-x', objectType: 'LUN', value: 'some-val' }]
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('databases.well-architect.lun-name')).toBeTruthy();
            expect(screen.getByText('lun-x')).toBeTruthy();
        });

        it('renders volume-name column from objectsInViolation strings when violationDetails is empty', () => {
            const data = {
                configurationName: 'unmapped-objects-config',
                violationDetails: [],
                objectsInViolation: ['obj-a', 'obj-b']
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('databases.well-architect.volume-name')).toBeTruthy();
            expect(screen.getByText('obj-a')).toBeTruthy();
            expect(screen.getByText('obj-b')).toBeTruthy();
        });
    });

    // === mapAssessmentViolations Oracle fallback (config not in registry) ===
    describe('mapAssessmentViolations Oracle fallback (config not in registry)', () => {
        beforeEach(() => {
            engineTypeMock.type = 'ORACLE';
        });
        afterEach(() => {
            engineTypeMock.type = 'MSSQL';
        });

        it('renders 3-column table (volume, configName, Recommended value) when details have a non-boolean recommended', () => {
            const data = {
                configurationName: 'oracle-unmapped-config',
                violationDetails: [{ objectName: 'vol-a', value: 'old-val', recommended: 'new-val' }]
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('databases.well-architect.volume-name')).toBeTruthy();
            expect(screen.getByText('oracle-unmapped-config')).toBeTruthy();
            expect(screen.getByText('Recommended value')).toBeTruthy();
            expect(screen.getByText('vol-a')).toBeTruthy();
            expect(screen.getByText('old-val')).toBeTruthy();
            expect(screen.getByText('new-val')).toBeTruthy();
        });

        it('renders 2-column table (volume, configName) when recommended is a boolean string', () => {
            const data = {
                configurationName: 'oracle-bool-rec-config',
                violationDetails: [{ objectName: 'vol-b', value: 'enabled', recommended: 'true' }]
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('databases.well-architect.volume-name')).toBeTruthy();
            expect(screen.getByText('oracle-bool-rec-config')).toBeTruthy();
            expect(screen.getByText('vol-b')).toBeTruthy();
            expect(screen.getByText('enabled')).toBeTruthy();
        });

        it('renders single-column from objectsInViolation when violationDetails is empty', () => {
            const data = {
                configurationName: 'oracle-obj-only-config',
                violationDetails: [],
                objectsInViolation: ['item-1', 'item-2']
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('item-1')).toBeTruthy();
            expect(screen.getByText('item-2')).toBeTruthy();
        });
    });

    // === overProvisionedDrives in sizing tables ===
    describe('overProvisionedDrives in log-drive-size', () => {
        it('renders over-provisioned status row for log drive', () => {
            const data = {
                configurationName: 'log-drive-size',
                sizingViolations: {
                    overProvisionedDrives: [
                        {
                            logAccessPath: 'E:\\',
                            lunPath: '/vol/log/lun1',
                            databases: ['logdb'],
                            sizePercentToDataDrive: 200
                        }
                    ],
                    underProvisionedDrives: [],
                    ignoredDrives: []
                }
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('E:\\')).toBeTruthy();
            expect(screen.getByText('/vol/log/lun1')).toBeTruthy();
            expect(screen.getByText('logdb')).toBeTruthy();
            expect(screen.getByText('databases.well-architect.over-provisioned')).toBeTruthy();
            expect(screen.getByText('200%')).toBeTruthy();
        });
    });

    // === FILE_LOCATION with databaseName from structured objectsInViolation ===
    describe('FILE_LOCATION with databaseName from structured objectsInViolation', () => {
        it('renders databaseName field from object items in objectsInViolation when no violationDetails', () => {
            const data = {
                configurationName: 'data-files-location',
                violationDetails: [],
                objectsInViolation: [{ databaseName: 'mydb', objectName: 'some-obj' }],
                current: 'vol-current',
                recommended: 'vol-recommended'
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('databases.well-architect.database-name')).toBeTruthy();
            expect(screen.getByText('mydb')).toBeTruthy();
        });
    });

    // === Multi-drive expandable grouping ===
    describe('data-files-location multi-drive grouping', () => {
        it('groups multiple drives for the same database and shows aggregated drive and lun-path counts', () => {
            const data = {
                configurationName: 'data-files-location',
                violationDetails: [
                    { value: 'testdb', additionalInfo: { driveLetter: 'D:', lunPath: '/vol/d/lun1' } },
                    { value: 'testdb', additionalInfo: { driveLetter: 'E:', lunPath: '/vol/e/lun1' } }
                ]
            };
            render(<ImpactedResourceDialog data={data as any} />);
            expect(screen.getByText('testdb')).toBeTruthy();
            expect(screen.getByText('2 databases.well-architect.drives')).toBeTruthy();
            expect(screen.getByText('2 databases.well-architect.lun-paths')).toBeTruthy();
        });
    });
});
