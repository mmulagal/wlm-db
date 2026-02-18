import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SelectTarget from './SelectTarget';

vi.mock('@netapp/design-system', () => ({
    AccordionCard: ({ children, title, ValueContent, id }: any) => (
        <div data-testid={`accordion-card-${id}`}>
            <div data-testid="accordion-title">{title}</div>
            <ValueContent />
            {children}
        </div>
    ),
    AccordionCardContent: ({ children }: any) => <div data-testid="accordion-card-content">{children}</div>,
    DsTypography: ({ children, variant, className, title: tipTitle }: any) => (
        <div data-testid="ds-typography" data-variant={variant} className={className} title={tipTitle}>
            {children}
        </div>
    ),
    SelectField: ({ label, onChange, value, options, error, defaultValue }: any) => (
        <div data-testid={`select-field-${label?.replace(/ /g, '-')}`}>
            <label>{label}</label>
            <select
                onChange={e => onChange?.({ value: e.target.value, label: e.target.value })}
                value={value?.value || ''}
            >
                {options?.map((opt: any) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            {error && <span data-testid="select-error">{error}</span>}
        </div>
    ),
    TextField: ({ label, onChange, value, error }: any) => (
        <div data-testid={`text-field-${label?.replace(/ /g, '-')}`}>
            <label>{label}</label>
            <input value={value || ''} onChange={e => onChange?.(e)} />
            {error && <span data-testid="text-field-error">{error}</span>}
        </div>
    )
}));

vi.mock('@netapp/design-system/dist/components/Select', () => ({
    optionType: {}
}));

vi.mock('../../../../../common/hooks/useResize', () => ({
    default: vi.fn(() => ({ width: 1600, height: 900 }))
}));

vi.mock('../../../../../utils/utilityFunctions', () => ({
    generateOptionType: vi.fn(
        (value: any, label: any, desc: string, disabled: boolean, tooltip: string, data?: any) => ({
            value,
            label,
            isDisabled: disabled,
            tooltip,
            data
        })
    )
}));

vi.mock('../../../../../store/workloadFactory/createSandboxSlice', () => ({
    setTargetDbHost: vi.fn((val: any) => ({ type: 'createSandbox/setTargetDbHost', payload: val })),
    setTargetDbInstance: vi.fn((val: any) => ({ type: 'createSandbox/setTargetDbInstance', payload: val })),
    setTargetDatabase: vi.fn((val: any) => ({ type: 'createSandbox/setTargetDatabase', payload: val }))
}));

vi.mock('./SelectTarget.module.scss', () => ({
    default: {
        selectTarget: 'selectTarget',
        firstRow: 'firstRow',
        firstRowSmallScreen: 'firstRowSmallScreen',
        secondRow: 'secondRow',
        selectField: 'selectField',
        keyField: 'keyField',
        headerSetter: 'headerSetter',
        actionRequired: 'actionRequired',
        noticeText: 'noticeText',
        dbNameTooltip: 'dbNameTooltip',
        listItem: 'listItem',
        textWidth: 'textWidth'
    }
}));

vi.mock('../../../../../utils/CommonStyles.module.scss', () => ({
    default: {
        'heading-content': 'heading-content',
        separatorSandbox: 'separatorSandbox',
        setHeaderStyleSandbox: 'setHeaderStyleSandbox',
        title: 'title'
    }
}));

vi.mock('../../../../../utils/appConstants', () => ({
    GENERAL: {
        Database_TARGET: 'Database Target',
        TARGET_HOST: 'Target Host',
        TARGET_INSTANCE: 'Target Instance',
        TARGET_DATABASES: 'Target Databases',
        ACTION_REQUIRED: 'Action required',
        TARGET_DATABASE_NOTICE: 'Target database notice',
        DB_NAME_ERROR_CHECK: 'DB name error',
        CREATE_SANDBOX_NAME_TOOLTIP: ['Tooltip 1', 'Tooltip 2', 'Tooltip 3', 'Tooltip 4']
    }
}));

vi.mock('../../../../../utils/consts', () => ({
    STATUS_CONST: { ONLINE: 'ONLINE', UP: 'UP' }
}));

vi.mock('../../../../../common/ActionRequired/ActionRequired', () => ({
    default: () => <div data-testid="action-required" />
}));

vi.mock('../../../../../assets/ic_bullet.svg', () => ({
    ReactComponent: () => <svg data-testid="bullet-icon" />
}));

vi.mock('@netapp/icons/ic_info.svg', () => ({
    ReactComponent: () => <svg data-testid="info-icon" />
}));

vi.mock('../../../SandboxUtility', () => ({
    isValidSandboxName: vi.fn((name: any) => {
        if (!name || name.length === 0) return true;
        if (name.length > 27 || !/^[a-zA-Z0-9/_]+$/.test(name)) return false;
        return true;
    })
}));

const mockAggregatedDbHostList = [
    {
        id: 'host1',
        name: 'Host 1',
        databaseHostStatus: 'ONLINE',
        nodeTopology: { vpcId: 'vpc1' },
        databaseInstancesSummary: [
            {
                databaseInstanceId: 'inst1',
                databaseInstanceName: 'Instance 1',
                status: 'UP',
                databaseInstanceTopology: { fileSystemId: 'fs1' }
            }
        ]
    },
    {
        id: 'host2',
        name: 'Host 2',
        databaseHostStatus: 'ONLINE',
        nodeTopology: { vpcId: 'vpc2' },
        databaseInstancesSummary: []
    }
];

const createMockStore = (overrides: any = {}) => {
    const createSandboxState = {
        target: {
            selectedDatabaseHost: null,
            selectedDatabaseInstance: null,
            selectedDatabase: 'sandbox_db'
        },
        source: {
            selectedDatabaseHost: {
                value: 'host1',
                label: 'Host 1',
                data: { nodeTopology: { vpcId: 'vpc1' } }
            },
            selectedDatabaseInstance: {
                value: 'inst1',
                label: 'Instance 1',
                data: { fileSystemId: 'fs1' }
            }
        },
        aggregatedDbHostList: mockAggregatedDbHostList,
        showError: false,
        dataFilePath: '',
        logFilePath: '',
        ...overrides.createSandbox
    };
    return configureStore({
        reducer: {
            createSandbox: (state = createSandboxState) => state
        }
    });
};

const renderSelectTarget = (storeOverrides: any = {}) => {
    const store = createMockStore(storeOverrides);
    return {
        ...render(
            <Provider store={store}>
                <SelectTarget />
            </Provider>
        ),
        store
    };
};

describe('SelectTarget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the accordion with Database Target title', () => {
        renderSelectTarget();
        expect(screen.getByText('Database Target')).toBeTruthy();
    });

    it('should render Target Host select field', () => {
        renderSelectTarget();
        expect(screen.getByTestId('select-field-Target-Host')).toBeTruthy();
    });

    it('should render Target Instance select field', () => {
        renderSelectTarget();
        expect(screen.getByTestId('select-field-Target-Instance')).toBeTruthy();
    });

    it('should render Target Databases text field', () => {
        renderSelectTarget();
        expect(screen.getByTestId('text-field-Target-Databases')).toBeTruthy();
    });

    it('should show info icon for notice text', () => {
        renderSelectTarget();
        expect(screen.getByTestId('info-icon')).toBeTruthy();
    });

    it('should show notice text', () => {
        renderSelectTarget();
        expect(screen.getByText('Target database notice')).toBeTruthy();
    });

    it('should show ActionRequired when no target database is selected', () => {
        renderSelectTarget({
            createSandbox: {
                target: {
                    selectedDatabaseHost: null,
                    selectedDatabaseInstance: null,
                    selectedDatabase: null
                },
                source: {
                    selectedDatabaseHost: { value: 'host1', data: { nodeTopology: { vpcId: 'vpc1' } } },
                    selectedDatabaseInstance: { value: 'inst1', data: { fileSystemId: 'fs1' } }
                },
                aggregatedDbHostList: mockAggregatedDbHostList,
                showError: false,
                dataFilePath: '',
                logFilePath: ''
            }
        });
        expect(screen.getByTestId('action-required')).toBeTruthy();
    });

    it('should show header with selected host and database when both selected', () => {
        renderSelectTarget({
            createSandbox: {
                target: {
                    selectedDatabaseHost: { value: 'host1', label: 'Target Host 1' },
                    selectedDatabaseInstance: { value: 'inst1', label: 'Target Inst 1' },
                    selectedDatabase: 'my_sandbox_db'
                },
                source: {
                    selectedDatabaseHost: { value: 'host1', data: { nodeTopology: { vpcId: 'vpc1' } } },
                    selectedDatabaseInstance: { value: 'inst1', data: { fileSystemId: 'fs1' } }
                },
                aggregatedDbHostList: mockAggregatedDbHostList,
                showError: false,
                dataFilePath: '',
                logFilePath: ''
            }
        });
        expect(screen.getAllByText(/Target Host/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Target Host 1/).length).toBeGreaterThan(0);
    });

    it('should show error on host when showError is true and no host', () => {
        renderSelectTarget({
            createSandbox: {
                target: {
                    selectedDatabaseHost: null,
                    selectedDatabaseInstance: null,
                    selectedDatabase: 'sandbox_db'
                },
                source: {
                    selectedDatabaseHost: { value: 'host1', data: { nodeTopology: { vpcId: 'vpc1' } } },
                    selectedDatabaseInstance: { value: 'inst1', data: { fileSystemId: 'fs1' } }
                },
                aggregatedDbHostList: mockAggregatedDbHostList,
                showError: true,
                dataFilePath: '',
                logFilePath: ''
            }
        });
        expect(screen.getAllByTestId('select-error').length).toBeGreaterThan(0);
    });

    it('should show DB name error when database name is invalid', async () => {
        const { isValidSandboxName } = await import('../../../SandboxUtility');
        (isValidSandboxName as any).mockReturnValueOnce(false);

        renderSelectTarget({
            createSandbox: {
                target: {
                    selectedDatabaseHost: { value: 'host1', label: 'Host 1' },
                    selectedDatabaseInstance: { value: 'inst1', label: 'Inst 1' },
                    selectedDatabase: 'invalid db name!'
                },
                source: {
                    selectedDatabaseHost: { value: 'host1', data: { nodeTopology: { vpcId: 'vpc1' } } },
                    selectedDatabaseInstance: { value: 'inst1', data: { fileSystemId: 'fs1' } }
                },
                aggregatedDbHostList: [],
                showError: true,
                dataFilePath: 'C:\\short',
                logFilePath: 'D:\\short'
            }
        });

        expect(screen.getAllByTestId('text-field-error').length).toBeGreaterThan(0);
    });

    it('should dispatch setTargetDbHost when host changes', () => {
        const store = createMockStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');

        render(
            <Provider store={store}>
                <SelectTarget />
            </Provider>
        );

        const hostSelect = screen.getByTestId('select-field-Target-Host').querySelector('select');
        if (hostSelect) {
            fireEvent.change(hostSelect, { target: { value: 'host1' } });
        }

        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setTargetDbHost') })
        );
    });

    it('should dispatch setTargetDbInstance(null) when host changes', () => {
        const store = createMockStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');

        render(
            <Provider store={store}>
                <SelectTarget />
            </Provider>
        );

        const hostSelect = screen.getByTestId('select-field-Target-Host').querySelector('select');
        if (hostSelect) {
            fireEvent.change(hostSelect, { target: { value: 'host1' } });
        }

        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setTargetDbInstance') })
        );
    });

    it('should dispatch setTargetDatabase when text field changes', () => {
        const store = createMockStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');

        render(
            <Provider store={store}>
                <SelectTarget />
            </Provider>
        );

        const textInput = screen.getByTestId('text-field-Target-Databases').querySelector('input');
        if (textInput) {
            fireEvent.change(textInput, { target: { value: 'new_sandbox' } });
        }

        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setTargetDatabase') })
        );
    });

    it('should auto-select first target host from filtered list', () => {
        const store = createMockStore({
            createSandbox: {
                target: {
                    selectedDatabaseHost: null,
                    selectedDatabaseInstance: null,
                    selectedDatabase: 'sandbox_db'
                },
                source: {
                    selectedDatabaseHost: {
                        value: 'host1',
                        label: 'Host 1',
                        data: { nodeTopology: { vpcId: 'vpc1' } }
                    },
                    selectedDatabaseInstance: {
                        value: 'inst1',
                        label: 'Instance 1',
                        data: { fileSystemId: 'fs1' }
                    }
                },
                aggregatedDbHostList: mockAggregatedDbHostList,
                showError: false,
                dataFilePath: '',
                logFilePath: ''
            }
        });

        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <SelectTarget />
            </Provider>
        );

        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setTargetDbHost') })
        );
    });

    it('should dispatch setTargetDbHost(null) when no matching target hosts', () => {
        const store = createMockStore({
            createSandbox: {
                target: {
                    selectedDatabaseHost: null,
                    selectedDatabaseInstance: null,
                    selectedDatabase: 'sandbox_db'
                },
                source: {
                    selectedDatabaseHost: null,
                    selectedDatabaseInstance: null
                },
                aggregatedDbHostList: [],
                showError: false,
                dataFilePath: '',
                logFilePath: ''
            }
        });

        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <SelectTarget />
            </Provider>
        );

        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setTargetDbHost'), payload: null })
        );
    });

    describe('small screen (width <= 1500)', () => {
        it('should render Target Databases in first row when width <= 1500', async () => {
            const useResize = (await import('../../../../../common/hooks/useResize')).default;
            (useResize as any).mockReturnValue({ width: 1400, height: 900 });

            renderSelectTarget();
            expect(screen.getAllByTestId('text-field-Target-Databases').length).toBeGreaterThan(0);
        });
    });
});
