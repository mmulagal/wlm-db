import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import OSMultiPathIOPolicy from './OSMultiPathIOPolicy';

vi.mock('react-redux', () => ({ useDispatch: () => vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const mockSelectedRows: any[] = [];
vi.mock('../../../../store/storeHooks', () => ({
    useAppSelector: vi.fn((selector: any) =>
        selector({
            databaseHome: { selectedRowsForOptimizeInnerPage: mockSelectedRows },
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
    ASSESSMENT_CONFIG_NAMES: { OS_MULTIPATH: 'OSMultipath' }
}));

vi.mock('../../GetWellUtils', () => ({
    getWadCellProps: vi.fn(() => ({}))
}));

vi.mock('../../../Dashboard/DashboardInnerPage/RenderTables/FirstColumnComponent', () => ({
    default: ({ rowData }: any) => <span data-testid="first-col">{rowData?.objectName}</span>
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

describe('OSMultiPathIOPolicy', () => {
    const defaultProps = {
        type: 'osMultiPath',
        data: {
            violationDetails: [
                { objectName: 'drive1', value: 'round-robin' },
                { objectName: 'drive2', value: 'fixed' }
            ]
        },
        lastColDetails: mockLastColDetails,
        handleBulkAction: vi.fn(),
        isWad: false
    };

    it('renders table', () => {
        render(<OSMultiPathIOPolicy {...defaultProps} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders table top bar', () => {
        render(<OSMultiPathIOPolicy {...defaultProps} />);
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
    });

    it('renders with empty data', () => {
        render(<OSMultiPathIOPolicy {...defaultProps} data={{ violationDetails: [] }} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with isWad true', () => {
        render(<OSMultiPathIOPolicy {...defaultProps} isWad />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders bulk action container when rows are selected', () => {
        mockSelectedRows.length = 0;
        mockSelectedRows.push({ id: '1', objectName: 'drive1' });
        render(<OSMultiPathIOPolicy {...defaultProps} />);
        expect(screen.getByTestId('bulk-action-container')).toBeTruthy();
        mockSelectedRows.length = 0;
    });
});
