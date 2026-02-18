import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SelectSource from './SelectSource';

const mockSetOpenChildren = vi.fn();
const mockDispatch = vi.fn();

vi.mock('@netapp/design-system', () => ({
    AccordionCard: ({ children, title, ValueContent, id }: any) => (
        <div data-testid={`accordion-card-${id}`}>
            <div data-testid="accordion-title">{title}</div>
            <ValueContent />
            {children}
        </div>
    ),
    AccordionCardContent: ({ children }: any) => <div data-testid="accordion-card-content">{children}</div>,
    DsTypography: ({ children, variant, className, title: tipTitle }: any) => (
        <div data-testid="ds-typography" data-variant={variant} className={className} title={tipTitle}>
            {children}
        </div>
    ),
    SelectField: ({ label, onChange, value, options, error, isLoading, isSearchable }: any) => (
        <div data-testid={`select-field-${label?.replace(/ /g, '-')}`}>
            <label>{label}</label>
            <select
                onChange={e => onChange?.({ value: e.target.value, label: e.target.value })}
                value={value?.value || ''}
            >
                {options?.map((opt: any) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            {error && <span data-testid="select-error">{error}</span>}
        </div>
    ),
    useAccordionContext: () => ({ setOpenChildren: mockSetOpenChildren })
}));

vi.mock('@netapp/design-system/dist/components/Select', () => ({
    optionType: {}
}));

vi.mock('../../../../../common/hooks/useResize', () => ({
    default: vi.fn(() => ({ width: 1600, height: 900 }))
}));

vi.mock('../../../../../utils/utilityFunctions', () => ({
    generateOptionType: vi.fn(
        (value: any, label: any, desc: string, disabled: boolean, tooltip: string, data?: any) => ({
            value,
            label,
            isDisabled: disabled,
            tooltip,
            data
        })
    ),
    isSmbProtocol: vi.fn(() => false)
}));

vi.mock('../../../../../store/workloadFactory/createSandboxSlice', () => ({
    setCreateSandboxPressed: vi.fn((val: boolean) => ({ type: 'createSandbox/setCreateSandboxPressed', payload: val })),
    setDbMountPointsState: vi.fn((val: any) => ({ type: 'createSandbox/setDbMountPointsState', payload: val })),
    setSourceDatabase: vi.fn((val: any) => ({ type: 'createSandbox/setSourceDatabase', payload: val })),
    setSourceDbHost: vi.fn((val: any) => ({ type: 'createSandbox/setSourceDbHost', payload: val })),
    setSourceDbInstance: vi.fn((val: any) => ({ type: 'createSandbox/setSourceDbInstance', payload: val }))
}));

vi.mock('./SelectSource.module.scss', () => ({
    default: {
        selectSource: 'selectSource',
        firstRow: 'firstRow',
        firstRowSmallScreen: 'firstRowSmallScreen',
        secondRow: 'secondRow',
        selectField: 'selectField',
        headerSetter: 'headerSetter'
    }
}));

vi.mock('../../../../../utils/CommonStyles.module.scss', () => ({
    default: {
        'heading-content': 'heading-content',
        separatorSandbox: 'separatorSandbox',
        setHeaderStyleSandbox: 'setHeaderStyleSandbox',
        title: 'title'
    }
}));

vi.mock('../../../../../utils/appConstants', () => ({
    GENERAL: {
        DATABASE_SOURCE: 'Database Source',
        SOURCE_HOST: 'Source Host',
        SOURCE_INSTANCE: 'Source Instance',
        SOURCE_DATABASE: 'Source Database',
        ACTION_REQUIRED: 'Action required',
        SANDBOX_SMB_PROTOCOL_NOT_SUPPORTED: 'SMB protocol not supported'
    }
}));

vi.mock('../../../../../utils/consts', () => ({
    MSSQL_DATABASE_TYPES: { SYSTEM: 'SYSTEM' },
    STATUS_CONST: { ONLINE: 'ONLINE', UP: 'UP' }
}));

const mockAggregatedDbHostList = [
    {
        id: 'host1',
        name: 'Host 1',
        databaseHostStatus: 'ONLINE',
        storage: { fsxn: { protocol: 'NFS' } },
        nodeTopology: { vpcId: 'vpc1' },
        databaseInstancesSummary: [
            {
                databaseInstanceId: 'inst1',
                databaseInstanceName: 'Instance 1',
                status: 'UP',
                databaseInstanceTopology: { fileSystemId: 'fs1' }
            }
        ]
    },
    {
        id: 'host2',
        name: 'Host 2',
        databaseHostStatus: 'OFFLINE',
        storage: { fsxn: { protocol: 'NFS' } },
        nodeTopology: { vpcId: 'vpc2' },
        databaseInstancesSummary: []
    }
];

const createMockStore = (overrides: any = {}) => {
    const createSandboxState = {
        isSourceSelected: true,
        isTargetSelected: true,
        isMountPathAdded: true,
        isCreateSandboxPressed: false,
        showError: false,
        getDatabaseHosts: { databaseHostsLoading: false },
        getDatabaseList: {
            databaseListData: [
                { id: 'db1', name: 'Database 1', type: 'USER', status: 'ONLINE' },
                { id: 'db2', name: 'Database 2', type: 'SYSTEM', status: 'ONLINE' }
            ],
            databaseListLoading: false
        },
        aggregatedDbHostList: mockAggregatedDbHostList,
        selectedCs: null,
        source: {
            selectedDatabaseHost: null,
            selectedDatabaseInstance: null,
            selectedDatabase: null
        },
        ...overrides.createSandbox
    };
    const authState = {
        isDemoMode: false,
        ...overrides.auth
    };
    return configureStore({
        reducer: {
            createSandbox: (state = createSandboxState) => state,
            auth: (state = authState) => state
        }
    });
};

const renderSelectSource = (storeOverrides: any = {}) => {
    const store = createMockStore(storeOverrides);
    return {
        ...render(
            <Provider store={store}>
                <SelectSource />
            </Provider>
        ),
        store
    };
};

describe('SelectSource', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the accordion with Database Source title', () => {
        renderSelectSource();
        expect(screen.getByText('Database Source')).toBeTruthy();
    });

    it('should render Source Host select field', () => {
        renderSelectSource();
        expect(screen.getByTestId('select-field-Source-Host')).toBeTruthy();
    });

    it('should render Source Instance select field', () => {
        renderSelectSource();
        expect(screen.getByTestId('select-field-Source-Instance')).toBeTruthy();
    });

    it('should open accordion 1 on initial render', () => {
        renderSelectSource();
        expect(mockSetOpenChildren).toHaveBeenCalledWith({ 1: true });
    });

    it('should show error when showError is true and no host selected', () => {
        renderSelectSource({
            createSandbox: {
                showError: true,
                isCreateSandboxPressed: false,
                source: { selectedDatabaseHost: null, selectedDatabaseInstance: null, selectedDatabase: null },
                getDatabaseHosts: { databaseHostsLoading: false },
                getDatabaseList: { databaseListData: [], databaseListLoading: false },
                aggregatedDbHostList: [],
                selectedCs: null,
                isSourceSelected: false,
                isTargetSelected: true,
                isMountPathAdded: true
            }
        });
        expect(screen.getAllByTestId('select-error').length).toBeGreaterThan(0);
    });

    it('should NOT show errors when showError is false', () => {
        renderSelectSource({
            createSandbox: {
                showError: false,
                source: { selectedDatabaseHost: null, selectedDatabaseInstance: null, selectedDatabase: null },
                getDatabaseHosts: { databaseHostsLoading: false },
                getDatabaseList: { databaseListData: [], databaseListLoading: false },
                aggregatedDbHostList: [],
                selectedCs: null,
                isSourceSelected: true,
                isTargetSelected: true,
                isMountPathAdded: true,
                isCreateSandboxPressed: false
            }
        });
        expect(screen.queryAllByTestId('select-error').length).toBe(0);
    });

    it('should filter out OFFLINE hosts from generateHostName', () => {
        renderSelectSource();
        // Only ONLINE hosts (host1) should appear
        const select = screen.getByTestId('select-field-Source-Host').querySelector('select');
        expect(select?.children.length).toBe(1);
    });

    it('should dispatch setSourceDbHost when host selection changes', () => {
        const store = createMockStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');

        render(
            <Provider store={store}>
                <SelectSource />
            </Provider>
        );

        const hostSelect = screen.getByTestId('select-field-Source-Host').querySelector('select');
        if (hostSelect) {
            fireEvent.change(hostSelect, { target: { value: 'host1' } });
        }

        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setSourceDbHost') })
        );
    });

    it('should dispatch setSourceDbInstance and setSourceDatabase(null) when host changes', () => {
        const store = createMockStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');

        render(
            <Provider store={store}>
                <SelectSource />
            </Provider>
        );

        const hostSelect = screen.getByTestId('select-field-Source-Host').querySelector('select');
        if (hostSelect) {
            fireEvent.change(hostSelect, { target: { value: 'host1' } });
        }

        const dispatchedTypes = dispatchSpy.mock.calls.map((c: any) => c[0]?.type);
        expect(dispatchedTypes.some((t: string) => t?.includes('setSourceDbInstance'))).toBe(true);
        expect(dispatchedTypes.some((t: string) => t?.includes('setSourceDatabase'))).toBe(true);
    });

    it('should display header with NA when no host selected', () => {
        renderSelectSource();
        expect(screen.getAllByText(/Source Host/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/NA/).length).toBeGreaterThan(0);
    });

    it('should display selected host label in header', () => {
        renderSelectSource({
            createSandbox: {
                source: {
                    selectedDatabaseHost: { value: 'host1', label: 'Host 1' },
                    selectedDatabaseInstance: { value: 'inst1', label: 'Instance 1' },
                    selectedDatabase: { value: 'db1', label: 'Database 1' }
                },
                getDatabaseHosts: { databaseHostsLoading: false },
                getDatabaseList: { databaseListData: [], databaseListLoading: false },
                aggregatedDbHostList: mockAggregatedDbHostList,
                selectedCs: null,
                isSourceSelected: true,
                isTargetSelected: true,
                isMountPathAdded: true,
                isCreateSandboxPressed: false,
                showError: false
            }
        });

        expect(screen.getAllByText(/Host 1/).length).toBeGreaterThan(0);
    });

    it('should handle isCreateSandboxPressed to open accordion items', () => {
        const store = createMockStore({
            createSandbox: {
                isCreateSandboxPressed: true,
                isSourceSelected: false,
                isTargetSelected: false,
                isMountPathAdded: false,
                showError: true,
                source: { selectedDatabaseHost: null, selectedDatabaseInstance: null, selectedDatabase: null },
                getDatabaseHosts: { databaseHostsLoading: false },
                getDatabaseList: { databaseListData: [], databaseListLoading: false },
                aggregatedDbHostList: [],
                selectedCs: null
            }
        });

        render(
            <Provider store={store}>
                <SelectSource />
            </Provider>
        );

        expect(mockSetOpenChildren).toHaveBeenCalledWith(expect.objectContaining({ 1: true }));
    });

    describe('small screen rendering (width <= 1500)', () => {
        it('should render Source Database in first row when width <= 1500', async () => {
            const useResize = (await import('../../../../../common/hooks/useResize')).default;
            (useResize as any).mockReturnValue({ width: 1400, height: 900 });

            renderSelectSource();
            // Source Database select should appear
            const selects = screen.getAllByTestId(/select-field-Source-Database/);
            expect(selects.length).toBeGreaterThan(0);
        });
    });

    describe('large screen rendering (width > 1500)', () => {
        it('should render Source Database in second row when width > 1500', async () => {
            const useResize = (await import('../../../../../common/hooks/useResize')).default;
            (useResize as any).mockReturnValue({ width: 1600, height: 900 });

            renderSelectSource();
            expect(screen.getAllByTestId(/select-field-Source-Database/).length).toBeGreaterThan(0);
        });
    });

    it('should filter SYSTEM databases from options', () => {
        const { container } = renderSelectSource();
        // Only non-SYSTEM databases should appear. db2 is SYSTEM, so only db1 appears.
        const dbSelects = container.querySelectorAll('select');
        // Check that SYSTEM database is not in any select
        expect(screen.queryByText('Database 2')).toBeNull();
    });

    it('should auto-select first available host', () => {
        const store = createMockStore({
            createSandbox: {
                source: { selectedDatabaseHost: null, selectedDatabaseInstance: null, selectedDatabase: null },
                getDatabaseHosts: { databaseHostsLoading: false },
                getDatabaseList: { databaseListData: [], databaseListLoading: false },
                aggregatedDbHostList: mockAggregatedDbHostList,
                selectedCs: null,
                isSourceSelected: true,
                isTargetSelected: true,
                isMountPathAdded: true,
                isCreateSandboxPressed: false,
                showError: false
            }
        });

        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <SelectSource />
            </Provider>
        );

        // Should dispatch setSourceDbHost with first non-disabled option
        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setSourceDbHost') })
        );
    });
});
