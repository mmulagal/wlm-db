import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../utils/consts';
import {
    checkScriptNeedsUpdate,
    getFileSystemCredentialsStatus,
    getFileSystemsCredentialsStatus,
    getManagedResources
} from '../../src/operations/resource-operations';
import { createResource, deleteResource } from '../../src/lib/database/db';

beforeAll(async () => {
    await createResource(ACCOUNT_ID, {
        resourceId: '36E53042-04E8-40C9-AE69-26E56CB0D216',
        resourceName: 'test-resource',
        resourceType: 'MSSQL',
        coRelationId: 'fs-f6082f35c1db',
        cloudProviderAccountId: 'test-aws-account',
        cloudProviderName: 'AWS',
        region: 'ap-southeast-1',
        credentialsId: 'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
        storageType: 'FSXN',
        metadata: {
            node1InstanceId: 'i-07e76a4b916548dc0',
            node2InstanceId: 'i-0880a21327284f67c'
        }
    });
});

afterAll(async () => {
    await deleteResource(ACCOUNT_ID, '36E53042-04E8-40C9-AE69-26E56CB0D216');
    await deleteResource(ACCOUNT_ID, 'fs-f6082f35c1db');
});

describe('Resource operations', () => {
    it('Get single file system credentials status', async () => {
        const expected = {
            id: 'fs-0f32f6c69fb7e40ac',
            isRegistered: true
        };
        const response = await getFileSystemCredentialsStatus(ACCOUNT_ID, 'fs-0f32f6c69fb7e40ac');
        expect(response).toEqual(expected);
    });

    it('Get file systems credentials status', async () => {
        const expected = {
            fileSystems: [
                {
                    id: 'fs-0f32f6c69fb7e40ac',
                    isRegistered: true
                },
                {
                    id: 'fs-0f32f6c69fb7e40ad',
                    isRegistered: true
                }
            ]
        };

        const response = await getFileSystemsCredentialsStatus(ACCOUNT_ID, 'fs-0f32f6c69fb7e40ac,fs-0f32f6c69fb7e40ad');
        expect(response).toEqual(expected);
    });

    it('Get managed database-hosts', async () => {
        const expected = {
            items: [
                {
                    resourceId: '36E53042-04E8-40C9-AE69-26E56CB0D216',
                    instances: ['i-07e76a4b916548dc0', 'i-0880a21327284f67c'],
                    credentialId: 'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
                    region: 'ap-southeast-1',
                    databaseType: 'MSSQL'
                }
            ],
            count: 1,
            nextToken: undefined
        };

        const resp = await getManagedResources(ACCOUNT_ID, 'f6082f35-c1db-4619-bb5c-84bcb5bf3286', 'ap-southeast-1');

        expect(resp).toEqual(expected);
    });

    it('Check if scripts need update', async () => {
        const response = await checkScriptNeedsUpdate(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            'i-07e76a4b916548dc0'
        );
        expect(response).toBe(false);
    });
});
