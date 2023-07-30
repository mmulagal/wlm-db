import { getFSxFileSystemsList } from '../../../src/operations/aws/fsx-operations';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/aws/fsx-scope';
import { DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION } from '../../../src/utils/consts';

const DEFAULT_VPC_ID = 'vpc-84b3afe6';

describe('List Amazon FSx for NetApp ONTAP filesystems', () => {
    it('List of Amazon FSx for NetApp ONTAP filesystems', async () => {
        const response = await getFSxFileSystemsList(DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION, DEFAULT_VPC_ID);
        expect(response).toBeDefined();
    });
});
