import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import '../../../simulator/scopes/aws/ssm-scope';
import '../../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../../simulator/scopes/aws/fsx-scope';
import '../../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../../simulator/scopes/opentelemetry-scope';
import '../../../simulator/scopes/aws/ec2-scope';
import '../../../simulator/scopes/aws/cloud-watch-scope';
import '../../../simulator/scopes/aws/compute-optimizer-scope';
import { createResource, listResources, upsertDatabaseInstance } from '../../../../src/lib/database/db';
import { handleOptimizeRssOptimization } from '../../../../src/operations/continuous-optimization/mssql/rssConfig-optimize-operations';
import { Metadata } from '../../../../src/utils/common-types';

const RESOURCE_ID = '6cbdabbfe3fb147e';
beforeAll(async () => {
    const rssAssesment = {
        rssConfig: {
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
            tcpOffloadState: 'Disabled'
        }
    };
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
        assessmentData: rssAssesment
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
        databaseType: ''
    });
});

describe('handleOptimizeRssOptimization', () => {
    beforeAll(() => {});
    it('should optimize network adapter settings', async () => {
        const jobId = await handleOptimizeRssOptimization(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            'f4b7c5d3-e1f6-4g2a-9b5d',
            ['Ethernet 3']
        );
        expect(jobId).toBeDefined();
        const [{ metadata }] = await listResources({
            accountId: ACCOUNT_ID,
            resourceId: RESOURCE_ID,
            credentialIds: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION
        });
        expect((metadata as unknown as Metadata)?.isRssConfigOptimized).toEqual(['Ethernet 3']);
    });
});
