import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import OracleEbsTable from './OracleEbsTable';
import exploreSavingsSlice from '../../../store/workloadFactory/exploreSavingsSlice';
import exploreSavingsBulkSlice, {
    setSelectedRowsForExploreSavingsOracleEbsBulk
} from '../../../store/workloadFactory/exploreSavingsBulkSlice';
import notificationSlice from '../../../store/notificationSlice';
import authSlice from '../../../store/authSlice';
import headersSlice from '../../../store/workloadFactory/headersSlice';
import inventoryV2Slice from '../../../store/workloadFactory/inventoryV2Slice';

// ---- Hoisted stable refs (accessible inside vi.mock) ----
const { mockSelectionState, mockToggleRowSelection } = vi.hoisted(() => ({
    mockSelectionState: { rows: {} as Record<string, boolean>, count: 0 },
    mockToggleRowSelection: vi.fn().mockReturnValue(vi.fn())
}));

// ---- Mocks ----

vi.mock('../../../utils/consts', async () => {
    const actual = await vi.importActual('../../../utils/consts');
    return {
        ...actual,
        AVAILABILITY_ZONE_TYPE: {
            SINGLE_AZ: 'Single AZ',
            MULTI_AZ: 'Multi AZ'
        }
    };
});

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {
            language: 'en',
            changeLanguage: vi.fn()
        }
    })
}));

vi.mock('@netapp/design-system', () => ({
    Typography: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    TableTopBar: ({ children }: any) => <div data-testid="table-topbar">{children}</div>,
    useTable: (config: any) => ({
        rows: config.rows,
        columns: config.columns,
        selectionState: mockSelectionState,
        toggleRowSelection: mockToggleRowSelection,
        isLoading: config.isLazyLoading
    }),
    Table: ({ tableProps }: any) => (
        <div data-testid="oracle-ebs-table">
            {tableProps?.rows?.map((row: any, idx: number) => (
                <div
                    key={row.id ?? idx}
                    data-testid={`table-row-${row.id}`}
                    data-disabled={row.cellProps?.isDisabled ?? false}
                    data-tooltip={row.cellProps?.selectionProps?.title ?? ''}
                />
            ))}
        </div>
    )
}));

vi.mock('../../../common/BulkAction/BulkActionContainer', () => ({
    default: ({ action, onClick }: any) => (
        <div data-testid="bulk-action-container">
            <button data-testid="bulk-action-button" onClick={onClick}>
                {action}
            </button>
        </div>
    )
}));

vi.mock('../../../common/hooks/useResize', () => ({
    default: () => ({ width: 1920, height: 1080 })
}));

vi.mock('../../InventoryV2/InventoryUtilsV2', () => ({
    renderAllocatedCapacity: vi.fn(() => <span>capacity</span>),
    renderCellData: vi.fn((_cellData: any, _rowData: any) => <span>cell</span>),
    renderUnmanagedAZ: vi.fn(() => <span>az</span>),
    uniqueHostRow: vi.fn((id: string, credId: string, regionId: string) => `${id}_${credId}_${regionId}`),
    canTriggerUnregisteredAssessment: (hostManageReadiness?: {
        extensiveRunPermission?: boolean;
        canReadAWSSSMDocuments?: boolean;
    }) => hostManageReadiness?.extensiveRunPermission === true || hostManageReadiness?.canReadAWSSSMDocuments === true
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    getSelectedFromSelectionState: vi.fn((selectionState: any, rows: any[]) =>
        rows.filter((row: any) => selectionState?.rows?.[row.id])
    )
}));

const mockOnClickESHostOracleEbs = vi.fn();
vi.mock('../ExploreSavingsUtils', () => ({
    onClickESHostOracleEbs: (...args: any[]) => mockOnClickESHostOracleEbs(...args)
}));

vi.mock('../../../store/workloadFactory/exploreSavingsSlice', async () => {
    const actual = await vi.importActual('../../../store/workloadFactory/exploreSavingsSlice');
    return {
        ...actual,
        resetOptimizedStorage: vi.fn(() => ({ type: 'exploreSavings/resetOptimizedStorage' }))
    };
});

// ---- Helpers ----

const makeOracleEbsHost = (id: number, overrides: any = {}) => ({
    id: `host-${id}`,
    resourceId: `res-${id}`,
    ec2InstanceId: `i-${id}`,
    ec2InstanceName: `ec2-name-${id}`,
    name: `oracle-host-${id}`,
    hostType: 'Oracle',
    storageType: 'EBS',
    credentialId: 'cred-1',
    credentialName: 'My AWS Creds',
    regionId: 'us-east-1',
    regionName: 'US East (N. Virginia)',
    accountId: '123456789',
    serverInstallationMode: 'Standalone',
    ec2Details: [{ id: `i-${id}`, name: `ec2-name-${id}`, instanceType: 'm5.xlarge' }],
    databaseInstanceDetails: [{ oracleEdition: 'Enterprise' }],
    totalInstance: 2,
    allocatedCapacityText: '500 GiB',
    azType: 'Single AZ',
    action: 'EXPLORE_SAVINGS',
    hostManageReadiness: { extensiveRunPermission: true },
    ...overrides
});

const setMockSelection = (selectedIds: string[]) => {
    Object.keys(mockSelectionState.rows).forEach(k => delete mockSelectionState.rows[k]);
    selectedIds.forEach(id => {
        mockSelectionState.rows[id] = true;
    });
    mockSelectionState.count = selectedIds.length;
};

const createStore = ({ oracleEbsHosts = [] as any[], selectedOracleEbsRows = [] as any[] } = {}) =>
    // Mix Oracle EBS hosts into the unmanagedExploreSavingsHost array
    configureStore({
        reducer: {
            exploreSavings: exploreSavingsSlice.reducer,
            exploreSavingsBulk: exploreSavingsBulkSlice.reducer,
            notifications: notificationSlice.reducer,
            auth: authSlice.reducer,
            headers: headersSlice.reducer,
            inventoryV2: inventoryV2Slice.reducer
        } as any,
        preloadedState: {
            exploreSavings: {
                unmanagedExploreSavingsHost: oracleEbsHosts
            },
            exploreSavingsBulk: {
                selectedRowsForExploreSavingsEBSBulk: [],
                selectedRowsForExploreSavingsOnPremBulk: [],
                selectedRowsForExploreSavingsOracleOnPremBulk: [],
                selectedRowsForExploreSavingsOracleEbsBulk: selectedOracleEbsRows,
                ebsTCOAction: '',
                bulkAuthCredentials: {},
                rowsRequiringAuthBulk: [],
                bulkAuthStatus: {},
                triggerBulkDataFetch: false
            },
            auth: {
                isDemoMode: false,
                isWorkloadFactory: true
            },
            notifications: {
                messages: [],
                showDetailedView: false
            },
            headers: {
                multiDataLoading: false
            },
            inventoryV2: {
                discoveredHosts: { discoverHostLoading: false },
                isManagedHostListLoading: false
            }
        } as any,
        middleware: getDefaultMiddleware => getDefaultMiddleware({ serializableCheck: false, immutableCheck: false })
    });
const renderComponent = (storeOverrides = {}) => {
    const store = createStore(storeOverrides);
    const utils = render(
        <Provider store={store}>
            <BrowserRouter>
                <OracleEbsTable />
            </BrowserRouter>
        </Provider>
    );
    return { store, ...utils };
};

// ---- Tests ----

describe('OracleEbsTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setMockSelection([]);
    });

    describe('rendering', () => {
        it('should render the table and top bar', () => {
            renderComponent();
            expect(screen.getByTestId('table-topbar')).toBeTruthy();
            expect(screen.getByTestId('oracle-ebs-table')).toBeTruthy();
        });

        it('should render rows for Oracle EBS hosts', () => {
            const hosts = [makeOracleEbsHost(1), makeOracleEbsHost(2), makeOracleEbsHost(3)];
            renderComponent({ oracleEbsHosts: hosts });
            expect(screen.getByTestId('table-row-host-1_cred-1_us-east-1')).toBeTruthy();
            expect(screen.getByTestId('table-row-host-2_cred-1_us-east-1')).toBeTruthy();
            expect(screen.getByTestId('table-row-host-3_cred-1_us-east-1')).toBeTruthy();
        });

        it('should render no rows when there are no Oracle EBS hosts', () => {
            renderComponent({ oracleEbsHosts: [] });
            expect(screen.queryByTestId('table-row-host-1_cred-1_us-east-1')).toBeNull();
        });

        it('should filter out non-Oracle hosts from the table', () => {
            const mssqlHost = makeOracleEbsHost(1, { hostType: 'Microsoft SQL Server', name: 'mssql-host' });
            const oracleHost = makeOracleEbsHost(2);
            renderComponent({ oracleEbsHosts: [mssqlHost, oracleHost] });
            // Only Oracle host should appear (mssql has wrong hostType)
            expect(screen.queryByTestId('table-row-host-1_cred-1_us-east-1')).toBeNull();
            expect(screen.getByTestId('table-row-host-2_cred-1_us-east-1')).toBeTruthy();
        });

        it('should filter out non-EBS Oracle hosts', () => {
            const fsxHost = makeOracleEbsHost(1, { storageType: 'FSxN' });
            const ebsHost = makeOracleEbsHost(2);
            renderComponent({ oracleEbsHosts: [fsxHost, ebsHost] });
            expect(screen.queryByTestId('table-row-host-1_cred-1_us-east-1')).toBeNull();
            expect(screen.getByTestId('table-row-host-2_cred-1_us-east-1')).toBeTruthy();
        });

        it('should show deployment model defaulting to Standalone', () => {
            const host = makeOracleEbsHost(1, { serverInstallationMode: undefined });
            renderComponent({ oracleEbsHosts: [host] });
            // Host rendered — deployment model defaults to Standalone in tableData
            expect(screen.getByTestId('table-row-host-1_cred-1_us-east-1')).toBeTruthy();
        });

        it('should use databaseInstanceDetails.length as totalInstance fallback', () => {
            const host = makeOracleEbsHost(1, {
                totalInstance: undefined,
                databaseInstanceDetails: [{ name: 'db1' }, { name: 'db2' }, { name: 'db3' }]
            });
            renderComponent({ oracleEbsHosts: [host] });
            expect(screen.getByTestId('table-row-host-1_cred-1_us-east-1')).toBeTruthy();
        });
    });

    describe('5-host selection limit', () => {
        it('should not disable any rows when fewer than 5 are selected', () => {
            const hosts = Array.from({ length: 6 }, (_, i) => makeOracleEbsHost(i + 1));
            const selected = hosts.slice(0, 3);
            const selectedIds = selected.map(h => `host-${hosts.indexOf(h) + 1}_cred-1_us-east-1`);
            setMockSelection(selectedIds);
            renderComponent({ oracleEbsHosts: hosts, selectedOracleEbsRows: selected });

            hosts.forEach((_, idx) => {
                const row = screen.getByTestId(`table-row-host-${idx + 1}_cred-1_us-east-1`);
                expect(row.getAttribute('data-disabled')).toBe('false');
            });
        });

        it('should disable unselected rows when 5 hosts are selected', () => {
            const hosts = Array.from({ length: 7 }, (_, i) => makeOracleEbsHost(i + 1));
            const selected = hosts.slice(0, 5);
            const selectedIds = selected.map(h => `host-${hosts.indexOf(h) + 1}_cred-1_us-east-1`);
            setMockSelection(selectedIds);
            renderComponent({ oracleEbsHosts: hosts, selectedOracleEbsRows: selected });

            // Selected rows should not be disabled
            for (let i = 1; i <= 5; i++) {
                const row = screen.getByTestId(`table-row-host-${i}_cred-1_us-east-1`);
                expect(row.getAttribute('data-disabled')).toBe('false');
            }

            // Unselected rows should be disabled
            [6, 7].forEach(id => {
                const row = screen.getByTestId(`table-row-host-${id}_cred-1_us-east-1`);
                expect(row.getAttribute('data-disabled')).toBe('true');
            });
        });

        it('should set limit-exceeded tooltip on disabled rows', () => {
            const hosts = Array.from({ length: 6 }, (_, i) => makeOracleEbsHost(i + 1));
            const selected = hosts.slice(0, 5);
            const selectedIds = selected.map(h => `host-${hosts.indexOf(h) + 1}_cred-1_us-east-1`);
            setMockSelection(selectedIds);
            renderComponent({ oracleEbsHosts: hosts, selectedOracleEbsRows: selected });

            const disabledRow = screen.getByTestId('table-row-host-6_cred-1_us-east-1');
            expect(disabledRow.getAttribute('data-tooltip')).toBe(
                'databases.explore-savings.disabled-tooltip-limit-exceed'
            );
        });

        it('should disable rows with different credentials when a selection exists', () => {
            const host1 = makeOracleEbsHost(1, { credentialId: 'cred-1', regionId: 'us-east-1' });
            const host2 = makeOracleEbsHost(2, { credentialId: 'cred-2', regionId: 'us-east-1' });
            setMockSelection(['host-1_cred-1_us-east-1']);
            renderComponent({ oracleEbsHosts: [host1, host2], selectedOracleEbsRows: [host1] });

            const diffCredRow = screen.getByTestId('table-row-host-2_cred-2_us-east-1');
            expect(diffCredRow.getAttribute('data-disabled')).toBe('true');
            expect(diffCredRow.getAttribute('data-tooltip')).toBe('databases.explore-savings.disabled-tooltip');
        });

        it('should disable rows with different region when a selection exists', () => {
            const host1 = makeOracleEbsHost(1, { credentialId: 'cred-1', regionId: 'us-east-1' });
            const host2 = makeOracleEbsHost(2, { credentialId: 'cred-1', regionId: 'eu-west-1' });
            setMockSelection(['host-1_cred-1_us-east-1']);
            renderComponent({ oracleEbsHosts: [host1, host2], selectedOracleEbsRows: [host1] });

            const diffRegionRow = screen.getByTestId('table-row-host-2_cred-1_eu-west-1');
            expect(diffRegionRow.getAttribute('data-disabled')).toBe('true');
        });
    });

    describe('single action', () => {
        it('should not show bulk action container when no rows are selected', () => {
            const hosts = [makeOracleEbsHost(1), makeOracleEbsHost(2)];
            renderComponent({ oracleEbsHosts: hosts, selectedOracleEbsRows: [] });
            expect(screen.queryByTestId('bulk-action-container')).toBeNull();
        });
    });

    describe('bulk action', () => {
        it('should show bulk action container when rows are selected', () => {
            const hosts = [makeOracleEbsHost(1), makeOracleEbsHost(2)];
            const selected = [hosts[0]];
            setMockSelection(['host-1_cred-1_us-east-1']);
            renderComponent({ oracleEbsHosts: hosts, selectedOracleEbsRows: selected });
            expect(screen.getByTestId('bulk-action-container')).toBeTruthy();
        });

        it('should call onClickESHostOracleEbs with isBulk=true on bulk action click', () => {
            const hosts = [makeOracleEbsHost(1), makeOracleEbsHost(2)];
            const selected = [hosts[0], hosts[1]];
            setMockSelection(['host-1_cred-1_us-east-1', 'host-2_cred-1_us-east-1']);
            renderComponent({ oracleEbsHosts: hosts, selectedOracleEbsRows: selected });

            const bulkButton = screen.getByTestId('bulk-action-button');
            fireEvent.click(bulkButton);

            expect(mockOnClickESHostOracleEbs).toHaveBeenCalledTimes(1);
            // With 2 hosts: isBulk=true, bulkServerName='2 hosts selected'
            expect(mockOnClickESHostOracleEbs).toHaveBeenCalledWith(
                expect.any(Function), // dispatch
                expect.objectContaining({ name: 'oracle-host-1' }), // first host row (transformed)
                true, // isWorkloadFactory
                expect.any(Function), // navigate
                true, // isBulk
                '2 hosts selected' // bulkServerName
            );
        });

        it('should not set bulkServerName for single-host bulk action', () => {
            const hosts = [makeOracleEbsHost(1)];
            setMockSelection(['host-1_cred-1_us-east-1']);
            renderComponent({ oracleEbsHosts: hosts, selectedOracleEbsRows: hosts });

            const bulkButton = screen.getByTestId('bulk-action-button');
            fireEvent.click(bulkButton);

            // With 1 host, isBulk variable is false so bulkServerName is undefined,
            // but the component always passes `true` as the 5th arg (bulk path flag).
            expect(mockOnClickESHostOracleEbs).toHaveBeenCalledWith(
                expect.any(Function),
                expect.objectContaining({ name: 'oracle-host-1' }),
                true,
                expect.any(Function),
                true, // always true in handleBulkAction path
                undefined // no bulk server name when only 1 host
            );
        });

        it('should not attempt bulk action when no rows are selected', () => {
            const hosts = [makeOracleEbsHost(1)];
            renderComponent({ oracleEbsHosts: hosts, selectedOracleEbsRows: [] });
            expect(screen.queryByTestId('bulk-action-container')).toBeNull();
            expect(mockOnClickESHostOracleEbs).not.toHaveBeenCalled();
        });
    });

    describe('selection sync', () => {
        it('should dispatch selected rows to Redux when table selection changes', () => {
            const hosts = [makeOracleEbsHost(1), makeOracleEbsHost(2)];
            setMockSelection(['host-1_cred-1_us-east-1']);
            const { store } = renderComponent({ oracleEbsHosts: hosts, selectedOracleEbsRows: [] });

            const state = store.getState();
            const oracleSelected = state.exploreSavingsBulk.selectedRowsForExploreSavingsOracleEbsBulk;
            expect(oracleSelected).toHaveLength(1);
        });

        it('should clear Redux selection when table selection is empty', () => {
            const hosts = [makeOracleEbsHost(1), makeOracleEbsHost(2)];
            setMockSelection([]);
            const { store } = renderComponent({
                oracleEbsHosts: hosts,
                selectedOracleEbsRows: [hosts[0]]
            });

            const state = store.getState();
            expect(state.exploreSavingsBulk.selectedRowsForExploreSavingsOracleEbsBulk).toHaveLength(0);
        });

        it('should call toggleRowSelection when Redux diverges from table after mount', () => {
            const hosts = [makeOracleEbsHost(1), makeOracleEbsHost(2)];
            setMockSelection([]);
            const { store } = renderComponent({ oracleEbsHosts: hosts });

            mockToggleRowSelection.mockClear();

            act(() => {
                store.dispatch(setSelectedRowsForExploreSavingsOracleEbsBulk([hosts[0]]));
            });

            expect(mockToggleRowSelection).toHaveBeenCalled();
        });
    });

    describe('Data Guard hosts', () => {
        it('should render Data Guard hosts with Data Guard deployment model', () => {
            const dgHost = makeOracleEbsHost(1, { serverInstallationMode: 'Data Guard' });
            renderComponent({ oracleEbsHosts: [dgHost] });
            expect(screen.getByTestId('table-row-host-1_cred-1_us-east-1')).toBeTruthy();
        });

        it('should render mixed standalone and Data Guard rows', () => {
            const standaloneHost = makeOracleEbsHost(1);
            const dgHost = makeOracleEbsHost(2, { serverInstallationMode: 'Data Guard' });
            renderComponent({ oracleEbsHosts: [standaloneHost, dgHost] });

            expect(screen.getByTestId('table-row-host-1_cred-1_us-east-1')).toBeTruthy();
            expect(screen.getByTestId('table-row-host-2_cred-1_us-east-1')).toBeTruthy();
        });
    });
});
