import { faker } from '@faker-js/faker';
import { isEmpty } from 'lodash-es';

import { DEFAULT_AWS_REGION, DEFAULT_INSTANCE_NAME } from '../../../src/utils/consts';
import {
    getFSxFileSystemsList,
    getOntapVolumesSnapshotCount,
    isFsxnAwsBackupEnabled,
    getMappedOntapVolumes,
    tagFsxResource,
    isFsxwAwsBackupEnabled,
    updateVolumeSizeAndWaitForUpdate,
    updateFsxBackup,
    isInstanceAppConsistentBackupEnabled
} from '../../../src/operations/aws/fsx-operations';
import { DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_VPC_ID, ACCOUNT_ID, CREDENTIALS_ID } from '../../utils/consts';
import fsxResponse from '../../simulator/responses/aws/fsx-operations-response.json';

const FSX_FILESYSTEM_ID = 'fs-03773e21b2f0e39b4';
const credentialsId = `${faker.string.alpha(20)}`;
const awsAccountId = `${faker.string.alpha(8)}`;

describe('Testcases for Amazon FSx resources operations', () => {
    // Its not mocked, we are making actual api call to fsx inventory, so headers wont be present to make this test works
    it('List FSx filesystems and volume details', async () => {
        const response = await getFSxFileSystemsList(
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            DEFAULT_AWS_VPC_ID
        );

        expect(response).toBeDefined();
    });

    it('AWS backup enabled check', async () => {
        const response = await isFsxnAwsBackupEnabled(
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            FSX_FILESYSTEM_ID,
            fsxResponse.volumeMap.volumeRecords.map(v => v.uuid),
            fsxResponse.volumeMap.volumeDBMap,
            `i-${faker.string.fromCharacters('abcdef0123456789', 17)}`
        );
        expect(response?.volumeDBMapWithBackupFlag.master).toEqual(true);
    });

    it('Get Ontap volume snapshots count', async () => {
        const response = await getOntapVolumesSnapshotCount(
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            FSX_FILESYSTEM_ID,
            fsxResponse.volumeMap.volumeRecords,
            fsxResponse.volumeMap.volumeDBMap
        );
        expect(response.master).toBeTruthy();
    });

    it('Get Ontap mapped volumes', async () => {
        const response = await getMappedOntapVolumes(
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            FSX_FILESYSTEM_ID,
            false,
            undefined,
            [DEFAULT_INSTANCE_NAME]
        );

        const fsxVolumeIds = response?.[DEFAULT_INSTANCE_NAME]?.volumeRecords?.filter(
            ({ fsxVolumeId }: { fsxVolumeId?: string }) => Boolean(fsxVolumeId)
        );

        expect(fsxVolumeIds?.length).toBeGreaterThan(0);
        expect(response?.[DEFAULT_INSTANCE_NAME]).toBeDefined();
    });

    it('Tag Ec2 instance', async () => {
        await expect(
            tagFsxResource(credentialsId, DEFAULT_AWS_REGION, awsAccountId, ACCOUNT_ID, FSX_FILESYSTEM_ID, [
                { Key: 'key', Value: 'value' }
            ])
        ).resolves.not.toThrow();
    });

    it('Check if FSX for Windows AWS backup available', async () => {
        const response = await isFsxwAwsBackupEnabled(
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            FSX_FILESYSTEM_ID
        );
        expect(response).toEqual(true);
    });

    it('Update FSx volume and wait for update', async () => {
        try {
            await updateVolumeSizeAndWaitForUpdate(
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                ACCOUNT_ID,
                FSX_FILESYSTEM_ID,
                'fsvol-0b1b3b3b3b3b3b3b3',
                1048576
            );
        } catch (error) {
            expect(error).toBeUndefined();
        }
    });

    it('Update FSxN backup', async () => {
        await expect(
            updateFsxBackup(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION, FSX_FILESYSTEM_ID, {
                automaticBackupRetentionDays: 10,
                dailyAutomaticBackupStartTime: '10:00'
            })
        ).resolves.not.toThrow();
    });

    it('should test app consistent backup', async () => {
        const volumeDBMap: Array<{ ontapVolumeuuid: string; databaseName: string }> = [
            { ontapVolumeuuid: 'ad251a8f-da34-11ef-b315-11b9ce95d982', databaseName: 'salesdb' },
            { ontapVolumeuuid: '74a8a789-c5dd-11ef-b315-11b9ce95d982', databaseName: 'inventory' },
            { ontapVolumeuuid: '438cc269-edeb-11ef-994b-3b81e03bea3e', databaseName: 'analytics' }
        ];
        const volUuids = [
            'ad251a8f-da34-11ef-b315-11b9ce95d982',
            '74a8a789-c5dd-11ef-b315-11b9ce95d982',
            '438cc269-edeb-11ef-994b-3b81e03bea3e'
        ];
        const res = await isInstanceAppConsistentBackupEnabled(
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            'fs-4242424242',
            volUuids,
            volumeDBMap,
            'i-4242424242'
        );
        expect(res).toBeDefined();
        if (res && !isEmpty(res)) {
            expect(Object.values(res).every(Boolean)).toBe(true);
        }
    });
});
