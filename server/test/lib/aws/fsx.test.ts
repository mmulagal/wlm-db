import { faker } from '@faker-js/faker';
import { ListTagsForResourceCommandInput } from '@aws-sdk/client-fsx';
import { beforeEach } from 'vitest';
import {
    fsxnBackupWithModifiedCreationTime,
    resetFsxSimulatorBackupRetention
} from '../../simulator/scopes/aws/fsx-scope';
import fsxFilesystems from '../../simulator/responses/aws/list-fsx-filesystems.json';
import fsxVolumes from '../../simulator/responses/aws/list-fsx-volumes.json';
import fsxSvms from '../../simulator/responses/aws/list-fsx-svms.json';
import fsxwBackups from '../../simulator/responses/aws/list-fsxw-backups.json';
import fsxResourceTagsResponse from '../../simulator/responses/aws/list-fsx-resource-tags.json';
import { DEFAULT_AWS_REGION } from '../../../src/utils/consts';
import {
    describeFSxFileSystems,
    describeFSxVolumes,
    describeFSxStorageVirtualMachines,
    describeFSxBackups,
    describeFSx,
    listResourceTags,
    createTag,
    updateFileSystem
} from '../../../src/lib/aws/fsx';
import { DEFAULT_AWS_CREDENTIALS_TYPE, ACCOUNT_ID } from '../../utils/consts';

const FSX_FILESYSTEM_ID = 'fs-03773e21b2f0e39b4';
const VOLUME_ID = 'fsvol-06184c131ec936380';
const fsxArn = `arn:aws:res:${DEFAULT_AWS_REGION}:${faker.number.int(8)}:res/${FSX_FILESYSTEM_ID}`;
const tag = [{ Key: 'key', Value: 'value' }];

describe('Testcases for Amazon FSx resources', () => {
    // FSx simulator retains UpdateFileSystem state in a module Map; reset so tests stay isolated (incl. parallel workers).
    beforeEach(() => {
        resetFsxSimulatorBackupRetention();
    });

    it('List FSx Filesystems', async () => {
        const response = await describeFSxFileSystems(DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION, {
            useCache: true
        });
        expect(response).toEqual(fsxFilesystems.FileSystems);
    });

    it('List FSx Volumes', async () => {
        const response = await describeFSxVolumes(DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION, [
            FSX_FILESYSTEM_ID
        ]);
        expect(response.Volumes).toEqual(fsxVolumes.Volumes);
    });

    it('List FSx SVMs', async () => {
        const response = await describeFSxStorageVirtualMachines(
            DEFAULT_AWS_CREDENTIALS_TYPE,
            DEFAULT_AWS_REGION,
            [FSX_FILESYSTEM_ID],
            { useCache: true }
        );
        expect(response).toEqual(fsxSvms);
    });

    it('List FSx Netapp Volume Backups', async () => {
        const response = await describeFSxBackups(
            DEFAULT_AWS_CREDENTIALS_TYPE,
            DEFAULT_AWS_REGION,
            {
                Filters: [
                    {
                        Name: 'volume-id',
                        Values: [VOLUME_ID]
                    }
                ]
            },
            undefined,
            { useCache: true }
        );
        expect(response).toEqual(fsxnBackupWithModifiedCreationTime);
    });

    it('List FSx windows Backups', async () => {
        const response = await describeFSxBackups(
            DEFAULT_AWS_CREDENTIALS_TYPE,
            DEFAULT_AWS_REGION,
            {
                Filters: [
                    {
                        Name: 'file-system-id',
                        Values: [FSX_FILESYSTEM_ID]
                    }
                ]
            },
            undefined,
            { useCache: true }
        );
        expect(response).toEqual(fsxwBackups);
    });

    it('Describe a FSxN filesystem', async () => {
        const response = await describeFSx(
            DEFAULT_AWS_CREDENTIALS_TYPE,
            DEFAULT_AWS_REGION,
            {
                FileSystemIds: [FSX_FILESYSTEM_ID]
            },
            undefined,
            { useCache: true }
        );

        expect(response.FileSystems).toHaveLength(1);
        expect(response.FileSystems?.[0]).toMatchObject(fsxFilesystems.FileSystems[0]);
    });

    it('List Fsx resource tags', async () => {
        const input: ListTagsForResourceCommandInput = {
            ResourceARN: 'Resouce_ARN'
        };
        const response = await listResourceTags(DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION, input);
        expect(response).toEqual(fsxResourceTagsResponse);
    });

    it('Create tag for given fsx resource', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        await expect(createTag(credentialsId, DEFAULT_AWS_REGION, ACCOUNT_ID, fsxArn, tag)).resolves.not.toThrow();
    });

    it('Update FileSystem', async () => {
        await expect(
            updateFileSystem(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION, {
                FileSystemId: FSX_FILESYSTEM_ID,
                OntapConfiguration: {
                    AutomaticBackupRetentionDays: 10,
                    DailyAutomaticBackupStartTime: '10:00'
                }
            })
        ).toBeDefined();
    });
});
