import { getAmiList } from '../../../src/operations/aws/ec2-operations';

import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/aws/ec2-scope';

describe('List EC2 AMIs Operation', () => {
    it('list of EC2 AMIs', async () => {
        const credentialsType = 'aws_assume_role';
        const resp = await getAmiList(credentialsType, 'us-east-1');
        expect(resp).toBeDefined();
    });
});
