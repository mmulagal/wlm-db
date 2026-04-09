import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MTUOptimizeTable from './MTUOptimizeTable';

vi.mock('react-redux', () => ({ useDispatch: () => vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

vi.mock('../../../../store/storeHooks', () => ({
    useAppSelector: vi.fn((selector: any) => selector({ databaseHome: { selectedRowsForOptimizeInnerPage: [] } }))
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
    default: ({ handleBulkAction }: any) => (
        <div data-testid="bulk-action-container">
            <button onClick={() => handleBulkAction?.('optimize', [], 'MTU')}>Optimize</button>
        </div>
    )
}));

vi.mock('@netapp/design-system', () => ({
    Table: () => <div data-testid="table" />,
    TableTopBar: ({ singularTitle }: any) => (
        <div data-testid="table-top-bar">
            <span>{singularTitle}</span>
        </div>
    ),
    useTable: vi.fn(() => ({ selectionState: {}, tableRef: { current: null } }))
}));

vi.mock('./InnerTable.module.scss', () => ({ default: { 'inner-table': 'inner-table' } }));

const mockLastColDetails = vi.fn(() => ({
    Header: 'Actions',
    accessor: 'actions',
    id: 'actions',
    renderCell: () => <div>Action</div>
}));

describe('MTUOptimizeTable', () => {
    const defaultProps = {
        type: 'mtu',
        data: {
            ec2InterfacesToFix: [
                { name: 'eth0', currentMTU: 1500 },
                { name: 'eth1', currentMTU: 9001 }
            ]
        },
        lastColDetails: mockLastColDetails,
        handleBulkAction: vi.fn(),
        isWad: false
    };

    it('renders table', () => {
        render(<MTUOptimizeTable {...defaultProps} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with empty ec2InterfacesToFix', () => {
        render(<MTUOptimizeTable {...defaultProps} data={{ ec2InterfacesToFix: [] }} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with no data object', () => {
        render(<MTUOptimizeTable {...defaultProps} data={{}} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with isWad true', () => {
        render(<MTUOptimizeTable {...defaultProps} isWad />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with selectedRows from store', () => {
        render(<MTUOptimizeTable {...defaultProps} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });
});
