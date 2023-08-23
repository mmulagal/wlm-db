import {
    getServiceToken,
    getTenancyResourcesByType,
    registerServiceResource
} from '../../../src/lib/cloud-manager/tenancy';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import registerServiceResponse from '../../simulator/responses/cloud-manager/register-service-resource-tenancy.json';
import getTenancyResourceResponse from '../../simulator/responses/cloud-manager/get-tenancy-resources-by-type.json';

describe('tenancny resource lib', () => {
    it('should return a service token', async () => {
        const resp = await getServiceToken();
        expect(resp).toBeDefined();
    });

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
});
