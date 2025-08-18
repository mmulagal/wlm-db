import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/marketing-scope';
import '../../simulator/scopes/aws/ec2-scope';
import '../../simulator/scopes/aws/compute-optimizer-scope';
import '../../simulator/scopes/aws/ssm-scope';
import {
    invokeMarketingApi,
    handleMarketingApiFsxCalculationObject,
    formatStorageSavingsCalculationMetrics
} from '../../../src/operations/cloud-manager/marketing-operations';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';

const ebsVolumeIds = ['vol-12345', 'vol-67890'];

describe('Marketing API operations', () => {
    it('should invoke marketing API', async () => {
        const requestBody = {
            snapshotFrequency: 'daily',
            clonedCopiesCount: 1,
            cloneRefreshFrequency: 'daily',
            monthlyChangeRatePercentage: 30
        };

        const resp = await invokeMarketingApi(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            'AOAG',
            ebsVolumeIds,
            requestBody
        );

        expect(resp.ebs).toBeDefined();
        expect(resp.fsx).toBeDefined();
        if (resp.single?.fsx_calculation) {
            expect(resp.single?.fsx_calculation).toBeDefined();
        }
    });

    it('should format metrics correctly', async () => {
        // Exercise
        const result = await formatStorageSavingsCalculationMetrics(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            ebsVolumeIds,
            {
                snapshotFrequency: 'daily',
                clonedCopiesCount: 1,
                cloneRefreshFrequency: 'daily',
                monthlyChangeRatePercentage: 30
            },
            'AOAG'
        );

        expect(result.ebsCalculation).toBeDefined();
        if (result.single) {
            expect(result.single?.fsxCloneCalculation).toBeDefined();
            expect(result.single?.fsxOntapCalculation).toBeDefined();
        }
    });

    it('should handle fsx calculation object', async () => {
        const {
            single: { fsx_calculation: fsxCalcObject, fsx_cost_calculation_no_snapshot: fsxNoSnapshotCalcObject } = {}
        } = await invokeMarketingApi(ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION, 'AOAG', ebsVolumeIds, {
            snapshotFrequency: 'daily',
            clonedCopiesCount: 1,
            cloneRefreshFrequency: 'daily',
            monthlyChangeRatePercentage: 30
        });
        if (fsxCalcObject) {
            const result = handleMarketingApiFsxCalculationObject(fsxCalcObject, fsxNoSnapshotCalcObject);
            expect(result).toBeDefined();
        }
    });
});
