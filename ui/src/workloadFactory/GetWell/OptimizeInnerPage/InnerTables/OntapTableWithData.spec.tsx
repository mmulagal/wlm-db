import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import OntapTableWithData from './OntapTableWithData';

vi.mock('react', async () => {
    const actual = await vi.importActual('react');
    return {
        ...(actual as any),
        useState: vi.fn((init: any) => [init, vi.fn()]),
        useEffect: vi.fn(),
        useMemo: vi.fn((fn: any) => fn())
    };
});

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
    ASSESSMENT_CONFIG_NAMES: { ONTAP_EFFICIENCY: 'OntapEfficiency' },
    DBType: { ORACLE: 'ORACLE', MSSQL: 'MSSQL' }
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

describe('OntapTableWithData', () => {
    const defaultProps = {
        type: 'ontap',
        data: {
            type: 'volume',
            violationDetails: [
                { objectName: 'vol1', value: '80%' },
                { objectName: 'vol2', value: '60%' }
            ]
        },
        lastColDetails: mockLastColDetails,
        handleBulkAction: vi.fn(),
        engineType: 'ORACLE',
        isRecommendation: false,
        isWad: false
    };

    it('renders table', () => {
        render(<OntapTableWithData {...defaultProps} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with LUN type data', () => {
        render(
            <OntapTableWithData
                {...defaultProps}
                data={{ type: 'lun', violationDetails: [{ objectName: 'lun1', value: '50%' }] }}
            />
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with recommendation mode', () => {
        render(<OntapTableWithData {...defaultProps} isRecommendation />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with isWad true', () => {
        render(<OntapTableWithData {...defaultProps} isWad />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with empty violation details', () => {
        render(<OntapTableWithData {...defaultProps} data={{ type: 'volume', violationDetails: [] }} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });
});
