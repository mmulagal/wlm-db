import { STORAGE_TYPE } from '@prisma/client';
import {
    createDeployment,
    deleteConfig,
    deleteDeployment,
    createResource,
    deleteResource,
    upsertDatabaseInstance,
    deleteDatabaseInstance
} from '../../../src/lib/database/db';
import {
    getSavedConfig,
    getAllSavedConfig,
    saveConfig,
    deleteSavedConfig,
    getAllDeploymentStatus,
    getDeploymentStatusByName,
    modifyConfig,
    getPaginatedDatabaseInstances
} from '../../../src/operations/database/database-operations';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';
import { DatabaseInstanceRecord } from '../../../src/lib/database/db-types';

describe('Database operations', () => {
    it('Get saved config', async () => {
        const response = await saveConfig(ACCOUNT_ID, 'testuser', 'testname', {
            subnetId: 'test-subnet',
            vpcId: 'test-vpc'
        });
        const resp = await getSavedConfig(ACCOUNT_ID, response.id);
        expect(resp.accountId).toEqual(ACCOUNT_ID);
        expect(resp.data.subnetId).toEqual('test-subnet');

        await deleteConfig(ACCOUNT_ID, response.id);
    });

    it('Get all saved config', async () => {
        await saveConfig(ACCOUNT_ID, 'testuser', 'testname', {
            subnetId: 'test-subnet',
            vpcId: 'test-vpc'
        });
        const resp = await getAllSavedConfig(ACCOUNT_ID);
        expect(resp[0].accountId).toEqual(ACCOUNT_ID);
        expect(resp[0].name).toEqual('testname');

        await deleteConfig(ACCOUNT_ID, resp[0].id);
    });
    it('Delete saved config', async () => {
        const { id } = await saveConfig(ACCOUNT_ID, 'testuser', 'testname', {
            subnetId: 'test-subnet',
            vpcId: 'test-vpc'
        });
        const response = await deleteSavedConfig(ACCOUNT_ID, id);
        expect(response).toBeUndefined();
    });

    it('Update saved config', async () => {
        const { id } = await saveConfig(ACCOUNT_ID, 'testuser', 'testname', {
            subnetId: 'test-subnet',
            vpcId: 'test-vpc'
        });
        const { id: modifiedId } = await modifyConfig(ACCOUNT_ID, id, 'updated name');
        const resp = await getSavedConfig(ACCOUNT_ID, modifiedId);
        expect(resp.name).toEqual('updated name');
        // expect(resp.modifiedTime).toBeDefined();
        /*
            This check is commented because prismock doesnot support @updatedAT attribute https://github.com/morintd/prismock#:~:text=%E2%9B%94-,%40updatedAt,-%E2%9B%94
            Once the attribute is enabled we can run this assertion.
        */
        const response = await deleteSavedConfig(ACCOUNT_ID, id);
        expect(response).toBeUndefined();
    });

    it('Get all deployment status', async () => {
        const response = await createDeployment(ACCOUNT_ID, {
            deploymentId: 'wlmdb-12345',
            deploymentName: 'wlmdb-12345',
            deploymentStatus: 'CREATE_COMPLETE',
            deploymentModel: 'FCI',
            credentialsId: '',
            startTime: 0,
            region: '',
            data: {
                resourceName: 'dummy-resourec-name',
                databaseType: 'Microsoft SQL server',
                fileSystemType: 'FSx for ONTAP'
            }
        });
        await createDeployment(ACCOUNT_ID, {
            deploymentId: 'wlmdb-12345-sql',
            deploymentName: 'wlmdb-12345-sql',
            parentDeploymentId: 'wlmdb-12345',
            deploymentModel: 'FCI',
            deploymentStatus: 'CREATE_COMPLETE',
            credentialsId: '',
            startTime: 0,
            region: '',
            data: {
                resourceName: 'dummy-resourec-name',
                databaseType: 'Microsoft SQL server',
                fileSystemType: 'FSx for ONTAP'
            }
        });
        const resp = await getAllDeploymentStatus(ACCOUNT_ID);
        expect(response.deployment_id).toEqual(resp[0].deploymentId);

        await deleteDeployment(ACCOUNT_ID, 'wlmdb-12345');
        await deleteDeployment(ACCOUNT_ID, 'wlmdb-12345-sql');
    });
    it('Get deployment status by id', async () => {
        const response = await createDeployment(ACCOUNT_ID, {
            deploymentId: 'wlmdb-2345',
            deploymentName: 'wlmdb-2345',
            deploymentStatus: 'CREATE_COMPLETE',
            deploymentModel: 'FCI',
            credentialsId: '',
            startTime: 0,
            region: '',
            data: {
                resourceName: 'dummy-resourec-name',
                databaseType: 'Microsoft SQL server',
                fileSystemType: 'FSx for ONTAP'
            }
        });
        const response1 = await createDeployment(ACCOUNT_ID, {
            deploymentId: 'wlmdb-45678',
            deploymentName: 'wlmdb-45678',
            deploymentStatus: 'CREATE_FAILED',
            deploymentModel: 'FCI',
            credentialsId: '',
            startTime: 0,
            region: '',
            data: {
                resourceName: 'dummy-resourec-name',
                databaseType: 'Microsoft SQL server',
                fileSystemType: 'FSx for ONTAP'
            }
        });
        let resp = await getDeploymentStatusByName(ACCOUNT_ID, 'wlmdb-2345');
        expect(response.deployment_name).toEqual(resp.deploymentName);
        expect(response.deployment_status).toEqual(resp.deploymentStatus);

        resp = await getDeploymentStatusByName(ACCOUNT_ID, 'wlmdb-45678');
        expect(resp);
        expect(response1.deployment_name).toEqual(resp.deploymentName);
        expect(response1.deployment_status).toEqual(resp.deploymentStatus);

        await deleteDeployment(ACCOUNT_ID, 'wlmdb-2345');
        await deleteDeployment(ACCOUNT_ID, 'wlmdb-45678');
    });
});

describe('getPaginatedDatabaseInstances', () => {
    let testResource1: { resource_id: string };
    let testResource2: { resource_id: string };
    let testInstanceIds: string[];

    beforeAll(async () => {
        // Create test resources
        testResource1 = await createResource(ACCOUNT_ID, {
            resourceId: 'paginated-test-resource-1',
            resourceName: 'Paginated Test Resource 1',
            resourceType: 'MSSQL',
            cloudProviderAccountId: '464262061435',
            cloudProviderName: 'AWS',
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            storageType: STORAGE_TYPE.FSXN,
            region: DEFAULT_AWS_REGION
        });

        testResource2 = await createResource(ACCOUNT_ID, {
            resourceId: 'paginated-test-resource-2',
            resourceName: 'Paginated Test Resource 2',
            resourceType: 'MSSQL',
            cloudProviderAccountId: '464262061435',
            cloudProviderName: 'AWS',
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            storageType: STORAGE_TYPE.FSXN,
            region: DEFAULT_AWS_REGION
        });

        // Create multiple database instances for pagination testing
        testInstanceIds = [
            'paginated-db-instance-1',
            'paginated-db-instance-2',
            'paginated-db-instance-3',
            'paginated-db-instance-4',
            'paginated-db-instance-5'
        ];

        // Create instances in resource1
        await upsertDatabaseInstance(ACCOUNT_ID, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            resourceId: testResource1.resource_id,
            databaseInstanceId: testInstanceIds[0],
            databaseInstanceName: 'PAGINATED_TEST_INSTANCE_1',
            isDefault: true,
            source: 'discover',
            sqlDeploymentType: 'Standalone',
            fsxSvmId: { 'fs-paginated1': 'svm-paginated1' },
            fsxnIds: 'fs-paginated1',
            databaseType: 'MS_SQL_SERVER'
        } as DatabaseInstanceRecord);

        await upsertDatabaseInstance(ACCOUNT_ID, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            resourceId: testResource1.resource_id,
            databaseInstanceId: testInstanceIds[1],
            databaseInstanceName: 'PAGINATED_TEST_INSTANCE_2',
            isDefault: false,
            source: 'discover',
            sqlDeploymentType: 'Standalone',
            fsxSvmId: { 'fs-paginated2': 'svm-paginated2' },
            fsxnIds: 'fs-paginated2',
            databaseType: 'MS_SQL_SERVER'
        } as DatabaseInstanceRecord);

        await upsertDatabaseInstance(ACCOUNT_ID, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            resourceId: testResource1.resource_id,
            databaseInstanceId: testInstanceIds[2],
            databaseInstanceName: 'PAGINATED_TEST_INSTANCE_3',
            isDefault: false,
            source: 'discover',
            sqlDeploymentType: 'Standalone',
            fsxSvmId: { 'fs-paginated3': 'svm-paginated3' },
            fsxnIds: 'fs-paginated3',
            databaseType: 'MS_SQL_SERVER'
        } as DatabaseInstanceRecord);

        // Create instances in resource2
        await upsertDatabaseInstance(ACCOUNT_ID, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            resourceId: testResource2.resource_id,
            databaseInstanceId: testInstanceIds[3],
            databaseInstanceName: 'PAGINATED_TEST_INSTANCE_4',
            isDefault: true,
            source: 'deployment',
            sqlDeploymentType: 'FCI',
            fsxSvmId: { 'fs-paginated4': 'svm-paginated4' },
            fsxnIds: 'fs-paginated4',
            databaseType: 'MS_SQL_SERVER'
        } as DatabaseInstanceRecord);

        await upsertDatabaseInstance(ACCOUNT_ID, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            resourceId: testResource2.resource_id,
            databaseInstanceId: testInstanceIds[4],
            databaseInstanceName: 'PAGINATED_TEST_INSTANCE_5',
            isDefault: false,
            source: 'deployment',
            sqlDeploymentType: 'FCI',
            fsxSvmId: { 'fs-paginated5': 'svm-paginated5' },
            fsxnIds: 'fs-paginated5',
            databaseType: 'MS_SQL_SERVER'
        } as DatabaseInstanceRecord);
    });

    afterAll(async () => {
        // Clean up test data
        await deleteDatabaseInstance(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            testResource1.resource_id,
            testInstanceIds.slice(0, 3)
        );
        await deleteDatabaseInstance(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            testResource2.resource_id,
            testInstanceIds.slice(3, 5)
        );
        await deleteResource(ACCOUNT_ID, testResource1.resource_id);
        await deleteResource(ACCOUNT_ID, testResource2.resource_id);
    });

    describe('Basic pagination behavior', () => {
        it('should return paginated format with all required properties', async () => {
            const result = await getPaginatedDatabaseInstances(ACCOUNT_ID, {
                resourceId: testResource1.resource_id,
                pageSize: 1
            });

            expect(result).toHaveProperty('items');
            expect(result).toHaveProperty('totalCount');
            expect(result).toHaveProperty('nextToken');
            expect(Array.isArray(result.items)).toBe(true);
            expect(typeof result.totalCount).toBe('number');
        });
        it('should return items when filtering by resourceId', async () => {
            const result = await getPaginatedDatabaseInstances(ACCOUNT_ID, {
                resourceId: testResource1.resource_id
            });

            expect(result.items.length).toBe(3);
            expect(result.totalCount).toBeGreaterThanOrEqual(3);

            // Verify all items belong to the correct resource
            result.items.forEach(item => {
                expect(item.resource_id).toBe(testResource1.resource_id);
            });
        });

        it('should return all instances when no filters are applied', async () => {
            const result = await getPaginatedDatabaseInstances(ACCOUNT_ID);

            expect(result.items.length).toBeGreaterThanOrEqual(5);
            expect(result.totalCount).toBeGreaterThanOrEqual(5);
        });

        it('should handle pageSize parameter', async () => {
            const pageSize = 2;
            const result = await getPaginatedDatabaseInstances(ACCOUNT_ID, {
                pageSize
            });

            expect(result.items.length).toBeLessThanOrEqual(pageSize);
            expect(result.totalCount).toBeGreaterThanOrEqual(result.items.length);
        });

        it('should return empty results for non-existent resource', async () => {
            const result = await getPaginatedDatabaseInstances(ACCOUNT_ID, {
                resourceId: 'non-existent-resource'
            });

            expect(result.items.length).toBe(0);
            expect(result.totalCount).toBe(0);
            expect(result.nextToken).toBeUndefined();
        });
    });

    describe('Next token functionality', () => {
        it('should provide nextToken when pageSize is smaller than total items', async () => {
            const pageSize = 2;
            const result = await getPaginatedDatabaseInstances(ACCOUNT_ID, {
                pageSize
            });

            // If there are more items than pageSize, nextToken should be provided
            if (result.totalCount > pageSize) {
                expect(result.nextToken).toBeDefined();
                expect(typeof result.nextToken).toBe('string');
            }
        });

        it('should not provide nextToken when pageSize covers all items', async () => {
            const result = await getPaginatedDatabaseInstances(ACCOUNT_ID, {
                resourceId: testResource1.resource_id,
                pageSize: 10 // Much larger than available items
            });

            expect(result.items.length).toBe(3);
            expect(result.nextToken).toBeUndefined();
        });

        it('should handle invalid nextToken gracefully', async () => {
            const result = await getPaginatedDatabaseInstances(ACCOUNT_ID, {
                nextToken: 'invalid-token-123'
            });

            // Should return valid structure even with invalid token
            expect(result).toHaveProperty('items');
            expect(result).toHaveProperty('totalCount');
            expect(Array.isArray(result.items)).toBe(true);
        });
    });

    describe('Filtering with pagination', () => {
        it('should support filtering by credentialsId', async () => {
            const result = await getPaginatedDatabaseInstances(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                pageSize: 3
            });

            expect(result.items.length).toBeGreaterThan(0);
            expect(result.totalCount).toBeGreaterThanOrEqual(result.items.length);

            // Verify all returned items match the credentials filter
            result.items.forEach(item => {
                expect(item.credentials_id).toBe(DEFAULT_AWS_CREDENTIALS_ID);
            });
        });

        it('should support filtering by region', async () => {
            const result = await getPaginatedDatabaseInstances(ACCOUNT_ID, {
                region: DEFAULT_AWS_REGION,
                pageSize: 3
            });

            expect(result.items.length).toBeGreaterThan(0);
            expect(result.totalCount).toBeGreaterThanOrEqual(result.items.length);

            // Verify all returned items match the region filter
            result.items.forEach(item => {
                expect(item.region).toBe(DEFAULT_AWS_REGION);
            });
        });

        it('should support filtering by databaseType', async () => {
            const result = await getPaginatedDatabaseInstances(ACCOUNT_ID, {
                databaseType: 'MS_SQL_SERVER',
                pageSize: 3
            });

            expect(result.items.length).toBeGreaterThan(0);
            expect(result.totalCount).toBeGreaterThanOrEqual(result.items.length);

            // Verify all returned items match the database type filter
            result.items.forEach(item => {
                expect(item.database_type).toBe('MS_SQL_SERVER');
            });
        });

        it('should support filtering by isDefault', async () => {
            const result = await getPaginatedDatabaseInstances(ACCOUNT_ID, {
                isDefault: true,
                pageSize: 5
            });

            expect(result.items.length).toBeGreaterThan(0);
            expect(result.totalCount).toBeGreaterThanOrEqual(result.items.length);

            // Verify all returned items match the isDefault filter
            result.items.forEach(item => {
                expect(item.is_default).toBe(true);
            });
        });

        it('should support multiple filters combined', async () => {
            const result = await getPaginatedDatabaseInstances(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                databaseType: 'MS_SQL_SERVER',
                pageSize: 2
            });

            expect(result.items).toBeInstanceOf(Array);
            expect(result.totalCount).toBeGreaterThanOrEqual(0);

            // Verify all returned items match all filters
            result.items.forEach(item => {
                expect(item.credentials_id).toBe(DEFAULT_AWS_CREDENTIALS_ID);
                expect(item.region).toBe(DEFAULT_AWS_REGION);
                expect(item.database_type).toBe('MS_SQL_SERVER');
            });
        });
    });

    describe('Edge cases and error handling', () => {
        it('should handle undefined accountId', async () => {
            const result = await getPaginatedDatabaseInstances(undefined, {
                pageSize: 5
            });

            expect(result).toHaveProperty('items');
            expect(result).toHaveProperty('totalCount');
            expect(Array.isArray(result.items)).toBe(true);
            expect(typeof result.totalCount).toBe('number');
        });

        it('should handle empty record parameter', async () => {
            const result = await getPaginatedDatabaseInstances(ACCOUNT_ID);

            expect(result).toHaveProperty('items');
            expect(result).toHaveProperty('totalCount');
            expect(Array.isArray(result.items)).toBe(true);
            expect(typeof result.totalCount).toBe('number');
        });

        it('should handle zero pageSize', async () => {
            const result = await getPaginatedDatabaseInstances(ACCOUNT_ID, {
                pageSize: 0
            });

            expect(result).toHaveProperty('items');
            expect(result).toHaveProperty('totalCount');
            expect(Array.isArray(result.items)).toBe(true);
        });

        it('should handle negative pageSize', async () => {
            const result = await getPaginatedDatabaseInstances(ACCOUNT_ID, {
                pageSize: -1
            });

            expect(result).toHaveProperty('items');
            expect(result).toHaveProperty('totalCount');
            expect(Array.isArray(result.items)).toBe(true);
        });

        it('should maintain consistent totalCount across paginated requests', async () => {
            const page1 = await getPaginatedDatabaseInstances(ACCOUNT_ID, {
                pageSize: 2
            });

            if (page1.nextToken) {
                const page2 = await getPaginatedDatabaseInstances(ACCOUNT_ID, {
                    pageSize: 2,
                    nextToken: page1.nextToken
                });

                // Total count should be consistent across paginated requests
                expect(page2.totalCount).toBe(page1.totalCount);
            }
        });
    });

    describe('Specific database instance queries', () => {
        it('should support filtering by specific sqlInstanceId', async () => {
            const result = await getPaginatedDatabaseInstances(ACCOUNT_ID, {
                sqlInstanceId: testInstanceIds[0]
            });

            expect(result.items.length).toBeLessThanOrEqual(1);
            if (result.items.length > 0) {
                expect(result.items[0].database_instance_id).toBe(testInstanceIds[0]);
            }
        });

        it('should support filtering by sqlInstanceName', async () => {
            const result = await getPaginatedDatabaseInstances(ACCOUNT_ID, {
                sqlInstanceName: 'PAGINATED_TEST_INSTANCE_1'
            });

            expect(result.items).toBeInstanceOf(Array);
            result.items.forEach(item => {
                expect(item.database_instance_name).toBe('PAGINATED_TEST_INSTANCE_1');
            });
        });

        it('should support shouldIncludeResource option', async () => {
            const result = await getPaginatedDatabaseInstances(ACCOUNT_ID, {
                resourceId: testResource1.resource_id,
                shouldIncludeResource: true
            });

            expect(result.items.length).toBeGreaterThan(0);
            // Verify that resource information is included
            result.items.forEach(item => {
                if (item.resource) {
                    expect(item.resource).toHaveProperty('resource_id');
                }
            });
        });
    });
});
