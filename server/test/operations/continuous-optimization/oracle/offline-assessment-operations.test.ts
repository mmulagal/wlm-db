import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { DATABASE_TYPE, offline_assessment as OfflineAssessmentDBSchema } from '@prisma/client';

import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import { ORACLE_STORAGE_ASSESSMENT_DATA } from '../../../../src/utils/demo-utils/demoMockdata';
import { createResource, deleteResource, upsertDatabaseInstance } from '../../../../src/lib/database/db';
import { bulkUpsertOfflineAssessments, getOfflineAssessment } from '../../../../src/lib/database/offline-assessment';
import {
    fetchOracleOfflineAssessment,
    fetchOracleOfflineAssessmentPerAccount,
    fetchOracleUnregisteredInstanceAssessment,
    triggerOracleUnregisteredAssessment
} from '../../../../src/operations/continuous-optimization/oracle/offline-assessment-operations';
import * as taggingServiceOperations from '../../../../src/operations/cloud-manager/tagging-service-operations';
import { Ec2FsxRelationship } from '../../../../src/operations/cloud-manager/tagging-service-operations';
import { OracleGenericParameterDriftResponseType } from '../../../../src/routes/types/oracle-continuous-optimization.types';
import { AssessmentStatus, AwsWellArchitecturedPillars } from '../../../../src/utils/continous-optimization-consts';
import { OFFLINE_ASSESSMENT_SOURCE } from '../../../../src/operations/continuous-optimization/assessment-utils';
import { ONE_TIME_WAD_NOT_APPLICABLE_MESSAGE } from '../../../../src/operations/continuous-optimization/one-time-assessment-consts';
import { prisma } from '../../../../src/utils/prisma-utils';
import {
    registerProxyGetResponse,
    resetProxyOverrides
} from '../../../simulator/scopes/cloud-manager/proxy-forwarder-scope';
import waitForJobCompletion from '../../../utils/utils';

const resourceId = 'offline-oracle-resource';
const fsxId = 'fs-offline-oracle-1';
const iscsiInstanceId = 'ORAISCSI';
const nfsInstanceId = 'ORANFS';
const ec2InstanceId = 'i-offline-oracle-01';

const storageOs = (ORACLE_STORAGE_ASSESSMENT_DATA as { os: Record<string, unknown> }).os;

const metadataFor = (databaseInstanceId: string) => ({
    ec2InstanceId,
    hostname: 'oracle-offline-host',
    fsxId,
    storageEndpoint: fsxId,
    assessmentTimestamp: new Date().toISOString(),
    osVersion: 'RHEL 8',
    databaseType: 'Oracle',
    databaseInstanceName: databaseInstanceId,
    deploymentType: 'Standalone',
    oracleSid: databaseInstanceId
});

const rawdataFor = () => ({
    hostLevelDetails: {},
    os: {
        'transparent-hugepages': storageOs['transparent-hugepages'],
        'tcp-advanced-options': storageOs['tcp-advanced-options'],
        'oracle-parameters': storageOs['oracle-parameters'],
        'oracle-parameters-from-init': storageOs['oracle-parameters-from-init']
    },
    instanceLevelAssessment: {}
});

const storageRawdataFor = () => ({
    ...rawdataFor(),
    instanceLevelAssessment: {
        fraEnabled: 'no',
        rmanCompressionEnabled: 'no',
        luns: {
            error: '',
            data: [
                {
                    name: '/vol/data_vol/lun1',
                    spaceReservationEnabled: true,
                    spaceAllocationAllocated: true
                }
            ]
        },
        volumes: {
            error: '',
            data: [
                {
                    name: 'data_vol',
                    uuid: 'uuid-data',
                    compressionType: 'adaptive',
                    compression: 'adaptive',
                    deduplication: 'inline',
                    compaction: 'enabled',
                    tieringPolicy: 'none',
                    tieringMinCoolingDays: '',
                    fractionalReserve: '0',
                    spaceGuarantee: 'none',
                    autosize: 'on',
                    autosizeMode: 'grow',
                    snapshotPolicy: 'none',
                    snapshotCopyReserve: '0',
                    snapshotAutodelete: 'true',
                    snapshotDeleteOrder: 'oldest_first',
                    spaceMgmtTryFirst: 'volume_grow'
                }
            ],
            filesystemId: fsxId
        }
    }
});

const staleLegacyAssessmentItem = (id: string, name: string) => ({
    id,
    name,
    status: AssessmentStatus.NOT_OPTIMIZED,
    recommended: '0',
    severity: 'Critical',
    recommendation: 'Legacy cached finding',
    categories: [AwsWellArchitecturedPillars.COST_OPTIMIZATION],
    objectsInViolation: ['data_vol'],
    totalObjectsAssessed: 1,
    totalObjectsInViolation: 1
});

const staleLegacyAssessmentResults = {
    assessments: [
        staleLegacyAssessmentItem('fractional-reserve', 'Fractional reserve'),
        staleLegacyAssessmentItem('space-reservation-enabled', 'Space reservation enabled'),
        staleLegacyAssessmentItem('compression', 'Compression')
    ],
    dismissedConfigurations: [],
    metadata: { storageProtocol: 'iSCSI', fileSystemId: fsxId }
};

const mappedVolumesFor = (protocol: 'iSCSI' | 'NFS') => ({
    fileSystemId: fsxId,
    protocol,
    isASMManaged: false,
    ontapVolumes: {}
});

const createInstance = (databaseInstanceId: string, storageProtocol: 'iSCSI' | 'NFS') => ({
    credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
    region: DEFAULT_AWS_REGION,
    resourceId,
    databaseInstanceId,
    databaseInstanceName: databaseInstanceId,
    isDefault: true,
    source: 'discovery',
    sqlDeploymentType: 'Standalone',
    fsxSvmId: { [fsxId]: 'svm-offline' },
    fsxnIds: fsxId,
    databaseType: 'Oracle',
    storageProtocol,
    metadata: {}
});

beforeAll(async () => {
    await createResource(ACCOUNT_ID, {
        resourceId,
        resourceName: 'offline-oracle-resource',
        resourceType: 'ORACLE',
        coRelationId: fsxId,
        cloudProviderAccountId: 'test-aws-account',
        cloudProviderName: 'AWS',
        region: DEFAULT_AWS_REGION,
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        storageType: 'FSXN',
        metadata: {}
    });

    await Promise.all([
        upsertDatabaseInstance(ACCOUNT_ID, createInstance(iscsiInstanceId, 'iSCSI')),
        upsertDatabaseInstance(ACCOUNT_ID, createInstance(nfsInstanceId, 'NFS'))
    ]);

    await bulkUpsertOfflineAssessments([
        {
            accountId: ACCOUNT_ID,
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            resourceId,
            databaseInstanceId: iscsiInstanceId,
            databaseType: DATABASE_TYPE.oracle,
            rawdata: rawdataFor(),
            mappedOntapVolumes: mappedVolumesFor('iSCSI'),
            metadata: metadataFor(iscsiInstanceId)
        },
        {
            accountId: ACCOUNT_ID,
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            resourceId,
            databaseInstanceId: nfsInstanceId,
            databaseType: DATABASE_TYPE.oracle,
            rawdata: rawdataFor(),
            mappedOntapVolumes: mappedVolumesFor('NFS'),
            metadata: metadataFor(nfsInstanceId)
        }
    ]);
});

afterAll(async () => {
    await deleteResource(ACCOUNT_ID, resourceId);
});

describe('fetchOracleOfflineAssessment', () => {
    it('should include compute host/OS drift fields for iSCSI one-time WAD (GH-9151)', async () => {
        const response = await fetchOracleOfflineAssessment(
            ACCOUNT_ID,
            resourceId,
            iscsiInstanceId,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION
        );

        expect(response).toBeDefined();
        expect(response.metadata.storageProtocol).toBe('iSCSI');
        expect(response.metadata.fileSystemId).toBe(fsxId);

        // NFS-only golden-config entries must not leak into an iSCSI instance's not-applicable stubs.
        const ids = response.assessments.map(assessment => assessment.id);
        expect(ids).not.toContain('nfs-rootonly');
        expect(ids).not.toContain('export-policy');

        const thp = response.assessments.find(
            i => i.id === 'transparent-hugepages'
        ) as OracleGenericParameterDriftResponseType;
        expect(thp).toBeDefined();
        expect(thp.recommended).toBe('disabled');

        const tcp = response.assessments.find(
            i => i.id === 'tcp-advanced-options'
        ) as OracleGenericParameterDriftResponseType;
        expect(tcp).toBeDefined();
        expect(tcp.recommended).toBe('enabled');

        const filesystemIo = response.assessments.find(
            i => i.id === 'filesystems-io-options'
        ) as OracleGenericParameterDriftResponseType;
        expect(filesystemIo).toBeDefined();
        expect(filesystemIo.recommended).toBe('setall');

        const multiblock = response.assessments.find(
            i => i.id === 'multiblock-readcount'
        ) as OracleGenericParameterDriftResponseType;
        expect(multiblock).toBeDefined();
        expect(multiblock.recommended).toBe('disabled');
    });

    it('should omit compute host/OS drift fields for NFS one-time WAD', async () => {
        const response = await fetchOracleOfflineAssessment(
            ACCOUNT_ID,
            resourceId,
            nfsInstanceId,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION
        );

        expect(response).toBeDefined();
        expect(response.metadata.storageProtocol).toBe('NFS');
        expect(response.assessments.find(i => i.id === 'transparent-hugepages')).toBeUndefined();
        expect(response.assessments.find(i => i.id === 'tcp-advanced-options')).toBeUndefined();
        expect(response.assessments.find(i => i.id === 'filesystems-io-options')).toBeUndefined();
        expect(response.assessments.find(i => i.id === 'multiblock-readcount')).toBeUndefined();

        // iSCSI-only and ASM-only golden-config entries must not leak into an NFS instance's
        // not-applicable stubs (GH-11848).
        const ids = response.assessments.map(assessment => assessment.id);
        expect(ids).not.toContain('multipath-io');
        expect(ids).not.toContain('iscsi-replacement-timeout');
        expect(ids).not.toContain('asm-setup');
        expect(ids).not.toContain('data-dg-lun-layout');
    });

    it('should include snapcenterSnapshot drift when rawdata.snapcenter is present', async () => {
        const snapcenterInstanceId = 'ORASNAP';
        await upsertDatabaseInstance(ACCOUNT_ID, createInstance(snapcenterInstanceId, 'iSCSI'));
        await bulkUpsertOfflineAssessments([
            {
                accountId: ACCOUNT_ID,
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                resourceId,
                databaseInstanceId: snapcenterInstanceId,
                databaseType: DATABASE_TYPE.oracle,
                rawdata: {
                    ...rawdataFor(),
                    snapcenter: {
                        isDataguardPrimary: false,
                        volumes: [
                            {
                                svmId: 'svm-offline',
                                svmName: 'wlmdb_svm_demo',
                                volumeId: 'vol-unprotected-1',
                                volumeName: 'unprotected_vol',
                                hasSnapcenterSnapshot: false,
                                foundInSnapcenterLogs: false
                            }
                        ],
                        standaloneCheck: { pluginServiceRunning: false, sidFoundInLogs: false },
                        errorMessage: ''
                    }
                },
                mappedOntapVolumes: mappedVolumesFor('iSCSI'),
                metadata: metadataFor(snapcenterInstanceId)
            }
        ]);

        const response = await fetchOracleOfflineAssessment(
            ACCOUNT_ID,
            resourceId,
            snapcenterInstanceId,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION
        );

        const snapcenter = response.assessments.find(
            a => a.type === 'resiliency'
        ) as OracleGenericParameterDriftResponseType;
        expect(snapcenter).toBeDefined();
        expect(snapcenter.name).toBeDefined();
        expect(snapcenter.status).toBe('not-optimized');
        expect(snapcenter.totalObjectsInViolation).toBe(1);
    });

    it('should recalculate from rawdata and not return stale legacy standalone assessment ids', async () => {
        const staleInstanceId = 'ORASTALE';
        await upsertDatabaseInstance(ACCOUNT_ID, createInstance(staleInstanceId, 'iSCSI'));
        await bulkUpsertOfflineAssessments([
            {
                accountId: ACCOUNT_ID,
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                resourceId,
                databaseInstanceId: staleInstanceId,
                databaseType: DATABASE_TYPE.oracle,
                rawdata: storageRawdataFor(),
                mappedOntapVolumes: mappedVolumesFor('iSCSI'),
                metadata: metadataFor(staleInstanceId),
                assessmentResults: staleLegacyAssessmentResults
            }
        ]);

        const response = await fetchOracleOfflineAssessment(
            ACCOUNT_ID,
            resourceId,
            staleInstanceId,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION
        );

        const ids = response.assessments.map(assessment => assessment.id);
        expect(ids).toContain('block-device-space-management');
        expect(ids).not.toContain('fractional-reserve');
        expect(ids).not.toContain('space-reservation-enabled');
        expect(ids).not.toContain('compression');
    });
});

function ontapPage<T>(records: T[]) {
    return { records, num_records: records.length };
}

function buildRelationship(ec2s: Ec2FsxRelationship['ec2s']): Ec2FsxRelationship {
    return { ec2s };
}

describe('triggerOracleUnregisteredAssessment', () => {
    beforeAll(() => {
        resetProxyOverrides();
    });

    afterAll(() => {
        vi.restoreAllMocks();
        resetProxyOverrides();
    });

    it('should register a job, persist a filtered unregistered record, and serve it back via the GET dispatch', async () => {
        const unregisteredEc2InstanceId = 'i-unregistered-oracle';
        const instanceName = 'ORAUNREG';
        const fsxFileSystemId = 'fs-unregistered-oracle';

        registerProxyGetResponse({
            targetId: fsxFileSystemId,
            ontapPath: 'api/storage/volumes',
            body: ontapPage([{ name: 'oradata_unreg', uuid: 'uuid-unreg-1', nas: { path: '/oradata_unreg' } }])
        });

        const relationship = buildRelationship([
            {
                instanceId: unregisteredEc2InstanceId,
                workloadTypes: [DATABASE_TYPE.oracle],
                workloads: [],
                fsxs: [
                    {
                        id: fsxFileSystemId,
                        fileSystemId: fsxFileSystemId,
                        region: DEFAULT_AWS_REGION,
                        volumes: [
                            {
                                id: 'vol-unreg-1',
                                fsxVolumeId: 'fsvol-unreg-1',
                                volumeUuid: 'uuid-unreg-1',
                                volumeName: 'oradata_unreg',
                                luns: []
                            }
                        ]
                    }
                ]
            }
        ]);
        vi.spyOn(taggingServiceOperations, 'buildEc2FsxRelationship').mockResolvedValue(relationship);

        const { jobId } = await triggerOracleUnregisteredAssessment(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            unregisteredEc2InstanceId,
            instanceName
        );
        await waitForJobCompletion(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION, jobId);

        const job = await prisma.client.job.findUnique({ where: { id: jobId } });
        expect(job?.status).toBe('COMPLETED');
        expect(job?.description).toBe(
            `One-time storage assessment for unregistered Oracle instance ${instanceName} on ${unregisteredEc2InstanceId}`
        );
        expect(job?.description).not.toContain('Review detailed findings and recommendations in.;');

        const subJobs = await prisma.client.job.findMany({ where: { parent_job_id: jobId } });
        expect(subJobs).toHaveLength(1);
        expect(subJobs[0].name).toBe('ONTAP volume/LUN storage assessment');
        expect(subJobs[0].status).toBe('COMPLETED');
        expect(subJobs[0].description).toContain('Review detailed findings and recommendations in.;');
        expect(JSON.parse(subJobs[0].description!.split(';')[1]).isUnregistered).toBe(true);

        const record = await getOfflineAssessment(ACCOUNT_ID, unregisteredEc2InstanceId, instanceName);
        expect((record?.metadata as any)?.source).toBe('unregistered');
        expect((record?.rawdata as any)?.ontapStorageAssessments).toHaveLength(1);

        // Fetching via the standard GET path confirms fetchOracleOfflineAssessment dispatches to
        // the unregistered-instance branch and that drift is filtered to volume/LUN/layout ids
        // only — sizing/OS-config ids (e.g. headroom) come back as not-applicable stubs instead.
        const response = await fetchOracleOfflineAssessment(
            ACCOUNT_ID,
            unregisteredEc2InstanceId,
            instanceName,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION
        );
        expect(response.metadata.storageProtocol).toBe('NFS');

        const byId = new Map(response.assessments.map(a => [a.id, a as { errorMessage?: string }] as const));
        expect(byId.get('thin-provision')).toBeDefined();
        expect(byId.get('thin-provision')?.errorMessage).not.toBe(ONE_TIME_WAD_NOT_APPLICABLE_MESSAGE);
        expect(byId.get('headroom')?.errorMessage).toBe(ONE_TIME_WAD_NOT_APPLICABLE_MESSAGE);

        // Volume-placement checks fabricate a file-type->volume mapping in the unregistered flow
        // (no real host/SQL data), so they must be skipped and fall back to not-applicable stubs
        // instead of reporting bogus violations.
        for (const id of [
            'archive-placement',
            'datafiles-placement',
            'controlfiles-placement',
            'redologs-placement',
            'templogs-placement',
            'oracle-binary-placement'
        ]) {
            expect(byId.get(id)?.errorMessage).toBe(ONE_TIME_WAD_NOT_APPLICABLE_MESSAGE);
        }
    }, 15000);

    it('should include a headroom item computed from collected ONTAP aggregates', async () => {
        const unregisteredEc2InstanceId = 'i-unregistered-oracle-headroom-asm';
        const instanceName = 'ORAUNREGHA';
        const fsxFileSystemId = 'fs-unregistered-oracle-ha';

        registerProxyGetResponse({
            targetId: fsxFileSystemId,
            ontapPath: 'api/storage/volumes',
            body: ontapPage([{ name: 'oradata_unreg_ha', uuid: 'uuid-unreg-ha-1', nas: { path: '/oradata_unreg_ha' } }])
        });
        registerProxyGetResponse({
            targetId: fsxFileSystemId,
            ontapPath: 'api/storage/aggregates',
            body: ontapPage([
                { space: { block_storage: { size: 1_000_000_000, used: 400_000_000, available: 600_000_000 } } }
            ])
        });

        const relationship = buildRelationship([
            {
                instanceId: unregisteredEc2InstanceId,
                workloadTypes: [DATABASE_TYPE.oracle],
                workloads: [],
                fsxs: [
                    {
                        id: fsxFileSystemId,
                        fileSystemId: fsxFileSystemId,
                        region: DEFAULT_AWS_REGION,
                        volumes: [
                            {
                                id: 'vol-unreg-ha-1',
                                fsxVolumeId: 'fsvol-unreg-ha-1',
                                volumeUuid: 'uuid-unreg-ha-1',
                                volumeName: 'oradata_unreg_ha',
                                luns: []
                            }
                        ]
                    }
                ]
            }
        ]);
        vi.spyOn(taggingServiceOperations, 'buildEc2FsxRelationship').mockResolvedValue(relationship);

        const { jobId } = await triggerOracleUnregisteredAssessment(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            unregisteredEc2InstanceId,
            instanceName
        );
        await waitForJobCompletion(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION, jobId);

        const response = await fetchOracleOfflineAssessment(
            ACCOUNT_ID,
            unregisteredEc2InstanceId,
            instanceName,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION
        );

        const headroom = response.assessments.find(a => a.id === 'headroom') as { errorMessage?: string };
        expect(headroom).toBeDefined();
        expect(headroom.errorMessage).not.toBe(ONE_TIME_WAD_NOT_APPLICABLE_MESSAGE);
    }, 15000);

    it('should not leak iSCSI/ASM not-applicable stubs when ONTAP collection yields no filesystem/protocol data', async () => {
        // No filesystemId and no mappedOntapVolumes entry means storageProtocol/isASMManaged
        // can't be resolved, mirroring a collection that ran with limited permissions.
        const record = {
            rawdata: {
                ontapStorageAssessments: [{ volumes: { error: '', data: [], filesystemId: undefined } }]
            },
            metadata: { databaseInstanceName: 'ORAUNREGNOPROTO', ec2InstanceId: 'i-unregistered-oracle-no-protocol' },
            created_time: new Date()
        } as unknown as OfflineAssessmentDBSchema;

        const response = await fetchOracleUnregisteredInstanceAssessment(
            ACCOUNT_ID,
            'i-unregistered-oracle-no-protocol',
            'ORAUNREGNOPROTO',
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            record
        );

        const notApplicableIds = response.assessments
            .filter(a => (a as { errorMessage?: string }).errorMessage === ONE_TIME_WAD_NOT_APPLICABLE_MESSAGE)
            .map(a => a.id);
        expect(notApplicableIds).not.toContain('multipath-io');
        expect(notApplicableIds).not.toContain('asm-setup');
        expect(notApplicableIds).not.toContain('nfs-rootonly');
    });

    it('should fail the job with no-data message when there is no EC2-FSx relationship for the instance', async () => {
        const unregisteredEc2InstanceId = 'i-unregistered-oracle-no-relationship';
        const instanceName = 'ORANOREL';

        vi.spyOn(taggingServiceOperations, 'buildEc2FsxRelationship').mockResolvedValue(buildRelationship([]));

        const { jobId } = await triggerOracleUnregisteredAssessment(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            unregisteredEc2InstanceId,
            instanceName
        );

        await waitForJobCompletion(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION, jobId);

        const job = await prisma.client.job.findUnique({ where: { id: jobId } });
        expect(job?.status).toBe('FAILED');
        expect(job?.error).toContain('No assessable data collected');
    }, 15000);
});

describe('fetchOracleOfflineAssessmentPerAccount', () => {
    const unregisteredEc2InstanceId = 'i-unregistered-oracle-list';
    const unregisteredInstanceName = 'ORAUNREGLIST';

    beforeAll(async () => {
        // Seed an unregistered-instance record directly (bypassing the job flow) alongside the
        // file-upload records already seeded in the outer beforeAll.
        await bulkUpsertOfflineAssessments([
            {
                accountId: ACCOUNT_ID,
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                resourceId: unregisteredEc2InstanceId,
                databaseInstanceId: unregisteredInstanceName,
                databaseType: DATABASE_TYPE.oracle,
                rawdata: { ontapStorageAssessments: [] },
                metadata: {
                    source: OFFLINE_ASSESSMENT_SOURCE.UNREGISTERED,
                    databaseInstanceName: unregisteredInstanceName,
                    ec2InstanceId: unregisteredEc2InstanceId,
                    assessmentTimestamp: new Date().toISOString()
                }
            }
        ]);
    });

    it('should include unregistered-instance rows alongside file-upload rows and report a count matching all items', async () => {
        const response = await fetchOracleOfflineAssessmentPerAccount(
            ACCOUNT_ID,
            50,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION
        );

        expect(response.items.map(item => item.databaseInstanceId)).toContain(unregisteredInstanceName);
        expect(response.items.map(item => item.databaseInstanceId)).toContain(iscsiInstanceId);
        expect(response.items.map(item => item.databaseInstanceId)).toContain(nfsInstanceId);
        expect(response.count).toBe(response.items.length);

        const unregisteredItem = response.items.find(item => item.databaseInstanceId === unregisteredInstanceName);
        expect(unregisteredItem && 'assessments' in unregisteredItem).toBe(true);
        expect(
            (unregisteredItem as { assessments?: { metadata: { source?: string } } })?.assessments?.metadata.source
        ).toBe(OFFLINE_ASSESSMENT_SOURCE.UNREGISTERED);
    });
});
