import { getAmiList, getFSxAvailableRegionsList } from '../../../src/operations/aws/ec2-operations';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/aws/ec2-scope';
import { DEFAULT_AWS_REGION } from '../../../src/utils/consts';

describe('List EC2 AMIs Operation', () => {
    it('list of EC2 AMIs', async () => {
        const credentialsType = 'aws_assume_role';
        const resp = await getAmiList(credentialsType, 'us-east-1');
        expect(resp).toBeDefined();
    });
});

describe('List AWS regions supporting Amazon FSx for NetApp ONTAP', () => {
    it('List of Amazon FSx for NetApp ONTAP regions', async () => {
        const fsxRegionsResponse = {
            regions: [
                {
                    regionName: 'ap-south-2',
                    descriptiveRegionName: 'Asia Pacific (Hyderabad)'
                },
                {
                    regionName: 'ap-south-1',
                    descriptiveRegionName: 'Asia Pacific (Mumbai)'
                },
                {
                    regionName: 'eu-south-1',
                    descriptiveRegionName: 'Europe (Milan)'
                },
                {
                    regionName: 'eu-south-2',
                    descriptiveRegionName: 'Europe (Spain)'
                },
                {
                    regionName: 'me-central-1',
                    descriptiveRegionName: 'Middle East (UAE)'
                },
                {
                    regionName: 'ca-central-1',
                    descriptiveRegionName: 'Canada (Central)'
                },
                {
                    regionName: 'eu-central-1',
                    descriptiveRegionName: 'Europe (Frankfurt)'
                },
                {
                    regionName: 'eu-central-2',
                    descriptiveRegionName: 'Europe (Zurich)'
                },
                {
                    regionName: 'us-west-1',
                    descriptiveRegionName: 'US West (N. California)'
                },
                {
                    regionName: 'us-west-2',
                    descriptiveRegionName: 'US West (Oregon)'
                },
                {
                    regionName: 'af-south-1',
                    descriptiveRegionName: 'Africa (Cape Town)'
                },
                {
                    regionName: 'eu-north-1',
                    descriptiveRegionName: 'Europe (Stockholm)'
                },
                {
                    regionName: 'eu-west-3',
                    descriptiveRegionName: 'Europe (Paris)'
                },
                {
                    regionName: 'eu-west-2',
                    descriptiveRegionName: 'Europe (London)'
                },
                {
                    regionName: 'eu-west-1',
                    descriptiveRegionName: 'Europe (Ireland)'
                },
                {
                    regionName: 'ap-northeast-2',
                    descriptiveRegionName: 'Asia Pacific (Seoul)'
                },
                {
                    regionName: 'me-south-1',
                    descriptiveRegionName: 'Middle East (Bahrain)'
                },
                {
                    regionName: 'ap-northeast-1',
                    descriptiveRegionName: 'Asia Pacific (Tokyo)'
                },
                {
                    regionName: 'sa-east-1',
                    descriptiveRegionName: 'South America (Sao Paulo)'
                },
                {
                    regionName: 'ap-east-1',
                    descriptiveRegionName: 'Asia Pacific (Hong Kong)'
                },
                {
                    regionName: 'ap-southeast-1',
                    descriptiveRegionName: 'Asia Pacific (Singapore)'
                },
                {
                    regionName: 'ap-southeast-2',
                    descriptiveRegionName: 'Asia Pacific (Sydney)'
                },
                {
                    regionName: 'ap-southeast-3',
                    descriptiveRegionName: 'Asia Pacific (Jakarta)'
                },
                {
                    regionName: 'ap-southeast-4',
                    descriptiveRegionName: 'Asia Pacific (Melbourne)'
                },
                {
                    regionName: 'us-east-1',
                    descriptiveRegionName: 'US East (N. Virginia)'
                },
                {
                    regionName: 'us-east-2',
                    descriptiveRegionName: 'US East (Ohio)'
                }
            ]
        };

        const credentialsType = 'aws_assume_role';

        const response = await getFSxAvailableRegionsList(credentialsType, DEFAULT_AWS_REGION);
        expect(response).toEqual(fsxRegionsResponse);
    });
});
