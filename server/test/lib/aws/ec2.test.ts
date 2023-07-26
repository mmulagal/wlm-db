import { getAmis } from '../../../src/lib/aws/ec2';
import { SQL_AMI_NAMES } from '../../../src/utils/consts';

import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/aws/ec2-scope';
import ec2Images from '../../simulator/responses/aws/ec2-images.json';

describe('List EC2 AMIs', () => {
    it('should return a list of EC2 AMIs', async () => {
        const credentialsType = 'aws_assume_role';
        const params = {
            Filters: [
                { Name: 'name', Values: SQL_AMI_NAMES },
                { Name: 'owner-alias', Values: ['amazon'] }
            ]
        };
        const resp = await getAmis(credentialsType, 'us-east-1', params);
        expect(resp).toEqual(ec2Images);
    });
});
