import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import InstanceType from './InstanceType';

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

describe('InstanceType', () => {
    const makeStore = (initialState: any = {}) =>
        configureStore({
            reducer: {
                mssql: () => ({
                    getInstanceTypeList: {
                        instanceTypeData: {
                            instanceTypes: [
                                {
                                    instanceType: 't3.medium',
                                    vCpus: 2,
                                    ramInMib: 4096,
                                    iopsInMbps: 100,
                                    architecture: 'x86_64'
                                },
                                {
                                    instanceType: 'm5.large',
                                    vCpus: 2,
                                    ramInMib: 8192,
                                    iopsInMbps: 200,
                                    architecture: 'x86_64'
                                }
                            ]
                        },
                        instanceTypeLoading: false
                    },
                    getCredentials: { credentialData: [{ id: 1 }] },
                    ...initialState.mssql
                }),
                mssqlForm: () => ({
                    instanceType: { label: 't3.medium', value: 't3.medium' },
                    license: { selectedLicenseId: { data: { architecture: 'x86_64' } } },
                    ...initialState.mssqlForm
                }),
                msSqlAction: () => ({
                    isLoadConfig: false,
                    isRecommendedInstance: false,
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

    it('renders instance type component', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <InstanceType />
            </Provider>
        );
        expect(screen.getByTestId('accordion-card')).toBeTruthy();
    });

    it('renders accordion content', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <InstanceType />
            </Provider>
        );
        expect(screen.getByTestId('accordion-content')).toBeTruthy();
    });

    it('shows loading state', () => {
        const store = makeStore({
            mssql: {
                getInstanceTypeList: { instanceTypeLoading: true }
            }
        });
        render(
            <Provider store={store}>
                <InstanceType />
            </Provider>
        );
        const accordion = screen.getByTestId('accordion-card');
        expect(accordion.dataset.loading).toBe('true');
    });

    it('renders with recommended instance badge', () => {
        const store = makeStore({
            msSqlAction: {
                isRecommendedInstance: true
            }
        });
        render(
            <Provider store={store}>
                <InstanceType />
            </Provider>
        );
        expect(screen.getByTestId('accordion-card')).toBeTruthy();
    });
});
