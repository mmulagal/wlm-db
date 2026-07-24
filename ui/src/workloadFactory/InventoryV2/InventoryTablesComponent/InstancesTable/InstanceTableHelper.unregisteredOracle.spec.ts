import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WELL_ARCHITECTED_TABS, WLF_TABS } from '../../../../utils/consts';

import { setSelectedOracleInnerPageTab } from '../../../../store/workloadFactory/oracleSlice';
import { setSelectedHeaderTab } from '../../../../store/workloadFactory/inventoryV2Slice';
import { handleUnregisteredOracleOptimizeAction } from './InstanceTableHelper';

const mockSetGwPageLoadInstanceData = vi.fn((payload: unknown) => ({
    type: 'setGwPageLoadInstanceData',
    payload
}));

vi.mock('../../../../assets/NotActiveNotificationIcon.svg', () => ({ ReactComponent: () => null }));
vi.mock('../../../../assets/ic_bullet.svg', () => ({ ReactComponent: () => null }));
vi.mock('./InstanceTableHelper.module.scss', () => ({ default: {} }));
vi.mock('../InventoryTable.module.scss', () => ({ default: {} }));
vi.mock('../../../../store/store', () => ({ default: { getState: vi.fn(() => ({})) } }));

vi.mock('../../../../store/workloadFactory/getWellOptimizeSlice', () => ({
    setGwPageLoadInstanceData: (payload: unknown) => mockSetGwPageLoadInstanceData(payload),
    setFSXId: vi.fn((payload: unknown) => ({ type: 'setFSXId', payload })),
    setLandingFrom: vi.fn((payload: unknown) => ({ type: 'setLandingFrom', payload })),
    resetVisitedTabs: vi.fn(),
    setSelectedWellArchitectTab: vi.fn()
}));

vi.mock('../../../../store/workloadFactory/oracleSlice', () => ({
    setRefreshOracleWellArchitect: vi.fn(),
    setOracleRefreshTimes: vi.fn(),
    setSelectedOracleInnerPageTab: vi.fn((payload: unknown) => ({
        type: 'setSelectedOracleInnerPageTab',
        payload
    }))
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
    setSelectedHeaderTab: vi.fn((payload: unknown) => ({ type: 'setSelectedHeaderTab', payload })),
    selectedTabSelection: vi.fn((payload: unknown) => ({ type: 'selectedTabSelection', payload })),
    setRegisterHostType: vi.fn(),
    setWizardOperationType: vi.fn(),
    setInventoryTableData: vi.fn(),
    addAllMssqlHostAssessmentData: vi.fn(),
    addAllOracleHostAssessmentData: vi.fn(),
    addOfflineMssqlHostAssessmentData: vi.fn(),
    addOfflineOracleHostAssessmentData: vi.fn(),
    addOfflineMssqlDatabasesData: vi.fn(),
    setOfflineMssqlHostAssessmentLoading: vi.fn(),
    setOfflineOracleHostAssessmentLoading: vi.fn(),
    setOfflineMssqlDatabasesLoading: vi.fn(),
    setSelectedFilterValue: vi.fn(),
    setSelectedInventoryTab: vi.fn()
}));

vi.mock('../../../../store/workloadFactory/agenticAISlice', () => ({
    resetEiData: vi.fn((payload: unknown) => ({ type: 'resetEiData', payload }))
}));

vi.mock('../../../../store/workloadFactory/databaseHomeSlice', () => ({
    selectedTabSelection: vi.fn()
}));

vi.mock('@netapp/design-system', () => ({
    TooltipInfo: ({ children }: any) => children
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsFlashingDotsLoader: () => null,
    DsTypography: ({ children }: any) => children
}));

describe('handleUnregisteredOracleOptimizeAction', () => {
    const dispatch = vi.fn((action: any) => action);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('navigates to Oracle well-architected status with unregistered instance wiring', () => {
        handleUnregisteredOracleOptimizeAction(
            {
                name: 'oracle-host',
                ec2InstanceId: 'i-oracle-ec2',
                databaseInstanceName: 'ORCL1',
                credentialId: 'cred-1',
                regionId: 'us-east-1',
                fsxId: 'fs-1',
                isInstanceStorageAsmManaged: false
            },
            dispatch
        );

        expect(setSelectedHeaderTab).toHaveBeenCalledWith(WLF_TABS.ORACLE_WELL_ARCHITECTED);
        expect(setSelectedOracleInnerPageTab).toHaveBeenCalledWith(WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS);
        expect(mockSetGwPageLoadInstanceData).toHaveBeenCalledWith({
            hostname: 'oracle-host',
            resourceId: 'i-oracle-ec2',
            instanceId: 'ORCL1',
            instanceName: 'ORCL1',
            credId: 'cred-1',
            regionId: 'us-east-1',
            isWad: false,
            isUnregistered: true
        });
    });

    it('falls back to hostRow fields when top-level row data is missing', () => {
        handleUnregisteredOracleOptimizeAction(
            {
                hostRow: {
                    name: 'nested-host',
                    ec2InstanceId: 'i-nested',
                    credentialId: 'cred-2',
                    regionId: 'ap-southeast-1'
                },
                databaseInstanceName: 'ORCL2'
            },
            dispatch
        );

        expect(mockSetGwPageLoadInstanceData).toHaveBeenCalledWith(
            expect.objectContaining({
                hostname: 'nested-host',
                resourceId: 'i-nested',
                instanceId: 'ORCL2',
                credId: 'cred-2',
                regionId: 'ap-southeast-1',
                isUnregistered: true
            })
        );
    });
});
