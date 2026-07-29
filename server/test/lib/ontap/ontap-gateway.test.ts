import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DescribeFileSystemsCommandOutput } from '@aws-sdk/client-fsx';
import * as fsxLib from '../../../src/lib/aws/fsx';
import {
    callOntapApi,
    getClusterInfo,
    getClusterJobStatus,
    callOntapAndPollJob,
    collectAllOntapRecords,
    collectOntapRecordsBatched,
    getLunBySerialNumber,
    getVolumeByName,
    getCifsShareVolumes,
    addInitiatorsToIgroup
} from '../../../src/lib/ontap/ontap-gateway';
import {
    registerProxyGetResponse,
    registerProxyGetResponseSequence,
    registerProxyPatchResponse,
    resetProxyOverrides,
    getCapturedProxyGetUris
} from '../../simulator/scopes/cloud-manager/proxy-forwarder-scope';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';

const TEST_FSX_ID = 'fs-0test1234567890ab';
const MANAGEMENT_DNS_NAME = `management.${TEST_FSX_ID}.fsx.${DEFAULT_AWS_REGION}.amazonaws.com`;
const GATEWAY_TARGET = {
    accountId: ACCOUNT_ID,
    credentialsId: CREDENTIALS_ID,
    region: DEFAULT_AWS_REGION,
    fsxId: TEST_FSX_ID
};

/**
 * Mocks the endpoint-resolution lookup. Pass `persist: true` for tests that resolve the endpoint
 * more than once (e.g. `callOntapAndPollJob` = mutation + poll).
 */
function mockManagementEndpoint(
    management: { dnsName?: string; ipAddresses?: string[] } = { dnsName: MANAGEMENT_DNS_NAME },
    persist = false
) {
    const resolvedValue: DescribeFileSystemsCommandOutput = {
        $metadata: {},
        FileSystems: [
            {
                FileSystemId: TEST_FSX_ID,
                Lifecycle: 'AVAILABLE',
                OntapConfiguration: {
                    Endpoints: {
                        Management: { DNSName: management.dnsName, IpAddresses: management.ipAddresses }
                    }
                }
            }
        ]
    };
    const spy = vi.spyOn(fsxLib, 'describeFSx');
    if (persist) {
        spy.mockResolvedValue(resolvedValue);
    } else {
        spy.mockResolvedValueOnce(resolvedValue);
    }
    return spy;
}

describe('ONTAP gateway', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        resetProxyOverrides();
    });

    describe('callOntapApi', () => {
        it('should resolve the FSx management endpoint and forward the ONTAP REST call', async () => {
            mockManagementEndpoint();
            registerProxyGetResponse({
                targetId: TEST_FSX_ID,
                ontapPath: 'api/storage/volumes',
                body: { records: [{ name: 'vol1' }], num_records: 1 }
            });

            const response = await callOntapApi<{ records: { name: string }[]; num_records: number }>({
                ...GATEWAY_TARGET,
                path: 'api/storage/volumes'
            });

            expect(response).toEqual({ records: [{ name: 'vol1' }], num_records: 1 });
        });

        it('should fall back to the management IP address when no DNS name is available', async () => {
            mockManagementEndpoint({ ipAddresses: ['172.31.255.204'] });
            registerProxyGetResponse({
                targetId: TEST_FSX_ID,
                ontapPath: 'api/cluster',
                body: { name: 'cluster1' }
            });

            const response = await callOntapApi<{ name: string }>({ ...GATEWAY_TARGET, path: 'api/cluster' });

            expect(response.name).toBe('cluster1');
        });

        it('should reject when the FSx management endpoint cannot be resolved', async () => {
            mockManagementEndpoint({});

            await expect(callOntapApi({ ...GATEWAY_TARGET, path: 'api/storage/volumes' })).rejects.toThrow(
                'Unable to resolve ONTAP management endpoint'
            );
        });
    });

    describe('getClusterInfo', () => {
        it('should fetch ONTAP cluster identity and version info', async () => {
            mockManagementEndpoint();
            registerProxyGetResponse({
                targetId: TEST_FSX_ID,
                ontapPath: 'api/cluster',
                body: {
                    name: 'cluster1',
                    uuid: 'a1b2c3d4-1234-5678-9abc-def012345678',
                    version: { generation: 9, major: 13, minor: 1, full: 'NetApp Release 9.13.1' }
                }
            });

            const clusterInfo = await getClusterInfo(GATEWAY_TARGET);

            expect(clusterInfo).toEqual({
                name: 'cluster1',
                uuid: 'a1b2c3d4-1234-5678-9abc-def012345678',
                version: { generation: 9, major: 13, minor: 1, full: 'NetApp Release 9.13.1' }
            });
        });
    });

    describe('getClusterJobStatus', () => {
        const JOB_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef0123456789';
        const JOB_PATH = `api/cluster/jobs/${JOB_UUID}`;

        it('should resolve immediately when the job is already in a terminal success state', async () => {
            const describeSpy = mockManagementEndpoint();
            registerProxyGetResponse({
                targetId: TEST_FSX_ID,
                ontapPath: JOB_PATH,
                body: { uuid: JOB_UUID, state: 'success' }
            });

            const job = await getClusterJobStatus(GATEWAY_TARGET, JOB_UUID);

            expect(job).toEqual({ uuid: JOB_UUID, state: 'success' });
            expect(describeSpy).toHaveBeenCalledTimes(1);
        });

        it('should keep polling until the job reaches a terminal success state', async () => {
            const describeSpy = mockManagementEndpoint();
            registerProxyGetResponseSequence({
                targetId: TEST_FSX_ID,
                ontapPath: JOB_PATH,
                responses: [
                    { body: { uuid: JOB_UUID, state: 'running' } },
                    { body: { uuid: JOB_UUID, state: 'running' } },
                    { body: { uuid: JOB_UUID, state: 'success', message: 'done' } }
                ]
            });

            const job = await getClusterJobStatus(GATEWAY_TARGET, JOB_UUID, { intervalMs: 1 });

            expect(job).toEqual({ uuid: JOB_UUID, state: 'success', message: 'done' });
            expect(describeSpy).toHaveBeenCalledTimes(1);
        });

        it('should reject when the job reaches a terminal failure state', async () => {
            mockManagementEndpoint();
            registerProxyGetResponse({
                targetId: TEST_FSX_ID,
                ontapPath: JOB_PATH,
                body: { uuid: JOB_UUID, state: 'failure', message: 'volume creation failed' }
            });

            await expect(getClusterJobStatus(GATEWAY_TARGET, JOB_UUID, { intervalMs: 1 })).rejects.toThrow(
                `ONTAP job ${JOB_UUID} failed: volume creation failed`
            );
        });

        it('should reject once timeoutMs elapses without reaching a terminal state', async () => {
            const describeSpy = mockManagementEndpoint();
            registerProxyGetResponse({
                targetId: TEST_FSX_ID,
                ontapPath: JOB_PATH,
                body: { uuid: JOB_UUID, state: 'running' }
            });

            await expect(
                getClusterJobStatus(GATEWAY_TARGET, JOB_UUID, {
                    timeoutMs: 150,
                    intervalMs: 1
                })
            ).rejects.toThrow(`Timed out waiting for ONTAP job ${JOB_UUID}`);
            expect(describeSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('callOntapAndPollJob', () => {
        const JOB_UUID = 'b2c3d4e5-f6a7-8901-bcde-f01234567890';
        const PATCH_PATH = 'api/storage/volumes';
        const JOB_PATH = `api/cluster/jobs/${JOB_UUID}`;

        it('should poll the cluster job when PATCH returns a job uuid', async () => {
            mockManagementEndpoint(undefined, true);
            registerProxyPatchResponse({
                targetId: TEST_FSX_ID,
                ontapPath: PATCH_PATH,
                body: { job: { uuid: JOB_UUID }, num_records: 1 }
            });
            registerProxyGetResponse({
                targetId: TEST_FSX_ID,
                ontapPath: JOB_PATH,
                body: { uuid: JOB_UUID, state: 'success' }
            });

            const response = await callOntapAndPollJob<{ job?: { uuid?: string }; num_records?: number }>({
                ...GATEWAY_TARGET,
                path: PATCH_PATH,
                method: 'PATCH',
                body: { guarantee: { type: 'none' } }
            });

            expect(response).toEqual({ job: { uuid: JOB_UUID }, num_records: 1 });
            expect(getCapturedProxyGetUris().some(uri => uri.includes(JOB_PATH))).toBe(true);
        });

        it('should skip polling when PATCH has no job uuid', async () => {
            mockManagementEndpoint();
            registerProxyPatchResponse({
                targetId: TEST_FSX_ID,
                ontapPath: PATCH_PATH,
                body: { num_records: 2 }
            });

            const response = await callOntapAndPollJob<{ num_records?: number }>({
                ...GATEWAY_TARGET,
                path: PATCH_PATH,
                body: { guarantee: { type: 'none' } }
            });

            expect(response).toEqual({ num_records: 2 });
            expect(getCapturedProxyGetUris().some(uri => uri.includes('api/cluster/jobs/'))).toBe(false);
        });
    });

    describe('collectAllOntapRecords', () => {
        const BASE = { accountId: ACCOUNT_ID, targetId: TEST_FSX_ID, endpoint: MANAGEMENT_DNS_NAME };
        const VOLUMES_PATH = 'api/storage/volumes';

        it('should follow _links.next.href to collect records across pages', async () => {
            registerProxyGetResponseSequence({
                targetId: TEST_FSX_ID,
                ontapPath: VOLUMES_PATH,
                responses: [
                    {
                        body: {
                            num_records: 1,
                            records: [{ name: 'vol1' }],
                            _links: { next: { href: `/${VOLUMES_PATH}?start.uuid=vol2` } }
                        }
                    },
                    { body: { num_records: 1, records: [{ name: 'vol2' }] } }
                ]
            });

            const records = await collectAllOntapRecords<{ name: string }>(BASE, VOLUMES_PATH);

            expect(records).toEqual([{ name: 'vol1' }, { name: 'vol2' }]);
        });
    });

    describe('collectOntapRecordsBatched', () => {
        const BASE = { accountId: ACCOUNT_ID, targetId: TEST_FSX_ID, endpoint: MANAGEMENT_DNS_NAME };

        it('should chunk filter values into batches and flatten the results', async () => {
            const filterValues = Array.from({ length: 30 }, (_, i) => `vol-${i}`);
            registerProxyGetResponse({
                targetId: TEST_FSX_ID,
                ontapPath: 'api/storage/volumes',
                body: { num_records: 1, records: [{ name: 'vol1' }] }
            });

            const records = await collectOntapRecordsBatched<{ name: string }>(
                BASE,
                'api/storage/volumes',
                'uuid',
                filterValues,
                {}
            );

            expect(records).toEqual([{ name: 'vol1' }, { name: 'vol1' }]);
        });
    });

    describe('getLunBySerialNumber', () => {
        it('should resolve the FSx endpoint and fetch LUN records by serial number', async () => {
            mockManagementEndpoint();
            registerProxyGetResponse({
                targetId: TEST_FSX_ID,
                ontapPath: 'api/storage/luns',
                body: {
                    num_records: 1,
                    records: [{ uuid: 'lun-uuid-1', name: '/vol/vol1/sqldata', serial_number: 'SERIAL1' }]
                }
            });

            const records = await getLunBySerialNumber(GATEWAY_TARGET, ['SERIAL1']);

            expect(records).toEqual([{ uuid: 'lun-uuid-1', name: '/vol/vol1/sqldata', serial_number: 'SERIAL1' }]);
        });

        it('should return an empty array without making a request when serialNumbers is empty', async () => {
            const records = await getLunBySerialNumber(GATEWAY_TARGET, []);

            expect(records).toEqual([]);
        });
    });

    describe('getVolumeByName', () => {
        it('should resolve the FSx endpoint and fetch volume records by name', async () => {
            mockManagementEndpoint();
            registerProxyGetResponse({
                targetId: TEST_FSX_ID,
                ontapPath: 'api/storage/volumes',
                body: { num_records: 1, records: [{ uuid: 'vol-uuid-1', name: 'vol1', snapshot_count: 2 }] }
            });

            const records = await getVolumeByName(GATEWAY_TARGET, ['vol1'], { fields: 'space.size' });

            expect(records).toEqual([{ uuid: 'vol-uuid-1', name: 'vol1', snapshot_count: 2 }]);
        });

        it('should return an empty array without making a request when names is empty', async () => {
            const records = await getVolumeByName(GATEWAY_TARGET, []);

            expect(records).toEqual([]);
        });
    });

    describe('getCifsShareVolumes', () => {
        it('should resolve the FSx endpoint and fetch the volume backing each CIFS share', async () => {
            mockManagementEndpoint();
            registerProxyGetResponse({
                targetId: TEST_FSX_ID,
                ontapPath: 'api/protocols/cifs/shares',
                body: { num_records: 1, records: [{ volume: { uuid: 'vol-uuid-2', name: 'share1' } }] }
            });

            const records = await getCifsShareVolumes(GATEWAY_TARGET, ['share1']);

            expect(records).toEqual([{ volume: { uuid: 'vol-uuid-2', name: 'share1' } }]);
        });

        it('should return an empty array without making a request when shareNames is empty', async () => {
            const records = await getCifsShareVolumes(GATEWAY_TARGET, []);

            expect(records).toEqual([]);
        });
    });

    describe('addInitiatorsToIgroup', () => {
        it('should POST initiator records to the igroup initiators endpoint', async () => {
            mockManagementEndpoint();

            await expect(
                addInitiatorsToIgroup(GATEWAY_TARGET, 'igroup-uuid-1', ['iqn.1991-05.com.microsoft:host1'])
            ).resolves.toBeUndefined();
        });

        it('should no-op without calling the proxy when initiatorNames is empty', async () => {
            await expect(addInitiatorsToIgroup(GATEWAY_TARGET, 'igroup-uuid-1', [])).resolves.toBeUndefined();
        });
    });
});
