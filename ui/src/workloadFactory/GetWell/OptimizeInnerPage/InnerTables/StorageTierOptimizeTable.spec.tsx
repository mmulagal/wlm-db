import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StorageTierOptimizeTable from './StorageTierOptimizeTable';

const mockUseAppSelector = vi.fn((selector: any) =>
    selector({
        databaseHome: { selectedRowsForOptimizeInnerPage: [] },
        getWellOptimize: { inProgressOptimizationData: {} }
    })
);

vi.mock('react-redux', () => ({ useDispatch: () => vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

vi.mock('../../../../store/storeHooks', () => ({
    useAppSelector: (selector: any) => mockUseAppSelector(selector)
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: { NOT_AVAILABLE: 'N/A', OPTIMIZE: 'Optimize' }
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    checkBoxHandle: vi.fn(),
    getSelectedFromSelectionState: vi.fn(() => [])
}));

vi.mock('../../../../store/workloadFactory/databaseHomeSlice', () => ({
    setSelectedRowsForOptimizeInnerPage: vi.fn((v: any) => ({ type: 'setRows', payload: v }))
}));

vi.mock('../../../../utils/consts', () => ({
    ASSESSMENT_CONFIG_NAMES: { STORAGE_TIER: 'StorageTier' }
}));

vi.mock('../../../../common/hooks/useResize', () => ({
    default: () => ({ width: 1920 })
}));

vi.mock('../../GetWellUtils', () => ({
    getWadCellProps: vi.fn(() => ({}))
}));

vi.mock('../../../../common/BulkAction/BulkActionContainer', () => ({
    default: ({ onClick }: any) => (
        <div data-testid="bulk-action-container">
            <button onClick={() => onClick?.('optimize', [], 'StorageTier')}>Optimize All</button>
        </div>
    )
}));

vi.mock('@netapp/design-system', () => ({
    Table: ({ tableProps }: any) => <div data-testid="table" />,
    TableTopBar: ({ singularTitle, pluralTitle }: any) => (
        <div data-testid="table-top-bar">
            <span>{singularTitle}</span>
            <span>{pluralTitle}</span>
        </div>
    ),
    DsButton: ({ children, onClick }: any) => (
        <button data-testid="ds-button" onClick={onClick}>
            {children}
        </button>
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

describe('StorageTierOptimizeTable', () => {
    beforeEach(() => {
        mockUseAppSelector.mockImplementation((selector: any) =>
            selector({
                databaseHome: { selectedRowsForOptimizeInnerPage: [] },
                getWellOptimize: { inProgressOptimizationData: {} }
            })
        );
    });

    const defaultProps = {
        type: 'storageTier',
        data: {
            violationDetails: [
                { objectName: 'vol1', value: '80' },
                { objectName: 'vol2', value: '60' }
            ]
        },
        lastColDetails: mockLastColDetails,
        handleBulkAction: vi.fn(),
        isWad: false
    };

    it('renders table component', () => {
        render(<StorageTierOptimizeTable {...defaultProps} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders table top bar', () => {
        render(<StorageTierOptimizeTable {...defaultProps} />);
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
    });

    it('renders with empty data', () => {
        render(<StorageTierOptimizeTable {...defaultProps} data={{ violationDetails: [] }} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with isWad true', () => {
        render(<StorageTierOptimizeTable {...defaultProps} isWad />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders bulk action container', () => {
        mockUseAppSelector.mockImplementation((selector: any) =>
            selector({
                databaseHome: { selectedRowsForOptimizeInnerPage: [{ id: '1' }] },
                getWellOptimize: { inProgressOptimizationData: {} }
            })
        );
        render(<StorageTierOptimizeTable {...defaultProps} />);
        expect(screen.getByTestId('bulk-action-container')).toBeTruthy();
    });

    it('handles bulk action click', () => {
        mockUseAppSelector.mockImplementation((selector: any) =>
            selector({
                databaseHome: { selectedRowsForOptimizeInnerPage: [{ id: '1' }] },
                getWellOptimize: { inProgressOptimizationData: {} }
            })
        );
        const handleBulkAction = vi.fn();
        render(<StorageTierOptimizeTable {...defaultProps} handleBulkAction={handleBulkAction} />);
        const btn = screen.getByText('Optimize All');
        btn.click();
        expect(handleBulkAction).toHaveBeenCalled();
    });
});
