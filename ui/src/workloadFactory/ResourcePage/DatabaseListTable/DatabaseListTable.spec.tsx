import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import DatabaseListTable from './DatabaseListTable';

// --- Top-level imports for mocked modules (vi.mock is hoisted above these) ---
import { useAppSelector } from '../../../store/storeHooks';
import { getProtectionText } from '../../InventoryV2/InventoryUtilsV2';
import { formatSize } from '../../../utils/utilityFunctions';

// --- Mock @netapp/design-system ---
const mockUseTable = vi.fn(() => ({ rows: [], columns: [] }));

vi.mock('@netapp/design-system', () => ({
    Button: ({ children, onClick, isDisabled, 'data-testid': testId, variant, isThin, className }: any) => (
        <button data-testid={testId || 'button'} onClick={onClick} disabled={isDisabled} data-variant={variant}>
            {children}
        </button>
    ),
    TooltipInfo: ({ children }: any) => <div data-testid="tooltip-info">{children}</div>,
    SearchInput: (props: any) => <input data-testid="search-input" />,
    DsFlashingDotsLoader: () => <div data-testid="loader" />,
    Typography: ({ children, variant, className }: any) => (
        <span data-testid="typography" data-variant={variant} className={className}>
            {children}
        </span>
    )
}));

// --- Mock @tlveng/wlm-ds ---
vi.mock('@tlveng/wlm-ds', () => ({
    DsTypography: ({ children, variant, className, ...rest }: any) => (
        <span data-testid={rest['data-testid'] || 'ds-typography'} data-variant={variant} className={className}>
            {children}
        </span>
    )
}));

// --- Mock local Table modules ---
vi.mock('../../../common/Lib/Table/useTable', () => ({
    useTable: (...args: any[]) => mockUseTable(...args)
}));

vi.mock('../../../common/Lib/Table/TableTopBar', () => ({
    TableTopBar: ({ tableProps, pluralTitle, singularTitle, actionsRight }: any) => (
        <div data-testid="table-top-bar">
            <span data-testid="plural-title">{pluralTitle}</span>
            <span data-testid="singular-title">{singularTitle}</span>
            <div data-testid="actions-right">{actionsRight}</div>
        </div>
    )
}));

vi.mock('../../../common/Lib/Table/Table', () => ({
    Table: ({ tableProps }: any) => <div data-testid="table">{JSON.stringify(tableProps?.rows?.length ?? 0)}</div>
}));

// --- Mock SVG assets ---
vi.mock('../../../assets/row_arrow.svg', () => ({
    ReactComponent: () => <span data-testid="arrow-icon" />
}));

// --- Mock ResourcePageReplicaTable ---
vi.mock('./ResourcePageReplicaTable', () => ({
    default: () => <div data-testid="replica-table" />
}));

// --- Mock react-router-dom ---
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate
}));

// --- Mock react-redux ---
const mockDispatch = vi.fn();
vi.mock('react-redux', () => ({
    useDispatch: () => mockDispatch
}));

// --- Mock storeHooks ---
vi.mock('../../../store/storeHooks', () => ({
    useAppSelector: vi.fn()
}));

// --- Mock utility functions ---
vi.mock('../../../utils/utilityFunctions', () => ({
    formatSize: vi.fn((val: number) => (val ? `${val} GB` : 'N/A')),
    isAoagDeploymentType: vi.fn(() => false),
    expandTableRow: vi.fn(),
    hasAoagReplicas: vi.fn(() => false),
    getStickyClass: vi.fn(() => '')
}));

// --- Mock appConstants ---
vi.mock('../../../utils/appConstants', () => ({
    GENERAL: {
        DATABASE_NAME: 'Database Name',
        STATUS: 'Status',
        SIZE: 'Size',
        DB_HOST_PROTECTION_TYPE: 'Protection Type',
        DB_HOST_TYPE: 'Type',
        DB_HOST_COLLATION: 'Collation',
        NOT_AVAILABLE: 'N/A',
        PROTECTED: 'Protected',
        NOT_PROTECTED: 'Not Protected',
        JM_TYPE_CREATE_RESOURCE: 'Create New Database',
        FSX_FOR_ONTAP: 'fsxn'
    }
}));

// --- Mock consts ---
vi.mock('../../../utils/consts', () => ({
    PROTECTION_TEXT_STATUS: {
        YES: 'Yes',
        NO: 'No'
    },
    DATABASE_STATUS: {
        ONLINE: 'ONLINE',
        OFFLINE: 'OFFLINE'
    },
    REPLICA_ROLES: {
        PRIMARY: 'PRIMARY',
        SECONDARY: 'SECONDARY'
    }
}));

// --- Mock react-i18next ---
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

// --- Mock InventoryUtilsV2 ---
vi.mock('../../InventoryV2/InventoryUtilsV2', () => ({
    getProtectionText: vi.fn(() => 'Yes'),
    isAwsBackupEnabledText: vi.fn(() => 'Yes')
}));

// --- Mock DatabaseHostOverviewApiV2 (called as hook) ---
vi.mock('../ResourceHomePage/DatabaseHostOverviewApiV2', () => ({
    default: vi.fn()
}));

// --- Mock createNewDBSlice ---
vi.mock('../../../store/workloadFactory/createNewDBSlice', () => ({
    addInitialDBCreateData: vi.fn((data: any) => ({ type: 'addInitialDBCreateData', payload: data })),
    initialCreateNewUserState: {},
    setCdbPageData: vi.fn((data: any) => ({ type: 'setCdbPageData', payload: data }))
}));

// --- Mock authSlice ---
vi.mock('../../../store/authSlice', () => ({
    updateResourceId: vi.fn((id: any) => ({ type: 'updateResourceId', payload: id }))
}));

// --- Mock ProtectionIcons ---
vi.mock('../../../common/ProtectionIcons/ProtectionIcons', () => ({
    default: ({ protectionData }: any) => <div data-testid="protection-icons">{JSON.stringify(protectionData)}</div>
}));

// --- Mock SCSS modules ---
vi.mock('./DatabaseListTable.module.scss', () => ({
    default: {
        databaseListTable: 'databaseListTable',
        databaseButton: 'databaseButton',
        statusCell: 'statusCell',
        statusIcon: 'statusIcon',
        onIcon: 'onIcon',
        offIcon: 'offIcon',
        colText: 'colText',
        protection: 'protection'
    }
}));

vi.mock('../../../utils/CommonStyles.module.scss', () => ({
    default: {
        protectionIcons: 'protectionIcons'
    }
}));

const setupSelectors = (overrides: Record<string, any> = {}) => {
    const defaults: Record<string, any> = {
        'state.workloadFactoryResource.databaseList': [],
        'state.workloadFactoryResource.databaseListLoading': false,
        'state.getWellOptimize.selectedHostname': 'host1',
        'state.getWellOptimize.selectedDatabaseInstanceName': 'instanceName1',
        'state.workloadFactoryResource.resourceLoading': false,
        'state.workloadFactoryResource.selectedDatabaseInstance': 'db1',
        'state.workloadFactoryResource.selectedResourceId': 'res1',
        'state.workloadFactoryResource.selectedResourceCredId': 'cred1',
        'state.workloadFactoryResource.selectedResourceRegionId': 'region1',
        'state.workloadFactoryResource.replicaDatabasesMap': {},
        'state.workloadFactoryResource.replicaDatabasesLoading': false,
        'state.workloadFactoryResource.resourceDetails': {}
    };

    const merged = { ...defaults, ...overrides };

    (useAppSelector as any).mockImplementation((selector: any) => {
        // Call selector with a proxy to intercept the path
        const state = {
            workloadFactoryResource: {
                databaseList: merged['state.workloadFactoryResource.databaseList'],
                databaseListLoading: merged['state.workloadFactoryResource.databaseListLoading'],
                resourceLoading: merged['state.workloadFactoryResource.resourceLoading'],
                selectedDatabaseInstance: merged['state.workloadFactoryResource.selectedDatabaseInstance'],
                selectedResourceId: merged['state.workloadFactoryResource.selectedResourceId'],
                selectedResourceCredId: merged['state.workloadFactoryResource.selectedResourceCredId'],
                selectedResourceRegionId: merged['state.workloadFactoryResource.selectedResourceRegionId'],
                replicaDatabasesMap: merged['state.workloadFactoryResource.replicaDatabasesMap'],
                replicaDatabasesLoading: merged['state.workloadFactoryResource.replicaDatabasesLoading'],
                resourceDetails: merged['state.workloadFactoryResource.resourceDetails']
            },
            getWellOptimize: {
                selectedHostname: merged['state.getWellOptimize.selectedHostname'],
                selectedDatabaseInstanceName: merged['state.getWellOptimize.selectedDatabaseInstanceName']
            }
        };
        return selector(state);
    });
};

describe('DatabaseListTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseTable.mockReturnValue({ rows: [], columns: [] });
        setupSelectors();
    });

    it('should render the table top bar with Databases as plural title', () => {
        render(<DatabaseListTable />);
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
        expect(screen.getByTestId('plural-title').textContent).toBe('Databases');
    });

    it('should render the table top bar with Database as singular title', () => {
        render(<DatabaseListTable />);
        expect(screen.getByTestId('singular-title').textContent).toBe('Database');
    });

    it('should render the Table component', () => {
        render(<DatabaseListTable />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('should render the Create New Database button', () => {
        render(<DatabaseListTable />);
        expect(screen.getByTestId('wlm-db-create-new-database-button')).toBeTruthy();
        expect(screen.getByTestId('wlm-db-create-new-database-button').textContent).toBe(
            'databases.general.create-database'
        );
    });

    it('should disable create button when resourceLoading is true', () => {
        setupSelectors({ 'state.workloadFactoryResource.resourceLoading': true });
        render(<DatabaseListTable />);
        const btn = screen.getByTestId('wlm-db-create-new-database-button') as HTMLButtonElement;
        expect(btn.disabled).toBe(true);
    });

    it('should enable create button when resourceLoading is false', () => {
        setupSelectors({ 'state.workloadFactoryResource.resourceLoading': false });
        render(<DatabaseListTable />);
        const btn = screen.getByTestId('wlm-db-create-new-database-button') as HTMLButtonElement;
        expect(btn.disabled).toBe(false);
    });

    it('should dispatch addInitialDBCreateData when create button is clicked', async () => {
        render(<DatabaseListTable />);
        fireEvent.click(screen.getByTestId('wlm-db-create-new-database-button'));
        expect(mockDispatch).toHaveBeenCalledTimes(3);
    });

    it('should dispatch setCdbPageData with correct values when create button is clicked', async () => {
        const { setCdbPageData } = await import('../../../store/workloadFactory/createNewDBSlice');
        render(<DatabaseListTable />);
        fireEvent.click(screen.getByTestId('wlm-db-create-new-database-button'));
        expect(setCdbPageData).toHaveBeenCalledWith({
            dbHostName: 'host1',
            instanceId: 'db1',
            instanceName: 'instanceName1',
            cdbCredId: 'cred1',
            cdbRegionId: 'region1'
        });
    });

    it('should dispatch updateResourceId with selectedResourceId when create button is clicked', async () => {
        const { updateResourceId } = await import('../../../store/authSlice');
        render(<DatabaseListTable />);
        fireEvent.click(screen.getByTestId('wlm-db-create-new-database-button'));
        expect(updateResourceId).toHaveBeenCalledWith('res1');
    });

    it('should navigate to ../create-new-user when create button is clicked', () => {
        render(<DatabaseListTable />);
        fireEvent.click(screen.getByTestId('wlm-db-create-new-database-button'));
        expect(mockNavigate).toHaveBeenCalledWith('../create-new-user');
    });

    it('should pass databaseListLoading to useTable as isLazyLoading', () => {
        setupSelectors({ 'state.workloadFactoryResource.databaseListLoading': true });
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        expect(callArgs.isLazyLoading).toBe(true);
    });

    it('should pass formatted data rows to useTable', () => {
        const dbList = [
            {
                name: 'TestDB',
                status: 'ONLINE',
                size: 500,
                type: 'MSSQL',
                collation: 'Latin1_General',
                protection: { awsBackup: true }
            }
        ];
        setupSelectors({ 'state.workloadFactoryResource.databaseList': dbList });
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        expect(callArgs.rows).toBeDefined();
        expect(callArgs.rows.length).toBe(1);
    });

    it('should set isProtected to Protected when getProtectionText returns Yes', async () => {
        const { getProtectionText } = await import('../../InventoryV2/InventoryUtilsV2');
        (getProtectionText as any).mockReturnValue('Yes');
        const dbList = [{ name: 'DB1', status: 'ONLINE', size: 100, type: 'MSSQL', collation: null }];
        setupSelectors({ 'state.workloadFactoryResource.databaseList': dbList });
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        expect(callArgs.rows[0].isProtected).toBe('databases.general.protected');
    });

    it('should set isProtected to Not Protected when getProtectionText returns No', async () => {
        const { getProtectionText } = await import('../../InventoryV2/InventoryUtilsV2');
        (getProtectionText as any).mockReturnValue('No');
        const dbList = [{ name: 'DB2', status: 'OFFLINE', size: 200, type: 'MSSQL', collation: 'utf8' }];
        setupSelectors({ 'state.workloadFactoryResource.databaseList': dbList });
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        expect(callArgs.rows[0].isProtected).toBe('databases.general.not_protected');
    });

    it('should set isProtected to N/A when getProtectionText returns something else', async () => {
        const { getProtectionText } = await import('../../InventoryV2/InventoryUtilsV2');
        (getProtectionText as any).mockReturnValue('');
        const dbList = [{ name: 'DB3', status: 'UNKNOWN', size: 300, type: 'Oracle', collation: '' }];
        setupSelectors({ 'state.workloadFactoryResource.databaseList': dbList });
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        expect(callArgs.rows[0].isProtected).toBe('databases.general.not-available-table-columns');
    });

    it('should have 6 column definitions in useTable call', () => {
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        expect(callArgs.columns.length).toBe(6);
    });

    it('should pass pageSize of 50 to useTable', () => {
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        expect(callArgs.pageSize).toBe(50);
    });

    it('should pass isHorizontalScroll true to useTable', () => {
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        expect(callArgs.isHorizontalScroll).toBe(true);
    });

    it('should render N/A typography when notAvailable is invoked in renderCell', () => {
        (getProtectionText as any).mockReturnValue('Yes');
        const dbList = [{ name: 'DB4', status: 'ONLINE', size: 100, type: 'MSSQL', collation: null, protection: null }];
        setupSelectors({ 'state.workloadFactoryResource.databaseList': dbList });
        render(<DatabaseListTable />);
        // Render the protection cell renderCell for a row with no protection
        const callArgs = mockUseTable.mock.calls[0][0];
        const protectionColDef = callArgs.columns.find((c: any) => c.id === '4');
        const rendered = protectionColDef.renderCell(null, { protection: null });
        const { render: localRender, screen: localScreen } = require('@testing-library/react');
        const { unmount } = localRender(<div>{rendered}</div>);
        expect(localScreen.getByText('databases.general.not-available')).toBeTruthy();
        unmount();
    });

    it('should render ProtectionIcons when protection data is present in renderCell', () => {
        (getProtectionText as any).mockReturnValue('Yes');
        const protectionData = { awsBackup: true };
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        const protectionColDef = callArgs.columns.find((c: any) => c.id === '4');
        const rendered = protectionColDef.renderCell('Protected', { protection: protectionData });
        const { render: localRender, screen: localScreen } = require('@testing-library/react');
        const { unmount } = localRender(<div>{rendered}</div>);
        expect(localScreen.getByTestId('protection-icons')).toBeTruthy();
        unmount();
    });

    it('should render status icon ONLINE in renderCell for status column', () => {
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        const statusColDef = callArgs.columns.find((c: any) => c.id === '2');
        const { render: localRender, screen: localScreen } = require('@testing-library/react');
        const { unmount } = localRender(<div>{statusColDef.renderCell('ONLINE')}</div>);
        expect(localScreen.getByText('ONLINE')).toBeTruthy();
        unmount();
    });

    it('should render status icon OFFLINE in renderCell for status column', () => {
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        const statusColDef = callArgs.columns.find((c: any) => c.id === '2');
        const { render: localRender, screen: localScreen } = require('@testing-library/react');
        const { unmount } = localRender(<div>{statusColDef.renderCell('OFFLINE')}</div>);
        expect(localScreen.getByText('OFFLINE')).toBeTruthy();
        unmount();
    });

    it('should render formatted size using renderCell for size column', () => {
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        const sizeColDef = callArgs.columns.find((c: any) => c.id === '3');
        sizeColDef.renderCell(500);
        expect(formatSize).toHaveBeenCalledWith(500);
    });

    it('should render collation value in renderCell for collation column', () => {
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        const collationColDef = callArgs.columns.find((c: any) => c.id === '6');
        expect(collationColDef.renderCell('Latin1_General')).toBe('Latin1_General');
    });

    it('should render N/A for null collation in renderCell', () => {
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        const collationColDef = callArgs.columns.find((c: any) => c.id === '6');
        expect(collationColDef.renderCell(null)).toBe('databases.general.not-available');
    });

    it('should call DatabaseHostOverviewApiV2 as a hook on mount', async () => {
        const { default: DatabaseHostOverviewApiV2 } = await import('../ResourceHomePage/DatabaseHostOverviewApiV2');
        render(<DatabaseListTable />);
        expect(DatabaseHostOverviewApiV2).toHaveBeenCalled();
    });

    it('should handle empty databaseList gracefully', () => {
        setupSelectors({ 'state.workloadFactoryResource.databaseList': [] });
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        expect(callArgs.rows).toEqual([]);
    });

    it('should handle null databaseList gracefully', () => {
        setupSelectors({ 'state.workloadFactoryResource.databaseList': null });
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        expect(callArgs.rows).toEqual([]);
    });
});
