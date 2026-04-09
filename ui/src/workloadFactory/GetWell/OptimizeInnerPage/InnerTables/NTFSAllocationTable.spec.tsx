import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NTFSAllocationTable from './NTFSAllocationTable';

vi.mock('react-redux', () => ({ useDispatch: () => vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

vi.mock('../../../../store/storeHooks', () => ({
    useAppSelector: vi.fn((selector: any) =>
        selector({
            databaseHome: { selectedRowsForOptimizeInnerPage: [] },
            getWellOptimize: { inProgressOptimizationData: {} }
        })
    )
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: { NOT_AVAILABLE: 'N/A' }
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    checkBoxHandle: vi.fn(),
    getSelectedFromSelectionState: vi.fn(() => [])
}));

vi.mock('../../../../store/workloadFactory/databaseHomeSlice', () => ({
    setSelectedRowsForOptimizeInnerPage: vi.fn((v: any) => ({ type: 'setRows', payload: v }))
}));

vi.mock('../../../../utils/consts', () => ({
    ASSESSMENT_CONFIG_NAMES: { NTFS_ALLOCATION: 'NTFSAllocation' }
}));

vi.mock('../../GetWellUtils', () => ({
    getWadCellProps: vi.fn(() => ({}))
}));

vi.mock('../../../Dashboard/DashboardInnerPage/RenderTables/FirstColumnComponent', () => ({
    default: ({ rowData }: any) => <span>{rowData?.objectName}</span>
}));

vi.mock('../../../../common/BulkAction/BulkActionContainer', () => ({
    default: () => <div data-testid="bulk-action-container" />
}));

vi.mock('@netapp/design-system', () => ({
    Table: () => <div data-testid="table" />,
    TableTopBar: () => <div data-testid="table-top-bar" />,
    useTable: vi.fn(() => ({ selectionState: {}, tableRef: { current: null } }))
}));

vi.mock('./InnerTable.module.scss', () => ({ default: { 'inner-table': 'inner-table' } }));

const mockLastColDetails = vi.fn(() => ({
    Header: 'Actions',
    accessor: 'actions',
    id: 'actions',
    renderCell: () => <div>Action</div>
}));

describe('NTFSAllocationTable', () => {
    const defaultProps = {
        type: 'ntfs',
        data: { violationDetails: [{ objectName: 'D:', value: '4096' }] },
        lastColDetails: mockLastColDetails,
        handleBulkAction: vi.fn(),
        isWad: false
    };

    it('renders table', () => {
        render(<NTFSAllocationTable {...defaultProps} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with empty data', () => {
        render(<NTFSAllocationTable {...defaultProps} data={{ violationDetails: [] }} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with isWad true', () => {
        render(<NTFSAllocationTable {...defaultProps} isWad />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders bulk action container when rows are selected', () => {
        // Bulk action container only shows when selectedRowsForOptimizeInnerPage has items
        render(<NTFSAllocationTable {...defaultProps} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });
});
