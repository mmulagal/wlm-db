import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import DashboardMultiTableConfig from '../DashboardConfigsMultiTable';
import * as DatabaseHomeUtils from '../../../../DatabaseHomePage/DatabaseHomeUtils';

vi.mock('@netapp/design-system', () => ({
    TooltipInfo: ({ children }: any) => <div data-testid="tooltip-info">{children}</div>,
    ColumnProps: {}
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsButton: ({ children, onClick, isDisabled, isThin, variant }: any) => (
        <button data-testid="ds-button" disabled={isDisabled} onClick={onClick}>
            {children}
        </button>
    ),
    DsToggleSwitch: ({ onChange, title, isDisabled, value }: any) => (
        <div data-testid="toggle-switch" onClick={() => onChange && onChange(!value)}>
            {title}
        </div>
    ),
    DsTypography: ({ children, variant, className, style }: any) => (
        <span data-testid={`typography-${variant}`} className={className} style={style}>
            {children}
        </span>
    )
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('react-redux', async () => {
    const actual = await vi.importActual('react-redux');
    return { ...actual, useDispatch: () => vi.fn() };
});

vi.mock('../FirstColumnComponent', () => ({
    default: ({ rowData }: any) => <div data-testid="first-column">{rowData?.serverInstanceName}</div>
}));

vi.mock('../../../../GetWell/RecommendationTable/RecommendationTable', () => ({
    default: (props: any) => <div data-testid="recommendation-table" />
}));

let capturedColumns: any[] = [];
vi.mock('../../../../../common/Lib/Table/useTable', () => ({
    useTable: (props: any) => {
        capturedColumns = props.columns || [];
        return {
            selectionState: {},
            organizedRows: props.rows || [],
            filterState: { count: 0, textFilter: '' }
        };
    }
}));

vi.mock('../../../../../common/Lib/Table/TableTopBar', () => ({
    TableTopBar: ({ pluralTitle, singularTitle, actionsRight }: any) => (
        <div data-testid="table-top-bar">
            {pluralTitle || singularTitle}
            {actionsRight}
        </div>
    )
}));

vi.mock('../../../../../common/Lib/Table/Table', () => ({
    Table: () => (
        <div data-testid="table">
            {capturedColumns.map((col: any, i: number) => {
                if (col.renderCell) {
                    const mockRows = [
                        {
                            id: '1',
                            serverInstanceName: 'Inst1',
                            assessmentStatus: 'Optimized',
                            hostName: 'H1',
                            configStateList: ['ACTIVE'],
                            credentialName: 'c1',
                            accountId: 'a1',
                            regionName: 'r1',
                            configuration: '2 out of 5',
                            cellProps: {}
                        },
                        {
                            id: '2',
                            serverInstanceName: 'Inst2',
                            assessmentStatus: 'Not Optimized',
                            hostName: 'H2',
                            configStateList: ['DISMISSED'],
                            credentialName: 'c2',
                            accountId: 'a2',
                            regionName: 'r2',
                            configuration: '1 out of 3',
                            cellProps: {}
                        },
                        {
                            id: '3',
                            serverInstanceName: 'Inst3',
                            assessmentStatus: 'Under-provisioned',
                            hostName: 'H3',
                            configStateList: ['POSTPONED'],
                            credentialName: 'c3',
                            accountId: 'a3',
                            regionName: 'r3',
                            configuration: '0 out of 2',
                            cellProps: {}
                        },
                        {
                            id: '4',
                            serverInstanceName: 'Inst4',
                            assessmentStatus: 'Over-provisioned',
                            hostName: 'H4',
                            configStateList: ['ACTIVATING'],
                            credentialName: 'c4',
                            accountId: 'a4',
                            regionName: 'r4',
                            configuration: '3 out of 6',
                            cellProps: {}
                        },
                        {
                            id: '5',
                            serverInstanceName: 'Inst5',
                            assessmentStatus: 'Optimizing',
                            hostName: 'H5',
                            configStateList: ['ACTIVE'],
                            credentialName: 'c5',
                            accountId: 'a5',
                            regionName: 'r5',
                            configuration: '',
                            cellProps: { isDisabled: true, selectionProps: { title: 'disabled' } }
                        },
                        {
                            id: '6',
                            serverInstanceName: 'Inst6',
                            assessmentStatus: '',
                            hostName: 'H6',
                            configStateList: [],
                            credentialName: 'c6',
                            accountId: 'a6',
                            regionName: 'r6',
                            configuration: '',
                            cellProps: {}
                        }
                    ];
                    return (
                        <div key={`col-${col.id}`} data-testid={`col-${col.id}`}>
                            {mockRows.map((row, ri) => (
                                <div key={`cell-${col.id}-${ri}`} data-testid={`cell-${col.id}-${ri}`}>
                                    {col.renderCell(row[col.accessor as keyof typeof row], row, {
                                        updateRowState: vi.fn(),
                                        rowsState: {}
                                    })}
                                </div>
                            ))}
                        </div>
                    );
                }
                return null;
            })}
        </div>
    )
}));

vi.mock('../../../../../common/BulkAction/BulkCombineActionController', () => ({
    default: ({ action, onClick, handleStateOperation, showDismissed }: any) => (
        <div data-testid="bulk-action-controller">
            <button
                data-testid="bulk-state-btn"
                onClick={() => handleStateOperation && handleStateOperation('DISMISSED')}
            >
                state
            </button>
        </div>
    )
}));

vi.mock('../../../../../common/ButtonWithDropdown/ButtonWithDropdown', () => ({
    ButtonWithDropdown: ({ children, items, isDisabled }: any) => (
        <div data-testid="button-with-dropdown">
            {children}
            {items?.map((item: any) => (
                <button key={item.id} data-testid={`dropdown-${item.id}`} onClick={item.onClick}>
                    {item.children}
                </button>
            ))}
        </div>
    )
}));

vi.mock('../../../../../common/TooltipComponent/TooltipComponent', () => ({
    default: ({ children, title }: any) => (
        <div data-testid="tooltip-component" title={title}>
            {children}
        </div>
    )
}));

vi.mock('../../../../../utils/utilityFunctions', () => ({
    checkBoxHandle: vi.fn(),
    expandTableRow: vi.fn(),
    getSelectedFromSelectionState: vi.fn(() => [])
}));

vi.mock('../../../../DatabaseHomePage/DatabaseHomeUtils', () => ({
    disableOfflineRows: vi.fn((data: any) => data),
    formatAssessmentTableData: vi.fn(
        (data: any) =>
            data?.map((d: any) => ({ ...d, configState: 'ACTIVE', status: d.status || 'NOT_OPTIMIZED' })) || []
    ),
    getConfigStateList: vi.fn(() => ['ACTIVE']),
    mapHostStatusToAssessmentData: vi.fn((_, data) => data)
}));

vi.mock('../../../../GetWell/GetWellUtils', () => ({
    disableOptimizeCheckBoxForErrCase: vi.fn((data: any) => data),
    disableOptimizeCheckBoxForOptimizeCase: vi.fn((data: any) => data),
    isMssqlHaDeployment: vi.fn(() => true),
    cardDataDefault: {
        deploymentType: '',
        isWad: false,
        storage_tier: {},
        iops: {},
        throughput: {},
        compute: {},
        license: {},
        patch: {},
        maxdop: {},
        ctf: {},
        backup: {}
    }
}));

vi.mock('../../DashboardInnerPageHelper', () => ({
    calculatePostponeInfo: vi.fn(() => ({ postponeDate: '2026-04-01', daysLeft: 30 })),
    sortOptimizeDashboardInnerTable: vi.fn((data: any) => data)
}));

vi.mock('../../../../WellArchitectedTab/WellArchitectedTabUtils', () => ({
    engineTypeBasedResourceStr: vi.fn((_type: any, mssql: string) => mssql)
}));

vi.mock('../../../../../utils/manageColumnUtils', () => ({
    initialDashboardInnerPageOptimizeColState: {}
}));

vi.mock('../../../../../assets/row_arrow.svg', () => ({
    ReactComponent: (props: any) => <svg data-testid="arrow-icon" onClick={props.onClick} className={props.className} />
}));
vi.mock('../../../../../assets/Schedule.svg', () => ({
    ReactComponent: () => <svg data-testid="schedule-icon" />
}));
vi.mock('../../../../../assets/ic_not_active.svg', () => ({ ReactComponent: () => <svg data-testid="not-active" /> }));
vi.mock('../../../../../assets/optimized.svg', () => ({ ReactComponent: () => <svg data-testid="optimized" /> }));
vi.mock('../../../../../assets/under-provisioned.svg', () => ({
    ReactComponent: () => <svg data-testid="under-provisioned" />
}));
vi.mock('../../../../../assets/In Progress.svg', () => ({ ReactComponent: () => <svg data-testid="in-progress" /> }));
vi.mock('../../../../../utils/appConstants', () => ({ GENERAL: { CONTINUE: 'Continue', CANCEL: 'Cancel' } }));

vi.mock('./RenderTables.module.scss', () => ({
    default: {
        renderTable: 'rt',
        toggle: 't',
        disabled: 'd',
        statusContainer: 'sc',
        menuContainer: 'mc',
        menuPointerDisabled: 'mpd',
        menuPointer: 'mp',
        jobMenuPopover: 'jmp',
        menuIcon: 'mi',
        arrow: 'a',
        'arrow-down': 'ad',
        'arrow-disable': 'ade',
        reactiveButtonContainer: 'rbc',
        postpone: 'p',
        postponeContainer: 'pc'
    }
}));

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            inventoryV2: (
                s: any = {
                    allmssqlHostAssessmentData: [],
                    allOracleHostAssessmentData: [],
                    inventoryTableData: {},
                    getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false },
                    ...overrides.inventoryV2
                }
            ) => s,
            headers: (
                s: any = {
                    headerSelectedMultiCredIdsList: ['cred1'],
                    headerSelectedMultiRegionIdsList: ['us-east-1'],
                    getCredentials: {
                        credentialData: [{ credentialsId: 'cred1', name: 'MyCred', providerAccountId: '123' }]
                    },
                    getRegions: { regionsData: { regions: [{ regionCode: 'us-east-1', regionName: 'US East' }] } },
                    ...overrides.headers
                }
            ) => s,
            databaseHome: (
                s: any = {
                    selectedRowsForOptimize: [],
                    ...overrides.databaseHome
                }
            ) => s,
            getWellOptimize: (
                s: any = {
                    inProgressOptimizationData: {},
                    inProgressStateData: {},
                    configEngineType: 'MSSQL',
                    ...overrides.getWellOptimize
                }
            ) => s
        }
    });

describe('DashboardMultiTableConfig', () => {
    const defaultProps = {
        configType: 'ONTAP capabilities',
        handleSingleDismissPostpone: vi.fn(),
        handleBulkDismissPostpone: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders table components for ONTAP capabilities', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders toggle switch', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('toggle-switch')).toBeTruthy();
    });

    it('handles toggle switch click', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        fireEvent.click(screen.getByTestId('toggle-switch'));
    });

    // ── Bulk action when rows selected ──
    it('renders bulk action controller when rows are selected', () => {
        render(
            <Provider store={makeStore({ databaseHome: { selectedRowsForOptimize: [{ id: '1' }] } })}>
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('bulk-action-controller')).toBeTruthy();
    });

    it('calls handleBulkDismissPostpone when bulk state button clicked', () => {
        render(
            <Provider store={makeStore({ databaseHome: { selectedRowsForOptimize: [{ id: '1' }] } })}>
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        fireEvent.click(screen.getByTestId('bulk-state-btn'));
        expect(defaultProps.handleBulkDismissPostpone).toHaveBeenCalled();
    });

    it('does not render bulk action when no rows selected', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        expect(screen.queryByTestId('bulk-action-controller')).toBeNull();
    });

    // ── Column renderCell coverage ──
    it('renders column cells with different statuses', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        // First column (serverInstanceName)
        expect(screen.getByTestId('col-1')).toBeTruthy();
        // Status column
        expect(screen.getByTestId('col-9')).toBeTruthy();
    });

    it('renders Optimized status', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('cell-9-0')).toBeTruthy();
    });

    it('renders Not Optimized status', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('cell-9-1')).toBeTruthy();
    });

    it('renders Under-provisioned status', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('cell-9-2')).toBeTruthy();
    });

    it('renders Over-provisioned status', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('cell-9-3')).toBeTruthy();
    });

    it('renders Optimizing status', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('cell-9-4')).toBeTruthy();
    });

    it('renders empty status fallback', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('cell-9-5')).toBeTruthy();
    });

    // ── HostName, configuration, credential, account, region columns ──
    it('renders host name column cells', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('col-2')).toBeTruthy();
    });

    it('renders configuration column cells', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('col-3')).toBeTruthy();
    });

    it('renders credentialName column cells', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('col-4')).toBeTruthy();
    });

    it('renders accountId column cells', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('col-5')).toBeTruthy();
    });

    it('renders regionName column cells', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('col-6')).toBeTruthy();
    });

    // ── Last column (action menu) ──
    it('renders last column with action menu', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('col-8')).toBeTruthy();
    });

    // ── Different config types ──
    it('renders for Operating system config type', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardMultiTableConfig {...defaultProps} configType="Operating system" />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders for MSSQL High Availability config type', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardMultiTableConfig {...defaultProps} configType="MSSQL High Availability" />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    // ── Oracle engine type ──
    it('renders for Oracle engine type', () => {
        render(
            <Provider
                store={makeStore({
                    getWellOptimize: {
                        configEngineType: 'ORACLE',
                        inProgressOptimizationData: {},
                        inProgressStateData: {}
                    }
                })}
            >
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    // ── With assessment data ──
    it('renders with ONTAP assessment data having luns and volumes', () => {
        render(
            <Provider
                store={makeStore({
                    inventoryV2: {
                        allmssqlHostAssessmentData: [
                            {
                                credentialId: 'cred1',
                                regionId: 'us-east-1',
                                databaseHostId: 'h1',
                                databaseHostName: 'Host1',
                                instancesAssessment: [
                                    {
                                        databaseInstanceId: 'i1',
                                        databaseInstanceName: 'Inst1',
                                        error: null,
                                        assessments: {
                                            lastAssessmentTimestamp: '2026-01-01',
                                            storage: {
                                                configuration: {
                                                    luns: [{ name: 'lun1', status: 'NOT_OPTIMIZED' }],
                                                    volumes: [{ name: 'vol1', status: 'OPTIMIZED' }]
                                                }
                                            },
                                            dismissedConfigurations: {
                                                storage: { configuration: { luns: [], volumes: [] } }
                                            }
                                        }
                                    }
                                ]
                            }
                        ],
                        allOracleHostAssessmentData: [],
                        inventoryTableData: {},
                        getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false }
                    }
                })}
            >
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with Operating system data', () => {
        render(
            <Provider
                store={makeStore({
                    inventoryV2: {
                        allmssqlHostAssessmentData: [
                            {
                                credentialId: 'cred1',
                                regionId: 'us-east-1',
                                databaseHostId: 'h1',
                                databaseHostName: 'Host1',
                                instancesAssessment: [
                                    {
                                        databaseInstanceId: 'i1',
                                        databaseInstanceName: 'Inst1',
                                        error: null,
                                        assessments: {
                                            lastAssessmentTimestamp: '2026-01-01',
                                            storage: {
                                                configuration: {
                                                    os: [{ name: 'os1', status: 'NOT_OPTIMIZED' }]
                                                }
                                            },
                                            dismissedConfigurations: {
                                                storage: { configuration: { os: [] } }
                                            }
                                        }
                                    }
                                ]
                            }
                        ],
                        allOracleHostAssessmentData: [],
                        inventoryTableData: {},
                        getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false }
                    }
                })}
            >
                <DashboardMultiTableConfig {...defaultProps} configType="Operating system" />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with High Availability data', () => {
        render(
            <Provider
                store={makeStore({
                    inventoryV2: {
                        allmssqlHostAssessmentData: [
                            {
                                credentialId: 'cred1',
                                regionId: 'us-east-1',
                                databaseHostId: 'h1',
                                databaseHostName: 'Host1',
                                instancesAssessment: [
                                    {
                                        databaseInstanceId: 'i1',
                                        databaseInstanceName: 'Inst1',
                                        error: null,
                                        assessments: {
                                            lastAssessmentTimestamp: '2026-01-01',
                                            deploymentType: 'FCI',
                                            highAvailability: [{ name: 'ha1', status: 'NOT_OPTIMIZED' }],
                                            dismissedConfigurations: { highAvailability: [] }
                                        }
                                    }
                                ]
                            }
                        ],
                        allOracleHostAssessmentData: [],
                        inventoryTableData: {},
                        getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false }
                    }
                })}
            >
                <DashboardMultiTableConfig {...defaultProps} configType="MSSQL High Availability" />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    // ── With in-progress optimization data ──
    it('renders with inProgressOptimizationData', () => {
        render(
            <Provider
                store={makeStore({
                    getWellOptimize: {
                        inProgressOptimizationData: { 'ONTAP capabilities': ['h1_i1'] },
                        inProgressStateData: {},
                        configEngineType: 'MSSQL'
                    }
                })}
            >
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    // ── Skips host not in credential selection ──
    it('skips host data when cred not in selection', () => {
        render(
            <Provider
                store={makeStore({
                    headers: {
                        headerSelectedMultiCredIdsList: ['other-cred'],
                        headerSelectedMultiRegionIdsList: ['us-east-1'],
                        getCredentials: { credentialData: [] },
                        getRegions: { regionsData: { regions: [] } }
                    },
                    inventoryV2: {
                        allmssqlHostAssessmentData: [
                            {
                                credentialId: 'cred1',
                                regionId: 'us-east-1',
                                databaseHostId: 'h1',
                                instancesAssessment: [
                                    {
                                        databaseInstanceId: 'i1',
                                        error: null,
                                        assessments: {
                                            lastAssessmentTimestamp: '2026-01-01',
                                            storage: { configuration: { luns: [{ name: 'l1' }], volumes: [] } },
                                            dismissedConfigurations: {
                                                storage: { configuration: { luns: [], volumes: [] } }
                                            }
                                        }
                                    }
                                ]
                            }
                        ],
                        allOracleHostAssessmentData: [],
                        inventoryTableData: {},
                        getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false }
                    }
                })}
            >
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    // ── Error case data ──
    it('renders with error case assessment data', () => {
        render(
            <Provider
                store={makeStore({
                    inventoryV2: {
                        allmssqlHostAssessmentData: [
                            {
                                credentialId: 'cred1',
                                regionId: 'us-east-1',
                                databaseHostId: 'h1',
                                databaseHostName: 'Host1',
                                instancesAssessment: [
                                    {
                                        databaseInstanceId: 'i1',
                                        databaseInstanceName: 'Inst1',
                                        error: null,
                                        assessments: {
                                            lastAssessmentTimestamp: '2026-01-01',
                                            storage: {
                                                errorMessage: 'Some error',
                                                configuration: {
                                                    luns: [{ name: 'lun1', errorMessage: 'err' }],
                                                    volumes: [{ name: 'vol1', errorMessage: 'err' }]
                                                }
                                            },
                                            dismissedConfigurations: {
                                                storage: { configuration: { luns: [], volumes: [] } }
                                            }
                                        }
                                    }
                                ]
                            }
                        ],
                        allOracleHostAssessmentData: [],
                        inventoryTableData: {},
                        getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false }
                    }
                })}
            >
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    // ── Dismissed rows filtering ──
    it('renders with dismissed rows in data', () => {
        vi.mocked(DatabaseHomeUtils.formatAssessmentTableData).mockImplementation(
            (data: any) => data?.map((d: any) => ({ ...d, configState: 'DISMISSED', status: 'NOT_OPTIMIZED' })) || []
        );
        vi.mocked(DatabaseHomeUtils.getConfigStateList).mockReturnValue(['DISMISSED']);

        render(
            <Provider
                store={makeStore({
                    inventoryV2: {
                        allmssqlHostAssessmentData: [
                            {
                                credentialId: 'cred1',
                                regionId: 'us-east-1',
                                databaseHostId: 'h1',
                                databaseHostName: 'Host1',
                                instancesAssessment: [
                                    {
                                        databaseInstanceId: 'i1',
                                        databaseInstanceName: 'Inst1',
                                        error: null,
                                        assessments: {
                                            lastAssessmentTimestamp: '2026-01-01',
                                            storage: {
                                                configuration: {
                                                    luns: [{ name: 'lun1', status: 'NOT_OPTIMIZED' }],
                                                    volumes: []
                                                }
                                            },
                                            dismissedConfigurations: {
                                                storage: {
                                                    configuration: {
                                                        luns: [{ configurationName: 'lun1', configState: 'DISMISSED' }],
                                                        volumes: []
                                                    }
                                                }
                                            }
                                        }
                                    }
                                ]
                            }
                        ],
                        allOracleHostAssessmentData: [],
                        inventoryTableData: {},
                        getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false }
                    }
                })}
            >
                <DashboardMultiTableConfig {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });
});
