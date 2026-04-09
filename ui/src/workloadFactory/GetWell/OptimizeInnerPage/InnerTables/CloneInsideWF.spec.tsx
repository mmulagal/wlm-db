import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CloneInsideWF from './CloneInsideWF';

const mockUseAppSelector = vi.fn((selector: any) =>
    selector({
        databaseHome: { selectedRowsForOptimizeInnerPage: [] },
        getWellOptimize: { inProgressResourceOptimizeData: {} }
    })
);

vi.mock('react-redux', () => ({ useDispatch: () => vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

vi.mock('../../../../store/storeHooks', () => ({
    useAppSelector: (selector: any) => mockUseAppSelector(selector)
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: { NOT_AVAILABLE: 'N/A' }
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    getSelectedFromSelectionState: vi.fn(() => [])
}));

vi.mock('../../../../store/workloadFactory/databaseHomeSlice', () => ({
    setSelectedRowsForOptimizeInnerPage: vi.fn((v: any) => ({ type: 'setRows', payload: v }))
}));

vi.mock('../../../../utils/consts', () => ({
    ASSESSMENT_CONFIG_NAMES: { CLONE_MANAGEMENT: 'CloneManagement' },
    WLF_TABS: { DASHBOARD: 'DASHBOARD' }
}));

vi.mock('../../GetWellUtils', () => ({
    disableOptimizeResourceCheckBoxForOptimizeCase: vi.fn((data: any) => data)
}));

vi.mock('../../../../assets/menu-icon2.svg', () => ({
    ReactComponent: () => <svg data-testid="menu-icon" />
}));

vi.mock('../../../../common/BulkAction/BulkCloneContainer', () => ({
    default: ({ handleBulkActionForClone }: any) => (
        <div data-testid="bulk-clone-container">
            <button onClick={() => handleBulkActionForClone?.('Delete', 'op', [])}>Bulk</button>
        </div>
    )
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsFlashingDotsLoader: () => <div data-testid="flashing-loader" />
}));

vi.mock('@netapp/design-system', () => ({
    Table: () => <div data-testid="table" />,
    TableTopBar: () => <div data-testid="table-top-bar" />,
    DsTypography: ({ children }: any) => <span>{children}</span>,
    ButtonWithDropdown: ({ children, items }: any) => (
        <div data-testid="btn-dropdown">
            {children}
            {items?.map((item: any) => (
                <button key={item.id} onClick={item.onClick}>
                    {item.children || item.label}
                </button>
            ))}
        </div>
    ),
    useTable: vi.fn(() => ({ selectionState: {}, tableRef: { current: null } }))
}));

vi.mock('./InnerTable.module.scss', () => ({ default: { 'inner-table': 'inner-table' } }));

describe('CloneInsideWF', () => {
    beforeEach(() => {
        mockUseAppSelector.mockImplementation((selector: any) =>
            selector({
                databaseHome: { selectedRowsForOptimizeInnerPage: [] },
                getWellOptimize: { inProgressResourceOptimizeData: {} }
            })
        );
    });

    const defaultProps = {
        data: [
            { cloneDatabaseName: 'db1', serverInstanceName: 'inst1', cloneAge: 5, id: '1' },
            { cloneDatabaseName: 'db2', serverInstanceName: 'inst2', cloneAge: 10, id: '2' }
        ],
        handleBulkActionForClone: vi.fn(),
        fromPage: ''
    };

    it('renders table', () => {
        render(<CloneInsideWF {...defaultProps} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders table top bar', () => {
        render(<CloneInsideWF {...defaultProps} />);
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
    });

    it('renders with empty data', () => {
        render(<CloneInsideWF {...defaultProps} data={[]} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders bulk clone container', () => {
        mockUseAppSelector.mockImplementation((selector: any) =>
            selector({
                databaseHome: { selectedRowsForOptimizeInnerPage: [{ id: '1' }] },
                getWellOptimize: { inProgressResourceOptimizeData: {} }
            })
        );
        render(<CloneInsideWF {...defaultProps} />);
        expect(screen.getByTestId('bulk-clone-container')).toBeTruthy();
    });

    it('renders from dashboard page', () => {
        render(<CloneInsideWF {...defaultProps} fromPage="DASHBOARD" />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });
});
