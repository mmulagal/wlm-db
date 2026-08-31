import { describe, expect, it, vi } from 'vitest';
import { DBType, INVENTORY_STATUS } from '../../utils/consts';
import {
    formatInstanceData,
    getInstanceFsxLinkExists,
    isRegisteredInstanceRow,
    updateSqlServerInstancesForUnmanaged
} from './InventoryUtilsV2';

vi.mock('../../store/store', () => ({
    default: {
        getState: () => ({
            headers: { credentialMapping: {}, regionMapping: {} },
            inventoryV2: {
                fsxCredentialStatusObj: { 'fs-0f32f6c69fb7e40ac': true },
                discoveredHosts: {
                    discoveredHostData: [
                        {
                            ec2InstanceId: 'i-07a29eb681ba37679',
                            ssmState: 'connected',
                            hostManageReadiness: {
                                extensiveRunPermission: true,
                                fsxLinkExists: false,
                                fsxLinksCount: 0
                            },
                            sqlServerInstances: ['ALLALLOWED', 'DOMAINLOGIN1'].map(sqlServerInstance => ({
                                sqlServerInstance,
                                sqlServerState: 'Running',
                                windowsAuthentication: true,
                                storage: [{ type: 'FSXN', id: 'fs-0f32f6c69fb7e40ac', fileSystemName: 'wlmdb-fsx-2' }]
                            }))
                        }
                    ]
                },
                discoveredOracleHosts: { discoveredOracleHostData: null }
            }
        })
    }
}));

const databaseInstanceDetails = [
    { instanceName: 'ALLALLOWED', databaseInstanceId: 'guid-allallowed', isManaged: true, instanceState: 'Up' },
    { instanceName: 'DOMAINLOGIN1', databaseInstanceId: '', isManaged: false, instanceState: 'Up' }
];

const instanceTopology = {
    fileSystemType: 'FSx for ONTAP',
    fileSystemId: 'fs-0f32f6c69fb7e40ac',
    fsxLinkExists: false,
    fsxLinksCount: 0
};

// database-hosts list row: no nodeTopology, and only the registered instance has a summary entry.
const managedListRow: any = {
    id: 'b4684a50b73111b0',
    hostType: DBType.MSSQL,
    databaseInstanceDetails,
    databaseInstancesSummary: [
        {
            databaseInstanceId: 'guid-allallowed',
            databaseInstanceName: 'allallowed',
            status: 'Up',
            databaseInstanceTopology: instanceTopology
        }
    ]
};

// Per-host instances response: carries nodeTopology plus a summary entry per instance.
const instancesApiRow: any = {
    id: 'b4684a50b73111b0',
    nodeTopology: { ec2Details: [{ id: 'i-07a29eb681ba37679' }] },
    databaseInstanceDetails,
    databaseInstancesSummary: [
        {
            databaseInstanceId: 'guid-allallowed',
            databaseInstanceName: 'allallowed',
            status: 'Up',
            databaseInstanceTopology: instanceTopology
        },
        {
            databaseInstanceId: '',
            databaseInstanceName: 'domainlogin1',
            status: 'Up',
            databaseInstanceTopology: instanceTopology
        }
    ]
};

describe('a partially registered host', () => {
    const listInstances: any = formatInstanceData(managedListRow);
    const inventoryRow: any = {
        resourceId: managedListRow.id,
        hostType: DBType.MSSQL,
        ec2InstanceId: 'i-07a29eb681ba37679',
        credentialId: 'cred-1',
        regionId: 'ap-southeast-1',
        sqlServerInstances: listInstances
    };
    const mergedInstances: any = updateSqlServerInstancesForUnmanaged(instancesApiRow, inventoryRow, true);
    const rowFor = (name: string) => ({
        ...mergedInstances.find((inst: any) => inst?.databaseInstanceName === name),
        resourceId: inventoryRow.resourceId
    });

    it('classifies each instance by its own registration state, not the shared host resourceId', () => {
        expect(rowFor('ALLALLOWED').statusColText).toBe(INVENTORY_STATUS.MANAGED);
        expect(rowFor('DOMAINLOGIN1').statusColText).not.toBe(INVENTORY_STATUS.MANAGED);
        expect(isRegisteredInstanceRow(rowFor('ALLALLOWED'))).toBe(true);
        expect(isRegisteredInstanceRow(rowFor('DOMAINLOGIN1'))).toBe(false);
    });

    it('recovers the discover host readiness once the per-host response supplies nodeTopology', () => {
        // The list row has no EC2 id to match discover on, so readiness only arrives with the merge.
        expect(
            listInstances.find((inst: any) => inst?.databaseInstanceName === 'DOMAINLOGIN1').hostManageReadiness
        ).toBeUndefined();
        expect(rowFor('DOMAINLOGIN1').hostManageReadiness).toEqual({
            extensiveRunPermission: true,
            fsxLinkExists: false,
            fsxLinksCount: 0
        });
    });

    it('reports the missing FSx link per instance', () => {
        expect(getInstanceFsxLinkExists(rowFor('DOMAINLOGIN1'))).toBe(false);
    });
});
