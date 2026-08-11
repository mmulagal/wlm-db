import { describe, it, expect, vi } from 'vitest';

import { shouldSkipDatabaseHost } from './DatabaseHomeUtils';
import { resolveInventoryRowForAssessmentInstance } from '../InventoryV2/InventoryUtilsV2';

const selectedCred = '385165a2-a194-4088-8b74-c3cb8a504a33';
const otherCred = '92978933-14fe-4c1c-9cd0-85364b5c380f';

vi.mock('../../store/store', () => ({
    default: {
        getState: () => ({ inventoryV2: { inventoryTableData: {} } }),
        dispatch: vi.fn()
    }
}));

vi.mock('../../store/workloadFactory/inventoryV2Slice', () => ({
    setManagedHostInstanceLoading: vi.fn()
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

vi.mock('../InventoryV2/InventoryUtilsV2', () => ({
    uniqueHostRow: vi.fn(),
    shouldSkipWellArchAssessmentItem: vi.fn(() => false),
    shouldSkipDuplicateAssessmentInstance: vi.fn(() => false),
    resolveInventoryRowForAssessmentInstance: vi.fn((_host: any, instance: any) => ({
        credentialId: selectedCred,
        regionId: 'ap-southeast-1',
        databaseInstanceName: instance?.databaseInstanceName
    }))
}));

describe('shouldSkipDatabaseHost', () => {
    const region = 'ap-southeast-1';
    const ec2Id = 'i-07a29eb681ba37679';

    it('keeps unregistered hosts on same EC2 when assessment credentials differ', () => {
        const uniqueList: string[] = [];
        const inventoryTableData = { host_key: { ec2InstanceId: ec2Id } };

        const sqlLoginHost = {
            databaseHostId: ec2Id,
            credentialId: otherCred,
            regionId: region,
            isUnregistered: true,
            instancesAssessment: [
                {
                    databaseInstanceName: 'SQLLOGIN1',
                    assessments: { metadata: { source: 'unregistered', lastAssessmentTimestamp: 1 } }
                }
            ]
        };

        const domainLoginHost = {
            databaseHostId: ec2Id,
            credentialId: selectedCred,
            regionId: region,
            isUnregistered: true,
            instancesAssessment: [
                {
                    databaseInstanceName: 'DOMAINLOGIN1',
                    assessments: { metadata: { source: 'unregistered', lastAssessmentTimestamp: 1 } }
                }
            ]
        };

        expect(shouldSkipDatabaseHost(sqlLoginHost, [selectedCred], [region], uniqueList, inventoryTableData)).toBe(
            false
        );
        expect(uniqueList).toHaveLength(1);

        expect(shouldSkipDatabaseHost(domainLoginHost, [selectedCred], [region], uniqueList, inventoryTableData)).toBe(
            false
        );
        expect(uniqueList).toHaveLength(2);
    });

    it('skips unregistered host when discover inventory cred is not in header selection', () => {
        vi.mocked(resolveInventoryRowForAssessmentInstance).mockReturnValueOnce({
            credentialId: otherCred,
            regionId: region
        });
        const host = {
            databaseHostId: ec2Id,
            credentialId: selectedCred,
            regionId: region,
            isUnregistered: true,
            instancesAssessment: [{ databaseInstanceName: 'SQLLOGIN1' }]
        };

        expect(shouldSkipDatabaseHost(host, [selectedCred], [region], [], { host_key: { ec2InstanceId: ec2Id } })).toBe(
            true
        );
    });

    it('keeps unregistered host when discover inventory is not linked yet but assessment cred matches header', () => {
        vi.mocked(resolveInventoryRowForAssessmentInstance).mockReturnValueOnce(null);
        const host = {
            databaseHostId: ec2Id,
            credentialId: selectedCred,
            regionId: region,
            isUnregistered: true,
            instancesAssessment: [{ databaseInstanceName: 'SQLLOGIN1' }]
        };

        expect(shouldSkipDatabaseHost(host, [selectedCred], [region], [], {})).toBe(false);
    });

    it('dedupes WAD hosts by host and region without requiring credentialId', () => {
        const uniqueList: string[] = [];
        const wadHost = {
            databaseHostId: 'offline-host-1',
            regionId: region,
            isWad: true,
            instancesAssessment: [{ databaseInstanceName: 'INST1' }]
        };

        expect(shouldSkipDatabaseHost(wadHost, [selectedCred], [region], uniqueList)).toBe(false);
        expect(uniqueList).toHaveLength(1);
        expect(shouldSkipDatabaseHost(wadHost, [selectedCred], [region], uniqueList)).toBe(true);
        expect(uniqueList).toHaveLength(1);
    });
});
