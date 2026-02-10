import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ExploreSavingsOracleTab from './ExploreSavingsOracleTab';
import { WLF_TABS } from '../../../utils/consts';

// ========================
//  Mocks
// ========================

const mockDispatch = vi.fn();
vi.mock('react-redux', async () => {
    const actual = await vi.importActual('react-redux');
    return { ...actual, useDispatch: () => mockDispatch };
});

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, className, onClick }: any) => (
        <span data-testid="ds-typography" className={className} onClick={onClick}>
            {children}
        </span>
    )
}));

vi.mock('../../../assets/comingSoon2.svg', () => ({
    ReactComponent: () => <svg data-testid="coming-soon-svg" />
}));

const mockHandleExploreSavingsURL = vi.fn();
vi.mock('../../../utils/utilityFunctions', () => ({
    handleExploreSavingsURL: (...args: any[]) => mockHandleExploreSavingsURL(...args)
}));

vi.mock('../../../store/workloadFactory/exploreSavingsSlice', () => ({
    setSelectedOracleExploreSavingsTab: (val: any) => ({
        type: 'exploreSavings/setSelectedOracleExploreSavingsTab',
        payload: val
    })
}));

// ========================
//  Helpers
// ========================

const createMockStore = (overrides: Record<string, any> = {}) => {
    const defaults = {
        selectedOracleExploreSavingsTab: WLF_TABS.ORACLE_SERVER_ON_PREMISES,
        isWorkloadFactory: true,
        ...overrides
    };
    return configureStore({
        reducer: {
            exploreSavings: () => ({
                selectedOracleExploreSavingsTab: defaults.selectedOracleExploreSavingsTab
            }),
            auth: () => ({ isWorkloadFactory: defaults.isWorkloadFactory })
        }
    });
};

const renderComponent = (overrides: Record<string, any> = {}) => {
    const store = createMockStore(overrides);
    return render(
        <Provider store={store}>
            <ExploreSavingsOracleTab />
        </Provider>
    );
};

// ========================
//  Tests
// ========================

describe('ExploreSavingsOracleTab', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ---- Rendering ----

    it('should render without crashing', () => {
        const { container } = renderComponent();
        expect(container.firstChild).toBeTruthy();
    });

    it('should render "Oracle Server on-premises" tab text', () => {
        renderComponent();
        expect(screen.getByText('Oracle Server on-premises')).toBeTruthy();
    });

    it('should render "Oracle Server on Elastic Block Store (EBS)" tab text', () => {
        renderComponent();
        expect(screen.getByText('Oracle Server on Elastic Block Store (EBS)')).toBeTruthy();
    });

    it('should render the ComingSoon SVG icon', () => {
        renderComponent();
        expect(screen.getByTestId('coming-soon-svg')).toBeTruthy();
    });

    // ---- Active state: On-Premises selected (default) ----

    it('should apply active classes to On-Premises tab when selected', () => {
        const { container } = renderComponent({
            selectedOracleExploreSavingsTab: WLF_TABS.ORACLE_SERVER_ON_PREMISES
        });
        const firstTabDiv = container.firstChild!.childNodes[0] as HTMLElement;
        expect(firstTabDiv.className).toContain('active');
    });

    it('should apply activeText class to On-Premises typography when selected', () => {
        const { container } = renderComponent({
            selectedOracleExploreSavingsTab: WLF_TABS.ORACLE_SERVER_ON_PREMISES
        });
        const typographies = container.querySelectorAll('[data-testid="ds-typography"]');
        expect(typographies[0].className).toContain('activeText');
    });

    it('should not apply active classes to EBS tab div regardless of selection', () => {
        const { container } = renderComponent({
            selectedOracleExploreSavingsTab: WLF_TABS.ORACLE_SERVER_ON_ELASTIC_BLOCK_STORE
        });
        const secondTabDiv = container.firstChild!.childNodes[1] as HTMLElement;
        expect(secondTabDiv.className).toContain('headerDisabled');
    });

    // ---- Active state: EBS selected ----

    it('should not apply active class to On-Premises tab when EBS is selected', () => {
        const { container } = renderComponent({
            selectedOracleExploreSavingsTab: WLF_TABS.ORACLE_SERVER_ON_ELASTIC_BLOCK_STORE
        });
        const firstTabDiv = container.firstChild!.childNodes[0] as HTMLElement;
        expect(firstTabDiv.className).not.toContain('active');
    });

    it('should not apply activeText to On-Premises typography when EBS selected', () => {
        const { container } = renderComponent({
            selectedOracleExploreSavingsTab: WLF_TABS.ORACLE_SERVER_ON_ELASTIC_BLOCK_STORE
        });
        const typographies = container.querySelectorAll('[data-testid="ds-typography"]');
        expect(typographies[0].className).not.toContain('activeText');
    });

    it('should apply extra disabled class to EBS typography when EBS is selected', () => {
        const { container } = renderComponent({
            selectedOracleExploreSavingsTab: WLF_TABS.ORACLE_SERVER_ON_ELASTIC_BLOCK_STORE
        });
        const typographies = container.querySelectorAll('[data-testid="ds-typography"]');
        expect(typographies[1].className).toContain('headerDisabled');
    });

    it('should apply disabled class to EBS typography when On-Premises is selected', () => {
        const { container } = renderComponent({
            selectedOracleExploreSavingsTab: WLF_TABS.ORACLE_SERVER_ON_PREMISES
        });
        const typographies = container.querySelectorAll('[data-testid="ds-typography"]');
        expect(typographies[1].className).toContain('headerDisabled');
    });

    // ---- useEffect ----

    it('should call handleExploreSavingsURL on mount with selected tab and isWorkloadFactory', () => {
        renderComponent({
            selectedOracleExploreSavingsTab: WLF_TABS.ORACLE_SERVER_ON_PREMISES,
            isWorkloadFactory: true
        });
        expect(mockHandleExploreSavingsURL).toHaveBeenCalledWith(WLF_TABS.ORACLE_SERVER_ON_PREMISES, true);
    });

    it('should call handleExploreSavingsURL with isWorkloadFactory=false', () => {
        renderComponent({ isWorkloadFactory: false });
        expect(mockHandleExploreSavingsURL).toHaveBeenCalledWith(WLF_TABS.ORACLE_SERVER_ON_PREMISES, false);
    });

    // ---- handleClick ----

    it('should dispatch setSelectedOracleExploreSavingsTab on tab click', () => {
        renderComponent();
        const onPremTab = screen.getByText('Oracle Server on-premises');
        fireEvent.click(onPremTab);

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'exploreSavings/setSelectedOracleExploreSavingsTab',
            payload: WLF_TABS.ORACLE_SERVER_ON_PREMISES
        });
    });

    it('should call handleExploreSavingsURL on tab click', () => {
        renderComponent();
        mockHandleExploreSavingsURL.mockClear();
        const onPremTab = screen.getByText('Oracle Server on-premises');
        fireEvent.click(onPremTab);

        expect(mockHandleExploreSavingsURL).toHaveBeenCalledWith(WLF_TABS.ORACLE_SERVER_ON_PREMISES, true);
    });
});
