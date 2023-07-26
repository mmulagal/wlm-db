import { faker } from '@faker-js/faker';
import { describeDirectories } from '../../../src/lib/aws/directory-service';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import adsResponse from '../../simulator/responses/aws/list-ads.json';
import '../../simulator/scopes/aws/directory-service-scope';

const credentialsid = `${faker.string.alphanumeric(20)}`;

describe('Directory service Lib', () => {
    it('Describe directories', async () => {
        const resp = await describeDirectories(credentialsid, 'ap-southeast-1', {});
        expect(resp).toEqual(adsResponse);
    });
});
