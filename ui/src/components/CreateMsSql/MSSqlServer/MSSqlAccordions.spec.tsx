import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MSSqlAccordions from './MSSqlAccordions';
import { SELECT_CONFIG } from '../../../utils/appConstants';

// Mock all child components
vi.mock('@netapp/design-system', () => ({
    AccordionController: ({ children }: any) => <div data-testid="accordion-controller">{children}</div>,
    Typography: ({ children, variant, style, className }: any) => (
        <div data-testid="typography" data-variant={variant}>
            {children}
        </div>
    )
}));
vi.mock('../AwsSettings/AvailabilityZone/AvailabilityZone', () => ({
    default: () => <div data-testid="availability-zone" />
}));
vi.mock('../AwsSettings/AwsAccount/AwsAccount', () => ({ default: () => <div data-testid="aws-account" /> }));
vi.mock('../AwsSettings/RegionVpc/RegionVpc', () => ({ default: () => <div data-testid="region-vpc" /> }));
vi.mock('../AwsSettings/SecurityGroup/SecurityGroup', () => ({ default: () => <div data-testid="security-group" /> }));
vi.mock('../DeploymentModel/DatabaseDeploymentModel/DatabaseDeploymentModel', () => ({
    default: () => <div data-testid="deployment-model" />
}));
vi.mock('../ApplicationSettings/License/License', () => ({ default: () => <div data-testid="license" /> }));
vi.mock('../ApplicationSettings/DatabaseName/DatabaseName', () => ({ default: () => <div data-testid="db-name" /> }));
vi.mock('../ApplicationSettings/DatabaseCredentials/DatabaseCredentials', () => ({
    default: () => <div data-testid="db-credentials" />
}));
vi.mock('../Connectivity/KeyPair/KepPair', () => ({ default: () => <div data-testid="key-pair" /> }));
vi.mock('../Connectivity/ActiveDirectory/ActiveDirectory', () => ({
    default: () => <div data-testid="active-directory" />
}));
vi.mock('../InfrastructureSettings/InstanceType/InstanceType', () => ({
    default: () => <div data-testid="instance-type" />
}));
vi.mock('../InfrastructureSettings/FSXNSystem/FSxNSystem', () => ({
    default: () => <div data-testid="fsxn-system" />
}));
vi.mock('../InfrastructureSettings/StorageCapacity/StorageCapacity', () => ({
    default: () => <div data-testid="storage-capacity" />
}));
vi.mock('../InfrastructureSettings/ProvisionedIOPS/ProvisionedIOPS', () => ({
    default: () => <div data-testid="provisioned-iops" />
}));
vi.mock('../InfrastructureSettings/ThroughputCapacity/ThroughputCapacity', () => ({
    default: () => <div data-testid="throughput-capacity" />
}));
vi.mock('../InfrastructureSettings/Encryption/Encryption', () => ({
    default: () => <div data-testid="encryption" />
}));
vi.mock('../InfrastructureSettings/Tags/Tags', () => ({ default: () => <div data-testid="tags" /> }));
vi.mock('../InfrastructureSettings/SimpleNotificationService/SimpleNotificationService', () => ({
    default: () => <div data-testid="sns" />
}));
vi.mock('../InfrastructureSettings/CloudWatch/CloudWatch', () => ({
    default: () => <div data-testid="cloud-watch" />
}));
vi.mock('../Cost/EstimatedCost', () => ({ default: () => <div data-testid="estimated-cost" /> }));
vi.mock('../Cost/PreviewDefault/PreviewDefault', () => ({ default: () => <div data-testid="preview-default" /> }));
vi.mock('../InfrastructureSettings/ResourceRollBack/ResourceRollBack', () => ({
    default: () => <div data-testid="resource-rollback" />
}));
vi.mock('../ApplicationSettings/Collation/SqlServerCollation', () => ({
    default: () => <div data-testid="sql-collation" />
}));
vi.mock('../InfrastructureSettings/SnapshotPolicy/SnapshotPolicy', () => ({
    default: () => <div data-testid="snapshot-policy" />
}));

const makeStore = (selectConfig: string = SELECT_CONFIG.EASY_CREATE, vpcLoading = false) =>
    configureStore({
        reducer: {
            mssqlForm: () => ({ selectConfig }),
            mssql: () => ({ getVPCList: { vpcLoading } }),
            chatbot: () => ({})
        }
    });

describe('MSSqlAccordions', () => {
    it('renders core required components in easy create mode', () => {
        const store = makeStore(SELECT_CONFIG.EASY_CREATE);
        render(
            <Provider store={store}>
                <MSSqlAccordions />
            </Provider>
        );
        expect(screen.getByTestId('aws-account')).toBeTruthy();
        expect(screen.getByTestId('region-vpc')).toBeTruthy();
        expect(screen.getByTestId('availability-zone')).toBeTruthy();
        expect(screen.getByTestId('db-credentials')).toBeTruthy();
        expect(screen.getByTestId('key-pair')).toBeTruthy();
        expect(screen.getByTestId('active-directory')).toBeTruthy();
        expect(screen.getByTestId('storage-capacity')).toBeTruthy();
        expect(screen.getByTestId('fsxn-system')).toBeTruthy();
        expect(screen.getByTestId('estimated-cost')).toBeTruthy();
    });

    it('renders additional components in standard create mode', () => {
        const store = makeStore(SELECT_CONFIG.STANDARD_CREATE);
        render(
            <Provider store={store}>
                <MSSqlAccordions />
            </Provider>
        );
        expect(screen.getByTestId('deployment-model')).toBeTruthy();
        expect(screen.getByTestId('security-group')).toBeTruthy();
        expect(screen.getByTestId('license')).toBeTruthy();
        expect(screen.getByTestId('db-name')).toBeTruthy();
        expect(screen.getByTestId('sql-collation')).toBeTruthy();
        expect(screen.getByTestId('instance-type')).toBeTruthy();
        expect(screen.getByTestId('provisioned-iops')).toBeTruthy();
        expect(screen.getByTestId('throughput-capacity')).toBeTruthy();
        expect(screen.getByTestId('encryption')).toBeTruthy();
        expect(screen.getByTestId('tags')).toBeTruthy();
        expect(screen.getByTestId('sns')).toBeTruthy();
        expect(screen.getByTestId('cloud-watch')).toBeTruthy();
        expect(screen.getByTestId('resource-rollback')).toBeTruthy();
        expect(screen.getByTestId('snapshot-policy')).toBeTruthy();
    });

    it('does NOT render deployment model in easy create mode', () => {
        const store = makeStore(SELECT_CONFIG.EASY_CREATE);
        render(
            <Provider store={store}>
                <MSSqlAccordions />
            </Provider>
        );
        expect(screen.queryByTestId('deployment-model')).not.toBeInTheDocument();
    });

    it('renders PreviewDefault only in easy create mode', () => {
        const store = makeStore(SELECT_CONFIG.EASY_CREATE);
        render(
            <Provider store={store}>
                <MSSqlAccordions />
            </Provider>
        );
        expect(screen.getByTestId('preview-default')).toBeTruthy();
    });

    it('does NOT render PreviewDefault in standard create mode', () => {
        const store = makeStore(SELECT_CONFIG.STANDARD_CREATE);
        render(
            <Provider store={store}>
                <MSSqlAccordions />
            </Provider>
        );
        expect(screen.queryByTestId('preview-default')).not.toBeInTheDocument();
    });

    it('renders accordion controller wrapper', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <MSSqlAccordions />
            </Provider>
        );
        expect(screen.getByTestId('accordion-controller')).toBeTruthy();
    });
});
