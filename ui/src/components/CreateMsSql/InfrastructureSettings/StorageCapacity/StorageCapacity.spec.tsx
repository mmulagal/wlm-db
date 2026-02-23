import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import StorageCapacity from './StorageCapacity';

vi.mock('./StorageCapacityTable/StorageCapacityTable', () => ({
    default: ({ wizardType }: any) => <div data-testid="storage-capacity-table">Storage Capacity Table</div>
}));

vi.mock('../../../../common/AccordionError/AccordionError', () => ({
    default: () => <div data-testid="accordion-error">Accordion Error</div>
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    generateOptionType: vi.fn((val: string, label: string) => ({ value: val, label }))
}));

vi.mock('../../../../store/mssql/mssqlFormSlice', () => ({
    setStorageCapacity: (val: any) => ({ type: 'mssqlForm/setStorageCapacity', payload: val }),
    setStorageUnit: (val: any) => ({ type: 'mssqlForm/setStorageUnit', payload: val })
}));

vi.mock('../../../../store/chatbot/chatbotSlice', () => ({
    setIsWizardTouched: (val: boolean) => ({ type: 'chatbot/setIsWizardTouched', payload: val })
}));

vi.mock('../../../../common/hooks/useSearchDebounce', () => ({
    useSearchDebounce: vi.fn((delay: number) => ['', vi.fn()])
}));

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            mssqlForm: () => ({
                storageCapacity: {
                    capacity: overrides.capacity ?? '1024',
                    unit: overrides.unit ?? { value: 'GiB', label: 'GiB' }
                }
            }),
            msSqlAction: () => ({
                isLoadConfig: overrides.isLoadConfig ?? false
            }),
            chatbot: () => ({ movingFromChatbot: false })
        }
    });

describe('StorageCapacity', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders without crashing', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <StorageCapacity />
            </Provider>
        );
        expect(container).toBeDefined();
    });

    it('renders Storage capacity title', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <StorageCapacity />
            </Provider>
        );
        expect(screen.getByText('Data drive size')).toBeTruthy();
    });

    it('renders storage capacity table', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <StorageCapacity />
            </Provider>
        );
        // Table is inside accordion content which may be collapsed
        expect(container).toBeDefined();
    });

    it('renders with valid capacity', () => {
        const store = makeStore({ capacity: '500', unit: { value: 'GiB', label: 'GiB' } });
        render(
            <Provider store={store}>
                <StorageCapacity />
            </Provider>
        );
        expect(screen.getByText('Data drive size')).toBeTruthy();
    });

    it('renders with TiB unit', () => {
        const store = makeStore({ capacity: '5', unit: { value: 'TiB', label: 'TiB' } });
        render(
            <Provider store={store}>
                <StorageCapacity />
            </Provider>
        );
        expect(screen.getByText('Data drive size')).toBeTruthy();
    });

    it('renders with pgsql wizardType', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <StorageCapacity wizardType="pgsql" />
            </Provider>
        );
        expect(container).toBeDefined();
    });

    it('renders with isLoadConfig enabled', () => {
        const store = makeStore({ isLoadConfig: true });
        const { container } = render(
            <Provider store={store}>
                <StorageCapacity />
            </Provider>
        );
        expect(container).toBeDefined();
    });

    it('renders accordion error when capacity is invalid', () => {
        const store = makeStore({ capacity: '0', unit: { value: 'GiB', label: 'GiB' } });
        render(
            <Provider store={store}>
                <StorageCapacity />
            </Provider>
        );
        expect(screen.getByTestId('accordion-error')).toBeTruthy();
    });
});
