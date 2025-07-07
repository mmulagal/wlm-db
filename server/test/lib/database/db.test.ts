import { STORAGE_TYPE } from '@prisma/client';
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
    updateResource,
    listDatabaseInstancesPaginated
} from '../../../src/lib/database/db';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';
import { DatabaseInstanceRecord } from '../../../src/lib/database/db-types';

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
        const resp = await listResources(ACCOUNT_ID);
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
        let response = await listDatabaseInstances(ACCOUNT_ID, {});
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
        response = await listDatabaseInstances(ACCOUNT_ID, {});
        expect(response.length).toEqual(1);
        expect(response[0].resource_id).toEqual(DATABASE_INSTANCE_RECORD.resourceId);
        expect(response[0].database_instance_id).toEqual(DATABASE_INSTANCE_RECORD.databaseInstanceId);
        expect(response[0].is_default).toEqual(true);
        expect(response[0].fsxn_ids).toEqual('fs-00001111');

        // Delete a non-existing record
        await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DATABASE_INSTANCE_RECORD.resourceId, [
            'non-existing-instance'
        ]);
        response = await listDatabaseInstances(ACCOUNT_ID, {});
        expect(response.length).toEqual(1);

        const managedInstances = await listDatabaseInstances();
        expect(managedInstances.length).toBeGreaterThan(0);
        expect(managedInstances[0].resource.id).toBeDefined();

        // Delete an existing record
        await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DATABASE_INSTANCE_RECORD.resourceId, [
            DATABASE_INSTANCE_RECORD.databaseInstanceId
        ]);
        response = await listDatabaseInstances(ACCOUNT_ID, {});
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
        const page1 = await listDatabaseInstancesPaginated(ACCOUNT_ID, { resourceId: resource.resource_id }, pageSize);
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
