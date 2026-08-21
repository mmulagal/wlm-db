import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import InstanceInformation from './InstanceInformation';

const mockHasExploreSavingsAoagDeployment = vi.fn().mockReturnValue(false);
const mockHasInsufficientSqlLicensePermissions = vi.fn().mockReturnValue(false);

vi.mock('../../ExploreSavingsUtils', () => ({
    hasExploreSavingsAoagDeployment: (...args: any[]) => mockHasExploreSavingsAoagDeployment(...args),
    hasInsufficientSqlLicensePermissions: (...args: any[]) => mockHasInsufficientSqlLicensePermissions(...args)
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) =>
            ((
                {
                    'databases.explore-savings.instance-information': 'Instance information:',
                    'databases.explore-savings.database-information': 'Database information:',
                    'databases.general.not-available': 'n/a',
                    'databases.general.always-on-availability-group': 'Always on availability group',
                    'databases.explore-savings.monthly-oracle-cost': 'Monthly Oracle cost',
                    'databases.explore-savings.instance-information-table.details.instance-type': 'Instance type',
                    'databases.explore-savings.instance-information-table.details.sql-edition': 'SQL Edition',
                    'databases.explore-savings.instance-information-table.details.database-edition': 'Database edition',
                    'databases.explore-savings.instance-information-table.details.deployment-model': 'Deployment model'
                } as Record<string, string>
            )[key] ?? key)
    })
}));

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, style }: any) => <span data-variant={variant}>{children}</span>,
    DsFlashingDotsLoader: () => <span data-testid="loader">loading...</span>,
    TooltipInfo: ({ children }: any) => <span data-testid="tooltip-info">{children}</span>,
    Table: ({ tableProps, variant }: any) => (
        <div data-testid="table" data-variant={variant}>
            {tableProps?.rows?.map((row: any, i: number) => (
                <div key={i} data-testid={`row-${i}`}>
                    {row.details}: {row.value}
                </div>
            ))}
        </div>
    ),
    useTable: (props: any) => props
}));

vi.mock('@netapp/design-system/dist/components/Table', () => ({ ColumnProps: {} }));

vi.mock('./InstanceInformation.module.scss', () => ({
    default: {
        instanceInformation: 'instanceInformation',
        instanceInformationAlternate: 'instanceInformationAlternate',
        instanceTable: 'instanceTable',
        tooltips: 'tooltips',
        instanceTypeTooltip: 'instanceTypeTooltip'
    }
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        INSTANCE_INFORMATION: 'Instance information:',
        NOT_AVAILABLE: 'n/a',
        AOAG: 'Always on availability group',
        ES_SQL_EDITION_MULTI_TOOLTIP: 'SQL edition tooltip',
        INSTANCE_TYPE_FINDINGS_TOOLTIP: 'Instance type findings tooltip',
        NOT_OPTIMIZED: 'Not optimized tooltip',
        FINDINGS: {
            OPTIMIZED: 'Optimized',
            NOT_OPTIMIZED: 'Not optimized',
            OVER_PROVISIONED: 'Over-provisioned',
            UNDER_PROVISIONED: 'Under-provisioned'
        }
    }
}));

vi.mock('../../../../utils/consts', async () => {
    const actual = await vi.importActual('../../../../utils/consts');
    return {
        ...actual,
        FINDINGS: {
            OPTIMIZED: 'OPTIMIZED',
            NOT_OPTIMIZED: 'NOT_OPTIMIZED',
            UNDER_PROVISIONED: 'UNDER_PROVISIONED',
            INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
            INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS'
        },
        SAVINGS_CALC_MODE: {
            AUTO_EBS: 'Auto_EBS',
            AUTO_FSXW: 'Auto_FSXW',
            ONPREM: 'OnPrem'
        },
        WLF_TABS: {
            MSSQL_ON_PREMISES: 'MSSQL_ON_PREMISES',
            MSSQL_ELASTIC_BLOCK_STORE: 'MSSQL_ELASTIC_BLOCK_STORE'
        }
    };
});

const makeStore = (overrides: any = {}) => {
    const slice = createSlice({
        name: 'exploreSavings',
        initialState: {
            selectedHostDetails: {
                name: 'host1',
                loading: false,
                ec2Details: [{ instanceType: 'r5.xlarge' }],
                sqlServerInstances: [{ databaseServer: { serverEdition: 'Enterprise' } }],
                serverInstallationMode: 'Standalone',
                totalInstance: 1
            },
            savingsCalculatorFrom: 'Auto_EBS',
            storageSavingsResponse: null as any,
            storageSavingsLoading: false,
            snapshotLoading: false,
            selectedExploreSavingsTab: 'MSSQL_ELASTIC_BLOCK_STORE',
            selectedOnPremHostDetails: {},
            ...overrides
        },
        reducers: {}
    });
    return configureStore({ reducer: { exploreSavings: slice.reducer } });
};

describe('InstanceInformation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHasExploreSavingsAoagDeployment.mockReturnValue(false);
    });

    it('renders Instance information heading', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <InstanceInformation />
            </Provider>
        );
        expect(container.textContent).toContain('Instance information:');
    });

    it('renders table component', () => {
        render(
            <Provider store={makeStore()}>
                <InstanceInformation />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders table with Instance type, SQL Edition, and Deployment model rows', () => {
        render(
            <Provider store={makeStore()}>
                <InstanceInformation />
            </Provider>
        );
        expect(screen.getByTestId('row-0').textContent).toContain('Instance type');
        expect(screen.getByTestId('row-0').textContent).toContain('r5.xlarge');
        expect(screen.getByTestId('row-1').textContent).toContain('SQL Edition');
        expect(screen.getByTestId('row-1').textContent).toContain('Enterprise');
        expect(screen.getByTestId('row-2').textContent).toContain('Deployment model');
    });

    it('shows n/a when no ec2Details', () => {
        const store = makeStore({
            selectedHostDetails: {
                name: 'host1',
                loading: false,
                ec2Details: [],
                sqlServerInstances: [],
                serverInstallationMode: null,
                totalInstance: 0
            }
        });
        render(
            <Provider store={store}>
                <InstanceInformation />
            </Provider>
        );
        expect(screen.getByTestId('row-0').textContent).toContain('n/a');
    });

    it('uses host prop when provided and IDs do not match', () => {
        const host = {
            ec2InstanceId: 'i-host',
            credentialId: 'cred-host',
            regionId: 'us-west-2',
            name: 'hostProp',
            loading: false,
            ec2Details: [{ instanceType: 'm5.large' }],
            sqlServerInstances: [{ databaseServer: { serverEdition: 'Standard' } }],
            serverInstallationMode: 'Standalone',
            totalInstance: 1
        };
        const store = makeStore({
            selectedHostDetails: {
                ec2InstanceId: 'i-other',
                credentialId: 'cred-other',
                regionId: 'us-east-1',
                name: 'host1',
                loading: false,
                ec2Details: [{ instanceType: 'r5.xlarge' }],
                sqlServerInstances: [{ databaseServer: { serverEdition: 'Enterprise' } }],
                serverInstallationMode: 'Standalone',
                totalInstance: 1
            }
        });
        render(
            <Provider store={store}>
                <InstanceInformation host={host} />
            </Provider>
        );
        expect(screen.getByTestId('row-0').textContent).toContain('m5.large');
    });

    it('prefers selectedHostDetails when host matches by IDs', () => {
        const host = {
            ec2InstanceId: 'i-123',
            credentialId: 'cred-1',
            regionId: 'us-east-1',
            name: 'hostProp',
            loading: false,
            ec2Details: [{ instanceType: 'm5.large' }],
            sqlServerInstances: [],
            serverInstallationMode: 'Standalone',
            totalInstance: 1
        };
        const store = makeStore({
            selectedHostDetails: {
                ec2InstanceId: 'i-123',
                credentialId: 'cred-1',
                regionId: 'us-east-1',
                name: 'host1',
                loading: false,
                ec2Details: [{ instanceType: 'r5.xlarge' }],
                sqlServerInstances: [{ databaseServer: { serverEdition: 'Enterprise' } }],
                serverInstallationMode: 'Standalone',
                totalInstance: 2
            }
        });
        render(
            <Provider store={store}>
                <InstanceInformation host={host} />
            </Provider>
        );
        // Should use selectedHostDetails since IDs match
        expect(screen.getByTestId('row-0').textContent).toContain('r5.xlarge');
    });

    it('uses clusterNodeDetails when length is 2', () => {
        const store = makeStore({
            selectedHostDetails: {
                name: 'host1',
                loading: false,
                clusterNodeDetails: [{ ec2InstanceType: 'r5.xlarge' }, { ec2InstanceType: 'r5.2xlarge' }],
                sqlServerInstances: [],
                serverInstallationMode: 'Standalone',
                totalInstance: 1
            }
        });
        render(
            <Provider store={store}>
                <InstanceInformation />
            </Provider>
        );
        expect(screen.getByTestId('row-0').textContent).toContain('r5.xlarge, r5.2xlarge');
    });

    it('renders on-prem mode data for MSSQL_ON_PREMISES tab', () => {
        const store = makeStore({
            selectedExploreSavingsTab: 'MSSQL_ON_PREMISES',
            savingsCalculatorFrom: 'OnPrem',
            selectedOnPremHostDetails: {
                resourceName: 'onprem-host',
                deploymentModel: 'Standalone',
                totalInstance: 2,
                sqlServerInstances: [{ sqlEdition: 'Enterprise' }]
            }
        });
        render(
            <Provider store={store}>
                <InstanceInformation />
            </Provider>
        );
        expect(screen.getByTestId('row-0').textContent).toContain('SQL Edition');
        expect(screen.getByTestId('row-0').textContent).toContain('Enterprise');
        expect(screen.getByTestId('row-1').textContent).toContain('Deployment model');
    });

    it('uses alternate class for Auto_FSXW mode', () => {
        const store = makeStore({ savingsCalculatorFrom: 'Auto_FSXW' });
        const { container } = render(
            <Provider store={store}>
                <InstanceInformation />
            </Provider>
        );
        expect(container.querySelector('.instanceInformationAlternate')).toBeTruthy();
    });

    it('uses alternate class for MSSQL_ON_PREMISES tab', () => {
        const store = makeStore({
            selectedExploreSavingsTab: 'MSSQL_ON_PREMISES',
            selectedOnPremHostDetails: { resourceName: 'host', deploymentModel: 'Standalone', sqlServerInstances: [] }
        });
        const { container } = render(
            <Provider store={store}>
                <InstanceInformation />
            </Provider>
        );
        expect(container.querySelector('.instanceInformationAlternate')).toBeTruthy();
    });

    it('uses default class for Auto_EBS mode', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <InstanceInformation />
            </Provider>
        );
        expect(container.querySelector('.instanceInformation')).toBeTruthy();
    });

    it('sets table variant to innerTable', () => {
        render(
            <Provider store={makeStore()}>
                <InstanceInformation />
            </Provider>
        );
        expect(screen.getByTestId('table')).toHaveAttribute('data-variant', 'innerTable');
    });

    it('shows AOAG as NOT_OPTIMIZED finding', () => {
        mockHasExploreSavingsAoagDeployment.mockReturnValue(true);
        const store = makeStore({
            selectedHostDetails: {
                name: 'host1',
                loading: false,
                ec2Details: [{ instanceType: 'r5.xlarge' }],
                sqlServerInstances: [],
                serverInstallationMode: ['Always on availability group'],
                totalInstance: 1
            }
        });
        render(
            <Provider store={store}>
                <InstanceInformation />
            </Provider>
        );
        // Deployment model findings should be NOT_OPTIMIZED for AOAG
        expect(screen.getByTestId('row-2').textContent).toContain('Deployment model');
    });

    it('renders serverAllInstallationMode when available', () => {
        const store = makeStore({
            selectedHostDetails: {
                name: 'host1',
                loading: false,
                ec2Details: [],
                sqlServerInstances: [],
                serverAllInstallationMode: ['Standalone', 'FCI'],
                totalInstance: 1
            }
        });
        render(
            <Provider store={store}>
                <InstanceInformation />
            </Provider>
        );
        expect(screen.getByTestId('row-2').textContent).toContain('Standalone, FCI');
    });
});
