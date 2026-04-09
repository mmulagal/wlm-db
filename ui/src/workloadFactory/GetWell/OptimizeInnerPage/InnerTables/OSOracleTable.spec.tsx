import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import OSOracleTable from './OSOracleTable';

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

vi.mock('../../../../utils/utilityFunctions', () => ({
    checkBoxHandle: vi.fn(),
    getSelectedFromSelectionState: vi.fn(() => [])
}));

vi.mock('../../../../store/workloadFactory/databaseHomeSlice', () => ({
    setSelectedRowsForOptimizeInnerPage: vi.fn((v: any) => ({ type: 'setRows', payload: v }))
}));

vi.mock('../../../../utils/consts', () => ({
    ASSESSMENT_CONFIG_NAMES: {
        NFS_MOUNT_OPTIONS_DATABASEFILES: 'NfsMountOptionsDatabasefiles',
        DNFS_CONFIGURATION_FILE: 'DnfsConfigurationFile',
        DNFS_NO_SHARED_CACHE: 'DnfsNoSharedCache'
    }
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

const mockLastColDetails = vi.fn((type: string, options: any, width?: string) => ({
    Header: 'Actions',
    accessor: 'actions',
    id: 'actions',
    renderCell: () => <div>Action</div>
}));

describe('OSOracleTable', () => {
    const defaultProps = {
        type: 'SomeOSConfig',
        data: {
            violationDetails: [{ objectName: 'config1', value: 'wrong-value', recommended: 'correct-value' }]
        },
        lastColDetails: mockLastColDetails,
        handleBulkAction: vi.fn(),
        isWad: false
    };

    it('renders table', () => {
        render(<OSOracleTable {...defaultProps} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders for NFS mount type', () => {
        render(<OSOracleTable {...defaultProps} type="NfsMountOptionsDatabasefiles" />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders for DNFS configuration type', () => {
        render(<OSOracleTable {...defaultProps} type="DnfsConfigurationFile" />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with empty data', () => {
        render(<OSOracleTable {...defaultProps} data={{ violationDetails: [] }} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with isWad true', () => {
        render(<OSOracleTable {...defaultProps} isWad />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders bulk action container when rows are selected', () => {
        mockSelectedRows.length = 0;
        mockSelectedRows.push({ id: '1', objectName: 'config1' });
        render(<OSOracleTable {...defaultProps} />);
        expect(screen.getByTestId('bulk-action-container')).toBeTruthy();
        mockSelectedRows.length = 0;
    });
});
