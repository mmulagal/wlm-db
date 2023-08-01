import '../../simulator/scopes/aws/fsx-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import { DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION, DEFAULT_AWS_VPC_ID } from '../../../src/utils/consts';
import { getFSxFileSystemsList } from '../../../src/operations/aws/fsx-operations';

describe('List Amazon FSx for NetApp ONTAP filesystems', () => {
    it('List of Amazon FSx for NetApp ONTAP filesystems', async () => {
        const response = await getFSxFileSystemsList(
            DEFAULT_AWS_CREDENTIALS_TYPE,
            DEFAULT_AWS_REGION,
            DEFAULT_AWS_VPC_ID
        );
        expect(response).toBeDefined();
    });
});
