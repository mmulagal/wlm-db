import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DescribeFileSystemsCommandOutput } from '@aws-sdk/client-fsx';
import * as fsxLib from '../../../src/lib/aws/fsx';
import { applyOntapStorageFix } from '../../../src/operations/continuous-optimization/ontap-storage-fix-operations';
import { OptimizeStorageConfigs } from '../../../src/utils/continous-optimization-consts';
import { RESOURCESTYPE, AWS_FSX_TYPE } from '../../../src/utils/consts';
import * as utilsLib from '../../../src/utils/utils';
import {
    getCapturedProxyGetUris,
    getCapturedProxyPatchBodies,
    getCapturedProxyPatchUris,
    registerProxyGetResponse,
    registerProxyPatchResponse,
    registerProxyPatchResponseSequence,
    resetProxyOverrides
} from '../../simulator/scopes/cloud-manager/proxy-forwarder-scope';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';
import { resetCache } from '../../../src/utils/cache';

const FIRST_FSX_ID = 'fs-aaaa1111bbbb2222';
const SECOND_FSX_ID = 'fs-cccc3333dddd4444';
const MANAGEMENT_DNS_NAME = `management.${FIRST_FSX_ID}.fsx.${DEFAULT_AWS_REGION}.amazonaws.com`;

function mockManagementEndpoint(fsxId = FIRST_FSX_ID): void {
    const resolvedValue: DescribeFileSystemsCommandOutput = {
        $metadata: {},
        FileSystems: [
            {
                FileSystemId: fsxId,
                Lifecycle: 'AVAILABLE',
                OntapConfiguration: {
                    Endpoints: {
                        Management: { DNSName: MANAGEMENT_DNS_NAME, IpAddresses: ['172.31.0.100'] }
                    }
                }
            }
        ]
    };
    vi.spyOn(fsxLib, 'describeFSx').mockResolvedValue(resolvedValue);
}

describe('applyOntapStorageFix', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        resetProxyOverrides();
        resetCache(AWS_FSX_TYPE);
    });

    it('should use the first FSx id and poll when PATCH returns a job uuid', async () => {
        const JOB_UUID = 'c3d4e5f6-a7b8-9012-cdef-012345678901';
        const PATCH_PATH = 'api/storage/volumes';
        const JOB_PATH = `api/cluster/jobs/${JOB_UUID}`;
        const volumeUuid = 'vol-uuid-1';

        mockManagementEndpoint();
        registerProxyPatchResponse({
            targetId: FIRST_FSX_ID,
            ontapPath: PATCH_PATH,
            body: { job: { uuid: JOB_UUID }, num_records: 1 }
        });
        registerProxyGetResponse({
            targetId: FIRST_FSX_ID,
            ontapPath: JOB_PATH,
            body: { uuid: JOB_UUID, state: 'success' }
        });

        const results = await applyOntapStorageFix({
            accountId: ACCOUNT_ID,
            credentialsId: CREDENTIALS_ID,
            fsxId: `${FIRST_FSX_ID},${SECOND_FSX_ID}`,
            region: DEFAULT_AWS_REGION,
            svmName: 'svm1',
            configurationId: OptimizeStorageConfigs.THIN_PROVISIONING,
            resourceIds: [volumeUuid],
            resourceType: RESOURCESTYPE.MSSQL,
            useRest: true
        });

        expect(results).toEqual([{ resourceId: volumeUuid, success: true }]);
        expect(getCapturedProxyPatchUris().some(uri => uri.includes(`/targets/${FIRST_FSX_ID}/`))).toBe(true);
        expect(getCapturedProxyPatchUris().some(uri => uri.includes(`/targets/${SECOND_FSX_ID}/`))).toBe(false);
        expect(getCapturedProxyGetUris().some(uri => uri.includes(JOB_PATH))).toBe(true);
    });

    describe('Oracle name-based identifiers for THIN_PROVISIONING/FRACTIONAL_RESERVE', () => {
        it('should query by volume name (not uuid) for Oracle, via the private-CLI path, so a name-based match is found', async () => {
            const volumeName = 'oracle_data_vol_1';

            mockManagementEndpoint();
            registerProxyPatchResponse({
                targetId: FIRST_FSX_ID,
                ontapPath: 'api/private/cli/volume',
                body: { num_records: 1 }
            });

            const results = await applyOntapStorageFix({
                accountId: ACCOUNT_ID,
                credentialsId: CREDENTIALS_ID,
                fsxId: FIRST_FSX_ID,
                region: DEFAULT_AWS_REGION,
                svmName: 'svm1',
                configurationId: OptimizeStorageConfigs.THIN_PROVISIONING,
                resourceIds: [volumeName],
                resourceType: RESOURCESTYPE.ORACLE
            });

            expect(results).toEqual([{ resourceId: volumeName, success: true }]);
            const patchUri = getCapturedProxyPatchUris().find(uri => uri.includes('api/private/cli/volume'));
            expect(patchUri).toBeDefined();
            const decodedPatchUri = decodeURIComponent(patchUri as string);
            expect(decodedPatchUri).toContain(`volume=${volumeName}`);
            expect(decodedPatchUri).not.toContain('uuid=');
            expect(getCapturedProxyPatchUris().some(uri => uri.includes('api/storage/volumes'))).toBe(false);
        });

        it('should still query by uuid via the REST path for MSSQL', async () => {
            const volumeUuid = 'mssql-vol-uuid-1';

            mockManagementEndpoint();
            registerProxyPatchResponse({
                targetId: FIRST_FSX_ID,
                ontapPath: 'api/storage/volumes',
                body: { num_records: 1 }
            });

            const results = await applyOntapStorageFix({
                accountId: ACCOUNT_ID,
                credentialsId: CREDENTIALS_ID,
                fsxId: FIRST_FSX_ID,
                region: DEFAULT_AWS_REGION,
                svmName: 'svm1',
                configurationId: OptimizeStorageConfigs.FRACTIONAL_RESERVE,
                resourceIds: [volumeUuid],
                resourceType: RESOURCESTYPE.MSSQL,
                useRest: true
            });

            expect(results).toEqual([{ resourceId: volumeUuid, success: true }]);
            const patchUri = getCapturedProxyPatchUris().find(uri => uri.includes('api/storage/volumes'));
            expect(patchUri).toBeDefined();
            const decodedPatchUri = decodeURIComponent(patchUri as string);
            expect(decodedPatchUri).toContain(`uuid=${volumeUuid}`);
        });
    });

    describe('snapshot policy and tiering fixes', () => {
        const REST_PATH = 'api/storage/volumes';
        const CLI_PATH = 'api/private/cli/volume';

        it.each([
            {
                configurationId: OptimizeStorageConfigs.SNAPSHOT_POLICY,
                value: undefined,
                expectedBody: { snapshot_policy: { name: 'none' } }
            },
            {
                configurationId: OptimizeStorageConfigs.TIERING_POLICY,
                value: 'snapshot-only',
                expectedBody: { tiering: { policy: 'snapshot_only' } }
            },
            {
                configurationId: OptimizeStorageConfigs.TIERING_MINIMUM_COOLING_DAYS,
                value: '7',
                expectedBody: { tiering: { policy: 'auto', min_cooling_days: 7 } }
            }
        ])('should PATCH $configurationId by uuid via REST when useRest is set', async testCase => {
            const { configurationId, value, expectedBody } = testCase;
            const volumeUuid = 'mssql-vol-uuid';

            mockManagementEndpoint();
            registerProxyPatchResponse({ targetId: FIRST_FSX_ID, ontapPath: REST_PATH, body: { num_records: 1 } });

            const results = await applyOntapStorageFix({
                accountId: ACCOUNT_ID,
                credentialsId: CREDENTIALS_ID,
                fsxId: FIRST_FSX_ID,
                region: DEFAULT_AWS_REGION,
                svmName: 'svm1',
                configurationId,
                resourceIds: [volumeUuid],
                value,
                useRest: true
            });

            expect(results).toEqual([{ resourceId: volumeUuid, success: true }]);
            const patchUri = getCapturedProxyPatchUris().find(uri => uri.includes(REST_PATH));
            expect(patchUri).toBeDefined();
            expect(decodeURIComponent(patchUri as string)).toContain(`uuid=${volumeUuid}`);
            expect(getCapturedProxyPatchBodies()).toContainEqual(expectedBody);
        });

        it('should keep the private-CLI volume-name path when useRest is not set', async () => {
            const volumeName = 'oracle_tiering_vol';

            mockManagementEndpoint();
            registerProxyPatchResponse({ targetId: FIRST_FSX_ID, ontapPath: CLI_PATH, body: { num_records: 1 } });

            const results = await applyOntapStorageFix({
                accountId: ACCOUNT_ID,
                credentialsId: CREDENTIALS_ID,
                fsxId: FIRST_FSX_ID,
                region: DEFAULT_AWS_REGION,
                svmName: 'svm1',
                configurationId: OptimizeStorageConfigs.TIERING_POLICY,
                resourceIds: [volumeName],
                value: 'none',
                resourceType: RESOURCESTYPE.ORACLE
            });

            expect(results).toEqual([{ resourceId: volumeName, success: true }]);
            const patchUri = getCapturedProxyPatchUris().find(uri => uri.includes(CLI_PATH));
            expect(patchUri).toBeDefined();
            expect(decodeURIComponent(patchUri as string)).toContain(`volume=${volumeName}`);
            expect(getCapturedProxyPatchUris().some(uri => uri.includes(REST_PATH))).toBe(false);
        });
    });

    describe('efficiency target-state pre-check', () => {
        const EFFICIENCY_PATH = 'api/storage/volumes';

        it('should only PATCH the volume not already at the target efficiency state', async () => {
            const compliantVolume = 'vol-already-disabled';
            const nonCompliantVolume = 'vol-still-enabled';

            mockManagementEndpoint();
            registerProxyGetResponse({
                targetId: FIRST_FSX_ID,
                ontapPath: EFFICIENCY_PATH,
                body: {
                    records: [
                        { name: compliantVolume, uuid: 'uuid-1', efficiency: { state: 'disabled' } },
                        { name: nonCompliantVolume, uuid: 'uuid-2', efficiency: { state: 'enabled' } }
                    ],
                    num_records: 2
                }
            });
            registerProxyPatchResponse({ targetId: FIRST_FSX_ID, ontapPath: EFFICIENCY_PATH, body: {} });

            const results = await applyOntapStorageFix({
                accountId: ACCOUNT_ID,
                credentialsId: CREDENTIALS_ID,
                fsxId: FIRST_FSX_ID,
                region: DEFAULT_AWS_REGION,
                svmName: 'svm1',
                configurationId: OptimizeStorageConfigs.DEDUPLICATION,
                resourceIds: [compliantVolume, nonCompliantVolume],
                value: 'none'
            });

            expect(results).toEqual(
                expect.arrayContaining([
                    { resourceId: compliantVolume, success: true },
                    { resourceId: nonCompliantVolume, success: true }
                ])
            );
            expect(results).toHaveLength(2);

            const patchUri = getCapturedProxyPatchUris().find(uri => uri.includes(EFFICIENCY_PATH));
            expect(patchUri).toBeDefined();
            const decodedPatchUri = decodeURIComponent(patchUri as string);
            expect(decodedPatchUri).toContain(nonCompliantVolume);
            expect(decodedPatchUri).not.toContain(compliantVolume);
        });

        it('should skip the ONTAP PATCH entirely as a no-op success when all target volumes already have efficiency disabled', async () => {
            const firstVolume = 'vol-disabled-1';
            const secondVolume = 'vol-disabled-2';

            mockManagementEndpoint();
            registerProxyGetResponse({
                targetId: FIRST_FSX_ID,
                ontapPath: EFFICIENCY_PATH,
                body: {
                    records: [
                        { name: firstVolume, uuid: 'uuid-1', efficiency: { state: 'disabled' } },
                        { name: secondVolume, uuid: 'uuid-2', efficiency: { state: 'disabled' } }
                    ],
                    num_records: 2
                }
            });

            const results = await applyOntapStorageFix({
                accountId: ACCOUNT_ID,
                credentialsId: CREDENTIALS_ID,
                fsxId: FIRST_FSX_ID,
                region: DEFAULT_AWS_REGION,
                svmName: 'svm1',
                configurationId: OptimizeStorageConfigs.COMPACTION,
                resourceIds: [firstVolume, secondVolume],
                value: 'none'
            });

            expect(results).toEqual([
                { resourceId: firstVolume, success: true },
                { resourceId: secondVolume, success: true }
            ]);
            expect(getCapturedProxyPatchUris().some(uri => uri.includes(EFFICIENCY_PATH))).toBe(false);
        });
    });

    describe('pending ONTAP operation retry', () => {
        const EFFICIENCY_PATH = 'api/storage/volumes';

        it('should wait and retry when ONTAP reports a pending operation, succeeding once it clears', async () => {
            const volumeName = 'vol-pending-then-clear';
            const sleepSpy = vi.spyOn(utilsLib, 'sleep').mockResolvedValue(undefined);

            mockManagementEndpoint();
            registerProxyPatchResponseSequence({
                targetId: FIRST_FSX_ID,
                ontapPath: EFFICIENCY_PATH,
                responses: [
                    {
                        status: 500,
                        body: {
                            message: `Failed to disable efficiency on volume "${volumeName}": Operation is currently pending.`
                        }
                    },
                    { status: 200, body: {} }
                ]
            });

            const results = await applyOntapStorageFix({
                accountId: ACCOUNT_ID,
                credentialsId: CREDENTIALS_ID,
                fsxId: FIRST_FSX_ID,
                region: DEFAULT_AWS_REGION,
                svmName: 'svm1',
                configurationId: OptimizeStorageConfigs.DEDUPLICATION,
                resourceIds: [volumeName],
                value: 'inline'
            });

            expect(results).toEqual([{ resourceId: volumeName, success: true }]);
            expect(sleepSpy).toHaveBeenCalledTimes(1);
        });

        it('should fail with a clear message when a pending ONTAP operation never clears within the bounded wait', async () => {
            const volumeName = 'vol-pending-forever';
            const sleepSpy = vi.spyOn(utilsLib, 'sleep').mockResolvedValue(undefined);

            mockManagementEndpoint();
            registerProxyPatchResponse({
                targetId: FIRST_FSX_ID,
                ontapPath: EFFICIENCY_PATH,
                status: 500,
                body: {
                    message: `Failed to disable efficiency on volume "${volumeName}": Operation is currently pending.`
                }
            });

            const results = await applyOntapStorageFix({
                accountId: ACCOUNT_ID,
                credentialsId: CREDENTIALS_ID,
                fsxId: FIRST_FSX_ID,
                region: DEFAULT_AWS_REGION,
                svmName: 'svm1',
                configurationId: OptimizeStorageConfigs.DEDUPLICATION,
                resourceIds: [volumeName],
                value: 'inline'
            });

            expect(results).toEqual([
                {
                    resourceId: volumeName,
                    success: false,
                    failureReason: expect.stringContaining('Pending ONTAP operation')
                }
            ]);
            expect(sleepSpy).toHaveBeenCalledTimes(2);
        });
    });
});
