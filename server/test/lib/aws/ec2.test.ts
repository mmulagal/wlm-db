import { getAmis, describeRegions } from '../../../src/lib/aws/ec2';
import { SQL_AMI_NAMES, FSX_SUPPORTED_REGIONS } from '../../../src/utils/consts';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/aws/ec2-scope';
import ec2Images from '../../simulator/responses/aws/ec2-images.json';
import fsxRegions from '../../simulator/responses/aws/list-fsx-regions.json';

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

describe('List AWS regions supporting Amazon FSx for NetApp ONTAP', () => {
    it('List of AWS regions supporting Amazon FSx for NetApp ONTAP', async () => {
        const credentialsType = 'aws_assume_role';

        const input = {
            AllRegions: false, // Describe only the regions enabled for the account
            DryRun: false,
            Filter: {
                RegionNames: Array.from(FSX_SUPPORTED_REGIONS.keys()) // Limit describe to known FSx regions only
            }
        };

        const response = await describeRegions(credentialsType, input);
        expect(response).toEqual(fsxRegions);
    });
});
