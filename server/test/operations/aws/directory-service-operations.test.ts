import { faker } from '@faker-js/faker';
import { getAdsList } from '../../../src/operations/aws/directory-service-operations';
import adsResponse from '../../simulator/responses/aws/list-ads.json';

const credentialsid = `${faker.string.alphanumeric(20)}`;

const mockdata = {
    directories: [
        {
            id: 'd-927example',
            dnsIpAddress: ['172.30.21.228', '172.30.9.82'],
            domainName: 'corp.example.com',
            shortName: 'example',
            ssoEnabled: true,
            status: 'Active',
            type: 'MicrosoftAD',
            vpcSettings: {
                availabilityZones: ['us-west-2a', 'us-west-2b'],
                subnetIds: ['subnet-ba0146de', 'subnet-bef46bc8'],
                vpcId: 'vpc-7d4a2818'
            }
        }
    ]
};

vi.mock('../../../src/lib/aws/directory-service', async () => {
    return {
        describeDirectories() {
            return adsResponse;
        }
    };
});

describe('getAdsList method test', () => {
    it('getAdsList method should return mock data if VPC ID is matched', async () => {
        const resp = await getAdsList(credentialsid, 'ap-southeast-1', 'vpc-7d4a2818');
        expect(resp).toEqual(mockdata);
    });

    it('getAdsList method should return empty data if VPC ID is not matched', async () => {
        const resp = await getAdsList(credentialsid, 'ap-southeast-1', 'vpc-123');
        expect(resp).toEqual({ directories: [] });
    });
});
