import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DATABASE_TYPE } from '@prisma/client';

import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import { ORACLE_STORAGE_ASSESSMENT_DATA } from '../../../../src/utils/demo-utils/demoMockdata';
import { createResource, deleteResource, upsertDatabaseInstance } from '../../../../src/lib/database/db';
import { bulkUpsertOfflineAssessments } from '../../../../src/lib/database/offline-assessment';
import { fetchOracleOfflineAssessment } from '../../../../src/operations/continuous-optimization/oracle/offline-assessment-operations';
import { OracleGenericParameterDriftResponseType } from '../../../../src/routes/types/oracle-continuous-optimization.types';

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

    it('should short-circuit snapcenter drift when DataGuard primary', async () => {
        const dgPrimaryInstanceId = 'ORADGPRIM';
        await upsertDatabaseInstance(ACCOUNT_ID, createInstance(dgPrimaryInstanceId, 'iSCSI'));
        await bulkUpsertOfflineAssessments([
            {
                accountId: ACCOUNT_ID,
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                resourceId,
                databaseInstanceId: dgPrimaryInstanceId,
                databaseType: DATABASE_TYPE.oracle,
                rawdata: {
                    ...rawdataFor(),
                    snapcenter: {
                        isDataguardPrimary: true,
                        volumes: [],
                        standaloneCheck: { pluginServiceRunning: false, sidFoundInLogs: false },
                        errorMessage: ''
                    }
                },
                mappedOntapVolumes: mappedVolumesFor('iSCSI'),
                metadata: metadataFor(dgPrimaryInstanceId)
            }
        ]);

        const response = await fetchOracleOfflineAssessment(
            ACCOUNT_ID,
            resourceId,
            dgPrimaryInstanceId,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION
        );

        expect(response.assessments.find(a => a.type === 'resiliency')).toBeUndefined();
    });
});
