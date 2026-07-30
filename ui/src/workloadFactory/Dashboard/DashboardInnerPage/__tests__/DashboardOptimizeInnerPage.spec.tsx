import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import DashboardOptimizeInnerPage from '../DashboardOptimizeInnerPage';

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className, style, ...rest }: any) => (
        <span data-testid={rest['data-testid'] || `typography-${variant}`} className={className} style={style}>
            {children}
        </span>
    )
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsTypography: ({ children, variant, className, style, ...rest }: any) => (
        <span data-testid={rest['data-testid'] || `typography-${variant}`} className={className} style={style}>
            {children}
        </span>
    )
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../../../common/BreadCrumbs/BreadCrumbs', () => ({
    default: ({ items }: any) => (
        <nav data-testid="breadcrumbs">
            {items.map((item: any, i: number) => (
                <span key={i} onClick={item.onClick} data-testid={item.dataTestId || `breadcrumb-${i}`}>
                    {item.title}
                </span>
            ))}
        </nav>
    )
}));

vi.mock('../TagComponent/TagComponent', () => ({
    default: (props: any) => <div data-testid="tag-component">{props.type}</div>
}));

vi.mock('../../../GetWell/OptimizeInnerPage/CloneTabs', () => ({
    default: (props: any) => <div data-testid="clone-tabs" />
}));

vi.mock('../../../GetWell/OptimizeInnerPage/OptimizeCard/OptimizeCard', () => ({
    default: (props: any) => <div data-testid="optimize-card" />
}));

vi.mock('../../../WellArchitectedTab/WellArchitectedTabUtils', () => ({
    engineTypeBasedResourceStr: (_type: any, mssql: string, oracle: string) => mssql
}));

vi.mock('../../../WellArchitectedTab/assessmentFormatUtils', () => ({
    findFlatConfigItem: (_hosts: any, configId: string) => {
        const names: Record<string, string> = {
            'clone-management': 'Clone management',
            crr: 'Cross-Region Replication (CRR)',
            'performance-tier': 'Storage tier'
        };
        return configId ? { id: configId, name: names[configId] ?? configId, categories: [] } : undefined;
    }
}));

vi.mock('../../../../store/workloadFactory/inventoryV2Slice', () => ({
    setSelectedHeaderTab: vi.fn((val: any) => ({ type: 'setSelectedHeaderTab', payload: val }))
}));

vi.mock('../../../../utils/consts', async importOriginal => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
        ...actual,
        WLF_TABS: {
            DASHBOARD: 'dashboard',
            DASHBOARD_INNER_PAGE: 'dashboardInnerPage',
            DASHBOARD_OPTIMIZE_INNER_PAGE: 'dashboardOptimizeInnerPage',
            WELL_ARCHITECTED_TAB: 'wellArchitectedTab'
        }
    };
});

const createMockStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            databaseHome: (
                state = {
                    selectedConfig: 'clone-management',
                    ...overrides.databaseHome
                }
            ) => state,
            getWellOptimize: (
                state = {
                    configEngineType: 'MSSQL',
                    ...overrides.getWellOptimize
                }
            ) => state,
            inventoryV2: (
                state = {
                    allmssqlHostAssessmentData: [],
                    allOracleHostAssessmentData: [],
                    ...overrides.inventoryV2
                }
            ) => state
        }
    });

describe('DashboardOptimizeInnerPage', () => {
    it('renders breadcrumbs', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DashboardOptimizeInnerPage />
            </Provider>
        );
        expect(screen.getByTestId('breadcrumbs')).toBeTruthy();
    });

    it('renders heading with config name', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DashboardOptimizeInnerPage />
            </Provider>
        );
        expect(screen.getAllByText('Clone management').length).toBeGreaterThan(0);
    });

    it('renders optimize card', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DashboardOptimizeInnerPage />
            </Provider>
        );
        expect(screen.getByTestId('optimize-card')).toBeTruthy();
    });

    it('renders tag component', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DashboardOptimizeInnerPage />
            </Provider>
        );
        expect(screen.getByTestId('tag-component')).toBeTruthy();
    });

    it('renders CloneTabs for Clone management config', () => {
        const store = createMockStore({ databaseHome: { selectedConfig: 'clone-management' } });
        render(
            <Provider store={store}>
                <DashboardOptimizeInnerPage />
            </Provider>
        );
        expect(screen.getByTestId('clone-tabs')).toBeTruthy();
    });

    it('does NOT render CloneTabs for non-clone config', () => {
        const store = createMockStore({ databaseHome: { selectedConfig: 'performance-tier' } });
        render(
            <Provider store={store}>
                <DashboardOptimizeInnerPage />
            </Provider>
        );
        expect(screen.queryByTestId('clone-tabs')).toBeNull();
    });

    it('shows CRR as Cross-Region Replication', () => {
        const store = createMockStore({ databaseHome: { selectedConfig: 'crr' } });
        render(
            <Provider store={store}>
                <DashboardOptimizeInnerPage />
            </Provider>
        );
        expect(screen.getAllByText('Cross-Region Replication (CRR)').length).toBeGreaterThan(0);
    });
});
