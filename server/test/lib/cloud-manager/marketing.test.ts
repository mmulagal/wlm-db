import {
    getStorageSavings,
    getInstanceListFromStorage,
    getVolumesListFromStorage
} from '../../../src/lib/cloud-manager/marketing';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/cloud-manager/marketing-scope';
import { getMarketingApiRequestBody } from '../../../src/operations/cloud-manager/marketing-operations';

describe('Marketing lib', () => {
    it('Getting storage savings', async () => {
        const response = await getStorageSavings(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            getMarketingApiRequestBody(
                ['vol-0f32f6c69fb7e40ac'],
                {
                    snapshotFrequency: 'daily',
                    clonedCopiesCount: 1,
                    cloneRefreshFrequency: 'daily',
                    monthlyChangeRatePercentage: 30
                },
                'AOAG'
            )
        );
        expect(response.ebs).toBeDefined();
        expect(response.fsx).toBeDefined();
        expect(response.fsx_calculation).toBeDefined();
    });
    it('Getting storage instances', async () => {
        const response = await getInstanceListFromStorage(ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION);
        expect(response.ec2Instances).toBeDefined();
    });
    it('Getting storage volumes', async () => {
        const response = await getVolumesListFromStorage(ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION, 'i-demo1');
        expect(response.volumeInstances).toBeDefined();
    });
});
