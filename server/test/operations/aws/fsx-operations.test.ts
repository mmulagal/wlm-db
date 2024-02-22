import { faker } from '@faker-js/faker';
import '../../simulator/scopes/aws/ec2-scope';
import '../../simulator/scopes/aws/fsx-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/aws/ssm-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import { DEFAULT_AWS_REGION } from '../../../src/utils/consts';
import {
    getFSxFileSystemsList,
    getOntapVolumesSnapshotCount,
    isAWSBackupEnabled,
    getMappedOntapVolumes,
    tagFsxResource
} from '../../../src/operations/aws/fsx-operations';
import { DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_VPC_ID, ACCOUNT_ID } from '../../utils/consts';

const FSX_FILESYSTEM_ID = 'fs-03773e21b2f0e39b4';
const credentialsId = `${faker.string.alpha(20)}`;
const awsAccountId = `${faker.string.alpha(8)}`;

describe('Testcases for Amazon FSx resources operations', () => {
    // Its not mocked, we are making actual api call to fsx inventory, so headers wont be present to make this test works
    it.skip('List FSx filesystems and volume details', async () => {
        const response = await getFSxFileSystemsList(
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            DEFAULT_AWS_VPC_ID
        );

        expect(response).toBeDefined();
    });

    it('AWS backup enabled check', async () => {
       
        const response = await isAWSBackupEnabled(
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            FSX_FILESYSTEM_ID,
            {
                node1InstanceId: `i-${faker.string.alpha(17)}`,
                node2InstanceId: `i-${faker.string.alpha(17)}`,
                stackname: 'WLMDB-SqlStandaloneStack-1699407080711-fsx'
            },
            `i-${faker.string.alpha(17)}`
        );
        expect(response).toEqual(true);
    });

    it('Get Ontap volume snapshots count', async () => {
        const response = await getOntapVolumesSnapshotCount(
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            FSX_FILESYSTEM_ID,
            {
                node1InstanceId: `i-${faker.string.alpha(17)}`,
                node2InstanceId: `i-${faker.string.alpha(17)}`,
                stackname: 'WLMDB-SqlStandaloneStack-1699407080711-fsx'
            }
        );
        expect(response).toBeDefined();
    });

    it('Get Ontap mapped volumes', async () => {
        const response = await getMappedOntapVolumes(
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            FSX_FILESYSTEM_ID,
            {
                node1InstanceId: `i-${faker.string.alpha(17)}`,
                node2InstanceId: `i-${faker.string.alpha(17)}`,
                stackname: 'WLMDB-SqlStandaloneStack-1699407080711-fsx'
            }
        );
        expect(response).toBeDefined();
    });

    it('Tag Ec2 instance', async () => {
        await expect(
            tagFsxResource(credentialsId, DEFAULT_AWS_REGION, awsAccountId, ACCOUNT_ID, FSX_FILESYSTEM_ID, [
                { Key: 'key', Value: 'value' }
            ])
        ).resolves.not.toThrow();
    });
});
