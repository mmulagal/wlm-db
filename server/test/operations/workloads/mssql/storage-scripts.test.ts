import { describe, it, expect } from 'vitest';
import { FETCH_MSSQL_INSTANCE_VOLUME_LUN_DRIVE_DETAILS } from '../../../../src/operations/workloads/mssql/storage-scripts';
import { WorkloadInstance } from '../../../../src/utils/common-types';

describe('FETCH_MSSQL_INSTANCE_VOLUME_LUN_DRIVE_DETAILS', () => {
    const instanceRecord: WorkloadInstance = {
        id: 'instance-1',
        name: 'MSSQLSERVER',
        type: 'mssql',
        region: 'us-east-1',
        sqlAuthEnabled: false,
        fsxFileSystem: 'fs-1',
        activeNodeInstanceid: 'i-1',
        resourceName: 'test-resource'
    };

    it('no longer makes a host-side ONTAP call (migrated to proxy-forwarder pattern)', () => {
        const script = FETCH_MSSQL_INSTANCE_VOLUME_LUN_DRIVE_DETAILS(instanceRecord);

        expect(script).not.toContain('Invoke-ONTAPRequest');
        expect(script).not.toContain('Get-LunFromSerialNumber');
    });

    it('still discovers drive letters locally via the SQL query and WMI volume lookup', () => {
        const script = FETCH_MSSQL_INSTANCE_VOLUME_LUN_DRIVE_DETAILS(instanceRecord);

        expect(script).toContain('Get-SerialNumberOfWinVolumes');
        expect(script).toContain('driveLetter');
        expect(script).toContain('dm_os_volume_stats');
    });
});
