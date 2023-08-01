import '../../simulator/scopes/aws/fsx-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import fsxFilesystems from '../../simulator/responses/aws/list-fsx-filesystems.json';
import { DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION } from '../../../src/utils/consts';
import { describeFSxFileSystems, describeFSxVolumes } from '../../../src/lib/aws/fsx';

const FSX_FILESYSTEM_ID = 'fs-03773e21b2f0e39b4';

describe('List Amazon FSx for NetApp ONTAP filesystems', () => {
    it('Should return a list of Amazon FSx for NetApp ONTAP filesystems', async () => {
        const response = await describeFSxFileSystems(DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION);
        expect(response).toEqual(fsxFilesystems);
    });
});

describe('List Amazon FSx for NetApp ONTAP volumes', () => {
    it('Should return a list of Amazon FSx for NetApp ONTAP volumes', async () => {
        const response = await describeFSxVolumes(DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION, FSX_FILESYSTEM_ID);
        expect(response).toBeDefined();
    });
});
