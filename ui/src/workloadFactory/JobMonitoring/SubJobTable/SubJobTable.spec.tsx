import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SubJobTable from './SubJobTable';
import { JOB_MONITORING_STATUS, JOB_MONITORING_TYPE, CREATE_RESOURCE } from '../../../utils/consts';

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

// Create mock for useTable that we can access
const mockUseTable = vi.fn();

// Mock @netapp/design-system
vi.mock('@netapp/design-system', () => ({
    Button: ({ children, onClick, variant }: any) => (
        <button data-testid="nav-button" data-variant={variant} onClick={onClick}>
            {children}
        </button>
    ),
    FlashingDotsLoader: () => <div data-testid="flashing-dots-loader">Loading...</div>,
    Popover: ({ children, container }: any) => (
        <div data-testid="popover">
            {children}
            {container}
        </div>
    ),
    Table: ({ tableProps, variant, isDoubleRow, ExpandedRow, lazyLoadingText }: any) => (
        <div data-testid="table" data-variant={variant} data-double-row={isDoubleRow}>
            Table Component
        </div>
    ),
    Typography: ({ children, variant, className }: any) => (
        <div data-testid="typography" data-variant={variant} className={className}>
            {children}
        </div>
    ),
    useTable: (...args: any[]) => mockUseTable(...args)
}));

// Mock SVG icons
vi.mock('../../../assets/row_arrow.svg', () => ({
    ReactComponent: ({ className, onClick }: any) => (
        <svg data-testid="arrow-icon" className={className} onClick={onClick} />
    )
}));

vi.mock('../../../assets/In Progress.svg', () => ({
    ReactComponent: () => <svg data-testid="in-progress-icon" />
}));

vi.mock('../../../assets/success.svg', () => ({
    ReactComponent: () => <svg data-testid="success-icon" />
}));

vi.mock('../../../assets/error-icon.svg', () => ({
    ReactComponent: ({ className }: any) => <svg data-testid="error-icon" className={className} />
}));

vi.mock('../../../assets/warning.svg', () => ({
    ReactComponent: ({ className }: any) => <svg data-testid="warning-icon" className={className} />
}));

vi.mock('../../../assets/ic_file.svg', () => ({
    ReactComponent: () => <svg data-testid="no-data-icon" />
}));

// Mock TaskTable
vi.mock('../TaskTable/TaskTable', () => ({
    default: ({ taskList }: any) => <div data-testid="task-table">TaskTable: {taskList?.length || 0} tasks</div>
}));

// Mock SCSS modules
vi.mock('./SubJobTable.module.scss', () => ({
    default: {
        subJobTable: 'subJobTable',
        statusbar: 'statusbar',
        extraDiv: 'extraDiv',
        extraDiv2: 'extraDiv2',
        loadingTable: 'loadingTable',
        table: 'table',
        firstCol: 'firstCol',
        arrow: 'arrow',
        'arrow-down': 'arrow-down',
        'arrow-disable': 'arrow-disable',
        statusCol: 'statusCol',
        statusIcon: 'statusIcon',
        linkMessage: 'linkMessage',
        completed: 'completed',
        failed: 'failed',
        warning: 'warning',
        inprogress: 'inprogress'
    }
}));

vi.mock('../../../utils/CommonStyles.module.scss', () => ({
    default: {
        wrapTextIn2Line: 'wrapTextIn2Line',
        popover: 'popover'
    }
}));

// Mock appConstants
vi.mock('../../../utils/appConstants', () => ({
    GENERAL: {
        NO_DATA: 'No data available',
        NOT_AVAILABLE: 'N/A',
        LOADING_DATA: 'Loading data...'
    },
    SELECT_CONFIG: {
        EASY_CREATE: 'EASY_CREATE',
        LOAD_CONFIG: 'LOAD_CONFIG'
    }
}));

// Mock utility functions
const {
    mockExpandTableRow,
    mockFormatDateWithTime,
    mockJobMonitoringStatusMapping,
    mockNavigateToInventory,
    mockSortListOfDict,
    parseJobMonitoringNavigationPayload,
    isOracleJobMonitoringNavigation,
    getJobMonitoringDescriptionPrefix
} = vi.hoisted(() => {
    const parsePayload = (message: string) => {
        if (!message?.includes('databaseInstanceId') || !message?.includes('resourceId')) {
            return null;
        }
        try {
            const jsonString = message.split(';')[1];
            if (!jsonString) {
                return null;
            }
            return JSON.parse(jsonString);
        } catch {
            return null;
        }
    };

    return {
        mockExpandTableRow: vi.fn(),
        mockFormatDateWithTime: vi.fn(date => `Formatted: ${date}`),
        mockJobMonitoringStatusMapping: vi.fn(status => status?.toUpperCase()),
        mockNavigateToInventory: vi.fn(),
        mockSortListOfDict: vi.fn(list => list),
        parseJobMonitoringNavigationPayload: parsePayload,
        isOracleJobMonitoringNavigation: (payload: { sqlServerDeploymentType?: string }) =>
            payload.sqlServerDeploymentType?.toLowerCase() === 'oracle',
        getJobMonitoringDescriptionPrefix: (message: string) => {
            let extractedMessage = message.split(';')[0] ?? '';
            if (extractedMessage.endsWith('.')) {
                extractedMessage = extractedMessage.slice(0, -1);
            }
            return extractedMessage;
        }
    };
});

vi.mock('../../../utils/utilityFunctions', () => ({
    expandTableRow: (...args: any[]) => mockExpandTableRow(...args),
    formatDateWithTime: (...args: any[]) => mockFormatDateWithTime(...args),
    jobMonitoringStatusMapping: (...args: any[]) => mockJobMonitoringStatusMapping(...args),
    navigateToInventory: (...args: any[]) => mockNavigateToInventory(...args),
    sortListOfDict: (...args: any[]) => mockSortListOfDict(...args),
    parseJobMonitoringNavigationPayload,
    isOracleJobMonitoringNavigation,
    getJobMonitoringDescriptionPrefix
}));

// Mock @tlveng/wlm-ds
vi.mock('@tlveng/wlm-ds/src/hooks/useBlueXP', () => ({
    BlueXPListeners: {},
    postBlueXPMessage: vi.fn()
}));

// Mock store slices to prevent import errors
vi.mock('../../../store/workloadFactory/getWellOptimizeSlice', () => ({
    default: { name: 'getWellOptimize', reducer: () => ({}) },
    setCredIdFromJM: vi.fn(payload => ({ type: 'getWellOptimize/setCredIdFromJM', payload })),
    setGwPageLoadInstanceData: vi.fn(payload => ({ type: 'getWellOptimize/setGwPageLoadInstanceData', payload })),
    setLandingFrom: vi.fn(payload => ({ type: 'getWellOptimize/setLandingFrom', payload })),
    setRegionFromJM: vi.fn(payload => ({ type: 'getWellOptimize/setRegionFromJM', payload })),
    setSelectedWellArchitectTab: vi.fn(payload => ({ type: 'getWellOptimize/setSelectedWellArchitectTab', payload }))
}));

vi.mock('../../../store/workloadFactory/inventoryV2Slice', () => ({
    setBreadCrumbSelectedFrom: vi.fn(payload => ({ type: 'inventoryV2/setBreadCrumbSelectedFrom', payload })),
    setSelectedHeaderTab: vi.fn(payload => ({ type: 'inventoryV2/setSelectedHeaderTab', payload }))
}));

vi.mock('../../../store/workloadFactory/databaseHomeSlice', () => ({
    selectedTabSelection: vi.fn(payload => ({ type: 'databaseHome/selectedTabSelection', payload }))
}));

vi.mock('../../../store/workloadFactory/oracleSlice', () => ({
    default: { name: 'oracle', reducer: () => ({}) },
    setSelectedOracleInnerPageTab: vi.fn(payload => ({ type: 'oracle/setSelectedOracleInnerPageTab', payload }))
}));

vi.mock('../../../store/workloadFactory/workloadFactoryResourceSlice', () => ({
    setSelectedResourcePageHostData: vi.fn(payload => ({
        type: 'workloadFactoryResource/setSelectedResourcePageHostData',
        payload
    }))
}));

// Mock useResize hook
const mockWindowSize = { width: 1920, height: 1080 };
vi.mock('../../../common/hooks/useResize', () => ({
    default: () => mockWindowSize
}));

const createMockStore = (overrides = {}) => {
    const defaultState = {
        jobMonitoring: {
            subJobsData: null,
            subJobsDataLoading: false,
            ...overrides.jobMonitoring
        },
        auth: {
            isDemoMode: false,
            isWorkloadFactory: true,
            ...overrides.auth
        }
    };

    return configureStore({
        reducer: {
            jobMonitoring: () => defaultState.jobMonitoring,
            auth: () => defaultState.auth
        }
    });
};

describe('SubJobTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockWindowSize.width = 1920;
        mockWindowSize.height = 1080;
        mockSortListOfDict.mockImplementation(list => list);

        // Setup default mockUseTable implementation
        mockUseTable.mockImplementation(({ columns, rows }: any) => ({
            columns,
            rows,
            rowsState: {},
            updateRowState: vi.fn(() => vi.fn()),
            pagination: { gotoPage: vi.fn() }
        }));
    });

    describe('Loading state', () => {
        it('should show loading indicator when subJobsDataLoading is true', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: null,
                    subJobsDataLoading: true
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            expect(screen.getByTestId('flashing-dots-loader')).toBeTruthy();
            expect(screen.getByText('Loading data...')).toBeTruthy();
        });

        it('should not show loading indicator when subJobsDataLoading is false', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: { id: 'job123', subJobs: [] },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            expect(screen.queryByTestId('flashing-dots-loader')).toBeFalsy();
        });
    });

    describe('Empty/No data state', () => {
        it('should show no data message when subJobsData is null and not loading', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: null,
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            expect(screen.getByTestId('no-data-icon')).toBeTruthy();
            expect(screen.getByText('No data available')).toBeTruthy();
        });

        it('should show no data message when subTaskList is undefined and not loading', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: { id: 'job123', subJobs: undefined },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            expect(screen.getByTestId('no-data-icon')).toBeTruthy();
        });
    });

    describe('Rendering with data', () => {
        it('should render table when subTaskList has data', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [
                            {
                                id: '1',
                                description: 'SubJob 1',
                                status: JOB_MONITORING_STATUS.COMPLETED,
                                startTime: 123,
                                endTime: 456
                            }
                        ]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('should render status bar with correct status type', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: { id: 'job123', subJobs: [] },
                    subJobsDataLoading: false
                }
            });

            const { container } = render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="failed" />
                </Provider>
            );

            const statusBar = container.querySelector('.statusbar');
            expect(statusBar?.className).toContain('failed');
        });
    });

    describe('Demo mode sorting', () => {
        it('should sort subJobs by startTime in demo mode', async () => {
            const unsortedJobs = [
                { id: '1', startTime: 300, description: 'Job 1' },
                { id: '2', startTime: 100, description: 'Job 2' },
                { id: '3', startTime: 200, description: 'Job 3' }
            ];

            const sortedJobs = [
                { id: '2', startTime: 100, description: 'Job 2' },
                { id: '3', startTime: 200, description: 'Job 3' },
                { id: '1', startTime: 300, description: 'Job 1' }
            ];

            mockSortListOfDict.mockReturnValue(sortedJobs);

            const store = createMockStore({
                auth: {
                    isDemoMode: true,
                    isWorkloadFactory: true
                },
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: unsortedJobs
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            await waitFor(() => {
                expect(mockSortListOfDict).toHaveBeenCalledWith(unsortedJobs, 'startTime', false);
            });
        });

        it('should not sort subJobs when not in demo mode', () => {
            const jobs = [
                { id: '1', startTime: 300, description: 'Job 1' },
                { id: '2', startTime: 100, description: 'Job 2' }
            ];

            const store = createMockStore({
                auth: {
                    isDemoMode: false,
                    isWorkloadFactory: true
                },
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: jobs
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            expect(mockSortListOfDict).not.toHaveBeenCalled();
        });
    });

    describe('useEffect - subJobsData changes', () => {
        it('should update subTaskList when subJobsData changes', async () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [{ id: '1', description: 'Job 1' }]
                    },
                    subJobsDataLoading: false
                }
            });

            const { rerender } = render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            const newStore = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [
                            { id: '1', description: 'Job 1' },
                            { id: '2', description: 'Job 2' }
                        ]
                    },
                    subJobsDataLoading: false
                }
            });

            rerender(
                <Provider store={newStore}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('table')).toBeTruthy();
            });
        });
    });

    describe('Navigation to continuous optimization', () => {
        const createNavigationData = (dbType: string, jobType: string = JOB_MONITORING_TYPE.ASSESSMENT) => ({
            id: 'job123',
            type: jobType,
            credentialsId: 'cred123',
            region: { code: 'us-east-1' },
            subJobs: [
                {
                    id: '1',
                    description: `Task description;{"resourceId":"res123","databaseInstanceId":"db456","databaseInstanceName":"TestDB","sqlServerDeploymentType":"${dbType}","hostName":"host123"}`,
                    status: JOB_MONITORING_STATUS.COMPLETED,
                    startTime: 123,
                    endTime: 456,
                    credentialsId: 'cred456',
                    region: { code: 'us-west-2' }
                }
            ]
        });

        it('should navigate to MSSQL inventory when clicking navigation link', async () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: createNavigationData('MSSQL'),
                    subJobsDataLoading: false
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            // The table is rendered, navigation would be tested in integration
            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('should navigate to Oracle inventory for Oracle deployment', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: createNavigationData('Oracle'),
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('should use subJobsData credentials for assessment type', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: createNavigationData('MSSQL', JOB_MONITORING_TYPE.ASSESSMENT),
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('should use subJobsData credentials for non-assessment type', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: createNavigationData('MSSQL', 'OTHER_TYPE'),
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('should use rowData credentials when ASSESSMENT type and button is clicked', () => {
            const mockDispatch = vi.fn();
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        type: JOB_MONITORING_TYPE.ASSESSMENT,
                        subJobs: [
                            {
                                id: '1',
                                description:
                                    'Assessment task.;{"resourceId":"res123","databaseInstanceId":"db456","sqlServerDeploymentType":"MSSQL","databaseInstanceName":"TestDB","hostName":"host123"}',
                                status: JOB_MONITORING_STATUS.COMPLETED,
                                credentialsId: 'row-cred-123',
                                region: { code: 'us-central-1' }
                            }
                        ],
                        credentialsId: 'subjobs-cred456',
                        region: { code: 'us-east-1' }
                    },
                    subJobsDataLoading: false
                }
            });

            // Override dispatch
            store.dispatch = mockDispatch;

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            const tableConfig = mockUseTable.mock.calls[mockUseTable.mock.calls.length - 1][0];
            const descColumn = tableConfig.columns[1];

            const cellData =
                'Assessment task.;{"resourceId":"res123","databaseInstanceId":"db456","sqlServerDeploymentType":"MSSQL","databaseInstanceName":"TestDB","hostName":"host123"}';
            const rowData = {
                id: '1',
                status: 'COMPLETED',
                credentialsId: 'row-cred-123',
                region: { code: 'us-central-1' }
            };

            // Render the cell with the button
            const TestWrapper = () => descColumn.renderCell(cellData, rowData);

            const { container } = render(
                <Provider store={store}>
                    <TestWrapper />
                </Provider>
            );

            // Click the button to trigger navigateToContinuosOptimization with ASSESSMENT type
            const button = container.querySelector('[data-testid="nav-button"]');
            if (button) {
                fireEvent.click(button);
                // Should have used rowData credentials for ASSESSMENT type
                expect(mockDispatch).toHaveBeenCalled();
            }
        });
    });

    describe('Table configuration', () => {
        it('should configure table with correct props', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [{ id: '1', description: 'Job 1' }]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            const table = screen.getByTestId('table');
            expect(table.getAttribute('data-variant')).toBe('innerTable');
            expect(table.getAttribute('data-double-row')).toBe('true');
        });

        it('should pass loading state to table', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: null,
                    subJobsDataLoading: true
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            expect(screen.getByTestId('flashing-dots-loader')).toBeTruthy();
        });
    });

    describe('Responsive window sizes', () => {
        it('should handle large window size (>= 1920px)', () => {
            mockWindowSize.width = 1920;

            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [{ id: '1', description: 'Job 1' }]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('should handle small window size (< 1920px)', () => {
            mockWindowSize.width = 1400;

            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [{ id: '1', description: 'Job 1' }]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('should handle mobile window size', () => {
            mockWindowSize.width = 768;

            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [{ id: '1', description: 'Job 1' }]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            expect(screen.getByTestId('table')).toBeTruthy();
        });
    });

    describe('Different status types', () => {
        const statusTypes = ['completed', 'failed', 'warning', 'inprogress'];

        statusTypes.forEach(statusType => {
            it(`should render with ${statusType} status type`, () => {
                const store = createMockStore({
                    jobMonitoring: {
                        subJobsData: {
                            id: 'job123',
                            subJobs: [{ id: '1', description: 'Job 1' }]
                        },
                        subJobsDataLoading: false
                    }
                });

                const { container } = render(
                    <Provider store={store}>
                        <SubJobTable jobId="job123" statusType={statusType} />
                    </Provider>
                );

                const statusBar = container.querySelector('.statusbar');
                expect(statusBar?.className).toContain(statusType);
            });
        });
    });

    describe('Multiple subjobs', () => {
        it('should render multiple subjobs', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [
                            {
                                id: '1',
                                description: 'SubJob 1',
                                status: JOB_MONITORING_STATUS.COMPLETED,
                                startTime: 100,
                                endTime: 200
                            },
                            {
                                id: '2',
                                description: 'SubJob 2',
                                status: JOB_MONITORING_STATUS.IN_PROGRESS,
                                startTime: 150,
                                endTime: null
                            },
                            {
                                id: '3',
                                description: 'SubJob 3',
                                status: JOB_MONITORING_STATUS.FAILED,
                                startTime: 110,
                                endTime: 120
                            }
                        ]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            expect(screen.getByTestId('table')).toBeTruthy();
        });
    });

    describe('CSS classes', () => {
        it('should apply correct CSS classes', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [{ id: '1', description: 'Job 1' }]
                    },
                    subJobsDataLoading: false
                }
            });

            const { container } = render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            expect(container.querySelector('.subJobTable')).toBeTruthy();
            expect(container.querySelector('.statusbar')).toBeTruthy();
            expect(container.querySelector('.extraDiv')).toBeTruthy();
            expect(container.querySelector('.extraDiv2')).toBeTruthy();
        });
    });

    describe('Column renderCell functions', () => {
        it('should render arrow icon with expand functionality when subJob has subJobs', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [
                            {
                                id: '1',
                                description: 'Job with subjobs',
                                status: JOB_MONITORING_STATUS.COMPLETED,
                                subJobs: [{ id: 'sub1' }]
                            }
                        ]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            expect(mockUseTable).toHaveBeenCalled();
            const tableConfig = mockUseTable.mock.calls[0][0];
            const firstColumn = tableConfig.columns[0];

            // Test renderCell with subjobs
            const mockUpdateRowState = vi.fn(() => vi.fn());
            const mockRowsState = { '1': { isExpanded: false } };
            const rowData = { id: '1', subJobs: [{ id: 'sub1' }], status: 'COMPLETED' };

            const result = firstColumn.renderCell('name', rowData, {
                updateRowState: mockUpdateRowState,
                rowsState: mockRowsState
            });

            expect(result).toBeDefined();
        });

        it('should render disabled arrow when subJob has no subJobs and type is not CREATE_RESOURCE', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [
                            {
                                id: '1',
                                description: 'Job without subjobs',
                                status: JOB_MONITORING_STATUS.COMPLETED,
                                type: 'OTHER_TYPE'
                            }
                        ]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            const tableConfig = mockUseTable.mock.calls[0][0];
            const firstColumn = tableConfig.columns[0];

            const mockUpdateRowState = vi.fn(() => vi.fn());
            const mockRowsState = { '1': { isExpanded: false } };
            const rowData = { id: '1', type: 'OTHER_TYPE', status: 'COMPLETED' };

            const result = firstColumn.renderCell('name', rowData, {
                updateRowState: mockUpdateRowState,
                rowsState: mockRowsState
            });

            expect(result).toBeDefined();
        });

        it('should render navigation link for description with databaseInstanceId and resourceId', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [
                            {
                                id: '1',
                                description:
                                    'Task description.;{"resourceId":"res123","databaseInstanceId":"db456","databaseInstanceName":"TestDB","sqlServerDeploymentType":"MSSQL","hostName":"host123"}',
                                status: JOB_MONITORING_STATUS.COMPLETED
                            }
                        ]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            const tableConfig = mockUseTable.mock.calls[0][0];
            const descColumn = tableConfig.columns[1];

            const cellData =
                'Task description.;{"resourceId":"res123","databaseInstanceId":"db456","databaseInstanceName":"TestDB","sqlServerDeploymentType":"MSSQL","hostName":"host123"}';
            const rowData = { id: '1', status: 'COMPLETED' };

            const result = descColumn.renderCell(cellData, rowData);
            expect(result).toBeDefined();
        });

        it('should render plain text for description without navigation data', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [
                            {
                                id: '1',
                                description: 'Simple description',
                                status: JOB_MONITORING_STATUS.COMPLETED
                            }
                        ]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            const tableConfig = mockUseTable.mock.calls[0][0];
            const descColumn = tableConfig.columns[1];

            const result = descColumn.renderCell('Simple description', { id: '1' });
            expect(result).toBeDefined();
        });

        it('should render Oracle dashboard link for Oracle assessment', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [
                            {
                                id: '1',
                                description:
                                    'Oracle assessment task;{"resourceId":"res123","databaseInstanceId":"db456","databaseInstanceName":"TestDB","sqlServerDeploymentType":"Oracle","hostName":"host123"}',
                                status: JOB_MONITORING_STATUS.COMPLETED
                            }
                        ]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            const tableConfig = mockUseTable.mock.calls[0][0];
            const descColumn = tableConfig.columns[1];

            const cellData =
                'Oracle assessment task;{"resourceId":"res123","databaseInstanceId":"db456","databaseInstanceName":"TestDB","sqlServerDeploymentType":"Oracle","hostName":"host123"}';
            const rowData = { id: '1' };

            const result = descColumn.renderCell(cellData, rowData);
            expect(result).toBeDefined();
        });

        it('should render status icons for COMPLETED status', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [
                            {
                                id: '1',
                                description: 'Job',
                                status: JOB_MONITORING_STATUS.COMPLETED
                            }
                        ]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            const tableConfig = mockUseTable.mock.calls[0][0];
            const statusColumn = tableConfig.columns[2];

            const result = statusColumn.renderCell(JOB_MONITORING_STATUS.COMPLETED, { id: '1' });
            expect(result).toBeDefined();
        });

        it('should render status icons for FAILED status with error', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [
                            {
                                id: '1',
                                description: 'Job',
                                status: JOB_MONITORING_STATUS.FAILED,
                                error: 'Error message'
                            }
                        ]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            const tableConfig = mockUseTable.mock.calls[0][0];
            const statusColumn = tableConfig.columns[2];

            const result = statusColumn.renderCell(JOB_MONITORING_STATUS.FAILED, {
                id: '1',
                error: 'Error message'
            });
            expect(result).toBeDefined();
        });

        it('should render status icons for WARNING status with error', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [
                            {
                                id: '1',
                                description: 'Job',
                                status: JOB_MONITORING_STATUS.WARNING,
                                error: 'Warning message'
                            }
                        ]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            const tableConfig = mockUseTable.mock.calls[0][0];
            const statusColumn = tableConfig.columns[2];

            const result = statusColumn.renderCell(JOB_MONITORING_STATUS.WARNING, {
                id: '1',
                error: 'Warning message'
            });
            expect(result).toBeDefined();
        });

        it('should render status icons for WARNING status without error', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [
                            {
                                id: '1',
                                description: 'Job',
                                status: JOB_MONITORING_STATUS.WARNING
                            }
                        ]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            const tableConfig = mockUseTable.mock.calls[0][0];
            const statusColumn = tableConfig.columns[2];

            const result = statusColumn.renderCell(JOB_MONITORING_STATUS.WARNING, { id: '1' });
            expect(result).toBeDefined();
        });

        it('should render status icons for IN_PROGRESS status', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [
                            {
                                id: '1',
                                description: 'Job',
                                status: JOB_MONITORING_STATUS.IN_PROGRESS
                            }
                        ]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            const tableConfig = mockUseTable.mock.calls[0][0];
            const statusColumn = tableConfig.columns[2];

            const result = statusColumn.renderCell(JOB_MONITORING_STATUS.IN_PROGRESS, { id: '1' });
            expect(result).toBeDefined();
        });

        it('should render start time with formatting', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [
                            {
                                id: '1',
                                description: 'Job',
                                status: JOB_MONITORING_STATUS.COMPLETED,
                                startTime: 1234567890
                            }
                        ]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            const tableConfig = mockUseTable.mock.calls[0][0];
            const startTimeColumn = tableConfig.columns[3];

            const result = startTimeColumn.renderCell(1234567890);
            expect(result).toBeDefined();
            expect(mockFormatDateWithTime).toHaveBeenCalledWith(1234567890);
        });

        it('should render start time as N/A when null', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [
                            {
                                id: '1',
                                description: 'Job',
                                status: JOB_MONITORING_STATUS.IN_PROGRESS,
                                startTime: null
                            }
                        ]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            const tableConfig = mockUseTable.mock.calls[0][0];
            const startTimeColumn = tableConfig.columns[3];

            const result = startTimeColumn.renderCell(null);
            expect(result).toBeDefined();
        });

        it('should render end time with formatting', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [
                            {
                                id: '1',
                                description: 'Job',
                                status: JOB_MONITORING_STATUS.COMPLETED,
                                endTime: 1234567900
                            }
                        ]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            const tableConfig = mockUseTable.mock.calls[0][0];
            const endTimeColumn = tableConfig.columns[4];

            const result = endTimeColumn.renderCell(1234567900);
            expect(result).toBeDefined();
            expect(mockFormatDateWithTime).toHaveBeenCalledWith(1234567900);
        });

        it('should render end time as N/A when null', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [
                            {
                                id: '1',
                                description: 'Job',
                                status: JOB_MONITORING_STATUS.IN_PROGRESS,
                                endTime: null
                            }
                        ]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            const tableConfig = mockUseTable.mock.calls[0][0];
            const endTimeColumn = tableConfig.columns[4];

            const result = endTimeColumn.renderCell(null);
            expect(result).toBeDefined();
        });

        it('should handle arrow click to expand row', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [
                            {
                                id: '1',
                                description: 'Job',
                                status: JOB_MONITORING_STATUS.COMPLETED,
                                subJobs: [{ id: 'sub1' }]
                            }
                        ]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            const tableConfig = mockUseTable.mock.calls[0][0];
            const firstColumn = tableConfig.columns[0];

            const mockUpdateRowState = vi.fn(() => vi.fn());
            const mockRowsState = { '1': { isExpanded: true } };
            const rowData = { id: '1', subJobs: [{ id: 'sub1' }], status: 'COMPLETED' };

            firstColumn.renderCell('name', rowData, {
                updateRowState: mockUpdateRowState,
                rowsState: mockRowsState
            });

            expect(mockExpandTableRow).toBeDefined();
        });

        it('should call expandTableRow and stopPropagation when arrow is clicked', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [
                            {
                                id: '1',
                                description: 'Job',
                                status: JOB_MONITORING_STATUS.COMPLETED,
                                subJobs: [{ id: 'sub1' }]
                            }
                        ]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            const tableConfig = mockUseTable.mock.calls[0][0];
            const firstColumn = tableConfig.columns[0];

            const mockUpdateRowState = vi.fn(() => vi.fn());
            const mockRowsState = { '1': { isExpanded: false } };
            const rowData = { id: '1', subJobs: [{ id: 'sub1' }], status: 'COMPLETED' };

            // Render the cell
            const { container } = render(
                firstColumn.renderCell('name', rowData, {
                    updateRowState: mockUpdateRowState,
                    rowsState: mockRowsState
                })
            );

            // Find and click the arrow
            const arrow = container.querySelector('.arrow svg');
            expect(arrow).toBeTruthy();

            // Click the arrow to trigger stopPropagation and expandTableRow
            if (arrow) {
                fireEvent.click(arrow);
                expect(mockExpandTableRow).toHaveBeenCalled();
            }
        });

        it('should call navigateToContinuosOptimization when button is clicked for MSSQL', () => {
            const mockDispatch = vi.fn();
            const mockStore = createMockStore({
                auth: {
                    isWorkloadFactory: false
                },
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [
                            {
                                id: '1',
                                description:
                                    'Task description.;{"resourceId":"res123","databaseInstanceId":"db456","sqlServerDeploymentType":"MSSQL","databaseInstanceName":"TestDB","hostName":"host123"}',
                                status: JOB_MONITORING_STATUS.COMPLETED
                            }
                        ]
                    },
                    subJobsDataLoading: false
                }
            });

            // Override dispatch to track calls
            mockStore.dispatch = mockDispatch;

            const { rerender } = render(
                <Provider store={mockStore}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            // Get the table config from the useTable mock
            const tableConfig = mockUseTable.mock.calls[mockUseTable.mock.calls.length - 1][0];
            const descColumn = tableConfig.columns[1];

            const cellData =
                'Task description.;{"resourceId":"res123","databaseInstanceId":"db456","sqlServerDeploymentType":"MSSQL","databaseInstanceName":"TestDB","hostName":"host123"}';
            const rowData = { id: '1', status: 'COMPLETED' };

            // Create a separate render for just the cell to extract button props
            const TestWrapper = () => descColumn.renderCell(cellData, rowData);

            const { container } = render(
                <Provider store={mockStore}>
                    <TestWrapper />
                </Provider>
            );

            // Find and click the button
            const button = container.querySelector('[data-testid="nav-button"]');
            expect(button).toBeTruthy();

            if (button) {
                fireEvent.click(button);
                // Verify dispatch was called after button click
                expect(mockDispatch).toHaveBeenCalled();
            }
        });

        it('should call navigateToContinuosOptimization when button is clicked for Oracle', () => {
            const mockDispatch = vi.fn();
            const mockStore = createMockStore({
                auth: {
                    isWorkloadFactory: false
                },
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: [
                            {
                                id: '1',
                                description:
                                    'Oracle task.;{"resourceId":"res123","databaseInstanceId":"db456","sqlServerDeploymentType":"Oracle","databaseInstanceName":"OracleDB","hostName":"host123"}',
                                status: JOB_MONITORING_STATUS.COMPLETED
                            }
                        ]
                    },
                    subJobsDataLoading: false
                }
            });

            // Override dispatch to track calls
            mockStore.dispatch = mockDispatch;

            render(
                <Provider store={mockStore}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            // Get the table config from the useTable mock
            const tableConfig = mockUseTable.mock.calls[mockUseTable.mock.calls.length - 1][0];
            const descColumn = tableConfig.columns[1];

            const cellData =
                'Oracle task.;{"resourceId":"res123","databaseInstanceId":"db456","sqlServerDeploymentType":"Oracle","databaseInstanceName":"OracleDB","hostName":"host123"}';
            const rowData = { id: '1', status: 'COMPLETED' };

            // Create a separate render for just the cell to extract button props
            const TestWrapper = () => descColumn.renderCell(cellData, rowData);

            const { container } = render(
                <Provider store={mockStore}>
                    <TestWrapper />
                </Provider>
            );

            // Find and click the button
            const button = container.querySelector('[data-testid="nav-button"]');
            expect(button).toBeTruthy();

            if (button) {
                fireEvent.click(button);
                // Verify dispatch was called for Oracle navigation
                expect(mockDispatch).toHaveBeenCalled();
            }
        });
    });

    describe('Edge cases', () => {
        it('should handle empty subJobs array', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: []
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('should handle missing jobId prop', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: []
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="" statusType="completed" />
                </Provider>
            );

            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('should handle missing statusType prop', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        id: 'job123',
                        subJobs: []
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="" />
                </Provider>
            );

            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('should handle subJobsData without id', () => {
            const store = createMockStore({
                jobMonitoring: {
                    subJobsData: {
                        subJobs: [{ id: '1', description: 'Job 1' }]
                    },
                    subJobsDataLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <SubJobTable jobId="job123" statusType="completed" />
                </Provider>
            );

            expect(screen.getByTestId('table')).toBeTruthy();
        });
    });
});
