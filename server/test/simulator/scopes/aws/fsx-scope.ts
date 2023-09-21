// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {
    FSxClient,
    DescribeFileSystemsCommand,
    DescribeVolumesCommand,
    DescribeStorageVirtualMachinesCommand
} from '@aws-sdk/client-fsx';
import { mockClient } from 'aws-sdk-client-mock';
import fsxFileSystemsResponse from '../../responses/aws/list-fsx-filesystems.json';
import fsxVolumesResponse from '../../responses/aws/list-fsx-volumes.json';
import fsxSVMResponse from '../../responses/aws/list-fsx-svms.json';

const fsxMock = mockClient(FSxClient);

fsxMock.on(DescribeFileSystemsCommand).resolves(fsxFileSystemsResponse);
fsxMock.on(DescribeVolumesCommand).resolves(fsxVolumesResponse);
fsxMock.on(DescribeStorageVirtualMachinesCommand).resolves(fsxSVMResponse);
