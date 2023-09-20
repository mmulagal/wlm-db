import '../../simulator/scopes/aws/fsx-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/opentelemetry-scope';
import fsxFilesystems from '../../simulator/responses/aws/list-fsx-filesystems.json';
import fsxVolumes from '../../simulator/responses/aws/list-fsx-volumes.json';
import fsxSvms from '../../simulator/responses/aws/list-fsx-svms.json';
import { DEFAULT_AWS_REGION } from '../../../src/utils/consts';
import {
    describeFSxFileSystems,
    describeFSxVolumes,
    describeFSxStorageVirtualMachines
} from '../../../src/lib/aws/fsx';
import { DEFAULT_AWS_CREDENTIALS_TYPE } from '../../utils/consts';

const FSX_FILESYSTEM_ID = 'fs-03773e21b2f0e39b4';

describe('Testcases for Amazon FSx resources', () => {
    it('List FSx Filesystems', async () => {
        const response = await describeFSxFileSystems(DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION);
        expect(response).toEqual(fsxFilesystems.FileSystems);
    });

    it('List FSx Volumes', async () => {
        const response = await describeFSxVolumes(DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION, FSX_FILESYSTEM_ID);
        expect(response).toEqual(fsxVolumes);
    });

    it('List FSx SVMs', async () => {
        const response = await describeFSxStorageVirtualMachines(
            DEFAULT_AWS_CREDENTIALS_TYPE,
            DEFAULT_AWS_REGION,
            FSX_FILESYSTEM_ID
        );
        expect(response).toEqual(fsxSvms);
    });
});
