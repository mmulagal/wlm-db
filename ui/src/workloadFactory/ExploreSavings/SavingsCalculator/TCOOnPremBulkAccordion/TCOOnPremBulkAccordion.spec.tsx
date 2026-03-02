import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import TCOOnPremBulkAccordion from './TCOOnPremBulkAccordion';

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
    useDialog: () => ({ setDialog: vi.fn(), closeDialog: vi.fn() })
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsButton: ({ children, onClick, isDisabled, type }: any) => (
        <button
            data-testid={`ds-btn-${typeof children === 'string' ? children.replace(/\s+/g, '-') : 'btn'}`}
            onClick={onClick}
            disabled={isDisabled}
        >
            {children}
        </button>
    )
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
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
    default: () => <span data-testid="separator">|</span>
}));

vi.mock('../../../../common/Dialog/DialogComponent', () => ({
    default: ({ header, content }: any) => (
        <div data-testid="dialog">
            {header}
            {content}
        </div>
    )
}));

vi.mock('../InstanceInformation/InstanceInformation', () => ({
    default: ({ host }: any) => <div data-testid="instance-info">{host?.resourceName}</div>
}));

vi.mock('../ComputeInformation/ComputeInformation', () => ({
    default: ({ host, printState }: any) => <div data-testid="compute-info">{host?.resourceName}</div>
}));

vi.mock('../StoragePerformance/StoragePerformance', () => ({
    default: ({ host, printState }: any) => <div data-testid="storage-perf">{host?.resourceName}</div>
}));

vi.mock('../SavingsSelectedHost/SavingsSelectedHost', () => ({
    default: ({ host }: any) => <div data-testid="savings-selected-host">{host?.resourceName}</div>
}));

vi.mock('./TCOOnPremAddHostTable/TCOOnPremAddHostTable', () => ({
    default: ({ onExploreSavings, onHandlerReady }: any) => (
        <div data-testid="on-prem-add-host-table">
            <button data-testid="add-host-callback" onClick={onExploreSavings}>
                add
            </button>
        </div>
    )
}));

vi.mock('./TCOOnPremBulkAccordion.module.scss', () => ({
    default: {
        tcoOnPremBulkAccordion: 'tcoOnPremBulkAccordion',
        header: 'header',
        accordionScrollContainer: 'accordionScrollContainer',
        centerValue: 'centerValue',
        centerText: 'centerText',
        rightWidgetButton: 'rightWidgetButton',
        accordionContent: 'accordionContent',
        ssdContainer: 'ssdContainer',
        iconWrapper: 'iconWrapper',
        setWidth: 'setWidth'
    }
}));

vi.mock('../../../../utils/CommonStyles.module.scss', () => ({
    default: { title: 'title' }
}));

vi.mock('../../../../store/workloadFactory/exploreSavingsBulkSlice', () => ({
    setSelectedRowsForExploreSavingsOnPremBulk: (val: any) => ({ type: 'test/setSelectedRowsOnPrem', payload: val }),
    setTriggerBulkDataFetch: (val: any) => ({ type: 'test/setTrigger', payload: val })
}));

vi.mock('../../../../store/workloadFactory/exploreSavingsSlice', () => ({
    setOnPremStorageAndComputeInfoFull: (val: any) => ({ type: 'test/setComputeFull', payload: val }),
    setSelectedServerName: (val: any) => ({ type: 'test/setServerName', payload: val }),
    setSelectedEsPageInstance: (val: any) => ({ type: 'test/setEsPage', payload: val }),
    setStorageSavingsResponse: (val: any) => ({ type: 'test/setStorageSavings', payload: val })
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    formatFractionalNumber: (n: number) => String(n || 0)
}));

vi.mock('../../../../utils/consts', async importOriginal => {
    const actual = await importOriginal();
    return {
        ...actual,
        GIB_IN_BYTE: 1073741824
    };
});

const makeStore = (overrides: any = {}) => {
    const bulkSlice = createSlice({
        name: 'exploreSavingsBulk',
        initialState: {
            selectedRowsForExploreSavingsOnPremBulk: [
                {
                    resourceId: 'r1',
                    resourceName: 'OnPrem Host 1',
                    deploymentModel: 'Standalone',
                    sqlServerInstances: [{ sqlInstanceName: 'inst1' }],
                    onPremisesNodes: [{ nodeId: 'n1' }],
                    totalInstance: 1
                },
                {
                    resourceId: 'r2',
                    resourceName: 'OnPrem Host 2',
                    deploymentModel: 'FCI',
                    sqlServerInstances: [{ sqlInstanceName: 'inst2' }, { sqlInstanceName: 'inst3' }],
                    onPremisesNodes: [{ nodeId: 'n2' }, { nodeId: 'n3' }],
                    totalInstance: 2
                }
            ],
            ...(overrides.bulk || {})
        },
        reducers: {}
    });
    const esSlice = createSlice({
        name: 'exploreSavings',
        initialState: {
            onPremiseData: null as any,
            onPremiseDataLoading: false,
            storageSavingsLoading: false,
            storageSavingsResponse: null,
            viewCalculationsResponse: null,
            ...(overrides.es || {})
        },
        reducers: {}
    });
    return configureStore({ reducer: { exploreSavingsBulk: bulkSlice.reducer, exploreSavings: esSlice.reducer } });
};

describe('TCOOnPremBulkAccordion', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders accordion controller', () => {
        render(
            <Provider store={makeStore()}>
                <TCOOnPremBulkAccordion />
            </Provider>
        );
        expect(screen.getByTestId('accordion-controller')).toBeTruthy();
    });

    it('renders header with selected hosts count', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <TCOOnPremBulkAccordion />
            </Provider>
        );
        expect(container.textContent).toContain('databases.explore-savings.selected-hosts');
        expect(container.textContent).toContain('(2)');
    });

    it('renders add hosts button', () => {
        render(
            <Provider store={makeStore()}>
                <TCOOnPremBulkAccordion />
            </Provider>
        );
        expect(screen.getByTestId('ds-btn-databases.explore-savings.add-hosts')).toBeTruthy();
    });

    it('disables add hosts when onPremiseDataLoading', () => {
        const store = makeStore({ es: { onPremiseDataLoading: true } });
        render(
            <Provider store={store}>
                <TCOOnPremBulkAccordion />
            </Provider>
        );
        expect(screen.getByTestId('ds-btn-databases.explore-savings.add-hosts')).toHaveAttribute('disabled');
    });

    it('renders accordion card for each host', () => {
        render(
            <Provider store={makeStore()}>
                <TCOOnPremBulkAccordion />
            </Provider>
        );
        expect(screen.getByTestId('accordion-card-OnPrem Host 1')).toBeTruthy();
        expect(screen.getByTestId('accordion-card-OnPrem Host 2')).toBeTruthy();
    });

    it('shows host name in title', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <TCOOnPremBulkAccordion />
            </Provider>
        );
        expect(container.textContent).toContain('OnPrem Host 1');
        expect(container.textContent).toContain('OnPrem Host 2');
    });

    it('shows instance count in value content', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <TCOOnPremBulkAccordion />
            </Provider>
        );
        expect(container.textContent).toContain('databases.explore-savings.instances');
    });

    it('shows "node" for Standalone deployment and "nodes" for FCI', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <TCOOnPremBulkAccordion />
            </Provider>
        );
        expect(container.textContent).toContain('node');
        expect(container.textContent).toContain('nodes');
    });

    it('renders SavingsSelectedHost for each host', () => {
        render(
            <Provider store={makeStore()}>
                <TCOOnPremBulkAccordion />
            </Provider>
        );
        const hosts = screen.getAllByTestId('savings-selected-host');
        expect(hosts.length).toBe(2);
    });

    it('renders InstanceInformation for each host', () => {
        render(
            <Provider store={makeStore()}>
                <TCOOnPremBulkAccordion />
            </Provider>
        );
        const infos = screen.getAllByTestId('instance-info');
        expect(infos.length).toBe(2);
    });

    it('renders ComputeInformation for each host', () => {
        render(
            <Provider store={makeStore()}>
                <TCOOnPremBulkAccordion />
            </Provider>
        );
        const computes = screen.getAllByTestId('compute-info');
        expect(computes.length).toBe(2);
    });

    it('renders StoragePerformance for each host', () => {
        render(
            <Provider store={makeStore()}>
                <TCOOnPremBulkAccordion />
            </Provider>
        );
        const perfs = screen.getAllByTestId('storage-perf');
        expect(perfs.length).toBe(2);
    });

    it('renders remove button for each host', () => {
        render(
            <Provider store={makeStore()}>
                <TCOOnPremBulkAccordion />
            </Provider>
        );
        const removeButtons = screen.getAllByTestId('ds-btn-databases.explore-savings.remove');
        expect(removeButtons.length).toBe(2);
    });

    it('disables remove when only 1 host remains', () => {
        const store = makeStore({
            bulk: {
                selectedRowsForExploreSavingsOnPremBulk: [
                    {
                        resourceId: 'r1',
                        resourceName: 'OnPrem Host 1',
                        deploymentModel: 'Standalone',
                        sqlServerInstances: [],
                        onPremisesNodes: []
                    }
                ]
            }
        });
        render(
            <Provider store={store}>
                <TCOOnPremBulkAccordion />
            </Provider>
        );
        expect(screen.getByTestId('ds-btn-databases.explore-savings.remove')).toHaveAttribute('disabled');
    });

    it('disables remove when storageSavingsLoading is true', () => {
        const store = makeStore({ es: { storageSavingsLoading: true } });
        render(
            <Provider store={store}>
                <TCOOnPremBulkAccordion />
            </Provider>
        );
        const removeButtons = screen.getAllByTestId('ds-btn-databases.explore-savings.remove');
        removeButtons.forEach(btn => expect(btn).toHaveAttribute('disabled'));
    });

    it('dispatches actions on remove host', () => {
        const store = makeStore();
        const spy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <TCOOnPremBulkAccordion />
            </Provider>
        );
        const removeButtons = screen.getAllByTestId('ds-btn-databases.explore-savings.remove');
        fireEvent.click(removeButtons[0]);
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/setSelectedRowsOnPrem' }));
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/setComputeFull' }));
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/setStorageSavings', payload: null }));
        expect(spy).toHaveBeenCalledWith({ type: 'test/setTrigger', payload: true });
    });

    it('dispatches setSelectedServerName after remove', () => {
        const store = makeStore();
        const spy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <TCOOnPremBulkAccordion />
            </Provider>
        );
        const removeButtons = screen.getAllByTestId('ds-btn-databases.explore-savings.remove');
        fireEvent.click(removeButtons[0]);
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/setServerName' }));
    });

    it('shows SSD tier card when ebsCapacity < 800 and hosts < 5', () => {
        const store = makeStore({
            es: {
                viewCalculationsResponse: { fsxOntapCalculation: { ebsCapacity: '500 GiB' } }
            }
        });
        const { container } = render(
            <Provider store={store}>
                <TCOOnPremBulkAccordion />
            </Provider>
        );
        expect(container.textContent).toContain('databases.explore-savings.ssd-tier-text');
    });

    it('does not show SSD tier card when viewCalculationsResponse is null', () => {
        render(
            <Provider store={makeStore()}>
                <TCOOnPremBulkAccordion />
            </Provider>
        );
        expect(screen.queryByTestId('info-svg')).toBeNull();
    });

    it('renders with empty host list', () => {
        const store = makeStore({ bulk: { selectedRowsForExploreSavingsOnPremBulk: [] } });
        const { container } = render(
            <Provider store={store}>
                <TCOOnPremBulkAccordion />
            </Provider>
        );
        expect(container.textContent).toContain('(0)');
    });

    it('resolves host from onPremiseData items when host is a string', () => {
        const store = makeStore({
            bulk: {
                selectedRowsForExploreSavingsOnPremBulk: ['HostString']
            },
            es: {
                onPremiseData: {
                    items: [{ resourceName: 'HostString', deploymentModel: 'Standalone', sqlServerInstances: [] }]
                }
            }
        });
        const { container } = render(
            <Provider store={store}>
                <TCOOnPremBulkAccordion />
            </Provider>
        );
        expect(container.textContent).toContain('HostString');
    });
});
