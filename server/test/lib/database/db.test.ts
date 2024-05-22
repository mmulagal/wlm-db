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
    DatabaseInstance,
    upsertDatabaseInstanceRecord,
    listDatabaseInstances,
    deleteDatabaseInstanceRecord
} from '../../../src/lib/database/db';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';

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
        const createdResource = resp.find(res => res.resource_id === 'i-1a2b3c4d5e');
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
        const DATABASE_INSTANCE_RECORD: DatabaseInstance = {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            resourceId: '02bff58ecf20c32b5bbf86de997c4296ab9cd45e88d4ff3b3d0c918b7f96a5bx',
            instanceId: 'i-1234abcd',
            instanceName: 'MSSQLSERVER',
            isDefault: true,
            fsxnId: 'fs-0f53fbecdd3d85fb2'
        };

        // Insert a new record
        await upsertDatabaseInstanceRecord(ACCOUNT_ID, DATABASE_INSTANCE_RECORD);
        let response = await listDatabaseInstances(ACCOUNT_ID, { credentialsId: DEFAULT_AWS_CREDENTIALS_ID });
        expect(response.length).toEqual(1);
        expect(response[0].resource_id).toEqual(DATABASE_INSTANCE_RECORD.resourceId);
        expect(response[0].instance_id).toEqual(DATABASE_INSTANCE_RECORD.instanceId);
        expect(response[0].instance_name).toEqual(DATABASE_INSTANCE_RECORD.instanceName);
        expect(response[0].fsxn_id).toEqual(DATABASE_INSTANCE_RECORD.fsxnId);

        // Update previously inserted record
        await upsertDatabaseInstanceRecord(ACCOUNT_ID, {
            credentialsId: DATABASE_INSTANCE_RECORD.credentialsId,
            resourceId: DATABASE_INSTANCE_RECORD.resourceId,
            instanceId: DATABASE_INSTANCE_RECORD.instanceId,
            instanceName: 'NEWNAME',
            isDefault: true,
            fsxnId: 'fs-00001111'
        });
        response = await listDatabaseInstances(ACCOUNT_ID, { credentialsId: DEFAULT_AWS_CREDENTIALS_ID });
        expect(response.length).toEqual(1);
        expect(response[0].resource_id).toEqual(DATABASE_INSTANCE_RECORD.resourceId);
        expect(response[0].instance_id).toEqual(DATABASE_INSTANCE_RECORD.instanceId);
        expect(response[0].instance_name).toEqual('NEWNAME');
        expect(response[0].is_default).toEqual(true);
        expect(response[0].fsxn_id).toEqual('fs-00001111');

        // Delete a non-existing record
        await deleteDatabaseInstanceRecord(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DATABASE_INSTANCE_RECORD.resourceId,
            DATABASE_INSTANCE_RECORD.instanceName
        );
        response = await listDatabaseInstances(ACCOUNT_ID, { credentialsId: DEFAULT_AWS_CREDENTIALS_ID });
        expect(response.length).toEqual(1);

        // Delete an existing record
        await deleteDatabaseInstanceRecord(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DATABASE_INSTANCE_RECORD.resourceId,
            'NEWNAME'
        );
        response = await listDatabaseInstances(ACCOUNT_ID, { credentialsId: DEFAULT_AWS_CREDENTIALS_ID });
        expect(response.length).toEqual(0);
    });
});
