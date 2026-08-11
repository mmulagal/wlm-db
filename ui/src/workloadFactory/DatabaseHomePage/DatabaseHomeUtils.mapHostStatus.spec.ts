import { describe, it, expect, vi } from 'vitest';
import { DBType, INVENTORY_STATUS } from '../../utils/consts';

import { mapHostStatusToAssessmentData } from './DatabaseHomeUtils';

vi.mock('../../store/store', () => ({
    default: { getState: () => ({}), dispatch: vi.fn() }
}));

vi.mock('../../store/workloadFactory/inventoryV2Slice', () => ({
    setManagedHostInstanceLoading: vi.fn(),
    addAllMssqlHostAssessmentData: vi.fn(),
    addAllOracleHostAssessmentData: vi.fn(),
    addUnregisteredMssqlAssessmentData: vi.fn(),
    addUnregisteredOracleAssessmentData: vi.fn()
}));

vi.mock('../GetWell/GetWellUtils', () => ({
    isAoagDeployment: vi.fn(),
    isMssqlHaDeployment: vi.fn(),
    formatOptimizationBreakDown: vi.fn(),
    getCardsData: vi.fn()
}));

vi.mock('../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils', () => ({
    formatOracleOptimizationBreakDown: vi.fn(),
    getOracleCardsData: vi.fn()
}));

describe('mapHostStatusToAssessmentData unregistered cred mismatch', () => {
    const selectedCred = '385165a2-a194-4088-8b74-c3cb8a504a33';
    const otherCred = '92978933-14fe-4c1c-9cd0-85364b5c380f';
    const ec2Id = 'i-07a29eb681ba37679';
    const region = 'ap-southeast-1';

    const inventoryTableData = {
        'host_selected-cred_ap-southeast-1': {
            hostType: DBType.MSSQL,
            ec2InstanceId: ec2Id,
            credentialId: selectedCred,
            regionId: region,
            name: 'adwlmcom',
            sqlServerInstances: [
                {
                    databaseInstanceId: 'SQLLOGIN1',
                    databaseInstanceName: 'SQLLOGIN1',
                    statusColText: INVENTORY_STATUS.UNMANAGED,
                    status: INVENTORY_STATUS.UNMANAGED,
                    hostManageReadiness: { extensiveRunPermission: true }
                }
            ]
        }
    };

    it('enriches status from discover inventory when assessment credential differs', () => {
        const result = mapHostStatusToAssessmentData(
            inventoryTableData,
            [
                {
                    databaseHostId: ec2Id,
                    credentialId: otherCred,
                    regionId: region,
                    instanceId: 'SQLLOGIN1',
                    serverInstanceName: 'SQLLOGIN1',
                    isUnregistered: true
                }
            ],
            false
        );

        expect(result[0].statusColText).toBe(INVENTORY_STATUS.UNMANAGED);
        expect(result[0].ec2InstanceId).toBe(ec2Id);
        expect(result[0].loadingStatus).toBe(false);
    });
});
