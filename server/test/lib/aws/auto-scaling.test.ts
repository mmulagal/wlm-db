import { faker } from '@faker-js/faker';
import describeAutoscalingInstances from '../../../src/lib/aws/auto-scaling';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/aws/ec2-scope';
import '../../simulator/scopes/opentelemetry-scope';
import { ACCOUNT_ID, DEFAULT_AWS_REGION } from '../../utils/consts';

describe('Auto scaling Lib', () => {
    const CREDENTIALS_ID = `${faker.string.alpha(20)}`;
    it('should return a list of Auto Scaling Instances', async () => {
        const params = {
            InstanceIds: ['i-1234567890abcdef0']
        };
        const resp = await describeAutoscalingInstances(CREDENTIALS_ID, DEFAULT_AWS_REGION, ACCOUNT_ID, params);
        expect(resp.AutoScalingInstances).toBeDefined();
    });
});
