import { describeFSxFileSystems } from '../../../src/lib/aws/fsx';
import { DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION } from '../../../src/utils/consts';
import '../../simulator/scopes/aws/fsx-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import fsxFilesystems from '../../simulator/responses/aws/list-fsx-filesystems.json';

describe('List Amazon FSx for NetApp ONTAP filesystems', () => {
    it('List of AWS regions supporting Amazon FSx for NetApp ONTAP', async () => {
        const response = await describeFSxFileSystems(DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION);
        expect(response).toEqual(fsxFilesystems);
    });
});
