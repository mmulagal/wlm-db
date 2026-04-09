import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RSSOptimizeTable from './RSSOptimizeTable';

vi.mock('react-redux', () => ({ useDispatch: () => vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const mockSelectedRows: any[] = [];
vi.mock('../../../../store/storeHooks', () => ({
    useAppSelector: vi.fn((selector: any) =>
        selector({ databaseHome: { selectedRowsForOptimizeInnerPage: mockSelectedRows } })
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

vi.mock('../../GetWellUtils', () => ({
    getWadCellProps: vi.fn(() => ({}))
}));

vi.mock('../../../../assets/tooltipGrey.svg', () => ({
    ReactComponent: () => <svg data-testid="tooltip-icon" />
}));

vi.mock('../../../../common/BulkAction/BulkActionContainer', () => ({
    default: () => <div data-testid="bulk-action-container" />
}));

vi.mock('@netapp/design-system', () => ({
    Table: () => <div data-testid="table" />,
    TableTopBar: () => <div data-testid="table-top-bar" />,
    DsTypography: ({ children }: any) => <span>{children}</span>,
    Popover: ({ children, container }: any) => (
        <div>
            {container}
            {children}
        </div>
    ),
    useTable: vi.fn(() => ({ selectionState: {}, tableRef: { current: null } }))
}));

vi.mock('./InnerTable.module.scss', () => ({
    default: { 'inner-table': 'inner-table', rssCell: 'rssCell' }
}));

const mockLastColDetails = vi.fn(() => ({
    Header: 'Actions',
    accessor: 'actions',
    id: 'actions',
    renderCell: () => <div>Action</div>
}));

describe('RSSOptimizeTable', () => {
    const defaultProps = {
        type: 'rss',
        data: {
            notOptimizedAdapters: [
                { adapterName: 'Adapter1', tcpOffloadStateStatus: 'Enabled', tcpOffloadState: 'On' },
                { adapterName: 'Adapter2', tcpOffloadStateStatus: 'Disabled', tcpOffloadState: 'Off' }
            ]
        },
        lastColDetails: mockLastColDetails,
        handleBulkAction: vi.fn(),
        isWad: false
    };

    it('renders table', () => {
        render(<RSSOptimizeTable {...defaultProps} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with empty adapters', () => {
        render(<RSSOptimizeTable {...defaultProps} data={{ notOptimizedAdapters: [] }} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with isWad true', () => {
        render(<RSSOptimizeTable {...defaultProps} isWad />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders bulk action container when rows are selected', () => {
        mockSelectedRows.length = 0;
        mockSelectedRows.push({ id: '1', adapterName: 'Adapter1' });
        render(<RSSOptimizeTable {...defaultProps} />);
        expect(screen.getByTestId('bulk-action-container')).toBeTruthy();
        mockSelectedRows.length = 0;
    });
});
