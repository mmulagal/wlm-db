import { faker } from '@faker-js/faker';
import {
    getAvailablePatches,
    getInstalledSQLPatchDetails
} from '../../../src/operations/aws/mssqlPatch-ssm-operations';
import { getTheMSSqlversion } from '../../../src/operations/continuous-optimization/mssql/mssqlPatch-assessment-operations';

const credentialsId = `${faker.string.alpha(20)}`;

describe('MSSQL Patch SSM operations', () => {
    it('Get available patches', async () => {
        const response = await getAvailablePatches(credentialsId, 'us-east-1', 'i-test-ec2-1', '2016');
        expect(response?.length).toBeGreaterThan(0);
    });

    it('Get installed SQL patch details', async () => {
        const instanceIds = ['i-test-ec2-1', 'i-test-ec2-2'];
        const response = await getInstalledSQLPatchDetails(credentialsId, 'us-east-1', instanceIds, 'account-id-123');
        expect(response?.length).toEqual(instanceIds.length);
    });

    it('Get the MSSQL version', async () => {
        const instanceId = 'i-test-ec2-1';
        const { versionYear } = await getTheMSSqlversion(
            credentialsId,
            'us-east-1',
            instanceId,
            false,
            'MSSQLSERVER',
            'account-id-123'
        );
        expect(versionYear).toMatch(/20\d{2}/);
    });
});
