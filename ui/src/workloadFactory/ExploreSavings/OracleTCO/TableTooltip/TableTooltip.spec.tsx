import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import TableTooltip from './TableTooltip';
import { DBType } from '../../../../utils/consts';

// Mock SVG component
vi.mock('../../../../assets/ic_bullet.svg', () => ({
    ReactComponent: () => <div data-testid="bullet-svg" />
}));

// Helper function to create mock store
const createMockStore = (selectedTCOHostType: string = DBType.MSSQL) =>
    configureStore({
        reducer: {
            exploreSavings: () => ({ selectedTCOHostType })
        }
    });

// Helper function to render component
const renderComponent = (selectedTCOHostType: string = DBType.MSSQL) => {
    const store = createMockStore(selectedTCOHostType);
    return render(
        <Provider store={store}>
            <TableTooltip />
        </Provider>
    );
};

describe('TableTooltip', () => {
    describe('MSSQL Host Type', () => {
        it('should render without crashing', () => {
            const { container } = renderComponent(DBType.MSSQL);
            expect(container.firstChild).toBeTruthy();
        });

        it('should set width to 690px for MSSQL', () => {
            const { container } = renderComponent(DBType.MSSQL);
            const infoContainer = container.firstChild as HTMLElement;
            expect(infoContainer.style.width).toBe('690px');
        });

        it('should render bullet icon in first item for MSSQL', () => {
            renderComponent(DBType.MSSQL);
            const bullets = screen.getAllByTestId('bullet-svg');
            // Two bullets: one in first item, one in second item
            expect(bullets).toHaveLength(2);
        });

        it('should render tooltip content text', () => {
            renderComponent(DBType.MSSQL);
            expect(screen.getByText('databases.explore-savings.table-tooltip-content')).toBeTruthy();
        });

        it('should render second item with tooltip-content-two and tooltip-content-three', () => {
            renderComponent(DBType.MSSQL);
            expect(screen.getByText('databases.explore-savings.table-tooltip-content-two')).toBeTruthy();
            expect(screen.getByText('databases.explore-savings.table-tooltip-content-three')).toBeTruthy();
        });
    });

    describe('Oracle Host Type', () => {
        it('should set width to auto for Oracle', () => {
            const { container } = renderComponent(DBType.ORACLE);
            const infoContainer = container.firstChild as HTMLElement;
            expect(infoContainer.style.width).toBe('auto');
        });

        it('should not render bullet icon in first item for Oracle', () => {
            renderComponent(DBType.ORACLE);
            expect(screen.queryByTestId('bullet-svg')).toBeNull();
        });

        it('should render tooltip content text for Oracle', () => {
            renderComponent(DBType.ORACLE);
            expect(screen.getByText('databases.explore-savings.table-tooltip-content')).toBeTruthy();
        });

        it('should not render the second MSSQL-only item for Oracle', () => {
            renderComponent(DBType.ORACLE);
            expect(screen.queryByText('databases.explore-savings.table-tooltip-content-two')).toBeNull();
            expect(screen.queryByText('databases.explore-savings.table-tooltip-content-three')).toBeNull();
        });
    });
});
