import { describe, it, expect } from 'vitest';
import { ConnectionStatus } from '@aws-sdk/client-ssm';
import { DatabaseTypes } from '../../src/utils/consts';
import {
    discoverEc2Instances,
    getTaggingServiceStorageForInstance,
    applyTaggingServiceStorage,
    applyTaggingServiceSqlServerStorage
} from '../../src/operations/discover-operations';
import { checkFsxLinkExists } from '../../src/lib/cloud-manager/fsx-core';
import {
    getRegistryOnlySqlServerInstances,
    getSqlServerInstancesFromRegistry
} from '../../src/operations/ssm-doc-operations';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../utils/consts';
import { DiscoverResponseInfoType, SqlServerInstanceInfoType } from '../../src/routes/types/discover.types';
import { SsmTargetsInfo, DiscoverySource } from '../../src/utils/common-types';
import { Ec2WithStorage } from '../../src/operations/cloud-manager/tagging-service-operations';

// Instance in ssm-instance-information.json — the only one the simulator marks as SSM-connected.
const CONNECTED_INSTANCE_ID = 'i-039eb3334526ae1ca';

// ─── discoverEc2Instances ────────────────────────────────────────────────────

describe('discoverEc2Instances', () => {
    it('returns at least one instance for MSSQL discovery', async () => {
        const { ec2Instances } = await discoverEc2Instances(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            [],
            undefined,
            undefined,
            [],
            DatabaseTypes.MS_SQL_SERVER
        );
        expect(ec2Instances.length).toBeGreaterThan(0);
    });

    it('stamps every returned MSSQL instance with a valid discovery source', async () => {
        const { ec2Instances } = await discoverEc2Instances(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            [],
            undefined,
            undefined,
            [],
            DatabaseTypes.MS_SQL_SERVER
        );
        for (const instance of ec2Instances) {
            expect(Object.values(DiscoverySource)).toContain(instance.source);
        }
    });

    it('returns instances for Oracle discovery, each with a valid source', async () => {
        const { ec2Instances } = await discoverEc2Instances(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            [],
            undefined,
            undefined,
            [],
            DatabaseTypes.ORACLE
        );
        expect(Array.isArray(ec2Instances)).toBe(true);
        for (const instance of ec2Instances) {
            expect(Object.values(DiscoverySource)).toContain(instance.source);
        }
    });
});

// ─── getSqlServerInstancesFromRegistry ──────────────────────────────────────

describe('getSqlServerInstancesFromRegistry', () => {
    it('returns a Map keyed by instance ID', async () => {
        const result = await getSqlServerInstancesFromRegistry(
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            [CONNECTED_INSTANCE_ID],
            ACCOUNT_ID
        );
        expect(result).toBeInstanceOf(Map);
    });

    it('returns an empty Map for an empty instance list without making SSM calls', async () => {
        const result = await getSqlServerInstancesFromRegistry(CREDENTIALS_ID, DEFAULT_AWS_REGION, [], ACCOUNT_ID);
        expect(result).toEqual(new Map());
    });
});

// ─── getRegistryOnlySqlServerInstances ──────────────────────────────────────

describe('getRegistryOnlySqlServerInstances', () => {
    const makeTarget = (overrides: Partial<SsmTargetsInfo> = {}): SsmTargetsInfo => ({
        ec2InstanceId: CONNECTED_INSTANCE_ID,
        ec2InstanceType: 'm5.large',
        ec2InstanceName: 'windows-host',
        ec2UsageOperation: 'RunInstances',
        ssmState: ConnectionStatus.CONNECTED,
        ebsVolumeIDs: [],
        source: DiscoverySource.TAGGING_SERVICE,
        hostManageReadiness: { extensiveRunPermission: false, canReadAWSSSMDocuments: true },
        ...overrides
    });

    it('excludes instances already reported via the script-based discovery path', async () => {
        const result = await getRegistryOnlySqlServerInstances(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            [makeTarget()],
            new Set([CONNECTED_INSTANCE_ID])
        );
        expect(result).toEqual([]);
    });

    it('excludes instances where extensiveRunPermission is already true', async () => {
        const result = await getRegistryOnlySqlServerInstances(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            [makeTarget({ hostManageReadiness: { extensiveRunPermission: true, canReadAWSSSMDocuments: true } })],
            new Set()
        );
        expect(result).toEqual([]);
    });

    it('excludes instances without canReadAWSSSMDocuments permission', async () => {
        const result = await getRegistryOnlySqlServerInstances(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            [makeTarget({ hostManageReadiness: { extensiveRunPermission: false, canReadAWSSSMDocuments: false } })],
            new Set()
        );
        expect(result).toEqual([]);
    });

    it('returns an array for eligible instances (granted registry access, denied broad SSM)', async () => {
        const result = await getRegistryOnlySqlServerInstances(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            [makeTarget()],
            new Set()
        );
        expect(Array.isArray(result)).toBe(true);
    });
});

// ─── getTaggingServiceStorageForInstance ─────────────────────────────────────

describe('getTaggingServiceStorageForInstance', () => {
    const fsxNameById = new Map<string | undefined, string | undefined>([['fs-abc123', 'sql-fsxn']]);
    const svmIdByFsxId = new Map<string | undefined, string | undefined>([['fs-abc123', 'svm-xyz789']]);

    it('prioritizes the FSx relationship over EBS attachment when both are available', () => {
        const ec2FsxRelationships: Ec2WithStorage[] = [
            {
                instanceId: CONNECTED_INSTANCE_ID,
                workloadTypes: ['mssql'],
                workloads: [],
                fsxs: [{ id: 'internal-1', fileSystemId: 'fs-abc123', region: DEFAULT_AWS_REGION, volumes: [] }]
            }
        ];

        const result = getTaggingServiceStorageForInstance(
            CONNECTED_INSTANCE_ID,
            ec2FsxRelationships,
            fsxNameById,
            svmIdByFsxId,
            ['vol-shouldnotbeused']
        );

        expect(result).toEqual([{ type: 'FSXN', id: 'fs-abc123', svmId: 'svm-xyz789', fileSystemName: 'sql-fsxn' }]);
    });

    it('falls back to deduplicated EBS volumes when there is no FSx relationship match', () => {
        const result = getTaggingServiceStorageForInstance(CONNECTED_INSTANCE_ID, [], fsxNameById, svmIdByFsxId, [
            'vol-0abc123',
            'vol-0def456',
            'vol-0abc123'
        ]);

        expect(result).toEqual([
            { type: 'EBS', id: 'vol-0abc123' },
            { type: 'EBS', id: 'vol-0def456' }
        ]);
    });

    it('returns an empty array when neither FSx nor EBS data is available', () => {
        const result = getTaggingServiceStorageForInstance(CONNECTED_INSTANCE_ID, [], fsxNameById, svmIdByFsxId, []);
        expect(result).toEqual([]);
    });
});

// ─── applyTaggingServiceStorage ────────────────────────────────────

describe('applyTaggingServiceStorage', () => {
    const storage: NonNullable<SqlServerInstanceInfoType['storage']> = [{ type: 'EBS', id: 'vol-0abc123' }];

    it('fills in storage for sqlServerInstances entries missing it', () => {
        const item = {
            ec2InstanceId: CONNECTED_INSTANCE_ID,
            sqlServerInstances: [{ sqlServerInstance: 'MSSQLSERVER' } as SqlServerInstanceInfoType]
        } as DiscoverResponseInfoType;

        applyTaggingServiceStorage(item.ec2InstanceId, item.sqlServerInstances, storage);

        expect(item.sqlServerInstances?.[0].storage).toEqual(storage);
    });

    it('never overwrites storage that is already populated', () => {
        const existingStorage: NonNullable<SqlServerInstanceInfoType['storage']> = [
            { type: 'FSXN', id: 'fs-precise123' }
        ];
        const item = {
            ec2InstanceId: CONNECTED_INSTANCE_ID,
            sqlServerInstances: [
                { sqlServerInstance: 'MSSQLSERVER', storage: existingStorage } as SqlServerInstanceInfoType
            ]
        } as DiscoverResponseInfoType;

        applyTaggingServiceStorage(item.ec2InstanceId, item.sqlServerInstances, storage);

        expect(item.sqlServerInstances?.[0].storage).toEqual(existingStorage);
    });

    it('is a no-op when the storage array is empty', () => {
        const item = {
            ec2InstanceId: CONNECTED_INSTANCE_ID,
            sqlServerInstances: [{ sqlServerInstance: 'MSSQLSERVER' } as SqlServerInstanceInfoType]
        } as DiscoverResponseInfoType;

        applyTaggingServiceStorage(item.ec2InstanceId, item.sqlServerInstances, []);

        expect(item.sqlServerInstances?.[0].storage).toBeUndefined();
    });

    it('should set storage on a restricted tagging-service host from its EC2 block device mappings', () => {
        const item = {
            ec2InstanceId: CONNECTED_INSTANCE_ID,
            source: DiscoverySource.TAGGING_SERVICE,
            hostManageReadiness: { extensiveRunPermission: false, canReadAWSSSMDocuments: true },
            sqlServerInstances: [{ sqlServerInstance: 'MSSQLSERVER' } as SqlServerInstanceInfoType]
        } as DiscoverResponseInfoType;
        const ssmTarget = {
            ec2InstanceId: CONNECTED_INSTANCE_ID,
            ebsVolumeIDs: ['vol-0restricted1', 'vol-0restricted2']
        } as SsmTargetsInfo;
        const scriptDiscoveredItem = {
            ec2InstanceId: CONNECTED_INSTANCE_ID,
            source: DiscoverySource.DISCOVER,
            sqlServerInstances: [{ sqlServerInstance: 'MSSQLSERVER' } as SqlServerInstanceInfoType]
        } as DiscoverResponseInfoType;

        applyTaggingServiceSqlServerStorage([item, scriptDiscoveredItem], [ssmTarget], [], new Map(), new Map());

        expect(item.sqlServerInstances?.[0].storage).toEqual([
            { type: 'EBS', id: 'vol-0restricted1' },
            { type: 'EBS', id: 'vol-0restricted2' }
        ]);
        expect(scriptDiscoveredItem.sqlServerInstances?.[0].storage).toBeUndefined();
    });
});

// ─── checkFsxLinkExists ──────────────────────────────────────────────────────

describe('checkFsxLinkExists', () => {
    it('returns an object with exists (boolean) and count (number) fields', async () => {
        const result = await checkFsxLinkExists(CREDENTIALS_ID, DEFAULT_AWS_REGION, 'fs-simulator-test');
        expect(result).toHaveProperty('exists');
        expect(result).toHaveProperty('count');
        expect(typeof result.exists).toBe('boolean');
        expect(typeof result.count).toBe('number');
    });

    it('returns { exists: true, count: 1 } when the simulator has active links', async () => {
        const result = await checkFsxLinkExists(CREDENTIALS_ID, DEFAULT_AWS_REGION, 'fs-no-active-links');
        expect(result).toEqual({ exists: true, count: 1 });
    });
});
