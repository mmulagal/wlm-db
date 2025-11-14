import { listFsxOntapCredentials, registerFsxOntapCredentials } from '../../../src/lib/cloud-manager/fsx-core';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';

describe('FSX core lib', () => {
    it('List FSx for ONTAP credentials', async () => {
        const response = await listFsxOntapCredentials(ACCOUNT_ID, 'fs-0f32f6c69fb7e40ac');
        expect(response.credentials).toBeDefined();
    });

    it('Register FSx for ONTAP credentials', async () => {
        const response = await registerFsxOntapCredentials(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            'fs-0f32f6c69fb7e40ac',
            'netapp1!'
        );
        // Workaround added till GROGU-5485 is resolved
        expect(response?.ontapCredentialsId).toBeDefined();
    });
});
