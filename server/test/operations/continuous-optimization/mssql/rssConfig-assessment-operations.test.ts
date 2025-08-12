import {
    calculateRssConfigDrift,
    managedHostsRssConfigAssessment,
    runRssConfigAssessment
} from '../../../../src/operations/continuous-optimization/mssql/rssConfig-assessment-operations';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import '../../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../../simulator/scopes/aws/ssm-scope';
import { createResource, listResources, upsertDatabaseInstance } from '../../../../src/lib/database/db';
import { Metadata, ResourceAssessmentData } from '../../../../src/utils/common-types';

const RESOURCE_ID = '6cbdabbfe3fb147e';

beforeAll(async () => {
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
        },
        assessmentData: {
            rssConfig: {
                rssAdapters: [],
                tcpOffloadState: 'Disabled',
                rssConfigFinding: 'optimized'
            }
        }
    });

    await upsertDatabaseInstance(ACCOUNT_ID, {
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        region: DEFAULT_AWS_REGION,
        resourceId: RESOURCE_ID,
        databaseInstanceId: 'f4b7c5d3-e1f6-4g2a-9b5d',
        databaseInstanceName: 'MSSQLSERVER',
        isDefault: true,
        source: 'deployment',
        sqlDeploymentType: 'FCI',
        fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
        fsxnIds: 'fs-0f53fbecdd3d85fb2',
        databaseType: '' // Add the missing property 'databaseType'
    });
});

describe('calculateRssConfigDrift', () => {
    const activeNodeInstanceId = 'test-active-node-instance-id';
    it('should run RSS config assessment', async () => {
        const result = await runRssConfigAssessment(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            activeNodeInstanceId
        );
        expect(result).toEqual({
            rssConfigFinding: 'not-optimized',
            rssAdapters: [
                {
                    adapterName: 'Ethernet 3',
                    rssEnabled: true,
                    rssProfile: 'NUMAStatic',
                    baseProcessorNumber: 0,
                    numberOfReceiveQueues: 4
                }
            ],
            recommendedAdapterSettings: {
                recommendedRssProfile: 'NUMAStatic',
                recommendedBaseProcessorNumber: 2,
                recommendedReceiveQueues: 4
            },
            tcpOffloadState: 'Disabled',
            totalObjectsAssessed: 1,
            totalObjectsInViolation: 1
        });
    });

    it('run RSS config assessment drift data', async () => {
        const [{ metadata = {}, assessment_data: assessmentData } = {}] =
            (await listResources({
                accountId: ACCOUNT_ID,
                resourceId: RESOURCE_ID,
                credentialIds: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                selectKeys: ['metadata', 'assessment_data']
            })) || [];
        const rssConfigAssessmentResponse = await calculateRssConfigDrift(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            metadata as unknown as Metadata,
            assessmentData as unknown as ResourceAssessmentData
        );
        expect(rssConfigAssessmentResponse.name).toEqual('rss-config');
    });

    it('perform rss config assessment for managed hosts', async () => {
        const { rssConfigAssessment } = await managedHostsRssConfigAssessment(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            activeNodeInstanceId,
            'test-resource',
            'test-job-id'
        );
        expect(rssConfigAssessment?.rssConfigFinding).toBeDefined();
    });
});
