import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ExploreSavings from './ExploreSavings';
import { DBType } from '../../utils/consts';

// Mock child components
vi.mock('../../common/EngineTypeSelector/TCOEngineTypeSelector', () => ({
    default: () => <div data-testid="tco-engine-type-selector" />
}));

vi.mock('./ExploreSavingsTab/ExploreSavingsTab', () => ({
    default: () => <div data-testid="explore-savings-tab" />
}));

vi.mock('./ExploreSavingHeader/ExploreSavingHeader', () => ({
    default: () => <div data-testid="explore-saving-header" />
}));

vi.mock('./ExploreSavingsTab/ExploreSavingsOracleTab', () => ({
    default: () => <div data-testid="explore-savings-oracle-tab" />
}));

vi.mock('./TCOBanner/TCOBanner', () => ({
    default: () => <div data-testid="tco-banner" />
}));

vi.mock('./OracleTCO/OracleTCOTables', () => ({
    default: () => <div data-testid="oracle-tco-tables" />
}));

// Helper to create mock store
const createMockStore = (selectedTCOHostType: string = DBType.MSSQL) =>
    configureStore({
        reducer: {
            exploreSavings: () => ({ selectedTCOHostType })
        }
    });

// Helper to render component
const renderComponent = (selectedTCOHostType: string = DBType.MSSQL) => {
    const store = createMockStore(selectedTCOHostType);
    return render(
        <Provider store={store}>
            <ExploreSavings />
        </Provider>
    );
};

describe('ExploreSavings', () => {
    describe('Common Rendering', () => {
        it('should render without crashing', () => {
            const { container } = renderComponent();
            expect(container.firstChild).toBeTruthy();
        });

        it('should always render TCOEngineTypeSelector', () => {
            renderComponent();
            expect(screen.getByTestId('tco-engine-type-selector')).toBeTruthy();
        });
    });

    describe('MSSQL Host Type', () => {
        it('should render ExploreSavingsTab for MSSQL', () => {
            renderComponent(DBType.MSSQL);
            expect(screen.getByTestId('explore-savings-tab')).toBeTruthy();
        });

        it('should render ExploreSavingHeader for MSSQL', () => {
            renderComponent(DBType.MSSQL);
            expect(screen.getByTestId('explore-saving-header')).toBeTruthy();
        });

        it('should not render Oracle components for MSSQL', () => {
            renderComponent(DBType.MSSQL);
            expect(screen.queryByTestId('explore-savings-oracle-tab')).toBeNull();
            expect(screen.queryByTestId('tco-banner')).toBeNull();
            expect(screen.queryByTestId('oracle-tco-tables')).toBeNull();
        });
    });

    describe('Oracle Host Type', () => {
        it('should render ExploreSavingsOracleTab for Oracle', () => {
            renderComponent(DBType.ORACLE);
            expect(screen.getByTestId('explore-savings-oracle-tab')).toBeTruthy();
        });

        it('should render TCOBanner for Oracle', () => {
            renderComponent(DBType.ORACLE);
            expect(screen.getByTestId('tco-banner')).toBeTruthy();
        });

        it('should render OracleTCOTables for Oracle', () => {
            renderComponent(DBType.ORACLE);
            expect(screen.getByTestId('oracle-tco-tables')).toBeTruthy();
        });

        it('should not render MSSQL components for Oracle', () => {
            renderComponent(DBType.ORACLE);
            expect(screen.queryByTestId('explore-savings-tab')).toBeNull();
            expect(screen.queryByTestId('explore-saving-header')).toBeNull();
        });
    });
});
