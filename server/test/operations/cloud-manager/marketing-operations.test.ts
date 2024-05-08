import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/marketing-scope';
import {
    performStorageSavingsCalculations,
    getStorageSavingsCalculationMetrics
} from '../../../src/operations/cloud-manager/marketing-operations';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';
import { inventoryDemoData } from '../../../src/utils/demo-utils/demoInventoryData';

type SqlStorage = {
    type?: string;
};

describe('Marketing API operations ', () => {
    it('Perform Storage Savings Calculations', async () => {
        const { items } = inventoryDemoData('fsx', 'ebsTest');

        const instanceWithEbs = items.find(instance =>
            instance.sqlServerInstances?.find(({ storage }) =>
                storage?.find((sqlStorage: SqlStorage) => sqlStorage?.type === 'EBS')
            )
        );
        if (instanceWithEbs?.ec2InstanceId !== undefined) {
            const resp = await performStorageSavingsCalculations(
                ACCOUNT_ID,
                CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                instanceWithEbs.ec2InstanceId,
                {
                    snapshotFrequency: 'daily',
                    clonedCopiesCount: 1,
                    cloneRefreshFrequency: 'daily',
                    monthlyChangeRatePercentage: 30
                }
            );
            expect(resp.ebs).toBeDefined();
            expect(resp.fsx).toBeDefined();
            expect(resp.fsxCalculation).toBeDefined();
        }
    });

    it('Perform Storage Savings Calculations without ebs', async () => {
        const { items } = inventoryDemoData('fsx', 'ebsTest');

        const instanceWithoutEbs = items.find(instance =>
            instance.sqlServerInstances?.find(
                ({ storage }) => !storage?.find((sqlStorage: SqlStorage) => sqlStorage?.type === 'EBS')
            )
        );
        if (instanceWithoutEbs?.ec2InstanceId !== undefined) {
            try {
                await performStorageSavingsCalculations(
                    ACCOUNT_ID,
                    CREDENTIALS_ID,
                    DEFAULT_AWS_REGION,
                    instanceWithoutEbs.ec2InstanceId,
                    {
                        snapshotFrequency: 'daily',
                        clonedCopiesCount: 1,
                        cloneRefreshFrequency: 'daily',
                        monthlyChangeRatePercentage: 30
                    }
                );
            } catch (error: any) {
                expect(error.message).toBe(
                    `No EBS volumes found for the provided instance: ${instanceWithoutEbs?.ec2InstanceId}`
                );
            }
        }
    });

    it('Perform Storage Savings Calculations', async () => {
        const { items } = inventoryDemoData('fsx', 'ebsTest');

        const instanceWithEbs = items.find(instance =>
            instance.sqlServerInstances?.find(({ storage }) =>
                storage?.find((sqlStorage: SqlStorage) => sqlStorage?.type === 'EBS')
            )
        );
        if (instanceWithEbs?.ec2InstanceId !== undefined) {
            const resp = await getStorageSavingsCalculationMetrics(
                ACCOUNT_ID,
                CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                instanceWithEbs.ec2InstanceId,
                {
                    snapshotFrequency: 'daily',
                    clonedCopiesCount: 1,
                    cloneRefreshFrequency: 'daily',
                    monthlyChangeRatePercentage: 30
                }
            );
            expect(resp.fsxOntapCalculation).toBeDefined();
            expect(resp.fsxOntapSnapshotCalculation).toBeDefined();
            expect(resp.ebsCalculation).toBeDefined();
        }
    });

    it('Get Storage Savings Calculations metrics without ebs', async () => {
        const { items } = inventoryDemoData('fsx', 'ebsTest');

        const instanceWithoutEbs = items.find(instance =>
            instance.sqlServerInstances?.find(
                ({ storage }) => !storage?.find((sqlStorage: SqlStorage) => sqlStorage?.type === 'EBS')
            )
        );
        if (instanceWithoutEbs?.ec2InstanceId !== undefined) {
            try {
                await getStorageSavingsCalculationMetrics(
                    ACCOUNT_ID,
                    CREDENTIALS_ID,
                    DEFAULT_AWS_REGION,
                    instanceWithoutEbs.ec2InstanceId,
                    {
                        snapshotFrequency: 'daily',
                        clonedCopiesCount: 1,
                        cloneRefreshFrequency: 'daily',
                        monthlyChangeRatePercentage: 30
                    }
                );
            } catch (error: any) {
                expect(error.message).toBe(
                    `No EBS volumes found for the provided instance: ${instanceWithoutEbs?.ec2InstanceId}`
                );
            }
        }
    });
});
