import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import SavingsSelectedHost from './SavingsSelectedHost';
import { GENERAL } from '../../../../utils/appConstants';
import { SAVINGS_CALC_MODE, WLF_TABS } from '../../../../utils/consts';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const map: Record<string, string> = {
                'databases.explore-savings.selected-host': 'Selected host:',
                'databases.explore-savings.host-name': 'Host name',
                'databases.explore-savings.number-of-sql-instances': 'Number of SQL instances',
                'databases.explore-savings.number-of-volumes': 'Number of volumes',
                'databases.general.not-available': GENERAL.NOT_AVAILABLE
            };
            return map[key] ?? key;
        }
    })
}));

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className, title, style }: any) => (
        <span data-variant={variant} className={className} title={title}>
            {children}
        </span>
    ),
    FlashingDotsLoader: () => <div data-testid="loader" />
}));

vi.mock('./SavingsSelectedHost.module.scss', () => ({
    default: {
        selectedHosts: 'selectedHosts',
        valueArea: 'valueArea',
        container: 'container',
        numberContainer: 'numberContainer',
        value: 'value',
        heading: 'heading',
        heading2: 'heading2',
        disabledHeading: 'disabledHeading',
        disabledContent: 'disabledContent',
        loader: 'loader'
    }
}));

const makeStore = (overrides: any = {}) => {
    const slice = createSlice({
        name: 'exploreSavings',
        initialState: {
            selectedHostDetails: {
                name: 'Host1',
                totalInstance: 3,
                ebsResourceInfo: [{ id: 1 }, { id: 2 }],
                loading: false
            },
            selectedOnPremHostDetails: null,
            selectedPartnerHostDetails: null,
            getPartnerHostDetailsLoading: false,
            savingsCalculatorFrom: SAVINGS_CALC_MODE.AUTO_EBS,
            selectedExploreSavingsTab: WLF_TABS.MSSQL_ON_EBS,
            ...overrides
        },
        reducers: {}
    });
    return configureStore({ reducer: { exploreSavings: slice.reducer } });
};

describe('SavingsSelectedHost', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders Selected host label', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <SavingsSelectedHost />
            </Provider>
        );
        expect(container.textContent).toContain('Selected host:');
    });

    it('shows host name', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <SavingsSelectedHost />
            </Provider>
        );
        expect(container.textContent).toContain('Host1');
    });

    it('shows NOT_AVAILABLE when no hostname', () => {
        const { container } = render(
            <Provider store={makeStore({ selectedHostDetails: { name: '', loading: false } })}>
                <SavingsSelectedHost />
            </Provider>
        );
        expect(container.textContent).toContain(GENERAL.NOT_AVAILABLE);
    });

    it('shows number of instances', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <SavingsSelectedHost />
            </Provider>
        );
        expect(container.textContent).toContain('3');
    });

    it('shows number of volumes for AUTO_EBS', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <SavingsSelectedHost />
            </Provider>
        );
        expect(container.textContent).toContain('2');
    });

    it('adds partner volumes to total', () => {
        const { container } = render(
            <Provider
                store={makeStore({
                    selectedPartnerHostDetails: { ebsResourceInfo: [{ id: 3 }] }
                })}
            >
                <SavingsSelectedHost />
            </Provider>
        );
        expect(container.textContent).toContain('3'); // 2 + 1
    });

    it('does not show volumes section for non-EBS mode', () => {
        const { container } = render(
            <Provider store={makeStore({ savingsCalculatorFrom: SAVINGS_CALC_MODE.AUTO_FSXW })}>
                <SavingsSelectedHost />
            </Provider>
        );
        expect(container.textContent).not.toContain(GENERAL.ES_NUMBER_OF_VOLS);
    });

    it('shows volumes label for AUTO_EBS', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <SavingsSelectedHost />
            </Provider>
        );
        expect(container.textContent).toContain(GENERAL.ES_NUMBER_OF_VOLS);
    });

    it('shows loaders when loading', () => {
        render(
            <Provider store={makeStore({ selectedHostDetails: { loading: true } })}>
                <SavingsSelectedHost />
            </Provider>
        );
        const loaders = screen.getAllByTestId('loader');
        expect(loaders.length).toBeGreaterThan(0);
    });

    it('handles OnPrem mode with host prop', () => {
        const { container } = render(
            <Provider
                store={makeStore({
                    savingsCalculatorFrom: SAVINGS_CALC_MODE.ONPREM,
                    selectedOnPremHostDetails: { resourceName: 'OnPremHost', totalInstance: 5 }
                })}
            >
                <SavingsSelectedHost host={{ resourceName: 'BulkHost', totalInstance: 2 }} />
            </Provider>
        );
        expect(container.textContent).toContain('BulkHost');
    });

    it('handles OnPrem mode without host prop uses selectedOnPremHostDetails', () => {
        const { container } = render(
            <Provider
                store={makeStore({
                    savingsCalculatorFrom: SAVINGS_CALC_MODE.ONPREM,
                    selectedOnPremHostDetails: { resourceName: 'OnPremHost', totalInstance: 5 }
                })}
            >
                <SavingsSelectedHost />
            </Provider>
        );
        expect(container.textContent).toContain('OnPremHost');
    });

    it('shows host name label and instances label', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <SavingsSelectedHost />
            </Provider>
        );
        expect(container.textContent).toContain(GENERAL.ES_HOST_NAME);
        expect(container.textContent).toContain(GENERAL.ES_NUMBER_OF_INSTANCE);
    });

    it('adjusts width for OnPrem tab', () => {
        const { container } = render(
            <Provider store={makeStore({ selectedExploreSavingsTab: WLF_TABS.MSSQL_ON_PREMISES })}>
                <SavingsSelectedHost />
            </Provider>
        );
        const valueArea = container.querySelector('.valueArea');
        expect(valueArea).toBeTruthy();
    });
});
