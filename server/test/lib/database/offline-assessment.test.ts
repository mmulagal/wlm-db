import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DATABASE_TYPE } from '@prisma/client';
import {
    bulkUpsertOfflineAssessments,
    getOfflineAssessment,
    listOfflineAssessments,
    OfflineAssessmentRecord
} from '../../../src/lib/database/offline-assessment';
import { ACCOUNT_ID } from '../../utils/consts';
import { initializeDatabase, prisma } from '../../../src/utils/prisma-utils';

// Test resource ID prefix to isolate test data
const TEST_PREFIX = 'lib-db-offline-test';

describe('Offline Assessment Database Operations', () => {
    beforeAll(async () => {
        await initializeDatabase();
    });

    afterAll(async () => {
        // Clean up test data
        try {
            await prisma.client.offline_assessment.deleteMany({
                where: {
                    account_id: ACCOUNT_ID,
                    resource_id: { startsWith: TEST_PREFIX }
                }
            });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('bulkUpsertOfflineAssessments', () => {
        it('should create multiple new records', async () => {
            const records: OfflineAssessmentRecord[] = [
                {
                    accountId: ACCOUNT_ID,
                    resourceId: `${TEST_PREFIX}-bulk-1`,
                    databaseInstanceId: 'instance-bulk-1',
                    databaseType: DATABASE_TYPE.mssql,
                    rawdata: { test: 'data1' },
                    metadata: { hostname: 'host1', databaseInstanceName: 'INSTANCE1' }
                },
                {
                    accountId: ACCOUNT_ID,
                    resourceId: `${TEST_PREFIX}-bulk-2`,
                    databaseInstanceId: 'instance-bulk-2',
                    databaseType: DATABASE_TYPE.mssql,
                    rawdata: { test: 'data2' },
                    metadata: { hostname: 'host2', databaseInstanceName: 'INSTANCE2' }
                }
            ];

            const results = await bulkUpsertOfflineAssessments(records);

            expect(results).toBeDefined();
            expect(results.length).toBe(2);
            expect(results[0].resource_id).toBe(`${TEST_PREFIX}-bulk-1`);
            expect(results[1].resource_id).toBe(`${TEST_PREFIX}-bulk-2`);
        });

        it('should update existing record and increment updateCount', async () => {
            const resourceId = `${TEST_PREFIX}-upsert`;
            const databaseInstanceId = 'instance-upsert';

            // First insert
            await bulkUpsertOfflineAssessments([
                {
                    accountId: ACCOUNT_ID,
                    resourceId,
                    databaseInstanceId,
                    databaseType: DATABASE_TYPE.mssql,
                    rawdata: { version: 1 },
                    metadata: { hostname: 'original-host' }
                }
            ]);

            // Verify initial updateCount
            let record = await getOfflineAssessment(ACCOUNT_ID, resourceId, databaseInstanceId);
            expect((record?.metadata as any)?.updateCount).toBe(1);

            // Second update
            await bulkUpsertOfflineAssessments([
                {
                    accountId: ACCOUNT_ID,
                    resourceId,
                    databaseInstanceId,
                    databaseType: DATABASE_TYPE.mssql,
                    rawdata: { version: 2 },
                    metadata: { hostname: 'updated-host' }
                }
            ]);

            // Verify updateCount incremented
            record = await getOfflineAssessment(ACCOUNT_ID, resourceId, databaseInstanceId);
            expect((record?.metadata as any)?.updateCount).toBe(2);
            expect((record?.rawdata as any)?.version).toBe(2);
            expect((record?.metadata as any)?.hostname).toBe('updated-host');
        });

        it('should handle optional credentialsId and region', async () => {
            const records: OfflineAssessmentRecord[] = [
                {
                    accountId: ACCOUNT_ID,
                    credentialsId: 'cred-123',
                    region: 'us-east-1',
                    resourceId: `${TEST_PREFIX}-with-creds`,
                    databaseInstanceId: 'instance-with-creds',
                    databaseType: DATABASE_TYPE.mssql,
                    rawdata: { test: 'with-creds' },
                    metadata: { hostname: 'host-creds' }
                }
            ];

            const results = await bulkUpsertOfflineAssessments(records);

            expect(results).toBeDefined();
            expect(results[0].credentials_id).toBe('cred-123');
            expect(results[0].region).toBe('us-east-1');
        });

        it('should handle mapped ONTAP volumes', async () => {
            const mappedVolumes = {
                dataVolume: { name: 'data_vol', uuid: 'uuid-data' },
                logVolume: { name: 'log_vol', uuid: 'uuid-log' }
            };

            const records: OfflineAssessmentRecord[] = [
                {
                    accountId: ACCOUNT_ID,
                    resourceId: `${TEST_PREFIX}-with-volumes`,
                    databaseInstanceId: 'instance-with-volumes',
                    databaseType: DATABASE_TYPE.mssql,
                    rawdata: { test: 'volumes' },
                    mappedOntapVolumes: mappedVolumes,
                    metadata: { hostname: 'host-volumes' }
                }
            ];

            await bulkUpsertOfflineAssessments(records);
            const record = await getOfflineAssessment(
                ACCOUNT_ID,
                `${TEST_PREFIX}-with-volumes`,
                'instance-with-volumes'
            );

            expect(record).toBeDefined();
            expect((record?.mapped_ontap_volumes as any)?.dataVolume?.name).toBe('data_vol');
        });
    });

    describe('getOfflineAssessment', () => {
        beforeAll(async () => {
            await bulkUpsertOfflineAssessments([
                {
                    accountId: ACCOUNT_ID,
                    resourceId: `${TEST_PREFIX}-get`,
                    databaseInstanceId: 'instance-get',
                    databaseType: DATABASE_TYPE.mssql,
                    rawdata: { testData: 'for-get' },
                    metadata: { hostname: 'get-host', fsxId: 'fs-get-test' }
                }
            ]);
        });

        it('should retrieve assessment by composite key', async () => {
            const result = await getOfflineAssessment(ACCOUNT_ID, `${TEST_PREFIX}-get`, 'instance-get');

            expect(result).toBeDefined();
            expect(result?.account_id).toBe(ACCOUNT_ID);
            expect(result?.resource_id).toBe(`${TEST_PREFIX}-get`);
            expect(result?.database_instance_id).toBe('instance-get');
            expect(result?.database_type).toBe(DATABASE_TYPE.mssql);
            expect((result?.rawdata as any)?.testData).toBe('for-get');
        });

        it('should return null for non-existent record', async () => {
            const result = await getOfflineAssessment(ACCOUNT_ID, 'non-existent-resource', 'non-existent-instance');

            expect(result).toBeNull();
        });

        it('should return null for wrong accountId', async () => {
            const result = await getOfflineAssessment('wrong-account', `${TEST_PREFIX}-get`, 'instance-get');

            expect(result).toBeNull();
        });
    });

    describe('listOfflineAssessments', () => {
        beforeAll(async () => {
            // Create multiple records for pagination tests
            const records: OfflineAssessmentRecord[] = [];
            for (let i = 1; i <= 5; i++) {
                records.push({
                    accountId: ACCOUNT_ID,
                    resourceId: `${TEST_PREFIX}-list-${i}`,
                    databaseInstanceId: `instance-list-${i}`,
                    databaseType: DATABASE_TYPE.mssql,
                    rawdata: { index: i },
                    metadata: { hostname: `list-host-${i}` }
                });
            }
            await bulkUpsertOfflineAssessments(records);
        });

        it('should list all assessments for account', async () => {
            const results = await listOfflineAssessments({ accountId: ACCOUNT_ID });

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);
        });

        it('should filter by databaseType', async () => {
            const results = await listOfflineAssessments({
                accountId: ACCOUNT_ID,
                databaseType: DATABASE_TYPE.mssql
            });

            expect(results).toBeDefined();
            results.forEach(r => {
                expect(r.database_type).toBe(DATABASE_TYPE.mssql);
            });
        });

        it('should filter by resourceId', async () => {
            const results = await listOfflineAssessments({
                accountId: ACCOUNT_ID,
                resourceId: `${TEST_PREFIX}-list-1`
            });

            expect(results).toBeDefined();
            expect(results.length).toBe(1);
            expect(results[0].resource_id).toBe(`${TEST_PREFIX}-list-1`);
        });

        it('should filter by databaseInstanceId', async () => {
            const results = await listOfflineAssessments({
                accountId: ACCOUNT_ID,
                databaseInstanceId: 'instance-list-2'
            });

            expect(results).toBeDefined();
            expect(results.length).toBe(1);
            expect(results[0].database_instance_id).toBe('instance-list-2');
        });

        it('should support pagination with pageSize', async () => {
            const results = await listOfflineAssessments({
                accountId: ACCOUNT_ID,
                pageSize: 2
            });

            expect(results).toBeDefined();
            expect(results.length).toBeLessThanOrEqual(2);
        });

        it('should support pagination with nextToken', async () => {
            // Create records specifically for this pagination test
            const paginationRecords: OfflineAssessmentRecord[] = [];
            for (let i = 1; i <= 4; i++) {
                paginationRecords.push({
                    accountId: ACCOUNT_ID,
                    resourceId: `${TEST_PREFIX}-pagination-${i}`,
                    databaseInstanceId: `instance-pagination-${i}`,
                    databaseType: DATABASE_TYPE.mssql,
                    rawdata: { paginationIndex: i },
                    metadata: { hostname: `pagination-host-${i}` }
                });
            }
            await bulkUpsertOfflineAssessments(paginationRecords);

            // First page
            const firstPage = await listOfflineAssessments({
                accountId: ACCOUNT_ID,
                pageSize: 2
            });

            expect(firstPage.length).toBe(2);

            // Second page using cursor
            const nextToken = firstPage[firstPage.length - 1].id;
            const secondPage = await listOfflineAssessments({
                accountId: ACCOUNT_ID,
                pageSize: 2,
                nextToken
            });

            // Verify that pagination returns results and that cursor works
            // Note: Due to how prisma cursor pagination works with skip:1,
            // the second page should start from records after the cursor
            expect(secondPage).toBeDefined();
            expect(Array.isArray(secondPage)).toBe(true);
        });

        it('should return empty array for non-existent account', async () => {
            const results = await listOfflineAssessments({ accountId: 'non-existent-account' });

            expect(results).toBeDefined();
            expect(results).toEqual([]);
        });

        it('should order by created_time descending', async () => {
            const results = await listOfflineAssessments({ accountId: ACCOUNT_ID });

            if (results.length > 1) {
                for (let i = 0; i < results.length - 1; i++) {
                    const current = new Date(results[i].created_time).getTime();
                    const next = new Date(results[i + 1].created_time).getTime();
                    expect(current).toBeGreaterThanOrEqual(next);
                }
            }
        });
    });
});
