// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {
    FSxClient,
    DescribeFileSystemsCommand,
    DescribeVolumesCommand,
    DescribeStorageVirtualMachinesCommand,
    DescribeBackupsCommand,
    ListTagsForResourceCommand,
    UpdateFileSystemCommand
} from '@aws-sdk/client-fsx';
import { mockClient } from 'aws-sdk-client-mock';
import fsxFileSystemsResponse from '../../responses/aws/list-fsx-filesystems.json';
import fsxVolumesResponse from '../../responses/aws/list-fsx-volumes.json';
import fsxSVMResponse from '../../responses/aws/list-fsx-svms.json';
import fsxnBackupResponse from '../../responses/aws/list-fsxn-backups.json';
import fsxwBackupResponse from '../../responses/aws/list-fsxw-backups.json';
import fsxResourceTagsResponse from '../../responses/aws/list-fsx-resource-tags.json';
import fsxUpdateFileSystemResponse from '../../responses/aws/fsx-update-filesystem.json';

const fsxMock = mockClient(FSxClient);

/** Simulated scheduled-backup retention after `UpdateFileSystem` (per FSx id) for demo / simulator. */
const fsxAutomaticBackupRetentionDays = new Map();

const fsxnBackupWithModifiedCreationTime = {
    Backups: fsxnBackupResponse.Backups.map(backup => ({
        ...backup,
        CreationTime: new Date()
    }))
};

fsxMock.on(DescribeFileSystemsCommand).callsFake(input => {
    const ids = input?.FileSystemIds;
    if (!ids?.length) {
        return fsxFileSystemsResponse;
    }
    const allSystems = fsxFileSystemsResponse.FileSystems || [];
    const fileSystems = ids.map(id => {
        const base = allSystems.find(f => f.FileSystemId === id);
        const overrideDays = fsxAutomaticBackupRetentionDays.get(id);
        if (base) {
            const clone = JSON.parse(JSON.stringify(base));
            if (overrideDays !== undefined) {
                clone.OntapConfiguration = {
                    ...(clone.OntapConfiguration || {}),
                    AutomaticBackupRetentionDays: overrideDays
                };
            }
            return clone;
        }
        return {
            FileSystemId: id,
            FileSystemType: 'ONTAP',
            Lifecycle: 'AVAILABLE',
            StorageCapacity: 35840,
            OntapConfiguration: {
                AutomaticBackupRetentionDays: overrideDays ?? 0,
                DailyAutomaticBackupStartTime: '03:00',
                DeploymentType: 'SINGLE_AZ_1',
                ThroughputCapacity: 128
            }
        };
    });
    return { FileSystems: fileSystems };
});
fsxMock.on(DescribeVolumesCommand).resolves(fsxVolumesResponse);
fsxMock.on(DescribeStorageVirtualMachinesCommand).resolves(fsxSVMResponse);
fsxMock
    .on(DescribeBackupsCommand, params => params.Filters[0].Name === 'volume-id')
    .resolves(fsxnBackupWithModifiedCreationTime);
fsxMock.on(DescribeBackupsCommand, params => params.Filters[0].Name === 'file-system-id').resolves(fsxwBackupResponse);
fsxMock.on(ListTagsForResourceCommand).resolves(fsxResourceTagsResponse);
fsxMock.on(UpdateFileSystemCommand).callsFake(input => {
    if (input?.FileSystemId != null) {
        const days = input.OntapConfiguration?.AutomaticBackupRetentionDays;
        if (typeof days === 'number') {
            if (days > 0) {
                fsxAutomaticBackupRetentionDays.set(input.FileSystemId, days);
            } else {
                fsxAutomaticBackupRetentionDays.delete(input.FileSystemId);
            }
        }
    }
    return fsxUpdateFileSystemResponse;
});

function resetFsxSimulatorBackupRetention() {
    fsxAutomaticBackupRetentionDays.clear();
}

export { fsxnBackupWithModifiedCreationTime, resetFsxSimulatorBackupRetention };
