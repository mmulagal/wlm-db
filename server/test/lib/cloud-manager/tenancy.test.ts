import { faker } from '@faker-js/faker/locale/af_ZA';
import jwt from 'jsonwebtoken';
import {
    getTenancyResourcesByType,
    registerServiceResource,
    generateAuthToken,
    verifyAuthToken,
    getTenancyAccounts,
    getPermissionsForUser
} from '../../../src/lib/cloud-manager/tenancy';
import registerServiceResponse from '../../simulator/responses/cloud-manager/register-service-resource-tenancy.json';
import getTenancyResourceResponse from '../../simulator/responses/cloud-manager/get-tenancy-resources-by-type.json';
import tenancyAccountsResponse from '../../simulator/responses/cloud-manager/tenancy-accounts.json';
import { SECRETS } from '../../../src/utils/consts';

SECRETS.AUTH_CLIENT_ID = `${faker.string.uuid()}`;

function generateBearerToken() {
    const secretKey = faker.string.alphanumeric(32);
    const payload = {
        userId: faker.string.alphanumeric(32),
        username: faker.internet.username(),
        sub: faker.internet.username()
    };
    const options: jwt.SignOptions = {
        expiresIn: '1h'
    };
    const token = jwt.sign(payload, secretKey, options);
    return `Bearer ${token}`;
}

describe('tenancny resource lib', () => {
    // it('should return a service token', async () => {
    //     const resp = await getServiceToken();
    //     expect(resp).toBeDefined();
    // });

    it('should return a tenancy resources by type', async () => {
        const resp = await getTenancyResourcesByType('MYSQL');
        expect(resp).toEqual(getTenancyResourceResponse);
    });

    it('should register a service in tenancy', async () => {
        const resp = await registerServiceResource({
            workspacePublicId: 'workspacexfNTR6as',
            accountPublicId: 'account-HwskUzae',
            resourceIdentifier: 'VsaWorkingEnvironment-test',
            name: 'sathish-fsx',
            resourceType: 'wlm_fsx_test',
            resourceClass: 'wlm_fsx_test',
            metadata: {
                propertyName: 'wlm',
                propertyValue: 'fsx'
            }
        });
        expect(resp).toEqual(registerServiceResponse);
    });

    it('should generate an auth token', async () => {
        const { token } = generateAuthToken({ user: 'SYSTEM' });
        const reponse = verifyAuthToken(token);
        expect(reponse).toBeDefined();
    });

    it('should verify an auth token', async () => {
        expect(() => verifyAuthToken('test')).toThrowError('Invalid token.');
    });

    test('Get user permissions in an account', async () => {
        const userToken = generateBearerToken();

        const response = await getPermissionsForUser(userToken, 'account-Ui6gAGPX');

        expect(response.role).toBeDefined();
    });

    test('Get tenancy accounts', async () => {
        const userToken = generateBearerToken();
        const accounts = await getTenancyAccounts(userToken);

        expect(accounts.length).toEqual(tenancyAccountsResponse.length);
    });
});
