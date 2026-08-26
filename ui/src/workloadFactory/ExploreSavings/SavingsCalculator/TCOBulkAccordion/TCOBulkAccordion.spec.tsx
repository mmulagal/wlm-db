import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import TCOBulkAccordion from './TCOBulkAccordion';

vi.mock('@netapp/design-system', () => ({
    AccordionCardContent: ({ children, className }: any) => (
        <div data-testid="accordion-content" className={className}>
            {children}
        </div>
    ),
    DsTypography: ({ children, variant, className }: any) => (
        <span data-variant={variant} className={className}>
            {children}
        </span>
    ),
    useDialog: () => ({ setDialog: vi.fn(), closeDialog: vi.fn() }),
    SelectField: ({ label, value, options, onChange, isDisabled, isLoading, variant }: any) => (
        <div
            data-testid={`select-${label?.replace(/\s+/g, '-')}`}
            data-disabled={String(!!isDisabled)}
            data-loading={String(!!isLoading)}
        >
            <button data-testid={`select-btn-${label?.replace(/\s+/g, '-')}`} onClick={() => onChange?.(options?.[0])}>
                change
            </button>
        </div>
    ),
    TextField: ({ label, onChange, value, isOptional }: any) => (
        <div data-testid={`text-field-${label?.replace(/\s+/g, '-')}`}>
            <input aria-label={label} onChange={onChange} value={value || ''} />
        </div>
    ),
    Button: ({ children, onClick, variant }: any) => <button onClick={onClick}>{children}</button>
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsButton: ({ children, onClick, isDisabled, type }: any) => (
        <button data-testid={`ds-button-${children}`} onClick={onClick} disabled={isDisabled}>
            {children}
        </button>
    )
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn()
}));

vi.mock('@netapp/icons/ic_info.svg', () => ({
    ReactComponent: (props: any) => <svg data-testid="info-icon" />
}));

vi.mock('../../../../assets/info.svg', () => ({
    ReactComponent: (props: any) => <svg data-testid="info-svg" />
}));

vi.mock('../../../../common/AccordionCard/AccordionCard', () => ({
    AccordionCard: ({ children, title, id, ValueContent, RightWidget }: any) => (
        <div data-testid={`accordion-card-${id}`}>
            <div data-testid="accordion-title">{title}</div>
            <div data-testid="accordion-value">{ValueContent && <ValueContent />}</div>
            <div data-testid="accordion-right">{RightWidget && <RightWidget />}</div>
            <div data-testid="accordion-children">{children}</div>
        </div>
    ),
    AccordionController: ({ children }: any) => <div data-testid="accordion-controller">{children}</div>
}));

vi.mock('../../../../common/SeparatorComponent/SeparatorComponent', () => ({
    default: ({ variant, height }: any) => <span data-testid="separator">|</span>
}));

vi.mock('../../../../common/Dialog/DialogComponent', () => ({
    default: ({ header, content, primaryButton, callback, closeCallback }: any) => (
        <div data-testid="dialog">
            {header}
            {content}
        </div>
    )
}));

vi.mock('../InstanceInformation/InstanceInformation', () => ({
    default: ({ host }: any) => <div data-testid="instance-info">{host?.name}</div>
}));

vi.mock('../SelectedVolumeSummary/SelectedVolumeSummary', () => ({
    default: ({ host }: any) => <div data-testid="volume-summary">{host?.name}</div>
}));

vi.mock('./TCOAddHostTable/TCOAddHostTable', () => ({
    default: ({ onExploreSavings, onHandlerReady }: any) => (
        <div data-testid="tco-add-host-table">
            <button data-testid="add-host-callback" onClick={onExploreSavings}>
                add
            </button>
        </div>
    )
}));

vi.mock('../SavingsSelection/LearnHowDialog/LearnHowDialog', () => ({
    default: ({ type }: any) => <div data-testid="learn-how-dialog">{type}</div>
}));

vi.mock('./TCOBulkAccordion.module.scss', () => ({
    default: {
        tcoBulkAccordion: 'tcoBulkAccordion',
        header: 'header',
        accordionScrollContainer: 'accordionScrollContainer',
        centerValue: 'centerValue',
        centerText: 'centerText',
        rightWidgetButton: 'rightWidgetButton',
        accordionContent: 'accordionContent',
        ssdContainer: 'ssdContainer',
        setWidth: 'setWidth'
    }
}));

vi.mock('./HostInstanceSelection.module.scss', () => ({
    default: {
        hostInstanceSelection: 'hostInstanceSelection',
        fieldsContainer: 'fieldsContainer',
        fieldWrapper: 'fieldWrapper',
        instanceTypeContainer: 'instanceTypeContainer',
        errorContainer: 'errorContainer'
    }
}));

vi.mock('../../../../utils/CommonStyles.module.scss', () => ({
    default: { title: 'title' }
}));

vi.mock('../../../../store/workloadFactory/exploreSavingsBulkSlice', () => ({
    setSelectedRowsForExploreSavingsEBSBulk: (val: any) => ({ type: 'test/setSelectedRowsEBS', payload: val }),
    setRowsRequiringAuthBulk: (val: any) => ({ type: 'test/setRowsAuth', payload: val }),
    setTriggerBulkDataFetch: (val: any) => ({ type: 'test/setTrigger', payload: val })
}));

vi.mock('../../../../store/workloadFactory/exploreSavingsSlice', () => ({
    setRecommendedTargetInstance: (val: any) => ({ type: 'test/setRecommended', payload: val })
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    generateOptionType: (l: string, v: any, l2?: string) => ({ label: l, value: v, label2: l2 }),
    getSelectedFromSelectionState: (state: any, data: any) => data || []
}));

vi.mock('../../ExploreSavingsUtils', () => ({
    generateLabel2ForInstanceType: () => 'Recommended'
}));

vi.mock('../savingsUtil', () => ({
    checkIfByolFieldRequired: () => false
}));

vi.mock('../../../../common/hooks/useSearchDebounce', () => ({
    useSearchDebounce: () => ['', vi.fn()]
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        EBS: 'EBS',
        CLOSE: 'Close',
        LEARN_HOW: 'Learn how',
        BYOL_TEXT: 'Monthly SQL BYOL costs($)',
        RECOMMENDED_INSTANCE_TYPE: 'Recommended instance type',
        RECOMMENDED_INSTANCE_TYPE_INFO: 'Instance type info',
        MISSING_PERMISSIONS_NOTICE: 'Missing permissions',
        RECOMMENDATIONS_UNAVAILABLE_NOTICE: 'Recommendations unavailable',
        LEARN_HOW_DIALOG: { TITLE: 'Learn how title' }
    }
}));

vi.mock('../../../../utils/consts', () => ({
    SAVINGS_CALC_MODE: { AUTO_EBS: 'Auto_EBS' }
}));

const makeStore = (overrides: any = {}) => {
    const bulkSlice = createSlice({
        name: 'exploreSavingsBulk',
        initialState: {
            ebsTCOAction: null,
            selectedRowsForExploreSavingsEBSBulk: [
                { id: 'host-1', name: 'Host 1', totalInstance: 2, ebsResourceInfo: [{ id: 'vol1' }, { id: 'vol2' }] },
                { id: 'host-2', name: 'Host 2', totalInstance: 1, ebsResourceInfo: [{ id: 'vol3' }] }
            ],
            rowsRequiringAuthBulk: [],
            ...(overrides.bulk || {})
        },
        reducers: {}
    });
    const esSlice = createSlice({
        name: 'exploreSavings',
        initialState: {
            savingsCalculatorFrom: 'Auto_EBS',
            storageSavingsResponse: null,
            storageSavingsLoading: false,
            viewCalculationsResponse: null,
            ...(overrides.es || {})
        },
        reducers: {}
    });
    const authSlice = createSlice({
        name: 'auth',
        initialState: { isWorkloadFactory: false, ...(overrides.auth || {}) },
        reducers: {}
    });
    return configureStore({
        reducer: { exploreSavingsBulk: bulkSlice.reducer, exploreSavings: esSlice.reducer, auth: authSlice.reducer }
    });
};

describe('TCOBulkAccordion', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders accordion controller', () => {
        render(
            <Provider store={makeStore()}>
                <TCOBulkAccordion />
            </Provider>
        );
        expect(screen.getByTestId('accordion-controller')).toBeTruthy();
    });

    it('renders header with selected hosts count', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <TCOBulkAccordion />
            </Provider>
        );
        expect(container.textContent).toContain('databases.explore-savings.selected-hosts');
        expect(container.textContent).toContain('(2)');
    });

    it('renders add hosts button', () => {
        render(
            <Provider store={makeStore()}>
                <TCOBulkAccordion />
            </Provider>
        );
        expect(screen.getByTestId('ds-button-databases.explore-savings.add-hosts')).toBeTruthy();
    });

    it('renders an accordion card for each selected host', () => {
        render(
            <Provider store={makeStore()}>
                <TCOBulkAccordion />
            </Provider>
        );
        expect(screen.getByTestId('accordion-card-host-1')).toBeTruthy();
        expect(screen.getByTestId('accordion-card-host-2')).toBeTruthy();
    });

    it('shows host title in accordion', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <TCOBulkAccordion />
            </Provider>
        );
        expect(container.textContent).toContain('Host 1');
        expect(container.textContent).toContain('Host 2');
    });

    it('shows instance count and volume count in value content', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <TCOBulkAccordion />
            </Provider>
        );
        expect(container.textContent).toContain('2');
        expect(container.textContent).toContain('databases.explore-savings.instances');
        expect(container.textContent).toContain('databases.explore-savings.volumes');
    });

    it('shows volume count from ebsResourceInfo', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <TCOBulkAccordion />
            </Provider>
        );
        // host-1 has 2 volumes, host-2 has 1 volume
        expect(container.textContent).toContain('2');
        expect(container.textContent).toContain('1');
    });

    it('renders InstanceInformation for each host', () => {
        render(
            <Provider store={makeStore()}>
                <TCOBulkAccordion />
            </Provider>
        );
        const instanceInfos = screen.getAllByTestId('instance-info');
        expect(instanceInfos.length).toBe(2);
    });

    it('renders SelectedVolumeSummary for each host', () => {
        render(
            <Provider store={makeStore()}>
                <TCOBulkAccordion />
            </Provider>
        );
        const summaries = screen.getAllByTestId('volume-summary');
        expect(summaries.length).toBe(2);
    });

    it('renders remove button for each host', () => {
        render(
            <Provider store={makeStore()}>
                <TCOBulkAccordion />
            </Provider>
        );
        const removeButtons = screen.getAllByTestId('ds-button-databases.explore-savings.remove');
        expect(removeButtons.length).toBe(2);
    });

    it('disables remove button when only 1 host', () => {
        const store = makeStore({
            bulk: {
                selectedRowsForExploreSavingsEBSBulk: [
                    { id: 'host-1', name: 'Host 1', totalInstance: 1, ebsResourceInfo: [] }
                ]
            }
        });
        render(
            <Provider store={store}>
                <TCOBulkAccordion />
            </Provider>
        );
        const removeBtn = screen.getByTestId('ds-button-databases.explore-savings.remove');
        expect(removeBtn).toHaveAttribute('disabled');
    });

    it('dispatches setSelectedRowsForExploreSavingsEBSBulk on remove', () => {
        const store = makeStore();
        const spy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <TCOBulkAccordion />
            </Provider>
        );
        const removeButtons = screen.getAllByTestId('ds-button-databases.explore-savings.remove');
        fireEvent.click(removeButtons[0]);
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/setSelectedRowsEBS' }));
    });

    it('dispatches setTriggerBulkDataFetch on remove', () => {
        const store = makeStore();
        const spy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <TCOBulkAccordion />
            </Provider>
        );
        const removeButtons = screen.getAllByTestId('ds-button-databases.explore-savings.remove');
        fireEvent.click(removeButtons[0]);
        expect(spy).toHaveBeenCalledWith({ type: 'test/setTrigger', payload: true });
    });

    it('shows 0 volumes when ebsResourceInfo is missing', () => {
        const store = makeStore({
            bulk: {
                selectedRowsForExploreSavingsEBSBulk: [{ id: 'host-1', name: 'Host 1', totalInstance: 1 }]
            }
        });
        const { container } = render(
            <Provider store={store}>
                <TCOBulkAccordion />
            </Provider>
        );
        expect(container.textContent).toContain('0');
    });

    it('does not show SSD tier card when viewCalculationsResponse is null', () => {
        render(
            <Provider store={makeStore()}>
                <TCOBulkAccordion />
            </Provider>
        );
        expect(screen.queryByTestId('info-svg')).toBeNull();
    });

    it('shows SSD tier card when ebsCapacity < 800 and hosts < 5', () => {
        const store = makeStore({
            es: {
                viewCalculationsResponse: {
                    fsxOntapCalculation: { ebsCapacity: '500 GiB' }
                }
            }
        });
        const { container } = render(
            <Provider store={store}>
                <TCOBulkAccordion />
            </Provider>
        );
        expect(container.textContent).toContain('databases.explore-savings.ssd-tier-text');
    });

    it('does not show SSD tier card when ebsCapacity >= 800', () => {
        const store = makeStore({
            es: {
                viewCalculationsResponse: {
                    fsxOntapCalculation: { ebsCapacity: '1,000 GiB' }
                }
            }
        });
        render(
            <Provider store={store}>
                <TCOBulkAccordion />
            </Provider>
        );
        expect(screen.queryByTestId('info-svg')).toBeNull();
    });

    it('renders with empty host list', () => {
        const store = makeStore({
            bulk: { selectedRowsForExploreSavingsEBSBulk: [] }
        });
        const { container } = render(
            <Provider store={store}>
                <TCOBulkAccordion />
            </Provider>
        );
        expect(container.textContent).toContain('(0)');
    });

    it('tracks totalHostCount from rowsRequiringAuthBulk when present', () => {
        const store = makeStore({
            bulk: {
                selectedRowsForExploreSavingsEBSBulk: [
                    { id: 'host-1', name: 'Host 1', totalInstance: 1, ebsResourceInfo: [] }
                ],
                rowsRequiringAuthBulk: [{ id: 'auth-1' }, { id: 'auth-2' }, { id: 'auth-3' }]
            }
        });
        // With 3 rows requiring auth, remove should not be disabled (totalHostCount > 1)
        render(
            <Provider store={store}>
                <TCOBulkAccordion />
            </Provider>
        );
        const removeBtn = screen.getByTestId('ds-button-databases.explore-savings.remove');
        expect(removeBtn).not.toHaveAttribute('disabled');
    });
});
