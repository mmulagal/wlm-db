import { getAmiList, getFSxAvailableRegionsList } from '../../../src/operations/aws/ec2-operations';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/aws/ec2-scope';
import { DEFAULT_AWS_CREDENTIALS_TYPE } from '../../../../server/src/utils/consts';

describe('List EC2 AMIs Operation', () => {
    it('list of EC2 AMIs', async () => {
        const credentialsType = DEFAULT_AWS_CREDENTIALS_TYPE;
        const resp = await getAmiList(credentialsType, 'us-east-1');
        expect(resp).toBeDefined();
    });
});

describe('List AWS regions supporting Amazon FSx for NetApp ONTAP', () => {
    it('List of Amazon FSx for NetApp ONTAP regions', async () => {
        const fsxRegionsResponse = {
            regions: [
                {
                    regionCode: 'ap-south-2',
                    regionName: 'Asia Pacific (Hyderabad)'
                },
                {
                    regionCode: 'ap-south-1',
                    regionName: 'Asia Pacific (Mumbai)'
                },
                {
                    regionCode: 'eu-south-1',
                    regionName: 'Europe (Milan)'
                },
                {
                    regionCode: 'eu-south-2',
                    regionName: 'Europe (Spain)'
                },
                {
                    regionCode: 'me-central-1',
                    regionName: 'Middle East (UAE)'
                },
                {
                    regionCode: 'ca-central-1',
                    regionName: 'Canada (Central)'
                },
                {
                    regionCode: 'eu-central-1',
                    regionName: 'Europe (Frankfurt)'
                },
                {
                    regionCode: 'eu-central-2',
                    regionName: 'Europe (Zurich)'
                },
                {
                    regionCode: 'us-west-1',
                    regionName: 'US West (N. California)'
                },
                {
                    regionCode: 'us-west-2',
                    regionName: 'US West (Oregon)'
                },
                {
                    regionCode: 'af-south-1',
                    regionName: 'Africa (Cape Town)'
                },
                {
                    regionCode: 'eu-north-1',
                    regionName: 'Europe (Stockholm)'
                },
                {
                    regionCode: 'eu-west-3',
                    regionName: 'Europe (Paris)'
                },
                {
                    regionCode: 'eu-west-2',
                    regionName: 'Europe (London)'
                },
                {
                    regionCode: 'eu-west-1',
                    regionName: 'Europe (Ireland)'
                },
                {
                    regionCode: 'ap-northeast-2',
                    regionName: 'Asia Pacific (Seoul)'
                },
                {
                    regionCode: 'me-south-1',
                    regionName: 'Middle East (Bahrain)'
                },
                {
                    regionCode: 'ap-northeast-1',
                    regionName: 'Asia Pacific (Tokyo)'
                },
                {
                    regionCode: 'sa-east-1',
                    regionName: 'South America (Sao Paulo)'
                },
                {
                    regionCode: 'ap-east-1',
                    regionName: 'Asia Pacific (Hong Kong)'
                },
                {
                    regionCode: 'ap-southeast-1',
                    regionName: 'Asia Pacific (Singapore)'
                },
                {
                    regionCode: 'ap-southeast-2',
                    regionName: 'Asia Pacific (Sydney)'
                },
                {
                    regionCode: 'ap-southeast-3',
                    regionName: 'Asia Pacific (Jakarta)'
                },
                {
                    regionCode: 'ap-southeast-4',
                    regionName: 'Asia Pacific (Melbourne)'
                },
                {
                    regionCode: 'us-east-1',
                    regionName: 'US East (N. Virginia)'
                },
                {
                    regionCode: 'us-east-2',
                    regionName: 'US East (Ohio)'
                }
            ]
        };

        const credentialsType = DEFAULT_AWS_CREDENTIALS_TYPE;

        const response = await getFSxAvailableRegionsList(credentialsType);
        expect(response).toEqual(fsxRegionsResponse);
    });
});
