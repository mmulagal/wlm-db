import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/marketing-scope';
import '../../simulator/scopes/aws/ec2-scope';
import '../../simulator/scopes/aws/compute-optimizer-scope';
import '../../simulator/scopes/aws/ssm-scope';
import {
    formatEbsCalculationObject,
    formatFsxwCalculationObject
} from '../../../src/operations/cloud-manager/marketing/marketing-operations-utils';
import { SqlServerDeploymentModel } from '../../../src/utils/consts';
import { StorageSummary, EbsCostCalculation, FsxwCostCalculation } from '../../../src/utils/marketing-types';
import {
    getEbsMarketingApiManualModeRequestBody,
    getFsxwMarketingApiManualModeRequestBody
} from '../../../src/operations/cloud-manager/marketing/marketing-request-utils';

describe('Marketing Operations Utils', () => {
    describe('getEbsMarketingApiManualModeRequestBody', () => {
        it('should generate correct request body for single AZ deployment', () => {
            const region = 'us-east-1';
            const params = {
                snapshotFrequency: 'Daily' as const,
                sqlServerDeploymentType: SqlServerDeploymentModel.SQL_STANDALONE_SHORT,
                clonedCopiesCount: 2,
                monthlyChangeRatePercentage: 25,
                sqlServerEdition: 'Enterprise Edition' as const,
                ec2Instances: [
                    {
                        ec2InstanceDescription: 'Primary SQL Server',
                        ec2InstanceType: 'm5.xlarge',
                        isPrimary: true,
                        volumes: [
                            {
                                volumeType: 'gp3' as const,
                                volumeNumber: 2,
                                storageAmount: 1073741824000, // 1 TiB in bytes
                                volumeIops: 3000,
                                throughput: 125
                            }
                        ]
                    }
                ]
            };

            const result = getEbsMarketingApiManualModeRequestBody(region, params);

            expect(result).toBeDefined();
            expect(result.useCase).toBe('Low-latency');
            expect(result.region).toBe(region);
            expect(result.deploymentType).toBe('Single');
            expect(result.clones.changeRate).toBe(25);
            expect(result.clones.cloneEnvs).toBe(2);
            expect(result.volumes).toHaveLength(1);
            expect(result.volumes[0].volumeType).toBe('gp3');
            expect(result.volumes[0].volumeNumber).toBe(2);
        });

        it('should generate correct request body for multi AZ deployment', () => {
            const region = 'us-west-2';
            const params = {
                snapshotFrequency: 'Weekly' as const,
                sqlServerDeploymentType: SqlServerDeploymentModel.SQL_AOAG_SHORT,
                clonedCopiesCount: 1,
                monthlyChangeRatePercentage: 20,
                sqlServerEdition: 'Standard Edition' as const,
                ec2Instances: [
                    {
                        ec2InstanceDescription: 'Primary SQL Server',
                        ec2InstanceType: 'm5.large',
                        isPrimary: true,
                        volumes: [
                            {
                                volumeType: 'io2' as const,
                                volumeNumber: 1,
                                storageAmount: 536870912000, // 500 GiB in bytes
                                volumeIops: 4000,
                                throughput: 250
                            }
                        ]
                    }
                ]
            };

            const result = getEbsMarketingApiManualModeRequestBody(region, params);

            expect(result.deploymentType).toBe('Multi');
            expect(result.fsxSnapshotFreq).toBe('Weekly');
        });

        it('should throw error for duplicate volume types', () => {
            const region = 'us-east-1';
            const params = {
                snapshotFrequency: 'Daily' as const,
                sqlServerDeploymentType: SqlServerDeploymentModel.SQL_STANDALONE_SHORT,
                clonedCopiesCount: 1,
                monthlyChangeRatePercentage: 15,
                sqlServerEdition: 'Enterprise Edition' as const,
                ec2Instances: [
                    {
                        ec2InstanceDescription: 'SQL Server',
                        ec2InstanceType: 'm5.large',
                        isPrimary: true,
                        volumes: [
                            {
                                volumeType: 'gp3' as const,
                                volumeNumber: 1,
                                storageAmount: 536870912000,
                                volumeIops: 3000,
                                throughput: 125
                            },
                            {
                                volumeType: 'gp3' as const, // Duplicate!
                                volumeNumber: 1,
                                storageAmount: 536870912000,
                                volumeIops: 3000,
                                throughput: 125
                            }
                        ]
                    }
                ]
            };

            expect(() => {
                getEbsMarketingApiManualModeRequestBody(region, params);
            }).toThrow('Duplicate volume types are not allowed');
        });
    });

    describe('getFsxwMarketingApiManualModeRequestBody', () => {
        it('should generate correct request body for FSxW single AZ', () => {
            const region = 'us-east-1';
            const params = {
                snapshotFrequency: 'Daily' as const,
                sqlServerDeploymentType: SqlServerDeploymentModel.SQL_STANDALONE_SHORT,
                clonedCopiesCount: 1,
                monthlyChangeRatePercentage: 30,
                sqlServerEdition: 'Enterprise Edition' as const,
                ec2Instances: [
                    {
                        ec2InstanceDescription: 'Primary SQL Server',
                        ec2InstanceType: 'm5.xlarge',
                        isPrimary: true,
                        fsxw: {
                            storageAmount: 640000000000,
                            deploymentType: 'Single',
                            volumeIops: 600,
                            throughput: 32,
                            storageVolumeType: 'SSD'
                        }
                    }
                ]
            };

            const result = getFsxwMarketingApiManualModeRequestBody(region, params);

            expect(result).toBeDefined();
            expect(result.useCase).toBe('Low-latency');
            expect(result.region).toBe(region);
            expect(result.deploymentType).toBe('Single');
            expect(result.snapshotFreq).toBe('Daily');
            expect(result.cloneEnvs).toBe(1);
            expect(result.monthlyChangeRate).toBe(30);
            expect(result.storageVolumeType).toBe('SSD');
        });

        it('should generate correct request body for FSxW multi AZ', () => {
            const region = 'eu-west-2';
            const params = {
                snapshotFrequency: 'Weekly' as const,
                sqlServerDeploymentType: SqlServerDeploymentModel.SQL_AOAG_SHORT,
                clonedCopiesCount: 2,
                monthlyChangeRatePercentage: 25,
                sqlServerEdition: 'Standard Edition' as const,
                ec2Instances: [
                    {
                        ec2InstanceDescription: 'Primary SQL Server',
                        ec2InstanceType: 'm5.2xlarge',
                        isPrimary: true,
                        fsxw: {
                            storageAmount: 1280000000000,
                            deploymentType: 'Multi',
                            volumeIops: 1200,
                            throughput: 64,
                            storageVolumeType: 'HDD'
                        }
                    }
                ]
            };

            const result = getFsxwMarketingApiManualModeRequestBody(region, params);

            expect(result.deploymentType).toBe('Multi');
            expect(result.storageVolumeType).toBe('HDD');
            expect(result.cloneEnvs).toBe(2);
        });

        it('should not return fsxw object for instances without FSxW configuration', () => {
            const region = 'us-west-1';
            const params = {
                snapshotFrequency: 'Daily' as const,
                sqlServerDeploymentType: SqlServerDeploymentModel.SQL_STANDALONE_SHORT,
                clonedCopiesCount: 1,
                monthlyChangeRatePercentage: 20,
                sqlServerEdition: 'Enterprise Edition' as const,
                ec2Instances: [
                    {
                        ec2InstanceDescription: 'Primary SQL Server',
                        ec2InstanceType: 'm5.xlarge',
                        isPrimary: true,
                        volumes: [
                            {
                                volumeType: 'gp3' as const,
                                volumeNumber: 1,
                                storageAmount: 1073741824000,
                                volumeIops: 3000,
                                throughput: 125
                            }
                        ]
                    }
                ]
            };

            const result = getFsxwMarketingApiManualModeRequestBody(region, params);

            expect(result).toBeUndefined();
        });
    });

    describe('formatEbsCalculationObject', () => {
        it('should format EBS calculation object correctly', () => {
            const ebsSummary: StorageSummary = {
                capacity: 100,
                iops: 200,
                throughput: 50,
                total: 350,
                snapshots: 25,
                clones: 15
            };

            const ebsCostCalculation: Partial<EbsCostCalculation> = {
                instanceAvgDuration: 720,
                EBSCapacityPrice: { price: 0.1, unit: 'GB-Mo' },
                numberOfVolumes: 2,
                storageAmount: { size: 1024, unit: 'GiB' },
                totalInstanceHours: 1440,
                EBSInstanceMonth: 1,
                EBSStorageCost: 102.4,
                billableIops: 3000,
                totalBillableIops: 6000,
                EBSIopsCost: 195,
                billableMBps: 125,
                billableThroughputMBps: 250,
                billableThroughputGBps: 0.25,
                EBSThroughputCost: 11.25,
                totalSnapshot: 10,
                initialSnapshotCost: 5,
                monthlyCostPerSnapshot: 2,
                discountForPartialStorageMonth: 0.5,
                incrementalSnapshotCost: 15,
                totalSnapshotCost: 20,
                totalEBSSnapshotCost: 20,
                ebsSnapshotCost: 20,
                AWSEBSTotalCostMonthly: 328.65,
                ebsSnapshotPrice: { price: 0.05, unit: 'GB-Mo' },
                amountChangedPerSnapshot: { size: 51.2, unit: 'GiB' }
            };

            const result = formatEbsCalculationObject(ebsSummary, ebsCostCalculation as EbsCostCalculation, 2, 30);

            expect(result).toBeDefined();
            expect(result.ebsCostCalculation).toBeDefined();
            expect(result.ebsCloneCalculation).toBeDefined();
            expect(result.ebsSnapshotCalculation).toBeDefined();

            expect(result.ebsCostCalculation.numberOfVolumes).toBe(2);
            expect(result.ebsCloneCalculation.clonedCopiesCount).toBe(2);
            expect(result.ebsCloneCalculation.totalCloneMonthlyCost).toBe(700); // 2 * (100 + 200 + 50)
            expect(result.ebsSnapshotCalculation.monthlyChangeRatePercentage).toBe(30);
        });
    });

    describe('formatFsxwCalculationObject', () => {
        it('should format FSxW calculation object correctly', () => {
            const fsxwSummary: StorageSummary = {
                capacity: 200,
                iops: 400,
                throughput: 100,
                total: 700,
                snapshots: 50,
                clones: 30
            };

            const fsxwCostCalculation: Partial<FsxwCostCalculation> = {
                desiredStorageCapacityGb: { size: 1024, unit: 'GiB' },
                deduplicationSavings: 0.2,
                totalDefaultProvisionedIops: 3000,
                additionalUserProvisionedIops: 1000,
                totalMonthlyCostForFsxwProvisionedSsdIops: 65,
                fsxwIopsPrice: 0.065,
                billedIops: 4000,
                numberOfFileSystemsRequiredForStorageCapacity: 1,
                numberOfFileSystemsRequiredForThroughputCapacity: 1,
                monthlyCostForFsxwStorageCapacity: 300,
                fsxwMaxThroughput: 2048,
                requiredNumberOfFsxwFileSystemsFractional: 1.2,
                requiredNumberOfFsxwFileSystemsRoundUp: 2,
                minimumThroughputCapacityRequiredToProvisionFileSystems: 8,
                provisionedThroughputCapacity: 16,
                fsxwSsdPrice: { price: 0.13, unit: 'GB' },
                fsxwMaxCapacity: { size: 65536, unit: 'GiB' },
                totalMonthlyCostForFsxwThroughputCapacity: 7.2,
                totalStorageChargeMonthly: 372.2,
                throughput: 16,
                fsxwMinThroughput: 8,
                fsxwThroughputPrice: 0.45
            };

            const result = formatFsxwCalculationObject(fsxwSummary, fsxwCostCalculation as FsxwCostCalculation);

            expect(result).toBeDefined();
            expect(result.desiredStorageCapacity).toBeGreaterThan(0);
            expect(result.deduplicationSavings).toBe(0.2);
            expect(result.provisionedStorageCapacity).toBe(819.2); // 1024 - (1024 * 0.2)
            expect(result.totalMonthlyCost).toBe(372.2);
            expect(result.requiredFileSystems).toBe(2);
        });
    });
});
