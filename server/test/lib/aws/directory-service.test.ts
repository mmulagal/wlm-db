import { faker } from '@faker-js/faker';
import { describeDirectories } from '../../../src/lib/aws/directory-service';
import adsResponse from '../../simulator/responses/aws/list-ads.json';

const credentialsid = `${faker.string.alphanumeric(20)}`;

describe('Directory service Lib', () => {
    it('Describe directories', async () => {
        const resp = await describeDirectories(credentialsid, 'ap-southeast-1', {});
        expect(resp).toEqual(adsResponse);
    });
});
