import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import PostgressLayout from './PostgressLayout';

// Mock all child components
vi.mock('../../CreateMsSql/AwsSettings/AwsAccount/AwsAccount', () => ({
    default: () => <div data-testid="aws-account">AwsAccount</div>
}));
vi.mock('../../CreateMsSql/AwsSettings/RegionVpc/RegionVpc', () => ({
    default: () => <div data-testid="region-vpc">RegionVpc</div>
}));
vi.mock('../../CreateMsSql/AwsSettings/AvailabilityZone/AvailabilityZone', () => ({
    default: ({ wizardType }: any) => (
        <div data-testid="availability-zone" data-wizard={wizardType}>
            AvailabilityZone
        </div>
    )
}));
vi.mock('../../CreateMsSql/AwsSettings/SecurityGroup/SecurityGroup', () => ({
    default: () => <div data-testid="security-group">SecurityGroup</div>
}));
vi.mock('../../CreateMsSql/ApplicationSettings/DatabaseCredentials/DatabaseCredentials', () => ({
    default: ({ wizardType }: any) => (
        <div data-testid="database-credentials" data-wizard={wizardType}>
            DatabaseCredentials
        </div>
    )
}));
vi.mock('../../CreateMsSql/Connectivity/KeyPair/KepPair', () => ({
    default: () => <div data-testid="key-pair">KeyPair</div>
}));
vi.mock('../../CreateMsSql/InfrastructureSettings/InstanceType/InstanceType', () => ({
    default: () => <div data-testid="instance-type">InstanceType</div>
}));
vi.mock('../../CreateMsSql/InfrastructureSettings/FSXNSystem/FSxNSystem', () => ({
    default: ({ wizardType }: any) => (
        <div data-testid="fsxn-system" data-wizard={wizardType}>
            FSxNSystem
        </div>
    )
}));
vi.mock('../../CreateMsSql/InfrastructureSettings/SnapshotPolicy/SnapshotPolicy', () => ({
    default: () => <div data-testid="snapshot-policy">SnapshotPolicy</div>
}));
vi.mock('../../CreateMsSql/InfrastructureSettings/ProvisionedIOPS/ProvisionedIOPS', () => ({
    default: () => <div data-testid="provisioned-iops">ProvisionedIOPS</div>
}));
vi.mock('../../CreateMsSql/InfrastructureSettings/ThroughputCapacity/ThroughputCapacity', () => ({
    default: () => <div data-testid="throughput-capacity">ThroughputCapacity</div>
}));
vi.mock('../../CreateMsSql/InfrastructureSettings/Encryption/Encryption', () => ({
    default: () => <div data-testid="encryption">Encryption</div>
}));
vi.mock('../../CreateMsSql/InfrastructureSettings/Tags/Tags', () => ({
    default: () => <div data-testid="tags">Tags</div>
}));
vi.mock('../../CreateMsSql/InfrastructureSettings/SimpleNotificationService/SimpleNotificationService', () => ({
    default: () => <div data-testid="sns">SNS</div>
}));
vi.mock('../../CreateMsSql/InfrastructureSettings/CloudWatch/CloudWatch', () => ({
    default: ({ wizardType }: any) => (
        <div data-testid="cloudwatch" data-wizard={wizardType}>
            CloudWatch
        </div>
    )
}));
vi.mock('../../CreateMsSql/InfrastructureSettings/ResourceRollBack/ResourceRollBack', () => ({
    default: () => <div data-testid="resource-rollback">ResourceRollBack</div>
}));
vi.mock('../../CreateMsSql/InfrastructureSettings/StorageCapacity/StorageCapacity', () => ({
    default: ({ wizardType }: any) => (
        <div data-testid="storage-capacity" data-wizard={wizardType}>
            StorageCapacity
        </div>
    )
}));
vi.mock('../../CreateMsSql/SelectConfig/SelectConfig', () => ({
    default: ({ isDisabled, wizardType }: any) => (
        <div data-testid="select-config" data-disabled={String(!!isDisabled)} data-wizard={wizardType}>
            SelectConfig
        </div>
    )
}));
vi.mock('../../CreateMsSql/Cost/EstimatedCost', () => ({
    default: ({ wizardType }: any) => (
        <div data-testid="estimated-cost" data-wizard={wizardType}>
            EstimatedCost
        </div>
    )
}));
vi.mock('../PostgreDeploymentModel/PostgreDeploymentModel', () => ({
    default: () => <div data-testid="postgre-deployment-model">PostgreDeploymentModel</div>
}));
vi.mock('../PostgreOperatingSystem/PostgreOperatingSystem', () => ({
    default: () => <div data-testid="postgre-os">PostgreOperatingSystem</div>
}));
vi.mock('../PostgreVersion/PostgreVersion', () => ({
    default: () => <div data-testid="postgre-version">PostgreVersion</div>
}));
vi.mock('../PostgreServerName/PostgreServerName', () => ({
    default: () => <div data-testid="postgre-server-name">PostgreServerName</div>
}));
vi.mock('../PreviewDefaultPostgre/PreviewDefaultPostgre', () => ({
    default: () => <div data-testid="preview-default-postgre">PreviewDefaultPostgre</div>
}));

vi.mock('@netapp/design-system', () => ({
    AccordionController: ({ children, isGrouped }: any) => (
        <div data-testid="accordion-controller" data-grouped={String(!!isGrouped)}>
            {children}
        </div>
    ),
    Typography: ({ children, variant, style, className }: any) => (
        <div data-testid="typography" data-variant={variant}>
            {children}
        </div>
    )
}));

vi.mock('./PostgressLayout.module.scss', () => ({
    default: {
        'aws-settings': 'aws-settings',
        protectLayout: 'protectLayout',
        'header-buttons': 'header-buttons',
        'pgsql-availability-zone': 'pgsql-availability-zone',
        adjustMargin: 'adjustMargin'
    }
}));

vi.mock('../../../utils/CommonStyles.module.scss', () => ({
    default: { 'accordion-group': 'accordion-group' }
}));

vi.mock('../../../utils/appConstants', () => ({
    GENERAL: {
        DEPLOYMENT_MODEL: 'Deployment model',
        LANDING_ZONE: 'Landing zone',
        APPLICATION_SETTINGS: 'Application settings',
        CONNECTIVITY: 'Connectivity',
        INFRASTRUCTURE_SETTINGS: 'Infrastructure settings',
        SUMMARY: 'Summary'
    },
    SELECT_CONFIG: {
        STANDARD_CREATE: 'Standard create',
        EASY_CREATE: 'Quick create',
        ADVANCED_CREATE: 'Advanced create'
    }
}));

vi.mock('../../../utils/consts', () => ({
    DBType: { POSTGRESQL: 'postgresql' },
    WIZARD_TYPE: { PGSQL: 'pgsql' }
}));

vi.mock('../../../store/postgre/postgreFormSlice', () => ({
    setSelectedDatabaseType: (val: any) => ({ type: 'postgreForm/setSelectedDatabaseType', payload: val })
}));

const makeStore = (selectConfig: string) =>
    configureStore({
        reducer: {
            mssqlForm: () => ({ selectConfig })
        }
    });

describe('PostgressLayout', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders without crashing', () => {
        const { container } = render(
            <Provider store={makeStore('Standard create')}>
                <PostgressLayout />
            </Provider>
        );
        expect(container).toBeTruthy();
    });

    it('dispatches setSelectedDatabaseType on mount', async () => {
        const store = makeStore('Standard create');
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <PostgressLayout />
            </Provider>
        );
        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'postgreForm/setSelectedDatabaseType', payload: 'postgresql' })
        );
    });

    it('renders SelectConfig with wizard type pgsql', () => {
        render(
            <Provider store={makeStore('Standard create')}>
                <PostgressLayout />
            </Provider>
        );
        const selectConfig = screen.getByTestId('select-config');
        expect(selectConfig.getAttribute('data-wizard')).toBe('pgsql');
    });

    it('renders AwsAccount, RegionVpc always visible', () => {
        render(
            <Provider store={makeStore('Standard create')}>
                <PostgressLayout />
            </Provider>
        );
        expect(screen.getByTestId('aws-account')).toBeTruthy();
        expect(screen.getByTestId('region-vpc')).toBeTruthy();
    });

    it('renders KeyPair always visible', () => {
        render(
            <Provider store={makeStore('Standard create')}>
                <PostgressLayout />
            </Provider>
        );
        expect(screen.getByTestId('key-pair')).toBeTruthy();
    });

    it('renders DatabaseCredentials always visible', () => {
        render(
            <Provider store={makeStore('Standard create')}>
                <PostgressLayout />
            </Provider>
        );
        expect(screen.getByTestId('database-credentials')).toBeTruthy();
    });

    it('renders FSxNSystem always visible', () => {
        render(
            <Provider store={makeStore('Standard create')}>
                <PostgressLayout />
            </Provider>
        );
        expect(screen.getByTestId('fsxn-system')).toBeTruthy();
    });

    it('renders EstimatedCost always visible', () => {
        render(
            <Provider store={makeStore('Standard create')}>
                <PostgressLayout />
            </Provider>
        );
        expect(screen.getByTestId('estimated-cost')).toBeTruthy();
    });

    describe('Standard create mode', () => {
        it('renders PostgreDeploymentModel in Standard create', () => {
            render(
                <Provider store={makeStore('Standard create')}>
                    <PostgressLayout />
                </Provider>
            );
            expect(screen.getByTestId('postgre-deployment-model')).toBeTruthy();
        });

        it('renders SecurityGroup in Standard create', () => {
            render(
                <Provider store={makeStore('Standard create')}>
                    <PostgressLayout />
                </Provider>
            );
            expect(screen.getByTestId('security-group')).toBeTruthy();
        });

        it('renders PostgreOperatingSystem in Standard create', () => {
            render(
                <Provider store={makeStore('Standard create')}>
                    <PostgressLayout />
                </Provider>
            );
            expect(screen.getByTestId('postgre-os')).toBeTruthy();
        });

        it('renders PostgreVersion in Standard create', () => {
            render(
                <Provider store={makeStore('Standard create')}>
                    <PostgressLayout />
                </Provider>
            );
            expect(screen.getByTestId('postgre-version')).toBeTruthy();
        });

        it('renders PostgreServerName in Standard create', () => {
            render(
                <Provider store={makeStore('Standard create')}>
                    <PostgressLayout />
                </Provider>
            );
            expect(screen.getByTestId('postgre-server-name')).toBeTruthy();
        });

        it('renders InstanceType in Standard create', () => {
            render(
                <Provider store={makeStore('Standard create')}>
                    <PostgressLayout />
                </Provider>
            );
            expect(screen.getByTestId('instance-type')).toBeTruthy();
        });

        it('renders SnapshotPolicy in Standard create', () => {
            render(
                <Provider store={makeStore('Standard create')}>
                    <PostgressLayout />
                </Provider>
            );
            expect(screen.getByTestId('snapshot-policy')).toBeTruthy();
        });

        it('renders ProvisionedIOPS, ThroughputCapacity, Encryption, Tags in Standard create', () => {
            render(
                <Provider store={makeStore('Standard create')}>
                    <PostgressLayout />
                </Provider>
            );
            expect(screen.getByTestId('provisioned-iops')).toBeTruthy();
            expect(screen.getByTestId('throughput-capacity')).toBeTruthy();
            expect(screen.getByTestId('encryption')).toBeTruthy();
            expect(screen.getByTestId('tags')).toBeTruthy();
        });

        it('renders SNS, CloudWatch, ResourceRollBack in Standard create', () => {
            render(
                <Provider store={makeStore('Standard create')}>
                    <PostgressLayout />
                </Provider>
            );
            expect(screen.getByTestId('sns')).toBeTruthy();
            expect(screen.getByTestId('cloudwatch')).toBeTruthy();
            expect(screen.getByTestId('resource-rollback')).toBeTruthy();
        });

        it('does NOT render PreviewDefaultPostgre in Standard create', () => {
            render(
                <Provider store={makeStore('Standard create')}>
                    <PostgressLayout />
                </Provider>
            );
            expect(screen.queryByTestId('preview-default-postgre')).toBeNull();
        });

        it('renders all section headings in Standard create', () => {
            render(
                <Provider store={makeStore('Standard create')}>
                    <PostgressLayout />
                </Provider>
            );
            expect(screen.getByText('Deployment model')).toBeTruthy();
            expect(screen.getByText('Landing zone')).toBeTruthy();
            expect(screen.getByText('Application settings')).toBeTruthy();
            expect(screen.getByText('Connectivity')).toBeTruthy();
            expect(screen.getByText('Infrastructure settings')).toBeTruthy();
            expect(screen.getByText('Summary')).toBeTruthy();
        });
    });

    describe('Easy/Quick create mode', () => {
        it('does NOT render PostgreDeploymentModel in Quick create', () => {
            render(
                <Provider store={makeStore('Quick create')}>
                    <PostgressLayout />
                </Provider>
            );
            expect(screen.queryByTestId('postgre-deployment-model')).toBeNull();
        });

        it('does NOT render SecurityGroup in Quick create', () => {
            render(
                <Provider store={makeStore('Quick create')}>
                    <PostgressLayout />
                </Provider>
            );
            expect(screen.queryByTestId('security-group')).toBeNull();
        });

        it('does NOT render PostgreOperatingSystem in Quick create', () => {
            render(
                <Provider store={makeStore('Quick create')}>
                    <PostgressLayout />
                </Provider>
            );
            expect(screen.queryByTestId('postgre-os')).toBeNull();
        });

        it('does NOT render InstanceType in Quick create', () => {
            render(
                <Provider store={makeStore('Quick create')}>
                    <PostgressLayout />
                </Provider>
            );
            expect(screen.queryByTestId('instance-type')).toBeNull();
        });

        it('renders PreviewDefaultPostgre in Quick create', () => {
            render(
                <Provider store={makeStore('Quick create')}>
                    <PostgressLayout />
                </Provider>
            );
            expect(screen.getByTestId('preview-default-postgre')).toBeTruthy();
        });

        it('does NOT render Deployment model heading in Quick create', () => {
            render(
                <Provider store={makeStore('Quick create')}>
                    <PostgressLayout />
                </Provider>
            );
            expect(screen.queryByText('Deployment model')).toBeNull();
        });
    });
});
