import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StorageLayoutOracleTable from './StorageLayoutOracleTable';

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
    ASSESSMENT_CONFIG_NAMES: {
        ORACLE_BINARY_PLACEMENT: 'OracleBinaryPlacement',
        DATAFILES_PLACEMENT: 'DatafilesPlacement',
        ARCHIVE_PLACEMENT: 'ArchivePlacement',
        REDO_LOGS_PLACEMENT: 'RedoLogsPlacement',
        TEMP_LOGS_PLACEMENT: 'TempLogsPlacement',
        CONTROLFILES_PLACEMENT: 'ControlfilesPlacement',
        DATA_DG_LUN_LAYOUT: 'DataDgLunLayout',
        LOG_DG_LUN_LAYOUT: 'LogDgLunLayout',
        FRA_DG_LUN_LAYOUT: 'FraDgLunLayout',
        ARCHIVELOG_DG_LUN_LAYOUT: 'ArchivelogDgLunLayout'
    }
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

describe('StorageLayoutOracleTable', () => {
    const defaultProps = {
        type: 'OracleBinaryPlacement',
        data: {
            violationDetails: [{ objectName: 'vol1', value: 'wrong-path' }]
        },
        lastColDetails: mockLastColDetails,
        handleBulkAction: vi.fn(),
        isWad: false
    };

    it('renders table for volume type configs', () => {
        render(<StorageLayoutOracleTable {...defaultProps} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders for disk group type configs', () => {
        render(<StorageLayoutOracleTable {...defaultProps} type="DataDgLunLayout" />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with empty data', () => {
        render(<StorageLayoutOracleTable {...defaultProps} data={{ violationDetails: [] }} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with isWad true', () => {
        render(<StorageLayoutOracleTable {...defaultProps} isWad />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders bulk action container when rows are selected', () => {
        mockSelectedRows.length = 0;
        mockSelectedRows.push({ id: '1', objectName: 'vol1' });
        render(<StorageLayoutOracleTable {...defaultProps} />);
        expect(screen.getByTestId('bulk-action-container')).toBeTruthy();
        mockSelectedRows.length = 0;
    });
});
