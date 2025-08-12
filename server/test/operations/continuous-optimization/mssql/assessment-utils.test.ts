import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import '../../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../../simulator/scopes/aws/fsx-scope';
import '../../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../../simulator/scopes/opentelemetry-scope';
import '../../../simulator/scopes/aws/ssm-scope';
import '../../../simulator/scopes/aws/ec2-scope';
import '../../../simulator/scopes/aws/cloud-watch-scope';
import '../../../simulator/scopes/aws/compute-optimizer-scope';
import {
    getMatchingAssessmentStatus,
    handleOptimizeJobCreation,
    updateDismissConfigurations,
    updateFieldsBasedOnDismissedConfigurations
} from '../../../../src/operations/continuous-optimization/assessment-utils';
import { FINDING } from '../../../../src/utils/consts';
import { AssessmentStatus } from '../../../../src/utils/continous-optimization-consts';
import { createResource, deleteDatabaseInstance, upsertDatabaseInstance } from '../../../../src/lib/database/db';

describe('Assessment utils', () => {
    it('Should return matching assessment status', async () => {
        const response = getMatchingAssessmentStatus(FINDING.NOT_OPTIMIZED);

        expect(response).toEqual(AssessmentStatus.NOT_OPTIMIZED);
    });

    it('Handle optimize job creation', async () => {
        const response = await handleOptimizeJobCreation(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            'test-server',
            'test-job',
            'test-job',
            'test-job'
        );
        expect(response).toBeDefined();
    });

    it('Should filter out fields based on dismissed configurations', () => {
        const fieldsValues = ['crr', 'maxdop', 'compute', 'storage', 'license'];
        const dismissedConfigurations = {
            crr: {
                configurationName: 'crr',
                endTime: 1747502704221,
                startTime: 1744910704221,
                configState: 'POSTPONED'
            }
        };

        const result = updateFieldsBasedOnDismissedConfigurations(fieldsValues, dismissedConfigurations);

        expect(result).toEqual(['maxdop', 'compute', 'storage', 'license']);
    });
});

it('Should update dismiss configurations successfully', async () => {
    await createResource(ACCOUNT_ID, {
        resourceId: '6cbdabbfe3fb147e',
        resourceName: 'test-resource',
        resourceType: 'MSSQL',
        coRelationId: 'fs-f6082f35c1db',
        cloudProviderAccountId: 'test-aws-account',
        cloudProviderName: 'AWS',
        region: DEFAULT_AWS_REGION,
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        storageType: 'FSXN',
        metadata: {
            node1InstanceId: 'i-07e76a4b916548dc0',
            node2InstanceId: 'i-0880a21327284f67c',
            sqlDeploymentType: 'FCI'
        }
    });
    await upsertDatabaseInstance(ACCOUNT_ID, {
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        region: DEFAULT_AWS_REGION,
        resourceId: '6cbdabbfe3fb147e',
        databaseInstanceId: 'f4b7c5d3-e1f6-4g2a-9b5d',
        databaseInstanceName: 'MSSQLSERVER',
        isDefault: true,
        source: 'deployment',
        sqlDeploymentType: 'FCI',
        fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
        fsxnIds: 'fs-0f53fbecdd3d85fb2',
        databaseType: ''
    });
    const mockAccountId = ACCOUNT_ID;
    const mockConfigurations = [
        {
            configurationName: 'sql-license',
            configState: 'ACTIVE',
            databaseHosts: [
                {
                    id: '6cbdabbfe3fb147e',
                    sqlServerInstances: ['f4b7c5d3-e1f6-4g2a-9b5d'],
                    credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                    region: DEFAULT_AWS_REGION
                }
            ]
        }
    ];
    const mockResponse = [
        {
            configurationName: 'sql-license',
            startTime: expect.any(Number),
            endTime: undefined,
            configState: 'ACTIVE',
            databaseHosts: [
                {
                    id: '6cbdabbfe3fb147e',
                    sqlServerInstances: ['f4b7c5d3-e1f6-4g2a-9b5d'],
                    credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                    region: DEFAULT_AWS_REGION,
                    status: 'SUCCESS'
                }
            ]
        }
    ];
    const result = await updateDismissConfigurations(mockAccountId, mockConfigurations);
    expect(result).toEqual({ dismissedConfigurations: mockResponse });
    // Cleanup the database instance
    const DATABASE_INSTANCE_RECORD = {
        resourceId: '6cbdabbfe3fb147e'
    };
    await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DATABASE_INSTANCE_RECORD.resourceId, [
        'non-existing-instance'
    ]);
});
