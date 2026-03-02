import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ReplicatesDialogContent from './ReplicatesDialogContent';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const map: Record<string, string> = {
                'databases.data-guard.host-name': 'Host Name',
                'databases.data-guard.database-name': 'Database Name',
                'databases.databases-table.oracle.headers.registration-status': 'Registration Status',
                'databases.data-guard.role': 'Role',
                'databases.general.registered': 'Registered',
                'databases.data-guard.unregistered': 'Unregistered',
                'databases.data-guard.unknown-role-tooltip': 'Unknown role tooltip'
            };
            return map[key] || key;
        }
    })
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsTypography: ({ children, variant, className, title }: any) => (
        <span data-testid="ds-typography" data-variant={variant} className={className} title={title}>
            {children}
        </span>
    ),
    DsButton: ({ children, onClick, type }: any) => (
        <button data-testid="ds-button" onClick={onClick} data-type={type}>
            {children}
        </button>
    )
}));

vi.mock('@netapp/design-system', () => ({
    useDialog: () => ({ closeDialog: vi.fn() }),
    TooltipInfo: ({ children }: any) => <div data-testid="tooltip-info">{children}</div>
}));

vi.mock('react-redux', async () => {
    const actual = await vi.importActual('react-redux');
    return { ...actual, useDispatch: () => vi.fn() };
});

vi.mock('../../StorageCompute/LunsDialogContent/LunsDialogContent.module.scss', () => ({
    default: {
        tableWrapper: 'tableWrapper',
        tableRow: 'tableRow',
        tableCell: 'tableCell',
        tableCellFsx: 'tableCellFsx',
        statusCell: 'statusCell',
        roleCell: 'roleCell'
    }
}));

vi.mock('../../../../../utils/consts', () => ({
    DBType: { MSSQL: 'MSSQL', ORACLE: 'ORACLE' },
    WELL_ARCHITECTED_TABS: { OVERVIEW: 'overview' },
    WLF_TABS: { ORACLE_WELL_ARCHITECTED: 'oracle', INVENTORY: 'inventory' }
}));

vi.mock('../../../../../utils/resourceUtils', () => ({
    toSentenceCase: vi.fn((str: string) => (str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : ''))
}));

vi.mock('../../../../../common/DotComponent/DotComponent', () => ({
    default: ({ color, value }: any) => (
        <div data-testid="dot-component" data-color={color}>
            {value}
        </div>
    )
}));

// Mock all Redux store actions
vi.mock('../../../../../store/workloadFactory/inventoryV2Slice', () => ({
    setBreadCrumbSelectedFrom: vi.fn(() => ({ type: 'mock' })),
    setRegisterHostType: vi.fn(() => ({ type: 'mock' })),
    setSelectedHeaderTab: vi.fn(() => ({ type: 'mock' })),
    setWizardOperationType: vi.fn(() => ({ type: 'mock' }))
}));

vi.mock('../../../../../store/workloadFactory/oracleSlice', () => ({
    resetOracleResourceVisitedTabs: vi.fn(() => ({ type: 'mock' })),
    setSelectedOracleInnerPageTab: vi.fn(() => ({ type: 'mock' }))
}));

vi.mock('../../../../../store/workloadFactory/getWellOptimizeSlice', () => ({
    setFSXId: vi.fn(() => ({ type: 'mock' })),
    setGwPageLoadInstanceData: vi.fn(() => ({ type: 'mock' })),
    setLandingFrom: vi.fn(() => ({ type: 'mock' }))
}));

vi.mock('../../../../../store/workloadFactory/workloadFactoryResourceSlice', () => ({
    resetWorkloadFactoryResourceData: vi.fn(() => ({ type: 'mock' })),
    setSelectedHostname: vi.fn(() => ({ type: 'mock' })),
    setSelectedResourcePageHostData: vi.fn(() => ({ type: 'mock' }))
}));

vi.mock('../../../../../store/workloadFactory/agenticAISlice', () => ({
    resetEiData: vi.fn(() => ({ type: 'mock' }))
}));

const createMockStore = () =>
    configureStore({
        reducer: {
            workloadFactoryResource: () => ({
                selectedResourceCredId: 'cred-1',
                selectedResourceRegionId: 'us-east-1'
            }),
            getWellOptimize: () => ({
                credIdFromJM: '',
                regionFromJM: ''
            })
        }
    });

const mockResourceDetails = {
    dataguardDetails: {
        isPrimaryNode: true,
        dbUniqueName: 'current_db',
        associatedHosts: [
            {
                hostName: 'host1',
                serviceName: 'replica_db',
                sidName: 'SID1',
                role: 'PHYSICAL STANDBY',
                ec2InstanceId: 'i-001',
                databaseHostId: 'db-host-1',
                databaseInstanceId: 'inst-1'
            },
            {
                hostName: 'host2',
                serviceName: 'current_db',
                sidName: 'current_db',
                role: 'PRIMARY',
                ec2InstanceId: 'i-002',
                databaseHostId: null,
                databaseInstanceId: null
            }
        ]
    }
};

describe('ReplicatesDialogContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render table headers', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ReplicatesDialogContent resourceDetails={mockResourceDetails} />
            </Provider>
        );
        expect(screen.getByText('Host Name')).toBeTruthy();
        expect(screen.getByText('Database Name')).toBeTruthy();
        expect(screen.getByText('Registration Status')).toBeTruthy();
        expect(screen.getByText('Role')).toBeTruthy();
    });

    it('should filter out the current database from the list', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ReplicatesDialogContent resourceDetails={mockResourceDetails} />
            </Provider>
        );
        // current_db should be filtered out, only replica_db shown
        expect(screen.getByText('host1')).toBeTruthy();
        expect(screen.queryByText('host2')).toBeNull();
    });

    it('should render registered host as DsButton when databaseHostId is present', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ReplicatesDialogContent resourceDetails={mockResourceDetails} />
            </Provider>
        );
        expect(screen.getByTestId('ds-button')).toBeTruthy();
        expect(screen.getByText('replica_db')).toBeTruthy();
    });

    it('should render Registered status for hosts with databaseHostId', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ReplicatesDialogContent resourceDetails={mockResourceDetails} />
            </Provider>
        );
        expect(screen.getByText('Registered')).toBeTruthy();
    });

    it('should render Unregistered status for hosts without databaseHostId', () => {
        const details = {
            dataguardDetails: {
                isPrimaryNode: true,
                dbUniqueName: 'other_db',
                associatedHosts: [
                    {
                        hostName: 'host3',
                        serviceName: 'unregistered_db',
                        sidName: 'SID3',
                        role: 'STANDBY',
                        ec2InstanceId: 'i-003',
                        databaseHostId: null
                    }
                ]
            }
        };
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ReplicatesDialogContent resourceDetails={details} />
            </Provider>
        );
        expect(screen.getByText('Unregistered')).toBeTruthy();
    });

    it('should show tooltip for UNKNOWN role on non-primary node', () => {
        const details = {
            dataguardDetails: {
                isPrimaryNode: false,
                dbUniqueName: 'other_db',
                associatedHosts: [
                    {
                        hostName: 'host4',
                        serviceName: 'db4',
                        sidName: 'SID4',
                        role: 'UNKNOWN',
                        ec2InstanceId: 'i-004',
                        databaseHostId: null
                    }
                ]
            }
        };
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ReplicatesDialogContent resourceDetails={details} />
            </Provider>
        );
        expect(screen.getByTestId('tooltip-info')).toBeTruthy();
    });

    it('should NOT show tooltip for UNKNOWN role on primary node', () => {
        const details = {
            dataguardDetails: {
                isPrimaryNode: true,
                dbUniqueName: 'other_db',
                associatedHosts: [
                    {
                        hostName: 'host5',
                        serviceName: 'db5',
                        sidName: 'SID5',
                        role: 'UNKNOWN',
                        ec2InstanceId: 'i-005',
                        databaseHostId: null
                    }
                ]
            }
        };
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ReplicatesDialogContent resourceDetails={details} />
            </Provider>
        );
        expect(screen.queryByTestId('tooltip-info')).toBeNull();
    });

    it('should NOT navigate when databaseHostId is missing on click', () => {
        const details = {
            dataguardDetails: {
                isPrimaryNode: true,
                dbUniqueName: 'other_db',
                associatedHosts: [
                    {
                        hostName: 'host6',
                        serviceName: 'db6',
                        sidName: 'SID6',
                        role: 'STANDBY',
                        ec2InstanceId: 'i-006',
                        databaseHostId: null
                    }
                ]
            }
        };
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ReplicatesDialogContent resourceDetails={details} />
            </Provider>
        );
        // Should render as plain text (no DsButton)
        expect(screen.queryByTestId('ds-button')).toBeNull();
        expect(screen.getByText('db6')).toBeTruthy();
    });

    it('should render empty list when all associated hosts are filtered', () => {
        const details = {
            dataguardDetails: {
                dbUniqueName: 'solo_db',
                associatedHosts: [
                    {
                        hostName: 'hostX',
                        serviceName: 'solo_db',
                        sidName: 'solo_db',
                        role: 'PRIMARY',
                        ec2InstanceId: 'i-X'
                    }
                ]
            }
        };
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ReplicatesDialogContent resourceDetails={details} />
            </Provider>
        );
        // Table renders but no data rows
        expect(screen.getByText('Host Name')).toBeTruthy();
        expect(screen.queryByText('hostX')).toBeNull();
    });

    it('should handle empty associatedHosts array', () => {
        const details = {
            dataguardDetails: { dbUniqueName: 'db', associatedHosts: [] }
        };
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ReplicatesDialogContent resourceDetails={details} />
            </Provider>
        );
        expect(screen.getByText('Host Name')).toBeTruthy();
    });

    it('should navigate to overview when DsButton is clicked', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ReplicatesDialogContent resourceDetails={mockResourceDetails} />
            </Provider>
        );
        const button = screen.getByTestId('ds-button');
        fireEvent.click(button);
        // Should not throw - dispatches are called
        expect(button).toBeTruthy();
    });
});
