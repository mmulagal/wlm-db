import {
    formatEbsCalculationObject,
    formatFsxwCalculationObject,
    getMarketingApiRequestBody
} from '../../../src/operations/cloud-manager/marketing/marketing-operations-utils';
import type { AutomaticModeStorageSavingsMarketingParams } from '../../../src/routes/types/storage-savings.types';
import {
    ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG,
    ORACLE_AUTOMATIC_TCO_DEPLOYMENT_STANDALONE,
    SqlServerDeploymentModel
} from '../../../src/utils/consts';
import { StorageSummary, EbsCostCalculation, FsxwCostCalculation } from '../../../src/utils/marketing-types';
import {
    getEbsMarketingApiManualModeRequestBody,
    getFsxwMarketingApiManualModeRequestBody
} from '../../../src/operations/cloud-manager/marketing/marketing-request-utils';

describe('Marketing Operations Utils', () => {
    describe('getMarketingApiRequestBody', () => {
        const automaticParams: AutomaticModeStorageSavingsMarketingParams = {
            snapshotFrequency: 'Daily',
            cloneRefreshFrequency: 'daily',
            clonedCopiesCount: 1,
            monthlyChangeRatePercentage: 30
        };

        it('should use Multi deployment for SQL AOAG and Oracle DG automatic TCO, Single for Oracle Standalone', () => {
            const volumeIds = ['vol-11111111111111111'];
            const multiBody = getMarketingApiRequestBody(
                volumeIds,
                automaticParams,
                SqlServerDeploymentModel.SQL_AOAG_SHORT
            ) as { deploymentType: string };
            expect(multiBody.deploymentType).toBe('Multi');

            const oracleDgBody = getMarketingApiRequestBody(
                volumeIds,
                automaticParams,
                ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG
            ) as { deploymentType: string };
            expect(oracleDgBody.deploymentType).toBe('Multi');

            const oracleSaBody = getMarketingApiRequestBody(
                volumeIds,
                automaticParams,
                ORACLE_AUTOMATIC_TCO_DEPLOYMENT_STANDALONE
            ) as { deploymentType: string };
            expect(oracleSaBody.deploymentType).toBe('Single');
        });
    });

    describe('getEbsMarketingApiManualModeRequestBody', () => {
        it('should pass through per-volume values for single AZ deployment', () => {
            // Callers (UI manual mode, on-prem TCO helpers, demo flow) all supply storageAmount,
            // volumeIops, and throughput as per-single-volume values; the mapper passes them
            // through to the marketing API unchanged, with `volumeNumber` carrying the count.
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
                                storageAmount: 1073741824000, // ~1000 GiB per volume
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

            const [primaryVolume] = result.volumes;
            expect(primaryVolume.volumeType).toBe('gp3');
            expect(primaryVolume.volumeNumber).toBe(2);
            const expectedGib = 1073741824000 / 1024 / 1024 / 1024;
            expect(primaryVolume.storageAmount.size).toBeCloseTo(expectedGib, 6);
            expect(primaryVolume.storageAmount.unit).toBe('GiB');
            expect(primaryVolume.volumeIops).toBe(3000);
            expect(primaryVolume.throughput).toBe(125);
            expect(primaryVolume.snapshotAmountChange.size).toBeCloseTo((25 / 100) * expectedGib, 6);
            expect(primaryVolume.snapshotFreq).toBe('Daily');
        });

        it('should pass through per-volume values for multi AZ deployment', () => {
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
                                storageAmount: 536870912000, // 500 GiB per volume
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
            const [primaryVolume] = result.volumes;
            expect(primaryVolume.volumeIops).toBe(4000);
            expect(primaryVolume.throughput).toBe(250);
            const expectedGib = 536870912000 / 1024 / 1024 / 1024;
            expect(primaryVolume.storageAmount.size).toBeCloseTo(expectedGib, 6);
            expect(primaryVolume.snapshotAmountChange.size).toBeCloseTo((20 / 100) * expectedGib, 6);
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
        const GIB_IN_BYTE = 1024 ** 3;

        it('should format EBS calculation object correctly', () => {
            const ebsSummary: StorageSummary = {
                capacity: 100,
                iops: 200,
                throughput: 50,
                total: 350,
                snapshots: 25,
                clones: 15
            };

            const numberOfVolumes = 2;
            const ebsSnapshotPrice = 0.05;
            const totalSnapshots = 10;
            const ebsInstanceMonth = 1;
            const amountChangedPerSnapshotPerVolGib = 51.2;
            // Make incrementalSnapshotCost consistent with derivation from amountChangedPerSnapshot
            // so the new across-all-volumes rollup matches: per-vol = amount × price × 0.5 × N_snap
            const incrementalSnapshotCostPerVol =
                amountChangedPerSnapshotPerVolGib * ebsSnapshotPrice * 0.5 * totalSnapshots;

            const ebsCostCalculation: Partial<EbsCostCalculation> = {
                instanceAvgDuration: 720,
                EBSCapacityPrice: { price: 0.1, unit: 'GB-Mo' },
                numberOfVolumes,
                storageAmount: { size: 1024, unit: 'GiB' },
                totalInstanceHours: 1440,
                EBSInstanceMonth: ebsInstanceMonth,
                EBSStorageCost: 102.4,
                billableIops: 3000,
                totalBillableIops: 6000,
                EBSIopsCost: 195,
                billableMBps: 125,
                billableThroughputMBps: 250,
                billableThroughputGBps: 0.25,
                EBSThroughputCost: 11.25,
                totalSnapshot: totalSnapshots,
                initialSnapshotCost: 5,
                monthlyCostPerSnapshot: amountChangedPerSnapshotPerVolGib * ebsSnapshotPrice,
                discountForPartialStorageMonth: amountChangedPerSnapshotPerVolGib * ebsSnapshotPrice * 0.5,
                incrementalSnapshotCost: incrementalSnapshotCostPerVol,
                totalSnapshotCost: 20,
                totalEBSSnapshotCost: 20,
                ebsSnapshotCost: 20,
                AWSEBSTotalCostMonthly: 328.65,
                ebsSnapshotPrice: { price: ebsSnapshotPrice, unit: 'GB-Mo' },
                amountChangedPerSnapshot: { size: amountChangedPerSnapshotPerVolGib, unit: 'GiB' }
            };

            const result = formatEbsCalculationObject(ebsSummary, ebsCostCalculation as EbsCostCalculation, 2, 30);

            expect(result).toBeDefined();
            expect(result.ebsCostCalculation).toBeDefined();
            expect(result.ebsCloneCalculation).toBeDefined();
            expect(result.ebsSnapshotCalculation).toBeDefined();

            expect(result.ebsCostCalculation.numberOfVolumes).toBe(numberOfVolumes);
            expect(result.ebsCloneCalculation.clonedCopiesCount).toBe(2);
            expect(result.ebsCloneCalculation.totalCloneMonthlyCost).toBe(700); // 2 * (100 + 200 + 50)
            expect(result.ebsSnapshotCalculation.monthlyChangeRatePercentage).toBe(30);

            // GH-9225 follow-up: per-snapshot chain is rolled up to across-all-volumes.
            const amountChangedAllVolBytes = amountChangedPerSnapshotPerVolGib * numberOfVolumes * GIB_IN_BYTE;
            const monthlyCostPerSnapshotAllVol = amountChangedPerSnapshotPerVolGib * numberOfVolumes * ebsSnapshotPrice;
            expect(result.ebsSnapshotCalculation.amountChangedPerSnapshot).toBeCloseTo(amountChangedAllVolBytes, 0);
            expect(result.ebsSnapshotCalculation.monthlyCostPerSnapshot).toBeCloseTo(monthlyCostPerSnapshotAllVol, 6);
            expect(result.ebsSnapshotCalculation.discountForPartialStorageMonth).toBeCloseTo(
                monthlyCostPerSnapshotAllVol * 0.5,
                6
            );
            // `incrementalSnapshotCost` is period-scaled by `instanceMonthsPerVolume` so that
            // `totalSnapshotCost === initialSnapshotCost + incrementalSnapshotCost` (UI tooltip identity).
            const instanceMonthsPerVolume = ebsInstanceMonth / numberOfVolumes;
            expect(result.ebsSnapshotCalculation.incrementalSnapshotCost).toBeCloseTo(
                monthlyCostPerSnapshotAllVol * 0.5 * totalSnapshots * instanceMonthsPerVolume,
                6
            );
            expect(result.ebsSnapshotCalculation.monthlyCostOfSnapshots).toBeCloseTo(monthlyCostPerSnapshotAllVol, 6);
        });

        it('should recompute snapshot totals from all-volumes initial cost and per-volume incremental cost scaled by ebsInstanceMonth (multi-volume)', () => {
            const ebsSummary: StorageSummary = {
                capacity: 10,
                iops: 0,
                throughput: 0,
                total: 10,
                snapshots: 1,
                clones: 0
            };

            const ebsSnapshotPrice = 0.05;
            const storageGiBTotal = 2048;
            const numberOfVolumes = 2;
            const ebsInstanceMonth = 2;
            const totalSnapshots = 5;
            // Per-volume `amountChangedPerSnapshot` derived from `incrementalSnapshotCost = 10.24` so
            // the new across-all-volumes rollup preserves the historical totals:
            //   incrementalPerVol = amount × price × 0.5 × totalSnapshots → 10.24 / (0.05 × 0.5 × 5) = 81.92 GiB.
            const incrementalSnapshotCost = 10.24;
            const amountChangedPerSnapshotPerVolGib = 81.92;

            const ebsCostCalculation: Partial<EbsCostCalculation> = {
                instanceAvgDuration: 720,
                EBSCapacityPrice: { price: 0.1, unit: 'GB-Mo' },
                numberOfVolumes,
                storageAmount: { size: storageGiBTotal, unit: 'GiB' },
                totalInstanceHours: 1440,
                EBSInstanceMonth: ebsInstanceMonth,
                EBSStorageCost: 0,
                billableIops: 0,
                totalBillableIops: 0,
                EBSIopsCost: 0,
                billableMBps: 0,
                billableThroughputMBps: 0,
                billableThroughputGBps: 0,
                EBSThroughputCost: 0,
                totalSnapshot: totalSnapshots,
                initialSnapshotCost: 102.4,
                monthlyCostPerSnapshot: amountChangedPerSnapshotPerVolGib * ebsSnapshotPrice,
                discountForPartialStorageMonth: amountChangedPerSnapshotPerVolGib * ebsSnapshotPrice * 0.5,
                incrementalSnapshotCost,
                totalSnapshotCost: 50,
                totalEBSSnapshotCost: 999,
                ebsSnapshotCost: 888,
                AWSEBSTotalCostMonthly: 0,
                ebsSnapshotPrice: { price: ebsSnapshotPrice, unit: 'GB-Mo' },
                amountChangedPerSnapshot: { size: amountChangedPerSnapshotPerVolGib, unit: 'GiB' }
            };

            const result = formatEbsCalculationObject(ebsSummary, ebsCostCalculation as EbsCostCalculation, 0, 10);

            const initialSnapshotCostForAllVolumes = storageGiBTotal * ebsSnapshotPrice; // 2048 × 0.05 = 102.4
            const incrementalSnapshotCostForAllVolumes = incrementalSnapshotCost * ebsInstanceMonth; // 10.24 × 2 = 20.48
            const totalSnapshotCostForAllVolumes =
                initialSnapshotCostForAllVolumes + incrementalSnapshotCostForAllVolumes; // 122.88

            expect(result.ebsSnapshotCalculation.initialSnapshotCost).toBeCloseTo(initialSnapshotCostForAllVolumes, 6);
            expect(result.ebsSnapshotCalculation.totalSnapshotCost).toBeCloseTo(totalSnapshotCostForAllVolumes, 6);
            // GH-9225 follow-up: totalEbsSnapshotCost and ebsSnapshotCost must NOT be re-multiplied by
            // ebsInstanceMonth (the previous fix did, double-counting the initial cost).
            expect(result.ebsSnapshotCalculation.totalEbsSnapshotCost).toBeCloseTo(totalSnapshotCostForAllVolumes, 6);
            expect(result.ebsSnapshotCalculation.ebsSnapshotCost).toBeCloseTo(totalSnapshotCostForAllVolumes, 6);

            // GH-9225 follow-up: per-snapshot chain is rolled up to across-all-volumes-in-class.
            const amountChangedAllVolBytes = amountChangedPerSnapshotPerVolGib * numberOfVolumes * GIB_IN_BYTE;
            const monthlyCostPerSnapshotAllVol = amountChangedPerSnapshotPerVolGib * numberOfVolumes * ebsSnapshotPrice;
            expect(result.ebsSnapshotCalculation.amountChangedPerSnapshot).toBeCloseTo(amountChangedAllVolBytes, 0);
            expect(result.ebsSnapshotCalculation.monthlyCostPerSnapshot).toBeCloseTo(monthlyCostPerSnapshotAllVol, 6);
            expect(result.ebsSnapshotCalculation.discountForPartialStorageMonth).toBeCloseTo(
                monthlyCostPerSnapshotAllVol * 0.5,
                6
            );
            expect(result.ebsSnapshotCalculation.incrementalSnapshotCost).toBeCloseTo(
                monthlyCostPerSnapshotAllVol * 0.5 * totalSnapshots,
                6
            );
            expect(result.ebsSnapshotCalculation.monthlyCostOfSnapshots).toBeCloseTo(monthlyCostPerSnapshotAllVol, 6);
        });

        it.each([
            {
                label: '2 io2 volumes (rolled-up io2 class)',
                numberOfVolumes: 2,
                totalStorageGiB: 1024,
                ebsSnapshotPrice: 0.08,
                incrementalSnapshotCost: 12,
                ebsInstanceMonth: 1.5,
                totalSnapshots: 4,
                // amount_perVol = incrementalPerVol / (price × 0.5 × N_snap) = 12 / (0.08×0.5×4) = 75 GiB
                amountChangedPerSnapshotPerVolGib: 75
            },
            {
                label: '3 gp3 volumes (rolled-up gp3 class)',
                numberOfVolumes: 3,
                totalStorageGiB: 600,
                ebsSnapshotPrice: 0.05,
                incrementalSnapshotCost: 7.5,
                ebsInstanceMonth: 2,
                totalSnapshots: 4,
                // amount_perVol = 7.5 / (0.05×0.5×4) = 75 GiB
                amountChangedPerSnapshotPerVolGib: 75
            }
        ])(
            'recomputes snapshot totals per volume class — $label (GH-9225)',
            ({
                numberOfVolumes,
                totalStorageGiB,
                ebsSnapshotPrice,
                incrementalSnapshotCost,
                ebsInstanceMonth,
                totalSnapshots,
                amountChangedPerSnapshotPerVolGib
            }) => {
                const ebsSummary: StorageSummary = {
                    capacity: 1,
                    iops: 0,
                    throughput: 0,
                    total: 1,
                    snapshots: 1,
                    clones: 0
                };

                const ebsCostCalculation: Partial<EbsCostCalculation> = {
                    instanceAvgDuration: 720,
                    EBSCapacityPrice: { price: 0.1, unit: 'GB-Mo' },
                    numberOfVolumes,
                    storageAmount: { size: totalStorageGiB, unit: 'GiB' },
                    totalInstanceHours: 1440,
                    EBSInstanceMonth: ebsInstanceMonth,
                    EBSStorageCost: 0,
                    billableIops: 0,
                    totalBillableIops: 0,
                    EBSIopsCost: 0,
                    billableMBps: 0,
                    billableThroughputMBps: 0,
                    billableThroughputGBps: 0,
                    EBSThroughputCost: 0,
                    totalSnapshot: totalSnapshots,
                    initialSnapshotCost: 0,
                    monthlyCostPerSnapshot: amountChangedPerSnapshotPerVolGib * ebsSnapshotPrice,
                    discountForPartialStorageMonth: amountChangedPerSnapshotPerVolGib * ebsSnapshotPrice * 0.5,
                    incrementalSnapshotCost,
                    totalSnapshotCost: 0,
                    totalEBSSnapshotCost: 0,
                    ebsSnapshotCost: 0,
                    AWSEBSTotalCostMonthly: 0,
                    ebsSnapshotPrice: { price: ebsSnapshotPrice, unit: 'GB-Mo' },
                    amountChangedPerSnapshot: { size: amountChangedPerSnapshotPerVolGib, unit: 'GiB' }
                };

                const result = formatEbsCalculationObject(ebsSummary, ebsCostCalculation as EbsCostCalculation, 0, 10);

                const initialSnapshotCostForAllVolumes = totalStorageGiB * ebsSnapshotPrice;
                const totalSnapshotCostForAllVolumes =
                    initialSnapshotCostForAllVolumes + incrementalSnapshotCost * ebsInstanceMonth;

                expect(result.ebsSnapshotCalculation.numberOfVolumes).toBe(numberOfVolumes);
                expect(result.ebsSnapshotCalculation.initialSnapshotCost).toBeCloseTo(
                    initialSnapshotCostForAllVolumes,
                    6
                );
                expect(result.ebsSnapshotCalculation.totalSnapshotCost).toBeCloseTo(totalSnapshotCostForAllVolumes, 6);
                expect(result.ebsSnapshotCalculation.totalEbsSnapshotCost).toBeCloseTo(
                    totalSnapshotCostForAllVolumes,
                    6
                );
                expect(result.ebsSnapshotCalculation.ebsSnapshotCost).toBeCloseTo(totalSnapshotCostForAllVolumes, 6);

                // GH-9225 follow-up: per-snapshot chain rolls up to across-all-volumes.
                const amountChangedAllVolBytes = amountChangedPerSnapshotPerVolGib * numberOfVolumes * GIB_IN_BYTE;
                const monthlyCostPerSnapshotAllVol =
                    amountChangedPerSnapshotPerVolGib * numberOfVolumes * ebsSnapshotPrice;
                expect(result.ebsSnapshotCalculation.amountChangedPerSnapshot).toBeCloseTo(amountChangedAllVolBytes, 0);
                expect(result.ebsSnapshotCalculation.monthlyCostPerSnapshot).toBeCloseTo(
                    monthlyCostPerSnapshotAllVol,
                    6
                );
                expect(result.ebsSnapshotCalculation.discountForPartialStorageMonth).toBeCloseTo(
                    monthlyCostPerSnapshotAllVol * 0.5,
                    6
                );
                // `incrementalSnapshotCost` is period-scaled by `instanceMonthsPerVolume` so that
                // `totalSnapshotCost === initialSnapshotCost + incrementalSnapshotCost` (UI tooltip identity).
                const instanceMonthsPerVolume = ebsInstanceMonth / numberOfVolumes;
                expect(result.ebsSnapshotCalculation.incrementalSnapshotCost).toBeCloseTo(
                    monthlyCostPerSnapshotAllVol * 0.5 * totalSnapshots * instanceMonthsPerVolume,
                    6
                );
                expect(result.ebsSnapshotCalculation.monthlyCostOfSnapshots).toBeCloseTo(
                    monthlyCostPerSnapshotAllVol,
                    6
                );

                // UI tooltip identity: displayed total must equal displayed initial + displayed incremental.
                expect(result.ebsSnapshotCalculation.totalSnapshotCost).toBeCloseTo(
                    result.ebsSnapshotCalculation.initialSnapshotCost +
                        result.ebsSnapshotCalculation.incrementalSnapshotCost,
                    6
                );
            }
        );

        it('should scale per-volume initial by ebsInstanceMonth when storage comes from storageAmountPerVol (auto mode)', () => {
            // Simulator auto response: 4 × gp2 @ 1600 GiB/vol, ebsInstanceMonth = 4.
            // After GH-9225 follow-up: `storageAmount` displayed in `ebsSnapshotCalculation` is rolled
            // up to across-all-volumes (1600 × 4 = 6400 GiB), and `initial = storageAcrossAll × price ×
            // instanceMonthsPerVolume`, which is numerically identical to the prior
            // `perVol × price × ebsInstanceMonth` for homogeneous volumes (= 320).
            const ebsSummary: StorageSummary = {
                capacity: 182.4,
                iops: 0,
                throughput: 0,
                total: 448,
                snapshots: 83.2,
                clones: 182.4
            };

            const ebsSnapshotPrice = 0.05;
            const storageGiBPerVol = 1600;
            const numberOfVolumes = 4;
            const ebsInstanceMonth = 4;
            const totalSnapshots = 120;
            const amountChangedPerSnapshotPerVolGib = 4.2666666666666675;
            // Make incrementalSnapshotCost consistent with derivation from amountChangedPerSnapshot
            // (per-vol = amount × price × 0.5 × N_snap) so the new across-all-volumes derivation
            // preserves the historical total snapshot cost.
            const incrementalSnapshotCost = amountChangedPerSnapshotPerVolGib * ebsSnapshotPrice * 0.5 * totalSnapshots;

            const ebsCostCalculation: Partial<EbsCostCalculation> = {
                instanceAvgDuration: 2920,
                EBSCapacityPrice: { price: 0.114, unit: 'UsdPerGiB' },
                numberOfVolumes,
                storageAmountPerVol: { size: storageGiBPerVol, unit: 'GiB' },
                totalInstanceHours: 2920,
                EBSInstanceMonth: ebsInstanceMonth,
                EBSStorageCost: 182.4,
                billableIops: 0,
                totalBillableIops: 0,
                EBSIopsCost: 0,
                billableMBps: 0,
                billableThroughputMBps: 0,
                billableThroughputGBps: 0,
                EBSThroughputCost: 0,
                totalSnapshot: totalSnapshots,
                initialSnapshotCost: 80,
                monthlyCostPerSnapshot: amountChangedPerSnapshotPerVolGib * ebsSnapshotPrice,
                discountForPartialStorageMonth: amountChangedPerSnapshotPerVolGib * ebsSnapshotPrice * 0.5,
                incrementalSnapshotCost,
                totalSnapshotCost: 83.2,
                totalEBSSnapshotCost: 83.2,
                ebsSnapshotCost: 83.2,
                AWSEBSTotalCostMonthly: 265.6,
                ebsSnapshotPrice: { price: ebsSnapshotPrice, unit: 'UsdPerGiB' },
                amountChangedPerSnapshot: { size: amountChangedPerSnapshotPerVolGib, unit: 'GiB' }
            };

            const result = formatEbsCalculationObject(ebsSummary, ebsCostCalculation as EbsCostCalculation, 0, 10);

            const initialSnapshotCostForAllVolumes = storageGiBPerVol * ebsSnapshotPrice * ebsInstanceMonth; // 320
            const incrementalSnapshotCostForAllVolumes = incrementalSnapshotCost * ebsInstanceMonth; // 51.2
            const totalSnapshotCostForAllVolumes =
                initialSnapshotCostForAllVolumes + incrementalSnapshotCostForAllVolumes; // 371.2

            expect(result.ebsSnapshotCalculation.initialSnapshotCost).toBeCloseTo(initialSnapshotCostForAllVolumes, 6);
            expect(result.ebsSnapshotCalculation.totalSnapshotCost).toBeCloseTo(totalSnapshotCostForAllVolumes, 6);
            expect(result.ebsSnapshotCalculation.totalEbsSnapshotCost).toBeCloseTo(totalSnapshotCostForAllVolumes, 6);
            expect(result.ebsSnapshotCalculation.ebsSnapshotCost).toBeCloseTo(totalSnapshotCostForAllVolumes, 6);

            // GH-9225 follow-up: in auto mode, the displayed `storageAmount` rolls up the per-vol
            // value by `numberOfVolumes` so the tooltip math
            // `(monthlyChangeRate / totalSnapshots) × storageAmount = amountChangedPerSnapshot` holds.
            expect(result.ebsSnapshotCalculation.storageAmount).toBeCloseTo(
                storageGiBPerVol * numberOfVolumes * GIB_IN_BYTE,
                0
            );
            const amountChangedAllVolBytes = amountChangedPerSnapshotPerVolGib * numberOfVolumes * GIB_IN_BYTE;
            const monthlyCostPerSnapshotAllVol = amountChangedPerSnapshotPerVolGib * numberOfVolumes * ebsSnapshotPrice;
            expect(result.ebsSnapshotCalculation.amountChangedPerSnapshot).toBeCloseTo(amountChangedAllVolBytes, 0);
            expect(result.ebsSnapshotCalculation.monthlyCostPerSnapshot).toBeCloseTo(monthlyCostPerSnapshotAllVol, 6);
            expect(result.ebsSnapshotCalculation.discountForPartialStorageMonth).toBeCloseTo(
                monthlyCostPerSnapshotAllVol * 0.5,
                6
            );
            expect(result.ebsSnapshotCalculation.incrementalSnapshotCost).toBeCloseTo(
                monthlyCostPerSnapshotAllVol * 0.5 * totalSnapshots,
                6
            );
            expect(result.ebsSnapshotCalculation.monthlyCostOfSnapshots).toBeCloseTo(monthlyCostPerSnapshotAllVol, 6);
        });

        it('should match AWS Pricing Calculator for the GH-9225 follow-up rollup (3 gp3 volumes summing to 1250 GiB)', () => {
            // Real-world regression case reported on GH-9225 (after PR #9332):
            // 3 gp3 volumes (700 + 200 + 350 GiB), Daily snapshots, 10% monthly change rate.
            // AWS Pricing Calculator (sum of per-volume entries): 38.13 + 13.13 + 20.63 = $71.88.
            // Pre-fix API was returning $196.875 because (initial + incremental) was multiplied by
            // ebsInstanceMonth = 3, double-counting the initial snapshot cost.
            const ebsSummary: StorageSummary = {
                capacity: 1,
                iops: 0,
                throughput: 0,
                total: 1,
                snapshots: 1,
                clones: 0
            };

            const ebsSnapshotPrice = 0.05;
            const totalStorageGiB = 1250; // 700 + 200 + 350
            const incrementalSnapshotCost = 3.12525; // per-volume monthly incremental from marketing API
            const ebsInstanceMonth = 3; // 3 volumes × 1 instance month each

            const ebsCostCalculation: Partial<EbsCostCalculation> = {
                instanceAvgDuration: 730,
                EBSCapacityPrice: { price: 0.0912, unit: 'GB-Mo' },
                numberOfVolumes: 3,
                storageAmount: { size: totalStorageGiB, unit: 'GiB' },
                totalInstanceHours: 2190,
                EBSInstanceMonth: ebsInstanceMonth,
                EBSStorageCost: 114,
                billableIops: 0,
                totalBillableIops: 0,
                EBSIopsCost: 0,
                billableMBps: 0,
                billableThroughputMBps: 0,
                billableThroughputGBps: 0,
                EBSThroughputCost: 0,
                totalSnapshot: 30,
                initialSnapshotCost: 17.5,
                monthlyCostPerSnapshot: 0.20835,
                discountForPartialStorageMonth: 0.104175,
                incrementalSnapshotCost,
                totalSnapshotCost: 65.625,
                totalEBSSnapshotCost: 196.875,
                ebsSnapshotCost: 196.875,
                AWSEBSTotalCostMonthly: 0,
                ebsSnapshotPrice: { price: ebsSnapshotPrice, unit: 'GB-Mo' },
                amountChangedPerSnapshot: { size: 4.167, unit: 'GiB' }
            };

            const result = formatEbsCalculationObject(ebsSummary, ebsCostCalculation as EbsCostCalculation, 0, 10);

            // initial = 1250 × 0.05 = 62.5 ; incremental rolled up = 3.12525 × 3 = 9.37575 ; total = 71.87575
            expect(result.ebsSnapshotCalculation.initialSnapshotCost).toBeCloseTo(62.5, 5);
            expect(result.ebsSnapshotCalculation.totalSnapshotCost).toBeCloseTo(71.87575, 5);
            expect(result.ebsSnapshotCalculation.totalEbsSnapshotCost).toBeCloseTo(71.87575, 5);
            expect(result.ebsSnapshotCalculation.ebsSnapshotCost).toBeCloseTo(71.87575, 5);

            // GH-9225 follow-up: per-snapshot chain rolls up to across-all-volumes-in-class
            // (3 gp3 volumes summing to 1250 GiB → amountChangedPerSnapshot ≈ 4.167 × 3 = 12.501 GiB).
            const amountChangedPerSnapshotPerVolGib = 4.167;
            const amountChangedAllVolBytes = amountChangedPerSnapshotPerVolGib * 3 * GIB_IN_BYTE;
            const monthlyCostPerSnapshotAllVol = amountChangedPerSnapshotPerVolGib * 3 * ebsSnapshotPrice;
            expect(result.ebsSnapshotCalculation.amountChangedPerSnapshot).toBeCloseTo(amountChangedAllVolBytes, 0);
            expect(result.ebsSnapshotCalculation.monthlyCostPerSnapshot).toBeCloseTo(monthlyCostPerSnapshotAllVol, 5);
            expect(result.ebsSnapshotCalculation.discountForPartialStorageMonth).toBeCloseTo(
                monthlyCostPerSnapshotAllVol * 0.5,
                5
            );
            expect(result.ebsSnapshotCalculation.incrementalSnapshotCost).toBeCloseTo(
                monthlyCostPerSnapshotAllVol * 0.5 * 30,
                5
            );
            expect(result.ebsSnapshotCalculation.monthlyCostOfSnapshots).toBeCloseTo(monthlyCostPerSnapshotAllVol, 5);
        });

        it('should return 0 (not NaN/Infinity) for per-volume derived fields when numberOfVolumes is 0', () => {
            // Regression: mock/view-calculation fixtures may set numberOfVolumes: 0.
            // Unguarded divisions by ebsNumberOfVolumes propagated NaN/Infinity to the UI.
            const ebsSummary: StorageSummary = {
                capacity: 0,
                iops: 0,
                throughput: 0,
                total: 0,
                snapshots: 0,
                clones: 0
            };

            const ebsCostCalculation: Partial<EbsCostCalculation> = {
                instanceAvgDuration: 720,
                EBSCapacityPrice: { price: 0.1, unit: 'GB-Mo' },
                numberOfVolumes: 0,
                storageAmount: { size: 0, unit: 'GiB' },
                totalInstanceHours: 0,
                EBSInstanceMonth: 0,
                EBSStorageCost: 0,
                billableIops: 0,
                totalBillableIops: 0,
                EBSIopsCost: 0,
                billableMBps: 0,
                billableThroughputMBps: 0,
                billableThroughputGBps: 0,
                EBSThroughputCost: 0,
                totalSnapshot: 0,
                initialSnapshotCost: 0,
                monthlyCostPerSnapshot: 0,
                discountForPartialStorageMonth: 0,
                incrementalSnapshotCost: 0,
                totalSnapshotCost: 0,
                totalEBSSnapshotCost: 0,
                ebsSnapshotCost: 0,
                AWSEBSTotalCostMonthly: 0,
                ebsSnapshotPrice: { price: 0.05, unit: 'GB-Mo' },
                amountChangedPerSnapshot: { size: 0, unit: 'GiB' }
            };

            const result = formatEbsCalculationObject(ebsSummary, ebsCostCalculation as EbsCostCalculation, 0, 0);

            expect(result.ebsCostCalculation.instanceAvgDuration).toBe(0);
            expect(Number.isFinite(result.ebsCostCalculation.instanceAvgDuration)).toBe(true);
            expect(Number.isFinite(result.ebsSnapshotCalculation.totalSnapshotCost)).toBe(true);
            expect(Number.isFinite(result.ebsSnapshotCalculation.incrementalSnapshotCost)).toBe(true);
            expect(Number.isFinite(result.ebsSnapshotCalculation.initialSnapshotCost)).toBe(true);
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
