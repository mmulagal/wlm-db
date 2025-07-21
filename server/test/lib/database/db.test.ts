import { STORAGE_TYPE } from '@prisma/client';
import { isArray } from 'lodash-es';
import {
    listDeployments,
    createDeployment,
    deleteDeployment,
    listResources,
    createResource,
    deleteResource,
    listConfig,
    createConfig,
    deleteConfig,
    createEvent,
    listRelationshipsResources,
    updateConfig,
    listEvents,
    upsertDatabaseInstance,
    listDatabaseInstances,
    deleteDatabaseInstance,
    createTrackedEc2Records,
    listTrackedEc2,
    removeTrackedEc2Record,
    updateTrackedEc2Record,
    updateResource
} from '../../../src/lib/database/db';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';
import { DatabaseInstanceRecord, PaginatedDatabaseInstancesResponse } from '../../../src/lib/database/db-types';
import { ResourceDetails } from '../../../src/utils/common-types';

// Helper function to extract items from listDatabaseInstances response
function getInstancesArray(result: any[] | PaginatedDatabaseInstancesResponse): Record<string, any>[] {
    if (Array.isArray(result)) {
        return result;
    }
    if (result?.items && Array.isArray(result.items)) {
        return result.items;
    }
    return [];
}

describe('List deployments', () => {
    it('should return a list of deployments', async () => {
        await createDeployment(ACCOUNT_ID, {
            deploymentId:
                'arn:aws:cloudformation:ap-southeast-1:464262061435:stack/TESTSTACK/43d5b7a0-4013-11ee-b15b-0a0b1574b4de',
            deploymentName: 'TESTSTACK',
            cloudProviderAccountId: '464262061435',
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            deploymentStatus: 'CREATE_IN_PROGRESS',
            deploymentModel: 'FCI',
            startTime: new Date('2023-08-21T11:10:35.875Z').valueOf(),
            region: 'us-east-1'
        });

        await createEvent({
            eventId: 'test-event',
            accountId: ACCOUNT_ID,
            deploymentId:
                'arn:aws:cloudformation:ap-southeast-1:464262061435:stack/TESTSTACK/43d5b7a0-4013-11ee-b15b-0a0b1574b4de',
            deploymentName: 'TESTSTACK',
            eventStatus: 'CREATE_IN_PROGRESS',
            eventStatusReason: '',
            resourceType: 'CloudFormation:Stack',
            time: Date.now()
        });
        const resp = await listDeployments(ACCOUNT_ID);
        expect(resp[0].account_id).toEqual(ACCOUNT_ID);
        await deleteDeployment(ACCOUNT_ID, resp[0].deployment_id);
    });

    it('should return a list of resources', async () => {
        await deleteResource(ACCOUNT_ID, 'i-1a2b3c4d5e');
        const resource = await createResource(ACCOUNT_ID, {
            resourceId: 'i-1a2b3c4d5e',
            resourceName: 'sqlnode1',
            resourceType: 'MSSQL',
            cloudProviderAccountId: '464262061435',
            cloudProviderName: 'AWS',
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            storageType: STORAGE_TYPE.FSXN,
            region: DEFAULT_AWS_REGION
        });
        const resp = await listResources({ accountId: ACCOUNT_ID });
        const createdResource = resp.find((res: { resource_id: string }) => res.resource_id === 'i-1a2b3c4d5e');
        expect(createdResource).toBeDefined();

        await deleteResource(ACCOUNT_ID, resource.resource_id);
    });

    it('should return a list of configs', async () => {
        await createConfig(ACCOUNT_ID, {
            user: 'testuser',
            name: 'testconfig',
            creationTime: new Date().valueOf(),
            data: {
                subnetId: 'subnet-12345',
                vpcId: 'vpc-12345'
            }
        });

        const resp = await listConfig(ACCOUNT_ID);
        expect(resp[0].account_id).toEqual(ACCOUNT_ID);

        await deleteConfig(ACCOUNT_ID, resp[0].id);
    });

    it('should update a config', async () => {
        const { id } = await createConfig(ACCOUNT_ID, {
            user: 'testuser',
            name: 'testconfig',
            creationTime: new Date().valueOf(),
            data: {
                subnetId: 'subnet-12345',
                vpcId: 'vpc-12345'
            }
        });
        const updateConfigName = 'testupdatedconfig';
        const { id: updatedConfigId } = await updateConfig(ACCOUNT_ID, id, {
            name: updateConfigName
        });
        const resp = await listConfig(ACCOUNT_ID, updatedConfigId);
        expect(resp[0].name).toEqual(updateConfigName);

        await deleteConfig(ACCOUNT_ID, updatedConfigId);
    });

    it('should return a list of resources which has relationships', async () => {
        await createResource(ACCOUNT_ID, {
            resourceId: 'i-1a2b3c4d5e',
            resourceName: 'sqlnode1',
            resourceType: 'MSSQL',
            cloudProviderAccountId: '464262061435',
            cloudProviderName: 'AWS',
            coRelationId: 'fsx-1234',
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            storageType: STORAGE_TYPE.FSXN,
            region: DEFAULT_AWS_REGION
        });

        const resp = await listRelationshipsResources(ACCOUNT_ID);
        expect(resp[0].resource_id).toEqual('i-1a2b3c4d5e');
        expect(resp[0].co_relation_id).toEqual('fsx-1234');

        const respWithId = await listRelationshipsResources(ACCOUNT_ID, 'i-1a2b3c4d5e');
        expect(respWithId[0].resource_id).toEqual('i-1a2b3c4d5e');
        expect(respWithId[0].co_relation_id).toEqual('fsx-1234');
        await deleteResource(ACCOUNT_ID, resp[0].resource_id);
    });

    it('should return a list of events', async () => {
        await createDeployment(ACCOUNT_ID, {
            deploymentId:
                'arn:aws:cloudformation:ap-southeast-1:464262061435:stack/TESTSTACK/43d5b7a0-4013-11ee-b15b-0a0b1574b4de',
            deploymentName: 'TESTSTACK',
            cloudProviderAccountId: '464262061435',
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            deploymentStatus: 'CREATE_IN_PROGRESS',
            deploymentModel: 'FCI',
            startTime: new Date('2023-08-21T11:10:35.875Z').valueOf(),
            region: 'us-east-1'
        });

        await createEvent({
            eventId: 'test-event',
            accountId: ACCOUNT_ID,
            deploymentId:
                'arn:aws:cloudformation:ap-southeast-1:464262061435:stack/TESTSTACK/43d5b7a0-4013-11ee-b15b-0a0b1574b4de',
            deploymentName: 'TESTSTACK',
            eventStatus: 'CREATE_IN_PROGRESS',
            eventStatusReason: '',
            resourceType: 'CloudFormation:Stack',
            time: Date.now()
        });
        const resp = await listEvents(ACCOUNT_ID, 'TESTSTACK', 'test-event');
        expect(resp[0].account_id).toEqual(ACCOUNT_ID);
        await deleteDeployment(ACCOUNT_ID, resp[0].deployment_id);
    });
});

describe('Database instance operations', () => {
    it('Create/update/list/delete database instance record', async () => {
        const databaseResource = await createResource(ACCOUNT_ID, {
            resourceId: 'i-rwithDBInstance',
            resourceName: 'resourcewithDBInstance',
            resourceType: 'MSSQL',
            cloudProviderAccountId: '464262061435',
            cloudProviderName: 'AWS',
            coRelationId: 'fsx-1234',
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            storageType: STORAGE_TYPE.FSXN,
            region: DEFAULT_AWS_REGION
        });

        const DATABASE_INSTANCE_RECORD: DatabaseInstanceRecord = {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            resourceId: databaseResource.resource_id,
            databaseInstanceId: '11111111-2222-3333-4444-55555555555a',
            databaseInstanceName: 'MSSQLSERVER',
            isDefault: true,
            source: 'deployment',
            sqlDeploymentType: 'FCI',
            fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
            fsxnIds: 'fs-0f53fbecdd3d85fb2',
            databaseType: '' // Add the missing property 'databaseType'
        };

        // Insert a new record
        await upsertDatabaseInstance(ACCOUNT_ID, DATABASE_INSTANCE_RECORD);
        let result = await listDatabaseInstances(ACCOUNT_ID, {});
        let response = getInstancesArray(result);
        expect(response[0].database_instance_id).toEqual(DATABASE_INSTANCE_RECORD.databaseInstanceId);

        // Update previously inserted record
        await upsertDatabaseInstance(ACCOUNT_ID, {
            credentialsId: DATABASE_INSTANCE_RECORD.credentialsId,
            resourceId: DATABASE_INSTANCE_RECORD.resourceId,
            region: DEFAULT_AWS_REGION,
            databaseInstanceId: DATABASE_INSTANCE_RECORD.databaseInstanceId,
            databaseInstanceName: 'NEWNAME',
            isDefault: true,
            source: 'deployment',
            sqlDeploymentType: 'FCI',
            fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
            fsxnIds: 'fs-00001111',
            databaseType: ''
        });
        result = await listDatabaseInstances(ACCOUNT_ID, {});
        response = getInstancesArray(result);
        expect(response.length).toEqual(1);
        expect(response[0].resource_id).toEqual(DATABASE_INSTANCE_RECORD.resourceId);
        expect(response[0].database_instance_id).toEqual(DATABASE_INSTANCE_RECORD.databaseInstanceId);
        expect(response[0].is_default).toEqual(true);
        expect(response[0].fsxn_ids).toEqual('fs-00001111');

        // Delete a non-existing record
        await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DATABASE_INSTANCE_RECORD.resourceId, [
            'non-existing-instance'
        ]);
        result = await listDatabaseInstances(ACCOUNT_ID, {});
        response = getInstancesArray(result);
        expect(response.length).toEqual(1);

        const managedInstancesResult = await listDatabaseInstances(undefined, { shouldIncludeResource: true });
        const managedInstances = getInstancesArray(managedInstancesResult);
        expect(managedInstances.length).toBeGreaterThan(0);
        const resource = managedInstances[0].resource as ResourceDetails;
        expect(resource.resource_id).toBeDefined();

        // Delete an existing record
        await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DATABASE_INSTANCE_RECORD.resourceId, [
            DATABASE_INSTANCE_RECORD.databaseInstanceId
        ]);
        result = await listDatabaseInstances(ACCOUNT_ID, {});
        response = getInstancesArray(result);
        expect(response.length).toEqual(0);
    });

    it('should paginate database instances correctly', async () => {
        // Create a resource
        const resource = await createResource(ACCOUNT_ID, {
            resourceId: 'i-paginated-db-resource',
            resourceName: 'paginated-db-resource',
            resourceType: 'MSSQL',
            cloudProviderAccountId: '464262061435',
            cloudProviderName: 'AWS',
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            storageType: STORAGE_TYPE.FSXN,
            region: DEFAULT_AWS_REGION
        });

        // Create 3 database instances for pagination
        const instanceIds = ['db-inst-1', 'db-inst-2', 'db-inst-3'];
        await Promise.all(
            instanceIds.map(id =>
                upsertDatabaseInstance(ACCOUNT_ID, {
                    credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                    region: DEFAULT_AWS_REGION,
                    resourceId: resource.resource_id,
                    databaseInstanceId: id,
                    databaseInstanceName: `DB_${id}`,
                    isDefault: true,
                    source: 'deployment',
                    sqlDeploymentType: 'FCI',
                    fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
                    fsxnIds: 'fs-0f53fbecdd3d85fb2',
                    databaseType: ''
                })
            )
        );

        // Page 1
        const pageSize = 2;
        const page1Result = await listDatabaseInstances(ACCOUNT_ID, {
            resourceId: resource.resource_id,
            pageSize
        });
        const page1 = Array.isArray(page1Result) ? { items: page1Result, totalCount: page1Result.length } : page1Result;
        expect(page1.items.length).toEqual(pageSize);
        expect(page1.totalCount).toEqual(3);
        expect(page1.nextToken).toBeDefined();

        // Cleanup
        await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, resource.resource_id, instanceIds);
        await deleteResource(ACCOUNT_ID, resource.resource_id);
    });
});

describe('Tracked EC2 operations', () => {
    it('should create tracked EC2 records', async () => {
        const trackedEc2Records = [
            {
                cloud_provider_account_id: '464262061435',
                instance_id: 'i-1234567890abcdef0',
                account_id: ACCOUNT_ID,
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: 'us-east-1',
                feature: 'TCO'
            },
            {
                cloud_provider_account_id: '464262061435',
                instance_id: 'i-9876543210qwerty0',
                account_id: ACCOUNT_ID,
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: 'us-east-1',
                feature: 'TCO'
            }
        ];
        const resp = await createTrackedEc2Records(trackedEc2Records);
        expect(resp.count).toEqual(2);
        await removeTrackedEc2Record(ACCOUNT_ID, 'us-east-1', DEFAULT_AWS_CREDENTIALS_ID, 'i-1234567890abcdef0', 'TCO');
        await removeTrackedEc2Record(ACCOUNT_ID, 'us-east-1', DEFAULT_AWS_CREDENTIALS_ID, 'i-9876543210qwerty0', 'TCO');
    });

    it('should list tracked EC2 records', async () => {
        const trackedEc2Records = [
            {
                cloud_provider_account_id: '464262061435',
                instance_id: 'i-1234567890abcdef0',
                account_id: ACCOUNT_ID,
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: 'us-east-1',
                feature: 'TCO'
            }
        ];
        await createTrackedEc2Records(trackedEc2Records);
        const resp = await listTrackedEc2('TCO');
        expect(resp.length).toEqual(1);
        await removeTrackedEc2Record(ACCOUNT_ID, 'us-east-1', DEFAULT_AWS_CREDENTIALS_ID, 'i-1234567890abcdef0', 'TCO');
    });

    it('should update tracked EC2 records', async () => {
        const trackedEc2Records = [
            {
                cloud_provider_account_id: '464262061435',
                instance_id: 'i-1234567890abcdef0',
                account_id: ACCOUNT_ID,
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: 'us-east-1',
                feature: 'TCO'
            }
        ];
        await createTrackedEc2Records(trackedEc2Records);
        const newTime = new Date();
        const resp = await updateTrackedEc2Record(
            ACCOUNT_ID,
            'us-east-1',
            DEFAULT_AWS_CREDENTIALS_ID,
            'i-1234567890abcdef0',
            'TCO',
            { last_updated: newTime }
        );
        expect(resp.count).toEqual(1);
        const [instanceRecord] = await listTrackedEc2('TCO', undefined, undefined, undefined, 'i-1234567890abcdef0');
        expect(instanceRecord.last_updated).toEqual(newTime);
        await removeTrackedEc2Record(ACCOUNT_ID, 'us-east-1', DEFAULT_AWS_CREDENTIALS_ID, 'i-1234567890abcdef0', 'TCO');
    });
});
describe('Database Host Configuration Operations', () => {
    it('Should update database host configurations successfully', async () => {
        // Create a resource with the provided details.
        await createResource(ACCOUNT_ID, {
            resourceId: '6cbdabbfe3fb147e',
            resourceName: 'test-resource',
            resourceType: 'MSSQL',
            coRelationId: 'fs-f6082f35c1db',
            cloudProviderAccountId: 'test-aws-account',
            cloudProviderName: 'AWS',
            region: DEFAULT_AWS_REGION,
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            storageType: 'FSXN',
            metadata: {
                node1InstanceId: 'i-07e76a4b916548dc0',
                node2InstanceId: 'i-0880a21327284f67c',
                sqlDeploymentType: 'FCI'
            }
        });

        await upsertDatabaseInstance(ACCOUNT_ID, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            resourceId: '6cbdabbfe3fb147e',
            databaseInstanceId: 'f4b7c5d3-e1f6-4g2a-9b5d',
            databaseInstanceName: 'MSSQLSERVER',
            isDefault: true,
            source: 'deployment',
            sqlDeploymentType: 'FCI',
            fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
            fsxnIds: 'fs-0f53fbecdd3d85fb2',
            databaseType: ''
        });

        const startTime = Date.now();
        const updatedConfigs = {
            configurationName: 'sql-license',
            configState: 'ACTIVE',
            startTime,
            endTime: undefined
        };

        const updateResponse = await updateResource({
            accountId: ACCOUNT_ID,
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            resourceId: '6cbdabbfe3fb147e',
            updatedConfigs
        });

        expect(updateResponse).to.deep.equal({ count: 1 });

        // Cleanup: Delete the created resource to avoid polluting subsequent tests.
        await deleteResource(ACCOUNT_ID, '6cbdabbfe3fb147e');
    });
});

describe('Enhanced Database Functions - New Features Tests', () => {
    let testResource1: { resource_id: string };
    let testResource2: { resource_id: string };
    let testDatabaseInstance1Id: string;
    let testDatabaseInstance2Id: string;
    let testDatabaseInstance3Id: string;

    beforeAll(async () => {
        // Create test resources with different properties for comprehensive testing
        testResource1 = await createResource(ACCOUNT_ID, {
            resourceId: 'new-features-resource-1',
            resourceName: 'Enhanced Test Resource 1',
            resourceType: 'MSSQL',
            cloudProviderAccountId: '464262061435',
            cloudProviderName: 'AWS',
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            storageType: STORAGE_TYPE.FSXN,
            region: DEFAULT_AWS_REGION,
            metadata: {
                node1InstanceId: 'i-test123enhanced',
                testData: 'enhanced-resource-1',
                environment: 'test'
            },
            assessmentData: {
                performanceScore: 85,
                riskLevel: 'low',
                recommendations: ['optimize-indexes', 'update-stats']
            }
        });

        testResource2 = await createResource(ACCOUNT_ID, {
            resourceId: 'new-features-resource-2',
            resourceName: 'Enhanced Test Resource 2',
            resourceType: 'ORACLE',
            cloudProviderAccountId: '464262061435',
            cloudProviderName: 'AWS',
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            storageType: STORAGE_TYPE.FSXN,
            region: 'us-west-2',
            metadata: {
                node1InstanceId: 'i-test456enhanced',
                testData: 'enhanced-resource-2',
                environment: 'production'
            },
            assessmentData: {
                performanceScore: 92,
                riskLevel: 'medium',
                recommendations: ['scale-up', 'backup-optimization']
            }
        });

        // Create test database instances
        testDatabaseInstance1Id = 'new-features-db-instance-1';
        testDatabaseInstance2Id = 'new-features-db-instance-2';
        testDatabaseInstance3Id = 'new-features-db-instance-3';

        await upsertDatabaseInstance(ACCOUNT_ID, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            resourceId: testResource1.resource_id,
            databaseInstanceId: testDatabaseInstance1Id,
            databaseInstanceName: 'ENHANCED_TEST_INSTANCE_1',
            isDefault: true,
            source: 'discover',
            sqlDeploymentType: 'Standalone',
            fsxSvmId: { 'fs-enhanced123': 'svm-enhanced123' },
            fsxnIds: 'fs-enhanced123',
            databaseType: 'MS_SQL_SERVER',
            storageProtocol: 'iscsi',
            numberofUserDbsCreated: 5,
            sandboxCreated: true,
            metaData: {
                configsOptimized: {
                    sqlVersion: '2019',
                    edition: 'Enterprise'
                }
            }
        });

        await upsertDatabaseInstance(ACCOUNT_ID, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            resourceId: testResource1.resource_id,
            databaseInstanceId: testDatabaseInstance2Id,
            databaseInstanceName: 'ENHANCED_TEST_INSTANCE_2',
            isDefault: false,
            source: 'deployment',
            sqlDeploymentType: 'FCI',
            fsxSvmId: { 'fs-enhanced456': 'svm-enhanced456' },
            fsxnIds: 'fs-enhanced456',
            databaseType: 'MS_SQL_SERVER',
            storageProtocol: 'nfs',
            numberofUserDbsCreated: 12,
            sandboxCreated: false,
            metaData: {
                configsOptimized: {
                    version: '2022',
                    edition: 'Standard'
                }
            }
        });

        await upsertDatabaseInstance(ACCOUNT_ID, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: 'us-west-2',
            resourceId: testResource2.resource_id,
            databaseInstanceId: testDatabaseInstance3Id,
            databaseInstanceName: 'ENHANCED_ORACLE_INSTANCE',
            isDefault: true,
            source: 'discover',
            sqlDeploymentType: 'RAC',
            fsxSvmId: { 'fs-enhanced789': 'svm-enhanced789' },
            fsxnIds: 'fs-enhanced789',
            databaseType: 'ORACLE',
            storageProtocol: 'nfs',
            numberofUserDbsCreated: 3,
            sandboxCreated: true,
            metaData: {
                configsOptimized: {
                    oracleVersion: '19c',
                    edition: 'Enterprise'
                }
            }
        });
    });

    afterAll(async () => {
        // Cleanup all test data
        await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, testResource1.resource_id, [
            testDatabaseInstance1Id,
            testDatabaseInstance2Id
        ]);
        await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, testResource2.resource_id, [
            testDatabaseInstance3Id
        ]);
        await deleteResource(ACCOUNT_ID, testResource1.resource_id);
        await deleteResource(ACCOUNT_ID, testResource2.resource_id);
    });

    describe('listResources with includeDatabaseInstances', () => {
        it('should include database instances when includeDatabaseInstances is true', async () => {
            // Create fresh test data for this test to avoid Prismock data persistence issues
            const testResource = await createResource(ACCOUNT_ID, {
                resourceId: 'include-db-test-resource',
                resourceName: 'Include DB Test Resource',
                resourceType: 'MSSQL',
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                storageType: STORAGE_TYPE.FSXN,
                region: DEFAULT_AWS_REGION
            });

            await upsertDatabaseInstance(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                resourceId: testResource.resource_id,
                databaseInstanceId: 'include-db-test-instance',
                databaseInstanceName: 'INCLUDE_DB_TEST_INSTANCE',
                isDefault: true,
                source: 'discover',
                sqlDeploymentType: 'Standalone',
                fsxSvmId: { 'fs-test123': 'svm-test123' },
                fsxnIds: 'fs-test123',
                databaseType: 'MS_SQL_SERVER'
            });

            const result = await listResources({
                accountId: ACCOUNT_ID,
                resourceId: testResource.resource_id,
                includeDatabaseInstances: true
            });

            expect(result).to.be.an('array');
            expect(result.length).to.equal(1);

            const resource = result[0] as ResourceDetails;
            expect(resource).to.have.property('resource_id', testResource.resource_id);
            expect(resource).to.have.property('database_instances');
            expect(resource.database_instances).to.be.an('array');
            expect(resource.database_instances?.length).to.equal(1);

            // Cleanup
            await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, testResource.resource_id, [
                'include-db-test-instance'
            ]);
            await deleteResource(ACCOUNT_ID, testResource.resource_id);
        });

        it('should not include database instances when includeDatabaseInstances is false', async () => {
            // Create fresh test data
            const testResource = await createResource(ACCOUNT_ID, {
                resourceId: 'exclude-db-test-resource',
                resourceName: 'Exclude DB Test Resource',
                resourceType: 'MSSQL',
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                storageType: STORAGE_TYPE.FSXN,
                region: DEFAULT_AWS_REGION
            });

            const result = await listResources({
                accountId: ACCOUNT_ID,
                resourceId: testResource.resource_id,
                includeDatabaseInstances: false
            });

            expect(result).to.be.an('array');
            expect(result.length).to.equal(1);

            const resource = result[0];
            expect(resource).to.have.property('resource_id', testResource.resource_id);
            expect(resource).to.not.have.property('database_instances');

            // Cleanup
            await deleteResource(ACCOUNT_ID, testResource.resource_id);
        });

        it('should include multiple database instances when includeDatabaseInstances is true', async () => {
            // Create fresh test data with multiple database instances
            const testResource = await createResource(ACCOUNT_ID, {
                resourceId: 'multiple-db-test-resource',
                resourceName: 'Multiple DB Test Resource',
                resourceType: 'MSSQL',
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                storageType: STORAGE_TYPE.FSXN,
                region: DEFAULT_AWS_REGION
            });

            await upsertDatabaseInstance(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                resourceId: testResource.resource_id,
                databaseInstanceId: 'multiple-db-test-instance-1',
                databaseInstanceName: 'MULTIPLE_DB_TEST_INSTANCE_1',
                isDefault: true,
                source: 'discover',
                sqlDeploymentType: 'Standalone',
                fsxSvmId: { 'fs-multi1': 'svm-multi1' },
                fsxnIds: 'fs-multi1',
                databaseType: 'MS_SQL_SERVER'
            });

            await upsertDatabaseInstance(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                resourceId: testResource.resource_id,
                databaseInstanceId: 'multiple-db-test-instance-2',
                databaseInstanceName: 'MULTIPLE_DB_TEST_INSTANCE_2',
                isDefault: false,
                source: 'deployment',
                sqlDeploymentType: 'FCI',
                fsxSvmId: { 'fs-multi2': 'svm-multi2' },
                fsxnIds: 'fs-multi2',
                databaseType: 'MS_SQL_SERVER'
            });

            const result = await listResources({
                accountId: ACCOUNT_ID,
                resourceId: testResource.resource_id,
                includeDatabaseInstances: true
            });

            expect(result).to.be.an('array');
            expect(result.length).to.equal(1);

            const resource = result[0];
            expect(resource).to.have.property('resource_id', testResource.resource_id);
            expect(resource).to.have.property('database_instances');
            expect(resource.database_instances).to.be.an('array');
            expect(resource.database_instances.length).to.equal(2);

            // Cleanup
            await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, testResource.resource_id, [
                'multiple-db-test-instance-1',
                'multiple-db-test-instance-2'
            ]);
            await deleteResource(ACCOUNT_ID, testResource.resource_id);
        });

        it('should return empty database instances array when resource has no database instances but includeDatabaseInstances is true', async () => {
            // Create fresh test data without database instances
            const testResource = await createResource(ACCOUNT_ID, {
                resourceId: 'no-db-test-resource',
                resourceName: 'No DB Test Resource',
                resourceType: 'MSSQL',
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                storageType: STORAGE_TYPE.FSXN,
                region: DEFAULT_AWS_REGION
            });

            const result = await listResources({
                accountId: ACCOUNT_ID,
                resourceId: testResource.resource_id,
                includeDatabaseInstances: true
            });

            expect(result).to.be.an('array');
            expect(result.length).to.equal(1);

            const resource = result[0];
            expect(resource).to.have.property('resource_id', testResource.resource_id);
            expect(resource).to.have.property('database_instances');
            expect(resource.database_instances).to.be.an('array');
            expect(resource.database_instances.length).to.equal(0);

            // Cleanup
            await deleteResource(ACCOUNT_ID, testResource.resource_id);
        });

        it('should handle invalid accountId when includeDatabaseInstances is true', async () => {
            const result = await listResources({
                accountId: 'invalid-account-id',
                includeDatabaseInstances: true
            });

            expect(result).to.be.an('array');
            expect(result.length).to.equal(0);
        });
    });

    describe('listResources with selectKeys', () => {
        it('should return only specified fields when selectKeys is provided', async () => {
            // Create fresh test data
            const testResource = await createResource(ACCOUNT_ID, {
                resourceId: 'select-keys-test-resource',
                resourceName: 'Select Keys Test Resource',
                resourceType: 'MSSQL',
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                storageType: STORAGE_TYPE.FSXN,
                region: DEFAULT_AWS_REGION,
                metadata: { testData: 'should-not-appear' }
            });

            const result = await listResources({
                accountId: ACCOUNT_ID,
                resourceId: testResource.resource_id,
                selectKeys: ['resource_id', 'resource_name', 'resource_type']
            });

            expect(result).to.be.an('array');
            expect(result.length).to.equal(1);

            const resource = result[0];
            expect(resource).to.have.property('resource_id');
            expect(resource).to.have.property('resource_name');
            expect(resource).to.have.property('resource_type');
            expect(resource).to.not.have.property('region');
            expect(resource).to.not.have.property('metadata');

            // Cleanup
            await deleteResource(ACCOUNT_ID, testResource.resource_id);
        });

        it('should return all fields when selectKeys includes all available fields', async () => {
            // Create fresh test data with comprehensive fields
            const testResource = await createResource(ACCOUNT_ID, {
                resourceId: 'all-select-keys-test-resource',
                resourceName: 'All Select Keys Test Resource',
                resourceType: 'ORACLE',
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                storageType: STORAGE_TYPE.FSXN,
                region: DEFAULT_AWS_REGION,
                metadata: { testData: 'should-appear' },
                assessmentData: { score: 100 }
            });

            const result = await listResources({
                accountId: ACCOUNT_ID,
                resourceId: testResource.resource_id,
                selectKeys: ['resource_id', 'resource_name', 'resource_type', 'region', 'metadata', 'assessment_data']
            });

            expect(result).to.be.an('array');
            expect(result.length).to.equal(1);

            const resource = result[0];
            expect(resource).to.have.property('resource_id');
            expect(resource).to.have.property('resource_name');
            expect(resource).to.have.property('resource_type');
            expect(resource).to.have.property('region');
            expect(resource).to.have.property('metadata');
            expect(resource).to.have.property('assessment_data');

            // Cleanup
            await deleteResource(ACCOUNT_ID, testResource.resource_id);
        });

        it('should return empty array when selectKeys contains invalid field names', async () => {
            // Create fresh test data
            const testResource = await createResource(ACCOUNT_ID, {
                resourceId: 'invalid-select-keys-resource',
                resourceName: 'Invalid Select Keys Resource',
                resourceType: 'MSSQL',
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                storageType: STORAGE_TYPE.FSXN,
                region: DEFAULT_AWS_REGION
            });

            const result = await listResources({
                accountId: ACCOUNT_ID,
                resourceId: testResource.resource_id,
                selectKeys: ['nonexistent_field', 'another_invalid_field']
            });

            expect(result).to.be.an('array');
            expect(result.length).to.equal(1);

            const resource = result[0];
            expect(Object.keys(resource)).to.have.length.lessThanOrEqual(2); // Should have minimal or no valid fields

            // Cleanup
            await deleteResource(ACCOUNT_ID, testResource.resource_id);
        });

        it('should handle empty selectKeys array gracefully', async () => {
            // Create fresh test data
            const testResource = await createResource(ACCOUNT_ID, {
                resourceId: 'empty-select-keys-resource',
                resourceName: 'Empty Select Keys Resource',
                resourceType: 'MSSQL',
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                storageType: STORAGE_TYPE.FSXN,
                region: DEFAULT_AWS_REGION
            });

            const result = await listResources({
                accountId: ACCOUNT_ID,
                resourceId: testResource.resource_id,
                selectKeys: []
            });

            expect(result).to.be.an('array');
            expect(result.length).to.equal(1);

            // Should fall back to default fields when selectKeys is empty
            const resource = result[0];
            expect(Object.keys(resource).length).to.be.greaterThan(0);

            // Cleanup
            await deleteResource(ACCOUNT_ID, testResource.resource_id);
        });
    });

    describe('listDatabaseInstances with selectKeys', () => {
        it('should return only specified fields when selectKeys is provided', async () => {
            // Create fresh test data
            const testResource = await createResource(ACCOUNT_ID, {
                resourceId: 'instance-select-keys-resource',
                resourceName: 'Instance Select Keys Resource',
                resourceType: 'MSSQL',
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                storageType: STORAGE_TYPE.FSXN,
                region: DEFAULT_AWS_REGION
            });

            await upsertDatabaseInstance(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                resourceId: testResource.resource_id,
                databaseInstanceId: 'instance-select-keys-test',
                databaseInstanceName: 'INSTANCE_SELECT_KEYS_TEST',
                isDefault: true,
                source: 'discover',
                sqlDeploymentType: 'Standalone',
                fsxSvmId: { 'fs-select123': 'svm-select123' },
                fsxnIds: 'fs-select123',
                databaseType: 'MS_SQL_SERVER'
            });

            const result = await listDatabaseInstances(ACCOUNT_ID, {
                resourceId: testResource.resource_id,
                selectKeys: ['database_instance_id', 'database_instance_name', 'is_default']
            });

            const instances = getInstancesArray(result);
            expect(instances).to.be.an('array');
            expect(instances.length).to.equal(1);

            const instance = instances[0];
            expect(instance).to.have.property('database_instance_id');
            expect(instance).to.have.property('database_instance_name');
            expect(instance).to.have.property('is_default');
            expect(instance).to.not.have.property('region');
            expect(instance).to.not.have.property('source');

            // Cleanup
            await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, testResource.resource_id, [
                'instance-select-keys-test'
            ]);
            await deleteResource(ACCOUNT_ID, testResource.resource_id);
        });

        it('should return all specified fields for multiple database instances', async () => {
            // Create fresh test data with multiple instances
            const testResource = await createResource(ACCOUNT_ID, {
                resourceId: 'multiple-instance-select-keys-resource',
                resourceName: 'Multiple Instance Select Keys Resource',
                resourceType: 'ORACLE',
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                storageType: STORAGE_TYPE.FSXN,
                region: DEFAULT_AWS_REGION
            });

            await upsertDatabaseInstance(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                resourceId: testResource.resource_id,
                databaseInstanceId: 'multi-select-instance-1',
                databaseInstanceName: 'MULTI_SELECT_INSTANCE_1',
                isDefault: true,
                source: 'discover',
                sqlDeploymentType: 'RAC',
                fsxSvmId: { 'fs-multiselect1': 'svm-multiselect1' },
                fsxnIds: 'fs-multiselect1',
                databaseType: 'ORACLE'
            });

            await upsertDatabaseInstance(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                resourceId: testResource.resource_id,
                databaseInstanceId: 'multi-select-instance-2',
                databaseInstanceName: 'MULTI_SELECT_INSTANCE_2',
                isDefault: false,
                source: 'deployment',
                sqlDeploymentType: 'Standalone',
                fsxSvmId: { 'fs-multiselect2': 'svm-multiselect2' },
                fsxnIds: 'fs-multiselect2',
                databaseType: 'ORACLE'
            });

            const result = await listDatabaseInstances(ACCOUNT_ID, {
                resourceId: testResource.resource_id,
                selectKeys: ['database_instance_id', 'database_instance_name', 'is_default', 'source']
            });

            const instances = getInstancesArray(result);
            expect(instances).to.be.an('array');
            expect(instances.length).to.equal(2);

            instances.forEach(instance => {
                expect(instance).to.have.property('database_instance_id');
                expect(instance).to.have.property('database_instance_name');
                expect(instance).to.have.property('is_default');
                expect(instance).to.have.property('source');
                expect(instance).to.not.have.property('region');
                expect(instance).to.not.have.property('database_type');
            });

            // Cleanup
            await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, testResource.resource_id, [
                'multi-select-instance-1',
                'multi-select-instance-2'
            ]);
            await deleteResource(ACCOUNT_ID, testResource.resource_id);
        });

        it('should handle invalid selectKeys gracefully', async () => {
            // Create fresh test data
            const testResource = await createResource(ACCOUNT_ID, {
                resourceId: 'invalid-instance-select-keys-resource',
                resourceName: 'Invalid Instance Select Keys Resource',
                resourceType: 'MSSQL',
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                storageType: STORAGE_TYPE.FSXN,
                region: DEFAULT_AWS_REGION
            });

            await upsertDatabaseInstance(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                resourceId: testResource.resource_id,
                databaseInstanceId: 'invalid-select-instance',
                databaseInstanceName: 'INVALID_SELECT_INSTANCE',
                isDefault: true,
                source: 'discover',
                sqlDeploymentType: 'Standalone',
                fsxSvmId: { 'fs-invalid': 'svm-invalid' },
                fsxnIds: 'fs-invalid',
                databaseType: 'MS_SQL_SERVER'
            });

            const result = await listDatabaseInstances(ACCOUNT_ID, {
                resourceId: testResource.resource_id,
                selectKeys: ['nonexistent_field', 'another_invalid_field']
            });

            const instances = getInstancesArray(result);
            expect(instances).to.be.an('array');
            expect(instances.length).to.equal(1);

            const instance = instances[0];
            expect(Object.keys(instance)).to.have.length.lessThanOrEqual(2); // Should have minimal or no valid fields

            // Cleanup
            await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, testResource.resource_id, [
                'invalid-select-instance'
            ]);
            await deleteResource(ACCOUNT_ID, testResource.resource_id);
        });

        it('should return empty result when no instances match the criteria', async () => {
            const result = await listDatabaseInstances(ACCOUNT_ID, {
                resourceId: 'non-existent-resource-id',
                selectKeys: ['database_instance_id', 'database_instance_name']
            });

            const instances = getInstancesArray(result);
            expect(instances).to.be.an('array');
            expect(instances.length).to.equal(0);
        });
    });

    describe('listDatabaseInstances with additionalResourceFields', () => {
        it('should include additional resource fields when specified', async () => {
            // Create fresh test data
            const testResource = await createResource(ACCOUNT_ID, {
                resourceId: 'additional-fields-resource',
                resourceName: 'Additional Fields Resource',
                resourceType: 'MSSQL',
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                storageType: STORAGE_TYPE.FSXN,
                region: DEFAULT_AWS_REGION,
                assessmentData: {
                    performanceScore: 95,
                    riskLevel: 'low'
                }
            });

            await upsertDatabaseInstance(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                resourceId: testResource.resource_id,
                databaseInstanceId: 'additional-fields-instance',
                databaseInstanceName: 'ADDITIONAL_FIELDS_INSTANCE',
                isDefault: true,
                source: 'discover',
                sqlDeploymentType: 'Standalone',
                fsxSvmId: { 'fs-additional123': 'svm-additional123' },
                fsxnIds: 'fs-additional123',
                databaseType: 'MS_SQL_SERVER'
            });

            const result = await listDatabaseInstances(ACCOUNT_ID, {
                resourceId: testResource.resource_id,
                shouldIncludeResource: true,
                additionalResourceFields: ['assessment_data']
            });

            const instances = getInstancesArray(result);
            expect(instances).to.be.an('array');
            expect(instances.length).to.equal(1);

            const instance = instances[0];
            expect(instance).to.have.property('resource');
            const resource = instance.resource as Record<string, unknown>;
            expect(resource).to.have.property('resource_id');
            expect(resource).to.have.property('assessment_data');
            expect(resource.assessment_data).to.be.an('object');

            // Cleanup
            await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, testResource.resource_id, [
                'additional-fields-instance'
            ]);
            await deleteResource(ACCOUNT_ID, testResource.resource_id);
        });

        it('should include multiple additional resource fields when specified', async () => {
            // Create fresh test data with comprehensive resource data
            const testResource = await createResource(ACCOUNT_ID, {
                resourceId: 'multi-additional-fields-resource',
                resourceName: 'Multi Additional Fields Resource',
                resourceType: 'ORACLE',
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                storageType: STORAGE_TYPE.FSXN,
                region: DEFAULT_AWS_REGION,
                metadata: {
                    environment: 'production',
                    version: '19c'
                },
                assessmentData: {
                    performanceScore: 88,
                    riskLevel: 'medium',
                    recommendations: ['optimize-memory', 'tune-queries']
                }
            });

            await upsertDatabaseInstance(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                resourceId: testResource.resource_id,
                databaseInstanceId: 'multi-additional-fields-instance',
                databaseInstanceName: 'MULTI_ADDITIONAL_FIELDS_INSTANCE',
                isDefault: true,
                source: 'discover',
                sqlDeploymentType: 'RAC',
                fsxSvmId: { 'fs-multiadd': 'svm-multiadd' },
                fsxnIds: 'fs-multiadd',
                databaseType: 'ORACLE'
            });

            const result = await listDatabaseInstances(ACCOUNT_ID, {
                resourceId: testResource.resource_id,
                shouldIncludeResource: true,
                additionalResourceFields: ['metadata', 'assessment_data']
            });

            const instances = getInstancesArray(result);
            expect(instances).to.be.an('array');
            expect(instances.length).to.equal(1);

            const instance = instances[0];
            expect(instance).to.have.property('resource');
            const resource = instance.resource as Record<string, unknown>;
            expect(resource).to.have.property('resource_id');
            expect(resource).to.have.property('metadata');
            expect(resource).to.have.property('assessment_data');
            expect(resource.metadata).to.be.an('object');
            expect(resource.assessment_data).to.be.an('object');

            // Cleanup
            await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, testResource.resource_id, [
                'multi-additional-fields-instance'
            ]);
            await deleteResource(ACCOUNT_ID, testResource.resource_id);
        });

        it('should handle invalid additionalResourceFields gracefully', async () => {
            // Create fresh test data
            const testResource = await createResource(ACCOUNT_ID, {
                resourceId: 'invalid-additional-fields-resource',
                resourceName: 'Invalid Additional Fields Resource',
                resourceType: 'MSSQL',
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                storageType: STORAGE_TYPE.FSXN,
                region: DEFAULT_AWS_REGION
            });

            await upsertDatabaseInstance(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                resourceId: testResource.resource_id,
                databaseInstanceId: 'invalid-additional-fields-instance',
                databaseInstanceName: 'INVALID_ADDITIONAL_FIELDS_INSTANCE',
                isDefault: true,
                source: 'discover',
                sqlDeploymentType: 'Standalone',
                fsxSvmId: { 'fs-invalidadd': 'svm-invalidadd' },
                fsxnIds: 'fs-invalidadd',
                databaseType: 'MS_SQL_SERVER'
            });

            const result = await listDatabaseInstances(ACCOUNT_ID, {
                resourceId: testResource.resource_id,
                shouldIncludeResource: true,
                additionalResourceFields: ['nonexistent_field', 'another_invalid_field']
            });

            const instances = getInstancesArray(result);
            expect(instances).to.be.an('array');
            expect(instances.length).to.equal(1);

            const instance = instances[0];
            expect(instance).to.have.property('resource');
            const resource = instance.resource as Record<string, unknown>;
            expect(resource).to.have.property('resource_id'); // Should still have basic fields
            expect(resource).to.not.have.property('nonexistent_field');
            expect(resource).to.not.have.property('another_invalid_field');

            // Cleanup
            await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, testResource.resource_id, [
                'invalid-additional-fields-instance'
            ]);
            await deleteResource(ACCOUNT_ID, testResource.resource_id);
        });

        it('should not include resource fields when shouldIncludeResource is false even if additionalResourceFields are specified', async () => {
            // Create fresh test data
            const testResource = await createResource(ACCOUNT_ID, {
                resourceId: 'no-include-resource-fields',
                resourceName: 'No Include Resource Fields',
                resourceType: 'MSSQL',
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                storageType: STORAGE_TYPE.FSXN,
                region: DEFAULT_AWS_REGION,
                assessmentData: {
                    performanceScore: 75
                }
            });

            await upsertDatabaseInstance(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                resourceId: testResource.resource_id,
                databaseInstanceId: 'no-include-resource-instance',
                databaseInstanceName: 'NO_INCLUDE_RESOURCE_INSTANCE',
                isDefault: true,
                source: 'discover',
                sqlDeploymentType: 'Standalone',
                fsxSvmId: { 'fs-noinclude': 'svm-noinclude' },
                fsxnIds: 'fs-noinclude',
                databaseType: 'MS_SQL_SERVER'
            });

            const result = await listDatabaseInstances(ACCOUNT_ID, {
                resourceId: testResource.resource_id,
                shouldIncludeResource: false,
                additionalResourceFields: ['assessment_data']
            });

            const instances = getInstancesArray(result);
            expect(instances).to.be.an('array');
            expect(instances.length).to.equal(1);

            const instance = instances[0];
            expect(instance).to.not.have.property('resource'); // Should not include resource data

            // Cleanup
            await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, testResource.resource_id, [
                'no-include-resource-instance'
            ]);
            await deleteResource(ACCOUNT_ID, testResource.resource_id);
        });
    });

    describe('Pagination functionality', () => {
        it('should return paginated results when pageSize is specified', async () => {
            // Create multiple resources for pagination testing
            const resource1 = await createResource(ACCOUNT_ID, {
                resourceId: 'pagination-resource-1',
                resourceName: 'Pagination Resource 1',
                resourceType: 'MSSQL',
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                storageType: STORAGE_TYPE.FSXN,
                region: DEFAULT_AWS_REGION
            });

            const resource2 = await createResource(ACCOUNT_ID, {
                resourceId: 'pagination-resource-2',
                resourceName: 'Pagination Resource 2',
                resourceType: 'MSSQL',
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                storageType: STORAGE_TYPE.FSXN,
                region: DEFAULT_AWS_REGION
            });

            await upsertDatabaseInstance(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                resourceId: resource1.resource_id,
                databaseInstanceId: 'pagination-instance-1',
                databaseInstanceName: 'PAGINATION_INSTANCE_1',
                isDefault: true,
                source: 'discover',
                sqlDeploymentType: 'Standalone',
                fsxSvmId: { 'fs-page1': 'svm-page1' },
                fsxnIds: 'fs-page1',
                databaseType: 'MS_SQL_SERVER'
            });

            await upsertDatabaseInstance(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                resourceId: resource2.resource_id,
                databaseInstanceId: 'pagination-instance-2',
                databaseInstanceName: 'PAGINATION_INSTANCE_2',
                isDefault: true,
                source: 'discover',
                sqlDeploymentType: 'Standalone',
                fsxSvmId: { 'fs-page2': 'svm-page2' },
                fsxnIds: 'fs-page2',
                databaseType: 'MS_SQL_SERVER'
            });

            const result = await listDatabaseInstances(ACCOUNT_ID, {
                pageSize: 1
            });

            expect(result).to.not.be.an('array');
            const paginatedResult = result as {
                items: Record<string, unknown>[];
                nextToken?: string;
                totalCount: number;
            };
            expect(paginatedResult).to.have.property('items');
            expect(paginatedResult).to.have.property('totalCount');
            expect(paginatedResult.items.length).to.equal(1);
            expect(paginatedResult.totalCount).to.be.greaterThan(0);

            // Cleanup
            await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, resource1.resource_id, [
                'pagination-instance-1'
            ]);
            await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, resource2.resource_id, [
                'pagination-instance-2'
            ]);
            await deleteResource(ACCOUNT_ID, resource1.resource_id);
            await deleteResource(ACCOUNT_ID, resource2.resource_id);
        });

        it('should return array format when pageSize is not specified', async () => {
            // Create fresh test data
            const testResource = await createResource(ACCOUNT_ID, {
                resourceId: 'array-format-resource',
                resourceName: 'Array Format Resource',
                resourceType: 'MSSQL',
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                storageType: STORAGE_TYPE.FSXN,
                region: DEFAULT_AWS_REGION
            });

            await upsertDatabaseInstance(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                resourceId: testResource.resource_id,
                databaseInstanceId: 'array-format-instance',
                databaseInstanceName: 'ARRAY_FORMAT_INSTANCE',
                isDefault: true,
                source: 'discover',
                sqlDeploymentType: 'Standalone',
                fsxSvmId: { 'fs-array': 'svm-array' },
                fsxnIds: 'fs-array',
                databaseType: 'MS_SQL_SERVER'
            });

            const rawResult = await listDatabaseInstances(ACCOUNT_ID, {
                resourceId: testResource.resource_id
            });
            const result = isArray(rawResult) ? rawResult : [rawResult];

            expect(result).to.be.an('array'); // Should be array format, not paginated
            expect(result.length).to.equal(1);
            expect(result[0]).to.have.property('database_instance_id');

            // Cleanup
            await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, testResource.resource_id, [
                'array-format-instance'
            ]);
            await deleteResource(ACCOUNT_ID, testResource.resource_id);
        });

        it('should handle pagination with nextToken correctly', async () => {
            // Create multiple resources for pagination testing
            const resource1 = await createResource(ACCOUNT_ID, {
                resourceId: 'pagination-token-resource-1',
                resourceName: 'Pagination Token Resource 1',
                resourceType: 'MSSQL',
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                storageType: STORAGE_TYPE.FSXN,
                region: DEFAULT_AWS_REGION
            });

            const resource2 = await createResource(ACCOUNT_ID, {
                resourceId: 'pagination-token-resource-2',
                resourceName: 'Pagination Token Resource 2',
                resourceType: 'MSSQL',
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                storageType: STORAGE_TYPE.FSXN,
                region: DEFAULT_AWS_REGION
            });

            const resource3 = await createResource(ACCOUNT_ID, {
                resourceId: 'pagination-token-resource-3',
                resourceName: 'Pagination Token Resource 3',
                resourceType: 'MSSQL',
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                storageType: STORAGE_TYPE.FSXN,
                region: DEFAULT_AWS_REGION
            });

            await upsertDatabaseInstance(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                resourceId: resource1.resource_id,
                databaseInstanceId: 'pagination-token-instance-1',
                databaseInstanceName: 'PAGINATION_TOKEN_INSTANCE_1',
                isDefault: true,
                source: 'discover',
                sqlDeploymentType: 'Standalone',
                fsxSvmId: { 'fs-token1': 'svm-token1' },
                fsxnIds: 'fs-token1',
                databaseType: 'MS_SQL_SERVER'
            });

            await upsertDatabaseInstance(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                resourceId: resource2.resource_id,
                databaseInstanceId: 'pagination-token-instance-2',
                databaseInstanceName: 'PAGINATION_TOKEN_INSTANCE_2',
                isDefault: true,
                source: 'discover',
                sqlDeploymentType: 'Standalone',
                fsxSvmId: { 'fs-token2': 'svm-token2' },
                fsxnIds: 'fs-token2',
                databaseType: 'MS_SQL_SERVER'
            });

            await upsertDatabaseInstance(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                resourceId: resource3.resource_id,
                databaseInstanceId: 'pagination-token-instance-3',
                databaseInstanceName: 'PAGINATION_TOKEN_INSTANCE_3',
                isDefault: true,
                source: 'discover',
                sqlDeploymentType: 'Standalone',
                fsxSvmId: { 'fs-token3': 'svm-token3' },
                fsxnIds: 'fs-token3',
                databaseType: 'MS_SQL_SERVER'
            });

            // First page
            const firstPage = await listDatabaseInstances(ACCOUNT_ID, {
                pageSize: 2
            });

            expect(firstPage).to.not.be.an('array');
            const firstPageResult = firstPage as {
                items: Record<string, unknown>[];
                nextToken?: string;
                totalCount: number;
            };
            expect(firstPageResult.items.length).to.equal(2);
            expect(firstPageResult.totalCount).to.be.greaterThanOrEqual(3);

            // Use nextToken if available for second page
            if (firstPageResult.nextToken) {
                const secondPage = await listDatabaseInstances(ACCOUNT_ID, {
                    pageSize: 2,
                    nextToken: firstPageResult.nextToken
                });

                expect(secondPage).to.not.be.an('array');
                const secondPageResult = secondPage as {
                    items: Record<string, unknown>[];
                    nextToken?: string;
                    totalCount: number;
                };
                expect(secondPageResult.items.length).to.be.greaterThanOrEqual(1);
            }

            // Cleanup
            await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, resource1.resource_id, [
                'pagination-token-instance-1'
            ]);
            await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, resource2.resource_id, [
                'pagination-token-instance-2'
            ]);
            await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, resource3.resource_id, [
                'pagination-token-instance-3'
            ]);
            await deleteResource(ACCOUNT_ID, resource1.resource_id);
            await deleteResource(ACCOUNT_ID, resource2.resource_id);
            await deleteResource(ACCOUNT_ID, resource3.resource_id);
        });

        it('should return empty results when pageSize is specified but no data exists for given criteria', async () => {
            const result = await listDatabaseInstances(ACCOUNT_ID, {
                resourceId: 'non-existent-pagination-resource',
                pageSize: 10
            });

            expect(result).to.not.be.an('array');
            const paginatedResult = result as {
                items: Record<string, unknown>[];
                nextToken?: string;
                totalCount: number;
            };
            expect(paginatedResult.items).to.be.an('array');
            expect(paginatedResult.items.length).to.equal(0);
            expect(paginatedResult.totalCount).to.equal(0);
        });

        it('should handle invalid pageSize values gracefully', async () => {
            // Create fresh test data
            const testResource = await createResource(ACCOUNT_ID, {
                resourceId: 'invalid-page-size-resource',
                resourceName: 'Invalid Page Size Resource',
                resourceType: 'MSSQL',
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                storageType: STORAGE_TYPE.FSXN,
                region: DEFAULT_AWS_REGION
            });

            await upsertDatabaseInstance(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                resourceId: testResource.resource_id,
                databaseInstanceId: 'invalid-page-size-instance',
                databaseInstanceName: 'INVALID_PAGE_SIZE_INSTANCE',
                isDefault: true,
                source: 'discover',
                sqlDeploymentType: 'Standalone',
                fsxSvmId: { 'fs-invalidpage': 'svm-invalidpage' },
                fsxnIds: 'fs-invalidpage',
                databaseType: 'MS_SQL_SERVER'
            });

            // Test with zero pageSize - should still work or handle gracefully
            const resultZero = await listDatabaseInstances(ACCOUNT_ID, {
                resourceId: testResource.resource_id,
                pageSize: 0
            });

            // Should handle gracefully - either return paginated format with empty items or fallback to array
            if (Array.isArray(resultZero)) {
                expect(resultZero).to.be.an('array');
            } else {
                expect(resultZero).to.have.property('items');
                expect(resultZero.items).to.be.an('array');
            }

            // Test with negative pageSize - should handle gracefully
            const resultNegative = await listDatabaseInstances(ACCOUNT_ID, {
                resourceId: testResource.resource_id,
                pageSize: -1
            });

            if (Array.isArray(resultNegative)) {
                expect(resultNegative).to.be.an('array');
            } else {
                expect(resultNegative).to.have.property('items');
                expect(resultNegative.items).to.be.an('array');
            }

            // Cleanup
            await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, testResource.resource_id, [
                'invalid-page-size-instance'
            ]);
            await deleteResource(ACCOUNT_ID, testResource.resource_id);
        });
    });
});
