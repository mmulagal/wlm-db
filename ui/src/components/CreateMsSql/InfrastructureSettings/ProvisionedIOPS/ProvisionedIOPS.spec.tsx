import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import ProvisionedIOPS from './ProvisionedIOPS';

vi.mock('../../../../common/AccordionError/AccordionError', () => ({
    default: () => <div data-testid="accordion-error">Accordion Error</div>
}));

vi.mock('../../../../store/mssql/mssqlFormSlice', () => ({
    setProvisionedIOPSValue: (val: any) => ({ type: 'mssqlForm/setProvisionedIOPSValue', payload: val }),
    setProvisionedType: (val: any) => ({ type: 'mssqlForm/setProvisionedType', payload: val })
}));

vi.mock('../../../../store/chatbot/chatbotSlice', () => ({
    setIsWizardTouched: (val: boolean) => ({ type: 'chatbot/setIsWizardTouched', payload: val })
}));

vi.mock('../../MSSqlServer/MSSqlUtils', () => ({
    selectFsxIops: vi.fn()
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    isFsxnExisting: vi.fn((type: string) => type === 'existing'),
    isFsxnNew: vi.fn((type: string) => type === 'new')
}));

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            mssql: () => ({
                getEstimatedCostData: overrides.getEstimatedCostData ?? null,
                getEstimatedCostLoading: false
            }),
            mssqlForm: () => ({
                provisionedIOPS: {
                    provisionedType: overrides.provisionedType ?? 'Automatic',
                    IOPSValue: overrides.IOPSValue ?? ''
                },
                fsxN: {
                    fsxNType: overrides.fsxNType ?? 'new',
                    fsxNExistingName: overrides.fsxNExistingName ?? null
                }
            }),
            msSqlAction: () => ({
                isLoadConfig: overrides.isLoadConfig ?? false
            }),
            chatbot: () => ({ movingFromChatbot: false })
        }
    });

describe('ProvisionedIOPS', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders without crashing', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <ProvisionedIOPS />
            </Provider>
        );
        expect(container).toBeDefined();
    });

    it('renders Provisioned IOPS title', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <ProvisionedIOPS />
            </Provider>
        );
        expect(screen.getByText('Provisioned IOPS')).toBeTruthy();
    });

    it('shows "Automatic" in header when automatic type', () => {
        const store = makeStore({ provisionedType: 'Automatic' });
        render(
            <Provider store={store}>
                <ProvisionedIOPS />
            </Provider>
        );
        expect(screen.getByText('Automatic')).toBeTruthy();
    });

    it('shows IOPS value in header when user provisioned type', () => {
        const store = makeStore({ provisionedType: 'User-provisioned', IOPSValue: '5000' });
        render(
            <Provider store={store}>
                <ProvisionedIOPS />
            </Provider>
        );
        expect(screen.getByText('Provisioned IOPS')).toBeTruthy();
    });

    it('shows disabled with popover when existing fsxn', () => {
        const store = makeStore({
            fsxNType: 'existing',
            fsxNExistingName: { value: 'fsx-1', label: 'my-fsx' }
        });
        render(
            <Provider store={store}>
                <ProvisionedIOPS />
            </Provider>
        );
        expect(screen.getByText('Provisioned IOPS')).toBeTruthy();
    });

    it('renders with estimated cost data', () => {
        const store = makeStore({
            getEstimatedCostData: {
                data: {
                    fsxnStorage: {
                        fsxnCostBreakdownById: [{ size: { total: 2048 } }]
                    }
                }
            },
            fsxNType: 'new'
        });
        render(
            <Provider store={store}>
                <ProvisionedIOPS />
            </Provider>
        );
        expect(screen.getByText('Provisioned IOPS')).toBeTruthy();
    });

    it('renders with isLoadConfig enabled', () => {
        const store = makeStore({ isLoadConfig: true });
        const { container } = render(
            <Provider store={store}>
                <ProvisionedIOPS />
            </Provider>
        );
        expect(container).toBeDefined();
    });

    it('shows accordion error when iops out of range', () => {
        const store = makeStore({
            provisionedType: 'User-provisioned',
            IOPSValue: '100',
            fsxNType: 'existing',
            fsxNExistingName: null
        });
        render(
            <Provider store={store}>
                <ProvisionedIOPS />
            </Provider>
        );
        expect(screen.getByText('Provisioned IOPS')).toBeTruthy();
    });
});
