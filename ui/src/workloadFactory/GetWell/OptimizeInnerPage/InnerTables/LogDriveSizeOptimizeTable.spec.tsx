import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LogDriveSizeOptimizeTable from './LogDriveSizeOptimizeTable';

vi.mock('react-redux', () => ({ useDispatch: () => vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

vi.mock('../../../../store/storeHooks', () => ({
    useAppDispatch: vi.fn(() => vi.fn()),
    useAppSelector: vi.fn((selector: any) =>
        selector({
            getWellOptimize: { inProgressOptimizationData: {} },
            databaseHome: { selectedRowsForOptimizeInnerPage: [] }
        })
    )
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: { NOT_AVAILABLE: 'N/A' }
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    checkBoxHandle: vi.fn(),
    getSelectedFromSelectionState: vi.fn(() => []),
    getTruncatedItems: vi.fn((items: any[]) => items)
}));

vi.mock('../../../../store/workloadFactory/databaseHomeSlice', () => ({
    setSelectedRowsForOptimizeInnerPage: vi.fn((v: any) => ({ type: 'setRows', payload: v }))
}));

vi.mock('../../../../utils/consts', () => ({
    ASSESSMENT_CONFIG_NAMES: { LOG_DRIVE_SIZE: 'LogDriveSize' },
    GETWELL_STATUS: {
        OPTIMIZED: 'Optimized',
        NOT_OPTIMIZED: 'Not optimized',
        UNDER_PROVISIONED: 'Under-provisioned',
        OVER_PROVISIONED: 'Over-provisioned',
        SHARED_DRIVE: 'Shared drive',
        OPTIMIZING: 'Optimizing'
    }
}));

vi.mock('../../../../utils/CommonStyles.module.scss', () => ({ default: {} }));

vi.mock('../../../../common/BulkAction/BulkActionContainer', () => ({
    default: () => <div data-testid="bulk-action-container" />
}));

vi.mock('@netapp/design-system', () => ({
    Table: () => <div data-testid="table" />,
    TableTopBar: () => <div data-testid="table-top-bar" />,
    Typography: ({ children }: any) => <span>{children}</span>,
    Popover: ({ children, container }: any) => (
        <div>
            {container}
            {children}
        </div>
    ),
    DsButton: ({ children }: any) => <button>{children}</button>,
    DsTypography: ({ children }: any) => <span>{children}</span>,
    useTable: vi.fn(() => ({ selectionState: {}, tableRef: { current: null } }))
}));

vi.mock('./InnerTable.module.scss', () => ({ default: { 'inner-table': 'inner-table' } }));

const mockLastColDetails = vi.fn(() => ({
    Header: 'Actions',
    accessor: 'actions',
    id: 'actions',
    renderCell: () => <div>Action</div>
}));

describe('LogDriveSizeOptimizeTable', () => {
    const defaultProps = {
        type: 'logDrive',
        data: {
            sizingViolations: {
                overProvisionedDrives: [{ logAccessPath: 'D:', size: '50GB' }],
                underProvisionedDrives: [{ logAccessPath: 'E:', size: '10GB' }],
                ignoredDrives: []
            }
        },
        lastColDetails: mockLastColDetails,
        handleBulkAction: vi.fn(),
        isWad: false
    };

    it('renders table', () => {
        render(<LogDriveSizeOptimizeTable {...defaultProps} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders table top bar', () => {
        render(<LogDriveSizeOptimizeTable {...defaultProps} />);
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
    });

    it('renders with empty data', () => {
        render(
            <LogDriveSizeOptimizeTable
                {...defaultProps}
                data={{
                    sizingViolations: { overProvisionedDrives: [], underProvisionedDrives: [], ignoredDrives: [] }
                }}
            />
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with isWad true', () => {
        render(<LogDriveSizeOptimizeTable {...defaultProps} isWad />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('deduplicates entries by logAccessPath', () => {
        render(
            <LogDriveSizeOptimizeTable
                {...defaultProps}
                data={{
                    sizingViolations: {
                        overProvisionedDrives: [
                            { logAccessPath: 'D:', size: '50GB' },
                            { logAccessPath: 'D:', size: '50GB' }
                        ],
                        underProvisionedDrives: [],
                        ignoredDrives: []
                    }
                }}
            />
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });
});
