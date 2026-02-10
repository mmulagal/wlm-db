import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SavingsHeader from './SavingsHeader';
import { GENERAL } from '../../../../utils/appConstants';
import { SAVINGS_CALC_MODE, WLF_TABS } from '../../../../utils/consts';

// Mocks
vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, className }: any) => <span className={className}>{children}</span>
}));

vi.mock('../../../../assets/MS-sql-icon.svg', () => ({
    ReactComponent: () => <svg data-testid="mssql-icon" />
}));

vi.mock('./SavingsHeader.module.scss', () => ({
    default: {
        savingsHeader: 'savingsHeader',
        savingsHeaderFSX: 'savingsHeaderFSX',
        savingsHeaderOnPrem: 'savingsHeaderOnPrem',
        setImage: 'setImage',
        content: 'content'
    }
}));

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            exploreSavings: () => ({
                savingsCalculatorFrom: null,
                selectedExploreSavingsTab: null,
                ...overrides
            })
        }
    });

describe('SavingsHeader', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders the MSSQL icon', () => {
        const { container } = render(<Provider store={makeStore({ savingsCalculatorFrom: SAVINGS_CALC_MODE.AUTO_EBS })}><SavingsHeader /></Provider>);
        expect(container.querySelector('[data-testid="mssql-icon"]')).toBeTruthy();
    });

    it('shows EBS header text for MANUAL_EBS', () => {
        const { container } = render(<Provider store={makeStore({ savingsCalculatorFrom: SAVINGS_CALC_MODE.MANUAL_EBS })}><SavingsHeader /></Provider>);
        expect(container.textContent).toContain(GENERAL.SAVINGS_HEADER);
    });

    it('shows EBS header text for AUTO_EBS', () => {
        const { container } = render(<Provider store={makeStore({ savingsCalculatorFrom: SAVINGS_CALC_MODE.AUTO_EBS })}><SavingsHeader /></Provider>);
        expect(container.textContent).toContain(GENERAL.SAVINGS_HEADER);
    });

    it('shows FSX header text for AUTO_FSXW', () => {
        const { container } = render(<Provider store={makeStore({ savingsCalculatorFrom: SAVINGS_CALC_MODE.AUTO_FSXW, selectedExploreSavingsTab: 'other' })}><SavingsHeader /></Provider>);
        expect(container.textContent).toContain(GENERAL.SAVINGS_HEADER_FSX);
    });

    it('shows OnPrem header text for MSSQL_ON_PREMISES tab', () => {
        const { container } = render(<Provider store={makeStore({ savingsCalculatorFrom: SAVINGS_CALC_MODE.ONPREM, selectedExploreSavingsTab: WLF_TABS.MSSQL_ON_PREMISES })}><SavingsHeader /></Provider>);
        expect(container.textContent).toContain(GENERAL.SAVINGS_ONPREM_HEADER);
    });

    it('applies EBS css class for AUTO_EBS', () => {
        const { container } = render(<Provider store={makeStore({ savingsCalculatorFrom: SAVINGS_CALC_MODE.AUTO_EBS })}><SavingsHeader /></Provider>);
        expect(container.firstChild).toHaveClass('savingsHeader');
        expect(container.firstChild).not.toHaveClass('savingsHeaderFSX');
    });

    it('applies OnPrem css class for MSSQL_ON_PREMISES', () => {
        const { container } = render(<Provider store={makeStore({ savingsCalculatorFrom: SAVINGS_CALC_MODE.ONPREM, selectedExploreSavingsTab: WLF_TABS.MSSQL_ON_PREMISES })}><SavingsHeader /></Provider>);
        expect(container.firstChild).toHaveClass('savingsHeader');
        expect(container.firstChild).toHaveClass('savingsHeaderOnPrem');
    });

    it('applies FSX css class for FSXW mode (non-onprem tab)', () => {
        const { container } = render(<Provider store={makeStore({ savingsCalculatorFrom: SAVINGS_CALC_MODE.AUTO_FSXW, selectedExploreSavingsTab: 'other' })}><SavingsHeader /></Provider>);
        expect(container.firstChild).toHaveClass('savingsHeader');
        expect(container.firstChild).toHaveClass('savingsHeaderFSX');
    });
});
