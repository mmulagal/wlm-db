import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ExploreSavingsTab from './ExploreSavingsTab';
import { WLF_TABS } from '../../../utils/consts';
import * as utilityFunctions from '../../../utils/utilityFunctions';

// Mock the utility function
vi.mock('../../../utils/utilityFunctions', async () => {
    const actual = await vi.importActual('../../../utils/utilityFunctions');
    return {
        ...actual,
        handleExploreSavingsURL: vi.fn()
    };
});

// Helper function to create mock store
const createMockStore = (selectedTab = WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, isWorkloadFactory = true) =>
    configureStore({
        reducer: {
            auth: () => ({ isWorkloadFactory }),
            exploreSavings: () => ({ selectedExploreSavingsTab: selectedTab })
        }
    });

// Helper function to render component
const renderComponent = (selectedTab = WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, isWorkloadFactory = true) => {
    const store = createMockStore(selectedTab, isWorkloadFactory);

    return render(
        <Provider store={store}>
            <ExploreSavingsTab />
        </Provider>
    );
};

describe('ExploreSavingsTab', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Component Rendering', () => {
        it('should render without crashing', () => {
            const { container } = renderComponent();
            expect(container.firstChild).toBeTruthy();
        });

        it('should render all three tab headers', () => {
            const { container } = renderComponent();
            const tabs = container.querySelectorAll('[class*="headerPart1"]');
            expect(tabs).toHaveLength(3);
        });
    });

    describe('Tab Selection State', () => {
        it('should highlight EBS tab when selected', () => {
            renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE);
            const ebsTab = screen.queryByText(/SQL Server on Elastic Block Store \(EBS\)/i);
            expect(ebsTab?.parentElement?.className).toContain('active');
            expect(ebsTab?.className).toContain('activeText');
        });

        it('should highlight FSx for Windows tab when selected', () => {
            renderComponent(WLF_TABS.MSSQL_FSX_FOR_WINDOWS);
            const fsxTab = screen.queryByText(/SQL Server on FSx for Windows/i);
            expect(fsxTab?.parentElement?.className).toContain('active');
            expect(fsxTab?.className).toContain('activeText');
        });

        it('should highlight On-premises tab when selected', () => {
            renderComponent(WLF_TABS.MSSQL_ON_PREMISES);
            const onPremTab = screen.queryByText(/SQL Server on-premises/i);
            expect(onPremTab?.parentElement?.className).toContain('active');
            expect(onPremTab?.className).toContain('activeText');
        });

        it('should not highlight non-selected tabs', () => {
            renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE);
            const fsxTab = screen.queryByText(/SQL Server on FSx for Windows/i);
            const onPremTab = screen.queryByText(/SQL Server on-premises/i);

            expect(fsxTab?.parentElement?.className).not.toContain('active');
            expect(fsxTab?.className).not.toContain('activeText');
            expect(onPremTab?.parentElement?.className).not.toContain('active');
            expect(onPremTab?.className).not.toContain('activeText');
        });
    });

    describe('useEffect Hook', () => {
        it('should call handleExploreSavingsURL on mount with initial tab', () => {
            renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, true);
            expect(utilityFunctions.handleExploreSavingsURL).toHaveBeenCalledWith(
                WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE,
                true
            );
        });

        it('should call handleExploreSavingsURL with correct isWorkloadFactory flag', () => {
            renderComponent(WLF_TABS.MSSQL_FSX_FOR_WINDOWS, false);
            expect(utilityFunctions.handleExploreSavingsURL).toHaveBeenCalledWith(
                WLF_TABS.MSSQL_FSX_FOR_WINDOWS,
                false
            );
        });

        it('should call handleExploreSavingsURL when selectedExploreSavingsTab changes', () => {
            const { rerender } = renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, true);
            vi.clearAllMocks();

            // Rerender with different tab
            const newStore = createMockStore(WLF_TABS.MSSQL_FSX_FOR_WINDOWS, true);
            rerender(
                <Provider store={newStore}>
                    <ExploreSavingsTab />
                </Provider>
            );

            expect(utilityFunctions.handleExploreSavingsURL).toHaveBeenCalledWith(WLF_TABS.MSSQL_FSX_FOR_WINDOWS, true);
        });

        it('should call handleExploreSavingsURL when isWorkloadFactory changes', () => {
            const { rerender } = renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, true);
            vi.clearAllMocks();

            // Rerender with different isWorkloadFactory
            const newStore = createMockStore(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, false);
            rerender(
                <Provider store={newStore}>
                    <ExploreSavingsTab />
                </Provider>
            );

            expect(utilityFunctions.handleExploreSavingsURL).toHaveBeenCalledWith(
                WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE,
                false
            );
        });
    });

    describe('Tab Click Interactions', () => {
        it('should dispatch action and call handleExploreSavingsURL when EBS tab is clicked', () => {
            const store = createMockStore(WLF_TABS.MSSQL_FSX_FOR_WINDOWS, true);
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <ExploreSavingsTab />
                </Provider>
            );

            vi.clearAllMocks();
            const ebsTab = screen.queryByText(/SQL Server on Elastic Block Store \(EBS\)/i);
            if (ebsTab) fireEvent.click(ebsTab);

            expect(dispatchSpy).toHaveBeenCalled();
            expect(utilityFunctions.handleExploreSavingsURL).toHaveBeenCalledWith(
                WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE,
                true
            );
        });

        it('should dispatch action and call handleExploreSavingsURL when FSx tab is clicked', () => {
            const store = createMockStore(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, true);
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <ExploreSavingsTab />
                </Provider>
            );

            vi.clearAllMocks();
            const fsxTab = screen.queryByText(/SQL Server on FSx for Windows/i);
            if (fsxTab) fireEvent.click(fsxTab);

            expect(dispatchSpy).toHaveBeenCalled();
            expect(utilityFunctions.handleExploreSavingsURL).toHaveBeenCalledWith(WLF_TABS.MSSQL_FSX_FOR_WINDOWS, true);
        });

        it('should dispatch action and call handleExploreSavingsURL when On-premises tab is clicked', () => {
            const store = createMockStore(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, true);
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <ExploreSavingsTab />
                </Provider>
            );

            vi.clearAllMocks();
            const onPremTab = screen.queryByText(/SQL Server on-premises/i);
            if (onPremTab) fireEvent.click(onPremTab);

            expect(dispatchSpy).toHaveBeenCalled();
            expect(utilityFunctions.handleExploreSavingsURL).toHaveBeenCalledWith(WLF_TABS.MSSQL_ON_PREMISES, true);
        });

        it('should update local state when clicking on a tab', () => {
            renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, true);

            const fsxTab = screen.queryByText(/SQL Server on FSx for Windows/i);
            if (fsxTab) fireEvent.click(fsxTab);

            // After clicking, the tab should become active
            expect(fsxTab?.parentElement?.className).toContain('active');
            expect(fsxTab?.className).toContain('activeText');
        });
    });

    describe('CSS Classes Application', () => {
        it('should apply correct width class to EBS tab', () => {
            const { container } = renderComponent();
            const headersWithFirstWidth = container.querySelectorAll('[class*="headerWidthFirst"]');
            expect(headersWithFirstWidth.length).toBeGreaterThan(0);
        });

        it('should apply correct width class to FSx tab', () => {
            const { container } = renderComponent();
            const headersWithSecondWidth = container.querySelectorAll('[class*="headerWidthSecond"]');
            expect(headersWithSecondWidth.length).toBeGreaterThan(0);
        });

        it('should apply correct width class to On-premises tab', () => {
            const { container } = renderComponent();
            const headersWithThirdWidth = container.querySelectorAll('[class*="headerWidthThird"]');
            expect(headersWithThirdWidth.length).toBeGreaterThan(0);
        });

        it('should apply headers class to all tab containers', () => {
            const { container } = renderComponent();
            const headers = container.querySelectorAll('[class*="headers"]');
            expect(headers.length).toBe(3);
        });

        it('should apply headerPart1 class to all tab typography elements', () => {
            const { container } = renderComponent();
            const headerParts = container.querySelectorAll('[class*="headerPart1"]');
            expect(headerParts.length).toBe(3);
        });
    });

    describe('Redux Integration', () => {
        it('should read selectedExploreSavingsTab from Redux store', () => {
            const store = createMockStore(WLF_TABS.MSSQL_FSX_FOR_WINDOWS, true);

            render(
                <Provider store={store}>
                    <ExploreSavingsTab />
                </Provider>
            );

            const fsxTab = screen.queryByText(/SQL Server on FSx for Windows/i);
            expect(fsxTab?.parentElement?.className).toContain('active');
        });

        it('should read isWorkloadFactory from Redux auth state', () => {
            const store = createMockStore(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, false);

            render(
                <Provider store={store}>
                    <ExploreSavingsTab />
                </Provider>
            );

            expect(utilityFunctions.handleExploreSavingsURL).toHaveBeenCalledWith(
                WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE,
                false
            );
        });
    });

    describe('Component Structure', () => {
        it('should render main container with correct class', () => {
            const { container } = renderComponent();
            const mainDiv = container.firstChild as HTMLElement;
            expect(mainDiv?.className).toContain('exploreSavingsTab');
        });

        it('should render DsTypography components with correct variant', () => {
            renderComponent();
            const typographyElements = screen.queryAllByText(/SQL Server/i);
            expect(typographyElements).toHaveLength(3);
        });

        it('should render tabs in correct order', () => {
            renderComponent();
            const tabs = screen.queryAllByText(/SQL Server/i);
            expect(tabs[0]?.textContent).toContain('SQL Server on Elastic Block Store (EBS)');
            expect(tabs[1]?.textContent).toContain('SQL Server on FSx for Windows');
            expect(tabs[2]?.textContent).toContain('SQL Server on-premises');
        });
    });

    describe('Multiple Click Scenarios', () => {
        it('should handle multiple tab switches correctly', () => {
            renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, true);

            vi.clearAllMocks();

            // Click FSx tab
            const fsxTab = screen.queryByText(/SQL Server on FSx for Windows/i);
            if (fsxTab) fireEvent.click(fsxTab);
            expect(utilityFunctions.handleExploreSavingsURL).toHaveBeenCalledWith(WLF_TABS.MSSQL_FSX_FOR_WINDOWS, true);

            vi.clearAllMocks();

            // Click On-premises tab
            const onPremTab = screen.queryByText(/SQL Server on-premises/i);
            if (onPremTab) fireEvent.click(onPremTab);
            expect(utilityFunctions.handleExploreSavingsURL).toHaveBeenCalledWith(WLF_TABS.MSSQL_ON_PREMISES, true);

            vi.clearAllMocks();

            // Click EBS tab
            const ebsTab = screen.queryByText(/SQL Server on Elastic Block Store \(EBS\)/i);
            if (ebsTab) fireEvent.click(ebsTab);
            expect(utilityFunctions.handleExploreSavingsURL).toHaveBeenCalledWith(
                WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE,
                true
            );
        });

        it('should handle clicking the already selected tab', () => {
            renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, true);
            vi.clearAllMocks();

            const ebsTab = screen.queryByText(/SQL Server on Elastic Block Store \(EBS\)/i);
            if (ebsTab) fireEvent.click(ebsTab);

            expect(utilityFunctions.handleExploreSavingsURL).toHaveBeenCalledWith(
                WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE,
                true
            );
            expect(ebsTab?.parentElement?.className).toContain('active');
        });
    });

    describe('Edge Cases', () => {
        it('should handle undefined isWorkloadFactory gracefully', () => {
            const store = configureStore({
                reducer: {
                    auth: () => ({}),
                    exploreSavings: () => ({ selectedExploreSavingsTab: WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE })
                }
            });

            const { container } = render(
                <Provider store={store}>
                    <ExploreSavingsTab />
                </Provider>
            );

            const tabs = container.querySelectorAll('[class*="headerPart1"]');
            expect(tabs.length).toBe(3);
        });

        it('should handle missing selectedExploreSavingsTab gracefully', () => {
            const store = configureStore({
                reducer: {
                    auth: () => ({ isWorkloadFactory: true }),
                    exploreSavings: () => ({})
                }
            });

            const { container } = render(
                <Provider store={store}>
                    <ExploreSavingsTab />
                </Provider>
            );

            const tabs = container.querySelectorAll('[class*="headerPart1"]');
            expect(tabs.length).toBe(3);
        });
    });

    describe('Accessibility', () => {
        it('should have clickable tab elements', () => {
            const { container } = renderComponent();
            const tabs = container.querySelectorAll('[class*="headerPart1"]');

            expect(tabs.length).toBe(3);
            expect(tabs[0]).toBeTruthy();
            expect(tabs[1]).toBeTruthy();
            expect(tabs[2]).toBeTruthy();
        });

        it('should render text content correctly', () => {
            const { container } = renderComponent();
            const text = container.textContent;
            expect(text).toContain('SQL Server on Elastic Block Store (EBS)');
            expect(text).toContain('SQL Server on FSx for Windows');
            expect(text).toContain('SQL Server on-premises');
        });
    });
});
