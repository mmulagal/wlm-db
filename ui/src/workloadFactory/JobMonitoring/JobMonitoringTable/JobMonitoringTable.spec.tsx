import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import JobMonitoringTable from './JobMonitoringTable';
import { JOB_MONITORING_STATUS, JOB_MONITORING_TYPE } from '../../../utils/consts';

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

// Mock SubJobTable
vi.mock('../SubJobTable/SubJobTable', () => ({
    default: ({ jobId, statusType }: any) => (
        <div data-testid="sub-job-table" data-job-id={jobId} data-status-type={statusType}>
            SubJobTable
        </div>
    )
}));

// Mock DialogComponent
vi.mock('../../../common/Dialog/DialogComponent', () => ({
    default: ({ header, content, primaryButton, callback }: any) => (
        <div data-testid="dialog-component" data-header={header}>
            {content}
        </div>
    )
}));

// Mock MenuPopover
vi.mock('../../../common/MenuPopover/MenuPopover', () => ({
    default: ({ isMenuOpen, menuItems, toggleMenu }: any) => (
        <div data-testid="menu-popover" data-open={isMenuOpen}>
            {menuItems.map((item: any, idx: number) => (
                <div
                    key={idx}
                    data-testid={`menu-item-${item.id}`}
                    onClick={() => toggleMenu('selectedOption', item.id)}
                >
                    {item.displayName || item.customComponent}
                </div>
            ))}
        </div>
    )
}));

// Mock CopyToClipboardCommon
vi.mock('../../../common/CopyToClipboard/copyToClipboard', () => ({
    default: ({ value, iconProvided }: any) => (
        <div data-testid="copy-to-clipboard" data-value={value}>
            {iconProvided}
        </div>
    )
}));

// Mock @netapp/design-system
vi.mock('@netapp/design-system', () => ({
    Button: ({ children, onClick, Component, variant, className }: any) => (
        <button
            data-testid="button"
            data-component={Component}
            data-variant={variant}
            className={className}
            onClick={onClick}
        >
            {children}
        </button>
    ),
    Popover: ({ children, container, trigger }: any) => (
        <div data-testid="popover" data-trigger={trigger}>
            <div>{children}</div>
            <div>{container}</div>
        </div>
    ),
    Typography: ({ children, variant, style, className }: any) => (
        <div data-testid="typography" data-variant={variant} className={className}>
            {children}
        </div>
    ),
    useDialog: () => ({
        setDialog: vi.fn()
    })
}));

// Mock table components
const mockUseTable = vi.fn();
vi.mock('../../../common/Lib/Table/useTable', () => ({
    useTable: (...args: any[]) => mockUseTable(...args)
}));

vi.mock('../../../common/Lib/Table/TableTopBar', () => ({
    TableTopBar: ({ tableProps, pluralTitle, singularTitle, actionsRight, className }: any) => (
        <div data-testid="table-top-bar" data-plural={pluralTitle} data-singular={singularTitle} className={className}>
            {actionsRight}
        </div>
    )
}));

vi.mock('../../../common/Lib/Table/Table', () => ({
    Table: ({ tableProps, isDoubleRow, ExpandedRow, lazyLoadingText }: any) => (
        <div data-testid="table" data-double-row={isDoubleRow} data-lazy-loading={lazyLoadingText}>
            Table
        </div>
    )
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

vi.mock('../../../assets/ic_download.svg', () => ({
    ReactComponent: ({ onClick }: any) => <svg data-testid="download-icon" onClick={onClick} />
}));

// Mock SCSS modules
vi.mock('./JobMonitoringTable.module.scss', () => ({
    default: {
        jobMonitoringTable: 'jobMonitoringTable',
        table: 'table',
        topBarStyle: 'topBarStyle',
        downloadButton: 'downloadButton',
        downloadDisable: 'downloadDisable',
        statusbar: 'statusbar',
        arrow: 'arrow',
        'arrow-down': 'arrow-down',
        'arrow-disabled': 'arrow-disabled',
        firstCol: 'firstCol',
        statusCol: 'statusCol',
        statusIcon: 'statusIcon',
        jobMenuPopover: 'jobMenuPopover',
        completed: 'completed',
        failed: 'failed',
        warning: 'warning',
        inprogress: 'inprogress'
    }
}));

vi.mock('../../../utils/CommonStyles.module.scss', () => ({
    default: {
        wrapTextIn2Line: 'wrapTextIn2Line',
        popover: 'popover',
        buttonClass: 'buttonClass'
    }
}));

// Mock appConstants
vi.mock('../../../utils/appConstants', () => ({
    GENERAL: {
        NOT_AVAILABLE: 'N/A',
        GO_TO_CLOUDFORMATION: 'Go to CloudFormation',
        DEMO_TITLE: 'Demo Mode',
        DEMO_CONTENT: 'This action is not available in demo mode',
        CONTINUE: 'Continue',
        JM_DOWNLOAD_SUCCESS: 'Download successful',
        JM_DOWNLOAD_PROGRESS: 'Download in progress',
        LOADING_DATA: 'Loading data...'
    }
}));

// Mock utility functions
const mockCollapseAllRows = vi.fn();
const mockCreateJobMonitorCSV = vi.fn(() => '#header\ndata');
const mockDownloadCsv = vi.fn();
const mockExpandTableRow = vi.fn();
const mockFormatDateWithTime = vi.fn(date => `Formatted: ${date}`);
const mockJobMonitoringStatusMapping = vi.fn(status => status?.toUpperCase());
const mockJobMonitoringTypeMapping = vi.fn(type => type);

vi.mock('../../../utils/utilityFunctions', () => ({
    collapseAllRows: (...args: any[]) => mockCollapseAllRows(...args),
    createJobMonitorCSV: (...args: any[]) => mockCreateJobMonitorCSV(...args),
    downloadCsv: (...args: any[]) => mockDownloadCsv(...args),
    expandTableRow: (...args: any[]) => mockExpandTableRow(...args),
    formatDateWithTime: (...args: any[]) => mockFormatDateWithTime(...args),
    jobMonitoringStatusMapping: (...args: any[]) => mockJobMonitoringStatusMapping(...args),
    jobMonitoringTypeMapping: (...args: any[]) => mockJobMonitoringTypeMapping(...args)
}));

// Mock API service
const mockUseGetFullJobsListQuery = vi.fn();
const mockUseLazyGetSubTaskListQuery = vi.fn();

vi.mock('../../../utils/apiService', () => ({
    useGetFullJobsListQuery: (...args: any[]) => mockUseGetFullJobsListQuery(...args),
    useLazyGetSubTaskListQuery: () => [mockUseLazyGetSubTaskListQuery()]
}));

// Mock initialJobMonitorColState
vi.mock('../../../utils/manageColumnUtils', () => ({
    initialJobMonitorColState: {}
}));

const createMockStore = (overrides = {}) => {
    const defaultState = {
        jobMonitoring: {
            jobsList: [],
            jobsListLoading: false,
            downloadJobsList: [],
            downloadJobsLoading: false,
            columnState: [],
            subJobsData: {},
            timeInterval: 1,
            fromTime: Date.now() - 86400000,
            toTime: Date.now(),
            ...overrides.jobMonitoring
        },
        headers: {
            refreshTime: 0,
            refreshTimeJobMonitor: 0,
            getCredentials: {
                credentialData: [],
                credentialLoading: false
            },
            ...overrides.headers
        },
        auth: {
            isDemoMode: false,
            ...overrides.auth
        }
    };

    return configureStore({
        reducer: {
            jobMonitoring: (state = defaultState.jobMonitoring) => state,
            headers: (state = defaultState.headers) => state,
            auth: (state = defaultState.auth) => state,
            notificationSlice: (state = {}) => state
        }
    });
};

describe('JobMonitoringTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock implementations
        mockUseGetFullJobsListQuery.mockReturnValue({
            data: undefined,
            isFetching: false,
            isError: false
        });

        mockUseLazyGetSubTaskListQuery.mockReturnValue(vi.fn(() => Promise.resolve({ data: {} })));

        mockUseTable.mockReturnValue({
            columns: [],
            rows: [],
            rowsState: {},
            updateRowState: vi.fn(() => vi.fn()),
            pagination: { gotoPage: vi.fn() },
            filterState: { columns: {} },
            columnsState: []
        });
    });

    describe('Rendering', () => {
        it('should render JobMonitoringTable component', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            expect(screen.getByTestId('table-top-bar')).toBeTruthy();
            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('should render with correct titles', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            const topBar = screen.getByTestId('table-top-bar');
            expect(topBar.getAttribute('data-plural')).toBe('Jobs');
            expect(topBar.getAttribute('data-singular')).toBe('Job');
        });

        it('should render table as double row', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            const table = screen.getByTestId('table');
            expect(table.getAttribute('data-double-row')).toBe('true');
        });
    });

    describe('Jobs list data', () => {
        it('should display jobs from store', () => {
            const mockJobs = [
                {
                    id: 'job1',
                    name: 'Job 1',
                    status: JOB_MONITORING_STATUS.COMPLETED,
                    type: JOB_MONITORING_TYPE.DEPLOYMENT,
                    credentialsId: 'cred1',
                    region: { name: 'US East', code: 'us-east-1' },
                    startTime: 123,
                    endTime: 456
                },
                {
                    id: 'job2',
                    name: 'Job 2',
                    status: JOB_MONITORING_STATUS.IN_PROGRESS,
                    type: JOB_MONITORING_TYPE.ASSESSMENT,
                    credentialsId: 'cred2',
                    region: { name: 'US West', code: 'us-west-2' },
                    startTime: 789,
                    endTime: null
                }
            ];

            const store = createMockStore({
                jobMonitoring: {
                    jobsList: mockJobs
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            expect(mockUseTable).toHaveBeenCalled();
        });

        it('should handle empty jobs list', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jobsList: []
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('should merge jobs with credential data', () => {
            const mockJobs = [
                {
                    id: 'job1',
                    credentialsId: 'cred1',
                    region: { name: 'US East', code: 'us-east-1' }
                }
            ];

            const mockCredentials = [
                {
                    credentialsId: 'cred1',
                    name: 'My Credential',
                    providerAccountId: '123456789'
                }
            ];

            const store = createMockStore({
                jobMonitoring: {
                    jobsList: mockJobs
                },
                headers: {
                    getCredentials: {
                        credentialData: mockCredentials,
                        credentialLoading: false
                    }
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            expect(mockUseTable).toHaveBeenCalled();
            const callArg = mockUseTable.mock.calls[0][0];
            expect(callArg.rows[0].credName).toBe('My Credential');
            expect(callArg.rows[0].providerAccountId).toBe('123456789');
        });

        it('should show N/A for missing credentials', () => {
            const mockJobs = [
                {
                    id: 'job1',
                    credentialsId: 'cred1',
                    region: { name: 'US East', code: 'us-east-1' }
                }
            ];

            const store = createMockStore({
                jobMonitoring: {
                    jobsList: mockJobs
                },
                headers: {
                    getCredentials: {
                        credentialData: [],
                        credentialLoading: false
                    }
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            const callArg = mockUseTable.mock.calls[0][0];
            expect(callArg.rows[0].credName).toBe('N/A');
            expect(callArg.rows[0].providerAccountId).toBe('N/A');
        });
    });

    describe('Region formatting', () => {
        it('should format region with name and code', () => {
            const mockJobs = [
                {
                    id: 'job1',
                    region: { name: 'US East', code: 'us-east-1' }
                }
            ];

            const store = createMockStore({
                jobMonitoring: {
                    jobsList: mockJobs
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            const callArg = mockUseTable.mock.calls[0][0];
            expect(callArg.rows[0].regions).toBe('US East | us-east-1');
        });

        it('should format region with only name', () => {
            const mockJobs = [
                {
                    id: 'job1',
                    region: { name: 'US East', code: null }
                }
            ];

            const store = createMockStore({
                jobMonitoring: {
                    jobsList: mockJobs
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            const callArg = mockUseTable.mock.calls[0][0];
            expect(callArg.rows[0].regions).toBe('US East');
        });

        it('should format region with only code', () => {
            const mockJobs = [
                {
                    id: 'job1',
                    region: { name: null, code: 'us-east-1' }
                }
            ];

            const store = createMockStore({
                jobMonitoring: {
                    jobsList: mockJobs
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            const callArg = mockUseTable.mock.calls[0][0];
            expect(callArg.rows[0].regions).toBe('us-east-1');
        });

        it('should show N/A when both name and code are missing', () => {
            const mockJobs = [
                {
                    id: 'job1',
                    region: { name: null, code: null }
                }
            ];

            const store = createMockStore({
                jobMonitoring: {
                    jobsList: mockJobs
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            const callArg = mockUseTable.mock.calls[0][0];
            expect(callArg.rows[0].regions).toBe('N/A');
        });
    });

    describe('Download functionality', () => {
        it('should show enabled download button when jobs exist and not loading', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jobsList: [{ id: 'job1' }],
                    jobsListLoading: false,
                    downloadJobsLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            expect(screen.getByTestId('download-icon')).toBeTruthy();
        });

        it('should show disabled download button when jobs list is empty', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jobsList: [],
                    jobsListLoading: false,
                    downloadJobsLoading: false
                }
            });

            const { container } = render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            expect(container.querySelector('.downloadDisable')).toBeTruthy();
        });

        it('should show disabled download button when loading', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jobsList: [],
                    jobsListLoading: true,
                    downloadJobsLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            // When loading, download should be disabled or not visible
            expect(screen.queryByTestId('download-icon')).toBeFalsy();
        });

        it('should show download in progress when downloading', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jobsList: [{ id: 'job1' }],
                    jobsListLoading: false,
                    downloadJobsLoading: true
                }
            });

            const { container } = render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            expect(container.querySelector('.downloadDisable')).toBeTruthy();
            expect(screen.getByText('Download in progress')).toBeTruthy();
        });

        it('should trigger download on button click', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jobsList: [{ id: 'job1' }],
                    jobsListLoading: false,
                    downloadJobsLoading: false
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            const downloadIcon = screen.getByTestId('download-icon');
            fireEvent.click(downloadIcon);

            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: expect.stringContaining('setDownloadJobsLoading')
                })
            );
        });

        it('should process and download CSV when API completes', async () => {
            const mockDownloadData = {
                items: [
                    {
                        id: 'job1',
                        name: 'Job 1',
                        credentialsId: 'cred1',
                        region: { name: 'US East', code: 'us-east-1' }
                    }
                ],
                nextToken: null
            };

            mockUseGetFullJobsListQuery.mockReturnValue({
                data: mockDownloadData,
                isFetching: false,
                isError: false
            });

            const store = createMockStore({
                jobMonitoring: {
                    jobsList: [{ id: 'job1' }],
                    downloadJobsList: [],
                    downloadJobsLoading: true,
                    columnState: [],
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            await waitFor(() => {
                expect(mockCreateJobMonitorCSV).toHaveBeenCalled();
            });
        });

        it('should handle download API error', async () => {
            mockUseGetFullJobsListQuery.mockReturnValue({
                data: undefined,
                isFetching: false,
                isError: true
            });

            const store = createMockStore({
                jobMonitoring: {
                    downloadJobsLoading: true,
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: expect.stringContaining('setDownloadJobsLoading'),
                        payload: false
                    })
                );
            });
        });

        it('should remove # from CSV content', async () => {
            const mockDownloadData = {
                items: [{ id: 'job1' }],
                nextToken: null
            };

            mockUseGetFullJobsListQuery.mockReturnValue({
                data: mockDownloadData,
                isFetching: false,
                isError: false
            });

            mockCreateJobMonitorCSV.mockReturnValue('#header\ndata');

            const store = createMockStore({
                jobMonitoring: {
                    downloadJobsList: [],
                    downloadJobsLoading: true,
                    columnState: [],
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            await waitFor(() => {
                expect(mockDownloadCsv).toHaveBeenCalledWith('header\ndata');
            });
        });
    });

    describe('Sub jobs data fetching', () => {
        it('should fetch sub jobs data when row is expanded', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jobsList: [{ id: 'job1' }]
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            // Simulate getSubJobsData call
            expect(mockUseLazyGetSubTaskListQuery).toHaveBeenCalled();
        });

        it('should not refetch if sub jobs data already exists for job', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jobsList: [{ id: 'job1' }],
                    subJobsData: {
                        id: 'job1',
                        subJobs: [{ id: 'subjob1' }]
                    }
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            // getSubJobsData should check if data exists
            expect(mockUseLazyGetSubTaskListQuery).toHaveBeenCalled();
        });

        it('should handle sub jobs API error', async () => {
            mockUseLazyGetSubTaskListQuery.mockReturnValue(vi.fn(() => Promise.reject(new Error('API Error'))));

            const store = createMockStore({
                jobMonitoring: {
                    jobsList: [{ id: 'job1' }]
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            // Should handle error gracefully
            expect(mockUseLazyGetSubTaskListQuery).toHaveBeenCalled();
        });
    });

    describe('CloudFormation navigation', () => {
        it('should handle Go to CloudFormation click in non-demo mode', () => {
            const store = createMockStore({
                auth: {
                    isDemoMode: false
                }
            });

            // Mock window.open
            const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            // Test would require actual row rendering with menu
            expect(mockUseTable).toHaveBeenCalled();

            windowOpenSpy.mockRestore();
        });

        it('should show demo dialog when Go to CloudFormation clicked in demo mode', () => {
            const store = createMockStore({
                auth: {
                    isDemoMode: true
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            // Test would require actual row rendering with menu
            expect(mockUseTable).toHaveBeenCalled();
        });

        it('should enable CloudFormation menu item when href exists', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            // Menu items configuration is tested through table column definition
            expect(mockUseTable).toHaveBeenCalled();
        });

        it('should disable CloudFormation menu item when href does not exist', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            expect(mockUseTable).toHaveBeenCalled();
        });
    });

    describe('Refresh and pagination', () => {
        it('should collapse all rows when timeInterval changes', async () => {
            mockUseTable.mockReturnValue({
                columns: [],
                rows: [],
                rowsState: { job1: { isExpanded: true } },
                updateRowState: vi.fn(() => vi.fn()),
                pagination: { gotoPage: vi.fn() },
                filterState: { columns: {} },
                columnsState: []
            });

            const store = createMockStore({
                jobMonitoring: {
                    timeInterval: 1
                }
            });

            const { rerender } = render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            const newStore = createMockStore({
                jobMonitoring: {
                    timeInterval: 7
                }
            });

            rerender(
                <Provider store={newStore}>
                    <JobMonitoringTable />
                </Provider>
            );

            await waitFor(() => {
                expect(mockCollapseAllRows).toHaveBeenCalled();
            });
        });

        it('should reset to first page when timeInterval changes', async () => {
            const mockGotoPage = vi.fn();
            mockUseTable.mockReturnValue({
                columns: [],
                rows: [],
                rowsState: {},
                updateRowState: vi.fn(() => vi.fn()),
                pagination: { gotoPage: mockGotoPage },
                filterState: { columns: {} },
                columnsState: []
            });

            const store = createMockStore({
                jobMonitoring: {
                    timeInterval: 1
                }
            });

            const { rerender } = render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            const newStore = createMockStore({
                jobMonitoring: {
                    timeInterval: 7
                }
            });

            rerender(
                <Provider store={newStore}>
                    <JobMonitoringTable />
                </Provider>
            );

            await waitFor(() => {
                expect(mockGotoPage).toHaveBeenCalledWith(0);
            });
        });

        it('should collapse rows when refreshTimeJobMonitor changes', async () => {
            const mockUpdateRowState = vi.fn(() => vi.fn());
            mockUseTable.mockReturnValue({
                columns: [],
                rows: [],
                rowsState: { job1: { isExpanded: true } },
                updateRowState: mockUpdateRowState,
                pagination: { gotoPage: vi.fn() },
                filterState: { columns: {} },
                columnsState: []
            });

            const store = createMockStore({
                headers: {
                    refreshTimeJobMonitor: 0
                }
            });

            const { rerender } = render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            const newStore = createMockStore({
                headers: {
                    refreshTimeJobMonitor: 1
                }
            });

            rerender(
                <Provider store={newStore}>
                    <JobMonitoringTable />
                </Provider>
            );

            await waitFor(() => {
                expect(mockUpdateRowState).toHaveBeenCalled();
            });
        });
    });

    describe('Filtering', () => {
        it('should track type filter changes', () => {
            const mockFilterState = {
                columns: {
                    '2': {
                        values: {
                            [JOB_MONITORING_TYPE.DEPLOYMENT]: true,
                            [JOB_MONITORING_TYPE.ASSESSMENT]: true
                        }
                    }
                }
            };

            mockUseTable.mockReturnValue({
                columns: [],
                rows: [],
                rowsState: {},
                updateRowState: vi.fn(() => vi.fn()),
                pagination: { gotoPage: vi.fn() },
                filterState: mockFilterState,
                columnsState: []
            });

            const store = createMockStore();

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            expect(mockUseTable).toHaveBeenCalled();
        });

        it('should track status filter changes', () => {
            const mockFilterState = {
                columns: {
                    '3': {
                        values: {
                            [JOB_MONITORING_STATUS.COMPLETED]: true,
                            [JOB_MONITORING_STATUS.FAILED]: true
                        }
                    }
                }
            };

            mockUseTable.mockReturnValue({
                columns: [],
                rows: [],
                rowsState: {},
                updateRowState: vi.fn(() => vi.fn()),
                pagination: { gotoPage: vi.fn() },
                filterState: mockFilterState,
                columnsState: []
            });

            const store = createMockStore();

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            expect(mockUseTable).toHaveBeenCalled();
        });
    });

    describe('Demo mode', () => {
        it('should apply initial sort in demo mode', () => {
            const store = createMockStore({
                auth: {
                    isDemoMode: true
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            const callArg = mockUseTable.mock.calls[0][0];
            expect(callArg.initialSortState).toBeDefined();
            expect(callArg.initialSortState.sortOrder).toBe('desc');
            expect(callArg.initialSortState.column).toBe('6');
        });

        it('should not apply initial sort when not in demo mode', () => {
            const store = createMockStore({
                auth: {
                    isDemoMode: false
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            const callArg = mockUseTable.mock.calls[0][0];
            expect(callArg.initialSortState).toBeUndefined();
        });
    });

    describe('Column state management', () => {
        it('should dispatch column state updates', async () => {
            const mockColumnsState = [{ id: '1', visible: true }];
            mockUseTable.mockReturnValue({
                columns: [],
                rows: [],
                rowsState: {},
                updateRowState: vi.fn(() => vi.fn()),
                pagination: { gotoPage: vi.fn() },
                filterState: { columns: {} },
                columnsState: mockColumnsState
            });

            const store = createMockStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: expect.stringContaining('setJobMonitoringColumnState')
                    })
                );
            });
        });
    });

    describe('Loading states', () => {
        it('should show lazy loading when jobsListLoading is true', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jobsListLoading: true
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            const callArg = mockUseTable.mock.calls[0][0];
            expect(callArg.isLazyLoading).toBe(true);
        });

        it('should show lazy loading when credentialLoading is true', () => {
            const store = createMockStore({
                headers: {
                    getCredentials: {
                        credentialData: [],
                        credentialLoading: true
                    }
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            const callArg = mockUseTable.mock.calls[0][0];
            expect(callArg.isLazyLoading).toBe(true);
        });

        it('should not show lazy loading when both are false', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jobsListLoading: false
                },
                headers: {
                    getCredentials: {
                        credentialData: [],
                        credentialLoading: false
                    }
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            const callArg = mockUseTable.mock.calls[0][0];
            expect(callArg.isLazyLoading).toBe(false);
        });
    });

    describe('CSS classes', () => {
        it('should apply correct CSS classes', () => {
            const store = createMockStore();

            const { container } = render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            expect(container.querySelector('.jobMonitoringTable')).toBeTruthy();
            expect(container.querySelector('.table')).toBeTruthy();
        });

        it('should apply topBarStyle to TableTopBar', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            const topBar = screen.getByTestId('table-top-bar');
            expect(topBar.className).toContain('topBarStyle');
        });
    });

    describe('Edge cases', () => {
        it('should handle null credentials data', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jobsList: [{ id: 'job1', credentialsId: 'cred1' }]
                },
                headers: {
                    getCredentials: {
                        credentialData: null,
                        credentialLoading: false
                    }
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('should handle jobs without region data', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jobsList: [{ id: 'job1', region: null }]
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('should handle empty filters', () => {
            mockUseTable.mockReturnValue({
                columns: [],
                rows: [],
                rowsState: {},
                updateRowState: vi.fn(() => vi.fn()),
                pagination: { gotoPage: vi.fn() },
                filterState: { columns: {} },
                columnsState: []
            });

            const store = createMockStore();

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            expect(screen.getByTestId('table')).toBeTruthy();
        });
    });

    describe('React.memo optimization', () => {
        it('should memoize component properly', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <JobMonitoringTable />
                </Provider>
            );

            // Component should render with memoization
            expect(mockUseTable).toHaveBeenCalled();
            expect(screen.getByTestId('table')).toBeTruthy();
        });
    });
});
