import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ThroughputCapacity from './ThroughputCapacity';

const { mockDispatch } = vi.hoisted(() => ({
    mockDispatch: vi.fn()
}));

vi.mock('react-redux', async () => {
    const actual = await vi.importActual('react-redux');
    return {
        ...actual,
        useDispatch: () => mockDispatch
    };
});

vi.mock('@netapp/design-system', async () => {
    const actual = await vi.importActual('@netapp/design-system');
    return {
        ...actual,
        AccordionCard: ({ children, isDisabled, ValueContent, title }: any) => (
            <div data-testid="accordion-card" data-disabled={isDisabled}>
                <div data-testid="accordion-title">{title}</div>
                <div data-testid="accordion-value">{ValueContent && <ValueContent />}</div>
                {children}
            </div>
        ),
        AccordionCardContent: ({ children }: any) => <div data-testid="accordion-content">{children}</div>,
        Popover: ({ children }: any) => <div data-testid="popover">{children}</div>,
        SelectField: ({ label, onChange, options }: any) => (
            <div data-testid={`select-${label}`}>
                <select onChange={e => onChange(options[e.target.selectedIndex])}>
                    {options?.map((opt: any, idx: number) => (
                        <option key={idx} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>
        ),
        Typography: ({ children }: any) => <div>{children}</div>
    };
});

describe('ThroughputCapacity', () => {
    const makeStore = (initialState: any = {}) =>
        configureStore({
            reducer: {
                mssqlForm: () => ({
                    throughput: { label: '128 MBps', value: '128 MBps' },
                    regionAndVpc: { selectedRegion: { data: { regionCode: 'us-east-1' } } },
                    fsxN: { fsxNType: 'new', fsxNExistingName: null },
                    ...initialState.mssqlForm
                }),
                mssql: () => ({
                    getThroughputRegions: { throughputRegionList: { regions: [{ regionCode: 'us-east-1' }] } },
                    ...initialState.mssql
                }),
                msSqlAction: () => ({
                    isLoadConfig: false,
                    ...initialState.msSqlAction
                }),
                chatbot: () => ({
                    movingFromChatbot: false,
                    ...initialState.chatbot
                })
            }
        });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders throughput capacity component', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <ThroughputCapacity />
            </Provider>
        );
        expect(screen.getByTestId('accordion-card')).toBeTruthy();
    });

    it('renders accordion content', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <ThroughputCapacity />
            </Provider>
        );
        expect(screen.getByTestId('accordion-content')).toBeTruthy();
    });

    it('renders select field', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <ThroughputCapacity />
            </Provider>
        );
        expect(screen.getByTestId('select-Throughput')).toBeTruthy();
    });

    it('renders with existing FSxN', () => {
        const store = makeStore({
            mssqlForm: {
                fsxN: { fsxNType: 'existing', fsxNExistingName: 'test-fsxn' }
            }
        });
        render(
            <Provider store={store}>
                <ThroughputCapacity />
            </Provider>
        );
        expect(screen.getByTestId('accordion-card')).toBeTruthy();
    });
});
