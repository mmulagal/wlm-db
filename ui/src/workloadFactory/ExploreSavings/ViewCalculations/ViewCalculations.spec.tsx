import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ViewCalculations from './ViewCalculations';
import { FSX_AZ_TYPE, SAVINGS_CALC_MODE, WLF_TABS } from '../../../utils/consts';
import { GENERAL } from '../../../utils/appConstants';

// ========================
//  Mocks
// ========================

const mockDispatch = vi.fn();
vi.mock('react-redux', async () => {
    const actual = await vi.importActual('react-redux');
    return { ...actual, useDispatch: () => mockDispatch };
});

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const map: Record<string, string> = {
                'databases.explore-savings.mssql-ebs-calculation': GENERAL.MS_EBS_CALCULATION,
                'databases.explore-savings.mssql-fsxw-calculation': GENERAL.MS_FSXW_CALCULATION
            };
            return map[key] ?? key;
        }
    })
}));

vi.mock('@netapp/design-system', () => ({
    AccordionController: ({ children }: any) => <div data-testid="accordion-controller">{children}</div>,
    DsTypography: ({ children, variant, style, className }: any) => (
        <span data-testid="ds-typography" data-variant={variant} className={className} style={style}>
            {children}
        </span>
    )
}));

// BreadCrumbs mock that renders clickable breadcrumb items
vi.mock('../../../common/BreadCrumbs/BreadCrumbs', () => ({
    default: ({ items }: any) => (
        <nav data-testid="breadcrumbs">
            {items.map((item: any, idx: number) => (
                <span key={idx} data-testid={`breadcrumb-${idx}`} onClick={item.onClick}>
                    {item.title}
                </span>
            ))}
        </nav>
    )
}));

// Child calculation components – render as simple stubs
vi.mock('./EBSCalculation/SnapshotsEBSCalculation/SnapshotsEBSCalculation', () => ({
    default: () => <div data-testid="snapshots-ebs" />
}));
vi.mock('./EBSCalculation/ClonesEBSCalculation/ClonesEBSCalculation', () => ({
    default: () => <div data-testid="clones-ebs" />
}));
vi.mock('./OntapCalculation/SnapshotsOntapCalculation/SnapshotsOntapCalculation', () => ({
    default: () => <div data-testid="snapshots-ontap" />
}));
vi.mock('./OntapCalculation/ClonesOntapCalculation/ClonesOntapCalculation', () => ({
    default: () => <div data-testid="clones-ontap" />
}));
vi.mock('./EBSCalculation/ElasticBlockStorageCalculation/ElasticBlockStorageCalculation', () => ({
    default: () => <div data-testid="ebs-storage" />
}));
vi.mock('./OntapCalculation/FsxnSazCalculation/FsxnSazCalculation', () => ({
    default: () => <div data-testid="fsxn-saz" />
}));
vi.mock('./OntapCalculation/FsxnMazCalculation/FsxnMazCalculation', () => ({
    default: () => <div data-testid="fsxn-maz" />
}));
vi.mock('./EBSCalculation/InstancesEbsCalculation/InstancesEbsCalculation', () => ({
    default: () => <div data-testid="instances-ebs" />
}));
vi.mock('./OntapCalculation/InstancesOntapCalculation/InstancesOntapCalculation', () => ({
    default: () => <div data-testid="instances-ontap" />
}));
vi.mock('./OntapCalculation/TotalMonthlyCostOntapCalculation/TotalMonthlyCostOntapCalculation', () => ({
    default: () => <div data-testid="total-ontap" />
}));
vi.mock('./EBSCalculation/TotalMonthlyCostEbsCalculation/TotalMonthlyCostEbsCalculation', () => ({
    default: () => <div data-testid="total-ebs" />
}));
vi.mock('./FSxWCalculation/InstancesFsxwCalculation/InstancesFsxwCalculation', () => ({
    default: () => <div data-testid="instances-fsxw" />
}));
vi.mock('./FSxWCalculation/FsxwSazCalculation/FsxwSazCalculation', () => ({
    default: () => <div data-testid="fsxw-saz" />
}));
vi.mock('./FSxWCalculation/ClonesFsxwCalculation/ClonesFsxwCalculation', () => ({
    default: () => <div data-testid="clones-fsxw" />
}));
vi.mock('./FSxWCalculation/TotalMonthlyCostFsxwCalculation/TotalMonthlyCostFsxwCalculation', () => ({
    default: () => <div data-testid="total-fsxw" />
}));
vi.mock('./FSxWCalculation/ShadowCopyFsxwCalculation/ShadowCopyFsxwCalculation', () => ({
    default: () => <div data-testid="shadow-copy-fsxw" />
}));
vi.mock('./FSxWCalculation/FsxwMazCalculation/FsxwMazCalculation', () => ({
    default: () => <div data-testid="fsxw-maz" />
}));

vi.mock('../../../store/workloadFactory/exploreSavingsSlice', () => ({
    addExploreSavingsInitialData: (val: any) => ({ type: 'es/addInitialData', payload: val })
}));

vi.mock('../../../store/workloadFactory/exploreSavingsBulkSlice', () => ({
    setSelectedRowsForExploreSavingsEBSBulk: (val: any) => ({ type: 'bulk/setSelectedRows', payload: val })
}));

vi.mock('../../../store/workloadFactory/inventoryV2Slice', () => ({
    setSelectedHeaderTab: (val: any) => ({ type: 'inv/setSelectedHeaderTab', payload: val })
}));

// ========================
//  Helpers
// ========================

const createMockStore = (overrides: Record<string, any> = {}) => {
    const defaults = {
        selectedServerName: 'DefaultServer',
        viewCalculationsResponse: { azType: FSX_AZ_TYPE.SINGLE },
        savingsCalculatorFrom: SAVINGS_CALC_MODE.MANUAL_EBS,
        selectedRowsForExploreSavingsEBSBulk: [],
        selectedRowsForExploreSavingsOnPremBulk: [],
        ...overrides
    };
    return configureStore({
        reducer: {
            exploreSavings: () => ({
                selectedServerName: defaults.selectedServerName,
                viewCalculationsResponse: defaults.viewCalculationsResponse,
                savingsCalculatorFrom: defaults.savingsCalculatorFrom
            }),
            exploreSavingsBulk: () => ({
                selectedRowsForExploreSavingsEBSBulk: defaults.selectedRowsForExploreSavingsEBSBulk,
                selectedRowsForExploreSavingsOnPremBulk: defaults.selectedRowsForExploreSavingsOnPremBulk
            })
        }
    });
};

const renderComponent = (props: Record<string, any> = {}, storeOverrides: Record<string, any> = {}) => {
    const store = createMockStore(storeOverrides);
    return render(
        <Provider store={store}>
            <ViewCalculations statusCheck={props.statusCheck ?? true} />
        </Provider>
    );
};

// ========================
//  Tests
// ========================

describe('ViewCalculations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ---- Basic rendering ----

    describe('Basic Rendering', () => {
        it('should render without crashing', () => {
            const { container } = renderComponent();
            expect(container.firstChild).toBeTruthy();
        });

        it('should render AccordionController', () => {
            renderComponent();
            expect(screen.getByTestId('accordion-controller')).toBeTruthy();
        });

        it('should render cost calculation heading', () => {
            renderComponent();
            expect(screen.getByText(GENERAL.COST_CALCULATION)).toBeTruthy();
        });

        it('should render secondary text', () => {
            renderComponent();
            expect(screen.getByText(GENERAL.VIEW_CAL_SECONDARY_TEXT)).toBeTruthy();
        });
    });

    // ---- Breadcrumbs with statusCheck ----

    describe('Breadcrumbs (statusCheck=true)', () => {
        it('should render 3 breadcrumb items when statusCheck is true', () => {
            renderComponent({ statusCheck: true });
            expect(screen.getByTestId('breadcrumb-0')).toBeTruthy();
            expect(screen.getByTestId('breadcrumb-1')).toBeTruthy();
            expect(screen.getByTestId('breadcrumb-2')).toBeTruthy();
        });

        it('should show "Explore savings" as first breadcrumb', () => {
            renderComponent({ statusCheck: true });
            expect(screen.getByTestId('breadcrumb-0').textContent).toBe(GENERAL.ES_SAVINGS);
        });

        it('should show "View calculations" as third breadcrumb', () => {
            renderComponent({ statusCheck: true });
            expect(screen.getByTestId('breadcrumb-2').textContent).toBe(GENERAL.VIEW_CALCS);
        });

        it('should dispatch correct actions when first breadcrumb is clicked', () => {
            renderComponent({ statusCheck: true });
            fireEvent.click(screen.getByTestId('breadcrumb-0'));

            expect(mockDispatch).toHaveBeenCalledWith({
                type: 'inv/setSelectedHeaderTab',
                payload: WLF_TABS.EXPLORE_SAVINGS
            });
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'es/addInitialData', payload: null });
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'bulk/setSelectedRows', payload: [] });
        });

        it('should dispatch setSelectedHeaderTab when second breadcrumb is clicked', () => {
            renderComponent({ statusCheck: true });
            fireEvent.click(screen.getByTestId('breadcrumb-1'));
            expect(mockDispatch).toHaveBeenCalledWith({
                type: 'inv/setSelectedHeaderTab',
                payload: WLF_TABS.SAVINGS_CALCULATOR
            });
        });
    });

    describe('Breadcrumbs (statusCheck=false)', () => {
        it('should render 2 breadcrumb items when statusCheck is false', () => {
            renderComponent({ statusCheck: false });
            expect(screen.getByTestId('breadcrumb-0')).toBeTruthy();
            expect(screen.getByTestId('breadcrumb-1')).toBeTruthy();
            expect(screen.queryByTestId('breadcrumb-2')).toBeNull();
        });

        it('should show "View calculations" as second breadcrumb', () => {
            renderComponent({ statusCheck: false });
            expect(screen.getByTestId('breadcrumb-1').textContent).toBe(GENERAL.VIEW_CALCS);
        });

        it('should dispatch setSelectedHeaderTab when first breadcrumb clicked', () => {
            renderComponent({ statusCheck: false });
            fireEvent.click(screen.getByTestId('breadcrumb-0'));
            expect(mockDispatch).toHaveBeenCalledWith({
                type: 'inv/setSelectedHeaderTab',
                payload: WLF_TABS.SAVINGS_CALCULATOR
            });
        });
    });

    // ---- getDynamicBreadcrumbTitle ----

    describe('getDynamicBreadcrumbTitle', () => {
        it('should return manual title for MANUAL_EBS mode', () => {
            renderComponent({ statusCheck: false }, { savingsCalculatorFrom: SAVINGS_CALC_MODE.MANUAL_EBS });
            expect(screen.getByTestId('breadcrumb-0').textContent).toBe(
                'databases.explore-savings.view-calculation-breadcrumb-title-manual'
            );
        });

        it('should return manual title for MANUAL_FSXW mode', () => {
            renderComponent({ statusCheck: false }, { savingsCalculatorFrom: SAVINGS_CALC_MODE.MANUAL_FSXW });
            expect(screen.getByTestId('breadcrumb-0').textContent).toBe(
                'databases.explore-savings.view-calculation-breadcrumb-title-manual'
            );
        });

        it('should return "N hosts selected" for AUTO_EBS with multiple bulk rows', () => {
            renderComponent(
                { statusCheck: false },
                {
                    savingsCalculatorFrom: SAVINGS_CALC_MODE.AUTO_EBS,
                    selectedRowsForExploreSavingsEBSBulk: [
                        { id: '1', name: 'H1' },
                        { id: '2', name: 'H2' },
                        { id: '3', name: 'H3' }
                    ]
                }
            );
            expect(screen.getByTestId('breadcrumb-0').textContent).toBe('3 hosts selected');
        });

        it('should return first row name for AUTO_EBS with single bulk row', () => {
            renderComponent(
                { statusCheck: false },
                {
                    savingsCalculatorFrom: SAVINGS_CALC_MODE.AUTO_EBS,
                    selectedRowsForExploreSavingsEBSBulk: [{ id: '1', name: 'SingleHost' }]
                }
            );
            expect(screen.getByTestId('breadcrumb-0').textContent).toBe('SingleHost');
        });

        it('should fallback to selectedServerName for AUTO_EBS with single row without name', () => {
            renderComponent(
                { statusCheck: false },
                {
                    savingsCalculatorFrom: SAVINGS_CALC_MODE.AUTO_EBS,
                    selectedRowsForExploreSavingsEBSBulk: [{ id: '1', name: '' }],
                    selectedServerName: 'FallbackServer'
                }
            );
            expect(screen.getByTestId('breadcrumb-0').textContent).toBe('FallbackServer');
        });

        it('should return "N hosts selected" for ONPREM with multiple bulk rows', () => {
            renderComponent(
                { statusCheck: false },
                {
                    savingsCalculatorFrom: SAVINGS_CALC_MODE.ONPREM,
                    selectedRowsForExploreSavingsOnPremBulk: [
                        { id: '1', resourceName: 'O1' },
                        { id: '2', resourceName: 'O2' }
                    ]
                }
            );
            expect(screen.getByTestId('breadcrumb-0').textContent).toBe('2 hosts selected');
        });

        it('should return first row resourceName for ONPREM with single bulk row', () => {
            renderComponent(
                { statusCheck: false },
                {
                    savingsCalculatorFrom: SAVINGS_CALC_MODE.ONPREM,
                    selectedRowsForExploreSavingsOnPremBulk: [{ id: '1', resourceName: 'OnPremHost' }]
                }
            );
            expect(screen.getByTestId('breadcrumb-0').textContent).toBe('OnPremHost');
        });

        it('should fallback to selectedServerName for ONPREM with single row without resourceName', () => {
            renderComponent(
                { statusCheck: false },
                {
                    savingsCalculatorFrom: SAVINGS_CALC_MODE.ONPREM,
                    selectedRowsForExploreSavingsOnPremBulk: [{ id: '1', resourceName: '' }],
                    selectedServerName: 'OnPremFallback'
                }
            );
            expect(screen.getByTestId('breadcrumb-0').textContent).toBe('OnPremFallback');
        });

        it('should return selectedServerName as fallback for unknown mode', () => {
            renderComponent(
                { statusCheck: false },
                {
                    savingsCalculatorFrom: 'UNKNOWN_MODE',
                    selectedServerName: 'MyServer'
                }
            );
            expect(screen.getByTestId('breadcrumb-0').textContent).toBe('MyServer');
        });

        it('should return selectedServerName for AUTO_EBS with empty bulk rows', () => {
            renderComponent(
                { statusCheck: false },
                {
                    savingsCalculatorFrom: SAVINGS_CALC_MODE.AUTO_EBS,
                    selectedRowsForExploreSavingsEBSBulk: [],
                    selectedServerName: 'EmptyBulkServer'
                }
            );
            expect(screen.getByTestId('breadcrumb-0').textContent).toBe('EmptyBulkServer');
        });

        it('should return selectedServerName for ONPREM with empty bulk rows', () => {
            renderComponent(
                { statusCheck: false },
                {
                    savingsCalculatorFrom: SAVINGS_CALC_MODE.ONPREM,
                    selectedRowsForExploreSavingsOnPremBulk: [],
                    selectedServerName: 'EmptyOnPrem'
                }
            );
            expect(screen.getByTestId('breadcrumb-0').textContent).toBe('EmptyOnPrem');
        });

        it('should return selectedServerName for AUTO_EBS with null bulk rows', () => {
            renderComponent(
                { statusCheck: false },
                {
                    savingsCalculatorFrom: SAVINGS_CALC_MODE.AUTO_EBS,
                    selectedRowsForExploreSavingsEBSBulk: null,
                    selectedServerName: 'NullBulkServer'
                }
            );
            expect(screen.getByTestId('breadcrumb-0').textContent).toBe('NullBulkServer');
        });

        it('should return selectedServerName for ONPREM with null bulk rows', () => {
            renderComponent(
                { statusCheck: false },
                {
                    savingsCalculatorFrom: SAVINGS_CALC_MODE.ONPREM,
                    selectedRowsForExploreSavingsOnPremBulk: null,
                    selectedServerName: 'NullOnPremServer'
                }
            );
            expect(screen.getByTestId('breadcrumb-0').textContent).toBe('NullOnPremServer');
        });
    });

    // ---- ONTAP calculation section ----

    describe('ONTAP Calculation Section', () => {
        it('should always render ONTAP section components', () => {
            renderComponent();
            expect(screen.getByTestId('instances-ontap')).toBeTruthy();
            expect(screen.getByTestId('snapshots-ontap')).toBeTruthy();
            expect(screen.getByTestId('clones-ontap')).toBeTruthy();
            expect(screen.getByTestId('total-ontap')).toBeTruthy();
        });

        it('should render FsxnSazCalculation for Single AZ', () => {
            renderComponent({}, { viewCalculationsResponse: { azType: FSX_AZ_TYPE.SINGLE } });
            expect(screen.getByTestId('fsxn-saz')).toBeTruthy();
            expect(screen.queryByTestId('fsxn-maz')).toBeNull();
        });

        it('should render FsxnMazCalculation for Multi AZ', () => {
            renderComponent({}, { viewCalculationsResponse: { azType: FSX_AZ_TYPE.MULTI } });
            expect(screen.getByTestId('fsxn-maz')).toBeTruthy();
            expect(screen.queryByTestId('fsxn-saz')).toBeNull();
        });

        it('should render FsxnMazCalculation when azType is null', () => {
            renderComponent({}, { viewCalculationsResponse: { azType: null } });
            expect(screen.getByTestId('fsxn-maz')).toBeTruthy();
        });
    });

    // ---- EBS calculation section ----

    describe('EBS Calculation Section', () => {
        it('should show EBS section for MANUAL_EBS mode', () => {
            renderComponent({}, { savingsCalculatorFrom: SAVINGS_CALC_MODE.MANUAL_EBS });
            expect(screen.getByTestId('instances-ebs')).toBeTruthy();
            expect(screen.getByTestId('ebs-storage')).toBeTruthy();
            expect(screen.getByTestId('snapshots-ebs')).toBeTruthy();
            expect(screen.getByTestId('clones-ebs')).toBeTruthy();
            expect(screen.getByTestId('total-ebs')).toBeTruthy();
            expect(screen.getByText(GENERAL.MS_EBS_CALCULATION)).toBeTruthy();
        });

        it('should show EBS section for AUTO_EBS mode', () => {
            renderComponent({}, { savingsCalculatorFrom: SAVINGS_CALC_MODE.AUTO_EBS });
            expect(screen.getByTestId('instances-ebs')).toBeTruthy();
        });

        it('should show EBS section for ONPREM mode', () => {
            renderComponent({}, { savingsCalculatorFrom: SAVINGS_CALC_MODE.ONPREM });
            expect(screen.getByTestId('instances-ebs')).toBeTruthy();
        });

        it('should not show EBS section for MANUAL_FSXW mode', () => {
            renderComponent({}, { savingsCalculatorFrom: SAVINGS_CALC_MODE.MANUAL_FSXW });
            expect(screen.queryByTestId('instances-ebs')).toBeNull();
        });

        it('should not show EBS section for AUTO_FSXW mode', () => {
            renderComponent({}, { savingsCalculatorFrom: SAVINGS_CALC_MODE.AUTO_FSXW });
            expect(screen.queryByTestId('instances-ebs')).toBeNull();
        });
    });

    // ---- FSxW calculation section ----

    describe('FSxW Calculation Section', () => {
        it('should show FSxW section for MANUAL_FSXW mode', () => {
            renderComponent({}, { savingsCalculatorFrom: SAVINGS_CALC_MODE.MANUAL_FSXW });
            expect(screen.getByTestId('instances-fsxw')).toBeTruthy();
            expect(screen.getByTestId('shadow-copy-fsxw')).toBeTruthy();
            expect(screen.getByTestId('clones-fsxw')).toBeTruthy();
            expect(screen.getByTestId('total-fsxw')).toBeTruthy();
            expect(screen.getByText(GENERAL.MS_FSXW_CALCULATION)).toBeTruthy();
        });

        it('should show FSxW section for AUTO_FSXW mode', () => {
            renderComponent({}, { savingsCalculatorFrom: SAVINGS_CALC_MODE.AUTO_FSXW });
            expect(screen.getByTestId('instances-fsxw')).toBeTruthy();
        });

        it('should not show FSxW section for MANUAL_EBS mode', () => {
            renderComponent({}, { savingsCalculatorFrom: SAVINGS_CALC_MODE.MANUAL_EBS });
            expect(screen.queryByTestId('instances-fsxw')).toBeNull();
        });

        it('should not show FSxW section for AUTO_EBS mode', () => {
            renderComponent({}, { savingsCalculatorFrom: SAVINGS_CALC_MODE.AUTO_EBS });
            expect(screen.queryByTestId('instances-fsxw')).toBeNull();
        });

        it('should render FsxwSazCalculation for Single AZ in FSxW section', () => {
            renderComponent(
                {},
                {
                    savingsCalculatorFrom: SAVINGS_CALC_MODE.MANUAL_FSXW,
                    viewCalculationsResponse: { azType: FSX_AZ_TYPE.SINGLE }
                }
            );
            expect(screen.getByTestId('fsxw-saz')).toBeTruthy();
            expect(screen.queryByTestId('fsxw-maz')).toBeNull();
        });

        it('should render FsxwMazCalculation for Multi AZ in FSxW section', () => {
            renderComponent(
                {},
                {
                    savingsCalculatorFrom: SAVINGS_CALC_MODE.MANUAL_FSXW,
                    viewCalculationsResponse: { azType: FSX_AZ_TYPE.MULTI }
                }
            );
            expect(screen.getByTestId('fsxw-maz')).toBeTruthy();
            expect(screen.queryByTestId('fsxw-saz')).toBeNull();
        });
    });
});
