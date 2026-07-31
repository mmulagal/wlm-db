import { describe, it, expect, vi, beforeEach } from 'vitest';
import { INVENTORY_STATUS, WLF_TABS } from '../../../../utils/consts';

import { setGwPageLoadInstanceData } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { optimizeAction } from './InstanceTableColumnsHelper';

const mockDispatch = vi.fn();
const mockGetState = vi.fn();

vi.mock('../../../../store/store', () => ({
    default: {
        getState: () => mockGetState()
    }
}));

vi.mock('../../../../store/workloadFactory/getWellOptimizeSlice', () => ({
    setGwPageLoadInstanceData: vi.fn((payload: unknown) => ({ type: 'setGwPageLoadInstanceData', payload })),
    setLandingFrom: vi.fn((payload: unknown) => ({ type: 'setLandingFrom', payload })),
    setFSXId: vi.fn((payload: unknown) => ({ type: 'setFSXId', payload })),
    setSelectedWellArchitectTab: vi.fn((payload: unknown) => ({ type: 'setSelectedWellArchitectTab', payload }))
}));

vi.mock('../../../../store/workloadFactory/workloadFactoryResourceSlice', () => ({
    resetWorkloadFactoryResourceData: vi.fn(() => ({ type: 'resetWorkloadFactoryResourceData' })),
    setSelectedHostname: vi.fn((payload: unknown) => ({ type: 'setSelectedHostname', payload })),
    setSelectedResourcePageHostData: vi.fn((payload: unknown) => ({
        type: 'setSelectedResourcePageHostData',
        payload
    }))
}));

vi.mock('../../../../store/workloadFactory/inventoryV2Slice', () => ({
    setBreadCrumbSelectedFrom: vi.fn((payload: unknown) => ({ type: 'setBreadCrumbSelectedFrom', payload })),
    setWizardOperationType: vi.fn((payload: unknown) => ({ type: 'setWizardOperationType', payload })),
    setRegisterHostType: vi.fn((payload: unknown) => ({ type: 'setRegisterHostType', payload }))
}));

vi.mock('../../../../store/workloadFactory/databaseHomeSlice', () => ({
    selectedTabSelection: vi.fn((payload: unknown) => ({ type: 'selectedTabSelection', payload }))
}));

vi.mock('../../../../store/workloadFactory/agenticAISlice', () => ({
    resetEiData: vi.fn((payload: unknown) => ({ type: 'resetEiData', payload })),
    setLogAnalyzerState: vi.fn((payload: unknown) => ({ type: 'setLogAnalyzerState', payload }))
}));

vi.mock('../../../../store/workloadFactory/oracleSlice', () => ({
    setSelectedOracleInnerPageTab: vi.fn((payload: unknown) => ({ type: 'setSelectedOracleInnerPageTab', payload }))
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsButton: ({ children }: any) => children,
    DsTypography: ({ children }: any) => children
}));

vi.mock('../InventoryTable.module.scss', () => ({ default: {} }));

describe('optimizeAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sets unregistered navigation data for discover rows with permissions', () => {
        mockGetState.mockReturnValue({
            inventoryV2: {
                inventoryTableData: {
                    'i-case2_cred_region': {
                        ec2InstanceId: 'i-case2',
                        resourceId: '',
                        credentialId: 'cred',
                        regionId: 'region',
                        sqlServerInstances: [
                            {
                                databaseInstanceName: 'CASE2SQL',
                                databaseInstanceId: 'discover-server-guid',
                                sqlServerDeploymentType: 'Standalone'
                            }
                        ]
                    }
                }
            }
        });

        optimizeAction(
            {
                name: 'case2-host',
                ec2InstanceId: 'i-case2',
                credentialId: 'cred',
                regionId: 'region',
                databaseInstanceName: 'CASE2SQL',
                hostType: 'MSSQL',
                statusColText: INVENTORY_STATUS.UNMANAGED,
                hostManageReadiness: { extensiveRunPermission: true, canReadAWSSSMDocuments: true }
            },
            mockDispatch
        );

        expect(setGwPageLoadInstanceData).toHaveBeenCalledWith(
            expect.objectContaining({
                resourceId: 'i-case2',
                instanceId: 'CASE2SQL',
                instanceName: 'CASE2SQL',
                isUnregistered: true,
                isWad: false
            })
        );
        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'setLandingFrom', payload: WLF_TABS.INVENTORY })
        );
    });

    it('sets registered navigation data when instance has a registered resource id', () => {
        mockGetState.mockReturnValue({
            inventoryV2: {
                inventoryTableData: {
                    'host-res_cred_region': {
                        resourceId: 'host-res',
                        credentialId: 'cred',
                        regionId: 'region',
                        sqlServerInstances: [
                            {
                                databaseInstanceName: 'MSSQLSERVER',
                                databaseInstanceId: 'inst-guid',
                                resourceId: 'inst-resource',
                                sqlServerDeploymentType: 'Standalone'
                            }
                        ]
                    }
                }
            }
        });

        optimizeAction(
            {
                name: 'managed-host',
                resourceId: 'host-res',
                credentialId: 'cred',
                regionId: 'region',
                databaseInstanceName: 'MSSQLSERVER',
                hostType: 'MSSQL',
                statusColText: INVENTORY_STATUS.MANAGED
            },
            mockDispatch
        );

        expect(setGwPageLoadInstanceData).toHaveBeenCalledWith(
            expect.objectContaining({
                resourceId: 'inst-resource',
                instanceId: 'inst-guid',
                isUnregistered: false,
                isWad: false
            })
        );
    });
});
