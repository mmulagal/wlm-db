import {
    fsxwAutomaticDemoModeCallingManualApi,
    ebsAutomaticDemoModeCallingManualApi
} from '../../../src/operations/cloud-manager/marketing/marketing-operations-demo';
import { ACCOUNT_ID } from '../../utils/consts';
import { SqlServerDeploymentModel } from '../../../src/utils/consts';

describe('Marketing Operations Demo', () => {
    describe('fsxwAutomaticDemoModeCallingManualApi', () => {
        it('should return FSxW demo data for single AZ deployment', async () => {
            const region = 'us-east-1';
            const clonedCopiesCount = 1;
            const sqlServerDeploymentType = SqlServerDeploymentModel.SQL_STANDALONE_SHORT;
            const monthlyChangeRatePercentage = 30;

            const result = await fsxwAutomaticDemoModeCallingManualApi(
                region,
                clonedCopiesCount,
                sqlServerDeploymentType,
                monthlyChangeRatePercentage,
                ACCOUNT_ID
            );

            expect(result).toBeDefined();
            expect(result.fsxw).toBeDefined();
            expect(result.fsx).toBeDefined();
            expect(result.single).toBeDefined();

            // Verify FSxW summary structure
            expect(result.fsxw.capacity).toBeDefined();
            expect(result.fsxw.iops).toBeDefined();
            expect(result.fsxw.throughput).toBeDefined();
            expect(result.fsxw.total).toBeDefined();

            // Verify FSx summary structure
            expect(result.fsx.capacity).toBeDefined();
            expect(result.fsx.iops).toBeDefined();
            expect(result.fsx.throughput).toBeDefined();
            expect(result.fsx.total).toBeDefined();
        });

        it('should return FSxW demo data for multi AZ deployment (FCI)', async () => {
            const region = 'us-west-2';
            const clonedCopiesCount = 2;
            const sqlServerDeploymentType = SqlServerDeploymentModel.SQL_FCI_SHORT;
            const monthlyChangeRatePercentage = 25;

            const result = await fsxwAutomaticDemoModeCallingManualApi(
                region,
                clonedCopiesCount,
                sqlServerDeploymentType,
                monthlyChangeRatePercentage,
                ACCOUNT_ID
            );

            expect(result).toBeDefined();
            expect(result.fsxw).toBeDefined();
            expect(result.fsx).toBeDefined();
            expect(result.multi).toBeDefined(); // Should be multi for FCI deployment
        });

        it('should handle zero cloned copies count', async () => {
            const region = 'eu-west-1';
            const clonedCopiesCount = 0;
            const sqlServerDeploymentType = SqlServerDeploymentModel.SQL_STANDALONE_SHORT;
            const monthlyChangeRatePercentage = 20;

            const result = await fsxwAutomaticDemoModeCallingManualApi(
                region,
                clonedCopiesCount,
                sqlServerDeploymentType,
                monthlyChangeRatePercentage,
                ACCOUNT_ID
            );

            expect(result).toBeDefined();
            expect(result.fsxw).toBeDefined();
            expect(result.fsx).toBeDefined();
            expect(result.single).toBeDefined();
        });
    });

    describe('ebsAutomaticDemoModeCallingManualApi', () => {
        it('should return EBS demo data for standalone deployment', async () => {
            const sqlServerDeploymentType = SqlServerDeploymentModel.SQL_STANDALONE_SHORT;
            const instanceIds = ['i-1234567890abcdef0'];
            const region = 'us-east-1';
            const clonedCopiesCount = 1;
            const monthlyChangeRatePercentage = 30;

            const result = await ebsAutomaticDemoModeCallingManualApi(
                sqlServerDeploymentType,
                instanceIds,
                region,
                clonedCopiesCount,
                monthlyChangeRatePercentage,
                ACCOUNT_ID
            );

            expect(result).toBeDefined();
            expect(result.ebs).toBeDefined();
            expect(result.ebsClassification).toBeDefined();
            expect(result.fsx).toBeDefined();
            // Check if result has single property (type guard)
            if ('single' in result) {
                expect(result.single).toBeDefined();
            }
            expect(result.fsxOptimized).toBeDefined();
            expect(result.fsxOptimizedSingle).toBeDefined();

            // Verify EBS summary structure
            expect(result.ebs.capacity).toBeDefined();
            expect(result.ebs.iops).toBeDefined();
            expect(result.ebs.throughput).toBeDefined();
            expect(result.ebs.total).toBeDefined();
        });

        it('should return EBS demo data for AOAG deployment', async () => {
            const sqlServerDeploymentType = SqlServerDeploymentModel.SQL_AOAG_SHORT;
            const instanceIds = ['i-1234567890abcdef0', 'i-0987654321fedcba0'];
            const region = 'us-west-2';
            const clonedCopiesCount = 2;
            const monthlyChangeRatePercentage = 25;

            const result = await ebsAutomaticDemoModeCallingManualApi(
                sqlServerDeploymentType,
                instanceIds,
                region,
                clonedCopiesCount,
                monthlyChangeRatePercentage,
                ACCOUNT_ID
            );

            expect(result).toBeDefined();
            expect(result.ebs).toBeDefined();
            expect(result.ebsClassification).toBeDefined();
            expect(result.fsx).toBeDefined();
            // Check if result has multi property (type guard)
            if ('multi' in result) {
                expect(result.multi).toBeDefined(); // Should be multi for AOAG
            }
            expect(result.fsxOptimized).toBeDefined();

            // For AOAG, should have io2 volumes with higher capacity
            expect(result.ebsClassification.io2).toBeDefined();
            if (result.ebsClassification.io2) {
                expect(result.ebsClassification.io2.ebs).toBeDefined();
            }
        });

        it('should handle no instance IDs provided', async () => {
            const sqlServerDeploymentType = SqlServerDeploymentModel.SQL_STANDALONE_SHORT;
            const instanceIds = undefined;
            const region = 'ap-northeast-1';
            const clonedCopiesCount = 1;
            const monthlyChangeRatePercentage = 20;

            const result = await ebsAutomaticDemoModeCallingManualApi(
                sqlServerDeploymentType,
                instanceIds,
                region,
                clonedCopiesCount,
                monthlyChangeRatePercentage,
                ACCOUNT_ID
            );

            expect(result).toBeDefined();
            expect(result.ebs).toBeDefined();
            expect(result.ebsClassification).toBeDefined();
            expect(result.fsx).toBeDefined();
            // Check if result has single property (type guard)
            if ('single' in result) {
                expect(result.single).toBeDefined();
            }
        });

        it('should generate optimized values correctly', async () => {
            const sqlServerDeploymentType = SqlServerDeploymentModel.SQL_STANDALONE_SHORT;
            const instanceIds = ['i-1234567890abcdef0'];
            const region = 'us-east-1';
            const clonedCopiesCount = 2;
            const monthlyChangeRatePercentage = 35;

            const result = await ebsAutomaticDemoModeCallingManualApi(
                sqlServerDeploymentType,
                instanceIds,
                region,
                clonedCopiesCount,
                monthlyChangeRatePercentage,
                ACCOUNT_ID
            );

            expect(result.fsxOptimized).toBeDefined();
            expect(result.fsxOptimizedSingle).toBeDefined();

            // Verify optimized values are generated with reduced throughput and IOPS
            if (result.fsxOptimized && result.fsx) {
                expect(result.fsxOptimized.throughput).toBeLessThanOrEqual(result.fsx.throughput);
                expect(result.fsxOptimized.iops).toBeLessThanOrEqual(result.fsx.iops);
            }
        });

        it('should handle zero cloned copies and change rate', async () => {
            const sqlServerDeploymentType = SqlServerDeploymentModel.SQL_AOAG_SHORT;
            const instanceIds = ['i-1234567890abcdef0'];
            const region = 'ca-central-1';
            const clonedCopiesCount = 0;
            const monthlyChangeRatePercentage = 0;

            const result = await ebsAutomaticDemoModeCallingManualApi(
                sqlServerDeploymentType,
                instanceIds,
                region,
                clonedCopiesCount,
                monthlyChangeRatePercentage,
                ACCOUNT_ID
            );

            expect(result).toBeDefined();
            expect(result.ebs).toBeDefined();
            expect(result.fsx).toBeDefined();
            // Check if result has multi property (type guard)
            if ('multi' in result) {
                expect(result.multi).toBeDefined();
            }
        });
    });

    describe('Oracle deployment types', () => {
        describe('fsxwAutomaticDemoModeCallingManualApi', () => {
            it('should return multi key for Oracle Data Guard deployment', async () => {
                const result = await fsxwAutomaticDemoModeCallingManualApi(
                    'us-east-1',
                    1,
                    'DG',
                    30,
                    ACCOUNT_ID
                );

                expect(result).toBeDefined();
                expect(result.fsxw).toBeDefined();
                expect(result.fsx).toBeDefined();
                expect(result.multi).toBeDefined();
                expect('single' in result).toBe(false);
            });

            it('should return single key for Oracle Standalone deployment', async () => {
                const result = await fsxwAutomaticDemoModeCallingManualApi(
                    'us-east-1',
                    1,
                    'Standalone',
                    30,
                    ACCOUNT_ID
                );

                expect(result).toBeDefined();
                expect(result.fsxw).toBeDefined();
                expect(result.fsx).toBeDefined();
                expect(result.single).toBeDefined();
                expect('multi' in result).toBe(false);
            });
        });

        describe('ebsAutomaticDemoModeCallingManualApi', () => {
            it('should return multi key for Oracle Data Guard deployment', async () => {
                const result = await ebsAutomaticDemoModeCallingManualApi(
                    'DG',
                    ['i-1234567890abcdef0', 'i-0987654321fedcba0'],
                    'us-east-1',
                    1,
                    30,
                    ACCOUNT_ID
                );

                expect(result).toBeDefined();
                expect(result.ebs).toBeDefined();
                expect(result.fsx).toBeDefined();
                if ('multi' in result) {
                    expect(result.multi).toBeDefined();
                }
                expect('single' in result).toBe(false);
            });

            it('should return single key for Oracle Standalone deployment', async () => {
                const result = await ebsAutomaticDemoModeCallingManualApi(
                    'Standalone',
                    ['i-1234567890abcdef0'],
                    'us-east-1',
                    1,
                    30,
                    ACCOUNT_ID
                );

                expect(result).toBeDefined();
                expect(result.ebs).toBeDefined();
                expect(result.fsx).toBeDefined();
                if ('single' in result) {
                    expect(result.single).toBeDefined();
                }
                expect('multi' in result).toBe(false);
            });
        });
    });
});
