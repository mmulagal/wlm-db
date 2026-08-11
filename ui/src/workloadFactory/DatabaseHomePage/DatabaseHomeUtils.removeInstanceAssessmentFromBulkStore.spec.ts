import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DBType, WELL_ARCH_ASSESSMENT_FLOW } from '../../utils/consts';

import {
    removeInstanceAssessmentFromBulkStore,
    removeRegisteredInstanceAssessmentFromBulkStore,
    removeUnregisteredInstanceAssessmentOnRegister
} from './DatabaseHomeUtils';

import store from '../../store/store';

const mockDispatch = vi.fn();

vi.mock('../../store/store', () => ({
    default: {
        getState: vi.fn(),
        dispatch: vi.fn()
    }
}));

vi.mock('../../store/workloadFactory/inventoryV2Slice', () => ({
    addAllMssqlHostAssessmentData: vi.fn((payload: unknown) => ({
        type: 'addAllMssqlHostAssessmentData',
        payload
    })),
    addAllOracleHostAssessmentData: vi.fn((payload: unknown) => ({
        type: 'addAllOracleHostAssessmentData',
        payload
    })),
    addUnregisteredMssqlAssessmentData: vi.fn((payload: unknown) => ({
        type: 'addUnregisteredMssqlAssessmentData',
        payload
    })),
    addUnregisteredOracleAssessmentData: vi.fn((payload: unknown) => ({
        type: 'addUnregisteredOracleAssessmentData',
        payload
    })),
    setManagedHostInstanceLoading: vi.fn()
}));

describe('removeInstanceAssessmentFromBulkStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('registered alias removes continuous-assessment instance rows', () => {
        vi.mocked(store.getState).mockReturnValue({
            inventoryV2: {
                allmssqlHostAssessmentData: [
                    {
                        databaseHostId: 'managed-host-1',
                        credentialId: 'cred',
                        regionId: 'region',
                        isUnregistered: false,
                        isWad: false,
                        instancesAssessment: [{ databaseInstanceName: 'ALLALLOWED' }, { databaseInstanceName: 'OTHER' }]
                    }
                ]
            }
        } as any);

        removeRegisteredInstanceAssessmentFromBulkStore(
            mockDispatch,
            {
                instanceName: 'ALLALLOWED',
                credentialId: 'cred',
                regionId: 'region',
                managedHostId: 'managed-host-1'
            },
            DBType.MSSQL
        );

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                payload: [
                    expect.objectContaining({
                        instancesAssessment: [expect.objectContaining({ databaseInstanceName: 'OTHER' })]
                    })
                ]
            })
        );
    });

    it('unregistered alias clears flat store and bulk unregistered host rows', () => {
        vi.mocked(store.getState).mockReturnValue({
            inventoryV2: {
                unregisteredMssqlAssessmentData: [
                    {
                        vmInstanceId: 'i-ec2',
                        databaseInstanceName: 'ALLALLOWED',
                        assessments: { metadata: { lastAssessmentTimestamp: 1 } }
                    }
                ],
                allmssqlHostAssessmentData: [
                    {
                        databaseHostId: 'i-ec2',
                        credentialId: 'cred',
                        regionId: 'region',
                        isUnregistered: true,
                        instancesAssessment: [
                            { databaseInstanceName: 'ALLALLOWED' },
                            { databaseInstanceName: 'DOMAINLOGIN1' }
                        ]
                    }
                ]
            }
        } as any);

        removeUnregisteredInstanceAssessmentOnRegister(
            mockDispatch,
            {
                instanceName: 'ALLALLOWED',
                credentialId: 'cred',
                regionId: 'region',
                ec2InstanceId: 'i-ec2'
            },
            DBType.MSSQL
        );

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'addUnregisteredMssqlAssessmentData', payload: [] })
        );
        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                payload: [
                    expect.objectContaining({
                        instancesAssessment: [expect.objectContaining({ databaseInstanceName: 'DOMAINLOGIN1' })]
                    })
                ]
            })
        );
    });

    it('leaves unregistered bulk rows untouched when source is registered', () => {
        vi.mocked(store.getState).mockReturnValue({
            inventoryV2: {
                allmssqlHostAssessmentData: [
                    {
                        databaseHostId: 'i-ec2',
                        credentialId: 'cred',
                        regionId: 'region',
                        isUnregistered: true,
                        instancesAssessment: [{ databaseInstanceName: 'ALLALLOWED' }]
                    }
                ]
            }
        } as any);

        removeInstanceAssessmentFromBulkStore(
            mockDispatch,
            {
                instanceName: 'ALLALLOWED',
                credentialId: 'cred',
                regionId: 'region',
                ec2InstanceId: 'i-ec2'
            },
            DBType.MSSQL,
            WELL_ARCH_ASSESSMENT_FLOW.REGISTERED
        );

        expect(mockDispatch).not.toHaveBeenCalled();
    });
});
