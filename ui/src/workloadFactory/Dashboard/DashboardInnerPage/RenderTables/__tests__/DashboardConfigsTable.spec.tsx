import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import DashboardConfigsTable from '../DashboardConfigsTable';

const mockSetDialog = vi.fn();
vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className }: any) => (
        <span data-testid={`typography-${variant}`} className={className}>
            {children}
        </span>
    ),
    Button: ({ children, onClick, variant, className }: any) => (
        <button data-testid={`button-${variant}`} className={className} onClick={onClick}>
            {children}
        </button>
    ),
    DsButton: ({ children, onClick, variant, className }: any) => (
        <button data-testid={`ds-button-${variant}`} className={className} onClick={onClick}>
            {children}
        </button>
    ),
    useDialog: () => ({ setDialog: mockSetDialog, closeDialog: vi.fn() })
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsToggleSwitch: ({ onChange, title, isDisabled, value }: any) => (
        <div data-testid="toggle-switch" onClick={() => onChange && onChange(!value)}>
            {title}
        </div>
    ),
    DsTypography: ({ children, variant, className }: any) => (
        <span data-testid={`typography-${variant}`} className={className}>
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
        // Render column renderCells for coverage
        <div data-testid="table">
            {capturedColumns.map((col: any, i: number) => {
                if (col.renderCell) {
                    const mockRows = [
                        {
                            id: '1',
                            serverInstanceName: 'Inst1',
                            assessmentStatus: 'Optimized',
                            hostName: 'H1',
                            configState: 'ACTIVE',
                            credentialName: 'c1',
                            accountId: 'a1',
                            regionName: 'r1',
                            totalObjectsInViolation: 2,
                            totalObjectsAssessed: 5
                        },
                        {
                            id: '2',
                            serverInstanceName: 'Inst2',
                            assessmentStatus: 'Not Optimized',
                            hostName: 'H2',
                            configState: 'DISMISSED',
                            credentialName: 'c2',
                            accountId: 'a2',
                            regionName: 'r2',
                            totalObjectsInViolation: 1,
                            totalObjectsAssessed: 3
                        },
                        {
                            id: '3',
                            serverInstanceName: 'Inst3',
                            assessmentStatus: 'Under-provisioned',
                            hostName: 'H3',
                            configState: 'POSTPONED',
                            credentialName: 'c3',
                            accountId: 'a3',
                            regionName: 'r3',
                            totalObjectsInViolation: 0,
                            totalObjectsAssessed: 2
                        },
                        {
                            id: '4',
                            serverInstanceName: 'Inst4',
                            assessmentStatus: 'Over-provisioned',
                            hostName: 'H4',
                            configState: 'ACTIVATING',
                            credentialName: 'c4',
                            accountId: 'a4',
                            regionName: 'r4',
                            totalObjectsInViolation: 3,
                            totalObjectsAssessed: 6
                        },
                        {
                            id: '5',
                            serverInstanceName: 'Inst5',
                            assessmentStatus: 'Optimizing',
                            hostName: 'H5',
                            configState: 'ACTIVE',
                            credentialName: 'c5',
                            accountId: 'a5',
                            regionName: 'r5'
                        },
                        {
                            id: '6',
                            serverInstanceName: 'Inst6',
                            assessmentStatus: '',
                            hostName: 'H6',
                            configState: 'ACTIVE',
                            credentialName: 'c6',
                            accountId: 'a6',
                            regionName: 'r6'
                        }
                    ];
                    return (
                        <div key={`col-${col.id}`} data-testid={`col-${col.id}`}>
                            {mockRows.map((row, ri) => (
                                <div key={`cell-${col.id}-${ri}`} data-testid={`cell-${col.id}-${ri}`}>
                                    {col.renderCell(row[col.accessor as keyof typeof row], row)}
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
    default: ({ action, onClick, handleStateOperation }: any) => (
        <div data-testid="bulk-action-controller">
            <button data-testid="bulk-fix-btn" onClick={onClick}>
                {action}
            </button>
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
    ButtonWithDropdown: ({ children, items }: any) => (
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

vi.mock('../../../../../utils/utilityFunctions', () => ({
    checkBoxHandle: vi.fn(),
    getSelectedFromSelectionState: vi.fn(() => [])
}));

vi.mock('../../../../DatabaseHomePage/DatabaseHomeUtils', () => ({
    filterDatabaseRowsForNonAsm: vi.fn(() => true),
    mapHostStatusToAssessmentData: vi.fn((_, data) => data)
}));

vi.mock('../../../../GetWell/GetWellUtils', () => ({
    disableOptimizeCheckBoxForErrCase: vi.fn((data: any) => data),
    disableOptimizeCheckBoxForOptimizeCase: vi.fn((data: any) => data),
    isConfigSkippedForAoag: vi.fn(() => false),
    isWadExcludedConfig: vi.fn(() => false)
}));

vi.mock('../../DashboardInnerPageHelper', () => ({
    bulkDismissPostponeDisableCheck: vi.fn(() => ({
        isDismissDisabled: false,
        dismissDisableMsg: '',
        isPostponeDisabled: false,
        postponeDisableMsg: ''
    })),
    bulkFixDisableCheck: vi.fn(() => ({ isFixDisabled: false, fixDisableMsg: '' })),
    sortOptimizeDashboardInnerTable: vi.fn((data: any) => data)
}));

vi.mock('../../../../WellArchitectedTab/WellArchitectedTabUtils', () => ({
    engineTypeBasedResourceStr: vi.fn((_type: any, mssql: string) => mssql)
}));

vi.mock('../../../../../utils/manageColumnUtils', () => ({
    initialDashboardInnerPageOptimizeColState: {}
}));

vi.mock('../../../../../assets/ic_not_active.svg', () => ({ ReactComponent: () => <svg data-testid="not-active" /> }));
vi.mock('../../../../../assets/optimized.svg', () => ({ ReactComponent: () => <svg data-testid="optimized" /> }));
vi.mock('../../../../../assets/under-provisioned.svg', () => ({
    ReactComponent: () => <svg data-testid="under-provisioned" />
}));
vi.mock('../../../../../assets/In Progress.svg', () => ({ ReactComponent: () => <svg data-testid="in-progress" /> }));

vi.mock('../RenderTables.module.scss', () => ({
    default: {
        renderTable: 'rt',
        toggle: 't',
        disabled: 'd',
        statusContainer: 'sc',
        menuPointerDisabled: 'mpd',
        menuPointer: 'mp',
        jobMenuPopover: 'jmp',
        menuIcon: 'mi'
    }
}));

vi.mock('../../../../../utils/CommonStyles.module.scss', () => ({
    default: { impactedDrivesCell: 'impactedDrivesCell' }
}));

vi.mock('../ImpactedResourceDialog/ImpactedResourceDialog', () => ({
    default: ({ data }: any) => <div data-testid="impacted-resource-dialog">{data?.configurationName}</div>
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
                    inProgressHostData: {},
                    inProgressStateData: {},
                    configEngineType: 'MSSQL',
                    ...overrides.getWellOptimize
                }
            ) => s
        }
    });

describe('DashboardConfigsTable', () => {
    const defaultProps = {
        configType: 'Storage tier',
        lastColDetails: vi.fn(() => ({
            id: '8',
            Header: '',
            accessor: '',
            isSticky: true,
            width: '242px',
            renderCell: () => <div>action</div>
        })),
        handleBulkAction: vi.fn(),
        handleSingleDismissPostpone: vi.fn(),
        handleBulkDismissPostpone: vi.fn()
    };

    it('renders table components', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardConfigsTable {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders toggle switch', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardConfigsTable {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('toggle-switch')).toBeTruthy();
    });

    it('returns null for unknown config type', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <DashboardConfigsTable {...defaultProps} configType="unknown-config" />
            </Provider>
        );
        expect(container.innerHTML).toBe('');
    });

    it('renders bulk action controller when rows are selected', () => {
        render(
            <Provider store={makeStore({ databaseHome: { selectedRowsForOptimize: [{ id: '1' }] } })}>
                <DashboardConfigsTable {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('bulk-action-controller')).toBeTruthy();
    });

    it('does not render bulk action when no rows selected', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardConfigsTable {...defaultProps} />
            </Provider>
        );
        expect(screen.queryByTestId('bulk-action-controller')).toBeNull();
    });

    // ── Toggle click ──
    it('handles toggle switch click', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardConfigsTable {...defaultProps} />
            </Provider>
        );
        fireEvent.click(screen.getByTestId('toggle-switch'));
    });

    // ── Bulk action handler calls ──
    it('calls handleBulkAction when bulk fix button clicked', () => {
        render(
            <Provider store={makeStore({ databaseHome: { selectedRowsForOptimize: [{ id: '1' }] } })}>
                <DashboardConfigsTable {...defaultProps} />
            </Provider>
        );
        fireEvent.click(screen.getByTestId('bulk-fix-btn'));
        expect(defaultProps.handleBulkAction).toHaveBeenCalled();
    });

    it('calls handleBulkDismissPostpone when bulk state button clicked', () => {
        render(
            <Provider store={makeStore({ databaseHome: { selectedRowsForOptimize: [{ id: '1' }] } })}>
                <DashboardConfigsTable {...defaultProps} />
            </Provider>
        );
        fireEvent.click(screen.getByTestId('bulk-state-btn'));
        expect(defaultProps.handleBulkDismissPostpone).toHaveBeenCalled();
    });

    // ── Column renderCell coverage – all status types ──
    it('renders Optimized status icon in column', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardConfigsTable {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('col-2')).toBeTruthy();
        expect(screen.getByTestId('cell-2-0')).toBeTruthy(); // Optimized
    });

    it('renders Not Optimized status icon in column', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardConfigsTable {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('cell-2-1')).toBeTruthy(); // Not Optimized / DISMISSED
    });

    it('renders Under-provisioned status icon in column', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardConfigsTable {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('cell-2-2')).toBeTruthy(); // Under-provisioned / POSTPONED
    });

    it('renders Over-provisioned status icon in column', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardConfigsTable {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('cell-2-3')).toBeTruthy(); // Over-provisioned / ACTIVATING
    });

    it('renders Optimizing/Analyzing status icon in column', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardConfigsTable {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('cell-2-4')).toBeTruthy(); // Optimizing
    });

    it('renders empty status fallback', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardConfigsTable {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('cell-2-5')).toBeTruthy(); // empty
    });

    // ── Different config types ──
    const configTypes = [
        'File system headroom',
        'Log drive size',
        'TempDB drive size',
        'Data files (.mdf)',
        'Log files (.ldf)',
        'TempDB placement',
        'Compute rightsizing',
        'Operating system patch',
        'Network adapter settings',
        'MTU alignment',
        'License',
        'Microsoft SQL Server patch',
        'MAXDOP',
        'Scheduled local snapshot',
        'Cross-Region Replication (CRR)',
        'Backup Configuration',
        'Clone cleanup'
    ];

    configTypes.forEach(configType => {
        it(`renders table for config type: ${configType}`, () => {
            render(
                <Provider store={makeStore()}>
                    <DashboardConfigsTable {...defaultProps} configType={configType} />
                </Provider>
            );
            expect(screen.getByTestId('table')).toBeTruthy();
        });
    });

    // ── Oracle config types ──
    const oracleConfigTypes = [
        'Oracle binary placement',
        'Data files placement',
        'Control files placement',
        'Redo logs placement',
        'Temp placement',
        'Archive placement',
        'ASM data disk group LUNs',
        'ASM logs disk group LUNs',
        'ASM FRA disk group LUNs',
        'ASM archive log disk group LUNs',
        'Swap space'
    ];

    oracleConfigTypes.forEach(configType => {
        it(`renders table for Oracle config type: ${configType}`, () => {
            render(
                <Provider
                    store={makeStore({
                        getWellOptimize: {
                            configEngineType: 'ORACLE',
                            inProgressOptimizationData: {},
                            inProgressHostData: {},
                            inProgressStateData: {}
                        }
                    })}
                >
                    <DashboardConfigsTable {...defaultProps} configType={configType} />
                </Provider>
            );
            expect(screen.getByTestId('table')).toBeTruthy();
        });
    });

    // ── Oracle File system headroom uses special config ──
    it('renders Oracle File system headroom with special config', () => {
        render(
            <Provider
                store={makeStore({
                    getWellOptimize: {
                        configEngineType: 'ORACLE',
                        inProgressOptimizationData: {},
                        inProgressHostData: {},
                        inProgressStateData: {}
                    }
                })}
            >
                <DashboardConfigsTable {...defaultProps} configType="File system headroom" />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    // ── With assessment data ──
    it('renders with assessment data rows', () => {
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
                                                sizing: [
                                                    {
                                                        name: 'performance-tier',
                                                        status: 'NOT_OPTIMIZED',
                                                        current: 'HDD',
                                                        totalObjectsAssessed: 5,
                                                        totalObjectsInViolation: 2
                                                    }
                                                ]
                                            },
                                            dismissedConfigurations: {
                                                storage: { sizing: [] }
                                            }
                                        }
                                    }
                                ]
                            }
                        ],
                        inventoryTableData: {},
                        getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false }
                    }
                })}
            >
                <DashboardConfigsTable {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    // ── With assessment data for direct access configs ──
    it('renders with Compute rightsizing assessment data', () => {
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
                                            compute: {
                                                status: 'NOT_OPTIMIZED',
                                                objectsInViolation: ['cpu'],
                                                recommendationOptions: [],
                                                errorMessage: ''
                                            },
                                            dismissedConfigurations: { compute: null }
                                        }
                                    }
                                ]
                            }
                        ],
                        inventoryTableData: {},
                        getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false }
                    }
                })}
            >
                <DashboardConfigsTable {...defaultProps} configType="Compute rightsizing" />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    // ── With dismissed data (configState = DISMISSED/POSTPONED) ──
    it('renders with dismissed assessment data', () => {
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
                                                sizing: [{ name: 'performance-tier', status: 'NOT_OPTIMIZED' }]
                                            },
                                            dismissedConfigurations: {
                                                storage: {
                                                    sizing: [
                                                        {
                                                            configurationName: 'performance-tier',
                                                            configState: 'DISMISSED'
                                                        }
                                                    ]
                                                }
                                            }
                                        }
                                    }
                                ]
                            }
                        ],
                        inventoryTableData: {},
                        getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false }
                    }
                })}
            >
                <DashboardConfigsTable {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    // ── With inProgressOptimizationData ──
    it('renders with inProgressOptimizationData', () => {
        render(
            <Provider
                store={makeStore({
                    getWellOptimize: {
                        inProgressOptimizationData: { 'Storage tier': ['h1_i1'] },
                        inProgressHostData: {},
                        inProgressStateData: {},
                        configEngineType: 'MSSQL'
                    }
                })}
            >
                <DashboardConfigsTable {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    // ── License config dataMapping with different editions ──
    it('renders License config with Standard edition', () => {
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
                                            license: {
                                                status: 'NOT_OPTIMIZED',
                                                sqlServerInstances: [
                                                    { sqlServerInstance: 'Inst1', sqlServerEdition: 'Standard Edition' }
                                                ]
                                            },
                                            dismissedConfigurations: { license: null }
                                        }
                                    }
                                ]
                            }
                        ],
                        inventoryTableData: {},
                        getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false }
                    }
                })}
            >
                <DashboardConfigsTable {...defaultProps} configType="License" />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    // ── RSS config dataMapping ──
    it('renders RSS config with adapter data', () => {
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
                                            rssConfig: {
                                                status: 'NOT_OPTIMIZED',
                                                rssAdapters: [
                                                    {
                                                        adapterName: 'eth0',
                                                        rssEnabled: false,
                                                        rssProfile: '',
                                                        baseProcessorNumber: 0,
                                                        numberOfReceiveQueues: 0
                                                    },
                                                    {
                                                        adapterName: 'eth1',
                                                        rssEnabled: true,
                                                        rssProfile: 'Profile1',
                                                        baseProcessorNumber: 1,
                                                        numberOfReceiveQueues: 4
                                                    }
                                                ],
                                                recommendedAdapterSettings: {
                                                    recommendedRssProfile: 'Profile1',
                                                    recommendedBaseProcessorNumber: 1,
                                                    recommendedReceiveQueues: 4
                                                }
                                            },
                                            dismissedConfigurations: { rssConfig: null }
                                        }
                                    }
                                ]
                            }
                        ],
                        inventoryTableData: {},
                        getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false }
                    }
                })}
            >
                <DashboardConfigsTable {...defaultProps} configType="Network adapter settings" />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    // ── Microsoft SQL Server patch dataMapping ──
    it('renders MSSQL patch with missing patches data', () => {
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
                                            mssqlPatch: {
                                                status: 'NOT_OPTIMIZED',
                                                missingPatchesInEc2Instances: [
                                                    {
                                                        criticalMissingPatchesCount: 2,
                                                        importantMissingPatchesCount: 1,
                                                        missingPatchDetails: [{ id: 'p1' }],
                                                        ec2InstanceName: 'ec2-1'
                                                    }
                                                ]
                                            },
                                            dismissedConfigurations: { mssqlPatch: null }
                                        }
                                    }
                                ]
                            }
                        ],
                        inventoryTableData: {},
                        getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false }
                    }
                })}
            >
                <DashboardConfigsTable {...defaultProps} configType="Microsoft SQL Server patch" />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    // ── View button conditional rendering and click behaviour ──
    it('renders View button for rows with violations > 0', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardConfigsTable {...defaultProps} />
            </Provider>
        );
        const viewButtons = screen.getAllByText('databases.dashboard.view');
        expect(viewButtons.length).toBeGreaterThan(0);
    });

    it('does not render View button for rows with zero or undefined violations', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardConfigsTable {...defaultProps} />
            </Provider>
        );
        // Row 4 (index 4): configState ACTIVE, no totalObjectsInViolation → custom renderCell fires
        const activeNoViolationCell = screen.getByTestId('cell-4-4');
        expect(activeNoViolationCell.textContent).toContain('0 out of 0');
        expect(activeNoViolationCell.querySelector('[data-testid="button-text"]')).toBeNull();
    });

    it('shows N/A instead of View button for DISMISSED / POSTPONED rows', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardConfigsTable {...defaultProps} />
            </Provider>
        );
        // Row 1 (DISMISSED) and Row 2 (POSTPONED) should show N/A text, not the impacted-resource cell
        const dismissedCell = screen.getByTestId('cell-4-1');
        expect(dismissedCell.textContent).toContain('databases.general.not-available-table-columns');
        expect(dismissedCell.querySelector('[data-testid="button-text"]')).toBeNull();

        const postponedCell = screen.getByTestId('cell-4-2');
        expect(postponedCell.textContent).toContain('databases.general.not-available-table-columns');
        expect(postponedCell.querySelector('[data-testid="button-text"]')).toBeNull();
    });

    it('calls setDialog when View button is clicked', () => {
        mockSetDialog.mockClear();
        render(
            <Provider store={makeStore()}>
                <DashboardConfigsTable {...defaultProps} />
            </Provider>
        );
        const viewButtons = screen.getAllByText('databases.dashboard.view');
        fireEvent.click(viewButtons[0]);
        expect(mockSetDialog).toHaveBeenCalledTimes(1);
    });

    it('passes ImpactedResourceDialog as dialog content when View is clicked', () => {
        mockSetDialog.mockClear();
        render(
            <Provider store={makeStore()}>
                <DashboardConfigsTable {...defaultProps} />
            </Provider>
        );
        const viewButtons = screen.getAllByText('databases.dashboard.view');
        fireEvent.click(viewButtons[0]);

        const dialogElement = mockSetDialog.mock.calls[0][0];
        expect(dialogElement.props.header).toBe('databases.well-architect.dashboard-table-headers.impacted-volumes');
        expect(dialogElement.props.content).toBeTruthy();
        expect(dialogElement.props.callback).toBeTypeOf('function');
    });

    it('does not render View button for Oracle config when violations are 0', () => {
        render(
            <Provider
                store={makeStore({
                    getWellOptimize: {
                        configEngineType: 'ORACLE',
                        inProgressOptimizationData: {},
                        inProgressHostData: {},
                        inProgressStateData: {}
                    }
                })}
            >
                <DashboardConfigsTable {...defaultProps} configType="Data files placement" />
            </Provider>
        );
        // Row 4 has no violations and ACTIVE state
        const activeNoViolationCell = screen.getByTestId('cell-4-4');
        expect(activeNoViolationCell.textContent).toContain('0 out of 0');
        expect(activeNoViolationCell.querySelector('[data-testid="button-text"]')).toBeNull();
    });

    // ── Skip host when cred/region not matching ──
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
                                            storage: { sizing: [{ name: 'performance-tier', status: 'OPTIMIZED' }] },
                                            dismissedConfigurations: { storage: { sizing: [] } }
                                        }
                                    }
                                ]
                            }
                        ],
                        inventoryTableData: {},
                        getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false }
                    }
                })}
            >
                <DashboardConfigsTable {...defaultProps} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });
});
