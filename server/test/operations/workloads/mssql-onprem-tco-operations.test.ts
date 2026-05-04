import * as fs from 'fs';
import * as path from 'path';
import { DATABASE_DEPLOYMENT_TYPE, DATABASE_TYPE } from '@prisma/client';
import { GetInstanceTypesFromInstanceRequirementsCommandInput } from '@aws-sdk/client-ec2';
import { cloneDeep } from 'lodash-es';
import { vi } from 'vitest';

import { removeOnPremTcoReportData } from '../../../src/lib/database/onprem-tco';
import {
    uploadOnpremTcoData,
    getIndividualOnPremDatabaseResource,
    getOnPremDatabaseResources,
    saveReportInWlmdbDatabase,
    deriveHostConfigBasedInstanceType,
    groupSqlServerInstancesByDeploymentType,
    deriveEbsVolumesListForMarketing,
    deriveSqlUsageBasedInstanceType,
    getOnpremLicenseRecommendations,
    deriveInstanceRequirements,
    getOnPremResourceExploreSavings,
    getOnPremBulkResourceExploreSavings,
    calculateTotalAllocatedCapacity
} from '../../../src/operations/workloads/mssql/mssql-onprem-tco-operations';
import { processEbsDisks, EbsVolumeType } from '../../../src/operations/onprem-tco-operations';
import * as ec2Lib from '../../../src/lib/aws/ec2';
import { ACCOUNT_ID, DEFAULT_AWS_REGION, MSSQL } from '../../../src/utils/consts';
import { convertGiBToBytes } from '../../../src/utils/utils';
import { hasComputeOverrides } from '../../../src/utils/onprem-tco/onprem-tco-utils';
import { OnPremCollectionObject, SqlInstanceDetails } from '../../../src/utils/onprem-tco/onprem-tco-generic.types';

const loadJson = (filename: string): OnPremCollectionObject => {
    const filePath = path.join(__dirname, '../../../src/utils/demo-utils/onPremRecords', filename);
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

// ============================================================================
// Suite 1: MSSQL Validation Functions
// ============================================================================

describe('MSSQL Validation Functions', () => {
    const stdData = loadJson('SQLServerDataResponse-DemoSTD.json');

    describe('validateOnPremCollectionObject (via uploadOnpremTcoData)', () => {
        it('should reject upload for null/empty file content', async () => {
            await expect(uploadOnpremTcoData(ACCOUNT_ID, MSSQL, 'test.json', '')).rejects.toThrow();
        });

        it('should reject upload for non-base64 garbage content', async () => {
            await expect(
                uploadOnpremTcoData(ACCOUNT_ID, MSSQL, 'test.json', 'not-valid-compressed-data')
            ).rejects.toThrow();
        });
    });

    describe('validateWindowsConfig (via saveReportInWlmdbDatabase)', () => {
        afterEach(async () => {
            await removeOnPremTcoReportData(undefined, ACCOUNT_ID, undefined, DATABASE_TYPE.mssql);
        });

        it('should reject data with empty sqlServerInfo', async () => {
            const invalidData = { ...stdData, sqlServerInfo: [] } as OnPremCollectionObject;
            await expect(saveReportInWlmdbDatabase(ACCOUNT_ID, DATABASE_TYPE.mssql, invalidData)).rejects.toThrow();
        });

        it('should reject data with missing windowsConfig', async () => {
            const invalidData = { ...stdData, windowsConfig: undefined } as any;
            await expect(saveReportInWlmdbDatabase(ACCOUNT_ID, DATABASE_TYPE.mssql, invalidData)).rejects.toThrow();
        });

        it('should reject data with missing sqlServerInfo and windowsConfig', async () => {
            const invalidData = { ...stdData, sqlServerInfo: undefined, windowsConfig: undefined } as any;
            await expect(saveReportInWlmdbDatabase(ACCOUNT_ID, DATABASE_TYPE.mssql, invalidData)).rejects.toThrow();
        });
    });
});

// ============================================================================
// Suite 2: MSSQL Deployment Type Grouping and Instance Requirements
// ============================================================================

describe('MSSQL Deployment Type Grouping', () => {
    const stdData = loadJson('SQLServerDataResponse-DemoSTD.json');
    const fciData = loadJson('SQLServerDataResponse-DemoFCI.json');
    const aoagData = loadJson('SQLServerDataResponse-DemoAOAG.json');

    describe('groupSqlServerInstancesByDeploymentType', () => {
        it('should group Standalone instances correctly', () => {
            const grouped = groupSqlServerInstancesByDeploymentType(stdData.sqlServerInfo);
            expect(grouped[DATABASE_DEPLOYMENT_TYPE.Standalone]).toBeDefined();
            expect(grouped[DATABASE_DEPLOYMENT_TYPE.Standalone].length).toEqual(1);
        });

        it('should group FCI instances correctly', () => {
            const grouped = groupSqlServerInstancesByDeploymentType(fciData.sqlServerInfo);
            expect(grouped[DATABASE_DEPLOYMENT_TYPE.FCI]).toBeDefined();
            expect(grouped[DATABASE_DEPLOYMENT_TYPE.FCI].length).toEqual(fciData.sqlServerInfo.length);
        });

        it('should group AOAG instances correctly', () => {
            const grouped = groupSqlServerInstancesByDeploymentType(aoagData.sqlServerInfo);
            expect(grouped[DATABASE_DEPLOYMENT_TYPE.AOAG]).toBeDefined();
            expect(grouped[DATABASE_DEPLOYMENT_TYPE.AOAG].length).toBeGreaterThan(0);
        });

        it('should handle mixed deployment types', () => {
            const mixedInstances = [
                { ...stdData.sqlServerInfo[0], deploymentType: 'standalone' },
                { ...fciData.sqlServerInfo[0], deploymentType: 'fci' }
            ] as SqlInstanceDetails[];
            const grouped = groupSqlServerInstancesByDeploymentType(mixedInstances);
            expect(Object.keys(grouped).length).toEqual(2);
            expect(grouped[DATABASE_DEPLOYMENT_TYPE.Standalone]).toBeDefined();
            expect(grouped[DATABASE_DEPLOYMENT_TYPE.FCI]).toBeDefined();
        });

        it('should return empty object for empty input', () => {
            const grouped = groupSqlServerInstancesByDeploymentType([]);
            expect(Object.keys(grouped).length).toEqual(0);
        });
    });

    describe('deriveInstanceRequirements', () => {
        it('should derive correct requirements from STD data', () => {
            const requirements = deriveInstanceRequirements(stdData.sqlServerInfo);
            expect(requirements).toBeDefined();
            expect(requirements.ArchitectureTypes).toEqual(['x86_64']);
            expect(requirements.VirtualizationTypes).toEqual(['hvm']);
            expect(requirements.InstanceRequirements).toBeDefined();
            expect(requirements.InstanceRequirements?.VCpuCount?.Min).toBeGreaterThanOrEqual(4);
            expect(requirements.InstanceRequirements?.MemoryMiB?.Min).toBeGreaterThanOrEqual(8192);
            expect(requirements.InstanceRequirements?.CpuManufacturers).toContain('intel');
            // Pins MSSQL_RECOMMENDED_ALLOWED_INSTANCE_TYPES — recommended sizing intentionally
            // omits x* (memory-optimized) families to avoid over-provisioning.
            expect(requirements.InstanceRequirements?.AllowedInstanceTypes).toEqual(['m*', 'c*', 'r*']);
            expect(requirements.InstanceRequirements?.InstanceGenerations).toEqual(['current']);
        });

        it('should derive correct requirements from FCI data', () => {
            const requirements = deriveInstanceRequirements(fciData.sqlServerInfo);
            expect(requirements).toBeDefined();
            expect(requirements.InstanceRequirements?.VCpuCount?.Min).toBeGreaterThanOrEqual(4);
        });

        it('should set VCpuCount Max to a power of 2', () => {
            const requirements = deriveInstanceRequirements(stdData.sqlServerInfo);
            const maxVcpu = requirements.InstanceRequirements?.VCpuCount?.Max;
            expect(maxVcpu).toBeDefined();
            expect(Math.log2(maxVcpu!) % 1).toEqual(0);
        });
    });
});

// ============================================================================
// Suite 3: License Recommendations and EBS Volumes
// ============================================================================

describe('License Recommendations and EBS Volumes', () => {
    const stdData = loadJson('SQLServerDataResponse-DemoSTD.json');
    const fciData = loadJson('SQLServerDataResponse-DemoFCI.json');
    const aoagData = loadJson('SQLServerDataResponse-DemoAOAG.json');

    describe('getOnpremLicenseRecommendations', () => {
        it('should return Standard Edition when no enterprise features are used', () => {
            const { currentLicenseEdition, recommendedLicenseEdition } = getOnpremLicenseRecommendations(
                stdData.sqlServerInfo
            );
            expect(currentLicenseEdition).toBeDefined();
            expect(recommendedLicenseEdition).toEqual('Standard Edition');
        });

        it('should return Enterprise Edition when enterprise features are used', () => {
            const { currentLicenseEdition, recommendedLicenseEdition } = getOnpremLicenseRecommendations(
                fciData.sqlServerInfo
            );
            expect(currentLicenseEdition).toBeDefined();
            expect(recommendedLicenseEdition).toEqual('Enterprise Edition');
        });

        it('should detect enterprise features from AOAG data', () => {
            const { recommendedLicenseEdition } = getOnpremLicenseRecommendations(aoagData.sqlServerInfo);
            expect(recommendedLicenseEdition).toEqual('Enterprise Edition');
        });
    });

    describe('calculateTotalAllocatedCapacity', () => {
        it('should compute totalAllocatedCapacity for DemoSTD', () => {
            const totalAllocatedCapacity = calculateTotalAllocatedCapacity(stdData.sqlServerInfo);
            expect(totalAllocatedCapacity).toBe('819467386880');
        });

        it('should compute totalAllocatedCapacity for DemoFCI', () => {
            const totalAllocatedCapacity = calculateTotalAllocatedCapacity(fciData.sqlServerInfo);
            expect(totalAllocatedCapacity).toBe('2012079980544');
        });

        it('should compute totalAllocatedCapacity for DemoAOAG', () => {
            const totalAllocatedCapacity = calculateTotalAllocatedCapacity(aoagData.sqlServerInfo);
            expect(totalAllocatedCapacity).toBe('964494884864');
        });

        it('should return "0" for empty sqlServerInfo', () => {
            const result = calculateTotalAllocatedCapacity([]);
            expect(result).toBe('0');
        });
    });

    describe('deriveEbsVolumesListForMarketing', () => {
        it('should derive EBS volumes from STD data', () => {
            const result = deriveEbsVolumesListForMarketing(DEFAULT_AWS_REGION, stdData.sqlServerInfo);
            expect(result).toBeDefined();
            expect(result.primaryEbsVolumes).toBeDefined();
            expect(result.primaryEbsVolumes.length).toBeGreaterThan(0);
        });

        it('should produce volumes with required fields', () => {
            const result = deriveEbsVolumesListForMarketing(DEFAULT_AWS_REGION, stdData.sqlServerInfo);
            result.primaryEbsVolumes.forEach((vol: EbsVolumeType) => {
                expect(vol.volumeType).toBeDefined();
                expect(vol.volumeNumber).toBeGreaterThan(0);
                expect(vol.storageAmount).toBeGreaterThan(0);
            });
        });

        it('should handle AOAG data with secondary volumes', () => {
            const result = deriveEbsVolumesListForMarketing(DEFAULT_AWS_REGION, aoagData.sqlServerInfo);
            expect(result).toBeDefined();
            expect(result.primaryEbsVolumes).toBeDefined();
            // AOAG data has read replicas, so secondary volumes may exist
        });
    });

    describe('processEbsDisks', () => {
        it('should process gp3 EBS disks within limits', () => {
            const gp3List = [
                {
                    instanceName: 'TEST',
                    numDatabases: 1,
                    requiredIops: 3000,
                    requiredThroughput: 150,
                    ebsType: 'gp3',
                    requiredVolumeSize: 5,
                    isPrimary: true
                }
            ];
            const ebsDisks = processEbsDisks(gp3List);
            expect(ebsDisks[0].throughput).toEqual(150);
            expect(ebsDisks[0].volumeIops).toEqual(3000);
            expect(ebsDisks[0].storageAmount).toEqual(convertGiBToBytes(5));
        });

        it('should clamp gp3 IOPS to max 16000', () => {
            const gp3List = [
                {
                    instanceName: 'TEST',
                    numDatabases: 1,
                    requiredIops: 259000,
                    requiredThroughput: 3000,
                    ebsType: 'gp3',
                    requiredVolumeSize: 64 * 1024,
                    isPrimary: true
                }
            ];
            const ebsDisks = processEbsDisks(gp3List);
            expect(ebsDisks[0].volumeIops).toEqual(16000);
            expect(ebsDisks[0].throughput).toEqual(1000);
        });

        it('should process io2 EBS disks with max limits', () => {
            const io2List = [
                {
                    instanceName: 'TEST',
                    numDatabases: 1,
                    requiredIops: 259000,
                    requiredThroughput: 3000,
                    ebsType: 'io2',
                    requiredVolumeSize: 64 * 1024,
                    isPrimary: true
                }
            ];
            const ebsDisks = processEbsDisks(io2List);
            expect(ebsDisks[0].throughput).toEqual(0);
            expect(ebsDisks[0].volumeIops).toEqual(256000);
            expect(ebsDisks[0].storageAmount).toEqual(convertGiBToBytes(64 * 1024));
        });

        it('should process io1 EBS disks with max limits', () => {
            const io1List = [
                {
                    instanceName: 'TEST',
                    numDatabases: 1,
                    requiredIops: 259000,
                    requiredThroughput: 3000,
                    ebsType: 'io1',
                    requiredVolumeSize: 64 * 1024,
                    isPrimary: true
                }
            ];
            const ebsDisks = processEbsDisks(io1List);
            expect(ebsDisks[0].throughput).toEqual(0);
            expect(ebsDisks[0].volumeIops).toEqual(64000);
            expect(ebsDisks[0].storageAmount).toEqual(convertGiBToBytes(16 * 1024));
        });

        it('should skip disks with numDatabases = 0', () => {
            const emptyList = [
                {
                    instanceName: 'TEST',
                    numDatabases: 0,
                    requiredIops: 3000,
                    requiredThroughput: 150,
                    ebsType: 'gp3',
                    requiredVolumeSize: 5,
                    isPrimary: true
                }
            ];
            const ebsDisks = processEbsDisks(emptyList);
            expect(ebsDisks.length).toEqual(0);
        });
    });
});

// ============================================================================
// Suite 4: MSSQL Database Resources CRUD
// ============================================================================

describe('MSSQL Database Resources CRUD', () => {
    const stdData = loadJson('SQLServerDataResponse-DemoSTD.json');
    const fciData = loadJson('SQLServerDataResponse-DemoFCI.json');
    const aoagData = loadJson('SQLServerDataResponse-DemoAOAG.json');

    afterEach(async () => {
        await removeOnPremTcoReportData(undefined, ACCOUNT_ID, undefined, DATABASE_TYPE.mssql);
    });

    it('should save and retrieve a Standalone report in the database', async () => {
        await saveReportInWlmdbDatabase(ACCOUNT_ID, DATABASE_TYPE.mssql, stdData);

        const result = await getOnPremDatabaseResources(ACCOUNT_ID);
        expect(result.count).toEqual(1);
        expect(result.items.length).toEqual(1);

        const resource = result.items[0];
        expect(resource.resourceId).toBeDefined();
        expect(resource.resourceName).toEqual('WLMDBSTD1');
        expect(resource.deploymentModel).toEqual(DATABASE_DEPLOYMENT_TYPE.Standalone);
        expect(resource.sqlServerInstances).toBeDefined();
        expect(resource.sqlServerInstances.length).toBeGreaterThan(0);
    });

    it('should save and retrieve an FCI report in the database', async () => {
        await saveReportInWlmdbDatabase(ACCOUNT_ID, DATABASE_TYPE.mssql, fciData);

        const result = await getOnPremDatabaseResources(ACCOUNT_ID);
        expect(result.count).toEqual(1);
        expect(result.items.length).toEqual(1);

        const resource = result.items[0];
        expect(resource.resourceId).toBeDefined();
        expect(resource.deploymentModel).toEqual(DATABASE_DEPLOYMENT_TYPE.FCI);
    });

    it('should save AOAG report and produce correct deployment model', async () => {
        await saveReportInWlmdbDatabase(ACCOUNT_ID, DATABASE_TYPE.mssql, aoagData);

        const result = await getOnPremDatabaseResources(ACCOUNT_ID);
        expect(result.count).toBeGreaterThanOrEqual(1);

        const aoagResource = result.items.find(r => r.deploymentModel === DATABASE_DEPLOYMENT_TYPE.AOAG);
        expect(aoagResource).toBeDefined();
    });

    it('should throw when uploading duplicate data', async () => {
        await saveReportInWlmdbDatabase(ACCOUNT_ID, DATABASE_TYPE.mssql, stdData);

        await expect(saveReportInWlmdbDatabase(ACCOUNT_ID, DATABASE_TYPE.mssql, stdData)).rejects.toThrow(
            'Report already generated for the collected SQL Server data.'
        );
    });

    it('should retrieve an individual resource by ID', async () => {
        await saveReportInWlmdbDatabase(ACCOUNT_ID, DATABASE_TYPE.mssql, stdData);

        const result = await getOnPremDatabaseResources(ACCOUNT_ID);
        const { resourceId } = result.items[0];

        const individual = await getIndividualOnPremDatabaseResource(ACCOUNT_ID, resourceId);
        expect(individual).toBeDefined();
        expect(individual.resourceId).toEqual(resourceId);
        expect(individual.resourceName).toEqual('WLMDBSTD1');
    });

    it('should return empty result when no resources exist', async () => {
        const result = await getOnPremDatabaseResources(ACCOUNT_ID);
        expect(result.count).toEqual(0);
        expect(result.items).toEqual([]);
    });

    it('should handle multiple MSSQL resources for one account', async () => {
        await saveReportInWlmdbDatabase(ACCOUNT_ID, DATABASE_TYPE.mssql, stdData);
        await saveReportInWlmdbDatabase(ACCOUNT_ID, DATABASE_TYPE.mssql, fciData);

        const result = await getOnPremDatabaseResources(ACCOUNT_ID);
        expect(result.count).toEqual(2);

        const deploymentModels = result.items.map(r => r.deploymentModel).sort();
        expect(deploymentModels).toContain(DATABASE_DEPLOYMENT_TYPE.Standalone);
        expect(deploymentModels).toContain(DATABASE_DEPLOYMENT_TYPE.FCI);
    });

    it('should include totalAllocatedCapacity in returned resources', async () => {
        await saveReportInWlmdbDatabase(ACCOUNT_ID, DATABASE_TYPE.mssql, stdData);

        const result = await getOnPremDatabaseResources(ACCOUNT_ID);
        const resource = result.items[0];

        expect(resource.totalAllocatedCapacity).toBeDefined();
        expect(resource.totalAllocatedCapacity).toEqual('819467386880');
    });

    it('should include SQL instance details with required fields', async () => {
        await saveReportInWlmdbDatabase(ACCOUNT_ID, DATABASE_TYPE.mssql, stdData);

        const result = await getOnPremDatabaseResources(ACCOUNT_ID);
        const resource = result.items[0];

        expect(resource.sqlServerInstances.length).toBeGreaterThan(0);

        const instance = resource.sqlServerInstances[0];
        expect(instance.sqlInstanceId).toBeDefined();
        expect(instance.sqlInstanceName).toBeDefined();
    });

    it('should include onPremisesNodes for clustered configurations', async () => {
        await saveReportInWlmdbDatabase(ACCOUNT_ID, DATABASE_TYPE.mssql, fciData);

        const result = await getOnPremDatabaseResources(ACCOUNT_ID);
        const resource = result.items[0];

        expect(resource.onPremisesNodes).toBeDefined();
        expect(resource.onPremisesNodes.length).toBeGreaterThan(0);
    });
});

// ============================================================================
// Suite 5: Instance Type Derivation
// ============================================================================

describe('Instance Type Derivation', () => {
    const stdData = loadJson('SQLServerDataResponse-DemoSTD.json');
    const fciData = loadJson('SQLServerDataResponse-DemoFCI.json');

    it('should derive an instance type based on host config for STD', async () => {
        const instanceType = await deriveHostConfigBasedInstanceType(
            DEFAULT_AWS_REGION,
            stdData.windowsConfig,
            'Enterprise Edition'
        );
        expect(instanceType).toBeDefined();
        expect(typeof instanceType).toEqual('string');
    });

    it('should derive an instance type based on host config for FCI', async () => {
        const instanceType = await deriveHostConfigBasedInstanceType(
            DEFAULT_AWS_REGION,
            fciData.windowsConfig,
            'Standard Edition'
        );
        expect(instanceType).toBeDefined();
        expect(typeof instanceType).toEqual('string');
    });

    it('should derive an instance type based on SQL usage', async () => {
        const instanceType = await deriveSqlUsageBasedInstanceType(
            DEFAULT_AWS_REGION,
            stdData.sqlServerInfo,
            'Enterprise Edition'
        );
        expect(instanceType).toBeDefined();
        expect(typeof instanceType).toEqual('string');
    });
});

// ============================================================================
// Suite 6: Explore Savings (mocked external dependencies)
// ============================================================================

describe('Explore Savings', () => {
    const stdData = loadJson('SQLServerDataResponse-DemoSTD.json');
    const fciData = loadJson('SQLServerDataResponse-DemoFCI.json');

    afterEach(async () => {
        await removeOnPremTcoReportData(undefined, ACCOUNT_ID, undefined, DATABASE_TYPE.mssql);
        vi.clearAllMocks();
    });

    it('should return explore savings for a single MSSQL resource', async () => {
        await saveReportInWlmdbDatabase(ACCOUNT_ID, DATABASE_TYPE.mssql, stdData);
        const resources = await getOnPremDatabaseResources(ACCOUNT_ID);
        expect(resources.count).toEqual(1);

        const { resourceId } = resources.items[0];
        // Pass snapshotInfo to trigger the analysis path (without it, MSSQL returns persisted assessmentData which is empty for freshly saved reports)
        const snapshotInfo = {
            clonedCopiesCount: 1,
            monthlyChangeRatePercentage: 8,
            snapshotFrequency: 'Daily' as const
        };
        const savings = await getOnPremResourceExploreSavings(
            ACCOUNT_ID,
            resourceId,
            DEFAULT_AWS_REGION,
            undefined,
            snapshotInfo
        );

        expect(savings).toBeDefined();
        expect(savings.resourceId).toEqual(resourceId);
        expect(savings.resourceName).toEqual('WLMDBSTD1');
        expect(savings.regionCode).toEqual(DEFAULT_AWS_REGION);
        expect(savings.calculations).toBeDefined();
        expect(savings.storageSavings).toBeDefined();
        expect(savings.storageSavings.compute).toBeDefined();
        expect(savings.storageSavings.totalSummary).toBeDefined();
        const totalSummary = savings.storageSavings.totalSummary as { existing: number; recommended: number };
        expect(totalSummary.existing).toBeGreaterThanOrEqual(0);
        expect(totalSummary.recommended).toBeGreaterThanOrEqual(0);
    });

    it('should return bulk explore savings aggregating totals', async () => {
        await saveReportInWlmdbDatabase(ACCOUNT_ID, DATABASE_TYPE.mssql, stdData);
        await saveReportInWlmdbDatabase(ACCOUNT_ID, DATABASE_TYPE.mssql, fciData);

        const resources = await getOnPremDatabaseResources(ACCOUNT_ID);
        expect(resources.count).toEqual(2);

        const bulkInput = resources.items.map(r => ({ resourceId: r.resourceId }));

        const bulkSavings = await getOnPremBulkResourceExploreSavings(ACCOUNT_ID, DEFAULT_AWS_REGION, bulkInput);

        expect(bulkSavings).toBeDefined();
        expect(bulkSavings.regionCode).toEqual(DEFAULT_AWS_REGION);
        expect(bulkSavings.calculations).toBeDefined();
        expect(bulkSavings.storageSavings).toBeDefined();
        expect(bulkSavings.storageSavings.totalSummary).toBeDefined();
        expect(bulkSavings.storageSavings.totalSummary.existing).toBeGreaterThanOrEqual(0);
        expect(bulkSavings.storageSavings.totalSummary.recommended).toBeGreaterThanOrEqual(0);

        const { calculations, storageSavings } = bulkSavings;
        const existingComputeSum = (calculations.existingComputeCalculation as any[]).reduce(
            (sum: number, c: any) => sum + (c.computeMonthlyPrice || 0),
            0
        );
        const existingLicenseSum = (calculations.existingLicenseCalculation as any[]).reduce(
            (sum: number, l: any) => sum + (l.licenseMonthlyPrice || 0),
            0
        );
        const ebsTotal = Number((storageSavings.ebs as any)?.total || 0);
        const expectedExisting = ebsTotal + existingComputeSum + existingLicenseSum;
        expect(storageSavings.totalSummary.existing).toBeCloseTo(expectedExisting, 2);

        const recommendedComputeSum = (calculations.recommendedComputeCalculation as any[]).reduce(
            (sum: number, c: any) => sum + (c.computeMonthlyPrice || 0),
            0
        );
        const recommendedLicenseSum = (calculations.recommendedLicenseCalculation as any[]).reduce(
            (sum: number, l: any) => sum + (l.licenseMonthlyPrice || 0),
            0
        );
        const fsxTotal = Number((storageSavings.fsx as any)?.total || 0);
        const expectedRecommended = fsxTotal + recommendedComputeSum + recommendedLicenseSum;
        expect(storageSavings.totalSummary.recommended).toBeCloseTo(expectedRecommended, 2);
    });

    it('should throw for invalid region code', async () => {
        await saveReportInWlmdbDatabase(ACCOUNT_ID, DATABASE_TYPE.mssql, stdData);
        const resources = await getOnPremDatabaseResources(ACCOUNT_ID);
        const { resourceId } = resources.items[0];

        await expect(getOnPremResourceExploreSavings(ACCOUNT_ID, resourceId, 'invalid-region-code')).rejects.toThrow(
            'Invalid region code'
        );
    });

    it('should throw when no resources found for bulk', async () => {
        await expect(
            getOnPremBulkResourceExploreSavings(ACCOUNT_ID, DEFAULT_AWS_REGION, [
                { resourceId: 'nonexistent-resource' }
            ])
        ).rejects.toThrow('No On-premises database resources found');
    });

    it('should throw for invalid region code on bulk', async () => {
        await expect(
            getOnPremBulkResourceExploreSavings(ACCOUNT_ID, 'invalid-region', [{ resourceId: 'test-resource-id' }])
        ).rejects.toThrow('Invalid region code');
    });

    it('should throw when resource not found for individual explore savings', async () => {
        await expect(
            getOnPremResourceExploreSavings(ACCOUNT_ID, 'nonexistent-resource-id', DEFAULT_AWS_REGION)
        ).rejects.toThrow('No On-premises');
    });
});

// ============================================================================
// Suite 7: Compute override cache-bypass (MSSQL bulk)
// ============================================================================

describe('MSSQL bulk compute override cache-bypass', () => {
    const stdData = loadJson('SQLServerDataResponse-DemoSTD.json');

    afterEach(async () => {
        await removeOnPremTcoReportData(undefined, ACCOUNT_ID, undefined, DATABASE_TYPE.mssql);
    });

    it('uses cache when compute fields are unchanged (only storage changed)', async () => {
        await saveReportInWlmdbDatabase(ACCOUNT_ID, DATABASE_TYPE.mssql, stdData);
        const resources = await getOnPremDatabaseResources(ACCOUNT_ID);
        const { resourceId } = resources.items[0];

        // Populate assessment_data cache
        await getOnPremBulkResourceExploreSavings(ACCOUNT_ID, DEFAULT_AWS_REGION, [{ resourceId }]);

        // Build override from the raw fixture — compute fields identical, only totalStorage changed.
        // sqlInstanceId maps to instanceGuid as stored by the server.
        const [rawInstance] = stdData.sqlServerInfo as SqlInstanceDetails[];
        const vcpus = rawInstance.noOfVcpusInUse ?? parseInt(rawInstance.vcpusPerInstance, 10);
        const memoryBytes = rawInstance.memory ?? 0;
        const networkPerformance = rawInstance.networkPerformance ?? 'upTo10';

        // Verify the decision function sees no compute override — only storage differs.
        expect(
            hasComputeOverrides(
                [{ id: rawInstance.instanceGuid, vcpus, memoryBytes, networkPerformance }],
                [{ id: rawInstance.instanceGuid, vcpus, memoryBytes, networkPerformance }]
            )
        ).toBe(false);

        const storageOnlyOverride = [
            {
                sqlInstanceId: rawInstance.instanceGuid,
                noOfVcpusInUse: vcpus,
                memory: memoryBytes,
                networkPerformance,
                totalStorage: convertGiBToBytes(9999)
            }
        ];

        const result = await getOnPremBulkResourceExploreSavings(ACCOUNT_ID, DEFAULT_AWS_REGION, [
            { resourceId, sqlInstanceData: storageOnlyOverride }
        ]);

        expect(result).toBeDefined();
        expect(result.calculations).toBeDefined();
    });

    it('bypasses cache and re-derives instance type when vCPU count changes', async () => {
        await saveReportInWlmdbDatabase(ACCOUNT_ID, DATABASE_TYPE.mssql, stdData);
        const resources = await getOnPremDatabaseResources(ACCOUNT_ID);
        const { resourceId } = resources.items[0];

        // Populate cache first
        await getOnPremBulkResourceExploreSavings(ACCOUNT_ID, DEFAULT_AWS_REGION, [{ resourceId }]);

        const [rawInstance] = stdData.sqlServerInfo as SqlInstanceDetails[];
        const baseVcpus = rawInstance.noOfVcpusInUse ?? parseInt(rawInstance.vcpusPerInstance, 10);
        const memoryBytes = rawInstance.memory ?? 0;
        const networkPerformance = rawInstance.networkPerformance ?? 'upTo10';

        // Verify the decision function detects the vCPU change as a compute override.
        expect(
            hasComputeOverrides(
                [{ id: rawInstance.instanceGuid, vcpus: baseVcpus * 2, memoryBytes, networkPerformance }],
                [{ id: rawInstance.instanceGuid, vcpus: baseVcpus, memoryBytes, networkPerformance }]
            )
        ).toBe(true);

        const vcpuOverride = [
            {
                sqlInstanceId: rawInstance.instanceGuid,
                noOfVcpusInUse: baseVcpus * 2,
                memory: memoryBytes,
                networkPerformance
            }
        ];

        const result = await getOnPremBulkResourceExploreSavings(ACCOUNT_ID, DEFAULT_AWS_REGION, [
            { resourceId, sqlInstanceData: vcpuOverride }
        ]);

        expect(result).toBeDefined();
        expect(result.calculations).toBeDefined();
    });
});

// ============================================================================
// Suite 8: speedMbps overflow / corrupt NIC data (GH-issue fix)
// ============================================================================

describe('deriveHostConfigBasedInstanceType – corrupt speedMbps', () => {
    const stdData = loadJson('SQLServerDataResponse-DemoSTD.json');

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should discard overflow speedMbps and omit NetworkBandwidthGbps filter', async () => {
        // Build a windowsConfig whose sole node has a corrupt Broadcom NIC overflow value
        // (8,796,093,022,208 Mbps ≈ 8.2 Pbps), which is beyond MAX_NIC_SPEED_MBPS (400 Gbps).
        const overflowWindowsConfig = {
            ...stdData.windowsConfig,
            nodeDetails: stdData.windowsConfig.nodeDetails.map(node => ({
                ...node,
                networkConfiguration: [
                    {
                        name: 'Broadcom NetXtreme-E 10Gb/25Gb RDMA Ethernet Adapter',
                        speedMbps: 8_796_093_022_208,
                        adapterType: 'Ethernet 802.3'
                    }
                ]
            }))
        };

        const captured: GetInstanceTypesFromInstanceRequirementsCommandInput[] = [];
        vi.spyOn(ec2Lib, 'getInstanceTypesFromInstanceRequirementsCommand').mockImplementation(async (_region, req) => {
            // Deep-clone so subsequent in-place relaxation mutations of `req` cannot
            // retroactively alter what we captured for the first AWS call.
            captured.push(cloneDeep(req));
            return { InstanceTypes: [{ InstanceType: 'm7i-flex.large' }], $metadata: {} };
        });

        await deriveHostConfigBasedInstanceType(DEFAULT_AWS_REGION, overflowWindowsConfig, 'Enterprise Edition');

        // The overflow speedMbps must have been discarded, so the first AWS call should
        // NOT carry a NetworkBandwidthGbps filter (it would be astronomically large otherwise).
        expect(captured[0]?.InstanceRequirements?.NetworkBandwidthGbps).toBeUndefined();
    });
});

// ============================================================================
// Suite 8b: Allowed-instance-type families per derivation path
// ============================================================================

describe('AllowedInstanceTypes per derivation path', () => {
    const stdData = loadJson('SQLServerDataResponse-DemoSTD.json');

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('uses x* family for existing-host derivation (host-config path)', async () => {
        const captured: GetInstanceTypesFromInstanceRequirementsCommandInput[] = [];
        vi.spyOn(ec2Lib, 'getInstanceTypesFromInstanceRequirementsCommand').mockImplementation(async (_region, req) => {
            captured.push(cloneDeep(req));
            return { InstanceTypes: [{ InstanceType: 'x2iedn.32xlarge' }], $metadata: {} };
        });

        await deriveHostConfigBasedInstanceType(DEFAULT_AWS_REGION, stdData.windowsConfig, 'Enterprise Edition');

        expect(captured[0].InstanceRequirements?.AllowedInstanceTypes).toEqual(
            expect.arrayContaining(['m*', 'c*', 'r*', 'x*'])
        );
    });

    it('does NOT use x* family for recommended (sql-usage) derivation', async () => {
        const captured: GetInstanceTypesFromInstanceRequirementsCommandInput[] = [];
        vi.spyOn(ec2Lib, 'getInstanceTypesFromInstanceRequirementsCommand').mockImplementation(async (_region, req) => {
            captured.push(cloneDeep(req));
            return { InstanceTypes: [{ InstanceType: 'r7i.48xlarge' }], $metadata: {} };
        });

        await deriveSqlUsageBasedInstanceType(DEFAULT_AWS_REGION, stdData.sqlServerInfo, 'Enterprise Edition');

        expect(captured[0].InstanceRequirements?.AllowedInstanceTypes).not.toContain('x*');
    });
});

// ============================================================================
// Suite 8c: Monotonic relaxation across retries
// ============================================================================

describe('fetchInstanceTypesByRetry – monotonic relaxation', () => {
    const stdData = loadJson('SQLServerDataResponse-DemoSTD.json');

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('relaxes constraints monotonically across retries', async () => {
        // Build a host config that will force the retry chain to fire several times:
        // a high vCPU/RAM/Network footprint that no AWS SKU will satisfy as-is.
        const largeHostConfig = {
            ...stdData.windowsConfig,
            nodeDetails: stdData.windowsConfig.nodeDetails.map(node => ({
                ...node,
                ramSize: 4096, // 4 TiB → MemoryMiB.Min ≈ 4 TiB
                numberOfVcpus: 128,
                networkConfiguration: [
                    {
                        name: 'Mellanox ConnectX-6',
                        speedMbps: 48_000, // ~48 Gbps
                        adapterType: 'Ethernet 802.3'
                    }
                ]
            }))
        };

        const captured: GetInstanceTypesFromInstanceRequirementsCommandInput[] = [];
        let callCount = 0;
        vi.spyOn(ec2Lib, 'getInstanceTypesFromInstanceRequirementsCommand').mockImplementation(async (_region, req) => {
            captured.push(cloneDeep(req));
            callCount += 1;
            // First 3 attempts return empty; 4th returns a hit so the chain terminates.
            return callCount <= 3
                ? { InstanceTypes: [], $metadata: {} }
                : { InstanceTypes: [{ InstanceType: 'r7i.48xlarge' }], $metadata: {} };
        });

        await deriveHostConfigBasedInstanceType(DEFAULT_AWS_REGION, largeHostConfig, 'Enterprise Edition');

        expect(captured.length).toBeGreaterThanOrEqual(2);

        // Each subsequent request must be a strict relaxation of its predecessor:
        for (let i = 1; i < captured.length; i++) {
            const prev = captured[i - 1].InstanceRequirements!;
            const curr = captured[i].InstanceRequirements!;

            // NetworkBandwidthGbps: once removed, never re-added.
            if (prev.NetworkBandwidthGbps === undefined) {
                expect(curr.NetworkBandwidthGbps).toBeUndefined();
            }

            const prevVCpu = prev.VCpuCount as { Min?: number; Max?: number } | undefined;
            const currVCpu = curr.VCpuCount as { Min?: number; Max?: number } | undefined;

            // VCpuCount.Min monotonically non-increasing.
            const prevVMin = prevVCpu?.Min ?? 0;
            const currVMin = currVCpu?.Min ?? 0;
            expect(currVMin).toBeLessThanOrEqual(prevVMin);

            // VCpuCount.Max monotonically non-decreasing (or removed).
            const prevVMax = prevVCpu?.Max;
            const currVMax = currVCpu?.Max;
            if (prevVMax !== undefined && currVMax !== undefined) {
                expect(currVMax).toBeGreaterThanOrEqual(prevVMax);
            }

            const prevMem = prev.MemoryMiB as { Min?: number } | undefined;
            const currMem = curr.MemoryMiB as { Min?: number } | undefined;

            // MemoryMiB.Min monotonically non-increasing.
            const prevMMin = prevMem?.Min ?? 0;
            const currMMin = currMem?.Min ?? 0;
            expect(currMMin).toBeLessThanOrEqual(prevMMin);
        }
    });
});

// ============================================================================
// Suite 9: Bulk assessment 422 when all instance-type retries exhausted
// ============================================================================

describe('getOnPremBulkResourceExploreSavings – no valid instance types', () => {
    const stdData = loadJson('SQLServerDataResponse-DemoSTD.json');

    afterEach(async () => {
        await removeOnPremTcoReportData(undefined, ACCOUNT_ID, undefined, DATABASE_TYPE.mssql);
        vi.restoreAllMocks();
    });

    it('should throw HTTP 422 when all resources fail instance-type derivation', async () => {
        await saveReportInWlmdbDatabase(ACCOUNT_ID, DATABASE_TYPE.mssql, stdData);
        const resources = await getOnPremDatabaseResources(ACCOUNT_ID);
        const { resourceId } = resources.items[0];

        // Force all EC2 instance-requirements queries to return empty results so that
        // every retry attempt finds no matching instance type.
        vi.spyOn(ec2Lib, 'getInstanceTypesFromInstanceRequirementsCommand').mockResolvedValue({
            InstanceTypes: [],
            $metadata: {}
        });

        await expect(
            getOnPremBulkResourceExploreSavings(ACCOUNT_ID, DEFAULT_AWS_REGION, [{ resourceId }])
        ).rejects.toMatchObject({ status: 422 });
    });
});
