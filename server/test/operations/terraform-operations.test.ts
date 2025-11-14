import {
    createAndUploadTheTerraformZipFile,
    uploadTerraformModules,
    createTFVarsFile
} from '../../src/operations/terraform-operations';
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
