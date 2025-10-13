import '../../../simulator/scopes/aws/ssm-scope';
import '../../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../../simulator/scopes/aws/fsx-scope';
import '../../../simulator/scopes/aws/cloud-watch-logs-scope';
import '../../../simulator/scopes/aws/cloud-watch-scope';

import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import { createResource, deleteResource, upsertDatabaseInstance } from '../../../../src/lib/database/db';
import { optimizeOracleStorageLayout } from '../../../../src/operations/continuous-optimization/oracle/storage-optimize-operations';
import { createDatabaseInstanceConfigData } from '../../../../src/lib/database/database-instance-config';
import { AssessmentCategoriesOracle } from '../../../../src/utils/continous-optimization-consts';
import GOLDEN_CONFIG from '../../../../src/operations/continuous-optimization/oracle/golden-config';
import { getJobs } from '../../../../src/operations/database/job-operations';
import waitForJobCompletion from '../../../utils/utils';

const dbInstanceSid = 'oradbopt';
const node1InstanceId = 'i-optimizetest123456';
const fsxNId = 'fs-0f53fbecdd3d85fb2';
const RESOURCE_ID = 'optim-storage-resource-1234';

beforeAll(async () => {
    await createResource(ACCOUNT_ID, {
        resourceId: RESOURCE_ID,
        resourceName: dbInstanceSid,
        resourceType: 'ORACLE',
        coRelationId: fsxNId,
        cloudProviderAccountId: 'test-aws-account',
        cloudProviderName: 'AWS',
        region: DEFAULT_AWS_REGION,
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        storageType: 'FSXN',
        metadata: { node1InstanceId }
    });

    const DATABASE_INSTANCE_RECORD = {
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        region: DEFAULT_AWS_REGION,
        resourceId: RESOURCE_ID,
        databaseInstanceId: dbInstanceSid,
        databaseInstanceName: dbInstanceSid,
        isDefault: true,
        source: 'deployment',
        sqlDeploymentType: 'Standalone',
        fsxSvmId: { [fsxNId]: 'svm-0123456789abcdef0' },
        fsxnIds: fsxNId,
        databaseType: 'Oracle',
        metadata: { node1InstanceId }
    };
    await upsertDatabaseInstance(ACCOUNT_ID, DATABASE_INSTANCE_RECORD);

    const mappedVolConfigData = {
        account_id: ACCOUNT_ID,
        credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
        region: DEFAULT_AWS_REGION,
        resource_id: RESOURCE_ID,
        database_instance_id: dbInstanceSid,
        creation_time: new Date(),
        last_updated: new Date(),
        config_data: {
            [fsxNId]: {
                DATADG: [{ lunId: 'BaselineLUN1', diskGroup: 'DATADG', svmName: 'svm1', svmId: 'svm1' }]
            }
        },
        config_data_type: AssessmentCategoriesOracle.MAPPED_ONTAP_VOLUMES
    };

    const storageLayoutConfigData = {
        account_id: ACCOUNT_ID,
        credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
        region: DEFAULT_AWS_REGION,
        resource_id: RESOURCE_ID,
        database_instance_id: dbInstanceSid,
        creation_time: new Date(),
        last_updated: new Date(),
        config_data: {
            layout: [
                {
                    name: GOLDEN_CONFIG.dataDiskLunLayout.name,
                    violationDetails: [{ objectName: 'DATADG', value: '0', recommended: '1' }]
                }
            ]
        },
        config_data_type: AssessmentCategoriesOracle.STORAGE
    };

    await createDatabaseInstanceConfigData([mappedVolConfigData, storageLayoutConfigData]);
});

afterAll(async () => {
    await deleteResource(ACCOUNT_ID, RESOURCE_ID);
});

describe('optimizeOracleStorageLayout (integration style)', () => {
    it('should register a parent optimization job and attempt layout fix', async () => {
        const parentJobIdOrErr = await optimizeOracleStorageLayout({
            accountId: ACCOUNT_ID,
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            databaseHostId: RESOURCE_ID,
            databaseInstanceId: dbInstanceSid,
            optimizationTargets: [
                { configurationName: GOLDEN_CONFIG.dataDiskLunLayout.name, objectsToOptimize: ['DATADG'] }
            ]
        });

        expect(typeof parentJobIdOrErr).toBe('string');

        const { items: jobItems } = await getJobs(ACCOUNT_ID, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            includeSubJobs: true
        });
        const parentJob = (jobItems || []).find((j: any) => j.id === parentJobIdOrErr);
        expect(parentJob).toBeDefined();
        expect(parentJob?.type).toBe('OPTIMIZATION');

        await waitForJobCompletion(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            parentJobIdOrErr as string
        );

        const { items: jobStatusAfterCompletion } = await getJobs(ACCOUNT_ID, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            includeSubJobs: true
        });

        expect(jobStatusAfterCompletion).toBeDefined();
    });
});
