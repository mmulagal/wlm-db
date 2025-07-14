import { JOBTYPE } from '@prisma/client';
import { createResource, upsertDatabaseInstance } from '../../../src/lib/database/db';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/aws/fsx-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/aws/ssm-scope';
import '../../simulator/scopes/aws/ec2-scope';
import '../../simulator/scopes/aws/cloud-watch-scope';
import '../../simulator/scopes/aws/compute-optimizer-scope';
import { handleCloneRemediation } from '../../../src/operations/continuous-optimization/mssql/clone-optimization-operations';
import { handleOptimizeJobCreation } from '../../../src/operations/continuous-optimization/assessment-utils';

const RESOURCE_ID = '6cbdabbfe3fb147e';
let optimizeParentId = '';
const databaseInstanceId = 'f4b7c5d3-e1f6-4g2a-9b5d';

beforeAll(async () => {
    const resourceName = 'test-resource';

    await createResource(ACCOUNT_ID, {
        resourceId: '6cbdabbfe3fb147e',
        resourceName,
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
        resourceId: RESOURCE_ID,
        databaseInstanceId,
        databaseInstanceName: 'MSSQLSERVER',
        isDefault: true,
        source: 'deployment',
        sqlDeploymentType: 'FCI',
        fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
        fsxnIds: 'fs-0f53fbecdd3d85fb2',
        databaseType: ''
    });

    const rootJobId = 'root-job-id';

    optimizeParentId = await handleOptimizeJobCreation(
        ACCOUNT_ID,
        DEFAULT_AWS_CREDENTIALS_ID,
        DEFAULT_AWS_REGION,
        resourceName!,
        JOBTYPE.WELL_ARCHITECTED,
        `Fix EC2 compute for ${resourceName}`,
        `Fix EC2 compute for ${resourceName}`,
        rootJobId
    );
});

describe('Clone remediation operations', () => {
    it('Should handle clone remediation', async () => {
        const response = await handleCloneRemediation(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            databaseInstanceId,
            optimizeParentId,
            {
                cloneDatabaseName: 'sandbox_clonecleanup06',
                clonedBy: 'netapp_wf',
                action: 'delete'
            },
            {
                databaseHostName: 'FCIVY2219J0F',
                databaseHostId: RESOURCE_ID,
                databaseInstanceName: 'MSSQLSERVER',
                sourceDatabaseHostName: 'FCIVY2219J0F',
                sourceDatabaseInstanceName: 'MSSQLSERVER',
                sourceDatabaseName: 'sandbox_clonecleanup04',
                cloneDatabaseName: 'sandbox_clonecleanup05',
                cloneAge: 2,
                clonedBy: 'netapp_wf',
                clonedVolumeDetails: [
                    {
                        cloneVolumeUuid: 'cce1918f-2017-11f0-b53e-f9f6737b2b32',
                        cloneVolumeName: 'wlmdb_sqldata_1745247374_clone_1745393830_clone_1745394304_clone_1745394698',
                        cloneVolumeCreateTime: '2025-04-23T07:51:44+00:00',
                        sourceVolumeName: 'wlmdb_sqldata_1745247374_clone_1745393830_clone_1745394304',
                        cloneDatabaseName: 'sandbox_clonecleanup05',
                        cloneVolumeType: 'data'
                    }
                ]
            },
            'FCIVY2219J0F\\MSSQLSERVER'
        );

        expect(response).toBeUndefined();
    });
    it('Should handle clone remediation for clonedBy: "others" with delete action', async () => {
        const response = await handleCloneRemediation(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            databaseInstanceId,
            optimizeParentId,
            {
                cloneDatabaseName: 'sandbox_clonecleanup07',
                clonedBy: 'others',
                action: 'delete'
            },
            {
                databaseHostName: 'FCIVY2219J0F',
                databaseHostId: RESOURCE_ID,
                databaseInstanceName: 'MSSQLSERVER',
                sourceDatabaseHostName: 'FCIVY2219J0F',
                sourceDatabaseInstanceName: 'MSSQLSERVER',
                sourceDatabaseName: 'sandbox_clonecleanup04',
                cloneDatabaseName: 'sandbox_clonecleanup07',
                cloneAge: 3,
                clonedBy: 'others',
                clonedVolumeDetails: [
                    {
                        cloneVolumeUuid: 'dce1918f-2017-11f0-b53e-f9f6737b2b33',
                        cloneVolumeName: 'wlmdb_sqldata_1745247374_clone_1745393830_clone_1745394304_clone_1745394700',
                        cloneVolumeCreateTime: '2025-04-23T08:00:00+00:00',
                        sourceVolumeName: 'wlmdb_sqldata_1745247374_clone_1745393830_clone_1745394304',
                        cloneDatabaseName: 'sandbox_clonecleanup07',
                        cloneVolumeType: 'data'
                    }
                ]
            },
            'FCIVY2219J0F\\MSSQLSERVER'
        );

        expect(response).toBeUndefined();
    });
    it('Should handle clone remediation for clonedBy: "netapp_wf" with refresh action', async () => {
        const response = await handleCloneRemediation(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            databaseInstanceId,
            optimizeParentId,
            {
                cloneDatabaseName: 'sandbox_clonecleanup08',
                clonedBy: 'netapp_wf',
                action: 'refresh'
            },
            {
                databaseHostName: 'FCIVY2219J0F',
                databaseHostId: RESOURCE_ID,
                databaseInstanceName: 'MSSQLSERVER',
                sourceDatabaseHostName: 'FCIVY2219J0F',
                sourceDatabaseInstanceName: 'MSSQLSERVER',
                sourceDatabaseName: 'sandbox_clonecleanup04',
                cloneDatabaseName: 'sandbox_clonecleanup08',
                cloneAge: 1,
                clonedBy: 'netapp_wf',
                clonedVolumeDetails: [
                    {
                        cloneVolumeUuid: 'ece1918f-2017-11f0-b53e-f9f6737b2b34',
                        cloneVolumeName: 'wlmdb_sqldata_1745247374_clone_1745393830_clone_1745394304_clone_1745394710',
                        cloneVolumeCreateTime: '2025-04-23T08:10:00+00:00',
                        sourceVolumeName: 'wlmdb_sqldata_1745247374_clone_1745393830_clone_1745394304',
                        cloneDatabaseName: 'sandbox_clonecleanup08',
                        cloneVolumeType: 'data'
                    }
                ]
            },
            'FCIVY2219J0F\\MSSQLSERVER'
        );

        expect(response).toBeUndefined();
    }, 30000);
});
