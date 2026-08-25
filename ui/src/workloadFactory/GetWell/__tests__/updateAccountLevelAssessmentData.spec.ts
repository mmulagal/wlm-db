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

    it('patches the existing host-keyed row (not an orphan instance-resourceId row) so the visited instance stays findable', () => {
        // Mirrors real data: the instance carries its own resourceId (from a prior manage/register
        // job) that differs from the host's EC2 id, and the inner page passes that instance resourceId
        // as the raw databaseHostId identifier.
        mockGetState.mockReturnValue({
            inventoryV2: {
                allmssqlHostAssessmentData: [
                    {
                        // row created by the bulk fetch, keyed by the host's EC2 id — this is the row
                        // Inventory's findAssessmentHostForInventoryKey and the dashboard can find
                        databaseHostId: 'ec2-1',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        instancesAssessment: [
                            {
                                databaseInstanceId: 'sibling-inst',
                                databaseInstanceName: 'DOMAINLOGIN1',
                                assessments: { metadata: { lastAssessmentTimestamp: 1 } }
                            },
                            {
                                databaseInstanceId: 'inst-1',
                                databaseInstanceName: 'ALLALLOWED',
                                assessments: { metadata: { lastAssessmentTimestamp: 1 } }
                            }
                        ]
                    }
                ],
                inventoryTableData: {
                    'host-uuid_cred-1_us-east-1': {
                        id: 'host-uuid',
                        ec2InstanceId: 'ec2-1',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        sqlServerInstances: [
                            {
                                databaseInstanceId: 'inst-1',
                                databaseInstanceName: 'ALLALLOWED',
                                resourceId: 'instance-resource-id'
                            }
                        ]
                    }
                }
            }
        });

        updateAccountLevelAssessmentData(mockDispatch, freshAssessment, {
            ...identifiers,
            databaseHostId: 'instance-resource-id'
        });

        const { payload } = mockDispatch.mock.calls[0][0];
        expect(payload).toHaveLength(1);
        expect(payload[0].databaseHostId).toBe('ec2-1');
        expect(payload[0].instancesAssessment).toEqual([
            expect.objectContaining({ databaseInstanceId: 'sibling-inst', databaseInstanceName: 'DOMAINLOGIN1' }),
            expect.objectContaining({ databaseInstanceId: 'inst-1', assessments: freshAssessment })
        ]);
    });

    it('does not touch an unrelated host row that happens to share an instance name', () => {
        mockGetState.mockReturnValue({
            inventoryV2: {
                allmssqlHostAssessmentData: [
                    {
                        databaseHostId: 'other-host',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        instancesAssessment: [
                            {
                                databaseInstanceId: 'unrelated-inst',
                                databaseInstanceName: 'ALLALLOWED',
                                assessments: { metadata: { lastAssessmentTimestamp: 1 } }
                            }
                        ]
                    },
                    {
                        databaseHostId: 'ec2-1',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        instancesAssessment: []
                    }
                ],
                inventoryTableData: {
                    'host-uuid_cred-1_us-east-1': {
                        id: 'host-uuid',
                        ec2InstanceId: 'ec2-1',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        sqlServerInstances: [
                            {
                                databaseInstanceId: 'inst-1',
                                databaseInstanceName: 'ALLALLOWED',
                                resourceId: 'instance-resource-id'
                            }
                        ]
                    }
                }
            }
        });

        updateAccountLevelAssessmentData(mockDispatch, freshAssessment, {
            ...identifiers,
            databaseHostId: 'instance-resource-id'
        });

        const { payload } = mockDispatch.mock.calls[0][0];
        expect(payload).toHaveLength(2);
        const otherRow = payload.find((host: any) => host.databaseHostId === 'other-host');
        expect(otherRow.instancesAssessment).toEqual([
            expect.objectContaining({ databaseInstanceId: 'unrelated-inst', databaseInstanceName: 'ALLALLOWED' })
        ]);
        const ownRow = payload.find((host: any) => host.databaseHostId === 'ec2-1');
        expect(ownRow.instancesAssessment).toEqual([
            expect.objectContaining({ databaseInstanceId: 'inst-1', assessments: freshAssessment })
        ]);
    });

    it('prefers the exact-key row over a fuzzy EC2-id match when both exist for the same instance', () => {
        // Real-world case: the bulk fetch already returned two rows for the same physical instance —
        // the real one keyed by the host's own managed id (which is also the raw identifier the inner
        // page passes back), and a stale/placeholder duplicate keyed by an unrelated id whose
        // vmInstanceId happens to equal the host's EC2 id. The placeholder must never be preferred:
        // doing so causes the dedup step to delete the real, findable row.
        mockGetState.mockReturnValue({
            inventoryV2: {
                allmssqlHostAssessmentData: [
                    {
                        databaseHostId: 'stale-placeholder-id',
                        vmInstanceId: 'ec2-1',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        instancesAssessment: [
                            {
                                databaseInstanceId: 'inst-1',
                                databaseInstanceName: 'ALLALLOWED',
                                assessments: { metadata: { lastAssessmentTimestamp: 0 } }
                            }
                        ]
                    },
                    {
                        databaseHostId: 'host-uuid',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        instancesAssessment: [
                            {
                                databaseInstanceId: 'inst-1',
                                databaseInstanceName: 'ALLALLOWED',
                                assessments: { metadata: { lastAssessmentTimestamp: 1773000000000 } }
                            }
                        ]
                    }
                ],
                inventoryTableData: {
                    'host-uuid_cred-1_us-east-1': {
                        id: 'host-uuid',
                        ec2InstanceId: 'ec2-1',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        sqlServerInstances: [
                            {
                                databaseInstanceId: 'inst-1',
                                databaseInstanceName: 'ALLALLOWED'
                            }
                        ]
                    }
                }
            }
        });

        updateAccountLevelAssessmentData(mockDispatch, freshAssessment, {
            ...identifiers,
            databaseHostId: 'host-uuid',
            databaseInstanceId: 'inst-1'
        });

        const { payload } = mockDispatch.mock.calls[0][0];
        expect(payload).toHaveLength(2);
        const realRow = payload.find((host: any) => host.databaseHostId === 'host-uuid');
        expect(realRow.instancesAssessment).toEqual([
            expect.objectContaining({ databaseInstanceId: 'inst-1', assessments: freshAssessment })
        ]);
        const placeholderRow = payload.find((host: any) => host.databaseHostId === 'stale-placeholder-id');
        expect(placeholderRow).toBeDefined();
    });

    it('resolves the host by its own id, not by scanning all hosts for a shared default instance name', () => {
        // Real-world case: every standalone SQL Server host exposes an instance literally named
        // "MSSQLSERVER", and the inner page passes that shared name as databaseInstanceId. Matching
        // instance name across ALL hosts (instead of first narrowing to the host identified by
        // databaseHostId) can resolve to a totally unrelated host — corrupting its data and, via the
        // dedup step, deleting the real host's own "MSSQLSERVER" instance entirely.
        mockGetState.mockReturnValue({
            inventoryV2: {
                allmssqlHostAssessmentData: [
                    {
                        databaseHostId: 'host-a',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        instancesAssessment: [
                            {
                                databaseInstanceId: 'guid-a',
                                databaseInstanceName: 'MSSQLSERVER',
                                assessments: { metadata: { lastAssessmentTimestamp: 1 } }
                            }
                        ]
                    },
                    {
                        databaseHostId: 'host-b',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        instancesAssessment: [
                            {
                                databaseInstanceId: 'guid-b',
                                databaseInstanceName: 'MSSQLSERVER',
                                assessments: { metadata: { lastAssessmentTimestamp: 1 } }
                            }
                        ]
                    }
                ],
                inventoryTableData: {
                    'host-a_cred-1_us-east-1': {
                        id: 'host-a',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        sqlServerInstances: [{ databaseInstanceId: 'guid-a', databaseInstanceName: 'MSSQLSERVER' }]
                    },
                    'host-b_cred-1_us-east-1': {
                        id: 'host-b',
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        sqlServerInstances: [{ databaseInstanceId: 'guid-b', databaseInstanceName: 'MSSQLSERVER' }]
                    }
                }
            }
        });

        updateAccountLevelAssessmentData(mockDispatch, freshAssessment, {
            ...identifiers,
            databaseHostId: 'host-b',
            databaseInstanceId: 'MSSQLSERVER'
        });

        const { payload } = mockDispatch.mock.calls[0][0];
        expect(payload).toHaveLength(2);
        const hostA = payload.find((host: any) => host.databaseHostId === 'host-a');
        expect(hostA.instancesAssessment).toEqual([expect.objectContaining({ databaseInstanceId: 'guid-a' })]);
        const hostB = payload.find((host: any) => host.databaseHostId === 'host-b');
        expect(hostB.instancesAssessment).toEqual([
            expect.objectContaining({ databaseInstanceId: 'guid-b', assessments: freshAssessment })
        ]);
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
