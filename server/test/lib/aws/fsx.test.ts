import '../../simulator/scopes/aws/fsx-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import fsxFilesystems from '../../simulator/responses/aws/list-fsx-filesystems.json';
import fsxVolumes from '../../simulator/responses/aws/list-fsx-volumes.json';
import { DEFAULT_AWS_REGION } from '../../../src/utils/consts';
import { describeFSxFileSystems, describeFSxVolumes } from '../../../src/lib/aws/fsx';
import { DEFAULT_AWS_CREDENTIALS_TYPE } from '../../utils/consts';

const FSX_FILESYSTEM_ID = 'fs-03773e21b2f0e39b4';

describe('Testcases for Amazon FSx resources', () => {
    it('List FSx Filesystems', async () => {
        const response = await describeFSxFileSystems(DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION);
        expect(response).toEqual(fsxFilesystems);
    });

    it('List FSx Volumes', async () => {
        const response = await describeFSxVolumes(DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION, FSX_FILESYSTEM_ID);
        expect(response).toEqual(fsxVolumes);
    });
});
