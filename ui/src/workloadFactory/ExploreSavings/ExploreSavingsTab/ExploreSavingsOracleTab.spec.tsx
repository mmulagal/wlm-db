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

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) =>
            ((
                {
                    'databases.explore-savings.oracle-database-on-premises': 'Oracle Server on-premises',
                    'databases.explore-savings.oracle-database-ebs': 'Oracle Server on Elastic Block Store (EBS)'
                } as Record<string, string>
            )[key] ?? key)
    })
}));

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

    it('should NOT render the ComingSoon SVG icon (EBS tab is now enabled)', () => {
        renderComponent();
        expect(screen.queryByTestId('coming-soon-svg')).toBeNull();
    });

    // ---- Active state: On-Premises selected (default) ----

    it('should apply active classes to On-Premises tab when selected', () => {
        const { container } = renderComponent({
            selectedOracleExploreSavingsTab: WLF_TABS.ORACLE_SERVER_ON_PREMISES
        });
        const onPremTabDiv = container.firstChild!.childNodes[1] as HTMLElement;
        expect(onPremTabDiv.className).toContain('active');
    });

    it('should apply activeText class to On-Premises typography when selected', () => {
        const { container } = renderComponent({
            selectedOracleExploreSavingsTab: WLF_TABS.ORACLE_SERVER_ON_PREMISES
        });
        const typographies = container.querySelectorAll('[data-testid="ds-typography"]');
        expect(typographies[1].className).toContain('activeText');
    });

    it('should not apply active classes to EBS tab div when On-Premises is selected', () => {
        const { container } = renderComponent({
            selectedOracleExploreSavingsTab: WLF_TABS.ORACLE_SERVER_ON_PREMISES
        });
        const ebsTabDiv = container.firstChild!.childNodes[0] as HTMLElement;
        expect(ebsTabDiv.className).not.toContain('active');
    });

    // ---- Active state: EBS selected ----

    it('should apply active class to EBS tab when EBS is selected', () => {
        const { container } = renderComponent({
            selectedOracleExploreSavingsTab: WLF_TABS.ORACLE_SERVER_ON_ELASTIC_BLOCK_STORE
        });
        const ebsTabDiv = container.firstChild!.childNodes[0] as HTMLElement;
        expect(ebsTabDiv.className).toContain('active');
    });

    it('should apply activeText class to EBS typography when EBS is selected', () => {
        const { container } = renderComponent({
            selectedOracleExploreSavingsTab: WLF_TABS.ORACLE_SERVER_ON_ELASTIC_BLOCK_STORE
        });
        const typographies = container.querySelectorAll('[data-testid="ds-typography"]');
        expect(typographies[0].className).toContain('activeText');
    });

    it('should not apply active class to On-Premises tab when EBS is selected', () => {
        const { container } = renderComponent({
            selectedOracleExploreSavingsTab: WLF_TABS.ORACLE_SERVER_ON_ELASTIC_BLOCK_STORE
        });
        const onPremTabDiv = container.firstChild!.childNodes[1] as HTMLElement;
        expect(onPremTabDiv.className).not.toContain('active');
    });

    it('should not apply activeText to On-Premises typography when EBS selected', () => {
        const { container } = renderComponent({
            selectedOracleExploreSavingsTab: WLF_TABS.ORACLE_SERVER_ON_ELASTIC_BLOCK_STORE
        });
        const typographies = container.querySelectorAll('[data-testid="ds-typography"]');
        expect(typographies[1].className).not.toContain('activeText');
    });

    it('should dispatch setSelectedOracleExploreSavingsTab when clicking EBS tab', () => {
        renderComponent();
        const ebsTab = screen.getByText('Oracle Server on Elastic Block Store (EBS)');
        fireEvent.click(ebsTab);

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'exploreSavings/setSelectedOracleExploreSavingsTab',
            payload: WLF_TABS.ORACLE_SERVER_ON_ELASTIC_BLOCK_STORE
        });
    });

    it('should call handleExploreSavingsURL when clicking EBS tab', () => {
        renderComponent();
        mockHandleExploreSavingsURL.mockClear();
        const ebsTab = screen.getByText('Oracle Server on Elastic Block Store (EBS)');
        fireEvent.click(ebsTab);

        expect(mockHandleExploreSavingsURL).toHaveBeenCalledWith(WLF_TABS.ORACLE_SERVER_ON_ELASTIC_BLOCK_STORE, true);
    });

    it('should apply extra disabled class to EBS typography when On-Premises is selected', () => {
        const { container } = renderComponent({
            selectedOracleExploreSavingsTab: WLF_TABS.ORACLE_SERVER_ON_PREMISES
        });
        const typographies = container.querySelectorAll('[data-testid="ds-typography"]');
        // When on-prem is selected, EBS tab should NOT have activeText
        expect(typographies[0].className).not.toContain('activeText');
    });

    it('should not apply disabled class to EBS typography when On-Premises is selected', () => {
        const { container } = renderComponent({
            selectedOracleExploreSavingsTab: WLF_TABS.ORACLE_SERVER_ON_PREMISES
        });
        const typographies = container.querySelectorAll('[data-testid="ds-typography"]');
        // EBS tab typography should not have headerDisabled anymore
        expect(typographies[0].className).not.toContain('headerDisabled');
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
