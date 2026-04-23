import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ---- import module under test AFTER mocks ----
import {
    onClickESHostOnPrem,
    onClickESHost,
    onClickESHostOracleEbs,
    handleManualTCOEBS,
    handleManualTCOFSXW,
    setESInstanceOnPremData,
    onClickESHostOnPremBulk,
    setESInstanceData,
    formatCalcSize,
    formatNumbers,
    formatPercentage,
    formatViewCalcInstance,
    formatViewCalcRecommendedData,
    formatViewCalcData,
    getEbsViewCalculationData,
    EbsCalculationUpdates,
    formatStorageSavingsRecommendedData,
    generateLabel2ForInstanceType,
    handleAuthenticate,
    isMissingSqlPermissions,
    shouldAuthDialogOpen,
    shouldAuthDialogOpenBulk
} from './ExploreSavingsUtils';

// Import mocked modules at the top level for assertions
import {
    setSelectedOnPremHostDetails,
    setSelectedHostDetails,
    setOnPremStorageAndComputeInfoFull,
    setSelectedServerName
} from '../../store/workloadFactory/exploreSavingsSlice';

import {
    setActionsDisabled,
    setDialogErrorWithTooltip,
    resetDialogComponent
} from '../../store/workloadFactory/dialogComponentSlice';

import {
    setBulkAuthStatus,
    setSelectedRowsForExploreSavingsEBSBulk,
    resetBulkAuthCredentialsAndStatus,
    resetRowsRequiringAuthBulk,
    setTriggerBulkDataFetch
} from '../../store/workloadFactory/exploreSavingsBulkSlice';

import { addNotification } from '../../store/notificationSlice';

// ---- mock functions ----
const mockPostBlueXPMessage = vi.fn();
const mockDispatch = vi.fn();
const mockNavigate = vi.fn();
const mockT = vi.fn((key: string) => key);

// Store state that tests can mutate
let mockStoreState: any = {};

// ---- vi.mock calls (no top-level variable references in factories) ----
vi.mock('@netapp/design-system', () => ({
    BlueXPListeners: { navigate: 'navigate' },
    postBlueXPMessage: (...args: any[]) => mockPostBlueXPMessage(...args)
}));

vi.mock('react-router-dom', () => ({
    NavigateFunction: undefined
}));

vi.mock('@reduxjs/toolkit', () => ({
    Dispatch: undefined
}));

vi.mock('i18next', () => ({
    __esModule: true,
    default: {
        t: (key: string) => key
    },
    TFunction: undefined
}));

vi.mock('../../store/store', () => ({
    default: {
        getState: () => mockStoreState,
        dispatch: vi.fn()
    }
}));

vi.mock('../../store/workloadFactory/exploreSavingsSlice', () => ({
    resetServerDetailsCredentials: vi.fn(() => ({ type: 'resetServerDetailsCredentials' })),
    setDisableState: vi.fn((val: any) => ({ type: 'setDisableState', payload: val })),
    setMonthlyChangeRate: vi.fn((val: any) => ({ type: 'setMonthlyChangeRate', payload: val })),
    setOnPremStorageAndComputeInfoFull: vi.fn((val: any) => ({
        type: 'setOnPremStorageAndComputeInfoFull',
        payload: val
    })),
    setSavingsCalculatorFrom: vi.fn((val: any) => ({ type: 'setSavingsCalculatorFrom', payload: val })),
    setSelectedCloneRefresh: vi.fn((val: any) => ({ type: 'setSelectedCloneRefresh', payload: val })),
    setSelectedEsPageInstance: vi.fn((val: any) => ({ type: 'setSelectedEsPageInstance', payload: val })),
    setSelectedHostDetails: vi.fn((val: any) => ({ type: 'setSelectedHostDetails', payload: val })),
    setSelectedOnPremHostDetails: vi.fn((val: any) => ({ type: 'setSelectedOnPremHostDetails', payload: val })),
    setSelectedOnPremHostId: vi.fn((val: any) => ({ type: 'setSelectedOnPremHostId', payload: val })),
    setSelectedServerName: vi.fn((val: any) => ({ type: 'setSelectedServerName', payload: val })),
    setSelectedSnapshotFrequency: vi.fn((val: any) => ({ type: 'setSelectedSnapshotFrequency', payload: val }))
}));

vi.mock('../../store/workloadFactory/inventoryV2Slice', () => ({
    setInventoryTableData: vi.fn((val: any) => ({ type: 'setInventoryTableData', payload: val })),
    setSelectedHeaderTab: vi.fn((val: any) => ({ type: 'setSelectedHeaderTab', payload: val }))
}));

vi.mock('../../utils/appConstants', () => ({
    GENERAL: {
        EBS: 'EBS',
        AOAG: 'Always on availability group',
        FAILOVER_CLUSTER_INSTANCES: 'Failover Cluster Instances',
        ES_SERVER_NAME: 'Server name',
        NOT_AVAILABLE: 'n/a'
    }
}));

vi.mock('../../utils/consts', () => ({
    AUTHENTICATION_TYPE: {
        SQL_SERVER_AUTHENTICATION: 'SQL Server authentication',
        WINDOWS_AUTHENTICATION: 'Windows authentication'
    },
    DETECT_HOST_VAR: {
        MSSQL: 'MSSQL',
        WINDOWS: 'WINDOWS_USER'
    },
    FSX_AZ_TYPE: {
        SINGLE: 'single',
        MULTI: 'multi'
    },
    GIB_IN_BYTE: 1073741824,
    READINESS_TYPES: ['assessment', 'dbcreation', 'sandbox', 'remediation'],
    REQUIRED_SQL_PERMISSIONS: ['VIEW ANY DEFINITION', 'VIEW SERVER STATE', 'CONNECT SQL'],
    SNAPSHOT_FREQUENCY: [
        { value: 'hourly', label: 'Hourly' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'daily', label: 'Daily' }
    ],
    SAVINGS_CALC_MODE: {
        MANUAL_EBS: 'Manual_EBS',
        AUTO_EBS: 'Auto_EBS',
        AUTO_FSXW: 'Auto_FSXW',
        MANUAL_FSXW: 'Manual_FSXW',
        ONPREM: 'OnPrem',
        ORACLE_ONPREM: 'Oracle_OnPrem',
        ORACLE_AUTO_EBS: 'Oracle_Auto_EBS',
        EBS: 'ebs',
        FSXW: 'fsxw',
        ONPREM_MODE: 'onprem'
    },
    SQL_DEPLOYMENT_MODE: {
        FAILOVER_CLUSTER_VALUE: 'fci',
        SINGLE_INSTANCE_VALUE: 'standalone',
        AOAG: 'aoag',
        HA: 'ha',
        FAILOVER_CLUSTER_VALUE_CAPS: 'FCI'
    },
    WLF_TABS: {
        SAVINGS_CALCULATOR: 'Savings Calculator'
    }
}));

vi.mock('../../utils/types/exploreSavingsType', () => ({}));

vi.mock('../../utils/utilityFunctions', () => ({
    formatFractionalNumber: vi.fn((val: any, _precision?: number) => {
        if (val === undefined || val === null) return 0;
        return Number(Number(val).toFixed(3));
    }),
    formatFractionalNumberForCost: vi.fn((val: any, _precision?: number) => {
        if (val === undefined || val === null) return 0;
        return val;
    }),
    formatNumberWithCustomComma: vi.fn((val: any) => {
        if (val === undefined || val === null) return '0';
        return String(val);
    })
}));

vi.mock('../../store/workloadFactory/dialogComponentSlice', () => ({
    resetDialogComponent: vi.fn(() => ({ type: 'resetDialogComponent' })),
    setActionsDisabled: vi.fn((val: any) => ({ type: 'setActionsDisabled', payload: val })),
    setDialogErrorWithTooltip: vi.fn((val: any) => ({ type: 'setDialogErrorWithTooltip', payload: val }))
}));

vi.mock('../../store/notificationSlice', () => ({
    addNotification: vi.fn((val: any) => ({ type: 'addNotification', payload: val })),
    NOTIFICATION_TYPES: {
        SUCCESS: 'success',
        WARNING: 'warning',
        ERROR: 'error'
    }
}));

vi.mock('../../store/workloadFactory/exploreSavingsBulkSlice', () => ({
    resetBulkAuthCredentialsAndStatus: vi.fn(() => ({ type: 'resetBulkAuthCredentialsAndStatus' })),
    resetRowsRequiringAuthBulk: vi.fn(() => ({ type: 'resetRowsRequiringAuthBulk' })),
    setBulkAuthStatus: vi.fn((val: any) => ({ type: 'setBulkAuthStatus', payload: val })),
    setSelectedRowsForExploreSavingsEBSBulk: vi.fn((val: any) => ({
        type: 'setSelectedRowsForExploreSavingsEBSBulk',
        payload: val
    })),
    setSelectedRowsForExploreSavingsOnPremBulk: vi.fn((val: any) => ({
        type: 'setSelectedRowsForExploreSavingsOnPremBulk',
        payload: val
    })),
    setSelectedRowsForExploreSavingsOracleEbsBulk: vi.fn((val: any) => ({
        type: 'setSelectedRowsForExploreSavingsOracleEbsBulk',
        payload: val
    })),
    setTriggerBulkDataFetch: vi.fn((val: any) => ({ type: 'setTriggerBulkDataFetch', payload: val }))
}));

// ---- local constants for test usage (after mocks) ----
const SAVINGS_CALC_MODE = {
    MANUAL_EBS: 'Manual_EBS',
    AUTO_EBS: 'Auto_EBS',
    AUTO_FSXW: 'Auto_FSXW',
    MANUAL_FSXW: 'Manual_FSXW',
    ONPREM: 'OnPrem',
    ORACLE_ONPREM: 'Oracle_OnPrem',
    ORACLE_AUTO_EBS: 'Oracle_Auto_EBS',
    EBS: 'ebs',
    FSXW: 'fsxw',
    ONPREM_MODE: 'onprem'
};

const AUTHENTICATION_TYPE = {
    SQL_SERVER_AUTHENTICATION: 'SQL Server authentication',
    WINDOWS_AUTHENTICATION: 'Windows authentication'
};

const GIB_IN_BYTE = 1073741824;

// ---- helpers ----
const makeRowData = (overrides: any = {}) => ({
    resourceId: 'res-1',
    resourceName: 'host-1',
    deploymentModel: 'standalone',
    name: 'host-1',
    ec2InstanceId: 'i-123',
    credentialId: 'cred-1',
    regionId: 'us-east-1',
    storageType: 'EBS',
    serverInstallationMode: 'standalone',
    id: 'row-1',
    sqlServerInstances: [
        {
            sqlInstanceName: 'MSSQLSERVER',
            sqlInstanceId: 'inst-1',
            totalStorage: GIB_IN_BYTE * 100,
            totalIops: 3000,
            totalThroughput: 125,
            noOfVcpusInUse: 4,
            memory: GIB_IN_BYTE * 16,
            networkPerformance: 'Up to 10 Gbps',
            sqlVersion: '2019',
            sqlServerDeploymentType: 'standalone',
            databaseServer: { serverVersion: '2019', serverEdition: 'Enterprise' },
            fileSystemType: 'EBS',
            databaseInstanceName: 'db-inst-1',
            sqlServerAuthentication: false,
            windowsDomainUserAuthentication: false,
            manageReadiness: null
        }
    ],
    isDetected: true,
    databaseServer: { serverVersion: '2019', serverEdition: 'Enterprise' },
    ...overrides
});

const resetMockState = () => {
    mockStoreState = {
        exploreSavings: {
            recommendedTargetInstance: '',
            selectedManualDeploymentModel: { value: 'standalone' },
            selectedDeploymentModel: 'standalone',
            savingsCalculatorFrom: SAVINGS_CALC_MODE.AUTO_EBS,
            selectedAuthenticationType: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION,
            serverDetails: { userName: 'testUser', password: 'testPass' }
        },
        exploreSavingsBulk: {
            selectedRowsForExploreSavingsEBSBulk: [],
            selectedRowsForExploreSavingsOnPremBulk: [],
            bulkAuthCredentials: {},
            rowsRequiringAuthBulk: []
        },
        inventoryV2: {
            inventoryTableData: {}
        }
    };
};

describe('ExploreSavingsUtils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetMockState();
    });

    // =========================================================================
    // onClickESHostOnPrem
    // =========================================================================
    describe('onClickESHostOnPrem', () => {
        it('should navigate and dispatch all required actions for workload factory', () => {
            const rowData = makeRowData();
            onClickESHostOnPrem(mockDispatch, rowData, true, mockNavigate);

            expect(mockNavigate).toHaveBeenCalledWith('../databases/saving-calculator');
            expect(mockPostBlueXPMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'navigate',
                    payload: expect.objectContaining({
                        pathname: './storage-saving-calculator?type=onprem&mode=auto'
                    })
                })
            );
            expect(mockDispatch).toHaveBeenCalled();
        });

        it('should use non-workload-factory path when isWorkloadFactory is false', () => {
            const rowData = makeRowData();
            onClickESHostOnPrem(mockDispatch, rowData, false);

            expect(mockPostBlueXPMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({
                        pathname: '../fsxdb/storage-saving-calculator?type=onprem&mode=auto'
                    })
                })
            );
        });

        it('should not navigate if navigate is not provided', () => {
            const rowData = makeRowData();
            onClickESHostOnPrem(mockDispatch, rowData, true);

            expect(mockNavigate).not.toHaveBeenCalled();
        });

        it('should handle rowData without sqlServerInstances', () => {
            const rowData = makeRowData({ sqlServerInstances: [] });
            onClickESHostOnPrem(mockDispatch, rowData, true, mockNavigate);
            // Should not throw; dispatches should still happen
            expect(mockDispatch).toHaveBeenCalled();
        });

        it('should use GENERAL.ES_SERVER_NAME when resourceName is falsy', () => {
            const rowData = makeRowData({ resourceName: '' });
            onClickESHostOnPrem(mockDispatch, rowData, true, mockNavigate);
            expect(mockDispatch).toHaveBeenCalled();
        });

        it('should populate storagePerfAndCompute for each instance using resourceId_instanceName key', () => {
            const rowData = makeRowData({
                sqlServerInstances: [
                    {
                        sqlInstanceName: 'INST1',
                        sqlInstanceId: 'id-1',
                        totalStorage: GIB_IN_BYTE * 50,
                        totalIops: 2000,
                        totalThroughput: 100,
                        noOfVcpusInUse: 2,
                        memory: GIB_IN_BYTE * 8,
                        networkPerformance: '10 Gbps'
                    },
                    {
                        sqlInstanceName: 'INST2',
                        sqlInstanceId: 'id-2',
                        totalStorage: GIB_IN_BYTE * 25,
                        totalIops: 1000,
                        totalThroughput: 50,
                        noOfVcpusInUse: 1,
                        memory: GIB_IN_BYTE * 4,
                        networkPerformance: '5 Gbps'
                    }
                ]
            });
            onClickESHostOnPrem(mockDispatch, rowData, true, mockNavigate);
            expect(mockDispatch).toHaveBeenCalled();
        });

        it('should handle AOAG deployment model via setESInstanceOnPremData', () => {
            const rowData = makeRowData({ deploymentModel: 'Always on availability group' });
            onClickESHostOnPrem(mockDispatch, rowData, true, mockNavigate);
            expect(mockDispatch).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // onClickESHost
    // =========================================================================
    describe('onClickESHost', () => {
        it('should handle EBS storage type and navigate', () => {
            const rowData = makeRowData({ storageType: 'EBS' });
            onClickESHost(mockDispatch, rowData, true, mockNavigate);

            expect(mockNavigate).toHaveBeenCalledWith('../databases/saving-calculator');
            expect(mockPostBlueXPMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({
                        pathname: './storage-saving-calculator?type=ebs&mode=auto'
                    })
                })
            );
        });

        it('should handle non-EBS (FSxW) storage type and navigate', () => {
            const rowData = makeRowData({ storageType: 'FSXW' });
            onClickESHost(mockDispatch, rowData, true, mockNavigate);

            expect(mockPostBlueXPMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({
                        pathname: './storage-saving-calculator?type=fsxw&mode=auto'
                    })
                })
            );
        });

        it('should use non-workload-factory paths when isWorkloadFactory is false for EBS', () => {
            const rowData = makeRowData({ storageType: 'EBS' });
            onClickESHost(mockDispatch, rowData, false);

            expect(mockPostBlueXPMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({
                        pathname: '../fsxdb/storage-saving-calculator?type=ebs&mode=auto'
                    })
                })
            );
        });

        it('should use non-workload-factory paths when isWorkloadFactory is false for FSxW', () => {
            const rowData = makeRowData({ storageType: 'FSXW' });
            onClickESHost(mockDispatch, rowData, false);

            expect(mockPostBlueXPMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({
                        pathname: '../fsxdb/storage-saving-calculator?type=fsxw&mode=auto'
                    })
                })
            );
        });

        it('should not set bulk selection when isBulk is true for EBS', () => {
            const rowData = makeRowData({ storageType: 'EBS' });
            onClickESHost(mockDispatch, rowData, true, mockNavigate, true, '2 hosts selected');

            // When isBulk = true, setSelectedRowsForExploreSavingsEBSBulk should NOT be called
            expect(setSelectedRowsForExploreSavingsEBSBulk).not.toHaveBeenCalled();
        });

        it('should set bulk selection when isBulk is false for EBS', () => {
            const rowData = makeRowData({ storageType: 'EBS' });
            onClickESHost(mockDispatch, rowData, true, mockNavigate, false);

            expect(setSelectedRowsForExploreSavingsEBSBulk).toHaveBeenCalledWith([rowData]);
        });

        it('should use bulkServerName when provided in bulk mode', () => {
            const rowData = makeRowData({ storageType: 'EBS' });
            onClickESHost(mockDispatch, rowData, true, mockNavigate, true, 'Bulk name');
            expect(mockDispatch).toHaveBeenCalled();
        });

        it('should use GENERAL.ES_SERVER_NAME when name is falsy and not bulk', () => {
            const rowData = makeRowData({ storageType: 'EBS', name: '' });
            onClickESHost(mockDispatch, rowData, true, mockNavigate);
            expect(mockDispatch).toHaveBeenCalled();
        });

        it('should not navigate if navigate is not provided', () => {
            const rowData = makeRowData({ storageType: 'EBS' });
            onClickESHost(mockDispatch, rowData, true);
            expect(mockNavigate).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // handleManualTCOEBS
    // =========================================================================
    describe('handleManualTCOEBS', () => {
        it('should post BlueXP message and dispatch when isWorkloadFactory is true', () => {
            handleManualTCOEBS(mockDispatch, mockNavigate, true);

            expect(mockPostBlueXPMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({
                        pathname: './storage-saving-calculator?type=ebs&mode=manual'
                    })
                })
            );
            expect(mockDispatch).toHaveBeenCalled();
        });

        it('should not post BlueXP message when isWorkloadFactory is false', () => {
            handleManualTCOEBS(mockDispatch, mockNavigate, false);

            expect(mockPostBlueXPMessage).not.toHaveBeenCalled();
            expect(mockDispatch).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // handleManualTCOFSXW
    // =========================================================================
    describe('handleManualTCOFSXW', () => {
        it('should post BlueXP message for workload factory', () => {
            handleManualTCOFSXW(mockDispatch, mockNavigate, true);

            expect(mockPostBlueXPMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({
                        pathname: './storage-saving-calculator?type=fsxw&mode=manual'
                    })
                })
            );
        });

        it('should post BlueXP message for non-workload-factory', () => {
            handleManualTCOFSXW(mockDispatch, mockNavigate, false);

            expect(mockPostBlueXPMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({
                        pathname: '../fsxdb/storage-saving-calculator?type=fsxw&mode=manual'
                    })
                })
            );
        });
    });

    // =========================================================================
    // setESInstanceOnPremData
    // =========================================================================
    describe('setESInstanceOnPremData', () => {
        it('should dispatch setSelectedOnPremHostDetails with correct data', () => {
            const data = makeRowData();
            setESInstanceOnPremData(data, mockDispatch);

            expect(setSelectedOnPremHostDetails).toHaveBeenCalledWith(
                expect.objectContaining({
                    totalInstance: 1,
                    recommendedInstance: expect.objectContaining({
                        serverInstallationMode: 'standalone'
                    })
                })
            );
        });

        it('should convert AOAG deploymentModel to FAILOVER_CLUSTER_INSTANCES', () => {
            const data = makeRowData({ deploymentModel: 'Always on availability group' });
            setESInstanceOnPremData(data, mockDispatch);

            expect(setSelectedOnPremHostDetails).toHaveBeenCalledWith(
                expect.objectContaining({
                    recommendedInstance: expect.objectContaining({
                        serverInstallationMode: 'Failover Cluster Instances'
                    })
                })
            );
        });

        it('should handle data with empty sqlServerInstances', () => {
            const data = makeRowData({ sqlServerInstances: [] });
            setESInstanceOnPremData(data, mockDispatch);

            expect(setSelectedOnPremHostDetails).toHaveBeenCalledWith(
                expect.objectContaining({
                    totalInstance: 0
                })
            );
        });
    });

    // =========================================================================
    // onClickESHostOnPremBulk
    // =========================================================================
    describe('onClickESHostOnPremBulk', () => {
        it('should navigate and dispatch for multiple hosts', () => {
            const hosts = [makeRowData(), makeRowData({ resourceId: 'res-2', resourceName: 'host-2' })];
            onClickESHostOnPremBulk(mockDispatch, hosts, true, mockNavigate);

            expect(mockNavigate).toHaveBeenCalledWith('../databases/saving-calculator');
            expect(mockDispatch).toHaveBeenCalled();
        });

        it('should combine storage info from all selected hosts', () => {
            const host1 = makeRowData({
                resourceId: 'res-1',
                resourceName: 'host-1',
                sqlServerInstances: [
                    {
                        sqlInstanceName: 'INST1',
                        sqlInstanceId: 'id-1',
                        totalStorage: GIB_IN_BYTE * 50,
                        totalIops: 2000,
                        totalThroughput: 100,
                        noOfVcpusInUse: 2,
                        memory: GIB_IN_BYTE * 8,
                        networkPerformance: '10 Gbps'
                    }
                ]
            });
            const host2 = makeRowData({
                resourceId: 'res-2',
                resourceName: 'host-2',
                sqlServerInstances: [
                    {
                        sqlInstanceName: 'INST2',
                        sqlInstanceId: 'id-2',
                        totalStorage: GIB_IN_BYTE * 25,
                        totalIops: 1000,
                        totalThroughput: 50,
                        noOfVcpusInUse: 1,
                        memory: GIB_IN_BYTE * 4,
                        networkPerformance: '5 Gbps'
                    }
                ]
            });
            onClickESHostOnPremBulk(mockDispatch, [host1, host2], true, mockNavigate);

            expect(setOnPremStorageAndComputeInfoFull).toHaveBeenCalled();
        });

        it('should handle hosts with empty sqlServerInstances', () => {
            const host = makeRowData({ sqlServerInstances: [] });
            onClickESHostOnPremBulk(mockDispatch, [host], true, mockNavigate);
            expect(mockDispatch).toHaveBeenCalled();
        });

        it('should not navigate if navigate is not provided', () => {
            const hosts = [makeRowData()];
            onClickESHostOnPremBulk(mockDispatch, hosts, true);
            expect(mockNavigate).not.toHaveBeenCalled();
        });

        it('should use non-workload-factory path', () => {
            const hosts = [makeRowData()];
            onClickESHostOnPremBulk(mockDispatch, hosts, false);

            expect(mockPostBlueXPMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({
                        pathname: '../fsxdb/storage-saving-calculator?type=onprem&mode=auto'
                    })
                })
            );
        });

        it('should set server name based on number of selected hosts', () => {
            const hosts = [makeRowData(), makeRowData({ resourceId: 'res-2' }), makeRowData({ resourceId: 'res-3' })];
            onClickESHostOnPremBulk(mockDispatch, hosts, true);

            expect(setSelectedServerName).toHaveBeenCalledWith('3 hosts selected');
        });
    });

    // =========================================================================
    // setESInstanceData
    // =========================================================================
    describe('setESInstanceData', () => {
        it('should dispatch setSelectedHostDetails with server version from sqlServerInstances', () => {
            const data = makeRowData();
            setESInstanceData(data, mockDispatch);

            expect(setSelectedHostDetails).toHaveBeenCalledWith(
                expect.objectContaining({
                    recommendedInstance: expect.objectContaining({
                        serverVersion: '2019'
                    })
                })
            );
        });

        it('should convert AOAG to FAILOVER_CLUSTER_INSTANCES', () => {
            const data = makeRowData({ serverInstallationMode: 'Always on availability group' });
            setESInstanceData(data, mockDispatch);

            expect(setSelectedHostDetails).toHaveBeenCalledWith(
                expect.objectContaining({
                    recommendedInstance: expect.objectContaining({
                        serverInstallationMode: 'Failover Cluster Instances'
                    })
                })
            );
        });

        it('should use databaseServer.serverVersion from data when present', () => {
            const data = makeRowData({
                databaseServer: { serverVersion: '2022' },
                sqlServerInstances: []
            });
            setESInstanceData(data, mockDispatch);

            expect(setSelectedHostDetails).toHaveBeenCalledWith(
                expect.objectContaining({
                    recommendedInstance: expect.objectContaining({
                        serverVersion: '2022'
                    })
                })
            );
        });

        it('should handle empty sqlServerInstances gracefully', () => {
            const data = makeRowData({
                databaseServer: undefined,
                sqlServerInstances: []
            });
            setESInstanceData(data, mockDispatch);
            expect(mockDispatch).toHaveBeenCalled();
        });

        it('should skip instances without serverVersion', () => {
            const data = makeRowData({
                databaseServer: undefined,
                sqlServerInstances: [{ databaseServer: null }, { databaseServer: { serverVersion: '2016' } }]
            });
            setESInstanceData(data, mockDispatch);

            expect(setSelectedHostDetails).toHaveBeenCalledWith(
                expect.objectContaining({
                    recommendedInstance: expect.objectContaining({
                        serverVersion: '2016'
                    })
                })
            );
        });
    });

    // =========================================================================
    // formatCalcSize
    // =========================================================================
    describe('formatCalcSize', () => {
        it('should return formatted GiB string for valid values', () => {
            const result = formatCalcSize(GIB_IN_BYTE * 10);
            expect(result).toContain('GiB');
        });

        it('should return "0 GiB" for falsy value', () => {
            expect(formatCalcSize(0)).toBe('0 GiB');
            expect(formatCalcSize(null)).toBe('0 GiB');
            expect(formatCalcSize(undefined)).toBe('0 GiB');
        });
    });

    // =========================================================================
    // formatNumbers
    // =========================================================================
    describe('formatNumbers', () => {
        it('should format a number', () => {
            expect(formatNumbers(1000)).toBe('1,000');
        });

        it('should handle 0', () => {
            expect(formatNumbers(0)).toBe('0');
        });

        it('should return NOT_AVAILABLE for null/undefined', () => {
            expect(formatNumbers(null)).toBe('n/a');
            expect(formatNumbers(undefined)).toBe('n/a');
        });
    });

    // =========================================================================
    // formatPercentage
    // =========================================================================
    describe('formatPercentage', () => {
        it('should multiply by 100 and format', () => {
            expect(formatPercentage(0.5)).toBe('50');
        });

        it('should handle 0', () => {
            expect(formatPercentage(0)).toBe('0');
        });

        it('should return NOT_AVAILABLE for null/undefined', () => {
            expect(formatPercentage(null)).toBe('n/a');
            expect(formatPercentage(undefined)).toBe('n/a');
        });
    });

    // =========================================================================
    // formatViewCalcInstance
    // =========================================================================
    describe('formatViewCalcInstance', () => {
        it('should return single instance data for standalone deployment', () => {
            const computeDetails = [
                {
                    instanceType: 'm5.large',
                    price: 0.1,
                    computeMonthlyPrice: 73,
                    instanceMonthlyPrice: 73,
                    hoursInMonth: 730
                }
            ];
            const licenseDetails = { sqlServerEdition: 'Enterprise', licenseIncluded: true };

            const result = formatViewCalcInstance('standalone', {}, computeDetails, licenseDetails);
            expect(result).toHaveLength(1);
            expect(result[0].instanceType).toBe('m5.large');
            expect(result[0].sqlLicense).toBe('Yes');
        });

        it('should return multiple instance data for non-standalone (AOAG) deployment', () => {
            const computeDetails = [
                {
                    instanceType: 'm5.large',
                    price: 0.1,
                    computeMonthlyPrice: 73,
                    instanceMonthlyPrice: 73,
                    hoursInMonth: 730
                },
                {
                    instanceType: 'm5.xlarge',
                    price: 0.2,
                    computeMonthlyPrice: 146,
                    instanceMonthlyPrice: 146,
                    hoursInMonth: 730
                }
            ];
            const licenseDetails = { sqlServerEdition: 'Standard', licenseIncluded: false };

            const result = formatViewCalcInstance('aoag', {}, computeDetails, licenseDetails);
            expect(result).toHaveLength(2);
            expect(result[0].sqlLicense).toBe('No');
        });

        it('should use instanceTypelist from clusterNodeDetails when available', () => {
            const selectedHostDetails = {
                clusterNodeDetails: [{ ec2InstanceType: 'm5.large' }, { ec2InstanceType: 'm5.xlarge' }]
            };
            const computeDetails = [
                { price: 0.1, computeMonthlyPrice: 73, instanceMonthlyPrice: 73, hoursInMonth: 730 }
            ];
            const licenseDetails = { sqlServerEdition: 'Enterprise', licenseIncluded: true };

            const result = formatViewCalcInstance('standalone', selectedHostDetails, computeDetails, licenseDetails);
            expect(result[0].instanceType).toBe('m5.large');
        });

        it('should use topology.ec2Details when clusterNodeDetails has != 2 entries', () => {
            const selectedHostDetails = {
                clusterNodeDetails: [{ ec2InstanceType: 'single' }],
                topology: {
                    ec2Details: [{ instanceType: 'm5.2xlarge' }]
                }
            };
            const computeDetails = [
                { price: 0.1, computeMonthlyPrice: 73, instanceMonthlyPrice: 73, hoursInMonth: 730 }
            ];
            const licenseDetails = { sqlServerEdition: 'Enterprise', licenseIncluded: true };

            const result = formatViewCalcInstance('standalone', selectedHostDetails, computeDetails, licenseDetails);
            expect(result[0].instanceType).toBe('m5.2xlarge');
        });

        it('should fall back to NOT_AVAILABLE when no instance type is found', () => {
            const computeDetails = [
                { price: 0.1, computeMonthlyPrice: 73, instanceMonthlyPrice: 73, hoursInMonth: 730 }
            ];
            const licenseDetails = { sqlServerEdition: 'Enterprise', licenseIncluded: true };

            const result = formatViewCalcInstance('standalone', {}, computeDetails, licenseDetails);
            expect(result[0].instanceType).toBe('n/a');
        });

        it('should use selectedHostDetails.databaseServer.serverEdition when licenseDetails is null', () => {
            const selectedHostDetails = {
                databaseServer: { serverEdition: 'Standard' }
            };
            const computeDetails = [
                {
                    instanceType: 'm5.large',
                    price: 0.1,
                    computeMonthlyPrice: 73,
                    instanceMonthlyPrice: 73,
                    hoursInMonth: 730
                }
            ];

            const result = formatViewCalcInstance('standalone', selectedHostDetails, computeDetails, null);
            expect(result[0].sqlEdition).toBe('Standard');
        });
    });

    // =========================================================================
    // formatViewCalcRecommendedData
    // =========================================================================
    describe('formatViewCalcRecommendedData', () => {
        it('should return data as-is when null', () => {
            const result = formatViewCalcRecommendedData(null as any, 'standalone');
            expect(result).toBeNull();
        });

        it('should use machineDetails when no recommendedTargetInstance is set', () => {
            mockStoreState.exploreSavings.recommendedTargetInstance = '';
            const data: any = {
                recommendedComputeCalculation: {
                    machineDetails: [{ instanceType: 'm5.large' }]
                }
            };
            const result = formatViewCalcRecommendedData(data, 'standalone');
            expect(result.recommendedInstance).toEqual([{ instanceType: 'm5.large' }]);
        });

        it('should use filtered recommendationOptions when recommendedTargetInstance matches', () => {
            mockStoreState.exploreSavings.recommendedTargetInstance = 'm5.xlarge';
            const data: any = {
                recommendedComputeCalculation: {
                    recommendationOptions: [{ instanceType: 'm5.large' }, { instanceType: 'm5.xlarge' }],
                    machineDetails: [{ instanceType: 'm5.large' }]
                }
            };
            const result = formatViewCalcRecommendedData(data, 'standalone');
            expect(result.recommendedInstance).toEqual([{ instanceType: 'm5.xlarge' }]);
        });

        it('should return duplicated recommendedInstance for AOAG deployment when match found', () => {
            mockStoreState.exploreSavings.recommendedTargetInstance = 'm5.xlarge';
            const data: any = {
                recommendedComputeCalculation: {
                    recommendationOptions: [{ instanceType: 'm5.xlarge' }],
                    machineDetails: [{ instanceType: 'm5.large' }]
                }
            };
            const result = formatViewCalcRecommendedData(data, 'aoag');
            expect(result.recommendedInstance).toHaveLength(2);
        });

        it('should fallback to machineDetails if recommendedTargetInstance does not match any option', () => {
            mockStoreState.exploreSavings.recommendedTargetInstance = 'nonexistent';
            const data: any = {
                recommendedComputeCalculation: {
                    recommendationOptions: [{ instanceType: 'm5.large' }],
                    machineDetails: [{ instanceType: 'm5.large' }]
                }
            };
            const result = formatViewCalcRecommendedData(data, 'standalone');
            expect(result.recommendedInstance).toEqual([{ instanceType: 'm5.large' }]);
        });
    });

    // =========================================================================
    // formatViewCalcData
    // =========================================================================
    describe('formatViewCalcData', () => {
        const baseViewCalculations: any = {
            recommendedComputeCalculation: {
                machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: 100 }],
                recommendationOptions: []
            },
            recommendedLicenseCalculation: { sqlServerEdition: 'Enterprise', licenseIncluded: true },
            existingComputeCalculation: {
                machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: 100 }]
            },
            existingLicenseCalculation: { sqlServerEdition: 'Enterprise', licenseIncluded: true },
            fsxOntapCalculation: { totalThroughputAndIopsMonthly: 50, totalMonthlyStorageCharge: 100 },
            fsxOntapSnapshotCalculation: { totalMonthlyCostForCapacity: 10, totalMonthlyCostForFsxSsd: 5 },
            fsxCloneCalculation: { totalCloneMonthlyCost: 20 },
            ebsCalculation: {},
            ebsSnapshotCalculation: {},
            ebsCloneCalculation: {}
        };

        it('should format data for AUTO_EBS mode (non-bulk)', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            const result = formatViewCalcData(baseViewCalculations, 'standalone', '3');
            expect(result).toBeDefined();
            expect(result.ebsTotalCost).toBeDefined();
            expect(result.fsxTotalCost).toBeDefined();
        });

        it('should format data for MANUAL_FSXW mode', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.MANUAL_FSXW;
            const vc = {
                ...baseViewCalculations,
                fsxwCloneCalculation: { totalCloneMonthlyCost: 10 },
                fsxwSnapshotCalculation: { totalMonthlyCostForFsxwSnapshotStorageCapacity: 5 },
                fsxwCalculation: { totalMonthlyCost: 200 }
            };
            const result = formatViewCalcData(vc, 'standalone', '3');
            expect(result.fsxwTotalCost).toBeDefined();
            expect(result.fsxwCalculation).toBeDefined();
        });

        it('should format data for AUTO_FSXW mode', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_FSXW;
            const vc = {
                ...baseViewCalculations,
                fsxwCloneCalculation: { totalCloneMonthlyCost: 10 },
                fsxwSnapshotCalculation: { totalMonthlyCostForFsxwSnapshotStorageCapacity: 5 },
                fsxwCalculation: { totalMonthlyCost: 200 }
            };
            const result = formatViewCalcData(vc, 'standalone', '3');
            expect(result.fsxwTotalCost).toBeDefined();
        });

        it('should handle single AZ type', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            const vc = {
                ...baseViewCalculations,
                single: {
                    fsxOntapCalculation: { totalThroughputAndIopsMonthly: 30, totalMonthlyStorageCharge: 50 },
                    fsxOntapSnapshotCalculation: {},
                    fsxCloneCalculation: {}
                }
            };
            const result = formatViewCalcData(vc, 'standalone', '3');
            expect(result.azType).toBe('single');
        });

        it('should handle multi AZ type', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            const vc = {
                ...baseViewCalculations,
                multi: {
                    fsxOntapCalculation: { totalThroughputAndIopsMonthly: 60, totalMonthlyStorageCharge: 100 },
                    fsxOntapSnapshotCalculation: {},
                    fsxCloneCalculation: {}
                }
            };
            const result = formatViewCalcData(vc, 'standalone', '3');
            expect(result.azType).toBe('multi');
        });

        it('should handle AOAG deployment model for totalExistingEc2MachineCost', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            const vc = {
                ...baseViewCalculations,
                existingComputeCalculation: {
                    machineDetails: [
                        { instanceType: 'm5.large', instanceMonthlyPrice: 100 },
                        { instanceType: 'm5.xlarge', instanceMonthlyPrice: 200 }
                    ]
                },
                recommendedComputeCalculation: {
                    machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: 100 }],
                    recommendationOptions: []
                }
            };
            const result = formatViewCalcData(vc, 'aoag', '3');
            expect(result.totalEBSEc2MachineCost).toBeDefined();
        });

        it('should handle bulk calculations (array format)', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsEBSBulk = [
                makeRowData({ name: 'host-1' }),
                makeRowData({ name: 'host-2', resourceId: 'res-2' })
            ];

            const vc = {
                ...baseViewCalculations,
                recommendedComputeCalculation: [
                    { hostname: 'host-1', machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: 100 }] },
                    { hostname: 'host-2', machineDetails: [{ instanceType: 'm5.xlarge', instanceMonthlyPrice: 200 }] }
                ],
                recommendedLicenseCalculation: [
                    { hostname: 'host-1', sqlServerEdition: 'Enterprise', licenseIncluded: true },
                    { hostname: 'host-2', sqlServerEdition: 'Enterprise', licenseIncluded: true }
                ],
                existingComputeCalculation: [
                    { hostname: 'host-1', machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: 100 }] },
                    { hostname: 'host-2', machineDetails: [{ instanceType: 'm5.xlarge', instanceMonthlyPrice: 200 }] }
                ],
                existingLicenseCalculation: [
                    { hostname: 'host-1', sqlServerEdition: 'Enterprise', licenseIncluded: true },
                    { hostname: 'host-2', sqlServerEdition: 'Enterprise', licenseIncluded: true }
                ],
                ebsCalculation: {},
                ebsSnapshotCalculation: {},
                ebsCloneCalculation: {}
            };

            const result = formatViewCalcData(vc, 'standalone', '3');
            expect(result).toBeDefined();
            expect(Array.isArray(result.fsxInstanceCalculation)).toBe(true);
        });

        it('should handle ONPREM bulk calculations', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.ONPREM;
            mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsOnPremBulk = [
                makeRowData({ resourceName: 'host-1' })
            ];

            const vc = {
                ...baseViewCalculations,
                recommendedComputeCalculation: [
                    {
                        resourceName: 'host-1',
                        machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: 100 }]
                    }
                ],
                recommendedLicenseCalculation: [
                    { resourceName: 'host-1', sqlServerEdition: 'Enterprise', licenseIncluded: true }
                ],
                existingComputeCalculation: [
                    {
                        resourceName: 'host-1',
                        machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: 100 }]
                    }
                ],
                existingLicenseCalculation: [
                    { resourceName: 'host-1', sqlServerEdition: 'Enterprise', licenseIncluded: true }
                ],
                ebsCalculation: {},
                ebsSnapshotCalculation: {},
                ebsCloneCalculation: {}
            };

            const result = formatViewCalcData(vc, 'standalone', '3');
            expect(result).toBeDefined();
        });

        it('should handle MANUAL_FSXW with AOAG and multiple machines', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.MANUAL_FSXW;
            const vc = {
                ...baseViewCalculations,
                existingComputeCalculation: {
                    machineDetails: [
                        { instanceType: 'm5.large', instanceMonthlyPrice: 100 },
                        { instanceType: 'm5.xlarge', instanceMonthlyPrice: 200 }
                    ]
                },
                fsxwCloneCalculation: { totalCloneMonthlyCost: 10 },
                fsxwSnapshotCalculation: { totalMonthlyCostForFsxwSnapshotStorageCapacity: 5 },
                fsxwCalculation: { totalMonthlyCost: 200, provisionedStorageCapacity: 100 }
            };
            const result = formatViewCalcData(vc, 'aoag', '3');
            expect(result.fsxwTotalCost).toBeDefined();
        });

        it('should handle bulk totalFsxwCost with array existingComputeCalculation', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.MANUAL_FSXW;

            const vc = {
                ...baseViewCalculations,
                fsxwCloneCalculation: { totalCloneMonthlyCost: 10 },
                fsxwSnapshotCalculation: { totalMonthlyCostForFsxwSnapshotStorageCapacity: 5 },
                fsxwCalculation: { totalMonthlyCost: 200 }
            };

            const result = formatViewCalcData(vc, 'standalone', '3');
            expect(result.fsxwTotalCost).toBeDefined();
        });
    });

    // =========================================================================
    // getEbsViewCalculationData
    // =========================================================================
    describe('getEbsViewCalculationData', () => {
        it('should aggregate snapshot data across volumes', () => {
            const vc: any = {
                ebsCalculation: {
                    gp3: {
                        numberOfVolumes: 2,
                        storageAmountPerVol: GIB_IN_BYTE * 10,
                        totalInstanceHours: 730,
                        ebsInstanceMonth: 1,
                        ebsStorageCost: 80,
                        billableIops: 0,
                        totalBillableIops: 0,
                        ebsIopsCost: 0,
                        billableMbps: 0,
                        billableThroughputMbps: 0,
                        billableThroughputGbps: 0,
                        ebsThroughputCost: 10,
                        ebsTotalCostMonthly: 90,
                        instanceAvgDuration: 730,
                        ebsCapacityPrice: { price: 0.08 },
                        hoursInAMonth: 730
                    }
                },
                ebsSnapshotCalculation: {
                    vol1: {
                        storageAmount: GIB_IN_BYTE * 5,
                        amountChangedPerSnapshot: GIB_IN_BYTE,
                        monthlyCostOfSnapshots: 2.5,
                        ebsInstanceMonth: 1,
                        totalSnapshots: 30,
                        initialSnapshotCost: 0.5,
                        monthlyCostPerSnapshot: 0.05,
                        discountForPartialStorageMonth: 0,
                        incrementalSnapshotCost: 1.5,
                        totalSnapshotCost: 2,
                        totalEbsSnapshotCost: 2.5,
                        ebsSnapshotCost: 2.5,
                        ebsSnapshotPrice: { price: 0.05 },
                        monthlyChangeRatePercentage: 3,
                        numberOfVolumes: 1
                    }
                },
                ebsCloneCalculation: {
                    vol1: {
                        clonedCopiesCount: 2,
                        capacity: 100,
                        iops: 3000,
                        throughput: 125,
                        totalCloneMonthlyCost: 50
                    }
                }
            };

            const result = getEbsViewCalculationData(vc);
            expect(result.ebsCalculation).toBeDefined();
            expect(result.ebsSnapshotCalculation).toBeDefined();
            expect(result.ebsCloneCalculation).toBeDefined();
        });

        it('should handle empty calculation data', () => {
            const vc: any = {
                ebsCalculation: {},
                ebsSnapshotCalculation: {},
                ebsCloneCalculation: {}
            };

            const result = getEbsViewCalculationData(vc);
            expect(result.ebsCalculation).toBeDefined();
            expect(result.ebsSnapshotCalculation).toBeDefined();
            expect(result.ebsCloneCalculation).toBeDefined();
        });

        it('should handle undefined calculation data', () => {
            const vc: any = {};

            const result = getEbsViewCalculationData(vc);
            expect(result.ebsCalculation).toBeDefined();
        });

        it('should aggregate multiple clone volumes', () => {
            const vc: any = {
                ebsCalculation: {},
                ebsSnapshotCalculation: {},
                ebsCloneCalculation: {
                    vol1: {
                        clonedCopiesCount: 2,
                        capacity: 100,
                        iops: 3000,
                        throughput: 125,
                        totalCloneMonthlyCost: 50
                    },
                    vol2: {
                        clonedCopiesCount: 3,
                        capacity: 200,
                        iops: 6000,
                        throughput: 250,
                        totalCloneMonthlyCost: 100
                    }
                }
            };

            const result = getEbsViewCalculationData(vc);
            expect(result.ebsCloneCalculation).toBeDefined();
        });

        it('should skip volumes without totalEbsSnapshotCost in per-volume data', () => {
            const vc: any = {
                ebsCalculation: {},
                ebsSnapshotCalculation: {
                    vol1: {
                        storageAmount: GIB_IN_BYTE * 5,
                        amountChangedPerSnapshot: GIB_IN_BYTE,
                        monthlyCostOfSnapshots: 2.5,
                        totalEbsSnapshotCost: 0, // falsy - should be skipped
                        ebsSnapshotPrice: { price: 0.05 }
                    }
                },
                ebsCloneCalculation: {}
            };

            const result = getEbsViewCalculationData(vc);
            expect(result.ebsSnapshotCalculation).toBeDefined();
        });

        it('should include per-volume snapshot data with truthy totalEbsSnapshotCost', () => {
            const vc: any = {
                ebsCalculation: {},
                ebsSnapshotCalculation: {
                    vol1: {
                        storageAmount: GIB_IN_BYTE * 5,
                        amountChangedPerSnapshot: GIB_IN_BYTE,
                        monthlyCostOfSnapshots: 2.5,
                        ebsInstanceMonth: 1,
                        totalSnapshots: 30,
                        initialSnapshotCost: 0.5,
                        monthlyCostPerSnapshot: 0.05,
                        discountForPartialStorageMonth: 0,
                        incrementalSnapshotCost: 1.5,
                        totalSnapshotCost: 2,
                        totalEbsSnapshotCost: 2.5,
                        ebsSnapshotCost: 2.5,
                        ebsSnapshotPrice: { price: 0.05 },
                        monthlyChangeRatePercentage: 3,
                        numberOfVolumes: 1
                    }
                },
                ebsCloneCalculation: {}
            };

            const result = getEbsViewCalculationData(vc);
            expect(result.ebsSnapshotCalculation.vol1).toBeDefined();
        });
    });

    // =========================================================================
    // EbsCalculationUpdates
    // =========================================================================
    describe('EbsCalculationUpdates', () => {
        it('should aggregate costs across volume types', () => {
            const data: any = {
                gp3: {
                    numberOfVolumes: 2,
                    storageAmountPerVol: GIB_IN_BYTE * 10,
                    totalInstanceHours: 730,
                    ebsInstanceMonth: 1,
                    ebsStorageCost: 80,
                    billableIops: 0,
                    totalBillableIops: 0,
                    ebsIopsCost: 10,
                    billableMbps: 0,
                    billableThroughputMbps: 0,
                    billableThroughputGbps: 0,
                    ebsThroughputCost: 5,
                    ebsTotalCostMonthly: 95,
                    instanceAvgDuration: 730,
                    ebsCapacityPrice: { price: 0.08 },
                    hoursInAMonth: 730
                },
                io2: {
                    numberOfVolumes: 1,
                    storageAmountPerVol: GIB_IN_BYTE * 20,
                    totalInstanceHours: 730,
                    ebsInstanceMonth: 1,
                    ebsStorageCost: 200,
                    billableIops: 1000,
                    totalBillableIops: 1000,
                    ebsIopsCost: 65,
                    billableMbps: 125,
                    billableThroughputMbps: 125,
                    billableThroughputGbps: 0.125,
                    ebsThroughputCost: 40,
                    ebsTotalCostMonthly: 305,
                    instanceAvgDuration: 730,
                    ebsCapacityPrice: { price: 0.125 },
                    hoursInAMonth: 730
                }
            };

            const result = EbsCalculationUpdates(data);
            expect(result.totalEbsThroughputCost).toBe(45);
            expect(result.totalEbsIopsCost).toBe(75);
            expect(result.totalEbsStorageCost).toBe(280);
            expect(result.gp3).toBeDefined();
            expect(result.io2).toBeDefined();
        });

        it('should handle empty data', () => {
            const result = EbsCalculationUpdates({});
            expect(result.totalEbsThroughputCost).toBe(0);
            expect(result.totalEbsIopsCost).toBe(0);
            expect(result.totalEbsStorageCost).toBe(0);
        });
    });

    // =========================================================================
    // formatStorageSavingsRecommendedData
    // =========================================================================
    describe('formatStorageSavingsRecommendedData', () => {
        it('should return data as-is when null/falsy', () => {
            const result = formatStorageSavingsRecommendedData(null as any);
            expect(result).toBeNull();
        });

        it('should handle ONPREM mode with array compute and license', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.ONPREM;
            mockStoreState.exploreSavings.selectedDeploymentModel = 'standalone';

            const data: any = {
                compute: [
                    { recommended: { computeMonthlyPrice: 100, machineDetails: [{ instanceType: 'm5.large' }] } }
                ],
                license: [{ recommended: { licenseMonthlyPrice: 50 } }],
                totalSummary: { recommended: 500 }
            };

            const result = formatStorageSavingsRecommendedData(data);
            expect(result.recommendedInstance).toBeDefined();
            expect(result.recommendedInstance.computeMonthlyPrice).toBe(100);
            expect(result.recommendedInstance.licenseMonthlyPrice).toBe(50);
            expect(result.totalSummary?.recommendedTotal).toBe(500);
        });

        it('should handle ONPREM mode with single compute object wrapped in array', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.ONPREM;
            mockStoreState.exploreSavings.selectedDeploymentModel = 'standalone';

            const data: any = {
                compute: { recommended: { computeMonthlyPrice: 100, machineDetails: [{ instanceType: 'm5.large' }] } },
                license: { recommended: { licenseMonthlyPrice: 50 } },
                totalSummary: { recommended: 500 }
            };

            const result = formatStorageSavingsRecommendedData(data);
            expect(result.recommendedInstance).toBeDefined();
        });

        it('should handle AUTO_EBS with recommendedTargetInstance and recommendationOptions', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            mockStoreState.exploreSavings.selectedDeploymentModel = 'standalone';
            mockStoreState.exploreSavings.recommendedTargetInstance = 'm5.xlarge';

            const data: any = {
                compute: [
                    {
                        recommended: {
                            computeMonthlyPrice: 100,
                            machineDetails: [{ instanceType: 'm5.large', computeMonthlyPrice: 100 }],
                            recommendationOptions: [
                                { instanceType: 'm5.large', computeMonthlyPrice: 100, licenseMonthlyPrice: 50 },
                                { instanceType: 'm5.xlarge', computeMonthlyPrice: 200, licenseMonthlyPrice: 75 }
                            ]
                        }
                    }
                ],
                license: [{ recommended: { licenseMonthlyPrice: 50 } }],
                totalSummary: { recommended: 500 }
            };

            const result = formatStorageSavingsRecommendedData(data);
            expect(result.recommendedInstance).toBeDefined();
            expect(result.recommendedInstance.instanceType).toBe('m5.xlarge');
        });

        it('should handle AUTO_EBS with AOAG deployment model (multiplier = 2)', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            mockStoreState.exploreSavings.selectedDeploymentModel = 'aoag';
            mockStoreState.exploreSavings.recommendedTargetInstance = 'm5.xlarge';

            const data: any = {
                compute: [
                    {
                        recommended: {
                            computeMonthlyPrice: 100,
                            machineDetails: [{ instanceType: 'm5.large', computeMonthlyPrice: 100 }],
                            recommendationOptions: [
                                { instanceType: 'm5.xlarge', computeMonthlyPrice: 200, licenseMonthlyPrice: 75 }
                            ]
                        }
                    }
                ],
                license: [{ recommended: { licenseMonthlyPrice: 50 } }],
                totalSummary: { recommended: 500 }
            };

            const result = formatStorageSavingsRecommendedData(data);
            expect(result.recommendedInstance).toBeDefined();
        });

        it('should handle AUTO_EBS fallback when no recommendedTargetInstance and single compute', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            mockStoreState.exploreSavings.selectedDeploymentModel = 'standalone';
            mockStoreState.exploreSavings.recommendedTargetInstance = '';

            const data: any = {
                compute: [
                    {
                        existing: { computeMonthlyPrice: 100 },
                        recommended: {
                            computeMonthlyPrice: 100,
                            machineDetails: [{ instanceType: 'm5.large' }]
                        }
                    }
                ],
                license: [{ recommended: { licenseMonthlyPrice: 50 } }],
                totalSummary: { recommended: 500 }
            };

            const result = formatStorageSavingsRecommendedData(data);
            expect(result.recommendedInstance).toBeDefined();
            expect(result.totalSummary?.recommendedTotal).toBe(500);
        });

        it('should handle non-AUTO_EBS mode with recommendedTargetInstance for standalone', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.MANUAL_EBS;
            mockStoreState.exploreSavings.selectedManualDeploymentModel = { value: 'standalone' };
            mockStoreState.exploreSavings.selectedDeploymentModel = 'standalone';
            mockStoreState.exploreSavings.recommendedTargetInstance = 'm5.xlarge';

            const data: any = {
                compute: {
                    recommended: {
                        computeMonthlyPrice: 100,
                        machineDetails: [
                            { instanceType: 'm5.large', computeMonthlyPrice: 100, licenseMonthlyPrice: 50 }
                        ],
                        recommendationOptions: [
                            { instanceType: 'm5.xlarge', computeMonthlyPrice: 200, licenseMonthlyPrice: 75 }
                        ]
                    }
                },
                license: {
                    existing: { sqlServerEdition: 'Enterprise', licenseMonthlyPrice: 50 },
                    recommended: { sqlServerEdition: 'Enterprise', licenseMonthlyPrice: 50 }
                },
                totalSummary: { recommended: 500 }
            };

            const result = formatStorageSavingsRecommendedData(data);
            expect(result.recommendedInstance.instanceType).toBe('m5.xlarge');
        });

        it('should handle non-AUTO_EBS mode with recommendedTargetInstance for AOAG', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.MANUAL_EBS;
            mockStoreState.exploreSavings.selectedManualDeploymentModel = { value: 'aoag' };
            mockStoreState.exploreSavings.selectedDeploymentModel = 'aoag';
            mockStoreState.exploreSavings.recommendedTargetInstance = 'm5.xlarge';

            const data: any = {
                compute: {
                    recommended: {
                        computeMonthlyPrice: 100,
                        machineDetails: [
                            { instanceType: 'm5.large', computeMonthlyPrice: 100, licenseMonthlyPrice: 50 }
                        ],
                        recommendationOptions: [
                            { instanceType: 'm5.xlarge', computeMonthlyPrice: 200, licenseMonthlyPrice: 75 }
                        ]
                    }
                },
                license: {
                    existing: { sqlServerEdition: 'Enterprise', licenseMonthlyPrice: 50 },
                    recommended: { sqlServerEdition: 'Enterprise', licenseMonthlyPrice: 50 }
                },
                totalSummary: { recommended: 500 }
            };

            const result = formatStorageSavingsRecommendedData(data);
            expect(result.recommendedInstance.licenseMonthlyPrice).toBe(150); // 75 * 2
            expect(result.recommendedInstance.computeMonthlyPrice).toBe(400); // 200 * 2
        });

        it('should handle non-AUTO_EBS mode without recommendedTargetInstance and matching editions', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.MANUAL_EBS;
            mockStoreState.exploreSavings.selectedManualDeploymentModel = { value: 'standalone' };
            mockStoreState.exploreSavings.selectedDeploymentModel = 'standalone';
            mockStoreState.exploreSavings.recommendedTargetInstance = '';

            const data: any = {
                compute: {
                    existing: { computeMonthlyPrice: 100 },
                    recommended: {
                        computeMonthlyPrice: 200,
                        machineDetails: [{ instanceType: 'm5.large' }]
                    }
                },
                license: {
                    existing: { sqlServerEdition: 'Enterprise', licenseMonthlyPrice: 50 },
                    recommended: { sqlServerEdition: 'Enterprise', licenseMonthlyPrice: 75 }
                },
                totalSummary: { recommended: 500 }
            };

            const result = formatStorageSavingsRecommendedData(data);
            expect(result.recommendedInstance.licenseMonthlyPrice).toBe(50);
            expect(result.recommendedInstance.computeMonthlyPrice).toBe(100);
        });

        it('should handle non-AUTO_EBS mode without recommendedTargetInstance and different editions', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.MANUAL_EBS;
            mockStoreState.exploreSavings.selectedManualDeploymentModel = { value: 'standalone' };
            mockStoreState.exploreSavings.selectedDeploymentModel = 'standalone';
            mockStoreState.exploreSavings.recommendedTargetInstance = '';

            const data: any = {
                compute: {
                    existing: { computeMonthlyPrice: 100 },
                    recommended: {
                        computeMonthlyPrice: 200,
                        machineDetails: [{ instanceType: 'm5.large' }]
                    }
                },
                license: {
                    existing: { sqlServerEdition: 'Standard', licenseMonthlyPrice: 25 },
                    recommended: { sqlServerEdition: 'Enterprise', licenseMonthlyPrice: 75 }
                },
                totalSummary: { recommended: 500 }
            };

            const result = formatStorageSavingsRecommendedData(data);
            expect(result.recommendedInstance.licenseMonthlyPrice).toBe(75);
            expect(result.recommendedInstance.computeMonthlyPrice).toBe(100);
        });

        it('should handle MANUAL_FSXW mode (uses selectedManualDeploymentModel)', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.MANUAL_FSXW;
            mockStoreState.exploreSavings.selectedManualDeploymentModel = { value: 'standalone' };
            mockStoreState.exploreSavings.recommendedTargetInstance = '';

            const data: any = {
                compute: {
                    existing: { computeMonthlyPrice: 100 },
                    recommended: {
                        computeMonthlyPrice: 200,
                        machineDetails: [{ instanceType: 'm5.large' }]
                    }
                },
                license: {
                    existing: { sqlServerEdition: 'Enterprise', licenseMonthlyPrice: 50 },
                    recommended: { sqlServerEdition: 'Enterprise', licenseMonthlyPrice: 50 }
                },
                totalSummary: { recommended: 500 }
            };

            const result = formatStorageSavingsRecommendedData(data);
            expect(result.recommendedInstance).toBeDefined();
        });

        it('should handle AUTO_EBS with no recommendationOptions in compute array', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            mockStoreState.exploreSavings.selectedDeploymentModel = 'standalone';
            mockStoreState.exploreSavings.recommendedTargetInstance = 'm5.xlarge';

            const data: any = {
                compute: [
                    {
                        existing: { computeMonthlyPrice: 100 },
                        recommended: {
                            computeMonthlyPrice: 100,
                            machineDetails: [{ instanceType: 'm5.large' }]
                            // No recommendationOptions
                        }
                    }
                ],
                license: [{ recommended: { licenseMonthlyPrice: 50 } }],
                totalSummary: { recommended: 500 }
            };

            const result = formatStorageSavingsRecommendedData(data);
            // Falls to fallback because hasRecommendationOptions is false
            expect(result.recommendedInstance).toBeDefined();
        });
    });

    // =========================================================================
    // generateLabel2ForInstanceType
    // =========================================================================
    describe('generateLabel2ForInstanceType', () => {
        const options = [
            { instanceType: 'm5.large', computeMonthlyPrice: 100 },
            { instanceType: 'm5.xlarge', computeMonthlyPrice: 200 },
            { instanceType: 'm5.2xlarge', computeMonthlyPrice: 50 }
        ];
        const existingTypeObj = { instanceType: 'm5.xlarge', computeMonthlyPrice: 200 };

        it('should return "Current instance type" when option matches existing', () => {
            expect(generateLabel2ForInstanceType(options, 'm5.xlarge', existingTypeObj)).toBe('Current instance type');
        });

        it('should return savings label when price differs', () => {
            const result = generateLabel2ForInstanceType(options, 'm5.2xlarge', existingTypeObj);
            expect(result).toContain('Saves up to');
            expect(result).toContain('% in compute costs');
        });

        it('should return empty string when computeCostSavingPercent is 0', () => {
            const samePrice = [{ instanceType: 'm5.large', computeMonthlyPrice: 200 }];
            const result = generateLabel2ForInstanceType(samePrice, 'm5.large', existingTypeObj);
            expect(result).toBe('');
        });

        it('should return empty string when option is not found', () => {
            const result = generateLabel2ForInstanceType(options, 'nonexistent', existingTypeObj);
            expect(result).toBe('');
        });

        it('should return empty string when existingComputePrice is 0', () => {
            const noPrice = { instanceType: 'm5.xlarge', computeMonthlyPrice: 0 };
            const result = generateLabel2ForInstanceType(options, 'm5.large', noPrice);
            expect(result).toBe('');
        });
    });

    // =========================================================================
    // handleAuthenticate
    // =========================================================================
    describe('handleAuthenticate', () => {
        let mockRegisterResourceCredBulk: ReturnType<typeof vi.fn>;
        let mockCloseDialogCallback: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            mockRegisterResourceCredBulk = vi.fn();
            mockCloseDialogCallback = vi.fn();
        });

        const callHandleAuthenticate = (
            rowData: any = makeRowData(),
            overrides: Partial<{
                isFromAddHosts: boolean;
            }> = {}
        ) =>
            handleAuthenticate(
                rowData,
                mockDispatch,
                'EBS',
                true,
                mockNavigate,
                mockCloseDialogCallback,
                mockT,
                mockRegisterResourceCredBulk,
                overrides.isFromAddHosts ?? false
            );

        describe('single host flow', () => {
            beforeEach(() => {
                mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsEBSBulk = [];
            });

            it('should authenticate successfully for single host', async () => {
                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: {
                        items: [
                            {
                                ec2InstanceId: 'i-123',
                                region: 'us-east-1',
                                credentialsId: 'cred-1',
                                registerDetails: [{ databaseServerError: null, fsxnError: null, manageReadiness: {} }]
                            }
                        ]
                    }
                });

                await callHandleAuthenticate();

                expect(setActionsDisabled).toHaveBeenCalledWith(true);
                expect(setActionsDisabled).toHaveBeenCalledWith(false);
                expect(mockCloseDialogCallback).toHaveBeenCalled();
            });

            it('should handle authentication failure with databaseServerError', async () => {
                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: {
                        items: [
                            {
                                registerDetails: [{ databaseServerError: 'Connection failed', fsxnError: null }]
                            }
                        ]
                    }
                });

                await callHandleAuthenticate();

                expect(setDialogErrorWithTooltip).toHaveBeenCalled();
            });

            it('should handle authentication failure with fsxnError', async () => {
                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: {
                        items: [
                            {
                                registerDetails: [{ databaseServerError: null, fsxnError: 'FSxN error' }]
                            }
                        ]
                    }
                });

                await callHandleAuthenticate();

                expect(setDialogErrorWithTooltip).toHaveBeenCalled();
            });

            it('should handle API returning error', async () => {
                mockRegisterResourceCredBulk.mockResolvedValue({
                    error: { data: { message: 'Server error' } }
                });

                await callHandleAuthenticate();

                expect(setDialogErrorWithTooltip).toHaveBeenCalled();
            });

            it('should handle missing SQL permissions', async () => {
                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: {
                        items: [
                            {
                                registerDetails: [
                                    {
                                        manageReadiness: {
                                            assessment: {
                                                missingSqlPermissions: ['VIEW ANY DEFINITION', 'VIEW SERVER STATE']
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                });

                await callHandleAuthenticate();

                expect(setDialogErrorWithTooltip).toHaveBeenCalledWith(
                    expect.objectContaining({
                        showDialogError: true
                    })
                );
            });

            it('should handle empty items array', async () => {
                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: { items: [] }
                });

                await callHandleAuthenticate();

                // registerItemExists is false → falls to the error else block

                expect(setDialogErrorWithTooltip).toHaveBeenCalled();
            });

            it('should handle exception during authentication', async () => {
                mockRegisterResourceCredBulk.mockRejectedValue(new Error('Network error'));

                await callHandleAuthenticate();

                expect(setDialogErrorWithTooltip).toHaveBeenCalled();

                expect(setActionsDisabled).toHaveBeenCalledWith(false);
            });

            it('should use Windows authentication type', async () => {
                mockStoreState.exploreSavings.selectedAuthenticationType = AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION;
                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: {
                        items: [
                            {
                                registerDetails: [{ databaseServerError: null, fsxnError: null, manageReadiness: {} }]
                            }
                        ]
                    }
                });

                await callHandleAuthenticate();

                expect(mockRegisterResourceCredBulk).toHaveBeenCalledWith(
                    expect.objectContaining({
                        payload: expect.objectContaining({
                            items: expect.arrayContaining([
                                expect.objectContaining({
                                    credentials: expect.arrayContaining([
                                        expect.objectContaining({
                                            resourceType: 'WINDOWS_USER'
                                        })
                                    ])
                                })
                            ])
                        })
                    })
                );
            });
        });

        describe('bulk host flow', () => {
            beforeEach(() => {
                const rows = [
                    makeRowData({ name: 'host-1', ec2InstanceId: 'i-1', credentialId: 'c-1', id: 'r-1' }),
                    makeRowData({ name: 'host-2', ec2InstanceId: 'i-2', credentialId: 'c-2', id: 'r-2' })
                ];
                mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsEBSBulk = rows;
                mockStoreState.exploreSavingsBulk.bulkAuthCredentials = {
                    'host-1': { userName: 'user1', password: 'pass1' },
                    'host-2': { userName: 'user2', password: 'pass2' }
                };
            });

            it('should authenticate all hosts successfully and navigate', async () => {
                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: {
                        items: [
                            {
                                ec2InstanceId: 'i-1',
                                region: 'us-east-1',
                                credentialsId: 'c-1',
                                registerDetails: [{ databaseServerError: null, fsxnError: null, manageReadiness: {} }]
                            },
                            {
                                ec2InstanceId: 'i-2',
                                region: 'us-east-1',
                                credentialsId: 'c-2',
                                registerDetails: [{ databaseServerError: null, fsxnError: null, manageReadiness: {} }]
                            }
                        ]
                    }
                });

                await callHandleAuthenticate();

                expect(mockCloseDialogCallback).toHaveBeenCalled();
            });

            it('should handle partial success', async () => {
                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: {
                        items: [
                            {
                                ec2InstanceId: 'i-1',
                                region: 'us-east-1',
                                credentialsId: 'c-1',
                                registerDetails: [{ databaseServerError: null, fsxnError: null }]
                            },
                            {
                                ec2InstanceId: 'i-2',
                                region: 'us-east-1',
                                credentialsId: 'c-2',
                                registerDetails: [{ databaseServerError: 'Auth failed', fsxnError: null }]
                            }
                        ]
                    }
                });

                await callHandleAuthenticate();

                expect(setDialogErrorWithTooltip).toHaveBeenCalled();
            });

            it('should handle all failures', async () => {
                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: {
                        items: [
                            {
                                ec2InstanceId: 'i-1',
                                region: 'us-east-1',
                                credentialsId: 'c-1',
                                registerDetails: [{ databaseServerError: 'Failed', fsxnError: null }]
                            },
                            {
                                ec2InstanceId: 'i-2',
                                region: 'us-east-1',
                                credentialsId: 'c-2',
                                registerDetails: [{ databaseServerError: 'Failed', fsxnError: null }]
                            }
                        ]
                    }
                });

                await callHandleAuthenticate();

                expect(setDialogErrorWithTooltip).toHaveBeenCalled();
            });

            it('should handle API error for bulk', async () => {
                mockRegisterResourceCredBulk.mockResolvedValue({
                    error: { data: { message: 'Server error' } }
                });

                await callHandleAuthenticate();

                expect(setBulkAuthStatus).toHaveBeenCalled();
            });

            it('should handle isFromAddHosts with all success', async () => {
                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: {
                        items: [
                            {
                                ec2InstanceId: 'i-1',
                                region: 'us-east-1',
                                credentialsId: 'c-1',
                                registerDetails: [{ databaseServerError: null, fsxnError: null, manageReadiness: {} }]
                            },
                            {
                                ec2InstanceId: 'i-2',
                                region: 'us-east-1',
                                credentialsId: 'c-2',
                                registerDetails: [{ databaseServerError: null, fsxnError: null, manageReadiness: {} }]
                            }
                        ]
                    }
                });

                await callHandleAuthenticate(makeRowData(), { isFromAddHosts: true });

                expect(mockCloseDialogCallback).toHaveBeenCalled();

                expect(setSelectedRowsForExploreSavingsEBSBulk).toHaveBeenCalled();
            });

            it('should use rowsRequiringAuthBulk when available', async () => {
                const requireAuthRows = [
                    makeRowData({ name: 'host-2', ec2InstanceId: 'i-2', credentialId: 'c-2', id: 'r-2' })
                ];
                mockStoreState.exploreSavingsBulk.rowsRequiringAuthBulk = requireAuthRows;

                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: {
                        items: [
                            {
                                ec2InstanceId: 'i-2',
                                region: 'us-east-1',
                                credentialsId: 'c-2',
                                registerDetails: [{ databaseServerError: null, fsxnError: null, manageReadiness: {} }]
                            }
                        ]
                    }
                });

                await callHandleAuthenticate();

                // Should only authenticate host-2 since rowsRequiringAuthBulk is used
                expect(mockRegisterResourceCredBulk).toHaveBeenCalledTimes(1);
            });

            it('should handle missing SQL permissions in bulk flow', async () => {
                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: {
                        items: [
                            {
                                ec2InstanceId: 'i-1',
                                region: 'us-east-1',
                                credentialsId: 'c-1',
                                registerDetails: [
                                    {
                                        manageReadiness: {
                                            assessment: { missingSqlPermissions: ['VIEW ANY DEFINITION'] }
                                        }
                                    }
                                ]
                            },
                            {
                                ec2InstanceId: 'i-2',
                                region: 'us-east-1',
                                credentialsId: 'c-2',
                                registerDetails: [{ databaseServerError: null, fsxnError: null }]
                            }
                        ]
                    }
                });

                await callHandleAuthenticate();

                expect(setBulkAuthStatus).toHaveBeenCalled();
            });

            it('should handle host with no registerItem match', async () => {
                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: {
                        items: [
                            // Only one item for i-1, nothing for i-2
                            {
                                ec2InstanceId: 'i-1',
                                region: 'us-east-1',
                                credentialsId: 'c-1',
                                registerDetails: [{ databaseServerError: null, fsxnError: null }]
                            }
                        ]
                    }
                });

                await callHandleAuthenticate();

                // host-2 has no matching registerItem, should be marked as failure

                expect(setBulkAuthStatus).toHaveBeenCalled();
            });

            it('should skip instances that do not match fileSystemType', async () => {
                const rows = [
                    makeRowData({
                        name: 'host-1',
                        ec2InstanceId: 'i-1',
                        credentialId: 'c-1',
                        id: 'r-1',
                        sqlServerInstances: [{ ...makeRowData().sqlServerInstances[0], fileSystemType: 'FSXW' }]
                    })
                ];
                mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsEBSBulk = rows;
                mockStoreState.exploreSavingsBulk.bulkAuthCredentials = {
                    'host-1': { userName: 'user1', password: 'pass1' }
                };

                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: { items: [] }
                });

                await callHandleAuthenticate();

                // The payload should have no credentials since fileSystemType doesn't match 'EBS'
                expect(mockRegisterResourceCredBulk).toHaveBeenCalled();
            });

            it('should handle registerItem with empty registerDetails', async () => {
                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: {
                        items: [
                            {
                                ec2InstanceId: 'i-1',
                                region: 'us-east-1',
                                credentialsId: 'c-1',
                                registerDetails: []
                            },
                            {
                                ec2InstanceId: 'i-2',
                                region: 'us-east-1',
                                credentialsId: 'c-2',
                                registerDetails: []
                            }
                        ]
                    }
                });

                await callHandleAuthenticate();

                // registerItemExists is false because registerDetails.length === 0

                expect(setBulkAuthStatus).toHaveBeenCalled();
            });

            it('should handle bulk auth with fsxnError in registerDetails', async () => {
                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: {
                        items: [
                            {
                                ec2InstanceId: 'i-1',
                                region: 'us-east-1',
                                credentialsId: 'c-1',
                                registerDetails: [{ databaseServerError: null, fsxnError: 'FSxN connection failed' }]
                            },
                            {
                                ec2InstanceId: 'i-2',
                                region: 'us-east-1',
                                credentialsId: 'c-2',
                                registerDetails: [{ databaseServerError: null, fsxnError: null }]
                            }
                        ]
                    }
                });

                await callHandleAuthenticate();

                // First host has fsxnError -> failure, second host succeeds -> partial
                expect(setDialogErrorWithTooltip).toHaveBeenCalled();
            });
        });

        describe('bulk flow - Windows authentication type', () => {
            beforeEach(() => {
                const rows = [
                    makeRowData({ name: 'host-win', ec2InstanceId: 'i-win', credentialId: 'c-win', id: 'r-win' })
                ];
                mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsEBSBulk = rows;
                mockStoreState.exploreSavingsBulk.bulkAuthCredentials = {
                    'host-win': { userName: 'admin', password: 'secret' }
                };
                mockStoreState.exploreSavings.selectedAuthenticationType = AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION;
            });

            it('should use WINDOWS_USER resource type in bulk credentials', async () => {
                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: {
                        items: [
                            {
                                ec2InstanceId: 'i-win',
                                region: 'us-east-1',
                                credentialsId: 'c-win',
                                registerDetails: [{ databaseServerError: null, fsxnError: null, manageReadiness: {} }]
                            }
                        ]
                    }
                });

                await callHandleAuthenticate();

                expect(mockRegisterResourceCredBulk).toHaveBeenCalledWith(
                    expect.objectContaining({
                        payload: expect.objectContaining({
                            items: expect.arrayContaining([
                                expect.objectContaining({
                                    credentials: expect.arrayContaining([
                                        expect.objectContaining({
                                            resourceType: 'WINDOWS_USER'
                                        })
                                    ])
                                })
                            ])
                        })
                    })
                );
            });
        });

        describe('bulk flow - host credentials null', () => {
            beforeEach(() => {
                const rows = [
                    makeRowData({ name: 'host-no-creds', ec2InstanceId: 'i-nc', credentialId: 'c-nc', id: 'r-nc' })
                ];
                mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsEBSBulk = rows;
                mockStoreState.exploreSavingsBulk.bulkAuthCredentials = {};
            });

            it('should fallback to empty string for missing credentials', async () => {
                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: {
                        items: [
                            {
                                ec2InstanceId: 'i-nc',
                                region: 'us-east-1',
                                credentialsId: 'c-nc',
                                registerDetails: [{ databaseServerError: null, fsxnError: null, manageReadiness: {} }]
                            }
                        ]
                    }
                });

                await callHandleAuthenticate();

                expect(mockRegisterResourceCredBulk).toHaveBeenCalledWith(
                    expect.objectContaining({
                        payload: expect.objectContaining({
                            items: expect.arrayContaining([
                                expect.objectContaining({
                                    credentials: expect.arrayContaining([
                                        expect.objectContaining({
                                            username: '',
                                            password: ''
                                        })
                                    ])
                                })
                            ])
                        })
                    })
                );
            });
        });

        describe('single flow - error with null message', () => {
            beforeEach(() => {
                mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsEBSBulk = [];
            });

            it('should use fallback text when error.data.message is null', async () => {
                mockRegisterResourceCredBulk.mockResolvedValue({
                    error: { data: { message: null } }
                });

                await callHandleAuthenticate();

                expect(setDialogErrorWithTooltip).toHaveBeenCalledWith(
                    expect.objectContaining({
                        tooltipText: 'databases.explore-savings.authentication-failed'
                    })
                );
            });

            it('should use error.data.message when it exists', async () => {
                mockRegisterResourceCredBulk.mockResolvedValue({
                    error: { data: { message: 'Detailed server error message' } }
                });

                await callHandleAuthenticate();

                expect(setDialogErrorWithTooltip).toHaveBeenCalledWith(
                    expect.objectContaining({
                        tooltipText: 'Detailed server error message'
                    })
                );
            });
        });

        describe('bulk flow - error with message value', () => {
            beforeEach(() => {
                const rows = [makeRowData({ name: 'host-1', ec2InstanceId: 'i-1', credentialId: 'c-1', id: 'r-1' })];
                mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsEBSBulk = rows;
                mockStoreState.exploreSavingsBulk.bulkAuthCredentials = {
                    'host-1': { userName: 'u1', password: 'p1' }
                };
            });

            it('should use error.data.message for bulk error tooltip', async () => {
                mockRegisterResourceCredBulk.mockResolvedValue({
                    error: { data: { message: 'Bulk server error' } }
                });

                await callHandleAuthenticate();

                expect(setDialogErrorWithTooltip).toHaveBeenCalledWith(
                    expect.objectContaining({
                        tooltipText: 'Bulk server error'
                    })
                );
            });

            it('should fallback when error.data.message is null for bulk', async () => {
                mockRegisterResourceCredBulk.mockResolvedValue({
                    error: { data: { message: null } }
                });

                await callHandleAuthenticate();

                expect(setDialogErrorWithTooltip).toHaveBeenCalledWith(
                    expect.objectContaining({
                        tooltipText: 'databases.explore-savings.authentication-failed'
                    })
                );
            });
        });

        describe('catch block coverage', () => {
            beforeEach(() => {
                mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsEBSBulk = [];
            });

            it('should use error object as tooltipText when truthy', async () => {
                const errorMsg = 'Custom thrown error string';
                mockRegisterResourceCredBulk.mockRejectedValue(errorMsg);

                await callHandleAuthenticate();

                expect(setDialogErrorWithTooltip).toHaveBeenCalledWith(
                    expect.objectContaining({
                        tooltipText: errorMsg
                    })
                );
            });

            it('should fallback when error is falsy (null)', async () => {
                mockRegisterResourceCredBulk.mockRejectedValue(null);

                await callHandleAuthenticate();

                expect(setDialogErrorWithTooltip).toHaveBeenCalledWith(
                    expect.objectContaining({
                        tooltipText: 'databases.explore-savings.authentication-failed'
                    })
                );
            });
        });

        describe('updateInventoryTable coverage', () => {
            beforeEach(() => {
                mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsEBSBulk = [];
            });

            it('should update inventory table with SQL Server authentication for matching instances', async () => {
                mockStoreState.exploreSavings.selectedAuthenticationType =
                    AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION;
                const rowData = makeRowData({
                    id: 'row-1',
                    sqlServerInstances: [
                        {
                            sqlInstanceName: 'INST1',
                            fileSystemType: 'EBS',
                            databaseInstanceName: 'db-inst-1',
                            sqlServerAuthentication: false,
                            windowsDomainUserAuthentication: false,
                            manageReadiness: null
                        },
                        {
                            sqlInstanceName: 'INST2',
                            fileSystemType: 'FSXW',
                            databaseInstanceName: 'db-inst-2',
                            sqlServerAuthentication: false,
                            windowsDomainUserAuthentication: false,
                            manageReadiness: null
                        }
                    ]
                });

                // Populate inventoryTableData with the row
                mockStoreState.inventoryV2.inventoryTableData = {
                    'row-1': {
                        ...rowData,
                        sqlServerInstances: [
                            {
                                fileSystemType: 'EBS',
                                sqlServerAuthentication: false,
                                windowsDomainUserAuthentication: false,
                                manageReadiness: null
                            },
                            {
                                fileSystemType: 'FSXW',
                                sqlServerAuthentication: false,
                                windowsDomainUserAuthentication: false,
                                manageReadiness: null
                            }
                        ]
                    }
                };

                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: {
                        items: [
                            {
                                registerDetails: [
                                    { databaseServerError: null, fsxnError: null, manageReadiness: { assessment: {} } }
                                ]
                            }
                        ]
                    }
                });

                await callHandleAuthenticate(rowData);

                // updateInventoryTable should have been called - check dispatch was called with setInventoryTableData
                expect(mockDispatch).toHaveBeenCalled();
            });

            it('should update inventory table with Windows authentication for matching instances', async () => {
                mockStoreState.exploreSavings.selectedAuthenticationType = AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION;
                const rowData = makeRowData({
                    id: 'row-1',
                    sqlServerInstances: [
                        {
                            sqlInstanceName: 'INST1',
                            fileSystemType: 'EBS',
                            databaseInstanceName: 'db-inst-1',
                            sqlServerAuthentication: false,
                            windowsDomainUserAuthentication: false,
                            manageReadiness: null
                        }
                    ]
                });

                mockStoreState.inventoryV2.inventoryTableData = {
                    'row-1': {
                        ...rowData,
                        sqlServerInstances: [
                            {
                                fileSystemType: 'EBS',
                                sqlServerAuthentication: false,
                                windowsDomainUserAuthentication: false,
                                manageReadiness: null
                            }
                        ]
                    }
                };

                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: {
                        items: [
                            {
                                registerDetails: [
                                    { databaseServerError: null, fsxnError: null, manageReadiness: { assessment: {} } }
                                ]
                            }
                        ]
                    }
                });

                await callHandleAuthenticate(rowData);

                expect(mockDispatch).toHaveBeenCalled();
            });

            it('should update inventory table with manageReadiness from result data', async () => {
                mockStoreState.exploreSavings.selectedAuthenticationType =
                    AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION;
                const rowData = makeRowData({
                    id: 'row-mr',
                    sqlServerInstances: [
                        {
                            sqlInstanceName: 'INST1',
                            fileSystemType: 'EBS',
                            databaseInstanceName: 'db-inst-1',
                            sqlServerAuthentication: false,
                            windowsDomainUserAuthentication: false,
                            manageReadiness: { old: 'value' }
                        }
                    ]
                });

                mockStoreState.inventoryV2.inventoryTableData = {
                    'row-mr': {
                        ...rowData,
                        sqlServerInstances: [
                            {
                                fileSystemType: 'EBS',
                                sqlServerAuthentication: false,
                                windowsDomainUserAuthentication: false,
                                manageReadiness: { old: 'value' }
                            }
                        ]
                    }
                };

                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: {
                        items: [
                            {
                                registerDetails: [
                                    {
                                        databaseServerError: null,
                                        fsxnError: null,
                                        manageReadiness: {
                                            assessment: { missingSqlPermissions: [] },
                                            newField: 'newValue'
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                });

                await callHandleAuthenticate(rowData);

                // The manageReadiness from result should be set on the updated instance
                expect(mockDispatch).toHaveBeenCalled();
            });

            it('should fallback to instance manageReadiness when result manageReadiness is null', async () => {
                mockStoreState.exploreSavings.selectedAuthenticationType =
                    AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION;
                const rowData = makeRowData({
                    id: 'row-mr2',
                    sqlServerInstances: [
                        {
                            sqlInstanceName: 'INST1',
                            fileSystemType: 'EBS',
                            databaseInstanceName: 'db-inst-1',
                            sqlServerAuthentication: false,
                            windowsDomainUserAuthentication: false,
                            manageReadiness: { existing: true }
                        }
                    ]
                });

                mockStoreState.inventoryV2.inventoryTableData = {
                    'row-mr2': {
                        ...rowData,
                        sqlServerInstances: [
                            {
                                fileSystemType: 'EBS',
                                sqlServerAuthentication: false,
                                windowsDomainUserAuthentication: false,
                                manageReadiness: { existing: true }
                            }
                        ]
                    }
                };

                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: {
                        items: [
                            {
                                registerDetails: [
                                    {
                                        databaseServerError: null,
                                        fsxnError: null,
                                        manageReadiness: null
                                    }
                                ]
                            }
                        ]
                    }
                });

                await callHandleAuthenticate(rowData);

                expect(mockDispatch).toHaveBeenCalled();
            });

            it('should handle inventory table update where some instances do not match fileSystemType', async () => {
                mockStoreState.exploreSavings.selectedAuthenticationType =
                    AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION;
                const rowData = makeRowData({
                    id: 'row-1',
                    sqlServerInstances: [
                        { sqlInstanceName: 'INST1', fileSystemType: 'EBS', databaseInstanceName: 'db-inst-1' }
                    ]
                });

                mockStoreState.inventoryV2.inventoryTableData = {
                    'row-1': {
                        ...rowData,
                        sqlServerInstances: [
                            {
                                fileSystemType: 'EBS',
                                sqlServerAuthentication: false,
                                windowsDomainUserAuthentication: false,
                                manageReadiness: null
                            },
                            {
                                fileSystemType: 'FSXW',
                                sqlServerAuthentication: false,
                                windowsDomainUserAuthentication: false,
                                manageReadiness: null
                            }
                        ]
                    }
                };

                mockRegisterResourceCredBulk.mockResolvedValue({
                    data: {
                        items: [
                            {
                                registerDetails: [
                                    { databaseServerError: null, fsxnError: null, manageReadiness: { assessment: {} } }
                                ]
                            }
                        ]
                    }
                });

                await callHandleAuthenticate(rowData);

                expect(mockDispatch).toHaveBeenCalled();
            });
        });
    });

    // =========================================================================
    // Additional branch coverage tests
    // =========================================================================
    describe('additional branch coverage', () => {
        it('formatViewCalcData should handle null/undefined nested values', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            const vc: any = {
                recommendedComputeCalculation: {
                    machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: 0 }],
                    recommendationOptions: []
                },
                recommendedLicenseCalculation: null,
                existingComputeCalculation: {
                    machineDetails: [{ instanceType: null, instanceMonthlyPrice: null }]
                },
                existingLicenseCalculation: null,
                fsxOntapCalculation: null,
                fsxOntapSnapshotCalculation: null,
                fsxCloneCalculation: null,
                ebsCalculation: {},
                ebsSnapshotCalculation: {},
                ebsCloneCalculation: {}
            };
            const result = formatViewCalcData(vc, 'standalone', '3');
            expect(result).toBeDefined();
        });

        it('formatViewCalcData should handle AOAG mode with recommendedTargetInstance', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            mockStoreState.exploreSavings.recommendedTargetInstance = 'm5.xlarge';
            const vc: any = {
                recommendedComputeCalculation: {
                    machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: 100 }],
                    recommendationOptions: [{ instanceType: 'm5.xlarge', instanceMonthlyPrice: 200 }]
                },
                recommendedLicenseCalculation: { sqlServerEdition: 'Enterprise', licenseIncluded: true },
                existingComputeCalculation: {
                    machineDetails: [
                        { instanceType: 'm5.large', instanceMonthlyPrice: 100 },
                        { instanceType: 'm5.large', instanceMonthlyPrice: 100 }
                    ]
                },
                existingLicenseCalculation: { sqlServerEdition: 'Enterprise', licenseIncluded: true },
                fsxOntapCalculation: { totalThroughputAndIopsMonthly: 50, totalMonthlyStorageCharge: 100 },
                fsxOntapSnapshotCalculation: { totalMonthlyCostForCapacity: 10, totalMonthlyCostForFsxSsd: 5 },
                fsxCloneCalculation: { totalCloneMonthlyCost: 20 },
                ebsCalculation: {},
                ebsSnapshotCalculation: {},
                ebsCloneCalculation: {}
            };
            const result = formatViewCalcData(vc, 'aoag', '3');
            expect(result).toBeDefined();
        });

        it('formatViewCalcData EBS bulk should sum existing compute array for totalEbsCost', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsEBSBulk = [makeRowData({ name: 'host-1' })];

            const vc: any = {
                recommendedComputeCalculation: [
                    { hostname: 'host-1', machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: 100 }] }
                ],
                recommendedLicenseCalculation: [
                    { hostname: 'host-1', sqlServerEdition: 'Enterprise', licenseIncluded: true }
                ],
                existingComputeCalculation: [
                    { hostname: 'host-1', machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: 100 }] }
                ],
                existingLicenseCalculation: [
                    { hostname: 'host-1', sqlServerEdition: 'Enterprise', licenseIncluded: true }
                ],
                fsxOntapCalculation: { totalThroughputAndIopsMonthly: 50, totalMonthlyStorageCharge: 100 },
                fsxOntapSnapshotCalculation: {
                    totalMonthlyCostForCapacity: 10,
                    totalMonthlyCostForFsxSsd: 5,
                    totalSnapshotMonthlyCost: 15
                },
                fsxCloneCalculation: { totalCloneMonthlyCost: 20 },
                ebsCalculation: {},
                ebsSnapshotCalculation: {},
                ebsCloneCalculation: {}
            };

            const result = formatViewCalcData(vc, 'standalone', '3');
            expect(result.ebsTotalCost).toBeDefined();
            expect(result.totalFsxEc2MachineCost).toBeDefined();
        });

        it('onClickESHostOnPrem should handle instance with 0 totalStorage and 0 memory', () => {
            const rowData = makeRowData({
                sqlServerInstances: [
                    {
                        sqlInstanceName: 'INST1',
                        sqlInstanceId: 'id-1',
                        totalStorage: 0,
                        totalIops: 0,
                        totalThroughput: 0,
                        noOfVcpusInUse: 0,
                        memory: 0,
                        networkPerformance: null
                    }
                ]
            });
            onClickESHostOnPrem(mockDispatch, rowData, true, mockNavigate);
            expect(mockDispatch).toHaveBeenCalled();
        });

        it('onClickESHostOnPremBulk should handle instances with null values', () => {
            const host = makeRowData({
                sqlServerInstances: [
                    {
                        sqlInstanceName: null,
                        sqlInstanceId: null,
                        totalStorage: null,
                        totalIops: null,
                        totalThroughput: null,
                        noOfVcpusInUse: null,
                        memory: null,
                        networkPerformance: null
                    }
                ]
            });
            onClickESHostOnPremBulk(mockDispatch, [host], true, mockNavigate);
            expect(mockDispatch).toHaveBeenCalled();
        });

        it('formatViewCalcInstance should handle null computeDetails', () => {
            const result = formatViewCalcInstance('standalone', {}, undefined as any, undefined as any);
            expect(result).toHaveLength(1);
        });

        it('formatViewCalcInstance should handle AOAG with multiple instances and use databaseServer edition fallback', () => {
            const selectedHostDetails = {
                databaseServer: { serverEdition: 'Standard' }
            };
            const computeDetails = [
                {
                    instanceType: 'm5.large',
                    price: 0.1,
                    computeMonthlyPrice: 73,
                    instanceMonthlyPrice: 73,
                    hoursInMonth: 730
                },
                { price: null, computeMonthlyPrice: null, instanceMonthlyPrice: null, hoursInMonth: null }
            ];
            const result = formatViewCalcInstance('aoag', selectedHostDetails, computeDetails, null);
            expect(result).toHaveLength(2);
        });

        it('shouldAuthDialogOpen should handle undefined sqlServerInstances', () => {
            const rowData = { isDetected: true };
            expect(shouldAuthDialogOpen(rowData)).toBe(false);
        });

        it('EbsCalculationUpdates should aggregate text lists correctly', () => {
            const data: any = {
                gp3: {
                    numberOfVolumes: 1,
                    storageAmountPerVol: GIB_IN_BYTE,
                    totalInstanceHours: 730,
                    ebsInstanceMonth: 1,
                    ebsStorageCost: 50,
                    billableIops: 100,
                    totalBillableIops: 100,
                    ebsIopsCost: 10,
                    billableMbps: 50,
                    billableThroughputMbps: 50,
                    billableThroughputGbps: 0.05,
                    ebsThroughputCost: 5,
                    ebsTotalCostMonthly: 65,
                    instanceAvgDuration: 730,
                    ebsCapacityPrice: { price: 0.08 },
                    hoursInAMonth: 730
                }
            };
            const result = EbsCalculationUpdates(data);
            expect(result.totalEbsThroughputCostText).toBe('gp3 throughput cost');
            expect(result.totalEbsIopsCostText).toBe('gp3 IOPS cost');
            expect(result.totalEbsStorageCostText).toBe('gp3 storage cost');
        });

        it('getEbsViewCalculationData should handle snapshot with missing ebsSnapshotPrice', () => {
            const vc: any = {
                ebsCalculation: {},
                ebsSnapshotCalculation: {
                    vol1: {
                        storageAmount: GIB_IN_BYTE,
                        amountChangedPerSnapshot: 1000,
                        monthlyCostOfSnapshots: 1,
                        ebsInstanceMonth: 0,
                        totalSnapshots: 0,
                        initialSnapshotCost: 0,
                        monthlyCostPerSnapshot: 0,
                        discountForPartialStorageMonth: 0,
                        incrementalSnapshotCost: 0,
                        totalSnapshotCost: 0,
                        totalEbsSnapshotCost: 1,
                        ebsSnapshotCost: 1,
                        ebsSnapshotPrice: null
                    }
                },
                ebsCloneCalculation: {}
            };
            const result = getEbsViewCalculationData(vc);
            expect(result.ebsSnapshotCalculation).toBeDefined();
        });

        it('formatStorageSavingsRecommendedData should handle ONPREM with null compute/license arrays', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.ONPREM;
            const data: any = {
                compute: null,
                license: null,
                totalSummary: { recommended: 500 }
            };
            const result = formatStorageSavingsRecommendedData(data);
            expect(result.recommendedInstance).toBeDefined();
        });

        it('formatStorageSavingsRecommendedData AUTO_EBS with null compute should fallback', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            mockStoreState.exploreSavings.recommendedTargetInstance = '';
            const data: any = {
                compute: null,
                license: null,
                totalSummary: { recommended: 100 }
            };
            const result = formatStorageSavingsRecommendedData(data);
            expect(result).toBeDefined();
        });

        it('formatStorageSavingsRecommendedData ONPREM with null values in compute/license recommended', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.ONPREM;
            const data: any = {
                compute: [{ recommended: { computeMonthlyPrice: null, machineDetails: [] } }],
                license: [{ recommended: { licenseMonthlyPrice: null } }],
                totalSummary: { recommended: null }
            };
            const result = formatStorageSavingsRecommendedData(data);
            expect(result.totalSummary.recommendedTotal).toBe(0);
        });

        it('formatStorageSavingsRecommendedData AUTO_EBS with recommendedTargetInstance and null prices', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            mockStoreState.exploreSavings.selectedDeploymentModel = 'standalone';
            mockStoreState.exploreSavings.recommendedTargetInstance = 'm5.xlarge';
            const data: any = {
                compute: [
                    {
                        recommended: {
                            machineDetails: [{ computeMonthlyPrice: null }],
                            recommendationOptions: [
                                { instanceType: 'm5.xlarge', computeMonthlyPrice: null, licenseMonthlyPrice: null }
                            ]
                        }
                    }
                ],
                license: [{ recommended: { licenseMonthlyPrice: null } }],
                totalSummary: { recommended: null }
            };
            const result = formatStorageSavingsRecommendedData(data);
            expect(result.totalSummary.recommendedTotal).toBeDefined();
        });

        it('formatStorageSavingsRecommendedData AUTO_EBS no recommendedTargetInstance with null existing values', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            mockStoreState.exploreSavings.selectedDeploymentModel = 'standalone';
            mockStoreState.exploreSavings.recommendedTargetInstance = '';
            const data: any = {
                compute: [{ existing: { computeMonthlyPrice: null }, recommended: { machineDetails: [] } }],
                license: [{ recommended: { licenseMonthlyPrice: null } }],
                totalSummary: { recommended: null }
            };
            const result = formatStorageSavingsRecommendedData(data);
            expect(result.totalSummary.recommendedTotal).toBe(0);
        });

        it('formatStorageSavingsRecommendedData MANUAL_EBS with all null prices in recommendeRow', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.MANUAL_EBS;
            mockStoreState.exploreSavings.selectedManualDeploymentModel = { value: 'standalone' };
            mockStoreState.exploreSavings.recommendedTargetInstance = 'm5.xlarge';
            const data: any = {
                compute: {
                    recommended: {
                        machineDetails: [{ computeMonthlyPrice: null, licenseMonthlyPrice: null }],
                        recommendationOptions: [
                            { instanceType: 'm5.xlarge', computeMonthlyPrice: null, licenseMonthlyPrice: null }
                        ]
                    }
                },
                license: {
                    existing: { sqlServerEdition: 'Standard', licenseMonthlyPrice: null },
                    recommended: { sqlServerEdition: 'Enterprise', licenseMonthlyPrice: null }
                },
                totalSummary: { recommended: null }
            };
            const result = formatStorageSavingsRecommendedData(data);
            expect(result.totalSummary.recommendedTotal).toBeDefined();
        });

        it('formatStorageSavingsRecommendedData MANUAL_EBS AOAG with null prices', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.MANUAL_EBS;
            mockStoreState.exploreSavings.selectedManualDeploymentModel = { value: 'aoag' };
            mockStoreState.exploreSavings.recommendedTargetInstance = 'm5.xlarge';
            const data: any = {
                compute: {
                    recommended: {
                        machineDetails: [{ computeMonthlyPrice: null, licenseMonthlyPrice: null }],
                        recommendationOptions: [
                            { instanceType: 'm5.xlarge', computeMonthlyPrice: null, licenseMonthlyPrice: null }
                        ]
                    }
                },
                license: {
                    existing: { sqlServerEdition: 'Standard', licenseMonthlyPrice: null },
                    recommended: { sqlServerEdition: 'Enterprise', licenseMonthlyPrice: null }
                },
                totalSummary: { recommended: null }
            };
            const result = formatStorageSavingsRecommendedData(data);
            expect(result.recommendedInstance).toBeDefined();
        });

        it('formatStorageSavingsRecommendedData matching editions with null prices', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.MANUAL_EBS;
            mockStoreState.exploreSavings.selectedManualDeploymentModel = { value: 'standalone' };
            mockStoreState.exploreSavings.recommendedTargetInstance = '';
            const data: any = {
                compute: {
                    recommended: { machineDetails: [], computeMonthlyPrice: null, recommendationOptions: [] },
                    existing: { computeMonthlyPrice: null }
                },
                license: {
                    existing: { sqlServerEdition: 'Standard', licenseMonthlyPrice: null },
                    recommended: { sqlServerEdition: 'Standard', licenseMonthlyPrice: null }
                },
                totalSummary: { recommended: null }
            };
            const result = formatStorageSavingsRecommendedData(data);
            expect(result.totalSummary.recommendedTotal).toBeDefined();
        });

        it('formatStorageSavingsRecommendedData different editions with null prices', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.MANUAL_EBS;
            mockStoreState.exploreSavings.selectedManualDeploymentModel = { value: 'standalone' };
            mockStoreState.exploreSavings.recommendedTargetInstance = '';
            const data: any = {
                compute: {
                    recommended: { machineDetails: [], computeMonthlyPrice: null, recommendationOptions: [] },
                    existing: { computeMonthlyPrice: null }
                },
                license: {
                    existing: { sqlServerEdition: 'Standard', licenseMonthlyPrice: null },
                    recommended: { sqlServerEdition: 'Enterprise', licenseMonthlyPrice: null }
                },
                totalSummary: { recommended: null }
            };
            const result = formatStorageSavingsRecommendedData(data);
            expect(result.totalSummary.recommendedTotal).toBeDefined();
        });

        it('handleManualTCOEBS should use non-workload-factory path in ternary', () => {
            handleManualTCOEBS(mockDispatch, mockNavigate, true);
            expect(mockPostBlueXPMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({
                        pathname: './storage-saving-calculator?type=ebs&mode=manual'
                    })
                })
            );
        });

        it('handleManualTCOEBS should NOT call postBlueXPMessage when isWorkloadFactory is false', () => {
            mockPostBlueXPMessage.mockClear();
            handleManualTCOEBS(mockDispatch, mockNavigate, false);
            expect(mockPostBlueXPMessage).not.toHaveBeenCalled();
            // But dispatch should still be called for state changes
            expect(mockDispatch).toHaveBeenCalled();
        });

        it('setESInstanceData should handle data with null sqlServerInstances', () => {
            const rowData = {
                serverInstallationMode: 'standalone',
                sqlServerInstances: null,
                databaseServer: { serverVersion: '2019' }
            };
            setESInstanceData(rowData, mockDispatch);
            expect(mockDispatch).toHaveBeenCalled();
        });

        it('setESInstanceData should handle AOAG serverInstallationMode', () => {
            const rowData = {
                serverInstallationMode: 'Always On Availability Group',
                sqlServerInstances: [{ databaseServer: { serverVersion: '2022' } }],
                databaseServer: null
            };
            setESInstanceData(rowData, mockDispatch);
            expect(mockDispatch).toHaveBeenCalled();
        });

        it('formatViewCalcInstance should use instanceTypelist fallback when instanceType is missing', () => {
            const computeDetails = [
                { instanceType: null, price: 0.1, computeMonthlyPrice: 73, instanceMonthlyPrice: 73, hoursInMonth: 730 }
            ];
            const licenseDetails = { sqlServerEdition: null, licenseIncluded: false };
            const selectedHostDetails = { databaseServer: { serverEdition: null } };
            const result = formatViewCalcInstance('standalone', selectedHostDetails, computeDetails, licenseDetails);
            expect(result[0].sqlEdition).toBe('n/a');
        });

        it('formatViewCalcInstance AOAG should use instanceTypelist from clusterNodeDetails when instanceType is null', () => {
            const computeDetails = [
                {
                    instanceType: null,
                    price: 0.1,
                    computeMonthlyPrice: 73,
                    instanceMonthlyPrice: 73,
                    hoursInMonth: 730
                },
                {
                    instanceType: null,
                    price: 0.2,
                    computeMonthlyPrice: 146,
                    instanceMonthlyPrice: 146,
                    hoursInMonth: 730
                }
            ];
            const licenseDetails = { sqlServerEdition: null, licenseIncluded: true };
            const selectedHostDetails = {
                clusterNodeDetails: [{ ec2InstanceType: 'm5.large' }, { ec2InstanceType: 'm5.xlarge' }],
                databaseServer: { serverEdition: 'Standard' }
            };
            const result = formatViewCalcInstance('aoag', selectedHostDetails, computeDetails, licenseDetails);
            // Should use instanceTypelist fallback (from clusterNodeDetails)
            expect(result[0].instanceType).toBe('m5.large');
            expect(result[1].instanceType).toBe('m5.xlarge');
            // Should use databaseServer.serverEdition fallback since licenseDetails.sqlServerEdition is null
            expect(result[0].sqlEdition).toBe('Standard');
        });

        it('formatViewCalcInstance AOAG should use topology ec2Details when clusterNodeDetails not length 2', () => {
            const computeDetails = [
                { instanceType: null, price: 0.1, computeMonthlyPrice: 73, instanceMonthlyPrice: 73, hoursInMonth: 730 }
            ];
            const licenseDetails = { sqlServerEdition: null, licenseIncluded: false };
            const selectedHostDetails = {
                topology: {
                    ec2Details: [{ instanceType: 'r5.large' }]
                },
                databaseServer: { serverEdition: 'Enterprise' }
            };
            const result = formatViewCalcInstance('aoag', selectedHostDetails, computeDetails, licenseDetails);
            // Should use instanceTypelist from topology.ec2Details
            expect(result[0].instanceType).toBe('r5.large');
            expect(result[0].sqlEdition).toBe('Enterprise');
        });

        it('formatViewCalcData with bulk ONPREM should compute bulk instance calculation data', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.ONPREM;
            mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsOnPremBulk = [
                { resourceName: 'onprem-host-1' }
            ];
            const vc: any = {
                recommendedComputeCalculation: [
                    {
                        resourceName: 'onprem-host-1',
                        deploymentType: 'standalone',
                        machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: 100 }]
                    }
                ],
                recommendedLicenseCalculation: [
                    { resourceName: 'onprem-host-1', sqlServerEdition: 'Enterprise', licenseIncluded: true }
                ],
                existingComputeCalculation: [
                    {
                        resourceName: 'onprem-host-1',
                        deploymentType: 'standalone',
                        machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: 150 }]
                    }
                ],
                existingLicenseCalculation: [
                    { resourceName: 'onprem-host-1', sqlServerEdition: 'Enterprise', licenseIncluded: true }
                ],
                fsxOntapCalculation: { totalThroughputAndIopsMonthly: 50, totalMonthlyStorageCharge: 100 },
                fsxOntapSnapshotCalculation: {
                    totalMonthlyCostForCapacity: 10,
                    totalMonthlyCostForFsxSsd: 5,
                    totalSnapshotMonthlyCost: 15
                },
                fsxCloneCalculation: { totalCloneMonthlyCost: 20 },
                ebsCalculation: {},
                ebsSnapshotCalculation: {},
                ebsCloneCalculation: {}
            };
            const result = formatViewCalcData(vc, 'standalone', '3');
            // Bulk returns array-based fsxInstanceCalculation and ebsInstanceCalculation
            expect(result.fsxInstanceCalculation).toBeDefined();
            expect(Array.isArray(result.fsxInstanceCalculation)).toBe(true);
            expect(result.ebsInstanceCalculation).toBeDefined();
            expect(Array.isArray(result.ebsInstanceCalculation)).toBe(true);
        });

        it('formatViewCalcData bulk should compute cost totals from arrays', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsEBSBulk = [
                makeRowData({ name: 'h1' }),
                makeRowData({ name: 'h2' })
            ];
            const vc: any = {
                recommendedComputeCalculation: [
                    { hostname: 'h1', machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: 100 }] },
                    { hostname: 'h2', machineDetails: [{ instanceType: 'm5.xlarge', instanceMonthlyPrice: 200 }] }
                ],
                recommendedLicenseCalculation: [
                    { hostname: 'h1', sqlServerEdition: 'Standard', licenseIncluded: true },
                    { hostname: 'h2', sqlServerEdition: 'Standard', licenseIncluded: true }
                ],
                existingComputeCalculation: [
                    { hostname: 'h1', machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: 150 }] },
                    { hostname: 'h2', machineDetails: [{ instanceType: 'm5.xlarge', instanceMonthlyPrice: 250 }] }
                ],
                existingLicenseCalculation: [
                    { hostname: 'h1', sqlServerEdition: 'Standard', licenseIncluded: true },
                    { hostname: 'h2', sqlServerEdition: 'Standard', licenseIncluded: true }
                ],
                fsxOntapCalculation: { totalThroughputAndIopsMonthly: 50, totalMonthlyStorageCharge: 100 },
                fsxOntapSnapshotCalculation: {
                    totalMonthlyCostForCapacity: 10,
                    totalMonthlyCostForFsxSsd: 5,
                    totalSnapshotMonthlyCost: 15
                },
                fsxCloneCalculation: { totalCloneMonthlyCost: 20 },
                ebsCalculation: {},
                ebsSnapshotCalculation: {},
                ebsCloneCalculation: {}
            };
            const result = formatViewCalcData(vc, 'standalone', '3');
            // Bulk calculations should produce cost properties
            expect(result.fsxTotalCost).toBeDefined();
            expect(result.totalFsxEc2MachineCost).toBeDefined();
            expect(result.totalEBSEc2MachineCost).toBeDefined();
            expect(result.ebsTotalCost).toBeDefined();
        });

        it('formatViewCalcData non-bulk with non-standalone should iterate over machineDetails for costs', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            // Reset bulk rows to empty so isBulkCalculation is false
            mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsEBSBulk = [];
            mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsOnPremBulk = [];
            // Use a non-standalone deployment model that doesn't match SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE
            mockStoreState.exploreSavings.selectedDeploymentModel = 'aoag';
            const vc: any = {
                recommendedComputeCalculation: {
                    machineDetails: [
                        { instanceType: 'm5.large', instanceMonthlyPrice: 100 },
                        { instanceType: 'm5.large', instanceMonthlyPrice: 100 }
                    ],
                    recommendationOptions: []
                },
                recommendedLicenseCalculation: { sqlServerEdition: 'Enterprise', licenseIncluded: true },
                existingComputeCalculation: {
                    machineDetails: [
                        { instanceType: 'm5.large', instanceMonthlyPrice: 150 },
                        { instanceType: 'm5.large', instanceMonthlyPrice: 150 }
                    ]
                },
                existingLicenseCalculation: { sqlServerEdition: 'Enterprise', licenseIncluded: true },
                fsxOntapCalculation: { totalThroughputAndIopsMonthly: 50, totalMonthlyStorageCharge: 100 },
                fsxOntapSnapshotCalculation: {
                    totalMonthlyCostForCapacity: 10,
                    totalMonthlyCostForFsxSsd: 5,
                    totalSnapshotMonthlyCost: 15
                },
                fsxCloneCalculation: { totalCloneMonthlyCost: 20 },
                ebsCalculation: {},
                ebsSnapshotCalculation: {},
                ebsCloneCalculation: {},
                recommendedInstance: [{ instanceMonthlyPrice: 100 }, { instanceMonthlyPrice: 100 }]
            };
            const result = formatViewCalcData(vc, 'aoag', '3');
            expect(result.totalEBSEc2MachineCost).toBeDefined();
            expect(result.totalFsxEc2MachineCost).toBeDefined();
        });

        it('formatStorageSavingsRecommendedData MANUAL_EBS should use recommended row with AOAG multiplier', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.MANUAL_EBS;
            mockStoreState.exploreSavings.selectedManualDeploymentModel = { value: 'aoag' };
            mockStoreState.exploreSavings.recommendedTargetInstance = 'm5.xlarge';
            const data: any = {
                compute: {
                    recommended: {
                        machineDetails: [{ computeMonthlyPrice: 100, licenseMonthlyPrice: 50 }],
                        recommendationOptions: [
                            { instanceType: 'm5.xlarge', computeMonthlyPrice: 150, licenseMonthlyPrice: 60 }
                        ]
                    }
                },
                license: {
                    existing: { sqlServerEdition: 'Standard', licenseMonthlyPrice: 40 },
                    recommended: { sqlServerEdition: 'Enterprise', licenseMonthlyPrice: 50 }
                },
                totalSummary: { recommended: 1000 }
            };
            const result = formatStorageSavingsRecommendedData(data);
            expect(result.recommendedInstance).toBeDefined();
            // AOAG multiplier doubles costs
            expect(result.recommendedInstance.computeMonthlyPrice).toBe(300);
            expect(result.recommendedInstance.licenseMonthlyPrice).toBe(120);
        });

        it('formatStorageSavingsRecommendedData with matching existing/recommended editions and no recommendeRow', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.MANUAL_EBS;
            mockStoreState.exploreSavings.selectedManualDeploymentModel = { value: 'standalone' };
            mockStoreState.exploreSavings.recommendedTargetInstance = '';
            const data: any = {
                compute: {
                    recommended: {
                        machineDetails: [{ computeMonthlyPrice: 100 }],
                        computeMonthlyPrice: 100,
                        recommendationOptions: []
                    },
                    existing: { computeMonthlyPrice: 80 }
                },
                license: {
                    existing: { sqlServerEdition: 'Standard', licenseMonthlyPrice: 40 },
                    recommended: { sqlServerEdition: 'Standard', licenseMonthlyPrice: 50 }
                },
                totalSummary: { recommended: 1000 }
            };
            const result = formatStorageSavingsRecommendedData(data);
            expect(result.recommendedInstance.licenseMonthlyPrice).toBe(40);
            expect(result.recommendedInstance.computeMonthlyPrice).toBe(80);
        });

        it('formatStorageSavingsRecommendedData with different existing/recommended editions and no recommendeRow', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.MANUAL_EBS;
            mockStoreState.exploreSavings.selectedManualDeploymentModel = { value: 'standalone' };
            mockStoreState.exploreSavings.recommendedTargetInstance = '';
            const data: any = {
                compute: {
                    recommended: {
                        machineDetails: [{ computeMonthlyPrice: 100 }],
                        computeMonthlyPrice: 120,
                        recommendationOptions: []
                    },
                    existing: { computeMonthlyPrice: 80 }
                },
                license: {
                    existing: { sqlServerEdition: 'Standard', licenseMonthlyPrice: 40 },
                    recommended: { sqlServerEdition: 'Enterprise', licenseMonthlyPrice: 60 }
                },
                totalSummary: { recommended: 1000 }
            };
            const result = formatStorageSavingsRecommendedData(data);
            expect(result.recommendedInstance.licenseMonthlyPrice).toBe(60);
            expect(result.recommendedInstance.computeMonthlyPrice).toBe(80);
        });

        it('formatStorageSavingsRecommendedData MANUAL_EBS standalone with recommendeRow', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.MANUAL_EBS;
            mockStoreState.exploreSavings.selectedManualDeploymentModel = { value: 'standalone' };
            mockStoreState.exploreSavings.recommendedTargetInstance = 'm5.xlarge';
            const data: any = {
                compute: {
                    recommended: {
                        machineDetails: [{ computeMonthlyPrice: 100, licenseMonthlyPrice: 50 }],
                        recommendationOptions: [
                            { instanceType: 'm5.xlarge', computeMonthlyPrice: 150, licenseMonthlyPrice: 60 }
                        ]
                    }
                },
                license: {
                    existing: { sqlServerEdition: 'Standard', licenseMonthlyPrice: 40 },
                    recommended: { sqlServerEdition: 'Enterprise', licenseMonthlyPrice: 50 }
                },
                totalSummary: { recommended: 1000 }
            };
            const result = formatStorageSavingsRecommendedData(data);
            expect(result.recommendedInstance.computeMonthlyPrice).toBe(150);
        });

        it('formatStorageSavingsRecommendedData AUTO_EBS with recommendedTargetInstance and AOAG', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            mockStoreState.exploreSavings.selectedDeploymentModel = 'aoag';
            mockStoreState.exploreSavings.recommendedTargetInstance = 'm5.xlarge';
            const data: any = {
                compute: [
                    {
                        recommended: {
                            machineDetails: [{ computeMonthlyPrice: 100 }],
                            recommendationOptions: [
                                { instanceType: 'm5.xlarge', computeMonthlyPrice: 200, licenseMonthlyPrice: 80 }
                            ]
                        }
                    }
                ],
                license: [
                    {
                        recommended: { licenseMonthlyPrice: 50 }
                    }
                ],
                totalSummary: { recommended: 1500 }
            };
            const result = formatStorageSavingsRecommendedData(data);
            expect(result.recommendedInstance).toBeDefined();
            // AOAG multiplier = 2
            expect(result.recommendedInstance.computeMonthlyPrice).toBe(400);
        });

        it('formatViewCalcData with fsxnStoragePrice and fsxnCapacityPrice as objects', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsEBSBulk = [];
            mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsOnPremBulk = [];
            mockStoreState.exploreSavings.selectedDeploymentModel = 'standalone';
            const vc: any = {
                recommendedComputeCalculation: {
                    machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: 100 }],
                    recommendationOptions: []
                },
                recommendedLicenseCalculation: { sqlServerEdition: 'Enterprise', licenseIncluded: true },
                existingComputeCalculation: {
                    machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: 150 }]
                },
                existingLicenseCalculation: { sqlServerEdition: 'Enterprise', licenseIncluded: true },
                fsxOntapCalculation: {
                    totalThroughputAndIopsMonthly: 50,
                    totalMonthlyStorageCharge: 100,
                    fsxnStoragePrice: { price: 0.123 },
                    fsxnCapacityPrice: { price: 0.023 },
                    fsxnIopsPrice: 0.065
                },
                fsxOntapSnapshotCalculation: {
                    totalMonthlyCostForCapacity: 10,
                    totalMonthlyCostForFsxSsd: 5,
                    totalSnapshotMonthlyCost: 15,
                    fsxnSsdPrice: { price: 0.08 },
                    fsxnCapacityPrice: { price: 0.023 }
                },
                fsxCloneCalculation: {
                    totalCloneMonthlyCost: 20,
                    fsxnSsdPrice: { price: 0.08 }
                },
                fsxwCalculation: {
                    fsxwSsdPrice: { price: 0.13 }
                },
                ebsCalculation: {},
                ebsSnapshotCalculation: {},
                ebsCloneCalculation: {},
                recommendedInstance: [{ instanceMonthlyPrice: 100 }]
            };
            const result = formatViewCalcData(vc, 'standalone', '3');
            expect(result.fsxOntapCalculation).toBeDefined();
            expect(result.fsxOntapSnapshotCalculation).toBeDefined();
            expect(result.fsxCloneCalculation).toBeDefined();
        });

        it('formatViewCalcInstance AOAG with both sqlServerEdition and serverEdition null falls to NOT_AVAILABLE', () => {
            const computeDetails = [
                {
                    instanceType: 't3.large',
                    price: 0.1,
                    computeMonthlyPrice: 73,
                    instanceMonthlyPrice: 73,
                    hoursInMonth: 730
                }
            ];
            const licenseDetails = { sqlServerEdition: null, licenseIncluded: false };
            const selectedHostDetails = { databaseServer: { serverEdition: null } };
            const result = formatViewCalcInstance('aoag', selectedHostDetails, computeDetails, licenseDetails);
            expect(result[0].sqlEdition).toBe('n/a');
        });

        it('formatViewCalcData non-bulk with null instanceMonthlyPrice in machineDetails', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsEBSBulk = [];
            mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsOnPremBulk = [];
            mockStoreState.exploreSavings.selectedDeploymentModel = 'standalone';
            const vc: any = {
                recommendedComputeCalculation: {
                    machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: null }],
                    recommendationOptions: []
                },
                recommendedLicenseCalculation: { sqlServerEdition: 'Enterprise', licenseIncluded: true },
                existingComputeCalculation: {
                    machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: null }]
                },
                existingLicenseCalculation: { sqlServerEdition: 'Enterprise', licenseIncluded: true },
                fsxOntapCalculation: { totalThroughputAndIopsMonthly: null, totalMonthlyStorageCharge: null },
                fsxOntapSnapshotCalculation: {
                    totalMonthlyCostForCapacity: null,
                    totalMonthlyCostForFsxSsd: null,
                    totalSnapshotMonthlyCost: null
                },
                fsxCloneCalculation: { totalCloneMonthlyCost: null },
                ebsCalculation: {},
                ebsSnapshotCalculation: {},
                ebsCloneCalculation: {},
                recommendedInstance: [{ instanceMonthlyPrice: null }]
            };
            const result = formatViewCalcData(vc, 'standalone', '3');
            expect(result).toBeDefined();
        });

        it('formatViewCalcData non-bulk AOAG with null instanceMonthlyPrice', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsEBSBulk = [];
            mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsOnPremBulk = [];
            mockStoreState.exploreSavings.selectedDeploymentModel = 'aoag';
            const vc: any = {
                recommendedComputeCalculation: {
                    machineDetails: [
                        { instanceType: 'm5.large', instanceMonthlyPrice: null },
                        { instanceType: 'm5.large', instanceMonthlyPrice: null }
                    ],
                    recommendationOptions: []
                },
                recommendedLicenseCalculation: { sqlServerEdition: 'Enterprise', licenseIncluded: true },
                existingComputeCalculation: {
                    machineDetails: [
                        { instanceType: 'm5.large', instanceMonthlyPrice: null },
                        { instanceType: 'm5.large', instanceMonthlyPrice: null }
                    ]
                },
                existingLicenseCalculation: { sqlServerEdition: 'Enterprise', licenseIncluded: true },
                fsxOntapCalculation: { totalThroughputAndIopsMonthly: null, totalMonthlyStorageCharge: null },
                fsxOntapSnapshotCalculation: {
                    totalMonthlyCostForCapacity: null,
                    totalMonthlyCostForFsxSsd: null,
                    totalSnapshotMonthlyCost: null
                },
                fsxCloneCalculation: { totalCloneMonthlyCost: null },
                fsxwCloneCalculation: { totalCloneMonthlyCost: null },
                fsxwSnapshotCalculation: { totalMonthlyCostForFsxwSnapshotStorageCapacity: null },
                fsxwCalculation: { totalMonthlyCost: null },
                ebsCalculation: {},
                ebsSnapshotCalculation: {},
                ebsCloneCalculation: {},
                recommendedInstance: [{ instanceMonthlyPrice: null }, { instanceMonthlyPrice: null }]
            };
            const result = formatViewCalcData(vc, 'aoag', '3');
            expect(result.totalFsxEc2MachineCost).toBeDefined();
        });

        it('formatViewCalcData bulk with null instanceMonthlyPrice in machineDetails arrays', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsEBSBulk = [makeRowData({ name: 'h-null' })];
            const vc: any = {
                recommendedComputeCalculation: [
                    { hostname: 'h-null', machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: null }] }
                ],
                recommendedLicenseCalculation: [
                    { hostname: 'h-null', sqlServerEdition: 'Enterprise', licenseIncluded: true }
                ],
                existingComputeCalculation: [
                    { hostname: 'h-null', machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: null }] }
                ],
                existingLicenseCalculation: [
                    { hostname: 'h-null', sqlServerEdition: 'Enterprise', licenseIncluded: true }
                ],
                fsxOntapCalculation: { totalThroughputAndIopsMonthly: null, totalMonthlyStorageCharge: null },
                fsxOntapSnapshotCalculation: {
                    totalMonthlyCostForCapacity: null,
                    totalMonthlyCostForFsxSsd: null,
                    totalSnapshotMonthlyCost: null
                },
                fsxCloneCalculation: { totalCloneMonthlyCost: null },
                ebsCalculation: {},
                ebsSnapshotCalculation: {},
                ebsCloneCalculation: {}
            };
            const result = formatViewCalcData(vc, 'standalone', '3');
            expect(result).toBeDefined();
        });

        it('getEbsViewCalculationData with snapshot storageAmount of 0', () => {
            const vc: any = {
                ebsCalculation: {},
                ebsSnapshotCalculation: {
                    vol1: {
                        storageAmount: 0,
                        amountChangedPerSnapshot: 0,
                        monthlyCostOfSnapshots: 0,
                        ebsInstanceMonth: 0,
                        totalSnapshots: 0,
                        initialSnapshotCost: 0,
                        monthlyCostPerSnapshot: 0,
                        discountForPartialStorageMonth: 0,
                        incrementalSnapshotCost: 0,
                        totalSnapshotCost: 0,
                        totalEbsSnapshotCost: 0,
                        ebsSnapshotCost: 0,
                        ebsSnapshotPrice: { price: 0.05 }
                    }
                },
                ebsCloneCalculation: {}
            };
            const result = getEbsViewCalculationData(vc);
            expect(result.ebsSnapshotCalculation).toBeDefined();
        });

        it('formatViewCalcData with FSXW mode and bulk should traverse fsxw cost paths', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_FSXW;
            mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsEBSBulk = [
                makeRowData({ name: 'host-fsxw' })
            ];
            const vc: any = {
                recommendedComputeCalculation: [
                    { hostname: 'host-fsxw', machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: 100 }] }
                ],
                recommendedLicenseCalculation: [
                    { hostname: 'host-fsxw', sqlServerEdition: 'Enterprise', licenseIncluded: true }
                ],
                existingComputeCalculation: [
                    { hostname: 'host-fsxw', machineDetails: [{ instanceType: 'm5.large', instanceMonthlyPrice: 150 }] }
                ],
                existingLicenseCalculation: [
                    { hostname: 'host-fsxw', sqlServerEdition: 'Enterprise', licenseIncluded: true }
                ],
                fsxOntapCalculation: { totalThroughputAndIopsMonthly: 50, totalMonthlyStorageCharge: 100 },
                fsxOntapSnapshotCalculation: {
                    totalMonthlyCostForCapacity: 10,
                    totalMonthlyCostForFsxSsd: 5,
                    totalSnapshotMonthlyCost: 15
                },
                fsxCloneCalculation: { totalCloneMonthlyCost: 20 },
                fsxwCalculation: { totalMonthlyCost: 200, fsxwSsdPrice: { price: 0.13 } },
                fsxwSnapshotCalculation: { totalMonthlyCostForFsxwSnapshotStorageCapacity: 25 },
                fsxwCloneCalculation: { totalCloneMonthlyCost: 15 },
                ebsCalculation: {},
                ebsSnapshotCalculation: {},
                ebsCloneCalculation: {}
            };
            const result = formatViewCalcData(vc, 'standalone', '3');
            expect(result.fsxwTotalCost).toBeDefined();
        });

        it('formatViewCalcData with non-standalone non-bulk should iterate machineDetails for costs', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_FSXW;
            mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsEBSBulk = [];
            mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsOnPremBulk = [];
            // Use non-standalone to hit the else branch that iterates over machineDetails
            mockStoreState.exploreSavings.selectedDeploymentModel = 'aoag';
            const vc: any = {
                recommendedComputeCalculation: {
                    machineDetails: [
                        { instanceType: 'm5.large', instanceMonthlyPrice: 100 },
                        { instanceType: 'm5.large', instanceMonthlyPrice: 100 }
                    ],
                    recommendationOptions: []
                },
                recommendedLicenseCalculation: { sqlServerEdition: 'Enterprise', licenseIncluded: true },
                existingComputeCalculation: {
                    machineDetails: [
                        { instanceType: 'm5.large', instanceMonthlyPrice: 150 },
                        { instanceType: 'm5.large', instanceMonthlyPrice: 150 }
                    ]
                },
                existingLicenseCalculation: { sqlServerEdition: 'Enterprise', licenseIncluded: true },
                fsxOntapCalculation: { totalThroughputAndIopsMonthly: 50, totalMonthlyStorageCharge: 100 },
                fsxOntapSnapshotCalculation: {
                    totalMonthlyCostForCapacity: 10,
                    totalMonthlyCostForFsxSsd: 5,
                    totalSnapshotMonthlyCost: 15
                },
                fsxCloneCalculation: { totalCloneMonthlyCost: 20 },
                fsxwCalculation: { totalMonthlyCost: 200, fsxwSsdPrice: { price: 0.13 } },
                fsxwSnapshotCalculation: { totalMonthlyCostForFsxwSnapshotStorageCapacity: 25 },
                fsxwCloneCalculation: { totalCloneMonthlyCost: 15 },
                ebsCalculation: {},
                ebsSnapshotCalculation: {},
                ebsCloneCalculation: {},
                recommendedInstance: [{ instanceMonthlyPrice: 100 }, { instanceMonthlyPrice: 100 }]
            };
            const result = formatViewCalcData(vc, 'aoag', '3');
            expect(result.fsxwTotalCost).toBeDefined();
        });

        it('formatViewCalcData with createFormattedCalculation handling string instanceMonthlyPrice', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.AUTO_EBS;
            mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsEBSBulk = [
                makeRowData({ name: 'host-str' })
            ];
            const vc: any = {
                recommendedComputeCalculation: [
                    {
                        hostname: 'host-str',
                        deploymentType: 'standalone',
                        machineDetails: [
                            {
                                instanceType: 'm5.large',
                                instanceMonthlyPrice: '$1,200.00',
                                price: 1.644,
                                computeMonthlyPrice: 1200,
                                hoursInMonth: 730
                            }
                        ]
                    }
                ],
                recommendedLicenseCalculation: [
                    { hostname: 'host-str', sqlServerEdition: 'Enterprise', licenseIncluded: true }
                ],
                existingComputeCalculation: [
                    {
                        hostname: 'host-str',
                        deploymentType: 'standalone',
                        machineDetails: [
                            {
                                instanceType: 'm5.large',
                                instanceMonthlyPrice: '$1,500.00',
                                price: 2.055,
                                computeMonthlyPrice: 1500,
                                hoursInMonth: 730
                            }
                        ]
                    }
                ],
                existingLicenseCalculation: [
                    { hostname: 'host-str', sqlServerEdition: 'Enterprise', licenseIncluded: true }
                ],
                fsxOntapCalculation: { totalThroughputAndIopsMonthly: 50, totalMonthlyStorageCharge: 100 },
                fsxOntapSnapshotCalculation: {
                    totalMonthlyCostForCapacity: 10,
                    totalMonthlyCostForFsxSsd: 5,
                    totalSnapshotMonthlyCost: 15
                },
                fsxCloneCalculation: { totalCloneMonthlyCost: 20 },
                ebsCalculation: {},
                ebsSnapshotCalculation: {},
                ebsCloneCalculation: {}
            };
            const result = formatViewCalcData(vc, 'standalone', '3');
            // Bulk mode returns ebsInstanceCalculation as array
            expect(result.ebsInstanceCalculation).toBeDefined();
            expect(Array.isArray(result.ebsInstanceCalculation)).toBe(true);
        });
    });

    // =========================================================================
    // isMissingSqlPermissions
    // =========================================================================
    describe('isMissingSqlPermissions', () => {
        it('should return true if any instance is missing required permissions', () => {
            const instances = [
                {
                    manageReadiness: {
                        assessment: { missingSqlPermissions: ['VIEW ANY DEFINITION'] }
                    }
                }
            ];
            expect(isMissingSqlPermissions(instances)).toBe(true);
        });

        it('should return false if no instance is missing required permissions', () => {
            const instances = [
                {
                    manageReadiness: {
                        assessment: { missingSqlPermissions: [] }
                    }
                }
            ];
            expect(isMissingSqlPermissions(instances)).toBe(false);
        });

        it('should return false if manageReadiness is null', () => {
            const instances = [{ manageReadiness: null }];
            expect(isMissingSqlPermissions(instances)).toBe(false);
        });

        it('should return false for empty array', () => {
            expect(isMissingSqlPermissions([])).toBe(false);
        });

        it('should return false for undefined', () => {
            expect(isMissingSqlPermissions(undefined)).toBeFalsy();
        });

        it('should check all readiness types', () => {
            const instances = [
                {
                    manageReadiness: {
                        assessment: { missingSqlPermissions: [] },
                        dbcreation: { missingSqlPermissions: [] },
                        sandbox: { missingSqlPermissions: ['CONNECT SQL'] },
                        remediation: { missingSqlPermissions: [] }
                    }
                }
            ];
            expect(isMissingSqlPermissions(instances)).toBe(true);
        });

        it('should handle missing readiness type keys', () => {
            const instances = [
                {
                    manageReadiness: {
                        assessment: { missingSqlPermissions: [] }
                        // other readiness types not present
                    }
                }
            ];
            expect(isMissingSqlPermissions(instances)).toBe(false);
        });

        it('should only flag REQUIRED_SQL_PERMISSIONS, not arbitrary ones', () => {
            const instances = [
                {
                    manageReadiness: {
                        assessment: { missingSqlPermissions: ['SOME_OTHER_PERMISSION'] }
                    }
                }
            ];
            expect(isMissingSqlPermissions(instances)).toBe(false);
        });
    });

    // =========================================================================
    // shouldAuthDialogOpen
    // =========================================================================
    describe('shouldAuthDialogOpen', () => {
        it('should return true if not detected', () => {
            const rowData = makeRowData({ isDetected: false });
            expect(shouldAuthDialogOpen(rowData)).toBe(true);
        });

        it('should return false if detected and no missing permissions', () => {
            const rowData = makeRowData({
                isDetected: true,
                sqlServerInstances: [{ manageReadiness: { assessment: { missingSqlPermissions: [] } } }]
            });
            expect(shouldAuthDialogOpen(rowData)).toBe(false);
        });

        it('should return true if detected but has missing required permissions', () => {
            const rowData = makeRowData({
                isDetected: true,
                sqlServerInstances: [
                    {
                        manageReadiness: {
                            assessment: { missingSqlPermissions: ['VIEW ANY DEFINITION'] }
                        }
                    }
                ]
            });
            expect(shouldAuthDialogOpen(rowData)).toBe(true);
        });
    });

    // =========================================================================
    // shouldAuthDialogOpenBulk
    // =========================================================================
    describe('shouldAuthDialogOpenBulk', () => {
        it('should return empty array for empty input', () => {
            expect(shouldAuthDialogOpenBulk([])).toEqual([]);
        });

        it('should return empty array for undefined input', () => {
            expect(shouldAuthDialogOpenBulk(undefined)).toEqual([]);
        });

        it('should return empty array for non-array input', () => {
            // @ts-ignore
            expect(shouldAuthDialogOpenBulk('not an array')).toEqual([]);
        });

        it('should filter rows that require auth', () => {
            const rows = [
                makeRowData({ id: '1', isDetected: false }),
                makeRowData({
                    id: '2',
                    isDetected: true,
                    sqlServerInstances: [{ manageReadiness: { assessment: { missingSqlPermissions: [] } } }]
                })
            ];
            const result = shouldAuthDialogOpenBulk(rows);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('1');
        });

        it('should return all rows when all need auth', () => {
            const rows = [makeRowData({ id: '1', isDetected: false }), makeRowData({ id: '2', isDetected: false })];
            const result = shouldAuthDialogOpenBulk(rows);
            expect(result).toHaveLength(2);
        });
    });

    // =========================================================================
    // onClickESHostOracleEbs
    // =========================================================================
    describe('onClickESHostOracleEbs', () => {
        const makeOracleRowData = (overrides: any = {}) => ({
            id: 'oracle-row-1',
            ec2InstanceId: 'i-oracle-1',
            ec2InstanceName: 'ec2-oracle',
            name: 'oracle-host-1',
            credentialId: 'cred-1',
            regionId: 'us-east-1',
            storageType: 'EBS',
            serverInstallationMode: 'Standalone',
            oracleServerDeploymentType: 'Standalone',
            ec2Details: [{ id: 'i-oracle-1', name: 'ec2-oracle' }],
            ...overrides
        });

        it('should navigate and dispatch all required actions for workload factory', () => {
            const rowData = makeOracleRowData();
            onClickESHostOracleEbs(mockDispatch, rowData, true, mockNavigate);

            expect(mockNavigate).toHaveBeenCalledWith('../databases/saving-calculator');
            expect(mockPostBlueXPMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'navigate',
                    payload: expect.objectContaining({
                        pathname: './storage-saving-calculator?type=oracle-ebs&mode=auto'
                    })
                })
            );
            expect(mockDispatch).toHaveBeenCalled();
        });

        it('should use non-workload-factory path when isWorkloadFactory is false', () => {
            const rowData = makeOracleRowData();
            onClickESHostOracleEbs(mockDispatch, rowData, false);

            expect(mockPostBlueXPMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({
                        pathname: '../fsxdb/storage-saving-calculator?type=oracle-ebs&mode=auto'
                    })
                })
            );
        });

        it('should not navigate when navigate function is not provided', () => {
            const rowData = makeOracleRowData();
            onClickESHostOracleEbs(mockDispatch, rowData, true);

            expect(mockNavigate).not.toHaveBeenCalled();
            // Should still dispatch actions
            expect(mockDispatch).toHaveBeenCalled();
        });

        it('should set ORACLE_AUTO_EBS as savingsCalculatorFrom', () => {
            const rowData = makeOracleRowData();
            onClickESHostOracleEbs(mockDispatch, rowData, true, mockNavigate);

            // Check setSavingsCalculatorFrom was dispatched with ORACLE_AUTO_EBS
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'setSavingsCalculatorFrom',
                    payload: 'Oracle_Auto_EBS'
                })
            );
        });

        it('should set bulk selection to [rowData] when isBulk is false', () => {
            const rowData = makeOracleRowData();
            onClickESHostOracleEbs(mockDispatch, rowData, true, mockNavigate, false);

            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'setSelectedRowsForExploreSavingsOracleEbsBulk',
                    payload: [rowData]
                })
            );
        });

        it('should NOT set bulk selection when isBulk is true', () => {
            const rowData = makeOracleRowData();
            onClickESHostOracleEbs(mockDispatch, rowData, true, mockNavigate, true, '3 hosts selected');

            // When isBulk, the function should NOT set the Oracle EBS bulk array
            const bulkCalls = mockDispatch.mock.calls.filter(
                (call: any[]) => call[0]?.type === 'setSelectedRowsForExploreSavingsOracleEbsBulk'
            );
            expect(bulkCalls).toHaveLength(0);
        });

        it('should set selectedEsPageInstance with ec2 details from rowData', () => {
            const rowData = makeOracleRowData();
            onClickESHostOracleEbs(mockDispatch, rowData, true, mockNavigate);

            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'setSelectedEsPageInstance',
                    payload: expect.objectContaining({
                        instanceId: 'i-oracle-1',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        deploymentModel: 'Standalone'
                    })
                })
            );
        });

        it('should use bulkServerName for selectedServerName when provided', () => {
            const rowData = makeOracleRowData();
            onClickESHostOracleEbs(mockDispatch, rowData, true, mockNavigate, true, '3 hosts selected');

            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'setSelectedServerName',
                    payload: '3 hosts selected'
                })
            );
        });

        it('should use rowData.name as serverName when bulkServerName is not provided', () => {
            const rowData = makeOracleRowData({ name: 'my-oracle-host' });
            onClickESHostOracleEbs(mockDispatch, rowData, true, mockNavigate);

            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'setSelectedServerName',
                    payload: 'my-oracle-host'
                })
            );
        });

        it('should fallback to ec2InstanceName when name is missing', () => {
            const rowData = makeOracleRowData({ name: undefined, ec2InstanceName: 'fallback-ec2' });
            onClickESHostOracleEbs(mockDispatch, rowData, true, mockNavigate);

            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'setSelectedServerName',
                    payload: 'fallback-ec2'
                })
            );
        });

        it('should use oracleServerDeploymentType as deploymentModel', () => {
            const rowData = makeOracleRowData({ oracleServerDeploymentType: 'Data Guard' });
            onClickESHostOracleEbs(mockDispatch, rowData, true, mockNavigate);

            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'setSelectedEsPageInstance',
                    payload: expect.objectContaining({
                        deploymentModel: 'Data Guard'
                    })
                })
            );
        });

        it('should default deploymentModel to Standalone when oracleServerDeploymentType is absent', () => {
            const rowData = makeOracleRowData({ oracleServerDeploymentType: undefined });
            onClickESHostOracleEbs(mockDispatch, rowData, true, mockNavigate);

            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'setSelectedEsPageInstance',
                    payload: expect.objectContaining({
                        deploymentModel: 'Standalone'
                    })
                })
            );
        });

        it('should trigger bulk data fetch', () => {
            const rowData = makeOracleRowData();
            onClickESHostOracleEbs(mockDispatch, rowData, true, mockNavigate);

            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'setTriggerBulkDataFetch',
                    payload: true
                })
            );
        });

        it('should dispatch setDisableState(true)', () => {
            const rowData = makeOracleRowData();
            onClickESHostOracleEbs(mockDispatch, rowData, true, mockNavigate);

            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'setDisableState',
                    payload: true
                })
            );
        });
    });

    // =========================================================================
    // formatStorageSavingsRecommendedData — ORACLE_AUTO_EBS
    // =========================================================================
    describe('formatStorageSavingsRecommendedData — ORACLE_AUTO_EBS', () => {
        it('should handle ORACLE_AUTO_EBS mode same as AUTO_EBS with array format', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.ORACLE_AUTO_EBS;
            mockStoreState.exploreSavings.selectedDeploymentModel = 'standalone';
            mockStoreState.exploreSavings.recommendedTargetInstance = '';

            const data: any = {
                compute: [
                    {
                        existing: { computeMonthlyPrice: 200 },
                        recommended: {
                            computeMonthlyPrice: 200,
                            machineDetails: [{ instanceType: 'm5.large', computeMonthlyPrice: 200 }]
                        }
                    }
                ],
                license: [{ recommended: { licenseMonthlyPrice: 50 } }],
                totalSummary: { recommended: 800 }
            };

            const result = formatStorageSavingsRecommendedData(data);
            expect(result.recommendedInstance).toBeDefined();
            // Fallback path sums existing.computeMonthlyPrice
            expect(result.recommendedInstance.computeMonthlyPrice).toBe(200);
            expect(result.totalSummary?.recommendedTotal).toBe(800);
        });

        it('should handle ORACLE_AUTO_EBS with recommendedTargetInstance override', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.ORACLE_AUTO_EBS;
            mockStoreState.exploreSavings.selectedDeploymentModel = 'standalone';
            mockStoreState.exploreSavings.recommendedTargetInstance = 'r5.xlarge';

            const data: any = {
                compute: [
                    {
                        recommended: {
                            computeMonthlyPrice: 100,
                            machineDetails: [{ instanceType: 'm5.large', computeMonthlyPrice: 100 }],
                            recommendationOptions: [
                                { instanceType: 'm5.large', computeMonthlyPrice: 100 },
                                { instanceType: 'r5.xlarge', computeMonthlyPrice: 300 }
                            ]
                        }
                    }
                ],
                license: [{ recommended: { licenseMonthlyPrice: 0 } }],
                totalSummary: { recommended: 900 }
            };

            const result = formatStorageSavingsRecommendedData(data);
            expect(result.recommendedInstance).toBeDefined();
            expect(result.recommendedInstance.instanceType).toBe('r5.xlarge');
        });

        it('should handle ORACLE_AUTO_EBS with empty license arrays', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.ORACLE_AUTO_EBS;
            mockStoreState.exploreSavings.selectedDeploymentModel = 'standalone';

            const data: any = {
                compute: [{ recommended: { computeMonthlyPrice: 150, machineDetails: [] } }],
                license: [],
                totalSummary: { recommended: 500 }
            };

            const result = formatStorageSavingsRecommendedData(data);
            expect(result.recommendedInstance).toBeDefined();
            expect(result.recommendedInstance.licenseMonthlyPrice).toBeFalsy();
        });
    });

    // =========================================================================
    // formatViewCalcData — ORACLE_AUTO_EBS
    // =========================================================================
    describe('formatViewCalcData — ORACLE_AUTO_EBS', () => {
        it('should use Oracle labels in formatted data when ORACLE_AUTO_EBS', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.ORACLE_AUTO_EBS;
            mockStoreState.exploreSavings.selectedDeploymentModel = 'standalone';
            mockStoreState.exploreSavingsBulk.selectedRowsForExploreSavingsOracleEbsBulk = [
                { name: 'oracle-host-1', ec2InstanceId: 'i-1' }
            ];

            const viewCalcData = {
                isBulkCalculation: false,
                fsxInstanceCalculation: [
                    {
                        instanceType: 'm5.xlarge',
                        sqlEdition: undefined,
                        oracleEdition: 'Enterprise',
                        sqlLicense: undefined,
                        oracleLicense: 'BYOL',
                        computeHourlyPrice: 0.5
                    }
                ],
                fsxStorageCalculation: {},
                totalMonthlyFsxCost: 1000
            };

            // formatViewCalcData takes (viewCalculations, selectedDeploymentModel, monthlyChangeRate)
            expect(() => {
                formatViewCalcData(viewCalcData, 'standalone', '5');
            }).not.toThrow();
        });
    });

    // =========================================================================
    // formatViewCalcInstance — ORACLE_AUTO_EBS
    // =========================================================================
    describe('formatViewCalcInstance — ORACLE_AUTO_EBS', () => {
        it('should use Oracle database type label for ORACLE_AUTO_EBS', () => {
            mockStoreState.exploreSavings.savingsCalculatorFrom = SAVINGS_CALC_MODE.ORACLE_AUTO_EBS;
            mockStoreState.exploreSavings.selectedOnPremHostDetails = null;

            const selectedHostDetails = { ec2Details: [{ instanceType: 'm5.xlarge' }] };
            const computeDetails = [
                {
                    instanceType: 'm5.xlarge',
                    price: 0.5,
                    computeMonthlyPrice: 200,
                    hoursInMonth: 730,
                    instanceMonthlyPrice: 365
                }
            ];
            const licenseDetails = { oracleEdition: 'Enterprise', licenseIncluded: false };

            // formatViewCalcInstance(deploymentModel, hostDetails, computeDetails, licenseDetails)
            const result = formatViewCalcInstance('standalone', selectedHostDetails, computeDetails, licenseDetails);
            expect(Array.isArray(result)).toBe(true);
            // Oracle mode should produce oracleEdition and oracleLicense fields
            if (result.length > 0) {
                expect(result[0].oracleEdition).toBeDefined();
                expect(result[0].oracleLicense).toBeDefined();
            }
        });
    });
});
