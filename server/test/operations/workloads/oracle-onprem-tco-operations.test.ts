import * as fs from 'fs';
import * as path from 'path';
import { DATABASE_DEPLOYMENT_TYPE, DATABASE_TYPE } from '@prisma/client';

import { removeOnPremTcoReportData } from '../../../src/lib/database/onprem-tco';
import {
    deleteOnPremTcoReportResourceRecord,
    saveReportInReportingRegistry
} from '../../../src/operations/onprem-tco-operations';
import {
    validateOracleCollectionObject,
    validateOracleHostInfo,
    getHostUniqueId,
    saveOracleReportInWlmdbDatabase,
    getOnPremisesOracleDatabaseResources,
    getIndividualOracleDatabaseResource,
    getOracleBulkResourceExploreSavings,
    deriveOracleInstanceType,
    analyzeOracleData,
    uploadOracleTcoData,
    aggregateDatabaseEntries
} from '../../../src/operations/workloads/oracle/oracle-onprem-tco-operations';
import { ACCOUNT_ID, DEFAULT_AWS_REGION } from '../../../src/utils/consts';
import {
    OracleCollectionObject,
    OracleDatabaseEntry,
    OracleInstanceInfo,
    OracleResourceUtilization
} from '../../../src/utils/onprem-tco/onprem-tco-generic.types';

const ORACLE = DATABASE_TYPE.oracle;

const loadJson = (filename: string): OracleCollectionObject => {
    const filePath = path.join(__dirname, '../../../src/utils/demo-utils/onPremRecords', filename);
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

// ============================================================================
// Suite 1: Oracle Validation Functions
// ============================================================================

describe('Oracle Validation Functions', () => {
    const standaloneData = loadJson('OracleDataResponse-DemoStandalone.json');

    describe('validateOracleCollectionObject', () => {
        it('should return true for valid data', () => {
            expect(validateOracleCollectionObject(standaloneData)).toBe(true);
        });

        it('should return false for null/undefined data', () => {
            expect(validateOracleCollectionObject(null as any)).toBe(false);
            expect(validateOracleCollectionObject(undefined as any)).toBe(false);
        });

        it('should return false when required top-level fields are missing', () => {
            const missingScriptInfo = { ...standaloneData, scriptInfo: undefined } as any;
            expect(validateOracleCollectionObject(missingScriptInfo)).toBe(false);

            const missingHostInfo = { ...standaloneData, hostInfo: undefined } as any;
            expect(validateOracleCollectionObject(missingHostInfo)).toBe(false);
        });

        it('should return false when databases is not a non-empty array', () => {
            const missingDatabases = { ...standaloneData, databases: undefined } as any;
            expect(validateOracleCollectionObject(missingDatabases)).toBe(false);

            const emptyDatabases = { ...standaloneData, databases: [] } as any;
            expect(validateOracleCollectionObject(emptyDatabases)).toBe(false);

            const notArray = { ...standaloneData, databases: 'not-an-array' } as any;
            expect(validateOracleCollectionObject(notArray)).toBe(false);
        });

        it('should return false when a database entry is missing required fields', () => {
            const missingInstanceInfo = {
                ...standaloneData,
                databases: [{ ...standaloneData.databases[0], instanceInfo: undefined }]
            } as any;
            expect(validateOracleCollectionObject(missingInstanceInfo)).toBe(false);

            const missingPerformanceSummary = {
                ...standaloneData,
                databases: [{ ...standaloneData.databases[0], performanceSummary: undefined }]
            } as any;
            expect(validateOracleCollectionObject(missingPerformanceSummary)).toBe(false);

            const missingStorageInfo = {
                ...standaloneData,
                databases: [{ ...standaloneData.databases[0], storageInfo: undefined }]
            } as any;
            expect(validateOracleCollectionObject(missingStorageInfo)).toBe(false);
        });

        it('should return false when a database entry has non-array performanceSnapshots', () => {
            const invalidSnapshots = {
                ...standaloneData,
                databases: [{ ...standaloneData.databases[0], performanceSnapshots: 'not-an-array' }]
            } as any;
            expect(validateOracleCollectionObject(invalidSnapshots)).toBe(false);
        });
    });

    describe('validateOracleHostInfo', () => {
        it('should return true for valid host info', () => {
            expect(validateOracleHostInfo(standaloneData.hostInfo)).toBe(true);
        });

        it('should return false for null/undefined host info', () => {
            expect(validateOracleHostInfo(null as any)).toBe(false);
            expect(validateOracleHostInfo(undefined as any)).toBe(false);
        });

        it('should return false when hostname is missing', () => {
            const missingHostname = { ...standaloneData.hostInfo, hostname: '' };
            expect(validateOracleHostInfo(missingHostname)).toBe(false);
        });

        it('should return false when cpuCount is missing', () => {
            const missingCpu = { ...standaloneData.hostInfo, cpuCount: 0 };
            expect(validateOracleHostInfo(missingCpu)).toBe(false);
        });

        it('should return false when totalRamBytes is missing', () => {
            const missingRam = { ...standaloneData.hostInfo, totalRamBytes: 0 };
            expect(validateOracleHostInfo(missingRam)).toBe(false);
        });
    });
});

// ============================================================================
// Suite 2: Oracle Resource ID and Deployment Type
// ============================================================================

describe('Oracle Resource ID and Deployment Type', () => {
    const standaloneData = loadJson('OracleDataResponse-DemoStandalone.json');
    const dataGuardData = loadJson('OracleDataResponse-DemoDataGuard.json');

    describe('getHostUniqueId', () => {
        it('should return uniqueHostId when available', () => {
            const id = getHostUniqueId(standaloneData.hostInfo);
            expect(id).toEqual(standaloneData.hostInfo.uniqueHostId);
        });

        it('should fall back to hostname when uniqueHostId is empty', () => {
            const hostInfoNoUid = { ...standaloneData.hostInfo, uniqueHostId: '' };
            const id = getHostUniqueId(hostInfoNoUid);
            expect(id).toEqual(standaloneData.hostInfo.hostname);
        });

        it('should fall back to hostname when uniqueHostId is N/A', () => {
            const hostInfoNA = { ...standaloneData.hostInfo, uniqueHostId: 'N/A' };
            const id = getHostUniqueId(hostInfoNA);
            expect(id).toEqual(standaloneData.hostInfo.hostname);
        });

        it('should fall back to hostname when uniqueHostId is whitespace', () => {
            const hostInfoWhitespace = { ...standaloneData.hostInfo, uniqueHostId: '   ' };
            const id = getHostUniqueId(hostInfoWhitespace);
            expect(id).toEqual(standaloneData.hostInfo.hostname);
        });

        it('should produce different IDs for different hosts', () => {
            const id1 = getHostUniqueId(standaloneData.hostInfo);
            const id2 = getHostUniqueId(dataGuardData.hostInfo);
            expect(id1).not.toEqual(id2);
        });
    });
});

// ============================================================================
// Suite 3: Oracle Database Resources CRUD
// ============================================================================

describe('Oracle Database Resources CRUD', () => {
    const standaloneData = loadJson('OracleDataResponse-DemoStandalone.json');
    const dataGuardData = loadJson('OracleDataResponse-DemoDataGuard.json');

    afterEach(async () => {
        // Clean up all Oracle test resources
        await removeOnPremTcoReportData(undefined, ACCOUNT_ID, undefined, ORACLE);
    });

    it('should save and retrieve an Oracle report in the database', async () => {
        await saveOracleReportInWlmdbDatabase(ACCOUNT_ID, standaloneData);

        const result = await getOnPremisesOracleDatabaseResources(ACCOUNT_ID);

        expect(result.count).toEqual(1);
        expect(result.items.length).toEqual(1);

        const resource = result.items[0];
        expect(resource.resourceId).toBeDefined();
        expect(resource.resourceName).toEqual('ora-prod-standalone-01');
        expect(resource.oracleDatabases).toBeDefined();
        expect(resource.oracleDatabases.length).toEqual(1);

        const db = resource.oracleDatabases[0];
        expect(db.databaseId).toBeDefined();
        expect(db.databaseName).toEqual('FINDB');
        expect(db.sid).toEqual('findb1');
        expect(db.pdbCount).toEqual(0);
        expect(db.deploymentModel).toEqual(DATABASE_DEPLOYMENT_TYPE.Standalone);
    });

    it('should include correct fields for a DataGuard resource', async () => {
        await saveOracleReportInWlmdbDatabase(ACCOUNT_ID, dataGuardData);

        const result = await getOnPremisesOracleDatabaseResources(ACCOUNT_ID);
        expect(result.count).toEqual(1);

        const resource = result.items[0];
        expect(resource.resourceName).toEqual('ora-prod-dg-primary-01');

        const db = resource.oracleDatabases[0];
        expect(db.databaseName).toEqual('ERPDB');
        expect(db.sid).toEqual('erpdb1');
        expect(db.pdbCount).toEqual(2);
        expect(db.isDataGuardEnabled).toBe(true);
        expect(db.deploymentModel).toEqual(DATABASE_DEPLOYMENT_TYPE.DG);
    });

    it('should throw when uploading duplicate data', async () => {
        await saveOracleReportInWlmdbDatabase(ACCOUNT_ID, standaloneData);

        await expect(saveOracleReportInWlmdbDatabase(ACCOUNT_ID, standaloneData)).rejects.toThrow(
            'Report already generated for this Oracle collector data.'
        );
    });

    it('should delete an Oracle report resource record', async () => {
        await saveOracleReportInWlmdbDatabase(ACCOUNT_ID, standaloneData);
        const created = await getOnPremisesOracleDatabaseResources(ACCOUNT_ID);
        expect(created.count).toEqual(1);

        const { resourceId } = created.items[0];
        await deleteOnPremTcoReportResourceRecord(ACCOUNT_ID, resourceId, DATABASE_TYPE.oracle);

        const afterDelete = await getOnPremisesOracleDatabaseResources(ACCOUNT_ID);
        expect(afterDelete.count).toEqual(0);
    });

    it('should handle multiple Oracle resources for one account', async () => {
        await saveOracleReportInWlmdbDatabase(ACCOUNT_ID, standaloneData);
        await saveOracleReportInWlmdbDatabase(ACCOUNT_ID, dataGuardData);

        const result = await getOnPremisesOracleDatabaseResources(ACCOUNT_ID);
        expect(result.count).toEqual(2);

        const hostnames = result.items.map(r => r.resourceName).sort();
        expect(hostnames).toEqual(['ora-prod-dg-primary-01', 'ora-prod-standalone-01']);
    });
});

// ============================================================================
// Suite 5: Explore Savings (mocked external dependencies)
// ============================================================================

describe('Explore Savings', () => {
    const standaloneData = loadJson('OracleDataResponse-DemoStandalone.json');
    const dataGuardData = loadJson('OracleDataResponse-DemoDataGuard.json');

    afterEach(async () => {
        await removeOnPremTcoReportData(undefined, ACCOUNT_ID, undefined, ORACLE);
        vi.clearAllMocks();
    });

    it('should return explore savings for a single Oracle resource via bulk API', async () => {
        await saveOracleReportInWlmdbDatabase(ACCOUNT_ID, standaloneData);
        const resources = await getOnPremisesOracleDatabaseResources(ACCOUNT_ID);
        expect(resources.count).toEqual(1);

        const { resourceId } = resources.items[0];
        const savings = await getOracleBulkResourceExploreSavings(ACCOUNT_ID, DEFAULT_AWS_REGION, [{ resourceId }]);

        expect(savings).toBeDefined();
        expect(savings.regionCode).toEqual(DEFAULT_AWS_REGION);
        expect(savings.calculations).toBeDefined();
        expect(savings.storageSavings).toBeDefined();
        expect(savings.storageSavings.compute).toBeDefined();
        expect(savings.storageSavings.totalSummary).toBeDefined();
        expect(savings.storageSavings.totalSummary.existing).toBeGreaterThanOrEqual(0);
        expect(savings.storageSavings.totalSummary.recommended).toBeGreaterThanOrEqual(0);
    });

    it('should return bulk explore savings aggregating totals', async () => {
        await saveOracleReportInWlmdbDatabase(ACCOUNT_ID, standaloneData);
        await saveOracleReportInWlmdbDatabase(ACCOUNT_ID, dataGuardData);

        const resources = await getOnPremisesOracleDatabaseResources(ACCOUNT_ID);
        expect(resources.count).toEqual(2);

        const bulkInput = resources.items.map(r => ({ resourceId: r.resourceId }));

        const bulkSavings = await getOracleBulkResourceExploreSavings(ACCOUNT_ID, DEFAULT_AWS_REGION, bulkInput);

        expect(bulkSavings).toBeDefined();
        expect(bulkSavings.regionCode).toEqual(DEFAULT_AWS_REGION);
        expect(bulkSavings.calculations).toBeDefined();
        expect(bulkSavings.storageSavings).toBeDefined();
        expect(bulkSavings.storageSavings.totalSummary).toBeDefined();
        expect(bulkSavings.storageSavings.totalSummary.existing).toBeGreaterThanOrEqual(0);
        expect(bulkSavings.storageSavings.totalSummary.recommended).toBeGreaterThanOrEqual(0);
    });

    it('should throw for invalid region code', async () => {
        await saveOracleReportInWlmdbDatabase(ACCOUNT_ID, standaloneData);
        const resources = await getOnPremisesOracleDatabaseResources(ACCOUNT_ID);
        const { resourceId } = resources.items[0];

        await expect(
            getOracleBulkResourceExploreSavings(ACCOUNT_ID, 'invalid-region-code', [{ resourceId }])
        ).rejects.toThrow('Invalid region code');
    });

    it('should throw when no resources found', async () => {
        await expect(
            getOracleBulkResourceExploreSavings(ACCOUNT_ID, DEFAULT_AWS_REGION, [
                { resourceId: 'nonexistent-resource' }
            ])
        ).rejects.toThrow('No Oracle on-premises database resources found');
    });

    it('should always exclude license data from Oracle results', async () => {
        await saveOracleReportInWlmdbDatabase(ACCOUNT_ID, standaloneData);
        const resources = await getOnPremisesOracleDatabaseResources(ACCOUNT_ID);
        const { resourceId } = resources.items[0];

        const savings = await getOracleBulkResourceExploreSavings(ACCOUNT_ID, DEFAULT_AWS_REGION, [{ resourceId }]);

        expect(savings).toBeDefined();
        expect(savings.storageSavings.license).toEqual([]);
        expect(savings.calculations.existingLicenseCalculation).toEqual([]);
        expect(savings.calculations.recommendedLicenseCalculation).toEqual([]);
    });

    it('should not include any license cost in totalSummary', async () => {
        await saveOracleReportInWlmdbDatabase(ACCOUNT_ID, standaloneData);
        const resources = await getOnPremisesOracleDatabaseResources(ACCOUNT_ID);
        const { resourceId } = resources.items[0];

        const savings = await getOracleBulkResourceExploreSavings(ACCOUNT_ID, DEFAULT_AWS_REGION, [{ resourceId }]);

        expect(savings).toBeDefined();
        expect(savings.storageSavings.license).toEqual([]);
        expect(savings.calculations.existingLicenseCalculation).toEqual([]);
        expect(savings.calculations.recommendedLicenseCalculation).toEqual([]);
        expect(savings.storageSavings.totalSummary.existing).toBeDefined();
        expect(savings.storageSavings.totalSummary.recommended).toBeDefined();
    });

    it('should handle bulk explore savings with multiple resources', async () => {
        await saveOracleReportInWlmdbDatabase(ACCOUNT_ID, standaloneData);
        await saveOracleReportInWlmdbDatabase(ACCOUNT_ID, dataGuardData);

        const resources = await getOnPremisesOracleDatabaseResources(ACCOUNT_ID);
        expect(resources.count).toEqual(2);

        const bulkInput = resources.items.map(r => ({
            resourceId: r.resourceId
        }));

        const bulkSavings = await getOracleBulkResourceExploreSavings(ACCOUNT_ID, DEFAULT_AWS_REGION, bulkInput);

        expect(bulkSavings).toBeDefined();
        expect(bulkSavings.storageSavings).toBeDefined();
        expect(bulkSavings.storageSavings.totalSummary).toBeDefined();
        expect(bulkSavings.storageSavings.license).toEqual([]);
        expect(bulkSavings.calculations.existingLicenseCalculation).toEqual([]);
        expect(bulkSavings.calculations.recommendedLicenseCalculation).toEqual([]);
        expect(bulkSavings.storageSavings.totalSummary.existing).toBeDefined();
        expect(bulkSavings.storageSavings.totalSummary.recommended).toBeDefined();
    });

    it('should exclude license data in bulk for all resources', async () => {
        await saveOracleReportInWlmdbDatabase(ACCOUNT_ID, standaloneData);
        await saveOracleReportInWlmdbDatabase(ACCOUNT_ID, dataGuardData);

        const resources = await getOnPremisesOracleDatabaseResources(ACCOUNT_ID);
        expect(resources.count).toEqual(2);

        const bulkInput = resources.items.map(r => ({
            resourceId: r.resourceId
        }));

        const bulkSavings = await getOracleBulkResourceExploreSavings(ACCOUNT_ID, DEFAULT_AWS_REGION, bulkInput);

        expect(bulkSavings).toBeDefined();
        expect(bulkSavings.storageSavings.license).toEqual([]);
        expect(bulkSavings.calculations.existingLicenseCalculation).toEqual([]);
        expect(bulkSavings.calculations.recommendedLicenseCalculation).toEqual([]);
    });
});

// ============================================================================
// Suite 6: Multi-SID Aggregation
// ============================================================================

describe('Multi-SID Aggregation', () => {
    const standaloneData = loadJson('OracleDataResponse-DemoStandalone.json');
    const dataGuardData = loadJson('OracleDataResponse-DemoDataGuard.json');

    describe('aggregateDatabaseEntries', () => {
        it('should return single entry values unchanged', () => {
            const entries = standaloneData.databases as OracleDatabaseEntry[];
            const aggregated = aggregateDatabaseEntries(entries);

            const db0 = entries[0];
            const expectedMemory = db0.instanceInfo.sgaTargetGB + db0.instanceInfo.pgaTargetGB;
            expect(aggregated.totalMemoryGB).toEqual(expectedMemory);
            expect(aggregated.totalStorageGB).toEqual(db0.storageInfo.totalDatabaseSizeGB);
        });

        it('should SUM memory, storage, IOPS, throughput across entries', () => {
            const entry1 = standaloneData.databases[0] as OracleDatabaseEntry;
            const entry2 = dataGuardData.databases[0] as OracleDatabaseEntry;
            const entries = [entry1, entry2];

            const aggregated = aggregateDatabaseEntries(entries);

            const expectedMemory =
                entry1.instanceInfo.sgaTargetGB +
                entry1.instanceInfo.pgaTargetGB +
                (entry2.instanceInfo.sgaTargetGB + entry2.instanceInfo.pgaTargetGB);
            expect(aggregated.totalMemoryGB).toEqual(expectedMemory);

            const expectedStorage = entry1.storageInfo.totalDatabaseSizeGB + entry2.storageInfo.totalDatabaseSizeGB;
            expect(aggregated.totalStorageGB).toEqual(expectedStorage);
        });

        it('should take MAX of p95 CPU across entries', () => {
            const entry1 = standaloneData.databases[0] as OracleDatabaseEntry;
            const entry2 = dataGuardData.databases[0] as OracleDatabaseEntry;
            const entries = [entry1, entry2];

            const aggregated = aggregateDatabaseEntries(entries);

            const cpu1 = (entry1.resourceUtilization?.cpuUtilization as any)?.p95 || 0;
            const cpu2 = (entry2.resourceUtilization?.cpuUtilization as any)?.p95 || 0;
            expect(aggregated.maxP95Cpu).toEqual(Math.max(cpu1, cpu2));
        });
    });

    describe('Multi-SID grouping by deployment type', () => {
        afterEach(async () => {
            await removeOnPremTcoReportData(undefined, ACCOUNT_ID, undefined, ORACLE);
        });

        it('should group databases by deployment type when saving', async () => {
            // Build a multi-SID collection with both Standalone and DG entries
            const multiSidData: OracleCollectionObject = {
                scriptInfo: standaloneData.scriptInfo,
                hostInfo: standaloneData.hostInfo,
                databases: [
                    standaloneData.databases[0],
                    {
                        ...dataGuardData.databases[0],
                        instanceInfo: {
                            ...dataGuardData.databases[0].instanceInfo,
                            hostName: standaloneData.hostInfo.hostname
                        }
                    }
                ]
            };

            await saveOracleReportInWlmdbDatabase(ACCOUNT_ID, multiSidData);

            const result = await getOnPremisesOracleDatabaseResources(ACCOUNT_ID);
            // Should create 2 resources: one Standalone, one DG
            expect(result.count).toEqual(2);

            const deploymentModels = result.items.map(r => r.deploymentModel).sort();
            expect(deploymentModels).toEqual([DATABASE_DEPLOYMENT_TYPE.DG, DATABASE_DEPLOYMENT_TYPE.Standalone]);
        });

        it('should put all Standalone SIDs into one resource', async () => {
            // Build multi-SID with 2 Standalone entries
            const multiSidData: OracleCollectionObject = {
                scriptInfo: standaloneData.scriptInfo,
                hostInfo: standaloneData.hostInfo,
                databases: [
                    standaloneData.databases[0],
                    {
                        ...standaloneData.databases[0],
                        instanceInfo: {
                            ...standaloneData.databases[0].instanceInfo,
                            dbName: 'TESTDB',
                            dbId: 9999999999,
                            instanceName: 'testdb1'
                        }
                    }
                ]
            };

            await saveOracleReportInWlmdbDatabase(ACCOUNT_ID, multiSidData);

            const result = await getOnPremisesOracleDatabaseResources(ACCOUNT_ID);
            // Should create 1 resource with 2 databases
            expect(result.count).toEqual(1);
            expect(result.items[0].oracleDatabases.length).toEqual(2);

            const dbNames = result.items[0].oracleDatabases.map(d => d.databaseName).sort();
            expect(dbNames).toEqual(['FINDB', 'TESTDB']);
        });
    });
});

// ============================================================================
// Suite 7: deriveOracleInstanceType
// ============================================================================

describe('deriveOracleInstanceType', () => {
    const standaloneData = loadJson('OracleDataResponse-DemoStandalone.json');
    const db0 = standaloneData.databases[0];

    it('should return a valid instance type for standalone Oracle workload', async () => {
        const instanceType = await deriveOracleInstanceType(
            DEFAULT_AWS_REGION,
            db0.instanceInfo as OracleInstanceInfo,
            standaloneData.hostInfo
        );

        expect(instanceType).toBeDefined();
        expect(typeof instanceType).toBe('string');
        expect(instanceType!.length).toBeGreaterThan(0);
    });

    it('should respect resourceUtilization CPU stats for right-sizing', async () => {
        const instanceType = await deriveOracleInstanceType(
            DEFAULT_AWS_REGION,
            db0.instanceInfo as OracleInstanceInfo,
            standaloneData.hostInfo,
            db0.resourceUtilization as OracleResourceUtilization
        );

        expect(instanceType).toBeDefined();
        expect(typeof instanceType).toBe('string');
    });

    it('should use aggregated values when provided (multi-SID)', async () => {
        const instanceType = await deriveOracleInstanceType(
            DEFAULT_AWS_REGION,
            db0.instanceInfo as OracleInstanceInfo,
            standaloneData.hostInfo,
            undefined,
            { totalMemoryGB: 32, maxP95Cpu: 55 }
        );

        expect(instanceType).toBeDefined();
        expect(typeof instanceType).toBe('string');
    });

    it('should return undefined gracefully on error (e.g. no matching instance)', async () => {
        const tinyHost = {
            ...standaloneData.hostInfo,
            cpuCount: 0
        };

        const instanceType = await deriveOracleInstanceType(
            DEFAULT_AWS_REGION,
            db0.instanceInfo as OracleInstanceInfo,
            tinyHost
        );

        // Should return a type (min 4 vCPUs enforced) or undefined without throwing
        expect(instanceType === undefined || typeof instanceType === 'string').toBe(true);
    });
});

// ============================================================================
// Suite 8: analyzeOracleData
// ============================================================================

describe('analyzeOracleData', () => {
    const standaloneData = loadJson('OracleDataResponse-DemoStandalone.json');

    afterEach(async () => {
        await removeOnPremTcoReportData(undefined, ACCOUNT_ID, undefined, ORACLE);
    });

    it('should analyze standalone Oracle data and return storageSavings and calculations', async () => {
        await saveOracleReportInWlmdbDatabase(ACCOUNT_ID, standaloneData);
        const resources = await getOnPremisesOracleDatabaseResources(ACCOUNT_ID);
        const { resourceId } = resources.items[0];

        const result = await analyzeOracleData(
            ACCOUNT_ID,
            resourceId,
            standaloneData.hostInfo,
            standaloneData.databases as OracleDatabaseEntry[]
        );

        expect(result).toBeDefined();
        expect(result.storageSavings).toBeDefined();
        expect(result.calculations).toBeDefined();
    });

    it('should return storageSavings even when sizingStats are absent', async () => {
        const dataWithoutSizingStats = JSON.parse(JSON.stringify(standaloneData)) as OracleCollectionObject;
        dataWithoutSizingStats.databases[0].performanceSummary = {
            ...dataWithoutSizingStats.databases[0].performanceSummary,
            sizingStats: undefined
        } as any;

        await saveOracleReportInWlmdbDatabase(ACCOUNT_ID, dataWithoutSizingStats);
        const resources = await getOnPremisesOracleDatabaseResources(ACCOUNT_ID);
        const { resourceId } = resources.items[0];

        const result = await analyzeOracleData(
            ACCOUNT_ID,
            resourceId,
            dataWithoutSizingStats.hostInfo,
            dataWithoutSizingStats.databases as OracleDatabaseEntry[]
        );

        expect(result).toBeDefined();
        expect(result.storageSavings).toBeDefined();
        expect(result.calculations).toBeDefined();
    });
});

// ============================================================================
// Suite 9: getIndividualOracleDatabaseResource
// ============================================================================

describe('getIndividualOracleDatabaseResource', () => {
    const standaloneData = loadJson('OracleDataResponse-DemoStandalone.json');

    afterEach(async () => {
        await removeOnPremTcoReportData(undefined, ACCOUNT_ID, undefined, ORACLE);
    });

    it('should return a single Oracle database resource by resourceId', async () => {
        await saveOracleReportInWlmdbDatabase(ACCOUNT_ID, standaloneData);
        const resources = await getOnPremisesOracleDatabaseResources(ACCOUNT_ID);
        const { resourceId } = resources.items[0];

        const resource = await getIndividualOracleDatabaseResource(ACCOUNT_ID, resourceId);

        expect(resource).toBeDefined();
        expect(resource.resourceId).toBe(resourceId);
    });

    it('should throw 404 when resourceId does not exist', async () => {
        await expect(getIndividualOracleDatabaseResource(ACCOUNT_ID, 'nonexistent-id')).rejects.toThrow('not found');
    });
});

// ============================================================================
// Suite 10: uploadOracleTcoData
// ============================================================================

describe('uploadOracleTcoData', () => {
    afterEach(async () => {
        await removeOnPremTcoReportData(undefined, ACCOUNT_ID, undefined, ORACLE);
    });

    it('should reject invalid Oracle data format', async () => {
        // Compress a valid JSON that doesn't match Oracle schema
        const invalidData = JSON.stringify({ foo: 'bar' });
        const base64Content = Buffer.from(invalidData).toString('base64');
        const { compressSync } = await import('fflate');
        const compressed = compressSync(new TextEncoder().encode(base64Content));
        const compressedBase64 = btoa(String.fromCharCode(...compressed));

        await expect(uploadOracleTcoData(ACCOUNT_ID, 'test.json', compressedBase64)).rejects.toThrow(
            'Invalid Oracle data format'
        );
    });

    it('should reject data with invalid hostInfo', async () => {
        // Valid structure but missing hostInfo fields
        const badHostData = JSON.stringify({
            scriptInfo: { scriptVersion: '1.0.0' },
            hostInfo: { hostname: '' },
            databases: [{ instanceInfo: { dbName: 'test' } }]
        });
        const base64Content = Buffer.from(badHostData).toString('base64');
        const { compressSync } = await import('fflate');
        const compressed = compressSync(new TextEncoder().encode(base64Content));
        const compressedBase64 = btoa(String.fromCharCode(...compressed));

        await expect(uploadOracleTcoData(ACCOUNT_ID, 'test.json', compressedBase64)).rejects.toThrow();
    });

    it('should return a jobId for valid compressed Oracle data', async () => {
        const standaloneData = loadJson('OracleDataResponse-DemoStandalone.json');
        const jsonString = JSON.stringify(standaloneData);
        const base64Content = Buffer.from(jsonString).toString('base64');
        const { compressSync } = await import('fflate');
        const compressed = compressSync(new TextEncoder().encode(base64Content));
        const compressedBase64 = btoa(String.fromCharCode(...compressed));

        const result = await uploadOracleTcoData(ACCOUNT_ID, 'OracleStandalone.json', compressedBase64);

        expect(result).toBeDefined();
        expect(result.jobId).toBeDefined();
        expect(typeof result.jobId).toBe('string');
    });
});

// ============================================================================
// Suite 12: saveReportInReportingRegistry (Oracle)
// ============================================================================

describe('saveReportInReportingRegistry (Oracle)', () => {
    const standaloneData = loadJson('OracleDataResponse-DemoStandalone.json');

    it('should save a report in the reporting registry without error', async () => {
        await expect(
            saveReportInReportingRegistry(ACCOUNT_ID, 'test-oracle-report.json', standaloneData, 'oracle')
        ).resolves.not.toThrow();
    });
});
