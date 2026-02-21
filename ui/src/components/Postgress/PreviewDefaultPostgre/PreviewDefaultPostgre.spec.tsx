import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import PreviewDefaultPostgres from './PreviewDefaultPostgre';

// ---- DS component mocks -------------------------------------------------
vi.mock('@netapp/design-system', () => ({
    AccordionCard: ({ children, title, ValueContent }: any) => (
        <div data-testid="accordion-card">
            <div data-testid="accordion-title">{title}</div>
            {ValueContent && (
                <div data-testid="accordion-value">
                    <ValueContent />
                </div>
            )}
            {children}
        </div>
    ),
    AccordionCardContent: ({ children }: any) => <div data-testid="accordion-content">{children}</div>,
    Button: ({ children, onClick }: any) => (
        <button data-testid={`btn-${String(children).replace(/\s+/g, '-').toLowerCase()}`} onClick={onClick}>
            {children}
        </button>
    ),
    DsTypography: ({ children, variant }: any) => <span data-variant={variant}>{children}</span>,
    TooltipInfo: ({ children }: any) => <span data-testid="tooltip">{children}</span>,
    Typography: ({ children, variant }: any) => <div data-variant={variant}>{children}</div>,
    Table: ({ tableProps }: any) => (
        <div data-testid="table">
            {tableProps?.rows?.map((row: any) => (
                <div key={row.id} data-testid={`row-${row.id}`}>
                    <span data-testid={`row-name-${row.id}`}>{row.accordionName}</span>
                    <span data-testid={`row-default-${row.id}`}>{row.defaultValue}</span>
                    <span data-testid={`row-editable-${row.id}`}>{row.editable}</span>
                </div>
            ))}
        </div>
    ),
    useTable: ({ rows, columns }: any) => ({ rows, columns })
}));

vi.mock('../../../assets/action-required.svg', () => ({
    ReactComponent: () => <span data-testid="action-required-icon">!</span>
}));

vi.mock('./PreviewDefaultPostgre.module.scss', () => ({
    default: {
        'preview-default': 'preview-default',
        note: 'note',
        table: 'table',
        resourceContainer: 'resourceContainer'
    }
}));

vi.mock('../../../utils/CommonStyles.module.scss', () => ({
    default: { title: 'title', 'heading-content': 'heading-content' }
}));

vi.mock('../../../utils/appConstants', () => ({
    GENERAL: {
        OPERATING_SYSTEM: 'Operating system',
        DATABASE_DEPLOYMENT_MODEL: 'Database deployment model',
        POSTGRE_VERSON: 'PostgreSQL version',
        DATABASE_SERVER_NAME: 'Database Server name',
        INSTANCE_TYPE: 'DB Instance type',
        SNAPSHOT_POLICY: 'Snapshot policy',
        DAILY_RETENTION: 'Daily (Retention 7 days)',
        PROVISIONED_IOPS: 'Provisioned IOPS',
        AUTOMATIC: 'Automatic',
        THROUGHPUT_CAPACITY: 'Throughput capacity',
        ENCRYPTION: 'Encryption',
        TAGS: 'Tags',
        SIMPLE_NOTIFICATION_SERVICE: 'Simple Notification Service',
        PD_DISABLED: 'Disabled',
        CLOUD_WATCH_MONITORING: 'CloudWatch monitoring',
        ENABLED: 'Enabled',
        YES: 'Yes',
        NO: 'No',
        HIGH_AVAILABILITY: 'High availability',
        STANDALONE_INSTANCE: 'Standalone instance',
        PD_HEADER_TEXT: 'Using defaults listed below',
        PREVIEW_DEFAULT: 'Preview defaults',
        PREVIEW_DEFAULT_TEXT: 'To customize these values, switch to',
        PD_CREATE_SECURITY: 'Create new security group',
        PD_UPGRADED_MANUALLY: 'Upgraded manually',
        RESOURCE_ROLLBACK_TOOLTIP: 'Rollback tooltip',
        CONFIGURATION: 'Configuration',
        DEFAULT: 'Default',
        EDITABLE_AFTER: 'Editable after deployment',
        ENCRYPTION_SELECT_FROM_OTHER_ACCOUNT: 'Enter ARN from another account',
        FAILOVER_CLUSTER: 'Failover cluster instance (FCI)',
        SQL_SERVER_STANDARD_EDITION: 'SQL Server Standard Edition',
        SQL_SERVER_STANDARD: 'Standard',
        SQL_SERVER_2019_VERSION: '2019',
        SQL_SERVER_2019: 'SQL Server 2019',
        TERRAFORM: 'Terraform',
        CF_COPIED: '',
        CF_NOTICE: '',
        CF_DOWNLOAD: '',
        DEMO_TITLE: '',
        DEMO_CONTENT: '',
        CONTINUE: 'Continue'
    },
    SELECT_CONFIG: {
        SECURITY_GROUP: 'Security group',
        EASY_CREATE: 'Easy create',
        STANDARD_CREATE: 'Standard create',
        ADVANCED_CREATE: 'Advanced create',
        QUICK_CREATE: 'Quick create'
    },
    CODE_VIEWER: {
        REST_API: 'REST API',
        CLOUDFORMATION: 'CloudFormation',
        AWS_CLI: 'AWS CLI',
        TERRAFORM: 'Terraform',
        COPIED_TO_CLIPBOARD: 'Copied to clipboard',
        NO_DATA_MSG: 'No data',
        LOADING_CLOUD_FORMATION: 'Loading CloudFormation code',
        LOADING_TERRAFORM: 'Loading Terraform code',
        LOADING_REST_API: 'Loading REST API code',
        LOADING_AWS_CLI: 'Loading AWS CLI code'
    }
}));

vi.mock('../../../utils/consts', () => ({
    DEFAULT_MASTER_KEY: 'AWS managed key',
    SQL_DEPLOYMENT_MODE: { FAILOVER_CLUSTER_VALUE: 'fci', SINGLE_INSTANCE_VALUE: 'standalone' }
}));

const mockDispatch = vi.fn();
vi.mock('react-redux', async () => {
    const actual = await vi.importActual('react-redux');
    return { ...actual, useDispatch: () => mockDispatch };
});

vi.mock('../../../store/mssql/mssqlFormSlice', () => ({
    setCloudWatch: (val: any) => ({ type: 'mssqlForm/setCloudWatch', payload: val }),
    setDBVersion: (val: any) => ({ type: 'mssqlForm/setDBVersion', payload: val }),
    setSelectConfig: (val: any) => ({ type: 'mssqlForm/setSelectConfig', payload: val }),
    setSelectedDBDeploymentModel: (val: any) => ({ type: 'mssqlForm/setSelectedDBDeploymentModel', payload: val }),
    setSelectedDBEdition: (val: any) => ({ type: 'mssqlForm/setSelectedDBEdition', payload: val }),
    setSnapshotPolicyToggle: (val: any) => ({ type: 'mssqlForm/setSnapshotPolicyToggle', payload: val }),
    setSNSARN: (val: any) => ({ type: 'mssqlForm/setSNSARN', payload: val }),
    setSNSState: (val: any) => ({ type: 'mssqlForm/setSNSState', payload: val }),
    setTags: (val: any) => ({ type: 'mssqlForm/setTags', payload: val })
}));

vi.mock('../../../store/postgre/postgreFormSlice', () => ({
    setPostgreDeploymentType: (val: any) => ({ type: 'postgreForm/setPostgreDeploymentType', payload: val }),
    setPostgreOperatingSystem: (val: any) => ({ type: 'postgreForm/setPostgreOperatingSystem', payload: val }),
    setPostgreServerName: (val: any) => ({ type: 'postgreForm/setPostgreServerName', payload: val }),
    setPostgreVersion: (val: any) => ({ type: 'postgreForm/setPostgreVersion', payload: val })
}));

vi.mock('../../../store/workloadFactory/exploreSavingsSlice', () => ({
    setSelectedDeploymentModel: (val: any) => ({ type: 'exploreSavings/setSelectedDeploymentModel', payload: val })
}));

const mockSelectDefaultSecurityGroup = vi.fn();
const mockSelectDefaultInstanceType = vi.fn();
const mockSelectDefaultEncryption = vi.fn();
const mockSelectFsxIops = vi.fn();
const mockSelectFsxKmsKey = vi.fn();
const mockSelectFsxThroughput = vi.fn();

vi.mock('../../CreateMsSql/MSSqlServer/MSSqlUtils', () => ({
    selectDefaultEncryption: (...args: any[]) => mockSelectDefaultEncryption(...args),
    selectDefaultInstanceType: (...args: any[]) => mockSelectDefaultInstanceType(...args),
    selectDefaultSecurityGroup: (...args: any[]) => mockSelectDefaultSecurityGroup(...args),
    selectFsxIops: (...args: any[]) => mockSelectFsxIops(...args),
    selectFsxKmsKey: (...args: any[]) => mockSelectFsxKmsKey(...args),
    selectFsxThroughput: (...args: any[]) => mockSelectFsxThroughput(...args)
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    generatePGSQLOperatingSystem: () => ({ label: 'Amazon Linux 2023 AMI', value: 'Amazon Linux 2023 AMI' }),
    generateRandomPGSQLName: () => 'pgsql-random-123'
}));

// ---- Store factory -------------------------------------------------------
const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            mssqlForm: () => ({
                selectConfig: overrides.selectConfig ?? 'Standard create',
                instanceType: overrides.instanceType ?? { value: 't3.medium' },
                throughput: overrides.throughput ?? { value: '128 MBps' },
                provisionedIOPS: { IOPSValue: '3000' },
                fsxN: {
                    fsxNType: overrides.fsxNType ?? 'fsxn_new',
                    fsxNExistingName: overrides.fsxNExistingName ?? null
                },
                encryption: {
                    encryptionType: overrides.encryptionType ?? 'Select from your account',
                    encryptionArn: overrides.encryptionArn ?? ''
                }
            }),
            postgreForm: () => ({
                postgreServerName: overrides.postgreServerName ?? 'pgsqlserver',
                postgreOS: overrides.postgreOS ?? { value: 'Amazon Linux 2023 AMI' },
                postgreVersion: overrides.postgreVersion ?? { value: 'postgresql16' }
            }),
            mssql: () => ({
                getInstanceTypeList: { instanceTypeData: overrides.instanceTypeData ?? [] },
                getKmsList: { kmsData: overrides.kmsData ?? [] }
            })
        }
    });

describe('PreviewDefaultPostgres', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ---- Rendering ---------------------------------------------------------
    it('renders without crashing', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <PreviewDefaultPostgres />
            </Provider>
        );
        expect(container).toBeTruthy();
    });

    it('renders "Preview defaults" accordion title', () => {
        render(
            <Provider store={makeStore()}>
                <PreviewDefaultPostgres />
            </Provider>
        );
        expect(screen.getByText('Preview defaults')).toBeTruthy();
    });

    it('renders "Using defaults listed below" in ValueContent', () => {
        render(
            <Provider store={makeStore()}>
                <PreviewDefaultPostgres />
            </Provider>
        );
        expect(screen.getByTestId('accordion-value').textContent).toContain('Using defaults listed below');
    });

    it('renders the data table', () => {
        render(
            <Provider store={makeStore()}>
                <PreviewDefaultPostgres />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders ActionRequiredIcon in the note section', () => {
        render(
            <Provider store={makeStore()}>
                <PreviewDefaultPostgres />
            </Provider>
        );
        expect(screen.getByTestId('action-required-icon')).toBeTruthy();
    });

    it('renders "To customize these values, switch to" text', () => {
        render(
            <Provider store={makeStore()}>
                <PreviewDefaultPostgres />
            </Provider>
        );
        expect(screen.getByText(/To customize these values/)).toBeTruthy();
    });

    it('renders "Advanced create" button in note', () => {
        render(
            <Provider store={makeStore()}>
                <PreviewDefaultPostgres />
            </Provider>
        );
        expect(screen.getByTestId('btn-advanced-create')).toBeTruthy();
    });

    // ---- Table row data ----------------------------------------------------
    it('renders Security group row with correct default value', () => {
        render(
            <Provider store={makeStore()}>
                <PreviewDefaultPostgres />
            </Provider>
        );
        expect(screen.getByTestId('row-name-1').textContent).toBe('Security group');
        expect(screen.getByTestId('row-default-1').textContent).toBe('Create new security group');
    });

    it('renders Operating System row with postgreOS value from store', () => {
        render(
            <Provider store={makeStore({ postgreOS: { value: 'Amazon Linux 2023 AMI' } })}>
                <PreviewDefaultPostgres />
            </Provider>
        );
        expect(screen.getByTestId('row-name-2').textContent).toBe('Operating system');
        expect(screen.getByTestId('row-default-2').textContent).toBe('Amazon Linux 2023 AMI');
    });

    it('renders Database deployment model row', () => {
        render(
            <Provider store={makeStore()}>
                <PreviewDefaultPostgres />
            </Provider>
        );
        expect(screen.getByTestId('row-name-3').textContent).toBe('Database deployment model');
        expect(screen.getByTestId('row-default-3').textContent).toBe('High availability');
    });

    it('renders PostgreSQL version row with postgreVersion value from store', () => {
        render(
            <Provider store={makeStore({ postgreVersion: { value: 'postgresql16' } })}>
                <PreviewDefaultPostgres />
            </Provider>
        );
        expect(screen.getByTestId('row-name-5').textContent).toBe('PostgreSQL version');
        expect(screen.getByTestId('row-default-5').textContent).toBe('postgresql16');
    });

    it('renders Database Server name row with dbName from store', () => {
        render(
            <Provider store={makeStore({ postgreServerName: 'my-server' })}>
                <PreviewDefaultPostgres />
            </Provider>
        );
        expect(screen.getByTestId('row-name-7').textContent).toBe('Database Server name');
        expect(screen.getByTestId('row-default-7').textContent).toBe('my-server');
    });

    it('renders Encryption row: shows AWS managed key when encryptionType is not ARN', () => {
        render(
            <Provider store={makeStore({ encryptionType: 'Select from your account' })}>
                <PreviewDefaultPostgres />
            </Provider>
        );
        expect(screen.getByTestId('row-name-12').textContent).toBe('Encryption');
        expect(screen.getByTestId('row-default-12').textContent).toBe('AWS managed key');
    });

    it('renders Encryption row: shows ARN value when encryptionType is "Enter ARN from another account"', () => {
        render(
            <Provider
                store={makeStore({
                    encryptionType: 'Enter ARN from another account',
                    encryptionArn: 'arn:aws:kms:us-east-1:123:key/my-key'
                })}
            >
                <PreviewDefaultPostgres />
            </Provider>
        );
        expect(screen.getByTestId('row-default-12').textContent).toBe('arn:aws:kms:us-east-1:123:key/my-key');
    });

    it('renders Throughput capacity row from store', () => {
        render(
            <Provider store={makeStore({ throughput: { value: '256 MBps' } })}>
                <PreviewDefaultPostgres />
            </Provider>
        );
        expect(screen.getByTestId('row-default-11').textContent).toBe('256 MBps');
    });

    it('renders Snapshot policy row', () => {
        render(
            <Provider store={makeStore()}>
                <PreviewDefaultPostgres />
            </Provider>
        );
        expect(screen.getByTestId('row-name-18').textContent).toBe('Snapshot policy');
        expect(screen.getByTestId('row-default-18').textContent).toBe('Daily (Retention 7 days)');
    });

    it('renders Resource rollback row', () => {
        render(
            <Provider store={makeStore()}>
                <PreviewDefaultPostgres />
            </Provider>
        );
        expect(screen.getByTestId('row-name-16').textContent).toBe('Resource rollback');
        expect(screen.getByTestId('row-default-16').textContent).toBe('Disabled');
    });

    // ---- handleConfig (Advanced create button) ------------------------------
    it('clicking "Advanced create" dispatches setSelectConfig(STANDARD_CREATE)', () => {
        render(
            <Provider store={makeStore()}>
                <PreviewDefaultPostgres />
            </Provider>
        );

        fireEvent.click(screen.getByTestId('btn-advanced-create'));

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'mssqlForm/setSelectConfig', payload: 'Standard create' })
        );
    });

    // ---- useEffect: selectedConfig = 'Easy create' --------------------------
    describe('useEffect when selectConfig is "Easy create"', () => {
        it('calls selectDefaultSecurityGroup', () => {
            render(
                <Provider store={makeStore({ selectConfig: 'Easy create' })}>
                    <PreviewDefaultPostgres />
                </Provider>
            );
            expect(mockSelectDefaultSecurityGroup).toHaveBeenCalled();
        });

        it('dispatches setSelectedDBDeploymentModel with FAILOVER_CLUSTER', () => {
            render(
                <Provider store={makeStore({ selectConfig: 'Easy create' })}>
                    <PreviewDefaultPostgres />
                </Provider>
            );
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'mssqlForm/setSelectedDBDeploymentModel' })
            );
        });

        it('dispatches setPostgreOperatingSystem', () => {
            render(
                <Provider store={makeStore({ selectConfig: 'Easy create' })}>
                    <PreviewDefaultPostgres />
                </Provider>
            );
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'postgreForm/setPostgreOperatingSystem' })
            );
        });

        it('dispatches setPostgreDeploymentType with STANDALONE_INSTANCE', () => {
            render(
                <Provider store={makeStore({ selectConfig: 'Easy create' })}>
                    <PreviewDefaultPostgres />
                </Provider>
            );
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'postgreForm/setPostgreDeploymentType',
                    payload: 'Standalone instance'
                })
            );
        });

        it('dispatches setPostgreVersion with postgresql16', () => {
            render(
                <Provider store={makeStore({ selectConfig: 'Easy create' })}>
                    <PreviewDefaultPostgres />
                </Provider>
            );
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'postgreForm/setPostgreVersion',
                    payload: expect.objectContaining({ value: 'postgresql16' })
                })
            );
        });

        it('dispatches setPostgreServerName with generated name', () => {
            render(
                <Provider store={makeStore({ selectConfig: 'Easy create' })}>
                    <PreviewDefaultPostgres />
                </Provider>
            );
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'postgreForm/setPostgreServerName',
                    payload: 'pgsql-random-123'
                })
            );
        });

        it('dispatches setTags with initial empty tag', () => {
            render(
                <Provider store={makeStore({ selectConfig: 'Easy create' })}>
                    <PreviewDefaultPostgres />
                </Provider>
            );
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'mssqlForm/setTags',
                    payload: [{ key: '', value: '' }]
                })
            );
        });

        it('dispatches setSNSState(false)', () => {
            render(
                <Provider store={makeStore({ selectConfig: 'Easy create' })}>
                    <PreviewDefaultPostgres />
                </Provider>
            );
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'mssqlForm/setSNSState', payload: false })
            );
        });

        it('dispatches setSNSARN("")', () => {
            render(
                <Provider store={makeStore({ selectConfig: 'Easy create' })}>
                    <PreviewDefaultPostgres />
                </Provider>
            );
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'mssqlForm/setSNSARN', payload: '' })
            );
        });

        it('dispatches setCloudWatch(true)', () => {
            render(
                <Provider store={makeStore({ selectConfig: 'Easy create' })}>
                    <PreviewDefaultPostgres />
                </Provider>
            );
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'mssqlForm/setCloudWatch', payload: true })
            );
        });

        it('dispatches setSnapshotPolicyToggle(true)', () => {
            render(
                <Provider store={makeStore({ selectConfig: 'Easy create' })}>
                    <PreviewDefaultPostgres />
                </Provider>
            );
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'mssqlForm/setSnapshotPolicyToggle', payload: true })
            );
        });

        it('calls selectDefaultInstanceType with instanceTypeData', () => {
            const instanceTypeData = [{ id: 'i1', value: 't3.medium' }];
            render(
                <Provider store={makeStore({ selectConfig: 'Easy create', instanceTypeData })}>
                    <PreviewDefaultPostgres />
                </Provider>
            );
            expect(mockSelectDefaultInstanceType).toHaveBeenCalledWith(instanceTypeData, mockDispatch);
        });

        it('calls selectDefaultEncryption with kmsData', () => {
            const kmsData = [{ id: 'k1' }];
            render(
                <Provider store={makeStore({ selectConfig: 'Easy create', kmsData })}>
                    <PreviewDefaultPostgres />
                </Provider>
            );
            expect(mockSelectDefaultEncryption).toHaveBeenCalledWith(kmsData, mockDispatch);
        });
    });

    describe('useEffect when selectConfig is NOT "Easy create"', () => {
        it('does NOT call selectDefaultSecurityGroup for Standard create', () => {
            render(
                <Provider store={makeStore({ selectConfig: 'Standard create' })}>
                    <PreviewDefaultPostgres />
                </Provider>
            );
            expect(mockSelectDefaultSecurityGroup).not.toHaveBeenCalled();
        });

        it('does NOT dispatch setSelectedDBDeploymentModel for Quick create', () => {
            render(
                <Provider store={makeStore({ selectConfig: 'Quick create' })}>
                    <PreviewDefaultPostgres />
                </Provider>
            );
            const calls = mockDispatch.mock.calls.filter(
                (c: any) => c[0]?.type === 'mssqlForm/setSelectedDBDeploymentModel'
            );
            expect(calls.length).toBe(0);
        });
    });

    // ---- useEffect: FSxN changes -------------------------------------------
    describe('useEffect on FSxN type/name changes', () => {
        it('calls selectFsxThroughput with fsxNType and fsxNExistingName', () => {
            render(
                <Provider store={makeStore({ fsxNType: 'fsxn_existing', fsxNExistingName: 'my-fsx' })}>
                    <PreviewDefaultPostgres />
                </Provider>
            );
            expect(mockSelectFsxThroughput).toHaveBeenCalledWith('fsxn_existing', 'my-fsx', '128 MBps', mockDispatch);
        });

        it('calls selectFsxIops with fsxNType and fsxNExistingName', () => {
            render(
                <Provider store={makeStore({ fsxNType: 'fsxn_new', fsxNExistingName: null })}>
                    <PreviewDefaultPostgres />
                </Provider>
            );
            expect(mockSelectFsxIops).toHaveBeenCalledWith('fsxn_new', null, mockDispatch);
        });

        it('calls selectFsxKmsKey with fsxNType and fsxNExistingName', () => {
            render(
                <Provider store={makeStore({ fsxNType: 'fsxn_new', fsxNExistingName: null })}>
                    <PreviewDefaultPostgres />
                </Provider>
            );
            expect(mockSelectFsxKmsKey).toHaveBeenCalledWith('fsxn_new', null, mockDispatch);
        });
    });
});
