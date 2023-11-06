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
    isAWSBackupEnabled
} from '../../../src/operations/aws/fsx-operations';
import { DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_VPC_ID } from '../../utils/consts';

const FSX_FILESYSTEM_ID = 'fs-03773e21b2f0e39b4';
const FSX_SECRET = 'wlmdb-fsx1698373976113';

describe('Testcases for Amazon FSx resources operations', () => {
    it('List FSx filesystems and volume details', async () => {
        const response = await getFSxFileSystemsList(
            DEFAULT_AWS_CREDENTIALS_TYPE,
            DEFAULT_AWS_REGION,
            DEFAULT_AWS_VPC_ID
        );

        expect(response).toBeDefined();
    });

    it('AWS backup enabled check', async () => {
        const response = await isAWSBackupEnabled(DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION, FSX_FILESYSTEM_ID, {
            credentialsId: '', activeNodeInstanceId: '', standbyNodeInstanceId: '', fsxSecret: ''
        });
        expect(response).toEqual(true);
    });

    it('Get Ontap volume snapshots count', async () => {
        const response = await getOntapVolumesSnapshotCount(
            DEFAULT_AWS_CREDENTIALS_TYPE,
            DEFAULT_AWS_REGION,
            FSX_FILESYSTEM_ID,
            {
                credentialsId: '', activeNodeInstanceId: '', standbyNodeInstanceId: '', fsxSecret: ''
            }
        );
        expect(response).toBeDefined();
    });
});
