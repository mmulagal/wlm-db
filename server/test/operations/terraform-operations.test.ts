import {
    createAndUploadTheTerraformZipFile,
    uploadTerraformModules,
    createTFVarsFile
} from '../../src/operations/terraform-operations';
import '../simulator/scopes/aws/s3-scope';
import '../simulator/scopes/aws/ec2-scope';
import '../simulator/scopes/aws/iam-scope';
import '../simulator/scopes/aws/secrets-manager-scope';
import '../simulator/scopes/aws/cloud-formation-scope';
import '../simulator/scopes/aws/kms-scope';
import '../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../simulator/scopes/aws/service-quota-scope';
import '../simulator/scopes/opentelemetry-scope';
import '../simulator/scopes/jwt-scope';
import '../simulator/scopes/cloud-manager/wlmdb-scope';
import { DEFAULT_AWS_REGION } from '../utils/consts';
import { DatabaseTypes } from '../../src/utils/consts';

describe('terraform operations', () => {
    it('upload terraform modules', async () => {
        const resp = await uploadTerraformModules(
            DEFAULT_AWS_REGION,
            DatabaseTypes.MS_SQL_SERVER,
            'standalone',
            'test-deployment'
        );
        expect(resp).toBeDefined();
    });

    it('create tf vars file', async () => {
        const resp = await createTFVarsFile(
            DEFAULT_AWS_REGION,
            DatabaseTypes.MS_SQL_SERVER,
            'test-deployment',
            'test-path',
            [],
            [{ name: 'test-url', url: 'www.test.com' }]
        );
        expect(resp).toBeDefined();
    });

    it('Create and upload the terraform zip file', async () => {
        const resp = await createAndUploadTheTerraformZipFile(
            DEFAULT_AWS_REGION,
            DatabaseTypes.MS_SQL_SERVER,
            'test-deployment',
            'test-path'
        );
        expect(resp).toBeDefined();
    });
});
