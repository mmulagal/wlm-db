import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SimpleNotificationService from './SimpleNotificationService';

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
        AccordionCard: ({ children, isLoading, ValueContent, title }: any) => (
            <div data-testid="accordion-card" data-loading={isLoading}>
                <div data-testid="accordion-title">{title}</div>
                <div data-testid="accordion-value">{ValueContent && <ValueContent />}</div>
                {children}
            </div>
        ),
        AccordionCardContent: ({ children }: any) => <div data-testid="accordion-content">{children}</div>,
        ToggleSelector: ({ checked, onChange }: any) => (
            <input type="checkbox" data-testid="toggle-selector" checked={checked} onChange={onChange} />
        ),
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

describe('SimpleNotificationService', () => {
    const makeStore = (initialState: any = {}) =>
        configureStore({
            reducer: {
                mssql: () => ({
                    getSnsList: {
                        snsData: { topics: [{ topicArn: 'arn:aws:sns:us-east-1:123456789:topic1' }] },
                        snsLoading: false
                    },
                    ...initialState.mssql
                }),
                mssqlForm: () => ({
                    simpleNotification: {
                        snsState: false,
                        snsARN: {
                            label: 'arn:aws:sns:us-east-1:123456789:topic1',
                            value: 'arn:aws:sns:us-east-1:123456789:topic1'
                        }
                    },
                    ...initialState.mssqlForm
                }),
                postgreForm: () => ({
                    selectedDatabaseType: 'MSSQL',
                    ...initialState.postgreForm
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

    it('renders SNS component', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <SimpleNotificationService />
            </Provider>
        );
        expect(screen.getByTestId('accordion-card')).toBeTruthy();
    });

    it('displays disabled state by default', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <SimpleNotificationService />
            </Provider>
        );
        expect(screen.getByText('Disabled')).toBeTruthy();
    });

    it('displays enabled state with ARN', () => {
        const store = makeStore({
            mssqlForm: {
                simpleNotification: { snsState: true }
            }
        });
        render(
            <Provider store={store}>
                <SimpleNotificationService />
            </Provider>
        );
        expect(screen.getByText('Enabled')).toBeTruthy();
    });

    it('shows loading state', () => {
        const store = makeStore({
            mssql: {
                getSnsList: { snsLoading: true }
            }
        });
        render(
            <Provider store={store}>
                <SimpleNotificationService />
            </Provider>
        );
        const accordion = screen.getByTestId('accordion-card');
        expect(accordion.dataset.loading).toBe('true');
    });

    it('handles toggle change', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <SimpleNotificationService />
            </Provider>
        );
        const toggle = screen.getByTestId('toggle-selector');
        fireEvent.change(toggle);
        expect(mockDispatch).toHaveBeenCalled();
    });

    it('renders with SNS enabled', () => {
        const store = makeStore({
            mssqlForm: {
                simpleNotification: { snsState: true }
            }
        });
        render(
            <Provider store={store}>
                <SimpleNotificationService />
            </Provider>
        );
        expect(screen.getByTestId('accordion-card')).toBeTruthy();
    });
});
