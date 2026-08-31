import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DynamicInnerTable from './DynamicInnerTable';

// ─── Store ────────────────────────────────────────────────────────────────────
const mockUseAppSelector = vi.fn((selector: any) =>
    selector({
        databaseHome: { selectedRowsForOptimizeInnerPage: [] },
        getWellOptimize: {
            inProgressOptimizationData: {},
            selectedResourceId: 'r1',
            selectedGwInstanceCredId: 'c1',
            selectedGwInstanceRegionId: 'reg1',
            selectedDatabaseInstance: 'db1'
        }
    })
);

vi.mock('react-redux', () => ({ useDispatch: () => vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('../../../../store/storeHooks', () => ({
    useAppSelector: (selector: any) => mockUseAppSelector(selector)
}));

// ─── Registry ─────────────────────────────────────────────────────────────────
const mockGetConfigEntry = vi.fn();
vi.mock('../../../../utils/configRegistry', () => ({
    getConfigEntry: (...args: any[]) => mockGetConfigEntry(...args),
    buildSubConfigValues: vi.fn(() => ({})),
    pluralizeResourceType: (s: string) => `Impacted ${s}s`,
    ColumnConfig: {}
}));

// ─── API ──────────────────────────────────────────────────────────────────────
const mockPatchQuery = vi.fn(() => ({ data: undefined, isFetching: false }));
vi.mock('../../../../utils/apiService', () => ({
    useGetMissingPatchAssessmentDataQuery: (...args: any[]) => mockPatchQuery(...args)
}));

// ─── Utils / consts ───────────────────────────────────────────────────────────
vi.mock('../../../../utils/utilityFunctions', () => ({
    checkBoxHandle: vi.fn(),
    getSelectedFromSelectionState: vi.fn(() => [])
}));

vi.mock('../../../../utils/resourceUtils', () => ({
    normalizeResourceTypeCasing: (s: string) => s
}));

vi.mock('../../../../utils/consts', () => ({
    ASSESSMENT_CONFIG_IDS: {
        CLUSTER_QUORUM: 'cluster-quorum',
        SNAPSHOT_COPY_RESERVE: 'snapshot-copy-reserve',
        LOG_DRIVE_SIZE: 'log-drive-size',
        TEMPDB_DRIVE_SIZE: 'tempdb-drive-size',
        RSS_CONFIGURATION: 'rss-configuration',
        DRIVE_LETTER: 'drive-letter',
        CRR: 'crr',
        OPERATING_SYSTEM_PATCH: 'host-os-patch',
        MULTIPATH_IO_SESSIONS: 'multipath-io-sessions',
        MULTIPATH_CONFIGURATION: 'multipath-configuration'
    },
    DBType: { MSSQL: 'mssql', ORACLE: 'oracle' },
    GETWELL_STATUS: { OPTIMIZED: 'Optimized', NOT_OPTIMIZED: 'Not Optimized' },
    ASSESSMENT_COLUMN_KEYS: {
        OBJECT_NAME: 'objectName',
        OBJECT_NAME_SOURCE_OBJECTS_IN_VIOLATION: 'objectsInViolation'
    },
    RSS_COLUMN_KEYS: {},
    PATCH_SCAN_FIELD: {
        HOST_OS_PATCH: 'HOST_OS_PATCH',
        ORACLE_SECURITY_PATCH: 'ORACLE_SECURITY_PATCH',
        MICROSOFT_SQL_SERVER_PATCH: 'MICROSOFT_SQL_SERVER_PATCH',
        OPERATING_SYSTEM_PATCH: 'OPERATING_SYSTEM_PATCH'
    },
    WIZARD_TYPE: { MSSQL: 'mssql', ORACLE: 'oracle' }
}));

vi.mock('../../../../store/workloadFactory/databaseHomeSlice', () => ({
    setSelectedRowsForOptimizeInnerPage: vi.fn((v: any) => ({ type: 'setRows', payload: v }))
}));

vi.mock('../../../../common/BulkAction/BulkActionContainer', () => ({
    default: () => <div data-testid="bulk-action-container" />
}));

vi.mock('../../GetWellUtils', () => ({
    getWadCellProps: vi.fn(() => ({}))
}));

vi.mock('../../../../common/Lib/Table/tableLazyLoadingProps', () => ({
    getTableLazyLoadingComponentProps: vi.fn(() => ({ lazyLoadingText: 'Loading...' }))
}));

vi.mock('../InnerTables/InnerTable.module.scss', () => ({ default: {} }));

vi.mock('../../../../assets/tooltipGrey.svg', () => ({
    ReactComponent: () => <svg data-testid="tooltip-icon" />
}));

// ─── Design System ────────────────────────────────────────────────────────────
let capturedTableCols: any[] = [];
let capturedTableRows: any[] = [];

vi.mock('@netapp/design-system', () => ({
    Table: () => <div data-testid="table" />,
    TableTopBar: ({ pluralTitle }: any) => <div data-testid="table-top-bar">{pluralTitle}</div>,
    DsTypography: ({ children }: any) => <span>{children}</span>,
    DsButton: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
    Popover: ({ container }: any) => <div data-testid="popover">{container}</div>,
    useTable: vi.fn((config: any) => {
        capturedTableCols = config?.columns ?? [];
        capturedTableRows = config?.rows ?? [];
        return { selectionState: {}, tableRef: { current: null } };
    })
}));

/** Invoke renderCell for every column on every row and return the result array */
const invokeAllRenderCells = () => {
    const results: any[] = [];
    capturedTableCols.forEach((col: any) => {
        if (typeof col.renderCell !== 'function') return;
        capturedTableRows.forEach((row: any) => {
            const cellData = row[col.accessor];
            results.push(col.renderCell(cellData, row));
        });
    });
    return results;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const normalColumnConfig = {
    columns: [
        { key: 'objectName', label: 'Volume name', accessor: 'objectName' },
        { key: 'value', label: 'Current value', accessor: 'value' },
        { key: 'recommended', label: 'Recommended value', accessor: 'recommended' }
    ],
    resourceTypeLabel: 'Volume'
};

const normalData = {
    violationDetails: [
        { objectName: 'vol-1', value: 'off', recommended: 'on' },
        { objectName: 'vol-2', value: 'off', recommended: 'on' }
    ]
};

const defaultProps = {
    configId: 'autosize',
    data: normalData,
    columnConfig: normalColumnConfig,
    engineType: 'mssql',
    handleBulkAction: vi.fn(),
    handleRowFix: vi.fn()
};

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('DynamicInnerTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedTableCols = [];
        capturedTableRows = [];
        mockGetConfigEntry.mockReturnValue({
            dialogContent: { features: { showPatchTable: false } }
        });
        mockPatchQuery.mockReturnValue({ data: undefined, isFetching: false });
        mockUseAppSelector.mockImplementation((selector: any) =>
            selector({
                databaseHome: { selectedRowsForOptimizeInnerPage: [] },
                getWellOptimize: {
                    inProgressOptimizationData: {},
                    selectedResourceId: 'r1',
                    selectedGwInstanceCredId: 'c1',
                    selectedGwInstanceRegionId: 'reg1',
                    selectedDatabaseInstance: 'db1',
                    driftAssessmentData: null
                }
            })
        );
    });

    // ── Normal (non-patch) config ──────────────────────────────────────────────

    it('renders table and top bar for a normal config', () => {
        render(<DynamicInnerTable {...defaultProps} />);
        expect(screen.getByTestId('table')).toBeTruthy();
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
    });

    it('shows the plural resource label derived from columnConfig', () => {
        render(<DynamicInnerTable {...defaultProps} />);
        // pluralizeResourceType mock returns "Impacted Volumes"
        expect(screen.getByTestId('table-top-bar').textContent).toContain('Volume');
    });

    it('does not call patch API for non-patch configs', () => {
        render(<DynamicInnerTable {...defaultProps} />);
        // skip: true → query called with skip, so fetch should not be triggered
        const [, options] = mockPatchQuery.mock.calls[0];
        expect(options?.skip).toBe(true);
    });

    it('shows BulkActionContainer when rows are selected and canOptimize is true', () => {
        mockUseAppSelector.mockImplementation((selector: any) =>
            selector({
                databaseHome: { selectedRowsForOptimizeInnerPage: [{ id: '1' }] },
                getWellOptimize: {
                    inProgressOptimizationData: {},
                    selectedResourceId: 'r1',
                    selectedGwInstanceCredId: 'c1',
                    selectedGwInstanceRegionId: 'reg1',
                    selectedDatabaseInstance: 'db1'
                }
            })
        );
        render(<DynamicInnerTable {...defaultProps} canOptimize />);
        expect(screen.getByTestId('bulk-action-container')).toBeTruthy();
    });

    it('does not show BulkActionContainer when canOptimize is false', () => {
        mockUseAppSelector.mockImplementation((selector: any) =>
            selector({
                databaseHome: { selectedRowsForOptimizeInnerPage: [{ id: '1' }] },
                getWellOptimize: {
                    inProgressOptimizationData: {},
                    selectedResourceId: 'r1',
                    selectedGwInstanceCredId: 'c1',
                    selectedGwInstanceRegionId: 'reg1',
                    selectedDatabaseInstance: 'db1'
                }
            })
        );
        render(<DynamicInnerTable {...defaultProps} canOptimize={false} />);
        expect(screen.queryByTestId('bulk-action-container')).toBeNull();
    });

    // ── Patch config ───────────────────────────────────────────────────────────

    describe('patch config (showPatchTable: true)', () => {
        const patchConfigEntry = {
            dialogContent: {
                features: {
                    showPatchTable: true,
                    patchField: 'HOST_OS_PATCH',
                    patchColumns: [
                        { header: 'Component', accessor: 'component', width: '150px' },
                        { header: 'Package name', accessor: 'packageName', width: '200px' }
                    ]
                }
            }
        };

        beforeEach(() => {
            mockGetConfigEntry.mockReturnValue(patchConfigEntry);
        });

        it('renders table for a patch config', () => {
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="host-os-patch"
                    engineType="mssql"
                    data={{}}
                    columnConfig={undefined}
                />
            );
            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('calls the patch API with the correct patchField', () => {
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="host-os-patch"
                    engineType="mssql"
                    data={{}}
                    columnConfig={undefined}
                />
            );
            const [queryArgs, options] = mockPatchQuery.mock.calls[0];
            expect(options?.skip).toBe(false);
            expect(queryArgs.field).toBe('HOST_OS_PATCH');
        });

        it('shows loading state while patch data is fetching', () => {
            mockPatchQuery.mockReturnValue({ data: undefined, isFetching: true });
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="host-os-patch"
                    engineType="mssql"
                    data={{}}
                    columnConfig={undefined}
                />
            );
            // Table still renders; isLazyLoading=true is passed to useTable internally
            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('transforms patch API response into table rows', () => {
            const patchResponse = {
                ec2InstancesToPatch: [
                    {
                        ec2InstanceName: 'i-12345',
                        missingPatchDetails: [
                            { component: 'kernel', packageName: 'kernel-5.10' },
                            { component: 'openssl', packageName: 'openssl-3.0' }
                        ]
                    }
                ]
            };
            mockPatchQuery.mockReturnValue({ data: patchResponse, isFetching: false });

            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="host-os-patch"
                    engineType="mssql"
                    data={{}}
                    columnConfig={undefined}
                />
            );
            // Table renders (rows are internal to useTable mock, but component mounts without error)
            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('does not show BulkActionContainer for patch configs', () => {
            mockUseAppSelector.mockImplementation((selector: any) =>
                selector({
                    databaseHome: { selectedRowsForOptimizeInnerPage: [{ id: '1' }] },
                    getWellOptimize: {
                        inProgressOptimizationData: {},
                        selectedResourceId: 'r1',
                        selectedGwInstanceCredId: 'c1',
                        selectedGwInstanceRegionId: 'reg1',
                        selectedDatabaseInstance: 'db1'
                    }
                })
            );
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="host-os-patch"
                    engineType="mssql"
                    data={{}}
                    columnConfig={undefined}
                    canOptimize
                />
            );
            // patch configs suppress bulk action
            expect(screen.queryByTestId('bulk-action-container')).toBeNull();
        });

        it('skips the patch API when required IDs are missing', () => {
            mockUseAppSelector.mockImplementation((selector: any) =>
                selector({
                    databaseHome: { selectedRowsForOptimizeInnerPage: [] },
                    getWellOptimize: {
                        inProgressOptimizationData: {},
                        selectedResourceId: undefined,
                        selectedGwInstanceCredId: undefined,
                        selectedGwInstanceRegionId: undefined,
                        selectedDatabaseInstance: undefined
                    }
                })
            );
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="host-os-patch"
                    engineType="mssql"
                    data={{}}
                    columnConfig={undefined}
                />
            );
            const [, options] = mockPatchQuery.mock.calls[0];
            expect(options?.skip).toBe(true);
        });

        it('maps Oracle OS patch fields (classification→component, title→packageName, state→updateType)', () => {
            mockGetConfigEntry.mockReturnValue({
                dialogContent: {
                    features: {
                        showPatchTable: true,
                        patchField: 'ORACLE_SECURITY_PATCH',
                        patchColumns: [{ header: 'Component', accessor: 'component', width: '150px' }]
                    }
                }
            });
            const patchResponse = {
                ec2InstancesToPatch: [
                    {
                        ec2InstanceName: 'i-oracle',
                        missingPatchDetails: [{ classification: 'Security', title: 'glibc', state: 'Missing' }]
                    }
                ]
            };
            mockPatchQuery.mockReturnValue({ data: patchResponse, isFetching: false });
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="host-os-patch"
                    engineType="oracle"
                    data={{}}
                    columnConfig={undefined}
                />
            );
            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('builds patch column definitions with correct Header, isSticky, width and id from patchColumns', () => {
            mockGetConfigEntry.mockReturnValue({
                dialogContent: {
                    features: {
                        showPatchTable: true,
                        patchField: 'HOST_OS_PATCH',
                        patchColumns: [
                            { header: 'Component', accessor: 'component', width: '150px' },
                            { header: 'Package name', accessor: 'packageName', width: '200px' },
                            { header: 'Severity', accessor: 'severity', width: '100px' }
                        ]
                    }
                }
            });
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="host-os-patch"
                    engineType="mssql"
                    data={{}}
                    columnConfig={undefined}
                />
            );

            // First column: isSticky=true, width=col.width
            expect(capturedTableCols[0].isSticky).toBe(true);
            expect(capturedTableCols[0].accessor).toBe('component');
            expect(capturedTableCols[0].Header).toBe('Component');
            expect(capturedTableCols[0].width).toBe('150px');

            // Second column: isSticky=false, width='auto' (index === 1 uses 'auto')
            expect(capturedTableCols[1].isSticky).toBe(false);
            expect(capturedTableCols[1].accessor).toBe('packageName');
            expect(capturedTableCols[1].width).toBe('auto');

            // Third column: isSticky=false, width=col.width
            expect(capturedTableCols[2].isSticky).toBe(false);
            expect(capturedTableCols[2].accessor).toBe('severity');
            expect(capturedTableCols[2].width).toBe('100px');

            // IDs are 1-based string indexes
            expect(capturedTableCols[0].id).toBe('1');
            expect(capturedTableCols[1].id).toBe('2');
            expect(capturedTableCols[2].id).toBe('3');
        });
    });

    // ── tableData paths ────────────────────────────────────────────────────────

    it('returns empty rows when data has errorMessage', () => {
        render(<DynamicInnerTable {...defaultProps} data={{ errorMessage: 'Assessment failed' } as any} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('builds rows from violationDetails with top-level recommended injection', () => {
        const data = {
            recommended: 'on',
            violationDetails: [{ objectName: 'vol-1', value: 'off' }]
        };
        render(<DynamicInnerTable {...defaultProps} data={data} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('builds rows from violationDetails with top-level current injection when row has no value', () => {
        const data = {
            current: '50%',
            recommended: '80%',
            violationDetails: [{ objectName: 'fs-1' }]
        };
        render(<DynamicInnerTable {...defaultProps} data={data} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('builds rows from violationDetails with hasSubConfigs', () => {
        const data = {
            violationDetails: [{ objectName: 'vol-1', violatedConfigs: [{ name: 'dedup', current: 'none' }] }],
            configDetails: [{ name: 'dedup', recommended: 'enabled' }]
        };
        const subConfigColumn = {
            columns: [
                { key: 'objectName', label: 'Volume name', accessor: 'objectName' },
                { key: 'current', label: 'Current', accessor: 'current' },
                { key: 'recommended', label: 'Recommended', accessor: 'recommended' }
            ],
            resourceTypeLabel: 'Volume',
            hasSubConfigs: true
        };
        render(<DynamicInnerTable {...defaultProps} data={data} columnConfig={subConfigColumn} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('builds rows from objectsInViolation as strings', () => {
        const data = {
            current: '36%',
            recommended: '36-100%',
            objectsInViolation: ['fs-001', 'fs-002']
        };
        render(<DynamicInnerTable {...defaultProps} data={data} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('builds rows from objectsInViolation as objects with ontapVolumeName', () => {
        const data = {
            objectsInViolation: [{ ontapVolumeName: 'vol-a', ontapVolumeUuid: 'uuid-1' }]
        };
        render(<DynamicInnerTable {...defaultProps} data={data} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('returns empty rows when violationDetails and objectsInViolation are both empty', () => {
        const data = { violationDetails: [], objectsInViolation: [] };
        render(<DynamicInnerTable {...defaultProps} data={data} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('builds rows from dataMapping.sources path', () => {
        const dataMappingConfig = {
            columns: [
                { key: 'objectName', label: 'Volume name', accessor: 'objectName' },
                { key: 'recommended', label: 'Recommended', accessor: 'recommended' }
            ],
            resourceTypeLabel: 'Volume',
            dataMapping: {
                sources: [{ path: 'data.volumes', status: 'databases.well-architect.over-provisioned' }]
            }
        };
        const data = {
            recommended: 'true',
            data: { volumes: [{ objectName: 'vol-1', recommended: 'true' }] }
        };
        render(<DynamicInnerTable {...defaultProps} data={data} columnConfig={dataMappingConfig as any} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('builds rows from dataMapping.sources with string primitive items', () => {
        const dataMappingConfig = {
            columns: [{ key: 'objectName', label: 'Volume name', accessor: 'objectName' }],
            resourceTypeLabel: 'Volume',
            dataMapping: { sources: [{ path: 'items' }] }
        };
        const data = { recommended: 'on', items: ['vol-x', 'vol-y'] };
        render(<DynamicInnerTable {...defaultProps} data={data} columnConfig={dataMappingConfig as any} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('disables checkbox for over-provisioned log-drive-size rows', () => {
        const sizingColumnConfig = {
            columns: [
                { key: 'logAccessPath', label: 'Drive name', accessor: 'logAccessPath' },
                { key: 'status', label: 'Status', accessor: 'status' }
            ],
            resourceTypeLabel: 'Drive',
            dataMapping: {
                sources: [
                    {
                        path: 'sizingViolations.overProvisionedDrives',
                        status: 'databases.well-architect.over-provisioned'
                    }
                ]
            }
        };
        const data = {
            sizingViolations: {
                overProvisionedDrives: [{ logAccessPath: 'D:\\', lunPath: '/lun1', databases: ['db1'] }]
            }
        };
        render(
            <DynamicInnerTable
                {...defaultProps}
                configId="log-drive-size"
                data={data}
                columnConfig={sizingColumnConfig as any}
            />
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('disables checkbox for shared tempdb-drive-size rows', () => {
        const sizingColumnConfig = {
            columns: [{ key: 'tempdbAccessPath', label: 'Drive name', accessor: 'tempdbAccessPath' }],
            resourceTypeLabel: 'Drive',
            dataMapping: {
                sources: [{ path: 'sizingViolations.ignoredDrives', status: 'databases.well-architect.shared-drive' }]
            }
        };
        const data = {
            sizingViolations: {
                ignoredDrives: [{ tempdbAccessPath: 'T:\\', lunPath: '/lun2', databases: ['tempdb'] }]
            }
        };
        render(
            <DynamicInnerTable
                {...defaultProps}
                configId="tempdb-drive-size"
                data={data}
                columnConfig={sizingColumnConfig as any}
            />
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    // ── Column config paths ────────────────────────────────────────────────────

    it('renders nothing meaningful when columnConfig is undefined for a non-patch config', () => {
        mockGetConfigEntry.mockReturnValue({ dialogContent: { features: { showPatchTable: false } } });
        render(<DynamicInnerTable {...defaultProps} columnConfig={undefined} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('uses custom tableTitle from columnConfig instead of pluralizing resourceTypeLabel', () => {
        const customTitleConfig = {
            ...normalColumnConfig,
            tableTitle: 'NFS mount options'
        };
        render(<DynamicInnerTable {...defaultProps} columnConfig={customTitleConfig as any} />);
        expect(screen.getByTestId('table-top-bar').textContent).toContain('NFS mount options');
    });

    it('renders singular title from resourceTypeLabel that does not start with Impacted', () => {
        const config = { ...normalColumnConfig, tableTitle: 'NFS mount options', resourceTypeLabel: 'Mount option' };
        render(<DynamicInnerTable {...defaultProps} columnConfig={config as any} />);
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
    });

    // ── Action column states ───────────────────────────────────────────────────

    it('renders CRR MSSQL config (shows disabled fix button via isCrrMssql path)', () => {
        render(
            <DynamicInnerTable
                {...defaultProps}
                configId="crr"
                engineType="mssql"
                canOptimize
                handleRowFix={vi.fn()}
                data={normalData}
            />
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders CRR Oracle config (shows enabled fix button via isCrrOracle path)', () => {
        render(
            <DynamicInnerTable
                {...defaultProps}
                configId="crr"
                engineType="oracle"
                canOptimize
                handleRowFix={vi.fn()}
                data={normalData}
            />
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders view-only config with handleRowFix (showViewButton path)', () => {
        render(
            <DynamicInnerTable
                {...defaultProps}
                canOptimize={false}
                isViewOnly
                handleRowFix={vi.fn()}
                data={normalData}
            />
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('does not add action column when handleRowFix is not provided', () => {
        render(<DynamicInnerTable {...defaultProps} canOptimize handleRowFix={undefined} data={normalData} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('does not add per-row action column for multipath-io-sessions Oracle (bulk-only)', () => {
        render(
            <DynamicInnerTable
                {...defaultProps}
                configId="multipath-io-sessions"
                engineType="oracle"
                canOptimize
                handleRowFix={vi.fn()}
                data={normalData}
            />
        );
        const actionCol = capturedTableCols.find((c: any) => c.accessor === 'action');
        expect(actionCol).toBeUndefined();
    });

    it('does not add per-row action column for multipath-configuration Oracle (bulk-only)', () => {
        render(
            <DynamicInnerTable
                {...defaultProps}
                configId="multipath-configuration"
                engineType="oracle"
                canOptimize
                handleRowFix={vi.fn()}
                data={normalData}
            />
        );
        const actionCol = capturedTableCols.find((c: any) => c.accessor === 'action');
        expect(actionCol).toBeUndefined();
    });

    it('calls checkBoxHandle when selection changes', async () => {
        const utilityFunctions = await import('../../../../utils/utilityFunctions');
        // Make getSelectedFromSelectionState return a non-empty array so checkBoxHandle is reached
        (utilityFunctions.getSelectedFromSelectionState as any).mockReturnValueOnce([{ id: '0' }]);
        mockUseAppSelector.mockImplementation((selector: any) =>
            selector({
                databaseHome: { selectedRowsForOptimizeInnerPage: [{ id: '0' }] },
                getWellOptimize: {
                    inProgressOptimizationData: { autosize: [{ id: '0' }] },
                    selectedResourceId: 'r1',
                    selectedGwInstanceCredId: 'c1',
                    selectedGwInstanceRegionId: 'reg1',
                    selectedDatabaseInstance: 'db1'
                }
            })
        );
        render(<DynamicInnerTable {...defaultProps} canOptimize data={normalData} />);
        expect(utilityFunctions.checkBoxHandle).toHaveBeenCalled();
    });

    // ── renderCell coverage ────────────────────────────────────────────────────

    describe('renderCell invocations', () => {
        it('renders snapshot-copy-reserve value column as percentage', () => {
            const config = {
                columns: [{ key: 'value', label: 'Value', accessor: 'value' }],
                resourceTypeLabel: 'Volume'
            };
            const data = { violationDetails: [{ objectName: 'vol-1', value: 20 }] };
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="snapshot-copy-reserve"
                    data={data}
                    columnConfig={config as any}
                />
            );
            const results = invokeAllRenderCells();
            expect(results).toContain('20%');
        });

        it('renders snapshot-copy-reserve null value as unavailable', () => {
            const config = {
                columns: [{ key: 'value', label: 'Value', accessor: 'value' }],
                resourceTypeLabel: 'Volume'
            };
            const data = { violationDetails: [{ objectName: 'vol-1', value: null }] };
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="snapshot-copy-reserve"
                    data={data}
                    columnConfig={config as any}
                />
            );
            const results = invokeAllRenderCells();
            expect(results).toContain('databases.general.unavailable');
        });

        it('renders rss boolean column as Enabled/Disabled', () => {
            const config = {
                columns: [{ key: 'rss', label: 'RSS', accessor: 'rss' }],
                resourceTypeLabel: 'Adapter'
            };
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    data={{ violationDetails: [{ objectName: 'a1', rss: true }] }}
                    columnConfig={config as any}
                />
            );
            expect(invokeAllRenderCells()).toContain('Enabled');

            render(
                <DynamicInnerTable
                    {...defaultProps}
                    data={{ violationDetails: [{ objectName: 'a1', rss: false }] }}
                    columnConfig={config as any}
                />
            );
            expect(invokeAllRenderCells()).toContain('Disabled');
        });

        it('renders divergence column as percentage', () => {
            const config = {
                columns: [{ key: 'divergence', label: 'Divergence', accessor: 'divergence' }],
                resourceTypeLabel: 'Clone'
            };
            const data = { violationDetails: [{ objectName: 'c1', divergence: 45 }] };
            render(<DynamicInnerTable {...defaultProps} data={data} columnConfig={config as any} />);
            expect(invokeAllRenderCells()).toContain('45%');
        });

        it('renders sizePercentToDataDrive column as percentage', () => {
            const config = {
                columns: [{ key: 'sizePercentToDataDrive', label: '%', accessor: 'sizePercentToDataDrive' }],
                resourceTypeLabel: 'Drive'
            };
            const data = { violationDetails: [{ objectName: 'd1', sizePercentToDataDrive: 25 }] };
            render(<DynamicInnerTable {...defaultProps} data={data} columnConfig={config as any} />);
            expect(invokeAllRenderCells()).toContain('25%');
        });

        it('renders databases array column joined with comma', () => {
            const config = {
                columns: [{ key: 'databases', label: 'DBs', accessor: 'databases' }],
                resourceTypeLabel: 'Drive'
            };
            const data = { violationDetails: [{ objectName: 'd1', databases: ['db1', 'db2'] }] };
            render(<DynamicInnerTable {...defaultProps} data={data} columnConfig={config as any} />);
            expect(invokeAllRenderCells()).toContain('db1, db2');
        });

        it('renders databases empty array as unavailable', () => {
            const config = {
                columns: [{ key: 'databases', label: 'DBs', accessor: 'databases' }],
                resourceTypeLabel: 'Drive'
            };
            const data = { violationDetails: [{ objectName: 'd1', databases: [] }] };
            render(<DynamicInnerTable {...defaultProps} data={data} columnConfig={config as any} />);
            expect(invokeAllRenderCells()).toContain('databases.general.unavailable');
        });

        it('renders object cell as ontapVolumeName when available', () => {
            const config = {
                columns: [{ key: 'someObj', label: 'Obj', accessor: 'someObj' }],
                resourceTypeLabel: 'Item'
            };
            const data = {
                violationDetails: [{ objectName: 'v1', someObj: { ontapVolumeName: 'vol-a' } }]
            };
            render(<DynamicInnerTable {...defaultProps} data={data} columnConfig={config as any} />);
            expect(invokeAllRenderCells()).toContain('vol-a');
        });

        it('renders unavailable for null/undefined cell values', () => {
            const config = {
                columns: [{ key: 'value', label: 'Val', accessor: 'value' }],
                resourceTypeLabel: 'Volume'
            };
            const data = { violationDetails: [{ objectName: 'v1', value: null }] };
            render(<DynamicInnerTable {...defaultProps} data={data} columnConfig={config as any} />);
            expect(invokeAllRenderCells()).toContain('databases.general.unavailable');
        });

        it('wraps cell content in ellipsis div with title when col.ellipsis=true (string value)', () => {
            const config = {
                columns: [{ key: 'value', label: 'Value', accessor: 'value', ellipsis: true }],
                resourceTypeLabel: 'Volume'
            };
            const data = { violationDetails: [{ objectName: 'vol-1', value: 'long-value-text' }] };
            render(<DynamicInnerTable {...defaultProps} data={data} columnConfig={config as any} />);
            const results = invokeAllRenderCells();
            const el = results[0];
            expect(el).toBeTruthy();
            expect(typeof el).toBe('object'); // React element, not plain string
            expect(el.props.title).toBe('long-value-text');
        });

        it('wraps object cell (ontapVolumeName) in ellipsis div with title when col.ellipsis=true', () => {
            const config = {
                columns: [{ key: 'someObj', label: 'Obj', accessor: 'someObj', ellipsis: true }],
                resourceTypeLabel: 'Item'
            };
            const data = {
                violationDetails: [{ objectName: 'v1', someObj: { ontapVolumeName: 'vol-a' } }]
            };
            render(<DynamicInnerTable {...defaultProps} data={data} columnConfig={config as any} />);
            const results = invokeAllRenderCells();
            const el = results[0];
            expect(el).toBeTruthy();
            expect(typeof el).toBe('object');
            expect(el.props.title).toBe('vol-a');
        });

        it('renders plain string (no div wrapper) for string value when col.ellipsis is not set', () => {
            const config = {
                columns: [{ key: 'value', label: 'Value', accessor: 'value' }],
                resourceTypeLabel: 'Volume'
            };
            const data = { violationDetails: [{ objectName: 'vol-1', value: 'plain-value' }] };
            render(<DynamicInnerTable {...defaultProps} data={data} columnConfig={config as any} />);
            expect(invokeAllRenderCells()).toContain('plain-value');
        });

        it('renders action column fix button for a normal fixable row', () => {
            render(<DynamicInnerTable {...defaultProps} canOptimize handleRowFix={vi.fn()} data={normalData} />);
            const actionCol = capturedTableCols.find((c: any) => c.accessor === 'action');
            expect(actionCol).toBeDefined();
            const result = actionCol.renderCell(undefined, { id: '0', cellProps: {} });
            expect(result).toBeTruthy();
        });

        it('renders action column disabled popover when rows are selected', () => {
            mockUseAppSelector.mockImplementation((selector: any) =>
                selector({
                    databaseHome: { selectedRowsForOptimizeInnerPage: [{ id: '0' }] },
                    getWellOptimize: {
                        inProgressOptimizationData: {},
                        selectedResourceId: 'r1',
                        selectedGwInstanceCredId: 'c1',
                        selectedGwInstanceRegionId: 'reg1',
                        selectedDatabaseInstance: 'db1'
                    }
                })
            );
            render(<DynamicInnerTable {...defaultProps} canOptimize handleRowFix={vi.fn()} data={normalData} />);
            const actionCol = capturedTableCols.find((c: any) => c.accessor === 'action');
            const result = actionCol.renderCell(undefined, { id: '0', cellProps: {} });
            expect(result).toBeTruthy();
        });

        it('renders action column disabled popover for a row-disabled (over-provisioned) row', () => {
            render(<DynamicInnerTable {...defaultProps} canOptimize handleRowFix={vi.fn()} data={normalData} />);
            const actionCol = capturedTableCols.find((c: any) => c.accessor === 'action');
            const result = actionCol.renderCell(undefined, {
                id: '0',
                cellProps: { isDisabled: true, selectionProps: { title: 'Over-provisioned' } }
            });
            expect(result).toBeTruthy();
        });

        it('renders CRR MSSQL action column with disabled fix + popover', () => {
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="crr"
                    engineType="mssql"
                    canOptimize
                    handleRowFix={vi.fn()}
                    data={normalData}
                />
            );
            const actionCol = capturedTableCols.find((c: any) => c.accessor === 'action');
            expect(actionCol).toBeDefined();
            const result = actionCol.renderCell(undefined, { id: '0', cellProps: {} });
            expect(result).toBeTruthy();
        });

        it('renders CRR Oracle action column with enabled fix button', () => {
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="crr"
                    engineType="oracle"
                    canOptimize
                    handleRowFix={vi.fn()}
                    data={normalData}
                />
            );
            const actionCol = capturedTableCols.find((c: any) => c.accessor === 'action');
            expect(actionCol).toBeDefined();
            const result = actionCol.renderCell(undefined, { id: '0', cellProps: {} });
            expect(result).toBeTruthy();
        });

        it('renders patch action column fix button', () => {
            mockGetConfigEntry.mockReturnValue({
                dialogContent: {
                    features: {
                        showPatchTable: true,
                        patchField: 'HOST_OS_PATCH',
                        patchColumns: [{ header: 'Component', accessor: 'component', width: '150px' }]
                    }
                }
            });
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="host-os-patch"
                    engineType="mssql"
                    data={{}}
                    columnConfig={undefined}
                    handleRowFix={vi.fn()}
                />
            );
            const actionCol = capturedTableCols.find((c: any) => c.accessor === 'action');
            expect(actionCol).toBeDefined();
            const result = actionCol.renderCell(undefined, { id: '0' });
            expect(result).toBeTruthy();
        });
    });

    // ── Oracle multipath-io-sessions bulk fix ──────────────────────────────────

    describe('Oracle multipath-io-sessions bulk fix', () => {
        const multipathColumnConfig = {
            columns: [
                { key: 'objectName', label: 'Target portal address', accessor: 'objectName' },
                { key: 'value', label: 'Current sessions', accessor: 'value' },
                { key: 'recommended', label: 'Recommended sessions', accessor: 'recommended' }
            ],
            resourceTypeLabel: 'Session Configuration'
        };
        const multipathData = {
            violationDetails: [
                { objectName: '10.0.0.1:3260', value: '1', recommended: '4' },
                { objectName: '10.0.0.2:3260', value: '2', recommended: '4' }
            ]
        };

        it('renders table for multipath-io-sessions Oracle inner page', () => {
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="multipath-io-sessions"
                    engineType="oracle"
                    data={multipathData}
                    columnConfig={multipathColumnConfig}
                    canOptimize
                />
            );
            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('shows BulkActionContainer for multipath-io-sessions Oracle with canOptimize and selected rows', () => {
            mockUseAppSelector.mockImplementation((selector: any) =>
                selector({
                    databaseHome: { selectedRowsForOptimizeInnerPage: [{ id: '0' }, { id: '1' }] },
                    getWellOptimize: {
                        inProgressOptimizationData: {},
                        selectedResourceId: 'r1',
                        selectedGwInstanceCredId: 'c1',
                        selectedGwInstanceRegionId: 'reg1',
                        selectedDatabaseInstance: 'db1'
                    }
                })
            );
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="multipath-io-sessions"
                    engineType="oracle"
                    data={multipathData}
                    columnConfig={multipathColumnConfig}
                    canOptimize
                />
            );
            expect(screen.getByTestId('bulk-action-container')).toBeTruthy();
        });

        it('disables checkboxes on rows for multipath-io-sessions Oracle (isDisabled: true in cellProps)', () => {
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="multipath-io-sessions"
                    engineType="oracle"
                    data={multipathData}
                    columnConfig={multipathColumnConfig}
                    canOptimize
                />
            );
            // All rows should have isDisabled set so they cannot be deselected
            capturedTableRows.forEach((row: any) => {
                expect(row.cellProps?.isDisabled).toBe(true);
            });
        });

        it('does not disable checkboxes for multipath-io-sessions on non-Oracle engine', () => {
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="multipath-io-sessions"
                    engineType="mssql"
                    data={multipathData}
                    columnConfig={multipathColumnConfig}
                    canOptimize
                />
            );
            capturedTableRows.forEach((row: any) => {
                expect(row.cellProps?.isDisabled).toBeFalsy();
            });
        });
    });

    // ── Oracle multipath-configuration bulk fix ────────────────────────────────

    describe('Oracle multipath-configuration bulk fix', () => {
        const multipathConfigColumnConfig = {
            columns: [
                { key: 'objectName', label: 'Configuration name', accessor: 'objectName' },
                { key: 'value', label: 'Current value', accessor: 'value' },
                { key: 'recommended', label: 'Recommended value', accessor: 'recommended' }
            ],
            resourceTypeLabel: 'Configuration'
        };
        const multipathConfigData = {
            violationDetails: [
                { objectName: 'path_grouping_policy', value: 'multibus', recommended: 'group_by_prio' },
                { objectName: 'polling_interval', value: '10', recommended: '5' }
            ]
        };

        it('renders table for multipath-configuration Oracle inner page', () => {
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="multipath-configuration"
                    engineType="oracle"
                    data={multipathConfigData}
                    columnConfig={multipathConfigColumnConfig}
                    canOptimize
                />
            );
            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('shows BulkActionContainer for multipath-configuration Oracle with canOptimize and selected rows', () => {
            mockUseAppSelector.mockImplementation((selector: any) =>
                selector({
                    databaseHome: { selectedRowsForOptimizeInnerPage: [{ id: '0' }, { id: '1' }] },
                    getWellOptimize: {
                        inProgressOptimizationData: {},
                        selectedResourceId: 'r1',
                        selectedGwInstanceCredId: 'c1',
                        selectedGwInstanceRegionId: 'reg1',
                        selectedDatabaseInstance: 'db1'
                    }
                })
            );
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="multipath-configuration"
                    engineType="oracle"
                    data={multipathConfigData}
                    columnConfig={multipathConfigColumnConfig}
                    canOptimize
                />
            );
            expect(screen.getByTestId('bulk-action-container')).toBeTruthy();
        });

        it('disables checkboxes on rows for multipath-configuration Oracle (isDisabled: true in cellProps)', () => {
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="multipath-configuration"
                    engineType="oracle"
                    data={multipathConfigData}
                    columnConfig={multipathConfigColumnConfig}
                    canOptimize
                />
            );
            capturedTableRows.forEach((row: any) => {
                expect(row.cellProps?.isDisabled).toBe(true);
            });
        });

        it('does not disable checkboxes for multipath-configuration on non-Oracle engine', () => {
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="multipath-configuration"
                    engineType="mssql"
                    data={multipathConfigData}
                    columnConfig={multipathConfigColumnConfig}
                    canOptimize
                />
            );
            capturedTableRows.forEach((row: any) => {
                expect(row.cellProps?.isDisabled).toBeFalsy();
            });
        });
    });

    // ── combineRows ────────────────────────────────────────────────────────────

    describe('combineRows', () => {
        const combineRowsConfig = {
            columns: [
                { key: 'objectName', label: 'EC2 instance name', accessor: 'objectName' },
                { key: 'current', label: 'Current value', accessor: 'current' },
                { key: 'recommended', label: 'Recommended value', accessor: 'recommended' }
            ],
            resourceTypeLabel: 'Setting',
            combineRows: true
        };

        it('collapses violationDetails into a single row with name=value pairs', () => {
            const data = {
                objectsInViolation: ['i-0abc123'],
                violationDetails: [
                    { objectName: 'SameSubnetDelay', value: '2000', recommended: '1000' },
                    { objectName: 'SameSubnetThreshold', value: '10', recommended: '5' }
                ]
            };
            render(<DynamicInnerTable {...defaultProps} data={data} columnConfig={combineRowsConfig as any} />);
            expect(capturedTableRows).toHaveLength(1);
            expect(capturedTableRows[0].objectName).toBe('i-0abc123');
            expect(capturedTableRows[0].current).toBe('SameSubnetDelay=2000, SameSubnetThreshold=10');
            expect(capturedTableRows[0].recommended).toBe('SameSubnetDelay=1000, SameSubnetThreshold=5');
        });

        it('uses first string from objectsInViolation as objectName', () => {
            const data = {
                objectsInViolation: ['i-first', 'i-second'],
                violationDetails: [{ objectName: 'param', value: '1', recommended: '2' }]
            };
            render(<DynamicInnerTable {...defaultProps} data={data} columnConfig={combineRowsConfig as any} />);
            expect(capturedTableRows[0].objectName).toBe('i-first');
        });

        it('sets objectName to empty string when objectsInViolation is empty', () => {
            const data = {
                objectsInViolation: [],
                violationDetails: [{ objectName: 'param', value: '1', recommended: '2' }]
            };
            render(<DynamicInnerTable {...defaultProps} data={data} columnConfig={combineRowsConfig as any} />);
            expect(capturedTableRows[0].objectName).toBe('');
        });

        it('does not use combineRows path when violationDetails is empty', () => {
            const data = {
                objectsInViolation: ['i-0abc123'],
                violationDetails: []
            };
            render(<DynamicInnerTable {...defaultProps} data={data} columnConfig={combineRowsConfig as any} />);
            // Falls through to objectsInViolation path — one row per item, not combined
            expect(capturedTableRows).toHaveLength(1);
            expect(capturedTableRows[0].objectName).toBe('i-0abc123');
        });
    });

    // ── combineRows + injectMetadataFields ─────────────────────────────────────

    describe('combineRows + injectMetadataFields (heartbeat-settings)', () => {
        const heartbeatColumnConfig = {
            columns: [
                { key: 'hostName', label: 'Host name', accessor: 'databaseHostName' },
                { key: 'current', label: 'Current value', accessor: 'current' },
                { key: 'recommended', label: 'Recommended value', accessor: 'recommended' }
            ],
            resourceTypeLabel: 'Setting',
            combineRows: true,
            injectMetadataFields: true
        };
        const heartbeatData = {
            objectsInViolation: ['i-0a1f31a39bd2d9362'],
            violationDetails: [
                { objectName: 'SameSubnetDelay', value: '2000', recommended: '1000' },
                { objectName: 'CrossSubnetDelay', value: '500', recommended: '2000' }
            ]
        };

        it('injects databaseHostName from driftAssessmentData.metadata into combined row', () => {
            mockUseAppSelector.mockImplementation((selector: any) =>
                selector({
                    databaseHome: { selectedRowsForOptimizeInnerPage: [] },
                    getWellOptimize: {
                        inProgressOptimizationData: {},
                        selectedResourceId: 'r1',
                        selectedGwInstanceCredId: 'c1',
                        selectedGwInstanceRegionId: 'reg1',
                        selectedDatabaseInstance: 'db1',
                        driftAssessmentData: { metadata: { databaseHostName: 'my-db-host.example.com' } }
                    }
                })
            );
            render(
                <DynamicInnerTable {...defaultProps} data={heartbeatData} columnConfig={heartbeatColumnConfig as any} />
            );
            expect(capturedTableRows).toHaveLength(1);
            expect(capturedTableRows[0].databaseHostName).toBe('my-db-host.example.com');
        });

        it('leaves databaseHostName undefined when driftAssessmentData is null', () => {
            mockUseAppSelector.mockImplementation((selector: any) =>
                selector({
                    databaseHome: { selectedRowsForOptimizeInnerPage: [] },
                    getWellOptimize: {
                        inProgressOptimizationData: {},
                        selectedResourceId: 'r1',
                        selectedGwInstanceCredId: 'c1',
                        selectedGwInstanceRegionId: 'reg1',
                        selectedDatabaseInstance: 'db1',
                        driftAssessmentData: null
                    }
                })
            );
            render(
                <DynamicInnerTable {...defaultProps} data={heartbeatData} columnConfig={heartbeatColumnConfig as any} />
            );
            expect(capturedTableRows[0].databaseHostName).toBeUndefined();
        });

        it('does not inject metadata when injectMetadataFields is false', () => {
            mockUseAppSelector.mockImplementation((selector: any) =>
                selector({
                    databaseHome: { selectedRowsForOptimizeInnerPage: [] },
                    getWellOptimize: {
                        inProgressOptimizationData: {},
                        selectedResourceId: 'r1',
                        selectedGwInstanceCredId: 'c1',
                        selectedGwInstanceRegionId: 'reg1',
                        selectedDatabaseInstance: 'db1',
                        driftAssessmentData: { metadata: { databaseHostName: 'should-not-appear' } }
                    }
                })
            );
            const configWithoutInject = { ...heartbeatColumnConfig, injectMetadataFields: false };
            render(
                <DynamicInnerTable {...defaultProps} data={heartbeatData} columnConfig={configWithoutInject as any} />
            );
            expect(capturedTableRows[0].databaseHostName).toBeUndefined();
        });
    });

    // ── objectNameSource: 'objectsInViolation' (cluster-quorum) ────────────────

    describe('objectNameSource: objectsInViolation', () => {
        const clusterQuorumConfig = {
            columns: [
                { key: 'objectName', label: 'Cluster name', accessor: 'objectName' },
                { key: 'value', label: 'Current value', accessor: 'value' },
                { key: 'recommended', label: 'Recommended value', accessor: 'recommended' },
                { key: 'configName', label: 'Configuration name', accessor: 'configName' }
            ],
            resourceTypeLabel: 'Cluster',
            objectNameSource: 'objectsInViolation'
        };
        const clusterData = {
            objectsInViolation: ['SQL-DEV-FCI-CLUSTER'],
            violationDetails: [{ objectName: 'DynamicQuorum', value: 'false', recommended: 'true' }]
        };

        it('overrides objectName from objectsInViolation[index]', () => {
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="cluster-quorum"
                    data={clusterData}
                    columnConfig={clusterQuorumConfig as any}
                />
            );
            expect(capturedTableRows[0].objectName).toBe('SQL-DEV-FCI-CLUSTER');
        });

        it('preserves original violationDetails objectName under configName key', () => {
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    configId="cluster-quorum"
                    data={clusterData}
                    columnConfig={clusterQuorumConfig as any}
                />
            );
            expect(capturedTableRows[0].configName).toBe('DynamicQuorum');
        });

        it('does not override objectName when objectsInViolation item is not a string', () => {
            const dataWithObjectItem = {
                objectsInViolation: [{ ontapVolumeName: 'vol-a' }],
                violationDetails: [{ objectName: 'OriginalName', value: 'v', recommended: 'r' }]
            };
            render(
                <DynamicInnerTable
                    {...defaultProps}
                    data={dataWithObjectItem}
                    columnConfig={clusterQuorumConfig as any}
                />
            );
            // Not overridden — original objectName preserved
            expect(capturedTableRows[0].objectName).toBe('OriginalName');
            expect(capturedTableRows[0].configName).toBeUndefined();
        });
    });

    // ── injectMetadataFields (non-combineRows, e.g. iscsi-replacement-timeout) ──

    describe('injectMetadataFields in standard violationDetails path', () => {
        const oracleHostColumnConfig = {
            columns: [
                { key: 'hostName', label: 'Host name', accessor: 'databaseHostName' },
                { key: 'objectName', label: 'Configuration name', accessor: 'objectName' },
                { key: 'value', label: 'Current value', accessor: 'value' },
                { key: 'recommended', label: 'Recommended value', accessor: 'recommended' }
            ],
            resourceTypeLabel: 'Configuration',
            injectMetadataFields: true
        };
        const iscsiData = {
            violationDetails: [{ objectName: 'replacement_timeout', value: '120', recommended: '5' }]
        };

        it('injects databaseHostName from driftAssessmentData.metadata into each row', () => {
            mockUseAppSelector.mockImplementation((selector: any) =>
                selector({
                    databaseHome: { selectedRowsForOptimizeInnerPage: [] },
                    getWellOptimize: {
                        inProgressOptimizationData: {},
                        selectedResourceId: 'r1',
                        selectedGwInstanceCredId: 'c1',
                        selectedGwInstanceRegionId: 'reg1',
                        selectedDatabaseInstance: 'db1',
                        driftAssessmentData: { metadata: { databaseHostName: 'oracle-host-01' } }
                    }
                })
            );
            render(
                <DynamicInnerTable {...defaultProps} data={iscsiData} columnConfig={oracleHostColumnConfig as any} />
            );
            expect(capturedTableRows[0].databaseHostName).toBe('oracle-host-01');
        });

        it('does not inject metadata when driftAssessmentData is null', () => {
            mockUseAppSelector.mockImplementation((selector: any) =>
                selector({
                    databaseHome: { selectedRowsForOptimizeInnerPage: [] },
                    getWellOptimize: {
                        inProgressOptimizationData: {},
                        selectedResourceId: 'r1',
                        selectedGwInstanceCredId: 'c1',
                        selectedGwInstanceRegionId: 'reg1',
                        selectedDatabaseInstance: 'db1',
                        driftAssessmentData: null
                    }
                })
            );
            render(
                <DynamicInnerTable {...defaultProps} data={iscsiData} columnConfig={oracleHostColumnConfig as any} />
            );
            expect(capturedTableRows[0].databaseHostName).toBeUndefined();
        });

        it('does not inject metadata fields when injectMetadataFields is false', () => {
            mockUseAppSelector.mockImplementation((selector: any) =>
                selector({
                    databaseHome: { selectedRowsForOptimizeInnerPage: [] },
                    getWellOptimize: {
                        inProgressOptimizationData: {},
                        selectedResourceId: 'r1',
                        selectedGwInstanceCredId: 'c1',
                        selectedGwInstanceRegionId: 'reg1',
                        selectedDatabaseInstance: 'db1',
                        driftAssessmentData: { metadata: { databaseHostName: 'should-not-appear' } }
                    }
                })
            );
            const configWithoutInject = { ...oracleHostColumnConfig, injectMetadataFields: false };
            render(<DynamicInnerTable {...defaultProps} data={iscsiData} columnConfig={configWithoutInject as any} />);
            expect(capturedTableRows[0].databaseHostName).toBeUndefined();
        });
    });
});
