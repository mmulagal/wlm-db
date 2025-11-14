import {
    handleMarketingApiFsxCalculationObject,
    formatManualStorageSavingsCalculationMetrics
} from '../../../src/operations/cloud-manager/marketing/marketing-operations';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';
import { SqlServerDeploymentModel } from '../../../src/utils/consts';
import { getEbsMarketingApiManualModeRequestBody } from '../../../src/operations/cloud-manager/marketing/marketing-request-utils';
import { invokeMarketingApi } from '../../../src/operations/cloud-manager/marketing/marketing-operations-utils';

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

    it('should format manual storage savings metrics correctly', async () => {
        // Exercise
        const result = await formatManualStorageSavingsCalculationMetrics(ACCOUNT_ID, DEFAULT_AWS_REGION, {
            sqlServerDeploymentType: 'FCI',
            sqlServerEdition: 'Enterprise Edition',
            monthlyChangeRatePercentage: 30,
            snapshotFrequency: 'Daily',
            clonedCopiesCount: 2,
            monthlySqlByolCost: 500,
            ec2Instances: [
                {
                    ec2InstanceDescription: 'Primary SQL Server',
                    ec2InstanceType: 'm5.xlarge',
                    isPrimary: true,
                    volumes: [
                        {
                            volumeType: 'gp3',
                            volumeNumber: 2,
                            storageAmount: 1073741824000, // 1 TiB in bytes
                            volumeIops: 3000,
                            throughput: 125
                        }
                    ]
                },
                {
                    ec2InstanceDescription: 'Primary SQL Server',
                    ec2InstanceType: 'm5.xlarge',
                    isPrimary: false,
                    volumes: [
                        {
                            volumeType: 'gp3',
                            volumeNumber: 2,
                            storageAmount: 1073741824000, // 1 TiB in bytes
                            volumeIops: 3000,
                            throughput: 125
                        }
                    ]
                }
            ]
        });

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

    it('should generate correct manual mode request body for EBS', () => {
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
    });

    it('should handle non-primary instances with NoSnapshotStorage', () => {
        const region = 'us-west-2';
        const params = {
            snapshotFrequency: 'Daily' as const,
            sqlServerDeploymentType: SqlServerDeploymentModel.SQL_AOAG_SHORT,
            clonedCopiesCount: 1,
            monthlyChangeRatePercentage: 20,
            sqlServerEdition: 'Standard Edition' as const,
            ec2Instances: [
                {
                    ec2InstanceDescription: 'Secondary SQL Server',
                    ec2InstanceType: 'm5.large',
                    isPrimary: false,
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

    it('should process FSx calculation object correctly', () => {
        const fsxCalculationData = {
            total_storage_capacity: { size: 1000, unit: 'GiB' },
            effective_capacity: { size: 800, unit: 'GiB' },
            ssd_tier_req_capacity: { size: 200, unit: 'GiB' },
            capacity_pool_tier: { size: 600, unit: 'GiB' },
            monthly_snapshot_capacity: { size: 100, unit: 'GiB' },
            percentage_ssd: 20,
            savings: 65
        };

        const fsxCalculationDataNoSnapshot = {
            desiredStorageCapacityGB: { size: 1000, unit: 'GiB' },
            EBSCapacity: { size: 1200, unit: 'GiB' }
        };

        const result = handleMarketingApiFsxCalculationObject(
            fsxCalculationData as any,
            fsxCalculationDataNoSnapshot as any
        );

        expect(result).toBeDefined();
        expect(result.totalStorageCapacity).toBeDefined();
        expect(result.effectiveCapacity).toBeDefined();
        expect(result.ssdTierReqCapacity).toBeDefined();
        expect(result.capacityPoolTier).toBeDefined();
        expect(result.monthlySnapshotCapacity).toBeDefined();
        expect(result.desiredStorageCapacity).toBeDefined();
        expect(result.ebsCapacity).toBeDefined();
    });
});
