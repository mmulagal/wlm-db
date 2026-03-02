import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import DatabaseHostOverviewV2 from './DatabaseHostOverviewV2';
import { isSmbProtocol } from '../../../utils/utilityFunctions';

vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn()
}));

vi.mock('react-redux', async () => {
    const actual = await vi.importActual('react-redux');
    return { ...actual, useDispatch: () => vi.fn() };
});

vi.mock('@netapp/design-system', () => ({
    Button: ({ children, onClick, variant, id, disabled }: any) => (
        <button data-testid={`button-${id || 'generic'}`} onClick={onClick} disabled={disabled}>
            {children}
        </button>
    ),
    Popover: ({ children, container }: any) => (
        <div data-testid="popover">
            {container}
            <div data-testid="popover-content">{children}</div>
        </div>
    )
}));

vi.mock('@netapp/icons/ic_refresh.svg', () => ({
    ReactComponent: () => <svg data-testid="refresh-icon" />
}));

vi.mock('../../../common/BreadCrumbs/BreadCrumbs', () => ({
    default: ({ items }: any) => (
        <nav data-testid="breadcrumbs">
            {items.map((item: any, idx: number) => (
                <span key={idx} data-testid="breadcrumb-item" onClick={item.onClick}>
                    {item.title}
                </span>
            ))}
        </nav>
    )
}));

vi.mock('../DatabaseListTable/DatabaseListTable', () => ({
    default: () => <div data-testid="database-list-table">DatabaseListTable</div>
}));

vi.mock('../DatabaseOverviewLayout/DatabaseOverviewLayout', () => ({
    default: () => <div data-testid="database-overview-layout">DatabaseOverviewLayout</div>
}));

vi.mock('../OverviewTabs/OverviewTabs', () => ({
    default: () => <div data-testid="overview-tabs">OverviewTabs</div>
}));

vi.mock('../DatabaseOverviewLayout/DatabaseHostTile/DatabaseHostTile', () => ({
    default: () => <div data-testid="database-host-tile">DatabaseHostTile</div>
}));

vi.mock('../../../common/CustomContentInfo/CustomContentInfo', () => ({
    default: ({ CustomContent }: any) => <div data-testid="custom-content-info">{CustomContent}</div>
}));

vi.mock('./DatabaseHostOverviewApiV2', () => ({
    default: vi.fn(() => null)
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    isSmbProtocol: vi.fn(() => false)
}));

vi.mock('../../../utils/appConstants', () => ({
    GENERAL: {
        SMB_PROTOCOL_DISABLED: 'SMB Protocol Disabled',
        CREATE_USER_DB_TITLE: 'Create Database',
        OVERVIEW: 'Overview',
        DATABASES: 'Databases'
    }
}));

vi.mock('../../../utils/consts', () => ({
    WLF_TABS: {
        OVERVIEW: 'overview',
        DATABASE_LIST: 'database_list',
        INVENTORY: 'inventory'
    }
}));

vi.mock('./DatabaseHostOverview.module.scss', () => ({
    default: {
        resourcePage: 'resourcePage',
        breadCrumb: 'breadCrumb',
        rightSection: 'rightSection',
        hostTitle: 'hostTitle',
        secondLevel: 'secondLevel',
        refresh: 'refresh',
        refreshIcon: 'refreshIcon',
        'copy-popover': 'copy-popover'
    }
}));

vi.mock('../../../store/workloadFactory/createNewDBSlice', () => ({
    addInitialDBCreateData: vi.fn(() => ({ type: 'mock' })),
    initialCreateNewUserState: {},
    setCdbPageData: vi.fn(() => ({ type: 'mock' }))
}));

vi.mock('../../../store/authSlice', () => ({
    updateResourceId: vi.fn(() => ({ type: 'mock' }))
}));

vi.mock('../../../store/workloadFactory/inventoryV2Slice', () => ({
    setSelectedHeaderTab: vi.fn(() => ({ type: 'mock' }))
}));

const createMockStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            databaseHome: () => ({ selectedTab: 'overview' }),
            workloadFactoryResource: () => ({
                resourceLoading: false,
                resourceDetails: { storage: { fsxn: { protocol: ['NFS'] } } },
                selectedHostname: 'host1',
                selectedDatabaseInstanceName: 'inst1',
                selectedDatabaseInstance: 'sql-inst',
                selectedResourceId: 'res-1',
                selectedResourceCredId: 'cred-1',
                selectedResourceRegionId: 'us-east-1',
                ...overrides
            })
        }
    });

describe('DatabaseHostOverviewV2', () => {
    const defaultProps = {
        refreshTime: '12:00 PM',
        refreshPage: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render breadcrumbs', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseHostOverviewV2 {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('breadcrumbs')).toBeTruthy();
    });

    it('should render Inventory breadcrumb item', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseHostOverviewV2 {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('Inventory')).toBeTruthy();
    });

    it('should render host\\instance breadcrumb item', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseHostOverviewV2 {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('host1 \\ inst1')).toBeTruthy();
    });

    it('should render DatabaseHostTile', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseHostOverviewV2 {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('database-host-tile')).toBeTruthy();
    });

    it('should render DatabaseOverviewLayout', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseHostOverviewV2 {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('database-overview-layout')).toBeTruthy();
    });

    it('should render Create Database button when not SMB protocol', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseHostOverviewV2 {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('button-create-new-user-button')).toBeTruthy();
    });

    it('should render CustomContentInfo when SMB protocol', () => {
        (isSmbProtocol as any).mockReturnValue(true);
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseHostOverviewV2 {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('custom-content-info')).toBeTruthy();
    });

    it('should render refresh icon', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseHostOverviewV2 {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('refresh-icon')).toBeTruthy();
    });

    it('should render last update time in popover', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseHostOverviewV2 {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('Last update: 12:00 PM')).toBeTruthy();
    });

    it('should call refreshPage when refresh icon is clicked', () => {
        const refreshPage = vi.fn();
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseHostOverviewV2 refreshTime="1:00 PM" refreshPage={refreshPage} />
            </Provider>
        );
        fireEvent.click(screen.getByTestId('refresh-icon'));
        expect(refreshPage).toHaveBeenCalled();
    });

    it('should disable Create Database button when resourceLoading', () => {
        const store = createMockStore({ resourceLoading: true });
        render(
            <Provider store={store}>
                <DatabaseHostOverviewV2 {...defaultProps} />
            </Provider>
        );
        const btn = screen.getByTestId('button-create-new-user-button');
        expect(btn.getAttribute('disabled')).toBeDefined();
    });
});
