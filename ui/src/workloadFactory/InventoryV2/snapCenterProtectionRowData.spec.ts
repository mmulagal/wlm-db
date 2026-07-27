import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSnapCenterProtectionRowData, buildSnapCenterProtectionRowDataFromDashboardRow } from './snapCenterProtectionRowData';

vi.mock('../../store/store', () => ({
    default: {
        getState: vi.fn()
    }
}));

import store from '../../store/store';

describe('buildSnapCenterProtectionRowData', () => {
    beforeEach(() => {
        vi.mocked(store.getState).mockReturnValue({
            getWellOptimize: {
                selectedHostname: 'host1',
                selectedDatabaseInstanceName: 'MSSQLSERVER',
                selectedGwInstanceCredId: 'cred-1',
                selectedGwInstanceRegionId: 'us-east-1',
                selectedResourceId: 'res-1',
                selectedRowFsxId: 'fsx-1',
                selectedDatabaseStorageType: 'Standalone',
                innerPageDetails: { ec2InstanceId: 'i-123', fsxId: 'fsx-inner' }
            },
            inventoryV2: {
                inventoryTableData: {
                    'res-1_cred-1_us-east-1': {
                        name: 'host1',
                        fqdn: 'HOST1.WLM.COM',
                        nodeIpAddress: '10.0.0.1',
                        ec2InstanceId: 'i-inv',
                        fsxId: 'fsx-inv',
                        sqlServerInstances: [
                            {
                                databaseInstanceName: 'MSSQLSERVER',
                                ec2InstanceId: 'i-inst',
                                sqlServerDeploymentType: 'Standalone',
                                nodeIpAddress: '10.0.0.2'
                            }
                        ]
                    }
                }
            }
        } as any);
    });

    it('maps Get Well context to inventory protect row shape', () => {
        const row = buildSnapCenterProtectionRowData();

        expect(row.databaseInstanceName).toBe('MSSQLSERVER');
        expect(row.name).toBe('host1');
        expect(row.credentialId).toBe('cred-1');
        expect(row.regionId).toBe('us-east-1');
        expect(row.ec2InstanceId).toBe('i-123');
        expect(row.fsxId).toBe('fsx-1');
        expect(row.hostRow.fqdn).toBe('HOST1.WLM.COM');
        expect(row.hostRow.nodeIpAddress).toBe('10.0.0.1');
    });

    it('falls back to Redux context when inventory host data is missing', () => {
        vi.mocked(store.getState).mockReturnValue({
            getWellOptimize: {
                selectedHostname: 'fallback-host.example.com',
                selectedDatabaseInstanceName: 'MSSQLSERVER',
                selectedGwInstanceCredId: 'cred-1',
                selectedGwInstanceRegionId: 'us-east-1',
                selectedResourceId: 'res-missing',
                selectedRowFsxId: 'fsx-fallback',
                selectedDatabaseStorageType: 'Standalone',
                innerPageDetails: { ec2InstanceId: 'i-fallback', fsxId: 'fsx-inner' }
            },
            inventoryV2: { inventoryTableData: {} }
        } as any);

        const row = buildSnapCenterProtectionRowData();

        expect(row.name).toBe('fallback-host');
        expect(row.ec2InstanceId).toBe('i-fallback');
        expect(row.fsxId).toBe('fsx-fallback');
        expect(row.hostRow.fqdn).toBe('fallback-host.example.com');
    });
});

describe('buildSnapCenterProtectionRowDataFromDashboardRow', () => {
    beforeEach(() => {
        vi.mocked(store.getState).mockReturnValue({
            inventoryV2: {
                inventoryTableData: {
                    'host-1_cred-1_us-east-1': {
                        name: 'dbhost1',
                        fqdn: 'DBHOST1.WLM.COM',
                        resourceId: 'host-1',
                        ec2InstanceId: 'i-dashboard',
                        fsxId: 'fsx-dash',
                        nodeIpAddress: '10.0.0.5',
                        sqlServerInstances: [
                            {
                                databaseInstanceName: 'MSSQLSERVER2',
                                ec2InstanceId: 'i-inst-dash',
                                sqlServerDeploymentType: 'Standalone',
                                fqdn: 'DBHOST1.WLM.COM'
                            }
                        ]
                    }
                }
            }
        } as any);
    });

    it('maps dashboard row to inventory protect row shape', () => {
        const row = buildSnapCenterProtectionRowDataFromDashboardRow({
            databaseHostId: 'host-1',
            credentialId: 'cred-1',
            regionId: 'us-east-1',
            serverInstanceName: 'MSSQLSERVER2',
            hostName: 'dbhost1.example.com'
        });

        expect(row.databaseInstanceName).toBe('MSSQLSERVER2');
        expect(row.name).toBe('dbhost1');
        expect(row.credentialId).toBe('cred-1');
        expect(row.regionId).toBe('us-east-1');
        expect(row.ec2InstanceId).toBe('i-dashboard');
        expect(row.resourceId).toBe('host-1');
        expect(row.hostRow.fqdn).toBe('DBHOST1.WLM.COM');
    });

    it('falls back to dashboard row fields when inventory host data is missing', () => {
        vi.mocked(store.getState).mockReturnValue({
            inventoryV2: { inventoryTableData: {} }
        } as any);

        const row = buildSnapCenterProtectionRowDataFromDashboardRow({
            databaseHostId: 'host-1',
            credentialId: 'cred-1',
            regionId: 'us-east-1',
            serverInstanceName: 'MSSQLSERVER2',
            hostName: 'dbhost1.example.com',
            ec2InstanceId: 'i-row',
            fsxId: 'fsx-row'
        });

        expect(row.databaseInstanceName).toBe('MSSQLSERVER2');
        expect(row.name).toBe('dbhost1');
        expect(row.credentialId).toBe('cred-1');
        expect(row.regionId).toBe('us-east-1');
        expect(row.resourceId).toBe('host-1');
        expect(row.hostRow.fqdn).toBe('dbhost1.example.com');
        expect(row.ec2InstanceId).toBe('i-row');
        expect(row.fsxId).toBe('fsx-row');
    });
});
