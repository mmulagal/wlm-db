import registerSsmLink from '../../../src/lib/cloud-manager/link-service';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/cloud-manager/link-service-scope';

describe('SSM link service', () => {
    it('Register SSM link', async () => {
        const response = await registerSsmLink('name', 'arn', 'credentialsId', 'linux', 'accId');
        if (response) {
            expect(response.id).toBeDefined();
            expect(response.name).toBeDefined();
        }
    });

    it('Register SSM link with invalid ARN', async () => {
        const response = await registerSsmLink('name', 'invalid arn', 'credentialsId', 'linux', 'accId');
        expect(response).toBeNull();
    });
});
