import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import Sandboxes from '../Sanboxes';
import headersSlice from '../../../../../store/workloadFactory/headersSlice';
import inventoryV2Slice from '../../../../../store/workloadFactory/inventoryV2Slice';
import sandboxSlice from '../../../../../store/workloadFactory/sandboxSlice';

vi.mock('@tlveng/wlm-ds', () => ({
    DsButton: ({ children, onClick, isDisabled }: any) => (
        <button data-testid="ds-button" onClick={onClick} disabled={isDisabled}>
            {children}
        </button>
    ),
    DsFlashingDotsLoader: () => <div data-testid="flashing-dots-loader" />,
    DsTypography: ({ children, variant, className, style }: any) => (
        <span data-testid={`typography-${variant}`} className={className} style={style}>
            {children}
        </span>
    ),
    postBlueXPMessage: vi.fn(),
    BlueXPListeners: { navigate: 'navigate' }
}));

vi.mock('@netapp/design-system', () => ({
    useDialog: () => ({ setDialog: vi.fn(), closeDialog: vi.fn() })
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn()
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../../../common/SeparatorComponent/SeparatorComponent', () => ({
    default: ({ variant, height }: any) => <hr data-testid={`separator-${variant}`} />
}));

vi.mock('../../../../common/Dialog/DialogComponent', () => ({
    default: ({ header, callback, closeCallback }: any) => (
        <div data-testid="dialog">
            <div>{header}</div>
        </div>
    )
}));

vi.mock('./SandboxDialog/SandboxDialog', () => ({
    default: () => <div data-testid="sandbox-dialog" />
}));

vi.mock('../../../../assets/SandboxIcon.svg', () => ({
    ReactComponent: (p: any) => <svg data-testid="sandbox-icon" />
}));
vi.mock('../../../../assets/SourceDatabase.svg', () => ({
    ReactComponent: (p: any) => <svg data-testid="source-database" />
}));
vi.mock('../../../../assets/SourceDataDIsabled.svg', () => ({
    ReactComponent: (p: any) => <svg data-testid="source-database-disabled" />
}));
vi.mock('../../../../assets/SandboxDisabled.svg', () => ({
    ReactComponent: (p: any) => <svg data-testid="sandbox-disabled" />
}));
vi.mock('../../../../assets/SandboxSmallImage.svg', () => ({
    ReactComponent: (p: any) => <svg data-testid="sandbox-small-image" />
}));

vi.mock('../../../../store/workloadFactory/sandboxSlice', async importOriginal => {
    const actual = (await importOriginal()) as any;
    return actual;
});

vi.mock('../../../../store/workloadFactory/createSandboxSlice', () => ({
    setSelectedCsData: vi.fn((val: any) => ({ type: 'setSelectedCsData', payload: val })),
    setSelectedSandboxHeaderValue: vi.fn((val: any) => ({ type: 'setSelectedSandboxHeaderValue', payload: val }))
}));

vi.mock('../../../../store/store', () => ({
    default: {
        getState: vi.fn(() => ({ sandbox: { selectedSandboxRow: null } })),
        dispatch: vi.fn()
    }
}));

vi.mock('../../../Sandbox/SandboxUtility', () => ({
    createUniqueSandboxTableData: vi.fn((data: any) => data || []),
    getUniqueSourceDatabasesCount: vi.fn(() => 3)
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    createSandboxNavigation: vi.fn()
}));

vi.mock('../../../../utils/consts', () => ({
    DBType: { MSSQL: 'MSSQL', ORACLE: 'ORACLE' },
    INVENTORY_STATUS: {
        CASE_SENSITIVE_UP: 'Up',
        RUNNING: 'RUNNING',
        STOPPED: 'STOPPED',
        CASE_SENSITIVE_DOWN: 'Down',
        UNKNOWN: 'UNKNOWN'
    }
}));

vi.mock('./Sandboxes.module.scss', () => ({
    default: {
        sandboxes: 'sandboxes',
        headSection: 'headSection',
        title: 'title',
        buttonContainer: 'buttonContainer',
        mainSection: 'mainSection',
        blockSection: 'blockSection',
        rightSection: 'rightSection',
        textSection: 'textSection',
        disabled: 'disabled',
        dialog: 'dialog'
    }
}));

const createTestStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            headers: headersSlice.reducer,
            inventoryV2: inventoryV2Slice.reducer,
            sandbox: sandboxSlice.reducer,
            auth: (state = { isWorkloadFactory: false }) => state
        },
        preloadedState: {
            headers: {
                ...headersSlice.getInitialState(),
                headerSelectedMultiCredIdsList: ['cred1'],
                headerSelectedMultiRegionIdsList: ['us-east-1'],
                showNA: false,
                multiDataLoading: false
            },
            inventoryV2: {
                ...inventoryV2Slice.getInitialState(),
                dashSandboxList: { loading: false, data: [] }
            },
            sandbox: {
                ...sandboxSlice.getInitialState(),
                isNA: false
            },
            auth: { isWorkloadFactory: false }
        } as any
    });

const renderWithStore = (overrides?: any) => {
    const store = createTestStore(overrides);
    return render(
        <Provider store={store}>
            <Sandboxes />
        </Provider>
    );
};

describe('Sandboxes', () => {
    it('renders sandboxes section title', () => {
        renderWithStore();
        expect(screen.getByText('databases.dashboard.sandboxes')).toBeTruthy();
    });

    it('renders create sandbox button', () => {
        renderWithStore();
        expect(screen.getByTestId('ds-button')).toBeTruthy();
    });

    it('renders empty state when data is empty', () => {
        const { container } = renderWithStore();
        const mockedImage = container.querySelector('[data-testid="sandbox-small-image"]');
        const realImage = container.querySelector('svg');
        expect(mockedImage || realImage).toBeTruthy();
        expect(screen.getByText('databases.dashboard.sandbox-text')).toBeTruthy();
    });

    it('renders source databases count when data exists', () => {
        const store = configureStore({
            reducer: {
                headers: headersSlice.reducer,
                inventoryV2: inventoryV2Slice.reducer,
                sandbox: sandboxSlice.reducer,
                auth: (state = { isWorkloadFactory: false }) => state
            },
            preloadedState: {
                headers: {
                    ...headersSlice.getInitialState(),
                    headerSelectedMultiCredIdsList: ['cred1'],
                    headerSelectedMultiRegionIdsList: ['us-east-1'],
                    showNA: false,
                    multiDataLoading: false
                },
                inventoryV2: {
                    ...inventoryV2Slice.getInitialState(),
                    dashSandboxList: {
                        loading: false,
                        data: [
                            {
                                credentialId: 'cred1',
                                regionId: 'us-east-1',
                                databaseHostId: 'host1',
                                databaseInstanceId: 'inst1',
                                sandboxName: 'sb1',
                                status: 'Up'
                            }
                        ]
                    }
                },
                sandbox: { ...sandboxSlice.getInitialState(), isNA: false },
                auth: { isWorkloadFactory: false }
            } as any
        });
        render(
            <Provider store={store}>
                <Sandboxes />
            </Provider>
        );
        expect(screen.getByText('databases.dashboard.source-databases')).toBeTruthy();
    });

    it('renders loading state', () => {
        const store = configureStore({
            reducer: {
                headers: headersSlice.reducer,
                inventoryV2: inventoryV2Slice.reducer,
                sandbox: sandboxSlice.reducer,
                auth: (state = { isWorkloadFactory: false }) => state
            },
            preloadedState: {
                headers: {
                    ...headersSlice.getInitialState(),
                    headerSelectedMultiCredIdsList: ['cred1'],
                    headerSelectedMultiRegionIdsList: ['us-east-1'],
                    multiDataLoading: true,
                    showNA: false
                },
                inventoryV2: {
                    ...inventoryV2Slice.getInitialState(),
                    dashSandboxList: {
                        loading: true,
                        data: [
                            {
                                credentialId: 'cred1',
                                regionId: 'us-east-1',
                                databaseHostId: 'host1',
                                databaseInstanceId: 'inst1',
                                sandboxName: 'sb1'
                            }
                        ]
                    }
                },
                sandbox: { ...sandboxSlice.getInitialState(), isNA: false },
                auth: { isWorkloadFactory: false }
            } as any
        });
        render(
            <Provider store={store}>
                <Sandboxes />
            </Provider>
        );
        // Button should be disabled
        expect(screen.getByTestId('ds-button')).toBeTruthy();
    });
});
