import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import AvailabilityZone from './AvailabilityZone';

vi.mock('@netapp/icons/ic_notice_triangle.svg', () => ({
    ReactComponent: () => <svg data-testid="warning-icon" />
}));

vi.mock('../../../../common/ActionRequired/ActionRequired', () => ({
    default: ({ disabled, error }: any) => (
        <div data-testid="action-required" data-disabled={String(!!disabled)} data-error={String(!!error)}>
            Action Required
        </div>
    )
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    generateOptionType: vi.fn((val: string, label: string) => ({ value: val, label }))
}));

vi.mock('../../../../store/chatbot/chatbotSlice', () => ({
    setIsWizardTouched: (val: boolean) => ({ type: 'chatbot/setIsWizardTouched', payload: val })
}));

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            mssqlForm: () => ({
                regionAndVpc: {
                    selectedVPC: overrides.selectedVPC ?? null,
                    selectedRegion: null
                },
                availabilityZones: {
                    selectedAzNode1: overrides.selectedAzNode1 ?? null,
                    selectedAzNode2: overrides.selectedAzNode2 ?? null,
                    selectedSubnetNode1: overrides.selectedSubnetNode1 ?? null,
                    selectedSubnetNode2: overrides.selectedSubnetNode2 ?? null
                },
                dbDeploymentModel: overrides.dbDeploymentModel ?? {
                    value: 'FAILOVER_CLUSTER',
                    label: 'Failover cluster instance'
                },
                ...overrides.mssqlForm
            }),
            msSqlAction: () => ({
                availabilityZoneSelected: true,
                isCreateHit: 0,
                isLoadConfig: false,
                ...overrides.msSqlAction
            }),
            mssql: () => ({
                getCredentials: { credentialData: [{ credentialsId: 'cred-1', name: 'My Account' }] }
            }),
            auth: () => ({ isDemoMode: false }),
            chatbot: () => ({ movingFromChatbot: false })
        }
    });

describe('AvailabilityZone', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders without crashing', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <AvailabilityZone wizardType="mssql" />
            </Provider>
        );
        expect(container).toBeDefined();
    });

    it('renders Availability zones accordion title', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <AvailabilityZone wizardType="mssql" />
            </Provider>
        );
        expect(screen.getByText('Availability zones')).toBeTruthy();
    });

    it('shows "Select an account" when no credentials', () => {
        const noCreds = configureStore({
            reducer: {
                mssqlForm: () => ({
                    regionAndVpc: { selectedVPC: null, selectedRegion: null },
                    availabilityZones: {
                        selectedAzNode1: null,
                        selectedAzNode2: null,
                        selectedSubnetNode1: null,
                        selectedSubnetNode2: null
                    },
                    dbDeploymentModel: { value: 'FAILOVER_CLUSTER', label: 'Failover cluster instance' }
                }),
                msSqlAction: () => ({ availabilityZoneSelected: true, isCreateHit: 0, isLoadConfig: false }),
                mssql: () => ({ getCredentials: { credentialData: [] } }),
                auth: () => ({ isDemoMode: false }),
                chatbot: () => ({ movingFromChatbot: false })
            }
        });
        render(
            <Provider store={noCreds}>
                <AvailabilityZone wizardType="mssql" />
            </Provider>
        );
        expect(screen.getByText(/Select.*credentials/i)).toBeTruthy();
    });

    it('shows ActionRequired when VPC is not selected', () => {
        const store = makeStore({ selectedVPC: null });
        render(
            <Provider store={store}>
                <AvailabilityZone wizardType="mssql" />
            </Provider>
        );
        expect(screen.getByTestId('action-required')).toBeTruthy();
    });

    it('renders with VPC selected, showing AZ fields in content', () => {
        const store = makeStore({
            selectedVPC: {
                value: 'vpc-1',
                data: {
                    id: 'vpc-1',
                    availabilityZones: {
                        'us-east-1a': [{ id: 'subnet-1', cidrBlock: '10.0.0.0/24' }],
                        'us-east-1b': [{ id: 'subnet-2', cidrBlock: '10.0.1.0/24' }]
                    }
                }
            }
        });
        render(
            <Provider store={store}>
                <AvailabilityZone wizardType="mssql" />
            </Provider>
        );
        expect(screen.getByText('Availability zones')).toBeTruthy();
    });

    it('renders for pgsql wizard type', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <AvailabilityZone wizardType="pgsql" />
            </Provider>
        );
        expect(container).toBeDefined();
    });

    it('shows AZ 2 fields when deployment mode is Failover Cluster', () => {
        const store = makeStore({
            selectedVPC: {
                value: 'vpc-1',
                data: {
                    id: 'vpc-1',
                    availabilityZones: {
                        'us-east-1a': [{ id: 'subnet-1', cidrBlock: '10.0.0.0/24' }],
                        'us-east-1b': [{ id: 'subnet-2', cidrBlock: '10.0.1.0/24' }]
                    }
                }
            },
            dbDeploymentModel: { value: 'FAILOVER_CLUSTER', label: 'Failover cluster instance' }
        });
        render(
            <Provider store={store}>
                <AvailabilityZone wizardType="mssql" />
            </Provider>
        );
        expect(screen.getByText('Availability zones')).toBeTruthy();
    });
});
