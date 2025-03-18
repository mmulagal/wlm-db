import { faker } from '@faker-js/faker';
import '../../simulator/scopes/aws/ec2-scope';
import '../../simulator/scopes/aws/fsx-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/aws/ssm-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/cloud-manager/fsx-core-scope';

import { DEFAULT_AWS_REGION, DEFAULT_INSTANCE_NAME } from '../../../src/utils/consts';
import {
    getFSxFileSystemsList,
    getOntapVolumesSnapshotCount,
    isFsxnAwsBackupEnabled,
    getMappedOntapVolumes,
    tagFsxResource,
    isFsxwAwsBackupEnabled,
    updateVolumeSizeAndWaitForUpdate,
    updateFsxBackup
} from '../../../src/operations/aws/fsx-operations';
import { DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_VPC_ID, ACCOUNT_ID } from '../../utils/consts';
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
            `i-${faker.string.alpha(17)}`
        );
        expect(response.master).toEqual(true);
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
        expect(response?.[DEFAULT_INSTANCE_NAME]).toEqual(fsxResponse.volumeMap);
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
                AutomaticBackupRetentionDays: 10,
                DailyAutomaticBackupStartTime: '12:00'
            })
        ).resolves.not.toThrow();
    });
});
