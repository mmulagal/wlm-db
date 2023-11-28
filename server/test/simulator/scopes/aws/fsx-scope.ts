// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {
    FSxClient,
    DescribeFileSystemsCommand,
    DescribeVolumesCommand,
    DescribeStorageVirtualMachinesCommand,
    DescribeBackupsCommand,
    ListTagsForResourceCommand
} from '@aws-sdk/client-fsx';
import { mockClient } from 'aws-sdk-client-mock';
import fsxFileSystemsResponse from '../../responses/aws/list-fsx-filesystems.json';
import fsxVolumesResponse from '../../responses/aws/list-fsx-volumes.json';
import fsxSVMResponse from '../../responses/aws/list-fsx-svms.json';
import fsxBackupResponse from '../../responses/aws/list-fsx-backups.json';
import fsxResourceTagsResponse from '../../responses/aws/list-fsx-resource-tags.json';

const FSX_FILTER = { FileSystemIds: ['fs-03773e21b2f0e39b4'] };

const fsxMock = mockClient(FSxClient);

fsxMock.on(DescribeFileSystemsCommand).resolves(fsxFileSystemsResponse);
fsxMock.on(DescribeVolumesCommand).resolves(fsxVolumesResponse);
fsxMock.on(DescribeStorageVirtualMachinesCommand).resolves(fsxSVMResponse);
fsxMock.on(DescribeBackupsCommand).resolves(fsxBackupResponse);
fsxMock.on(DescribeFileSystemsCommand, FSX_FILTER).resolves(fsxFileSystemsResponse.FileSystems[0]);
fsxMock.on(ListTagsForResourceCommand).resolves(fsxResourceTagsResponse);
