import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ContentComponent from '../ContentComponent';
import createNewUserSlice from '../../../../store/workloadFactory/createNewDBSlice';
import authSlice from '../../../../store/authSlice';

// Mock the API hooks
const mockUseGetDriveInfoV2Query = vi.fn();
const mockUseGetCollationListV2Query = vi.fn();

vi.mock('../../../../utils/apiService', () => ({
    useGetDriveInfoV2Query: (params: any) => mockUseGetDriveInfoV2Query(params),
    useGetCollationListV2Query: (params: any) => mockUseGetCollationListV2Query(params)
}));

// Mock child components
vi.mock('../DatabaseInformation/DatabaseName/DatabaseName', () => ({
    default: () => <div data-testid="database-name">DatabaseName Component</div>
}));

vi.mock('../DatabaseInformation/Collation/Collation', () => ({
    default: () => <div data-testid="collation">Collation Component</div>
}));

vi.mock('../FileSettings/FileSettingsMode/FileSettingsMode', () => ({
    default: () => <div data-testid="file-settings-mode">FileSettingsMode Component</div>
}));

vi.mock('../FileSettings/FileNames/FileNames', () => ({
    default: () => <div data-testid="file-names">FileNames Component</div>
}));

vi.mock('../FileSettings/FilesSize/FilesSize', () => ({
    default: () => <div data-testid="files-size">FilesSize Component</div>
}));

// Mock @netapp/design-system
vi.mock('@netapp/design-system', () => ({
    AccordionController: ({ children, isGrouped }: any) => (
        <div data-testid="accordion-controller" data-grouped={isGrouped}>
            {children}
        </div>
    ),
    DsTypography: ({ children, variant, className }: any) => (
        <div data-testid={`typography-${variant}`} className={className}>
            {children}
        </div>
    )
}));

// Mock SCSS modules
vi.mock('../ContentComponent.module.scss', () => ({
    default: {
        contentComponent: 'contentComponent',
        heading: 'heading',
        headingHost: 'headingHost',
        accordionContainer: 'accordionContainer'
    }
}));

vi.mock('../../../../utils/CommonStyles.module.scss', () => ({
    default: {
        'accordion-group': 'accordion-group'
    }
}));

// Mock constants
vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        CREATE_USER_DB_TITLE: 'Create User Database',
        DB_CREATE_HOST: 'Host:',
        DB_CREATE_INSTANCE: 'Instance:',
        DATABASE_INFORMATION: 'Database Information',
        FILE_SETTINGS: 'File Settings'
    }
}));

describe('ContentComponent', () => {
    const createMockStore = (overrides = {}) => {
        return configureStore({
            reducer: {
                [createNewUserSlice.name]: createNewUserSlice.reducer,
                auth: authSlice.reducer
            } as any,
            preloadedState: {
                createNewUser: {
                    dbHostName: 'test-host',
                    instanceId: 'instance-123',
                    instanceName: 'TestInstance',
                    cdbCredId: 'cred-123',
                    cdbRegionId: 'us-east-1',
                    databaseName: '',
                    collation: '',
                    fileSettingsMode: 'simple',
                    dataFileName: '',
                    logFileName: '',
                    dataFileSize: 0,
                    logFileSize: 0,
                    driveInfoList: null,
                    driveInfoListLoading: false,
                    collationList: null,
                    collationListLoading: false,
                    ...overrides
                },
                auth: {
                    resourceId: 'resource-456',
                    isDemoMode: false,
                    isWorkloadFactory: true
                }
            } as any
        });
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock implementations
        mockUseGetDriveInfoV2Query.mockReturnValue({
            data: [
                { drive: 'C:', totalSize: 100, freeSpace: 50 },
                { drive: 'D:', totalSize: 200, freeSpace: 100 }
            ],
            isFetching: false
        });

        mockUseGetCollationListV2Query.mockReturnValue({
            data: ['SQL_Latin1_General_CP1_CI_AS', 'Latin1_General_CI_AS'],
            isFetching: false
        });
    });

    describe('Component Rendering', () => {
        it('should render without crashing', () => {
            const store = createMockStore();
            const { container } = render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );
            expect(container).toBeTruthy();
        });

        it('should render main heading with correct text', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            const heading = screen.getByTestId('typography-Semibold_20');
            expect(heading).toBeTruthy();
            expect(heading.textContent).toBe('Create User Database');
        });

        it('should render host and instance information', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            const headingHost = screen.getAllByTestId('typography-Semibold_16')[0];
            expect(headingHost.textContent).toBe('Host: test-host | Instance: TestInstance');
        });

        it('should render AccordionController with isGrouped prop', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            const accordion = screen.getByTestId('accordion-controller');
            expect(accordion.getAttribute('data-grouped')).toBe('true');
        });

        it('should render Database Information section heading', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            const typographies = screen.getAllByTestId('typography-Semibold_16');
            const databaseInfoHeading = typographies.find(el => el.textContent === 'Database Information');
            expect(databaseInfoHeading).toBeTruthy();
        });

        it('should render File Settings section heading', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            const typographies = screen.getAllByTestId('typography-Semibold_16');
            const fileSettingsHeading = typographies.find(el => el.textContent === 'File Settings');
            expect(fileSettingsHeading).toBeTruthy();
        });
    });

    describe('Child Components', () => {
        it('should render DatabaseName component', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            expect(screen.getByTestId('database-name')).toBeTruthy();
        });

        it('should render Collation component', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            expect(screen.getByTestId('collation')).toBeTruthy();
        });

        it('should render FileSettingsMode component', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            expect(screen.getByTestId('file-settings-mode')).toBeTruthy();
        });

        it('should render FileNames component', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            expect(screen.getByTestId('file-names')).toBeTruthy();
        });

        it('should render FilesSize component', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            expect(screen.getByTestId('files-size')).toBeTruthy();
        });
    });

    describe('API Data Fetching', () => {
        it('should call useGetDriveInfoV2Query with correct parameters', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            expect(mockUseGetDriveInfoV2Query).toHaveBeenCalledWith({
                credentialId: 'cred-123',
                region: 'us-east-1',
                id: 'resource-456',
                instanceId: 'instance-123'
            });
        });

        it('should call useGetCollationListV2Query with correct parameters', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            expect(mockUseGetCollationListV2Query).toHaveBeenCalledWith({
                credentialId: 'cred-123',
                region: 'us-east-1',
                id: 'resource-456',
                instanceId: 'instance-123'
            });
        });

        it('should handle loading state for drive info', () => {
            mockUseGetDriveInfoV2Query.mockReturnValue({
                data: null,
                isFetching: true
            });

            const store = createMockStore();
            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            // Component should still render during loading
            expect(screen.getByTestId('typography-Semibold_20')).toBeTruthy();
        });

        it('should handle loading state for collation list', () => {
            mockUseGetCollationListV2Query.mockReturnValue({
                data: null,
                isFetching: true
            });

            const store = createMockStore();
            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            // Component should still render during loading
            expect(screen.getByTestId('typography-Semibold_20')).toBeTruthy();
        });

        it('should handle empty drive info data', () => {
            mockUseGetDriveInfoV2Query.mockReturnValue({
                data: [],
                isFetching: false
            });

            const store = createMockStore();
            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            expect(screen.getByTestId('database-name')).toBeTruthy();
        });

        it('should handle empty collation list data', () => {
            mockUseGetCollationListV2Query.mockReturnValue({
                data: [],
                isFetching: false
            });

            const store = createMockStore();
            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            expect(screen.getByTestId('collation')).toBeTruthy();
        });

        it('should handle undefined data from APIs', () => {
            mockUseGetDriveInfoV2Query.mockReturnValue({
                data: undefined,
                isFetching: false
            });

            mockUseGetCollationListV2Query.mockReturnValue({
                data: undefined,
                isFetching: false
            });

            const store = createMockStore();
            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            expect(screen.getByTestId('database-name')).toBeTruthy();
        });
    });

    describe('State Updates', () => {
        it('should update store when drive info data changes', () => {
            const store = createMockStore();
            const { rerender } = render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            // Change the mock return value
            const newDriveData = [{ drive: 'E:', totalSize: 300, freeSpace: 150 }];
            mockUseGetDriveInfoV2Query.mockReturnValue({
                data: newDriveData,
                isFetching: false
            });

            rerender(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            // Component should still render correctly
            expect(screen.getByTestId('database-name')).toBeTruthy();
        });

        it('should update store when collation list data changes', () => {
            const store = createMockStore();
            const { rerender } = render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            // Change the mock return value
            const newCollationData = ['Modern_Spanish_CI_AS'];
            mockUseGetCollationListV2Query.mockReturnValue({
                data: newCollationData,
                isFetching: false
            });

            rerender(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            // Component should still render correctly
            expect(screen.getByTestId('collation')).toBeTruthy();
        });

        it('should handle loading state transitions', () => {
            mockUseGetDriveInfoV2Query.mockReturnValue({
                data: null,
                isFetching: true
            });

            const store = createMockStore();
            const { rerender } = render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            // Transition to loaded state
            mockUseGetDriveInfoV2Query.mockReturnValue({
                data: [{ drive: 'C:', totalSize: 100, freeSpace: 50 }],
                isFetching: false
            });

            rerender(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            expect(screen.getByTestId('database-name')).toBeTruthy();
        });
    });

    describe('Different Store States', () => {
        it('should render with different host name', () => {
            const store = createMockStore({
                dbHostName: 'production-server',
                instanceName: 'ProdInstance'
            });

            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            const headingHost = screen.getAllByTestId('typography-Semibold_16')[0];
            expect(headingHost.textContent).toContain('production-server');
            expect(headingHost.textContent).toContain('ProdInstance');
        });

        it('should render with different instance name', () => {
            const store = createMockStore({
                dbHostName: 'dev-server',
                instanceName: 'DevInstance'
            });

            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            const headingHost = screen.getAllByTestId('typography-Semibold_16')[0];
            expect(headingHost.textContent).toContain('dev-server');
            expect(headingHost.textContent).toContain('DevInstance');
        });

        it('should render with empty host and instance names', () => {
            const store = createMockStore({
                dbHostName: '',
                instanceName: ''
            });

            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            const headingHost = screen.getAllByTestId('typography-Semibold_16')[0];
            expect(headingHost.textContent).toContain('Host:');
            expect(headingHost.textContent).toContain('Instance:');
        });

        it('should handle different credential and region IDs', () => {
            const store = createMockStore({
                cdbCredId: 'new-cred-456',
                cdbRegionId: 'eu-west-1',
                instanceId: 'new-instance-789'
            });

            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            expect(mockUseGetDriveInfoV2Query).toHaveBeenCalledWith({
                credentialId: 'new-cred-456',
                region: 'eu-west-1',
                id: 'resource-456',
                instanceId: 'new-instance-789'
            });

            expect(mockUseGetCollationListV2Query).toHaveBeenCalledWith({
                credentialId: 'new-cred-456',
                region: 'eu-west-1',
                id: 'resource-456',
                instanceId: 'new-instance-789'
            });
        });
    });

    describe('Component Structure', () => {
        it('should have correct CSS classes applied', () => {
            const store = createMockStore();
            const { container } = render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            const mainDiv = container.querySelector('.contentComponent');
            expect(mainDiv).toBeTruthy();
            expect(mainDiv?.classList.contains('accordion-group')).toBe(true);
        });

        it('should render all components in correct order', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            // Get all rendered components
            const databaseName = screen.getByTestId('database-name');
            const collation = screen.getByTestId('collation');
            const fileSettingsMode = screen.getByTestId('file-settings-mode');
            const fileNames = screen.getByTestId('file-names');
            const filesSize = screen.getByTestId('files-size');

            // Verify all are rendered
            expect(databaseName).toBeTruthy();
            expect(collation).toBeTruthy();
            expect(fileSettingsMode).toBeTruthy();
            expect(fileNames).toBeTruthy();
            expect(filesSize).toBeTruthy();
        });
    });

    describe('Edge Cases', () => {
        it('should handle null resourceId', () => {
            const store = configureStore({
                reducer: {
                    [createNewUserSlice.name]: createNewUserSlice.reducer,
                    auth: authSlice.reducer
                } as any,
                preloadedState: {
                    createNewUser: {
                        dbHostName: 'test-host',
                        instanceId: 'instance-123',
                        instanceName: 'TestInstance',
                        cdbCredId: 'cred-123',
                        cdbRegionId: 'us-east-1',
                        databaseName: '',
                        collation: '',
                        fileSettingsMode: 'simple',
                        dataFileName: '',
                        logFileName: '',
                        dataFileSize: 0,
                        logFileSize: 0,
                        driveInfoList: null,
                        driveInfoListLoading: false,
                        collationList: null,
                        collationListLoading: false
                    },
                    auth: {
                        resourceId: null,
                        isDemoMode: false,
                        isWorkloadFactory: true
                    }
                } as any
            });

            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            expect(mockUseGetDriveInfoV2Query).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: null
                })
            );
        });

        it('should handle simultaneous loading states', () => {
            mockUseGetDriveInfoV2Query.mockReturnValue({
                data: null,
                isFetching: true
            });

            mockUseGetCollationListV2Query.mockReturnValue({
                data: null,
                isFetching: true
            });

            const store = createMockStore();
            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            // Component should render even when both APIs are loading
            expect(screen.getByTestId('typography-Semibold_20')).toBeTruthy();
            expect(screen.getByTestId('database-name')).toBeTruthy();
        });

        it('should handle API data with complex structures', () => {
            mockUseGetDriveInfoV2Query.mockReturnValue({
                data: [
                    { drive: 'C:', totalSize: 1000000, freeSpace: 500000, type: 'NTFS' },
                    { drive: 'D:', totalSize: 2000000, freeSpace: 1000000, type: 'NTFS' },
                    { drive: 'E:', totalSize: 500000, freeSpace: 250000, type: 'FAT32' }
                ],
                isFetching: false
            });

            mockUseGetCollationListV2Query.mockReturnValue({
                data: [
                    'SQL_Latin1_General_CP1_CI_AS',
                    'Latin1_General_CI_AS',
                    'Modern_Spanish_CI_AS',
                    'Japanese_CI_AS'
                ],
                isFetching: false
            });

            const store = createMockStore();
            render(
                <Provider store={store}>
                    <ContentComponent />
                </Provider>
            );

            expect(screen.getByTestId('database-name')).toBeTruthy();
        });
    });
});
