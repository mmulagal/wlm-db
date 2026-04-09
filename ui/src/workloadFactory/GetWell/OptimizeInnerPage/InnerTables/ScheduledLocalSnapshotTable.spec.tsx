import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ScheduledLocalSnapshotOptimizeTable from './ScheduledLocalSnapshotTable';

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

describe('ScheduledLocalSnapshotOptimizeTable', () => {
    const defaultProps = {
        type: 'snapshot',
        data: {
            objectsInViolation: [
                { ontapVolumeName: 'vol1', ontapVolumeUuid: 'uuid-1' },
                { ontapVolumeName: 'vol2', ontapVolumeUuid: 'uuid-2' }
            ]
        },
        lastColDetails: mockLastColDetails,
        handleBulkAction: vi.fn(),
        isWad: false
    };

    it('renders table', () => {
        render(<ScheduledLocalSnapshotOptimizeTable {...defaultProps} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders table top bar', () => {
        render(<ScheduledLocalSnapshotOptimizeTable {...defaultProps} />);
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
    });

    it('renders with empty data', () => {
        render(<ScheduledLocalSnapshotOptimizeTable {...defaultProps} data={{ objectsInViolation: [] }} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with isWad true', () => {
        render(<ScheduledLocalSnapshotOptimizeTable {...defaultProps} isWad />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders bulk action container when rows are selected', () => {
        mockSelectedRows.length = 0;
        mockSelectedRows.push({ id: '1', ontapVolumeName: 'vol1' });
        render(<ScheduledLocalSnapshotOptimizeTable {...defaultProps} />);
        expect(screen.getByTestId('bulk-action-container')).toBeTruthy();
        mockSelectedRows.length = 0;
    });
});
