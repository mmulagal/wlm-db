import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import KeyPair from './KepPair';

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
        AccordionCard: ({ children, isDisabled, isLoading, ValueContent, title }: any) => (
            <div data-testid="accordion-card" data-disabled={isDisabled} data-loading={isLoading}>
                <div data-testid="accordion-title">{title}</div>
                <div data-testid="accordion-value">{ValueContent && <ValueContent />}</div>
                {children}
            </div>
        ),
        AccordionCardContent: ({ children }: any) => <div data-testid="accordion-content">{children}</div>,
        SelectField: ({ label, value, onChange, options, defaultValue }: any) => (
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
        Typography: ({ children, className }: any) => <div className={className}>{children}</div>
    };
});

vi.mock('../../../../common/ActionRequired/ActionRequired', () => ({
    default: () => <div data-testid="action-required">Action Required</div>
}));

describe('KeyPair', () => {
    const makeStore = (initialState: any = {}) =>
        configureStore({
            reducer: {
                mssql: () => ({
                    getKeyPairList: {
                        keyPairData: { keyPairs: [{ name: 'key-pair-1' }, { name: 'key-pair-2' }] },
                        keyPairLoading: false
                    },
                    getCredentials: { credentialData: [{ id: 1 }] },
                    ...initialState.mssql
                }),
                mssqlForm: () => ({
                    keyPair: { selectedKeyPair: { label: 'key-pair-1', value: 'key-pair-1' } },
                    ...initialState.mssqlForm
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

    it('renders key pair component', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <KeyPair />
            </Provider>
        );
        expect(screen.getByTestId('accordion-card')).toBeTruthy();
    });

    it('renders accordion content', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <KeyPair />
            </Provider>
        );
        expect(screen.getByTestId('accordion-content')).toBeTruthy();
    });

    it('disables accordion when no credentials', () => {
        const store = makeStore({
            mssql: {
                getCredentials: { credentialData: [] }
            }
        });
        render(
            <Provider store={store}>
                <KeyPair />
            </Provider>
        );
        const accordion = screen.getByTestId('accordion-card');
        expect(accordion.dataset.disabled).toBe('true');
    });

    it('shows loading state', () => {
        const store = makeStore({
            mssql: {
                getKeyPairList: { keyPairLoading: true }
            }
        });
        render(
            <Provider store={store}>
                <KeyPair />
            </Provider>
        );
        const accordion = screen.getByTestId('accordion-card');
        expect(accordion.dataset.loading).toBe('true');
    });

    it('shows action required when no key pair selected', () => {
        const store = makeStore({
            mssqlForm: {
                keyPair: { selectedKeyPair: null }
            }
        });
        render(
            <Provider store={store}>
                <KeyPair />
            </Provider>
        );
        expect(screen.getByTestId('action-required')).toBeTruthy();
    });
});
