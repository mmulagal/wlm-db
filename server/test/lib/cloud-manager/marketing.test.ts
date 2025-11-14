import {
    getStorageSavings,
    getInstanceListFromStorage,
    getVolumesListFromStorage,
    getEbsManualModeStorageSavings
} from '../../../src/lib/cloud-manager/marketing';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/cloud-manager/marketing-scope';
import {
    AutomaticModeMarketingRequestBody,
    ManualModeEbsComparisonV2Response,
    ManualModeMarketingRequestBodyEBS
} from '../../../src/utils/marketing-types';
import { getMarketingApiRequestBody } from '../../../src/operations/cloud-manager/marketing/marketing-operations-utils';
import { getEbsMarketingApiManualModeRequestBody } from '../../../src/operations/cloud-manager/marketing/marketing-request-utils';

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
            ) as AutomaticModeMarketingRequestBody
        );
        expect(response.ebs).toBeDefined();
        expect(response.fsx).toBeDefined();
        expect(response.single?.fsx_calculation).toBeDefined();
    });
    it('Getting storage savings manual', async () => {
        const volumes = [
            { volumeType: 'io2', volumeNumber: 2, storageAmount: 1024 * 2, volumeIops: 40000, throughput: 128 }
        ];
        const requestBody = getEbsMarketingApiManualModeRequestBody(DEFAULT_AWS_REGION, {
            sqlServerDeploymentType: 'AOAG',
            clonedCopiesCount: 1,
            monthlyChangeRatePercentage: 30,
            snapshotFrequency: 'daily',
            sqlServerEdition: 'Enterprise',
            ec2Instances: [
                {
                    ec2InstanceDescription: 'test',
                    ec2InstanceType: 'm5.2xlarge',
                    isPrimary: true,
                    volumes
                }
            ]
        }) as ManualModeMarketingRequestBodyEBS;

        const response = await getEbsManualModeStorageSavings<ManualModeEbsComparisonV2Response>(
            ACCOUNT_ID,
            requestBody
        );
        expect(response.ebsResults).toBeDefined();
        expect(response.fsx).toBeDefined();
        expect(response.fsx_calculation).toBeDefined();
    });

    it('Getting FsxW storage savings Automatic', async () => {
        const response = await getStorageSavings(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            getMarketingApiRequestBody(
                [],
                {
                    snapshotFrequency: 'daily',
                    clonedCopiesCount: 1,
                    cloneRefreshFrequency: 'daily',
                    monthlyChangeRatePercentage: 30
                },
                'FCI',
                ['fs-0f32f6c69fb7e40ac']
            ) as AutomaticModeMarketingRequestBody
        );
        expect(response.fsxw).toBeDefined();
        expect(response.single?.fsx_calculation).toBeDefined();
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
