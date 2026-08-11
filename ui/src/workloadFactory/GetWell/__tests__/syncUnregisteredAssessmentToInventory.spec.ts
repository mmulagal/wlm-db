import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DBType, INVENTORY_STATUS } from '../../../utils/consts';

import { syncUnregisteredAssessmentToInventory } from '../GetWellUtils';

const { mockGetState, mockDispatch } = vi.hoisted(() => ({
    mockGetState: vi.fn(),
    mockDispatch: vi.fn()
}));

vi.mock('../../../store/store', () => ({
    default: { getState: mockGetState, dispatch: mockDispatch }
}));

vi.mock('../../../store/workloadFactory/inventoryV2Slice', () => ({
    addAllMssqlHostAssessmentData: vi.fn((payload: unknown) => ({ type: 'addAllMssqlHostAssessmentData', payload })),
    addAllOracleHostAssessmentData: vi.fn((payload: unknown) => ({ type: 'addAllOracleHostAssessmentData', payload })),
    addUnregisteredMssqlAssessmentData: vi.fn((payload: unknown) => ({
        type: 'addUnregisteredMssqlAssessmentData',
        payload
    })),
    addUnregisteredOracleAssessmentData: vi.fn((payload: unknown) => ({
        type: 'addUnregisteredOracleAssessmentData',
        payload
    })),
    setInventoryTableData: vi.fn((payload: unknown) => ({ type: 'setInventoryTableData', payload }))
}));

const hostKey = 'i-host-1_cred-1_us-east-1';
const freshAssessment = {
    assessments: [{ id: 'thin-provision', status: 'not-optimized' }],
    metadata: { lastAssessmentTimestamp: 1773500000000, source: 'unregistered' }
};

describe('syncUnregisteredAssessmentToInventory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetState.mockReturnValue({
            inventoryV2: {
                unregisteredMssqlAssessmentData: [],
                allmssqlHostAssessmentData: [{ databaseHostId: 'managed-host', isWad: false, isUnregistered: false }],
                inventoryTableData: {
                    [hostKey]: {
                        hostType: DBType.MSSQL,
                        ec2InstanceId: 'i-host-1',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        sqlServerInstances: [
                            {
                                databaseInstanceName: 'ALLALLOWED',
                                statusColText: INVENTORY_STATUS.UNMANAGED,
                                isUnregistered: false,
                                isWad: false
                            }
                        ]
                    }
                }
            }
        });
    });

    it('updates unregistered store and merges wadAssessmentData onto the matching inventory row', () => {
        syncUnregisteredAssessmentToInventory(
            mockDispatch,
            freshAssessment,
            {
                ec2InstanceId: 'i-host-1',
                instanceName: 'ALLALLOWED',
                credentialId: 'cred-1',
                regionId: 'us-east-1'
            },
            DBType.MSSQL
        );

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'addUnregisteredMssqlAssessmentData',
                payload: [
                    expect.objectContaining({
                        vmInstanceId: 'i-host-1',
                        databaseInstanceName: 'ALLALLOWED',
                        assessments: freshAssessment,
                        isUnregistered: true
                    })
                ]
            })
        );

        const inventoryDispatch = mockDispatch.mock.calls.find(
            ([action]: [{ type: string }]) => action.type === 'setInventoryTableData'
        );
        expect(inventoryDispatch).toBeDefined();
        const mergedInventory = inventoryDispatch![0].payload;
        const instance = mergedInventory[hostKey].sqlServerInstances[0];
        expect(instance.isUnregistered).toBe(true);
        expect(instance.wadAssessmentData).toBe(freshAssessment);
    });

    it('merges unregistered data into allmssqlHostAssessmentData for Well-arch tab widgets', () => {
        syncUnregisteredAssessmentToInventory(mockDispatch, freshAssessment, {
            ec2InstanceId: 'i-host-1',
            instanceName: 'ALLALLOWED',
            credentialId: 'cred-1',
            regionId: 'us-east-1'
        });

        const allAssessmentDispatch = mockDispatch.mock.calls.find(
            ([action]: [{ type: string }]) => action.type === 'addAllMssqlHostAssessmentData'
        );
        expect(allAssessmentDispatch).toBeDefined();
        expect(allAssessmentDispatch![0].payload).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    databaseHostId: 'i-host-1',
                    isUnregistered: true,
                    instancesAssessment: expect.arrayContaining([
                        expect.objectContaining({ databaseInstanceName: 'ALLALLOWED' })
                    ])
                })
            ])
        );
    });

    it('does not restore registered bulk rows removed during sync', () => {
        const registeredHost = {
            databaseHostId: 'managed-host',
            credentialId: 'cred-1',
            regionId: 'us-east-1',
            isWad: false,
            isUnregistered: false,
            instancesAssessment: [{ databaseInstanceName: 'ALLALLOWED' }]
        };
        const postRemoveBulkData: any[] = [];

        mockGetState
            .mockReturnValueOnce({
                inventoryV2: {
                    unregisteredMssqlAssessmentData: [],
                    allmssqlHostAssessmentData: [registeredHost],
                    inventoryTableData: {
                        [hostKey]: {
                            resourceId: 'managed-host',
                            ec2InstanceId: 'i-host-1',
                            credentialId: 'cred-1',
                            regionId: 'us-east-1',
                            sqlServerInstances: [{ databaseInstanceName: 'ALLALLOWED', resourceId: 'managed-host' }]
                        }
                    }
                }
            })
            .mockReturnValueOnce({
                inventoryV2: {
                    unregisteredMssqlAssessmentData: [],
                    allmssqlHostAssessmentData: [registeredHost],
                    inventoryTableData: {
                        [hostKey]: {
                            resourceId: 'managed-host',
                            ec2InstanceId: 'i-host-1',
                            credentialId: 'cred-1',
                            regionId: 'us-east-1',
                            sqlServerInstances: [{ databaseInstanceName: 'ALLALLOWED', resourceId: 'managed-host' }]
                        }
                    }
                }
            })
            .mockReturnValue({
                inventoryV2: {
                    unregisteredMssqlAssessmentData: [],
                    allmssqlHostAssessmentData: postRemoveBulkData,
                    inventoryTableData: {
                        [hostKey]: {
                            resourceId: 'managed-host',
                            ec2InstanceId: 'i-host-1',
                            credentialId: 'cred-1',
                            regionId: 'us-east-1',
                            sqlServerInstances: [{ databaseInstanceName: 'ALLALLOWED', resourceId: 'managed-host' }]
                        }
                    }
                }
            });

        syncUnregisteredAssessmentToInventory(mockDispatch, freshAssessment, {
            ec2InstanceId: 'i-host-1',
            instanceName: 'ALLALLOWED',
            credentialId: 'cred-1',
            regionId: 'us-east-1'
        });

        const finalBulkDispatch = mockDispatch.mock.calls
            .filter(([action]: [{ type: string }]) => action.type === 'addAllMssqlHostAssessmentData')
            .at(-1);
        expect(finalBulkDispatch).toBeDefined();
        expect(finalBulkDispatch![0].payload).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ databaseHostId: 'managed-host' })])
        );
        expect(finalBulkDispatch![0].payload).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    databaseHostId: 'i-host-1',
                    isUnregistered: true
                })
            ])
        );
    });
});
