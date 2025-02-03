import { faker } from '@faker-js/faker';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/aws/ssm-scope';
import '../../simulator/scopes/aws/ec2-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import {
    getAvailablePatches,
    getInstancesPatchStatus,
    runAwsPatchBaseline,
    getInstalledSQLPatchDetails,
    getTheMSSqlversion
} from '../../../src/operations/aws/ospatch-ssm-operations';

const credentialsId = `${faker.string.alpha(20)}`;

describe('OS Patch SSM operations', () => {
    it('Should run AWS patch baseline assessment', async () => {
        const instanceIds = ['i-test-ec2-1', 'i-test-ec2-2', 'i-test-ec2-3'];
        const response = await runAwsPatchBaseline(credentialsId, 'us-east-1', instanceIds);
        const allResponsesSucceeded = response?.every(({ response: { Status } = {} }) => Status === 'Success');
        expect(allResponsesSucceeded).toBeTruthy();
    });

    it('Get instances patch states', async () => {
        const instanceIds = ['i-test-ec2-1', 'i-test-ec2-2', 'i-test-ec2-3'];
        const response = await getInstancesPatchStatus(credentialsId, 'us-east-1', instanceIds);
        expect(response?.length).toEqual(instanceIds.length);
    });

    it('Get available patches', async () => {
        const instanceIds = ['i-test-ec2-1', 'i-test-ec2-2'];
        const response = await getAvailablePatches(credentialsId, 'us-east-1', instanceIds);
        expect(response?.length).toBeGreaterThan(0);
    });

    it('Get installed SQL patch details', async () => {
        const instanceIds = ['i-test-ec2-1', 'i-test-ec2-2'];
        const response = await getInstalledSQLPatchDetails(credentialsId, 'us-east-1', instanceIds);
        expect(response?.length).toEqual(instanceIds.length);
    });

    it('Get the MSSQL version', async () => {
        const instanceId = 'i-test-ec2-1';
        const response = await getTheMSSqlversion(credentialsId, 'us-east-1', instanceId);
        expect(response).toMatch(/20\d{2}/);
    });
});
