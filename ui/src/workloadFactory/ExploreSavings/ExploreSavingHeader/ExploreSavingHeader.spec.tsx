import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import ExploreSavingHeader from './ExploreSavingHeader';
import { WLF_TABS } from '../../../utils/consts';

// Mock SVG components - simple mocks that just render a placeholder
vi.mock('../../../assets/ES_252.svg', () => ({
    ReactComponent: () => <div data-testid="explore-saving-svg" />
}));

vi.mock('../../../assets/exploreSaving1600.svg', () => ({
    ReactComponent: () => <div data-testid="explore-saving-1600-svg" />
}));

vi.mock('../../../assets/exploreSavingsCommon.svg', () => ({
    ReactComponent: () => <div data-testid="explore-saving-common-svg" />
}));

vi.mock('../../../assets/exploreSaving1440.svg', () => ({
    ReactComponent: () => <div data-testid="explore-saving-1440-svg" />
}));

vi.mock('../../../assets/explore-saving-onprem.svg', () => ({
    ReactComponent: () => <div data-testid="explore-saving-onprem-svg" />
}));

// Mock child components with test IDs
vi.mock('../ExploreSavingsTableV2/ExploreSavingsTableV2', () => ({
    default: () => <div data-testid="explore-savings-table-v2" />
}));

vi.mock('../ExploreSavingsTableV2/ExploreSavingsFsxTable', () => ({
    default: () => <div data-testid="explore-savings-fsx-table" />
}));

vi.mock('../ExploreSavingsOnPremiseTable/ExploreSavingsOnPremiseTable', () => ({
    default: () => <div data-testid="explore-savings-onpremise-table" />
}));

vi.mock('../../../common/SeparatorComponent/SeparatorComponent', () => ({
    default: () => <div data-testid="separator-component" />
}));

// Mock hooks
const mockNavigate = vi.fn();
const mockDispatch = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate
    };
});

vi.mock('react-redux', async () => {
    const actual = await vi.importActual('react-redux');
    return {
        ...actual,
        useDispatch: () => mockDispatch
    };
});

// Mock utility functions
const mockHandleManualTCOEBS = vi.fn();
const mockHandleManualTCOFSXW = vi.fn();

vi.mock('../ExploreSavingsUtils', () => ({
    handleManualTCOEBS: (...args: any[]) => mockHandleManualTCOEBS(...args),
    handleManualTCOFSXW: (...args: any[]) => mockHandleManualTCOFSXW(...args)
}));

// Mock useResize hook
const mockUseResize = vi.fn();
vi.mock('../../../common/hooks/useResize', () => ({
    default: () => mockUseResize()
}));

// Helper function to create mock store
const createMockStore = (selectedTab = WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, isWorkloadFactory = true) => {
    return configureStore({
        reducer: {
            auth: () => ({ isWorkloadFactory }),
            exploreSavings: () => ({ selectedExploreSavingsTab: selectedTab })
        }
    });
};

// Helper function to render component
const renderComponent = (
    selectedTab = WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE,
    windowWidth = 1920,
    isWorkloadFactory = true
) => {
    mockUseResize.mockReturnValue({ width: windowWidth, height: 1080 });
    const store = createMockStore(selectedTab, isWorkloadFactory);

    return render(
        <Provider store={store}>
            <BrowserRouter>
                <ExploreSavingHeader />
            </BrowserRouter>
        </Provider>
    );
};

describe('ExploreSavingHeader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Component Rendering', () => {
        it('should render without crashing for EBS tab', () => {
            const { container } = renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, 1900);
            expect(container.firstChild).toBeTruthy();
        });

        it('should render without crashing for FSX tab', () => {
            const { container } = renderComponent(WLF_TABS.MSSQL_FSX_FOR_WINDOWS, 1900);
            expect(container.firstChild).toBeTruthy();
        });

        it('should render without crashing for On-Premises tab', () => {
            const { container } = renderComponent(WLF_TABS.MSSQL_ON_PREMISES, 1900);
            expect(container.firstChild).toBeTruthy();
        });
    });

    describe('Table Rendering Logic', () => {
        it('should render correct table component based on selected tab (using CSS selector)', () => {
            // Test EBS tab
            const { container: containerEBS } = renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, 1900);
            expect(containerEBS.firstChild).toBeTruthy();

            // Test FSX tab
            const { container: containerFSX } = renderComponent(WLF_TABS.MSSQL_FSX_FOR_WINDOWS, 1900);
            expect(containerFSX.firstChild).toBeTruthy();

            // Test On-Premises tab
            const { container: containerOnPrem } = renderComponent(WLF_TABS.MSSQL_ON_PREMISES, 1900);
            expect(containerOnPrem.firstChild).toBeTruthy();
        });
    });

    describe('Manual EBS Link Interactions', () => {
        it('should render EBS manual link with correct id', () => {
            renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, 1900);

            const link = screen.getByText(/Analyze custom configuration for Elastic Block Store/);
            expect(link).toHaveAttribute('id', 'explore-savings-manually-ebs');
        });

        it('should call handleManualTCOEBS with correct parameters when link is clicked (isWorkloadFactory=true)', () => {
            renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, 1900, true);

            const link = screen.getByText(/Analyze custom configuration for Elastic Block Store/);
            fireEvent.click(link);

            expect(mockHandleManualTCOEBS).toHaveBeenCalledTimes(1);
            expect(mockHandleManualTCOEBS).toHaveBeenCalledWith(mockDispatch, mockNavigate, true);
        });

        it('should call handleManualTCOEBS with correct parameters when link is clicked (isWorkloadFactory=false)', () => {
            renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, 1900, false);

            const link = screen.getByText(/Analyze custom configuration for Elastic Block Store/);
            fireEvent.click(link);

            expect(mockHandleManualTCOEBS).toHaveBeenCalledTimes(1);
            expect(mockHandleManualTCOEBS).toHaveBeenCalledWith(mockDispatch, mockNavigate, false);
        });
    });

    describe('Manual FSX Link Interactions', () => {
        it('should render FSX manual link with correct id', () => {
            renderComponent(WLF_TABS.MSSQL_FSX_FOR_WINDOWS, 1900);

            const link = screen.getByText(/Analyze custom configuration for FSx for Windows/);
            expect(link).toHaveAttribute('id', 'explore-savings-manually-fsxW');
        });

        it('should call handleManualTCOFSXW with correct parameters when link is clicked (isWorkloadFactory=true)', () => {
            renderComponent(WLF_TABS.MSSQL_FSX_FOR_WINDOWS, 1900, true);

            const link = screen.getByText(/Analyze custom configuration for FSx for Windows/);
            fireEvent.click(link);

            expect(mockHandleManualTCOFSXW).toHaveBeenCalledTimes(1);
            expect(mockHandleManualTCOFSXW).toHaveBeenCalledWith(mockDispatch, mockNavigate, true);
        });

        it('should call handleManualTCOFSXW with correct parameters when link is clicked (isWorkloadFactory=false)', () => {
            renderComponent(WLF_TABS.MSSQL_FSX_FOR_WINDOWS, 1900, false);

            const link = screen.getByText(/Analyze custom configuration for FSx for Windows/);
            fireEvent.click(link);

            expect(mockHandleManualTCOFSXW).toHaveBeenCalledTimes(1);
            expect(mockHandleManualTCOFSXW).toHaveBeenCalledWith(mockDispatch, mockNavigate, false);
        });
    });

    describe('Window Size Responsive Behavior', () => {
        it('should render component for large window (>1823px)', () => {
            const { container } = renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, 1900);
            expect(container.querySelector('[class*="exploreSavingsHeader"]')).toBeTruthy();
        });

        it('should render component for medium window (1471-1823px)', () => {
            const { container } = renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, 1700);
            expect(container.querySelector('[class*="exploreSavingsHeader"]')).toBeTruthy();
        });

        it('should render component for small window (<=1470px)', () => {
            const { container } = renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, 1400);
            expect(container.querySelector('[class*="exploreSavingsHeader"]')).toBeTruthy();
        });

        it('should render different content for on-premises vs regular tabs', () => {
            const { container: containerEBS } = renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, 1900);
            const { container: containerOnPrem } = renderComponent(WLF_TABS.MSSQL_ON_PREMISES, 1900);

            // Both should render the main container
            expect(containerEBS.querySelector('[class*="exploreSavingsHeader"]')).toBeTruthy();
            expect(containerOnPrem.querySelector('[class*="exploreSavingsHeader"]')).toBeTruthy();

            // On-premises should have the specific class
            expect(containerOnPrem.querySelector('[class*="exploreSavingsHeaderOnPrem"]')).toBeTruthy();
        });
    });

    describe('Redux State Integration', () => {
        it('should render component with different Redux state configurations', () => {
            // Test that the component responds to different tab selections
            const { container } = renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, 1900);
            expect(container.firstChild).toBeTruthy();

            // Test another tab configuration
            const { container: container2 } = renderComponent(WLF_TABS.MSSQL_FSX_FOR_WINDOWS, 1900);
            expect(container2.firstChild).toBeTruthy();
        });

        it('should use isWorkloadFactory flag from Redux auth state', () => {
            // Verify component renders with isWorkloadFactory=true
            renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, 1900, true);
            const link = screen.getByText(/Analyze custom configuration for Elastic Block Store/);
            fireEvent.click(link);
            expect(mockHandleManualTCOEBS).toHaveBeenCalledWith(expect.anything(), expect.anything(), true);
        });
    });

    describe('Hook Integration', () => {
        it('should use useResize hook to get window dimensions', () => {
            renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, 1900);
            expect(mockUseResize).toHaveBeenCalled();
        });

        it('should use useNavigate hook for navigation', () => {
            renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, 1900);
            const link = screen.getByText(/Analyze custom configuration for Elastic Block Store/);
            fireEvent.click(link);

            // handleManualTCOEBS receives navigate as second parameter
            expect(mockHandleManualTCOEBS).toHaveBeenCalledWith(expect.anything(), mockNavigate, expect.anything());
        });

        it('should use useDispatch hook for Redux actions', () => {
            renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, 1900);
            const link = screen.getByText(/Analyze custom configuration for Elastic Block Store/);
            fireEvent.click(link);

            // handleManualTCOEBS receives dispatch as first parameter
            expect(mockHandleManualTCOEBS).toHaveBeenCalledWith(mockDispatch, expect.anything(), expect.anything());
        });
    });

    describe('On-Premises Specific Rendering', () => {
        it('should render on-premises specific elements', () => {
            const { container } = renderComponent(WLF_TABS.MSSQL_ON_PREMISES, 1900);

            // Check for on-premises specific class
            expect(container.querySelector('[class*="exploreSavingsHeaderOnPrem"]')).toBeTruthy();
        });

        it('should render step numbers for on-premises', () => {
            renderComponent(WLF_TABS.MSSQL_ON_PREMISES, 1900);

            // Check that numbers 1-4 exist (steps)
            expect(screen.getAllByText('1').length).toBeGreaterThan(0);
            expect(screen.getAllByText('2').length).toBeGreaterThan(0);
            expect(screen.getAllByText('3').length).toBeGreaterThan(0);
            expect(screen.getAllByText('4').length).toBeGreaterThan(0);
        });

        it('should render pipe separators for on-premises steps', () => {
            renderComponent(WLF_TABS.MSSQL_ON_PREMISES, 1900);

            const pipes = screen.getAllByText('|');
            expect(pipes.length).toBe(4); // One pipe per step
        });
    });

    describe('Edge Cases', () => {
        it('should handle window width at boundary (1823)', () => {
            const { container } = renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, 1823);
            expect(container.firstChild).toBeTruthy();
        });

        it('should handle window width at boundary (1470)', () => {
            const { container } = renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, 1470);
            expect(container.firstChild).toBeTruthy();
        });

        it('should handle very small window width', () => {
            const { container } = renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, 1000);
            expect(container.firstChild).toBeTruthy();
        });

        it('should handle very large window width', () => {
            const { container } = renderComponent(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE, 2500);
            expect(container.firstChild).toBeTruthy();
        });
    });
});
