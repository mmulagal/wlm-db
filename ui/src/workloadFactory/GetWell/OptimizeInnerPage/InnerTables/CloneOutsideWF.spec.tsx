import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CloneOutsideWF from './CloneOutsideWF';

vi.mock('react-redux', () => ({ useDispatch: () => vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const mockSelectedRows: any[] = [];
vi.mock('../../../../store/storeHooks', () => ({
    useAppSelector: vi.fn((selector: any) =>
        selector({
            databaseHome: { selectedRowsForOptimizeInnerPage: mockSelectedRows },
            getWellOptimize: { inProgressResourceOptimizeData: {} }
        })
    )
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
    WLF_TABS: { DASHBOARD: 'DASHBOARD' },
    DBType: { MSSQL: 'MSSQL', ORACLE: 'ORACLE' }
}));

vi.mock('../../GetWellUtils', () => ({
    disableOptimizeResourceCheckBoxForOptimizeCase: vi.fn((data: any) => data)
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
    DsButton: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
    Popover: ({ children, container }: any) => (
        <div>
            {container}
            {children}
        </div>
    ),
    useTable: vi.fn(() => ({ selectionState: {}, tableRef: { current: null } }))
}));

vi.mock('./InnerTable.module.scss', () => ({ default: { 'inner-table': 'inner-table' } }));

describe('CloneOutsideWF', () => {
    const defaultProps = {
        data: [
            { cloneDatabaseName: 'ext-db1', serverInstanceName: 'inst1', cloneAge: 7, id: '1' },
            { cloneDatabaseName: 'ext-db2', serverInstanceName: 'inst2', cloneAge: 14, id: '2' }
        ],
        handleBulkActionForClone: vi.fn(),
        fromPage: ''
    };

    it('renders table', () => {
        render(<CloneOutsideWF {...defaultProps} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders table top bar', () => {
        render(<CloneOutsideWF {...defaultProps} />);
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
    });

    it('renders with empty data', () => {
        render(<CloneOutsideWF {...defaultProps} data={[]} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders bulk clone container when rows are selected', () => {
        mockSelectedRows.length = 0;
        mockSelectedRows.push({ id: '1', cloneDatabaseName: 'ext-db1' });
        render(<CloneOutsideWF {...defaultProps} />);
        expect(screen.getByTestId('bulk-clone-container')).toBeTruthy();
        mockSelectedRows.length = 0;
    });

    it('renders from dashboard page', () => {
        render(<CloneOutsideWF {...defaultProps} fromPage="DASHBOARD" />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });
});
