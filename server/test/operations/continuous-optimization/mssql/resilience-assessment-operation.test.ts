import { isEmpty } from 'lodash-es';
import { createResource, deleteResource, upsertDatabaseInstance } from '../../../../src/lib/database/db';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import { RESOURCE_ID } from '../../../../src/utils/consts';
import {
    collectVolumeSnapshotCopiesData,
    getHighAvailabilityDriftData,
    getResilienceDriftAssessment,
    getVolumesWithoutSnapshotPolicy,
    initiateHostLevelHighAvailabilityAssessment,
    initiateInstanceLevelHighAvailabilityAssessment,
    fetchDirectOntapCrrData,
    fetchLunIgroupMappings
} from '../../../../src/operations/continuous-optimization/mssql/resilience-assessment-operation';
import { WorkloadInstance } from '../../../../src/utils/common-types';
import { createDatabaseInstanceConfigData } from '../../../../src/lib/database/database-instance-config';
import { AssessmentCategories, AssessmentStatus } from '../../../../src/utils/continous-optimization-consts';
import { ASSESSMENT_HIGH_AVAILABILITY_CONFIG_DATA } from '../../../../src/utils/demo-utils/demoMockdata';
import {
    registerProxyGetResponse,
    resetProxyOverrides
} from '../../../simulator/scopes/cloud-manager/proxy-forwarder-scope';

function ontapPage<T>(records: T[]) {
    return { records, num_records: records.length };
}

function buildCrrInstanceRecord(overrides: Partial<WorkloadInstance> = {}): WorkloadInstance {
    return {
        id: 'instance-1',
        name: 'MSSQLSERVER',
        type: 'mssql',
        region: 'us-east-1',
        sqlAuthEnabled: false,
        fsxFileSystem: 'fs-1',
        activeNodeInstanceid: 'i-1',
        resourceName: 'test-resource',
        mappedVolumeNames: ['sqldata'],
        mappedVolumesUuids: ['vol-uuid-1'],
        svmOntapUuid: 'svm-uuid-1',
        ...overrides
    };
}

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

afterEach(() => {
    resetProxyOverrides();
});

describe('Snapshot policy assessment', () => {
    it('should return volumes without snapshot policy (none or empty)', () => {
        const testVolumes = [
            {
                name: 'wlmdb_sqldata_1728552629461',
                'snapshot-policy': 'none'
            },
            {
                name: 'wlmdb_sqltemp_1728552629461',
                'snapshot-policy': 'none'
            },
            {
                name: 'wlmdb_sqldata_1728574994',
                'snapshot-policy': 'daily'
            }
        ];
        const result = getVolumesWithoutSnapshotPolicy(testVolumes as Array<Record<string, string>>);
        expect(result).toEqual(['wlmdb_sqldata_1728552629461', 'wlmdb_sqltemp_1728552629461']);
    });

    it('should collect volume snapshot copies data', async () => {
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
        const [violatingVolume] = volumeAssessmentData;
        const violations = [violatingVolume.name];

        registerProxyGetResponse({
            targetId: instanceRecord.fsxFileSystem,
            ontapPath: `api/storage/volumes/${violatingVolume.uuid}/snapshots`,
            body: ontapPage([{ create_time: '2024-01-01T00:00:00Z' }])
        });

        const result = await collectVolumeSnapshotCopiesData(
            accountId,
            instanceRecord,
            volumeAssessmentData as Array<Record<string, unknown>>,
            violations
        );
        const dates = Object.values(result ?? {}).map(dateValues => {
            const record = dateValues as Record<string, unknown>;
            return new Date(record.create_time as string);
        });
        expect(dates.length).toBeGreaterThan(0);
    });
});

describe('Resilience drift assessment', () => {
    it('should return resilience drift assessment without snapshot-policy (moved to storage/configuration)', async () => {
        const res = await getResilienceDriftAssessment(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            RESOURCE_ID,
            'f4b7c5d3-e1f6-4g2a-9b5d',
            [AssessmentCategories.CRR, AssessmentCategories.AWS_BACKUP, AssessmentCategories.HIGH_AVAILABILITY],
            {},
            [],
            'i-07e76a4b916548dc0'
        );
        const snapshotPolicy = res.find(item => item.id === AssessmentCategories.SNAPSHOT_POLICY);
        expect(snapshotPolicy).toBeUndefined();
        expect(isEmpty(res)).toBeFalsy();
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

    it('should only include the violating node in sql-server-service violationDetails, not every assessed node', async () => {
        const result = await getHighAvailabilityDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            'test-resource',
            'f4b7c5d3-e1f6-4g2a-9b5d',
            {},
            {
                sqlServerServices: {
                    status: AssessmentStatus.NOT_OPTIMIZED,
                    nodesInViolation: ['i-preferred'],
                    totalNodes: 2,
                    details: [],
                    nodeDetails: [
                        { nodeId: 'i-preferred', current: 'not manual', recommended: 'manual' },
                        { nodeId: 'i-standby', current: 'manual', recommended: 'manual' }
                    ]
                }
            },
            'i-07e76a4b916548dc0'
        );

        const sqlServerServiceEntry = result.find(item => 'id' in item && item.id === 'sql-server-service') as {
            totalObjectsAssessed?: number;
            totalObjectsInViolation?: number;
            violationDetails?: Array<{ objectName: string }>;
        };

        expect(sqlServerServiceEntry.totalObjectsAssessed).toBe(2);
        expect(sqlServerServiceEntry.totalObjectsInViolation).toBe(1);
        expect(sqlServerServiceEntry.violationDetails).toHaveLength(1);
        expect(sqlServerServiceEntry.violationDetails?.[0].objectName).toBe('i-preferred');
    });

    it('should populate a non-blank violation value for the demo not-optimized sql-server-service scenario', async () => {
        const result = await getHighAvailabilityDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            'test-resource',
            'f4b7c5d3-e1f6-4g2a-9b5d',
            {},
            {
                sqlServerServices: ASSESSMENT_HIGH_AVAILABILITY_CONFIG_DATA.sqlServerServices
            } as unknown as Parameters<typeof getHighAvailabilityDriftData>[7],
            'i-07e76a4b916548dc0'
        );

        const sqlServerServiceEntry = result.find(item => 'id' in item && item.id === 'sql-server-service') as {
            violationDetails?: Array<{ objectName: string; value: string }>;
        };

        expect(sqlServerServiceEntry.violationDetails).toHaveLength(1);
        expect(sqlServerServiceEntry.violationDetails?.[0].objectName).toBe('demo-sql-prod-fci-001');
        expect(sqlServerServiceEntry.violationDetails?.[0].value).toBeTruthy();
    });
});

describe('fetchDirectOntapCrrData', () => {
    beforeEach(() => {
        resetProxyOverrides();
    });

    it('fetches cluster peers, svm peers and snapmirror relationships and shapes them like the old PowerShell code did', async () => {
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/cluster/peers',
            body: ontapPage([{ name: 'FsxIdfs-remote1', status: { state: 'available' } }])
        });
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/svm/peers',
            body: ontapPage([
                {
                    name: 'peer-relationship-1',
                    state: 'peered',
                    applications: ['snapmirror'],
                    peer: { cluster: { name: 'FsxIdfs-remote1' }, svm: { uuid: 'peer-svm-uuid', name: 'peer-svm' } },
                    svm: { name: 'svm1', uuid: 'svm-uuid-1' }
                }
            ])
        });
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/snapmirror/relationships',
            body: ontapPage([
                {
                    policy: { name: 'MirrorAllSnapshots', type: 'async_mirror' },
                    state: 'snapmirrored',
                    source: { path: 'svm1:sqldata', svm: { name: 'svm1', uuid: 'svm-uuid-1' } },
                    destination: { path: 'peer-svm:sqldata_dest', svm: { name: 'peer-svm', uuid: 'peer-svm-uuid' } }
                }
            ])
        });

        const result = await fetchDirectOntapCrrData('acct-1', buildCrrInstanceRecord());

        expect(JSON.parse(result.clusterPeerDetailsJson)).toEqual([
            { peerClusterName: 'FsxIdfs-remote1', availability: 'available' }
        ]);
        expect(JSON.parse(result.vserverPeerDetailsJson)).toEqual([
            {
                name: 'peer-relationship-1',
                state: 'peered',
                applications: ['snapmirror'],
                peerClusterName: 'FsxIdfs-remote1',
                peerSvmUuid: 'peer-svm-uuid',
                peerSvmName: 'peer-svm',
                svmname: 'svm1',
                svmuuid: 'svm-uuid-1'
            }
        ]);
        expect(JSON.parse(result.snapMirrorDestinationDetailsJson)).toEqual([
            {
                policyName: 'MirrorAllSnapshots',
                policyType: 'async_mirror',
                state: 'snapmirrored',
                sourceVserverName: 'svm1',
                sourceVserverUuid: 'svm-uuid-1',
                sourcePath: 'svm1:sqldata',
                destinationVserverName: 'peer-svm',
                destinationVserverUuid: 'peer-svm-uuid',
                destinationPath: 'peer-svm:sqldata_dest'
            }
        ]);
    });

    it('skips svm peers and snapmirror relationships without failing cluster peers when the mapped SVM UUID is missing', async () => {
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/cluster/peers',
            body: ontapPage([{ name: 'FsxIdfs-remote1', status: { state: 'available' } }])
        });

        const result = await fetchDirectOntapCrrData('acct-1', buildCrrInstanceRecord({ svmOntapUuid: undefined }));

        expect(JSON.parse(result.clusterPeerDetailsJson)).toHaveLength(1);
        expect(result.vserverPeerDetailsJson).toBe('[]');
        expect(result.snapMirrorDestinationDetailsJson).toBe('[]');
    });

    it('resolves the SVM UUID from an array when svmOntapUuid has multiple entries', async () => {
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/svm/peers',
            body: ontapPage([{ name: 'peer-1', state: 'peered', svm: { name: 'svm1', uuid: 'svm-uuid-1' } }])
        });

        const result = await fetchDirectOntapCrrData(
            'acct-1',
            buildCrrInstanceRecord({ svmOntapUuid: ['svm-uuid-1', 'svm-uuid-2'] })
        );

        expect(JSON.parse(result.vserverPeerDetailsJson)).toHaveLength(1);
    });
});

describe('fetchLunIgroupMappings', () => {
    beforeEach(() => {
        resetProxyOverrides();
    });

    it('returns an empty result without calling the proxy when there are no LUN UUIDs', async () => {
        const result = await fetchLunIgroupMappings('acct-1', 'fs-1', 'us-east-1', []);

        expect(result).toEqual({ lunMappings: [] });
    });

    it('filters lun-maps down to the requested LUN UUIDs and splits string-shaped initiators', async () => {
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/protocols/san/lun-maps',
            body: ontapPage([
                {
                    lun: { uuid: 'lun-uuid-1', name: '/vol/sqldata/sqldata' },
                    igroup: { uuid: 'igroup-uuid-1', name: 'igroup-a', initiators: 'iqn.host1, iqn.host2' }
                },
                {
                    lun: { uuid: 'lun-uuid-2', name: '/vol/sqllog/sqllog' },
                    igroup: { uuid: 'igroup-uuid-2', name: 'igroup-b', initiators: [{ name: 'iqn.host1' }] }
                },
                {
                    lun: { uuid: 'lun-uuid-not-requested', name: '/vol/other/other' },
                    igroup: { uuid: 'igroup-uuid-3', name: 'igroup-c', initiators: 'iqn.host3' }
                }
            ])
        });

        const result = await fetchLunIgroupMappings('acct-1', 'fs-1', 'us-east-1', ['lun-uuid-1', 'lun-uuid-2']);

        expect(result).toEqual({
            lunMappings: [
                {
                    lunUuid: 'lun-uuid-1',
                    lunName: '/vol/sqldata/sqldata',
                    igroupUuid: 'igroup-uuid-1',
                    igroupName: 'igroup-a',
                    initiatorNames: ['iqn.host1', 'iqn.host2']
                },
                {
                    lunUuid: 'lun-uuid-2',
                    lunName: '/vol/sqllog/sqllog',
                    igroupUuid: 'igroup-uuid-2',
                    igroupName: 'igroup-b',
                    initiatorNames: ['iqn.host1']
                }
            ]
        });
    });

    it('skips lun-map records without an igroup', async () => {
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/protocols/san/lun-maps',
            body: ontapPage([{ lun: { uuid: 'lun-uuid-1', name: '/vol/sqldata/sqldata' } }])
        });

        const result = await fetchLunIgroupMappings('acct-1', 'fs-1', 'us-east-1', ['lun-uuid-1']);

        expect(result).toEqual({ lunMappings: [] });
    });

    it('reports an error instead of throwing when the proxy request fails', async () => {
        // The 'error-target' fsxId makes the scope's fallback reply with a 500 for every path.
        const result = await fetchLunIgroupMappings('acct-1', 'error-target', 'us-east-1', ['lun-uuid-1']);

        expect(result.lunMappings).toEqual([]);
        expect(result.error).toBeDefined();
    });
});
