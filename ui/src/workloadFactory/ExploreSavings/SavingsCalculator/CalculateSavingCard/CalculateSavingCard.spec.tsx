import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import CalculateSavingCard from './CalculateSavingCard';
import { SAVINGS_CALC_MODE, WLF_TABS } from '../../../../utils/consts';

const TRANSLATIONS: Record<string, string> = {
    'databases.explore-savings.calculate-savings-card-heading': 'Calculate savings on your existing SQL Servers',
    'databases.explore-savings.calculate-savings-card-oracle-heading':
        'Calculate savings on your existing Oracle databases',
    'databases.explore-savings.calculate-savings-card-maybe-later': 'Maybe later',
    'databases.explore-savings.calculate-savings-card-try-it': 'Try it',
    'databases.explore-savings.calculate-savings-card-add-credentials': 'Add credentials',
    'databases.explore-savings.calculate-savings-card-ebs-description':
        'We can calculate how much you\'ll save by comparing the cost of your existing SQL Servers using EBS resources with FSx for ONTAP. Click "Try it" to select specific EBS database hosts to compare with FSx for ONTAP in the calculator.',
    'databases.explore-savings.calculate-savings-card-oracle-ebs-description':
        'We can calculate how much you\'ll save by comparing the cost of your existing Oracle databases using EBS resources with FSx for ONTAP. Click "Try it" to select specific EBS database hosts to compare with FSx for ONTAP in the calculator.',
    'databases.explore-savings.calculate-savings-card-fsxw-description':
        'We can calculate how much you\'ll save by comparing the cost of your existing SQL Servers using FSx for Windows File Server resources with FSx for ONTAP. Click "Try it" to select specific FSx for Windows database hosts to compare with FSx for ONTAP in the calculator.',
    'databases.explore-savings.calculate-savings-card-ebs-no-account-description':
        "We can calculate how much you'll save by comparing the cost of your existing SQL Servers using EBS resources with FSx for ONTAP. Add your credentials, go back to Explore savings, and select the Microsoft SQL Server host you'd like to compare.",
    'databases.explore-savings.calculate-savings-card-oracle-ebs-no-account-description':
        "We can calculate how much you'll save by comparing the cost of your existing Oracle databases using EBS resources with FSx for ONTAP. Add your credentials, go back to Explore savings, and select the Oracle database host you'd like to compare.",
    'databases.explore-savings.calculate-savings-card-fsxw-no-account-description':
        "We can calculate how much you'll save by comparing the cost of your existing SQL Servers using FSx for Windows resources with FSx for ONTAP. Add your credentials, go back to Explore savings, and select the Microsoft SQL Server host you'd like to compare."
};

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => TRANSLATIONS[key] || key })
}));

const mockPostBlueXPMessage = vi.fn();
vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, className, variant }: any) => (
        <span className={className} data-variant={variant}>
            {children}
        </span>
    ),
    DsButton: ({ children, onClick, type, isThin, className }: any) => (
        <button onClick={onClick} data-type={type} className={className}>
            {children}
        </button>
    ),
    BlueXPListeners: { navigate: 'navigate' },
    postBlueXPMessage: (...args: any[]) => mockPostBlueXPMessage(...args)
}));

vi.mock('../../../../assets/storage-credentials.svg', () => ({
    ReactComponent: () => <svg data-testid="storage-cred-icon" />
}));

vi.mock('./CalculateSavingCard.module.scss', () => ({
    default: {
        'calculate-savings-card': 'calculate-savings-card',
        content: 'content',
        heading: 'heading',
        text: 'text',
        buttonContainer: 'buttonContainer',
        button: 'button'
    }
}));

vi.mock('../../../../store/workloadFactory/exploreSavingsSlice', () => ({
    setSelectedExploreSavingsTab: (val: any) => ({ type: 'test/setSelectedExploreSavingsTab', payload: val })
}));

vi.mock('../../../../store/workloadFactory/inventoryV2Slice', () => ({
    setSelectedHeaderTab: (val: any) => ({ type: 'test/setSelectedHeaderTab', payload: val })
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    handleExploreSavingsURL: vi.fn()
}));

const makeStore = (overrides: any = {}) => {
    const esSlice = createSlice({
        name: 'exploreSavings',
        initialState: {
            selectedExploreSavingsTab: WLF_TABS.MSSQL_ON_EBS,
            ...overrides
        },
        reducers: {}
    });
    const authSlice = createSlice({
        name: 'auth',
        initialState: { isWorkloadFactory: overrides.isWorkloadFactory ?? false },
        reducers: {}
    });
    const headersSlice = createSlice({
        name: 'headers',
        initialState: {
            getStatus: {
                statusData: 'statusData' in overrides ? overrides.statusData : { isActive: true },
                statusLoading: false
            }
        },
        reducers: {}
    });
    return configureStore({
        reducer: {
            exploreSavings: esSlice.reducer,
            auth: authSlice.reducer,
            headers: headersSlice.reducer
        }
    });
};

const buttonRef = { current: { offsetHeight: 50, offsetLeft: 100, offsetWidth: 200 } };

describe('CalculateSavingCard', () => {
    const mockSetIsCardOpen = vi.fn();

    beforeEach(() => vi.clearAllMocks());

    it('renders the icon', () => {
        render(
            <Provider store={makeStore()}>
                <CalculateSavingCard
                    buttonRef={buttonRef}
                    setIsCardOpen={mockSetIsCardOpen}
                    savingsCalculatorFrom={SAVINGS_CALC_MODE.MANUAL_EBS}
                />
            </Provider>
        );
        expect(screen.getByTestId('storage-cred-icon')).toBeTruthy();
    });

    it('renders heading text', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <CalculateSavingCard
                    buttonRef={buttonRef}
                    setIsCardOpen={mockSetIsCardOpen}
                    savingsCalculatorFrom={SAVINGS_CALC_MODE.MANUAL_EBS}
                />
            </Provider>
        );
        expect(container.textContent).toContain('Calculate savings on your existing SQL Servers');
    });

    it('shows "Try it" button when account is active', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <CalculateSavingCard
                    buttonRef={buttonRef}
                    setIsCardOpen={mockSetIsCardOpen}
                    savingsCalculatorFrom={SAVINGS_CALC_MODE.MANUAL_EBS}
                />
            </Provider>
        );
        expect(container.textContent).toContain('Try it');
    });

    it('shows "Add credentials" button when no account', () => {
        const { container } = render(
            <Provider store={makeStore({ statusData: null })}>
                <CalculateSavingCard
                    buttonRef={buttonRef}
                    setIsCardOpen={mockSetIsCardOpen}
                    savingsCalculatorFrom={SAVINGS_CALC_MODE.MANUAL_EBS}
                />
            </Provider>
        );
        expect(container.textContent).toContain('Add credentials');
    });

    it('shows "Maybe later" button', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <CalculateSavingCard
                    buttonRef={buttonRef}
                    setIsCardOpen={mockSetIsCardOpen}
                    savingsCalculatorFrom={SAVINGS_CALC_MODE.MANUAL_EBS}
                />
            </Provider>
        );
        expect(container.textContent).toContain('Maybe later');
    });

    it('calls setIsCardOpen(false) on Maybe later click', () => {
        render(
            <Provider store={makeStore()}>
                <CalculateSavingCard
                    buttonRef={buttonRef}
                    setIsCardOpen={mockSetIsCardOpen}
                    savingsCalculatorFrom={SAVINGS_CALC_MODE.MANUAL_EBS}
                />
            </Provider>
        );
        fireEvent.click(screen.getByText('Maybe later'));
        expect(mockSetIsCardOpen).toHaveBeenCalledWith(false);
    });

    it('dispatches on Try it click', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <CalculateSavingCard
                    buttonRef={buttonRef}
                    setIsCardOpen={mockSetIsCardOpen}
                    savingsCalculatorFrom={SAVINGS_CALC_MODE.MANUAL_EBS}
                />
            </Provider>
        );
        fireEvent.click(screen.getByText('Try it'));
        expect(dispatchSpy).toHaveBeenCalledWith({
            type: 'test/setSelectedHeaderTab',
            payload: WLF_TABS.EXPLORE_SAVINGS
        });
    });

    it('calls postBlueXPMessage for EBS on Add credentials click', () => {
        render(
            <Provider store={makeStore({ statusData: null })}>
                <CalculateSavingCard
                    buttonRef={buttonRef}
                    setIsCardOpen={mockSetIsCardOpen}
                    savingsCalculatorFrom={SAVINGS_CALC_MODE.MANUAL_EBS}
                />
            </Provider>
        );
        fireEvent.click(screen.getByText('Add credentials'));
        expect(mockPostBlueXPMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'navigate' }));
    });

    it('calls postBlueXPMessage for FSXW on Add credentials click', () => {
        render(
            <Provider store={makeStore({ statusData: null })}>
                <CalculateSavingCard
                    buttonRef={buttonRef}
                    setIsCardOpen={mockSetIsCardOpen}
                    savingsCalculatorFrom="fsxw"
                />
            </Provider>
        );
        fireEvent.click(screen.getByText('Add credentials'));
        expect(mockPostBlueXPMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'navigate' }));
    });

    it('shows EBS-specific text when savingsCalculatorFrom is MANUAL_EBS and account active', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <CalculateSavingCard
                    buttonRef={buttonRef}
                    setIsCardOpen={mockSetIsCardOpen}
                    savingsCalculatorFrom={SAVINGS_CALC_MODE.MANUAL_EBS}
                />
            </Provider>
        );
        expect(container.textContent).toContain('EBS resources');
    });

    it('shows FSXW-specific text when savingsCalculatorFrom is not MANUAL_EBS and account active', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <CalculateSavingCard
                    buttonRef={buttonRef}
                    setIsCardOpen={mockSetIsCardOpen}
                    savingsCalculatorFrom="fsxw"
                />
            </Provider>
        );
        expect(container.textContent).toContain('FSx for Windows File Server');
    });

    it('shows noAccount EBS text when no account and EBS mode', () => {
        const { container } = render(
            <Provider store={makeStore({ statusData: null })}>
                <CalculateSavingCard
                    buttonRef={buttonRef}
                    setIsCardOpen={mockSetIsCardOpen}
                    savingsCalculatorFrom={SAVINGS_CALC_MODE.MANUAL_EBS}
                />
            </Provider>
        );
        expect(container.textContent).toContain('EBS resources');
        expect(container.textContent).toContain('Add your credentials');
    });

    it('shows noAccount FSXW text when no account and FSXW mode', () => {
        const { container } = render(
            <Provider store={makeStore({ statusData: null })}>
                <CalculateSavingCard
                    buttonRef={buttonRef}
                    setIsCardOpen={mockSetIsCardOpen}
                    savingsCalculatorFrom="fsxw"
                />
            </Provider>
        );
        expect(container.textContent).toContain('FSx for Windows');
        expect(container.textContent).toContain('Add your credentials');
    });

    it('handles statusData isActive false', () => {
        const { container } = render(
            <Provider store={makeStore({ statusData: { isActive: false } })}>
                <CalculateSavingCard
                    buttonRef={buttonRef}
                    setIsCardOpen={mockSetIsCardOpen}
                    savingsCalculatorFrom={SAVINGS_CALC_MODE.MANUAL_EBS}
                />
            </Provider>
        );
        expect(container.textContent).toContain('Add credentials');
    });
});
