import '../../../simulator/scopes/aws/ssm-scope';
import '../../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../../simulator/scopes/aws/fsx-scope';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import { createResource, deleteResource, upsertDatabaseInstance } from '../../../../src/lib/database/db';
import {
    fetchOracleDriftAssessment,
    onDemandTriggerOracleDriftAssessment
} from '../../../../src/operations/continuous-optimization/oracle/assessment-operations';
import { AssessmentTriggeredBy } from '../../../../src/utils/continous-optimization-consts';

const credentialsId = DEFAULT_AWS_CREDENTIALS_ID;
const region = DEFAULT_AWS_REGION;
const dbInstanceSid = 'oradbsan';
const accountId = ACCOUNT_ID;
const node1InstanceId = 'i-07e76a4b916548dc';
const fsxNId = 'fs-0f53fbecdd3d85fb2';

beforeAll(async () => {
    await createResource(ACCOUNT_ID, {
        resourceId: '6cbdabbfe3fb147e',
        resourceName: dbInstanceSid,
        resourceType: 'ORACLE',
        coRelationId: fsxNId,
        cloudProviderAccountId: 'test-aws-account',
        cloudProviderName: 'AWS',
        region: DEFAULT_AWS_REGION,
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        storageType: 'FSXN',
        metadata: {
            node1InstanceId
        }
    });

    const DATABASE_INSTANCE_RECORD = {
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        region: DEFAULT_AWS_REGION,
        resourceId: '6cbdabbfe3fb147e',
        databaseInstanceId: dbInstanceSid,
        databaseInstanceName: dbInstanceSid,
        isDefault: true,
        source: 'deployment',
        sqlDeploymentType: 'Standalone',
        fsxSvmId: { [fsxNId]: 'svm-0123456789abcdef0' },
        fsxnIds: fsxNId,
        databaseType: 'Oracle'
    };

    await upsertDatabaseInstance(ACCOUNT_ID, DATABASE_INSTANCE_RECORD);
});

afterAll(async () => {
    await deleteResource(ACCOUNT_ID, '6cbdabbfe3fb147e');
});
describe('Oracle assessment operations', () => {
    it('should return job id', async () => {
        const jobId = await onDemandTriggerOracleDriftAssessment(
            accountId,
            credentialsId,
            region,
            '6cbdabbfe3fb147e',
            dbInstanceSid,
            AssessmentTriggeredBy.SYSTEM
        );
        expect(jobId).toBeDefined();
    });
    it('should return drift assessment data', async () => {
        const assessmentData = await fetchOracleDriftAssessment(
            accountId,
            credentialsId,
            region,
            '6cbdabbfe3fb147e',
            dbInstanceSid,
            AssessmentTriggeredBy.SYSTEM
        );
        expect(assessmentData).toBeDefined();
        expect(assessmentData.fileSystemId).toBe('fs-0f53fbecdd3d85fb2');
        expect(assessmentData.ec2InstanceId).toBe(node1InstanceId);
    });
});
