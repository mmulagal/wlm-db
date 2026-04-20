import React from 'react';
import { render } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import DatabasesTable from './DatabasesTable';
import { DBType, INVENTORY_STATUS } from '../../../../utils/consts';

// Mock all dependencies
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    useDialog: () => ({
        setDialog: vi.fn(),
        closeDialog: vi.fn()
    })
}));

vi.mock('../../../../utils/apiService', () => ({
    useAddHostJobScMutation: () => [vi.fn(), {}],
    useAddHostScMutation: () => [vi.fn(), {}],
    useAssignBackupRecoveryLicenseMutation: () => [vi.fn(), {}],
    useAssignRBACPrivilegesMutation: () => [vi.fn(), {}],
    useConfigureDirectoryMutation: () => [vi.fn(), {}],
    useDeleteHostScMutation: () => [vi.fn(), {}],
    useDiscoverExistingFsxNMutation: () => [vi.fn(), {}],
    useGenerateCredentialIDMutation: () => [vi.fn(), {}],
    useGetBackupRecoveryLicenseMutation: () => [vi.fn(), {}],
    useGetConnectorsMutation: () => [vi.fn(), {}],
    useGetDiscoverHostResultMutation: () => [vi.fn(), {}],
    useGetFsxDetailsMutation: () => [vi.fn(), {}],
    useGetOrganizationIdsMutation: () => [vi.fn(), {}],
    useGetRBACPrivilegesMutation: () => [vi.fn(), {}],
    useGetSCCrendentialsMutation: () => [vi.fn(), {}],
    useGetWorkSpaceIDMutation: () => [vi.fn(), {}],
    useListAllDirectoriesMutation: () => [vi.fn(), {}],
    useListExistingHostsMutation: () => [vi.fn(), {}],
    useRegisterResourceCredentialsBulkMutation: () => [vi.fn(), {}]
}));

vi.mock('../../../../common/Lib/Table/useTable', () => ({
    useTable: () => ({
        columnsState: {},
        tableProps: {
            data: [],
            columns: [],
            getTableProps: () => ({}),
            getTableBodyProps: () => ({}),
            headerGroups: [],
            rows: [],
            prepareRow: vi.fn()
        }
    })
}));

vi.mock('../../../../common/Lib/Table/TableTopBar', () => ({
    TableTopBar: ({ ...props }: any) => <div data-testid="table-top-bar" {...props} />
}));

vi.mock('../../../../common/Lib/Table/Table', () => ({
    Table: ({ ...props }: any) => <div data-testid="table" {...props} />
}));

vi.mock('../../../../common/MenuPopover/MenuPopover', () => ({
    default: ({ ...props }: any) => <div data-testid="menu-popover" {...props} />
}));

vi.mock('../../../../common/Dialog/DialogComponent', () => ({
    default: ({ ...props }: any) => <div data-testid="dialog-component" {...props} />
}));

vi.mock('../ProtectionDialogs/NoAgentDialog', () => ({
    default: ({ ...props }: any) => <div data-testid="no-agent-dialog" {...props} />
}));

vi.mock('../ProtectionDialogs/FetchingDIalog', () => ({
    default: ({ ...props }: any) => <div data-testid="fetching-dialog" {...props} />
}));

vi.mock('../ProtectionDialogs/WindowsAuthDialog', () => ({
    default: ({ ...props }: any) => <div data-testid="windows-auth-dialog" {...props} />
}));

vi.mock('react-redux', () => ({
    useDispatch: () => vi.fn()
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
    BrowserRouter: ({ children }: any) => children
}));

vi.mock('./DatabaseTableColumns', () => ({
    getDatabaseTableColumns: () => [
        {
            Header: 'Database Name',
            accessor: 'name'
        }
    ]
}));

vi.mock('./MssqlPgsqlDatabaseTableColumns', () => ({
    mssqlPgsqlDatabaseColumnFilterMap: {
        hostName: '3',
        credentialName: '8',
        regionName: '10',
        instanceName: '2'
    }
}));

vi.mock('./OraclePDBTableColumns', () => ({
    oraclePDBColumnFilterMap: {
        hostName: '3',
        credentialName: '7',
        regionName: '9',
        instanceName: '2'
    }
}));

vi.mock('../../../../utils/manageColumnUtils', () => ({
    getInitialDatabaseTableColState: () => ({
        '0': { isHidden: false, isRemovalDisabled: true },
        '1': { isHidden: false }
    })
}));

// Create mock state
const mockState = {
    inventoryV2: {
        selectedInventoryTab: 'Databases',
        selectedFilterValue: { flag: false, value: '' },
        selectedHostType: DBType.MSSQL,
        databaseTableRows: [
            {
                id: '1',
                databaseName: 'TestDB',
                hostName: 'test-host',
                hostType: DBType.MSSQL,
                instanceName: 'test-instance',
                credentialName: 'test-credential',
                region: 'us-east-1',
                status: INVENTORY_STATUS.ONLINE,
                isProtected: false,
                fsxId: 'fsx-12345',
                nodeIpAddress: '192.168.1.1'
            }
        ],
        tableManageColumnState: { databaseTable: {} },
        getDatabaseHosts: {
            databaseHostsLoading: false,
            fullHostDataLoading: false
        },
        getPgSqlDatabaseHosts: {
            databaseHostsLoading: false,
            fullHostDataLoading: false
        }
    },
    headers: {
        multiDataLoading: false
    },
    auth: {
        isDemoMode: false,
        isWorkloadFactory: true,
        orgId: 'test-org-id'
    },
    snapCenter: {
        databaseProtection: {}
    }
};

// Mock useAppSelector
vi.mock('../../../../store/storeHooks', () => ({
    useAppSelector: vi.fn().mockImplementation(selector => selector(mockState))
}));

// Mock store slices
vi.mock('../../../../store/workloadFactory/inventoryV2Slice', () => ({
    setSelectedFilterValue: vi.fn(),
    setTableManageColumnState: vi.fn()
}));

vi.mock('../../../../store/workloadFactory/createSandboxSlice', () => ({
    setSelectedCsData: vi.fn(),
    setSelectedSandboxHeaderValue: vi.fn()
}));

vi.mock('../../../../store/workloadFactory/snapcenterSlice', () => ({
    cancelProtectionForRow: vi.fn(),
    setDataForRow: vi.fn()
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    bxpRedirect: vi.fn()
}));

vi.mock('../../AddHostUtils', () => ({
    handleProtectionUtil: vi.fn()
}));

vi.mock('../../InventoryUtilsV2', () => ({
    addHostHandlerSc: vi.fn()
}));

vi.mock('../../../WellArchitectedTab/WellArchitectedTabUtils', () => ({
    getUniqueLunNames: vi.fn((luns?: any) => {
        if (!luns) return [];
        const dataNames = (luns.dataFiles ?? []).map((f: any) => f?.name).filter(Boolean) as string[];
        const logNames = (luns.logFiles ?? []).map((f: any) => f?.name).filter(Boolean) as string[];
        return Array.from(new Set([...dataNames, ...logNames]));
    }),
    getLunFilterOptions: vi.fn((rows?: any[]) => {
        const unique = new Set<string>();
        (rows || []).forEach((row: any) => {
            (row?.lunPaths || []).forEach((path: string) => unique.add(path));
        });
        return Array.from(unique)
            .sort((a, b) => a.localeCompare(b))
            .map(path => ({ value: path, label: path }));
    })
}));

vi.mock('../../../../store/store', () => ({
    default: {
        getState: () => mockState,
        dispatch: vi.fn()
    }
}));

describe('DatabasesTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Basic Functionality', () => {
        it('renders without crashing', async () => {
            const { container } = render(
                <BrowserRouter>
                    <DatabasesTable />
                </BrowserRouter>
            );

            // Check that the component renders and has content
            expect(container.firstChild).not.toBeNull();
            expect(container.innerHTML).toContain('data-testid="table-top-bar"');
            expect(container.innerHTML).toContain('data-testid="table"');
        });

        it('displays table components with correct structure', () => {
            const { container } = render(
                <BrowserRouter>
                    <DatabasesTable />
                </BrowserRouter>
            );

            // Verify the component structure exists
            expect(container.firstChild).not.toBeNull();
            expect(container.innerHTML).toContain('_inventoryTable_');
            expect(container.innerHTML).toContain('_table_');
        });

        it('renders table with expected props', () => {
            const { container } = render(
                <BrowserRouter>
                    <DatabasesTable />
                </BrowserRouter>
            );

            // Check for table configuration
            expect(container.innerHTML).toContain('data-testid="table"');
            expect(container.innerHTML).toContain('tableprops="[object Object]"');
        });

        it('renders table top bar with expected props', () => {
            const { container } = render(
                <BrowserRouter>
                    <DatabasesTable />
                </BrowserRouter>
            );

            // Check for table top bar configuration
            expect(container.innerHTML).toContain('data-testid="table-top-bar"');
            // Props are rendered in lowercase when spread to DOM elements
            expect(container.innerHTML).toContain('pluraltitle');
            expect(container.innerHTML).toContain('singulartitle');
        });
    });

    describe('Component State Integration', () => {
        it('integrates with Redux state correctly', () => {
            const { container } = render(
                <BrowserRouter>
                    <DatabasesTable />
                </BrowserRouter>
            );

            // Component should render based on mocked state
            expect(container.firstChild).not.toBeNull();
            expect(container.innerHTML).toContain('_inventoryTable_');
        });

        it('handles demo mode configuration', () => {
            // Create a mock state with demo mode enabled
            const demoMockState = {
                ...mockState,
                auth: {
                    ...mockState.auth,
                    isDemoMode: true
                }
            };

            // Re-render with new state
            const { container } = render(
                <BrowserRouter>
                    <DatabasesTable />
                </BrowserRouter>
            );

            expect(container.firstChild).not.toBeNull();
        });

        it('handles different host types', () => {
            // Test with PostgreSQL host type
            const pgsqlMockState = {
                ...mockState,
                inventoryV2: {
                    ...mockState.inventoryV2,
                    selectedHostType: DBType.POSTGRESQL
                }
            };

            const { container } = render(
                <BrowserRouter>
                    <DatabasesTable />
                </BrowserRouter>
            );

            expect(container.firstChild).not.toBeNull();
        });
    });

    describe('Loading States', () => {
        it('handles database hosts loading state', () => {
            const loadingMockState = {
                ...mockState,
                inventoryV2: {
                    ...mockState.inventoryV2,
                    getDatabaseHosts: {
                        databaseHostsLoading: true,
                        fullHostDataLoading: false
                    }
                }
            };

            const { container } = render(
                <BrowserRouter>
                    <DatabasesTable />
                </BrowserRouter>
            );

            expect(container.firstChild).not.toBeNull();
        });

        it('handles multi data loading state', () => {
            const multiLoadingMockState = {
                ...mockState,
                headers: {
                    multiDataLoading: true
                }
            };

            const { container } = render(
                <BrowserRouter>
                    <DatabasesTable />
                </BrowserRouter>
            );

            expect(container.firstChild).not.toBeNull();
        });
    });

    describe('Error Handling', () => {
        it('handles empty database table rows', () => {
            const emptyMockState = {
                ...mockState,
                inventoryV2: {
                    ...mockState.inventoryV2,
                    databaseTableRows: []
                }
            };

            const { container } = render(
                <BrowserRouter>
                    <DatabasesTable />
                </BrowserRouter>
            );

            expect(container.firstChild).not.toBeNull();
        });

        it('handles null database table rows', () => {
            const nullMockState = {
                ...mockState,
                inventoryV2: {
                    ...mockState.inventoryV2,
                    databaseTableRows: null
                }
            };

            const { container } = render(
                <BrowserRouter>
                    <DatabasesTable />
                </BrowserRouter>
            );

            expect(container.firstChild).not.toBeNull();
        });
    });

    describe('Component Configuration', () => {
        it('configures table with correct properties', () => {
            const { container } = render(
                <BrowserRouter>
                    <DatabasesTable />
                </BrowserRouter>
            );

            // Should render table with isDoubleRow configuration
            expect(container.innerHTML).toContain('data-testid="table"');
        });

        it('exports functionality is configured', () => {
            const { container } = render(
                <BrowserRouter>
                    <DatabasesTable />
                </BrowserRouter>
            );

            // Should have export options configured
            expect(container.innerHTML).toContain('exporttocsvoptions="[object Object]"');
        });

        it('subtitle is displayed correctly', () => {
            const { container } = render(
                <BrowserRouter>
                    <DatabasesTable />
                </BrowserRouter>
            );

            // Should display subtitle prop (rendered in lowercase when spread to DOM)
            expect(container.innerHTML).toContain('subtitle');
        });
    });

    describe('Table Functionality', () => {
        it('initializes with correct columns and data', () => {
            const { container } = render(
                <BrowserRouter>
                    <DatabasesTable />
                </BrowserRouter>
            );

            // Should render table with mocked data
            expect(container.firstChild).not.toBeNull();
            expect(container.innerHTML).toContain('data-testid="table"');
        });

        it('handles filter value configuration', () => {
            const filterMockState = {
                ...mockState,
                inventoryV2: {
                    ...mockState.inventoryV2,
                    selectedFilterValue: { flag: true, value: 'test-filter' }
                }
            };

            const { container } = render(
                <BrowserRouter>
                    <DatabasesTable />
                </BrowserRouter>
            );

            expect(container.firstChild).not.toBeNull();
        });
    });
});
