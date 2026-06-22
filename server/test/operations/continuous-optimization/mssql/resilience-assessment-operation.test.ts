import { isEmpty } from 'lodash-es';
import { createResource, deleteResource, upsertDatabaseInstance } from '../../../../src/lib/database/db';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import { RESOURCE_ID } from '../../../../src/utils/consts';
import {
    collectVolumeSnapshotCopiesData,
    getResilienceDriftAssessment,
    getVolumesWithoutSnapshotPolicy,
    initiateHostLevelHighAvailabilityAssessment,
    initiateInstanceLevelHighAvailabilityAssessment
} from '../../../../src/operations/continuous-optimization/mssql/resilience-assessment-operation';
import { WorkloadInstance } from '../../../../src/utils/common-types';
import { createDatabaseInstanceConfigData } from '../../../../src/lib/database/database-instance-config';
import { AssessmentCategories } from '../../../../src/utils/continous-optimization-consts';

const INSTANCE_CONFIG = {
    volumes: [
        {
            uuid: 'ad251a8f-da34-11ef-b315-11b9ce95d982',
            name: 'wlmdb_sqldata_1728552629461',
            autosize: 'off',
            'autosize-mode': 'off',
            'thin-provision': false,
            'tiering-policy': 'auto',
            'space-guarantee': 'volume',
            'fractional-reserve': 10,
            'snapshot-autodelete': false,
            'snapshot-copy-reserve': 15,
            'tiering-min-cooling-days': 17,
            'snapshot-policy': 'none'
        },
        {
            uuid: '74a8a789-c5dd-11ef-b315-11b9ce95d982',
            name: 'wlmdb_sqltemp_1728552629461',
            autosize: 'off',
            'autosize-mode': 'off',
            'thin-provision': false,
            'tiering-policy': 'auto',
            'space-guarantee': 'volume',
            'fractional-reserve': 10,
            'snapshot-autodelete': false,
            'snapshot-copy-reserve': 15,
            'tiering-min-cooling-days': 17,
            'snapshot-policy': 'daily'
        },
        {
            uuid: '438cc269-edeb-11ef-994b-3b81e03bea3e',
            name: 'wlmdb_sqldata_1728574994',
            autosize: 'off',
            'autosize-mode': 'off',
            'thin-provision': true,
            'tiering-policy': 'auto',
            'space-guarantee': 'volume',
            'fractional-reserve': 10,
            'snapshot-autodelete': false,
            'snapshot-copy-reserve': 15,
            'tiering-min-cooling-days': 17,
            'snapshot-policy': 'daily'
        }
    ]
};
beforeAll(async () => {
    await createResource(ACCOUNT_ID, {
        resourceId: RESOURCE_ID,
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
            node2InstanceId: 'i-07e76a4b916548dc0',
            sqlDeploymentType: 'FCI'
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
        databaseType: ''
    });

    const DatabaseInstanceConfigData = {
        account_id: ACCOUNT_ID,
        credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
        region: DEFAULT_AWS_REGION,
        resource_id: RESOURCE_ID,
        database_instance_id: 'f4b7c5d3-e1f6-4g2a-9b5d',
        creation_time: new Date(),
        last_updated: new Date(),
        config_data: INSTANCE_CONFIG,
        config_data_type: 'storage'
    };
    await createDatabaseInstanceConfigData([DatabaseInstanceConfigData]);
});

afterAll(async () => {
    await deleteResource(ACCOUNT_ID, RESOURCE_ID);
});

describe('Snapshot policy assessment', () => {
    it('should return volumes without snapshot policy', () => {
        const testVolumes = [
            {
                name: 'wlmdb_sqldata_1728552629461',
                'snapshot-policy': 'none'
            },
            {
                name: 'wlmdb_sqltemp_1728552629461',
                'snapshot-policy': 'daily'
            },
            {
                name: 'wlmdb_sqldata_1728574994',
                'snapshot-policy': 'daily'
            }
        ];
        const result = getVolumesWithoutSnapshotPolicy(testVolumes as Array<Record<string, string>>);
        expect(result).toEqual(['wlmdb_sqldata_1728552629461']);
    });

    it('should collect volume snapshot copies data', async () => {
        const credentialsId = 'test-credentials';
        const accountId = 'test-account';
        const instanceRecord: WorkloadInstance = {
            region: 'us-west-2',
            fsxFileSystem: 'fs-1234',
            activeNodeInstanceid: 'i-1234',
            id: '123',
            name: '123',
            type: '123',
            sqlAuthEnabled: false,
            cloudProviderAccountId: 'aws-account',
            resourceName: 'fsxn'
        };
        const volumeAssessmentData = INSTANCE_CONFIG.volumes;
        const violations = ['vol1'];

        const result = await collectVolumeSnapshotCopiesData(
            credentialsId,
            accountId,
            instanceRecord,
            volumeAssessmentData as Array<Record<string, unknown>>,
            violations
        );
        const dates = Object.values(result).map(dateValues => {
            const record = dateValues as Record<string, unknown>;
            return new Date(record.create_time as string);
        });
        expect(dates.length).toBeGreaterThan(0);
    });
});

describe('Resilience drift assessment', () => {
    it('should return resilience drift assessment', async () => {
        const res = await getResilienceDriftAssessment(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            RESOURCE_ID,
            'f4b7c5d3-e1f6-4g2a-9b5d',
            [
                AssessmentCategories.SNAPSHOT_POLICY,
                AssessmentCategories.CRR,
                AssessmentCategories.AWS_BACKUP,
                AssessmentCategories.HIGH_AVAILABILITY
            ]
        );
        const snapshotPolicy = res.find(item => item.id === AssessmentCategories.SNAPSHOT_POLICY);
        expect(snapshotPolicy).toBeDefined();
        expect(isEmpty(snapshotPolicy)).toBeFalsy();
    });
});
describe('High Availability Assessment', () => {
    const accountId = ACCOUNT_ID;
    const credentialsId = DEFAULT_AWS_CREDENTIALS_ID;
    const region = DEFAULT_AWS_REGION;
    const databaseHostId = RESOURCE_ID;
    const parentJobId = 'parent-job-id';

    it('should complete host level assessment and return cluster and heartbeat assessment', async () => {
        const instanceRecord: WorkloadInstance = {
            resourceName: 'test-resource',
            name: 'test-instance',
            activeNodeInstanceid: 'i-123456',
            id: 'db-instance-id',
            region: DEFAULT_AWS_REGION,
            fsxFileSystem: 'fs-1234',
            type: 'MSSQL',
            sqlAuthEnabled: false,
            cloudProviderAccountId: 'aws-account'
        };

        const result = await initiateHostLevelHighAvailabilityAssessment(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            instanceRecord,
            parentJobId,
            {
                node1InstanceId: 'i-07e76a4b916548dc0',
                node2InstanceId: 'i-0880a21327284f67c',
                sqlDeploymentType: 'FCI'
            }
        );

        expect(result).toBeDefined();
        expect(result.clusterQuorum).toBeDefined();
        expect(result.heartbeat).toBeDefined();
        expect(result.clusterQuorum.status).toBeDefined();
        expect(result.heartbeat.status).toBeDefined();
    });

    it('should complete instance level assessment and return undefined', async () => {
        const instanceRecord: WorkloadInstance = {
            resourceName: 'test-resource',
            name: 'test-instance',
            activeNodeInstanceid: 'i-123456',
            id: 'f4b7c5d3-e1f6-4g2a-9b5d',
            region: DEFAULT_AWS_REGION,
            fsxFileSystem: 'fs-1234',
            type: 'MSSQL',
            sqlAuthEnabled: false,
            cloudProviderAccountId: 'aws-account'
        };

        const result = await initiateInstanceLevelHighAvailabilityAssessment(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            instanceRecord,
            parentJobId
        );

        expect(result).toBeUndefined();
    });
});
