import '../../simulator/scopes/aws/fsx-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/opentelemetry-scope';
import { faker } from '@faker-js/faker';
import { ListTagsForResourceCommandInput } from '@aws-sdk/client-fsx';
import fsxFilesystems from '../../simulator/responses/aws/list-fsx-filesystems.json';
import fsxVolumes from '../../simulator/responses/aws/list-fsx-volumes.json';
import fsxSvms from '../../simulator/responses/aws/list-fsx-svms.json';
import fsxnBackups from '../../simulator/responses/aws/list-fsxn-backups.json';
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
    createTag
} from '../../../src/lib/aws/fsx';
import { DEFAULT_AWS_CREDENTIALS_TYPE, ACCOUNT_ID } from '../../utils/consts';

const FSX_FILESYSTEM_ID = 'fs-03773e21b2f0e39b4';
const VOLUME_ID = 'fsvol-06184c131ec936380';
const fsxArn = `arn:aws:res:${DEFAULT_AWS_REGION}:${faker.number.int(8)}:res/${FSX_FILESYSTEM_ID}`;
const tag = [{ Key: 'key', Value: 'value' }];

describe('Testcases for Amazon FSx resources', () => {
    it('List FSx Filesystems', async () => {
        const response = await describeFSxFileSystems(DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION);
        expect(response).toEqual(fsxFilesystems.FileSystems);
    });

    it('List FSx Volumes', async () => {
        const response = await describeFSxVolumes(DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION, FSX_FILESYSTEM_ID);
        expect(response.Volumes).toEqual(fsxVolumes.Volumes);
    });

    it('List FSx SVMs', async () => {
        const response = await describeFSxStorageVirtualMachines(
            DEFAULT_AWS_CREDENTIALS_TYPE,
            DEFAULT_AWS_REGION,
            FSX_FILESYSTEM_ID
        );
        expect(response).toEqual(fsxSvms);
    });

    it('List FSx Netapp Volume Backups', async () => {
        const response = await describeFSxBackups(DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION, {
            Filters: [
                {
                    Name: 'volume-id',
                    Values: [VOLUME_ID]
                }
            ]
        });
        expect(response).toEqual(fsxnBackups);
    });

    it('List FSx windows Backups', async () => {
        const response = await describeFSxBackups(DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION, {
            Filters: [
                {
                    Name: 'file-system-id',
                    Values: [FSX_FILESYSTEM_ID]
                }
            ]
        });
        expect(response).toEqual(fsxwBackups);
    });

    it('Describe a FSxN filesystem', async () => {
        const response = await describeFSx(DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION, {
            FileSystemIds: [FSX_FILESYSTEM_ID]
        });

        expect(response).toEqual(fsxFilesystems.FileSystems[0]);
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
});
