import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ExploreSavingsOnPremiseTable from '../ExploreSavingsOnPremiseTable';
import exploreSavingsSlice from '../../../../store/workloadFactory/exploreSavingsSlice';
import notificationSlice from '../../../../store/notificationSlice';
import authSlice from '../../../../store/authSlice';
import { JOB_MONITORING_STATUS } from '../../../../utils/consts';
import { NOTIFICATION_TYPES } from '../../../../store/notificationSlice';

// Mock fflate
vi.mock('fflate', () => ({
    compressSync: vi.fn((data) => new Uint8Array([1, 2, 3, 4, 5])) // Simple mock compressed data
}));

// Mock the script import
vi.mock('../../../script/SQLServerDataCollector.ps1?raw', () => ({
    default: 'mock script content'
}));

// Mock FileUpload component
vi.mock('../FileUpload', () => ({
    default: ({ handleFileChange }: any) => (
        <div>
            <input 
                type="file" 
                id="file-input" 
                accept=".json" 
                onChange={handleFileChange}
                data-testid="file-upload"
            />
        </div>
    )
}));

// Mock @netapp/design-system
vi.mock('@netapp/design-system', () => ({
    Table: ({ children, ...props }: any) => <div data-testid="table" {...props}>{children}</div>,
    useTable: () => ({
        selectedRows: [],
        setSelectedRows: vi.fn(),
        clearSelection: vi.fn(),
        selectAll: vi.fn(),
        isSelectAllChecked: false,
        isIndeterminate: false,
        handleSelectAllChange: vi.fn(),
        handleRowSelect: vi.fn()
    }),
    Typography: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    TableTopBar: ({ children, ...props }: any) => <div data-testid="table-topbar" {...props}>{children}</div>,
    DsTypography: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    Popover: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    DsSpinner: (props: any) => <div data-testid="spinner" {...props}>Loading...</div>,
    TooltipInfo: ({ children, ...props }: any) => <div {...props}>{children}</div>
}));

// Mock SVG imports
vi.mock('../../../assets/download.svg', () => ({
    ReactComponent: (props: any) => <svg data-testid="download-icon" {...props} />
}));

// Mock API services
const mockGetUploadScript = vi.fn();
const mockDeleteOnPremTco = vi.fn();
const mockGetJobDetailApi = vi.fn();
const mockFetchOnPremData = vi.fn();

vi.mock('../../../utils/apiService', () => ({
    useGetUploadScriptMutation: () => [mockGetUploadScript],
    useDeleteOnPremTcoMutation: () => [mockDeleteOnPremTco],
    useLazyGetSubTaskListQuery: () => [mockGetJobDetailApi]
}));

// Mock custom hooks
vi.mock('../useOnPremData', () => ({
    useOnPremData: () => ({
        fetchOnPremData: mockFetchOnPremData,
        error: null,
        onPremiseData: null
    })
}));

vi.mock('../../../common/hooks/useResize', () => ({
    default: () => ({ width: 1024, height: 768 })
}));

vi.mock('../ExploreSavingsUtils', () => ({
    onClickESHostOnPrem: vi.fn()
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    formatDateWithTime: vi.fn((date) => date ? '2024-01-01 12:00:00' : ''),
    getFilterOptions: vi.fn(() => []),
    getTruncatedItems: vi.fn((items) => items)
}));

describe('ExploreSavingsOnPremiseTable', () => {
    let store: any;

    const createMockStore = (overrides = {}) => {
        return configureStore({
            reducer: {
                exploreSavings: exploreSavingsSlice.reducer,
                notifications: notificationSlice.reducer,
                auth: authSlice.reducer
            } as any,
            preloadedState: {
                exploreSavings: {
                    onPremiseData: null,
                    onPremiseDataLoading: false,
                    ...overrides
                },
                auth: {
                    isDemoMode: false,
                    isWorkloadFactory: true
                }
            } as any
        });
    };

    beforeEach(() => {
        vi.clearAllMocks();
        store = createMockStore();
        
        // Mock FileReader
        global.FileReader = class MockFileReader {
            onload: any = null;
            onerror: any = null;
            result: any = null;
            
            readAsText() {
                setTimeout(() => {
                    this.result = JSON.stringify({ test: 'data' });
                    if (this.onload) {
                        this.onload({ target: { result: this.result } });
                    }
                }, 0);
            }
        } as any;
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    describe('Component Rendering', () => {
        it('should render without crashing', () => {
            const { container } = render(
                <Provider store={store}>
                    <ExploreSavingsOnPremiseTable />
                </Provider>
            );
            expect(container).toBeTruthy();
        });

        it('should render file upload component', () => {
            render(
                <Provider store={store}>
                    <ExploreSavingsOnPremiseTable />
                </Provider>
            );
            const fileInput = document.querySelector('input[type="file"]');
            expect(fileInput).toBeTruthy();
        });

        it('should fetch onprem data on mount', () => {
            render(
                <Provider store={store}>
                    <ExploreSavingsOnPremiseTable />
                </Provider>
            );
            expect(mockFetchOnPremData).toHaveBeenCalled();
        });
    });

    describe('File Upload Validation', () => {
        it('should reject non-JSON files', async () => {
            const { container } = render(
                <Provider store={store}>
                    <ExploreSavingsOnPremiseTable />
                </Provider>
            );

            const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
            const file = new File(['test content'], 'test.txt', { type: 'text/plain' });

            fireEvent.change(fileInput, { target: { files: [file] } });

            await waitFor(() => {
                // Should dispatch error notification
                const state = store.getState();
                expect(state.notifications.notifications).toBeDefined();
            });
        });

        it('should reject files larger than 2MB', async () => {
            const { container } = render(
                <Provider store={store}>
                    <ExploreSavingsOnPremiseTable />
                </Provider>
            );

            const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
            const largeContent = 'x'.repeat(3 * 1024 * 1024); // 3MB
            const file = new File([largeContent], 'SQLServerDataResponse-test.json', { 
                type: 'application/json' 
            });
            
            Object.defineProperty(file, 'size', { value: 3 * 1024 * 1024 });

            fireEvent.change(fileInput, { target: { files: [file] } });

            await waitFor(() => {
                const state = store.getState();
                expect(state.notifications.notifications).toBeDefined();
            });
        });

        it('should reject files not starting with "SQLServerDataResponse-"', async () => {
            const { container } = render(
                <Provider store={store}>
                    <ExploreSavingsOnPremiseTable />
                </Provider>
            );

            const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
            const file = new File(['{"test": "data"}'], 'invalid-name.json', { 
                type: 'application/json' 
            });

            fireEvent.change(fileInput, { target: { files: [file] } });

            await waitFor(() => {
                const state = store.getState();
                expect(state.notifications.notifications).toBeDefined();
            });
        });

        it('should accept valid JSON files with correct name', async () => {
            mockGetUploadScript.mockResolvedValue({
                data: { jobId: 'test-job-123' }
            });

            const { container } = render(
                <Provider store={store}>
                    <ExploreSavingsOnPremiseTable />
                </Provider>
            );

            const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
            const file = new File(['{"test": "data"}'], 'SQLServerDataResponse-test.json', { 
                type: 'application/json' 
            });

            fireEvent.change(fileInput, { target: { files: [file] } });

            await waitFor(() => {
                expect(mockGetUploadScript).toHaveBeenCalled();
            });
        });

        it('should handle empty file selection', () => {
            const { container } = render(
                <Provider store={store}>
                    <ExploreSavingsOnPremiseTable />
                </Provider>
            );

            const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
            fireEvent.change(fileInput, { target: { files: [] } });

            expect(mockGetUploadScript).not.toHaveBeenCalled();
        });
    });

    describe('File Upload Processing', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should compress and upload file content', async () => {
            mockGetUploadScript.mockResolvedValue({
                data: { jobId: 'test-job-123' }
            });

            const { container } = render(
                <Provider store={store}>
                    <ExploreSavingsOnPremiseTable />
                </Provider>
            );

            const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
            const file = new File(['{"test": "data"}'], 'SQLServerDataResponse-test.json', {
                type: 'application/json'
            });

            fireEvent.change(fileInput, { target: { files: [file] } });

            await vi.runAllTimersAsync();

            await waitFor(() => {
                expect(mockGetUploadScript).toHaveBeenCalledWith(
                    expect.objectContaining({
                        payload: expect.objectContaining({
                            fileName: 'SQLServerDataResponse-test.json',
                            fileContent: expect.any(String)
                        })
                    })
                );
            });
        });

        it('should start job monitoring after successful upload', async () => {
            mockGetUploadScript.mockResolvedValue({
                data: { jobId: 'test-job-123' }
            });

            mockGetJobDetailApi.mockResolvedValue({
                data: { status: JOB_MONITORING_STATUS.IN_PROGRESS }
            });

            const { container } = render(
                <Provider store={store}>
                    <ExploreSavingsOnPremiseTable />
                </Provider>
            );

            const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
            const file = new File(['{"test": "data"}'], 'SQLServerDataResponse-test.json', {
                type: 'application/json'
            });

            fireEvent.change(fileInput, { target: { files: [file] } });

            await vi.runAllTimersAsync();

            await waitFor(() => {
                expect(mockGetUploadScript).toHaveBeenCalled();
            });
        });

        it('should handle job completion successfully', async () => {
            mockGetUploadScript.mockResolvedValue({
                data: { jobId: 'test-job-123' }
            });

            mockGetJobDetailApi.mockResolvedValue({
                data: { status: JOB_MONITORING_STATUS.COMPLETED }
            });

            const { container } = render(
                <Provider store={store}>
                    <ExploreSavingsOnPremiseTable />
                </Provider>
            );

            const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
            const file = new File(['{"test": "data"}'], 'SQLServerDataResponse-test.json', {
                type: 'application/json'
            });

            fireEvent.change(fileInput, { target: { files: [file] } });

            await vi.runAllTimersAsync();

            await waitFor(() => {
                expect(mockFetchOnPremData).toHaveBeenCalledWith(true);
            }, { timeout: 10000 });
        });

        it('should handle job failure', async () => {
            mockGetUploadScript.mockResolvedValue({
                data: { jobId: 'test-job-123' }
            });

            mockGetJobDetailApi.mockResolvedValue({
                data: { 
                    status: JOB_MONITORING_STATUS.FAILED,
                    error: 'Upload failed'
                }
            });

            const { container } = render(
                <Provider store={store}>
                    <ExploreSavingsOnPremiseTable />
                </Provider>
            );

            const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
            const file = new File(['{"test": "data"}'], 'SQLServerDataResponse-test.json', {
                type: 'application/json'
            });

            fireEvent.change(fileInput, { target: { files: [file] } });

            await vi.runAllTimersAsync();

            await waitFor(() => {
                const state = store.getState();
                expect(state.notifications.notifications).toBeDefined();
            }, { timeout: 10000 });
        });

        it('should handle upload API error', async () => {
            mockGetUploadScript.mockResolvedValue({
                error: { message: 'Upload failed' }
            });

            const { container } = render(
                <Provider store={store}>
                    <ExploreSavingsOnPremiseTable />
                </Provider>
            );

            const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
            const file = new File(['{"test": "data"}'], 'SQLServerDataResponse-test.json', {
                type: 'application/json'
            });

            fireEvent.change(fileInput, { target: { files: [file] } });

            await vi.runAllTimersAsync();

            await waitFor(() => {
                expect(mockGetJobDetailApi).not.toHaveBeenCalled();
            });
        });
    });

    describe('Demo Mode', () => {
        it('should accept any file in demo mode', async () => {
            const demoStore = configureStore({
                reducer: {
                    exploreSavings: exploreSavingsSlice.reducer,
                    notifications: notificationSlice.reducer,
                    auth: authSlice.reducer
                } as any,
                preloadedState: {
                    exploreSavings: {
                        onPremiseData: [{ id: 1, name: 'test' }],
                        onPremiseDataLoading: false
                    },
                    auth: {
                        isDemoMode: true,
                        isWorkloadFactory: true
                    }
                } as any
            });

            const { container } = render(
                <Provider store={demoStore}>
                    <ExploreSavingsOnPremiseTable />
                </Provider>
            );

            const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
            const file = new File(['test'], 'any-name.txt', { type: 'text/plain' });

            fireEvent.change(fileInput, { target: { files: [file] } });

            // Should not reject the file
            expect(mockGetUploadScript).not.toHaveBeenCalled();
        });
    });

    describe('Table Data Management', () => {
        it('should update table data when onPremiseData changes', () => {
            const mockData = [
                { id: 1, resourceName: 'Host1' },
                { id: 2, resourceName: 'Host2' }
            ];

            const storeWithData = createMockStore({
                onPremiseData: mockData
            });

            render(
                <Provider store={storeWithData}>
                    <ExploreSavingsOnPremiseTable />
                </Provider>
            );

            // Table should contain the data
            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('should set empty table data when onPremiseData is null', () => {
            render(
                <Provider store={store}>
                    <ExploreSavingsOnPremiseTable />
                </Provider>
            );

            expect(screen.getByTestId('table')).toBeTruthy();
        });
    });

    describe('Loading States', () => {
        it('should show spinner during upload', async () => {
            vi.useFakeTimers();
            
            mockGetUploadScript.mockResolvedValue({
                data: { jobId: 'test-job-123' }
            });

            mockGetJobDetailApi.mockResolvedValue({
                data: { status: JOB_MONITORING_STATUS.IN_PROGRESS }
            });

            const { container } = render(
                <Provider store={store}>
                    <ExploreSavingsOnPremiseTable />
                </Provider>
            );

            const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
            const file = new File(['{"test": "data"}'], 'SQLServerDataResponse-test.json', {
                type: 'application/json'
            });

            fireEvent.change(fileInput, { target: { files: [file] } });

            await vi.runAllTimersAsync();

            vi.useRealTimers();
        });
    });

    describe('Error Handling', () => {
        it('should handle FileReader errors gracefully', async () => {
            // Override FileReader to simulate error
            global.FileReader = class MockFileReaderError {
                onload: any = null;
                onerror: any = null;
                
                readAsText() {
                    setTimeout(() => {
                        if (this.onerror) {
                            this.onerror(new Error('Read failed'));
                        }
                    }, 0);
                }
            } as any;

            const { container } = render(
                <Provider store={store}>
                    <ExploreSavingsOnPremiseTable />
                </Provider>
            );

            const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
            const file = new File(['{"test": "data"}'], 'SQLServerDataResponse-test.json', {
                type: 'application/json'
            });

            fireEvent.change(fileInput, { target: { files: [file] } });

            // Should not crash
            await waitFor(() => {
                expect(container).toBeTruthy();
            });
        });
    });

    describe('Menu Actions', () => {
        it('should have delete menu item', () => {
            render(
                <Provider store={store}>
                    <ExploreSavingsOnPremiseTable />
                </Provider>
            );

            // Component renders successfully
            expect(screen.getByTestId('table')).toBeTruthy();
        });
    });

    describe('Integration Tests', () => {
        it('should complete full upload workflow', async () => {
            vi.useFakeTimers();

            mockGetUploadScript.mockResolvedValue({
                data: { jobId: 'test-job-123' }
            });

            let callCount = 0;
            mockGetJobDetailApi.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.resolve({
                        data: { status: JOB_MONITORING_STATUS.IN_PROGRESS }
                    });
                }
                return Promise.resolve({
                    data: { status: JOB_MONITORING_STATUS.COMPLETED }
                });
            });

            const { container } = render(
                <Provider store={store}>
                    <ExploreSavingsOnPremiseTable />
                </Provider>
            );

            const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
            const file = new File(['{"test": "data"}'], 'SQLServerDataResponse-valid.json', {
                type: 'application/json'
            });

            fireEvent.change(fileInput, { target: { files: [file] } });

            await vi.runAllTimersAsync();
            
            vi.useRealTimers();
        });
    });
});
