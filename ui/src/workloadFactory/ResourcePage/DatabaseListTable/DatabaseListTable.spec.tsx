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
const mockSetDialog = vi.fn();

vi.mock('@netapp/design-system', () => ({
    Button: ({ children, onClick, isDisabled, 'data-testid': testId, variant, isThin, className }: any) => (
        <button data-testid={testId || 'button'} onClick={onClick} disabled={isDisabled} data-variant={variant}>
            {children}
        </button>
    ),
    useDialog: () => ({ setDialog: mockSetDialog, closeDialog: vi.fn() }),
    TooltipInfo: ({ children }: any) => <div data-testid="tooltip-info">{children}</div>,
    Popover: ({ children, container }: any) => (
        <div data-testid="copy-popover">
            <span data-testid="popover-text">{children}</span>
            <div data-testid="popover-container">{container}</div>
        </div>
    ),
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

vi.mock('../../../assets/ic_copy.svg', () => ({
    ReactComponent: () => <span data-testid="copy-icon" />
}));

// --- Mock CopyToClipboardCommon ---
vi.mock('../../../common/CopyToClipboard/copyToClipboard', () => ({
    default: ({ value, iconProvided }: any) => (
        <button data-testid="copy-to-clipboard" data-value={value}>
            {iconProvided}
        </button>
    )
}));

// --- Mock TooltipComponent ---
vi.mock('../../../common/TooltipComponent/TooltipComponent', () => ({
    default: ({ children }: any) => <div data-testid="tooltip-component">{children}</div>
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

// --- Mock storeHooks ---
const mockDispatch = vi.fn();
vi.mock('../../../store/storeHooks', () => ({
    useAppSelector: vi.fn(),
    useAppDispatch: () => mockDispatch
}));

// --- Mock utility functions ---
vi.mock('../../../utils/utilityFunctions', () => ({
    formatSize: vi.fn((val: number) => (val ? `${val} GB` : 'N/A')),
    isAoagDeploymentType: vi.fn(() => false),
    expandTableRow: vi.fn(),
    hasAoagReplicas: vi.fn(() => false),
    getStickyClass: vi.fn(() => '')
}));

vi.mock('../../../common/Dialog/DialogComponent', () => ({
    default: ({ header, content }: any) => (
        <div data-testid="associated-luns-dialog">
            <div data-testid="dialog-header">{header}</div>
            <div data-testid="dialog-content">{content}</div>
        </div>
    )
}));

vi.mock('./AssociatedLunsDialogContent', () => ({
    default: ({ luns }: any) => <div data-testid="associated-luns-dialog-content">{JSON.stringify(luns ?? null)}</div>
}));

vi.mock('../../../common/InventoryStatusIndicator/InventoryStatusIndicator', () => ({
    default: ({ status }: any) => <span data-testid="inventory-status-indicator">{status}</span>
}));

// --- Mock consts ---
vi.mock('../../../utils/consts', () => ({
    PROTECTION_TEXT_STATUS: {
        YES: 'Yes',
        NO: 'No'
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

// --- Mock WellArchitectedTabUtils (isolate from heavy store/apiService imports) ---
vi.mock('../../WellArchitectedTab/WellArchitectedTabUtils', () => ({
    getUniqueLunNames: vi.fn((luns?: any) => {
        if (!luns) return [];
        const dataNames = (luns.dataFiles ?? []).map((f: any) => f?.name).filter(Boolean) as string[];
        const logNames = (luns.logFiles ?? []).map((f: any) => f?.name).filter(Boolean) as string[];
        return Array.from(new Set([...dataNames, ...logNames]));
    }),
    getLunFilterOptions: vi.fn((rows?: any[]) => {
        const unique = new Set<string>();
        (rows || []).forEach((row: any) => {
            (row?.lunPaths || []).forEach((path: string) => unique.add(path));
        });
        return Array.from(unique)
            .sort((a, b) => a.localeCompare(b))
            .map(path => ({ value: path, label: path }));
    })
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
        firstColText: 'firstColText',
        lunsCell: 'lunsCell',
        colText: 'colText',
        protection: 'protection',
        'arrow-down': 'arrow-down'
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
        'state.getWellOptimize.selectedDatabaseStorageType': null,
        'state.getWellOptimize.isWad': false,
        'state.getWellOptimize.innerPageDetails': null,
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
                selectedDatabaseInstanceName: merged['state.getWellOptimize.selectedDatabaseInstanceName'],
                selectedDatabaseStorageType: merged['state.getWellOptimize.selectedDatabaseStorageType'],
                isWad: merged['state.getWellOptimize.isWad'],
                innerPageDetails: merged['state.getWellOptimize.innerPageDetails']
            }
        };
        return selector(state);
    });
};

describe('DatabaseListTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSetDialog.mockClear();
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

    it('should have 7 column definitions in useTable call', () => {
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        expect(callArgs.columns.length).toBe(7);
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

    it('should render database name and status via InventoryStatusIndicator for first column', () => {
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        const nameColDef = callArgs.columns.find((c: any) => c.id === '1');
        const { render: localRender, screen: localScreen } = require('@testing-library/react');
        const { unmount } = localRender(<div>{nameColDef.renderCell(null, { name: 'MyDb', status: 'online' })}</div>);
        expect(localScreen.getByText('MyDb')).toBeTruthy();
        const indicator = localScreen.getByTestId('inventory-status-indicator');
        expect(indicator.textContent).toBe('online');
        unmount();
    });

    it('should show unique LUN count and View for associated LUNs column when luns are present', () => {
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        const lunsCol = callArgs.columns.find((c: any) => c.id === '8');
        const { render: localRender, screen: localScreen } = require('@testing-library/react');
        const row = {
            lunPaths: ['/vol/a/lun1', '/vol/b/lun2'],
            luns: {
                dataFiles: [{ name: '/vol/a/lun1', driveLetter: 'E:\\' }],
                logFiles: [
                    { name: '/vol/a/lun1', driveLetter: 'E:\\' },
                    { name: '/vol/b/lun2', driveLetter: 'F:\\' }
                ]
            }
        };
        const { unmount } = localRender(<div>{lunsCol.renderCell(null, row)}</div>);
        expect(localScreen.getByText('2')).toBeTruthy();
        expect(localScreen.getByText('databases.general.view')).toBeTruthy();
        unmount();
    });

    it('should open dialog when View is clicked for associated LUNs', () => {
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        const lunsCol = callArgs.columns.find((c: any) => c.id === '8');
        const { render: localRender, screen: localScreen } = require('@testing-library/react');
        const row = {
            lunPaths: ['/vol/x/lun1', '/vol/y/lun2'],
            luns: {
                dataFiles: [{ name: '/vol/x/lun1' }],
                logFiles: [{ name: '/vol/y/lun2' }]
            }
        };
        const { unmount } = localRender(<div>{lunsCol.renderCell(null, row)}</div>);
        fireEvent.click(localScreen.getByText('databases.general.view'));
        expect(mockSetDialog).toHaveBeenCalledTimes(1);
        unmount();
    });

    it('should pass lunPaths as additional search key to useTable', () => {
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        expect(callArgs.additionalSearchKeys).toEqual(['lunPaths', 'fsxId']);
    });

    it('should compute lunPaths for each formatted row based on LUN dataFiles and logFiles', () => {
        const dbList = [
            {
                name: 'DB-A',
                status: 'ONLINE',
                size: 100,
                type: 'MSSQL',
                luns: {
                    dataFiles: [{ name: '/vol/a/lun1' }],
                    logFiles: [{ name: '/vol/a/lun1' }, { name: '/vol/b/lun2' }]
                }
            }
        ];
        setupSelectors({ 'state.workloadFactoryResource.databaseList': dbList });
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        expect(callArgs.rows[0].lunPaths).toEqual(['/vol/a/lun1', '/vol/b/lun2']);
    });

    it('should build unique LUN filter options on the associated LUNs column', () => {
        const dbList = [
            {
                name: 'DB-A',
                status: 'ONLINE',
                size: 100,
                type: 'MSSQL',
                luns: {
                    dataFiles: [{ name: '/vol/a/lun1' }],
                    logFiles: [{ name: '/vol/b/lun2' }]
                }
            },
            {
                name: 'DB-B',
                status: 'ONLINE',
                size: 200,
                type: 'MSSQL',
                luns: {
                    dataFiles: [{ name: '/vol/b/lun2' }],
                    logFiles: [{ name: '/vol/c/lun3' }]
                }
            }
        ];
        setupSelectors({ 'state.workloadFactoryResource.databaseList': dbList });
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        const lunsCol = callArgs.columns.find((c: any) => c.id === '8');
        expect(lunsCol.customAccessor).toBe('lunPaths');
        expect(lunsCol.accessorForTextFilter).toBe('lunPaths');
        expect(lunsCol.filterOptions).toEqual([
            { value: '/vol/a/lun1', label: '/vol/a/lun1' },
            { value: '/vol/b/lun2', label: '/vol/b/lun2' },
            { value: '/vol/c/lun3', label: '/vol/c/lun3' }
        ]);
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

    it('should stamp fsxId and fsxForOntap on formatted rows when resourceDetails topology is present', () => {
        const dbList = [{ name: 'DB1', status: 'ONLINE', size: 100, type: 'MSSQL' }];
        setupSelectors({
            'state.workloadFactoryResource.databaseList': dbList,
            'state.workloadFactoryResource.resourceDetails': {
                topology: { fileSystemId: 'fs-abc123', fileSystemName: 'my-fsx' }
            }
        });
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        expect(callArgs.rows[0].fsxId).toBe('fs-abc123');
        expect(callArgs.rows[0].fsxForOntap).toBe('my-fsx');
    });

    it('should use innerPageDetails.fsxId for fsxId when isWad is true', () => {
        const dbList = [{ name: 'DB1', status: 'ONLINE', size: 100, type: 'MSSQL' }];
        setupSelectors({
            'state.workloadFactoryResource.databaseList': dbList,
            'state.getWellOptimize.isWad': true,
            'state.getWellOptimize.innerPageDetails': { fsxId: 'fs-wad-999' },
            'state.workloadFactoryResource.resourceDetails': {
                topology: { fileSystemId: 'fs-fallback', fileSystemName: 'fallback-fsx' }
            }
        });
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        expect(callArgs.rows[0].fsxId).toBe('fs-wad-999');
    });

    it('should render FSx id and file system name when fsxId is present in FSx for ONTAP column', () => {
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        const fsxColDef = callArgs.columns.find((c: any) => c.id === '9');
        const { render: localRender, screen: localScreen } = require('@testing-library/react');
        const { unmount } = localRender(<div>{fsxColDef.renderCell('my-fsx', { fsxId: 'fs-abc123' })}</div>);
        expect(localScreen.getByText('fs-abc123')).toBeTruthy();
        expect(localScreen.getByText('my-fsx')).toBeTruthy();
        const copyBtn = localScreen.getByTestId('copy-to-clipboard');
        expect(copyBtn.getAttribute('data-value')).toBe('fs-abc123');
        unmount();
    });

    it('should render N/A when fsxId is absent in FSx for ONTAP column', () => {
        render(<DatabaseListTable />);
        const callArgs = mockUseTable.mock.calls[0][0];
        const fsxColDef = callArgs.columns.find((c: any) => c.id === '9');
        const { render: localRender, screen: localScreen } = require('@testing-library/react');
        const { unmount } = localRender(<div>{fsxColDef.renderCell('', { fsxId: '' })}</div>);
        expect(localScreen.getByText('databases.general.not-available-table-columns')).toBeTruthy();
        unmount();
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
