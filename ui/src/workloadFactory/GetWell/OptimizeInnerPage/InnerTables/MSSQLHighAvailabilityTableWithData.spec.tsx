import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MSSQLHighAvailabilityTableWithData from './MSSQLHighAvailabilityTableWithData';

vi.mock('react', async () => {
    const actual = await vi.importActual<typeof import('react')>('react');
    return {
        ...actual,
        useState: (initialValue: any) => [initialValue, vi.fn()]
    };
});

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
    ASSESSMENT_CONFIG_NAMES: {
        SHARED_STORAGE: 'SharedStorage',
        CLUSTER_QUORUM: 'ClusterQuorum',
        HEARTBEAT_SETTINGS: 'HeartbeatSettings',
        SQL_SERVER_SERVICE: 'SqlServerService',
        MSSQL_HIGH_AVAILABILITY: 'MSSQLHighAvailability'
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

const mockLastColDetails = vi.fn(() => ({
    Header: 'Actions',
    accessor: 'actions',
    id: 'actions',
    renderCell: () => <div>Action</div>
}));

describe('MSSQLHighAvailabilityTableWithData', () => {
    beforeEach(() => {
        mockUseAppSelector.mockImplementation((selector: any) =>
            selector({
                databaseHome: { selectedRowsForOptimizeInnerPage: [] },
                getWellOptimize: { inProgressOptimizationData: {} }
            })
        );
    });

    const defaultProps = {
        type: 'ha',
        data: {
            name: 'SharedStorage',
            objectsInViolation: ['lun1', 'lun2'],
            severity: 'critical'
        },
        lastColDetails: mockLastColDetails,
        handleBulkAction: vi.fn(),
        isWad: false
    };

    it('renders table for SharedStorage', () => {
        render(<MSSQLHighAvailabilityTableWithData {...defaultProps} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders table for ClusterQuorum type', () => {
        render(
            <MSSQLHighAvailabilityTableWithData
                {...defaultProps}
                data={{ ...defaultProps.data, name: 'ClusterQuorum' }}
            />
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders table for HeartbeatSettings type', () => {
        render(
            <MSSQLHighAvailabilityTableWithData
                {...defaultProps}
                data={{ ...defaultProps.data, name: 'HeartbeatSettings' }}
            />
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders table for SqlServerService type', () => {
        render(
            <MSSQLHighAvailabilityTableWithData
                {...defaultProps}
                data={{ ...defaultProps.data, name: 'SqlServerService' }}
            />
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with empty objectsInViolation', () => {
        render(
            <MSSQLHighAvailabilityTableWithData
                {...defaultProps}
                data={{ ...defaultProps.data, objectsInViolation: [] }}
            />
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with isWad true', () => {
        render(<MSSQLHighAvailabilityTableWithData {...defaultProps} isWad />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders bulk action container', () => {
        mockUseAppSelector.mockImplementation((selector: any) =>
            selector({
                databaseHome: { selectedRowsForOptimizeInnerPage: [{ id: '1' }] },
                getWellOptimize: { inProgressOptimizationData: {} }
            })
        );
        render(<MSSQLHighAvailabilityTableWithData {...defaultProps} />);
        expect(screen.getByTestId('bulk-action-container')).toBeTruthy();
    });
});
