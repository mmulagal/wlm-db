import { describe, it, expect, vi, beforeEach } from 'vitest';

import { updateAccountLevelAssessmentData } from '../GetWellUtils';

const { mockGetState, mockDispatch } = vi.hoisted(() => ({
    mockGetState: vi.fn(),
    mockDispatch: vi.fn()
}));

vi.mock('../../../store/store', () => ({
    default: { getState: mockGetState, dispatch: mockDispatch }
}));

vi.mock('../../../store/workloadFactory/inventoryV2Slice', () => ({
    addAllMssqlHostAssessmentData: vi.fn((payload: unknown) => ({ type: 'addAllMssqlHostAssessmentData', payload })),
    addAllOracleHostAssessmentData: vi.fn((payload: unknown) => ({ type: 'addAllOracleHostAssessmentData', payload }))
}));

const freshAssessment = {
    assessments: [{ id: 'thin-provision', status: 'not-optimized' }],
    metadata: {
        lastAssessmentTimestamp: 1773500000000,
        databaseHostName: 'adwlmcom',
        databaseInstanceName: 'ALLALLOWED'
    }
};

const identifiers = {
    databaseHostId: 'host-1',
    databaseInstanceId: 'inst-1',
    credentialId: 'cred-1',
    regionId: 'us-east-1'
};

describe('updateAccountLevelAssessmentData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('appends instance when host exists but instance was missing (Not analyzed case)', () => {
        mockGetState.mockReturnValue({
            inventoryV2: {
                allmssqlHostAssessmentData: [
                    {
                        databaseHostId: 'host-1',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        instancesAssessment: [
                            {
                                databaseInstanceId: 'other-inst',
                                assessments: { metadata: { lastAssessmentTimestamp: 1 } }
                            }
                        ]
                    }
                ]
            }
        });

        updateAccountLevelAssessmentData(mockDispatch, freshAssessment, identifiers);

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'addAllMssqlHostAssessmentData',
                payload: [
                    expect.objectContaining({
                        instancesAssessment: [
                            expect.objectContaining({ databaseInstanceId: 'other-inst' }),
                            expect.objectContaining({
                                databaseInstanceId: 'inst-1',
                                databaseInstanceName: 'ALLALLOWED',
                                assessments: freshAssessment
                            })
                        ]
                    })
                ]
            })
        );
    });

    it('updates assessments only when instance already exists (existing count case)', () => {
        mockGetState.mockReturnValue({
            inventoryV2: {
                allmssqlHostAssessmentData: [
                    {
                        databaseHostId: 'host-1',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        instancesAssessment: [
                            {
                                databaseInstanceId: 'inst-1',
                                databaseInstanceName: 'DEV-ProjectManagement',
                                assessments: { metadata: { lastAssessmentTimestamp: 1 } }
                            }
                        ]
                    }
                ]
            }
        });

        updateAccountLevelAssessmentData(
            mockDispatch,
            {
                ...freshAssessment,
                metadata: { ...freshAssessment.metadata, databaseInstanceName: 'HOSTNAMEFOO' }
            },
            identifiers
        );

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                payload: [
                    expect.objectContaining({
                        instancesAssessment: [
                            expect.objectContaining({
                                databaseInstanceId: 'inst-1',
                                databaseInstanceName: 'DEV-ProjectManagement'
                            })
                        ]
                    })
                ]
            })
        );
    });

    it('uses inventory instance name when assessment metadata concatenates host name', () => {
        mockGetState.mockReturnValue({
            inventoryV2: {
                allmssqlHostAssessmentData: [],
                inventoryTableData: {
                    'host-1_cred-1_us-east-1': {
                        id: 'host-1',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        sqlServerInstances: [
                            {
                                databaseInstanceId: 'inst-1',
                                databaseInstanceName: 'PreProd-BusinessIntelligence'
                            }
                        ]
                    }
                }
            }
        });

        updateAccountLevelAssessmentData(
            mockDispatch,
            {
                ...freshAssessment,
                metadata: {
                    ...freshAssessment.metadata,
                    databaseInstanceName: 'SQLServer-PreProd-02PreProd-BusinessIntelligence'
                }
            },
            identifiers
        );

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                payload: [
                    expect.objectContaining({
                        instancesAssessment: [
                            expect.objectContaining({
                                databaseInstanceName: 'PreProd-BusinessIntelligence'
                            })
                        ]
                    })
                ]
            })
        );
    });

    it('appends host row when assessment store is empty (Not analyzed after registration)', () => {
        mockGetState.mockReturnValue({
            inventoryV2: { allmssqlHostAssessmentData: [] }
        });

        updateAccountLevelAssessmentData(mockDispatch, freshAssessment, identifiers);

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'addAllMssqlHostAssessmentData',
                payload: [
                    expect.objectContaining({
                        databaseHostId: 'host-1',
                        isWad: false,
                        isUnregistered: false,
                        instancesAssessment: [
                            expect.objectContaining({
                                databaseInstanceId: 'inst-1',
                                assessments: freshAssessment
                            })
                        ]
                    })
                ]
            })
        );
    });

    it('marks new bulk host row as WAD when assessment payload is WAD', () => {
        mockGetState.mockReturnValue({
            inventoryV2: { allmssqlHostAssessmentData: [] }
        });

        updateAccountLevelAssessmentData(mockDispatch, { ...freshAssessment, isWad: true }, identifiers);

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                payload: [
                    expect.objectContaining({
                        databaseHostId: 'host-1',
                        isWad: true,
                        isUnregistered: false
                    })
                ]
            })
        );
    });

    it('uses inventory host id when inner-page databaseHostId differs', () => {
        mockGetState.mockReturnValue({
            inventoryV2: {
                allmssqlHostAssessmentData: [
                    {
                        databaseHostId: 'inventory-host-id',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        instancesAssessment: []
                    }
                ],
                inventoryTableData: {
                    'inventory-host-id_cred-1_us-east-1': {
                        id: 'inventory-host-id',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        sqlServerInstances: [{ databaseInstanceId: 'inst-1' }]
                    }
                }
            }
        });

        updateAccountLevelAssessmentData(mockDispatch, freshAssessment, {
            ...identifiers,
            databaseHostId: 'wrong-inner-page-id'
        });

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                payload: [
                    expect.objectContaining({
                        databaseHostId: 'inventory-host-id',
                        instancesAssessment: [
                            expect.objectContaining({
                                databaseInstanceId: 'inst-1',
                                assessments: freshAssessment
                            })
                        ]
                    })
                ]
            })
        );
    });

    it('prefers managed instance resourceId for bulk store key', () => {
        mockGetState.mockReturnValue({
            inventoryV2: {
                allmssqlHostAssessmentData: [],
                inventoryTableData: {
                    'inventory-host-id_cred-1_us-east-1': {
                        id: 'inventory-host-id',
                        resourceId: 'registered-resource-id',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        sqlServerInstances: [
                            {
                                databaseInstanceId: 'inst-1',
                                databaseInstanceName: 'ALLALLOWED',
                                resourceId: 'managed-host-resource-id'
                            }
                        ]
                    }
                }
            }
        });

        updateAccountLevelAssessmentData(mockDispatch, freshAssessment, identifiers);

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                payload: [expect.objectContaining({ databaseHostId: 'managed-host-resource-id' })]
            })
        );
    });

    it('falls back to host resourceId when instance has no resourceId', () => {
        mockGetState.mockReturnValue({
            inventoryV2: {
                allmssqlHostAssessmentData: [],
                inventoryTableData: {
                    'inventory-host-id_cred-1_us-east-1': {
                        id: 'inventory-host-id',
                        resourceId: 'registered-resource-id',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        sqlServerInstances: [{ databaseInstanceId: 'inst-1', databaseInstanceName: 'ALLALLOWED' }]
                    }
                }
            }
        });

        updateAccountLevelAssessmentData(mockDispatch, freshAssessment, identifiers);

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                payload: [expect.objectContaining({ databaseHostId: 'registered-resource-id' })]
            })
        );
    });

    it('resolves instance by name when inner page still has instance name id', () => {
        mockGetState.mockReturnValue({
            inventoryV2: {
                allmssqlHostAssessmentData: [],
                inventoryTableData: {
                    'inventory-host-id_cred-1_us-east-1': {
                        id: 'inventory-host-id',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        sqlServerInstances: [
                            {
                                databaseInstanceId: 'inst-guid-1',
                                databaseInstanceName: 'PreProd-BusinessIntelligence'
                            }
                        ]
                    }
                }
            }
        });

        updateAccountLevelAssessmentData(mockDispatch, freshAssessment, {
            ...identifiers,
            databaseHostId: 'inventory-host-id',
            databaseInstanceId: 'PreProd-BusinessIntelligence'
        });

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                payload: [
                    expect.objectContaining({
                        instancesAssessment: [expect.objectContaining({ databaseInstanceId: 'inst-guid-1' })]
                    })
                ]
            })
        );
    });

    it('updates bulk row keyed by host resourceId when inventory host id differs', () => {
        mockGetState.mockReturnValue({
            inventoryV2: {
                allmssqlHostAssessmentData: [
                    {
                        databaseHostId: 'registered-resource-id',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        instancesAssessment: [
                            {
                                databaseInstanceId: 'inst-1',
                                databaseInstanceName: 'ALLALLOWED',
                                assessments: freshAssessment
                            }
                        ]
                    }
                ],
                inventoryTableData: {
                    'inventory-host-id_cred-1_us-east-1': {
                        id: 'inventory-host-id',
                        resourceId: 'registered-resource-id',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        sqlServerInstances: [{ databaseInstanceId: 'inst-1', databaseInstanceName: 'ALLALLOWED' }]
                    }
                }
            }
        });

        updateAccountLevelAssessmentData(mockDispatch, freshAssessment, {
            ...identifiers,
            databaseHostId: 'registered-resource-id'
        });

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                payload: [
                    expect.objectContaining({
                        databaseHostId: 'registered-resource-id',
                        instancesAssessment: [expect.objectContaining({ databaseInstanceId: 'inst-1' })]
                    })
                ]
            })
        );
        expect(mockDispatch.mock.calls[0][0].payload).toHaveLength(1);
    });

    it('does not mark new instances as inventory-only when updating bulk store', () => {
        mockGetState.mockReturnValue({
            inventoryV2: {
                allmssqlHostAssessmentData: [
                    {
                        databaseHostId: 'host-1',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        instancesAssessment: [
                            {
                                databaseInstanceId: 'inst-1',
                                assessments: { metadata: { lastAssessmentTimestamp: 1 } }
                            }
                        ]
                    }
                ]
            }
        });

        updateAccountLevelAssessmentData(mockDispatch, freshAssessment, identifiers);

        const instance = mockDispatch.mock.calls[0][0].payload[0].instancesAssessment[0];
        expect(instance.inventoryOnly).toBeUndefined();
    });

    it('does not write unregistered-source assessment into dashboard bulk store', () => {
        mockGetState.mockReturnValue({
            inventoryV2: { allmssqlHostAssessmentData: [] }
        });

        updateAccountLevelAssessmentData(
            mockDispatch,
            {
                ...freshAssessment,
                metadata: { ...freshAssessment.metadata, source: 'unregistered' }
            },
            identifiers
        );

        expect(mockDispatch).not.toHaveBeenCalled();
    });
});
