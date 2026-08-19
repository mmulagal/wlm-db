import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAndMapLunsForDiskGroups } from '../../../../src/operations/continuous-optimization/oracle/storage-layout-provision';
import {
    registerProxyGetResponse,
    registerProxyPostResponseSequence,
    resetProxyOverrides,
    getCapturedProxyPostUris,
    getCapturedProxyPostBodies,
    getCapturedProxyDeleteUris
} from '../../../simulator/scopes/cloud-manager/proxy-forwarder-scope';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';

vi.mock('../../../../src/utils/utils', async importOriginal => {
    const actual = await importOriginal<typeof import('../../../../src/utils/utils')>();
    return { ...actual, sleep: vi.fn().mockResolvedValue(undefined) };
});

const TEST_FSX_ID = 'fs-0layouttest1234567';
const TARGET = {
    accountId: ACCOUNT_ID,
    credentialsId: CREDENTIALS_ID,
    region: DEFAULT_AWS_REGION,
    fsxId: TEST_FSX_ID
};
const INITIATOR_IQN = 'iqn.1998-01.com.oracle:host1';

function diskGroup(overrides: Partial<{ diskGroupName: string; svmName: string; volumeNames: string[] }> = {}) {
    return {
        diskGroupName: overrides.diskGroupName ?? 'DATADG',
        svmName: overrides.svmName ?? 'svm1',
        lunsToAdd: overrides.volumeNames?.length ?? 1,
        volumeNames: overrides.volumeNames ?? ['wlmdb_DATADG_1']
    };
}

describe('createAndMapLunsForDiskGroups', () => {
    afterEach(() => {
        resetProxyOverrides();
    });

    it('creates volume/LUN/mapping and fetches the serial number on the happy path', async () => {
        registerProxyGetResponse({
            targetId: TEST_FSX_ID,
            ontapPath: 'api/protocols/san/igroups',
            body: { records: [{ name: 'existing-igroup' }], num_records: 1 }
        });
        registerProxyGetResponse({
            targetId: TEST_FSX_ID,
            ontapPath: 'api/network/ip/interfaces',
            body: { records: [{ ip: { address: '10.0.0.5' } }], num_records: 1 }
        });
        registerProxyGetResponse({
            targetId: TEST_FSX_ID,
            ontapPath: 'api/storage/luns',
            body: {
                records: [
                    { name: '/vol/wlmdb_DATADG_1/lun1', serial_number: 'SERIAL123', space: { size: 5368709120 } }
                ],
                num_records: 1
            }
        });

        const result = await createAndMapLunsForDiskGroups(TARGET, [diskGroup()], ['BaselineLUN1'], INITIATOR_IQN);

        expect(result.DATADG.error).toBe('');
        expect(result.DATADG.luns).toEqual(['SERIAL123']);
        expect(result.DATADG.iscsi_ip).toBe('10.0.0.5');

        const postUris = getCapturedProxyPostUris();
        expect(postUris.some(uri => uri.includes('api/storage/volumes'))).toBe(true);
        expect(postUris.some(uri => uri.includes('api/storage/luns'))).toBe(true);
        expect(postUris.some(uri => uri.includes('api/protocols/san/lun-maps'))).toBe(true);
        // Existing igroup found — no igroup POST should have fired.
        expect(postUris.some(uri => uri.includes('api/protocols/san/igroups'))).toBe(false);
    });

    it('creates a new igroup when none matches the initiator', async () => {
        registerProxyGetResponse({
            targetId: TEST_FSX_ID,
            ontapPath: 'api/protocols/san/igroups',
            body: { records: [], num_records: 0 }
        });
        registerProxyGetResponse({
            targetId: TEST_FSX_ID,
            ontapPath: 'api/network/ip/interfaces',
            body: { records: [{ ip: { address: '10.0.0.5' } }], num_records: 1 }
        });
        registerProxyGetResponse({
            targetId: TEST_FSX_ID,
            ontapPath: 'api/storage/luns',
            body: {
                records: [
                    { name: '/vol/wlmdb_DATADG_1/lun1', serial_number: 'SERIAL123', space: { size: 5368709120 } }
                ],
                num_records: 1
            }
        });

        const result = await createAndMapLunsForDiskGroups(TARGET, [diskGroup()], ['BaselineLUN1'], INITIATOR_IQN);

        expect(result.DATADG.error).toBe('');
        const postUris = getCapturedProxyPostUris();
        const postBodies = getCapturedProxyPostBodies() as Array<Record<string, unknown>>;
        const igroupPostIdx = postUris.findIndex(uri => uri.includes('api/protocols/san/igroups'));
        expect(igroupPostIdx).toBeGreaterThanOrEqual(0);
        expect(postBodies[igroupPostIdx]).toMatchObject({ name: INITIATOR_IQN, protocol: 'iscsi' });
    });

    it('retries LUN create on a transient 409 and succeeds', async () => {
        registerProxyGetResponse({
            targetId: TEST_FSX_ID,
            ontapPath: 'api/protocols/san/igroups',
            body: { records: [{ name: 'existing-igroup' }], num_records: 1 }
        });
        registerProxyGetResponse({
            targetId: TEST_FSX_ID,
            ontapPath: 'api/network/ip/interfaces',
            body: { records: [{ ip: { address: '10.0.0.5' } }], num_records: 1 }
        });
        registerProxyGetResponse({
            targetId: TEST_FSX_ID,
            ontapPath: 'api/storage/luns',
            body: {
                records: [
                    { name: '/vol/wlmdb_DATADG_1/lun1', serial_number: 'SERIAL123', space: { size: 5368709120 } }
                ],
                num_records: 1
            }
        });
        registerProxyPostResponseSequence({
            targetId: TEST_FSX_ID,
            ontapPath: 'api/storage/luns',
            responses: [
                { status: 409, body: { error: { message: 'volume still being created' } } },
                { status: 200, body: {} }
            ]
        });

        const result = await createAndMapLunsForDiskGroups(TARGET, [diskGroup()], ['BaselineLUN1'], INITIATOR_IQN);

        expect(result.DATADG.error).toBe('');
        expect(result.DATADG.luns).toEqual(['SERIAL123']);
        const lunPostCount = getCapturedProxyPostUris().filter(uri => uri.includes('api/storage/luns')).length;
        expect(lunPostCount).toBe(2);
    });

    it('throws instead of provisioning with a degenerate size when the LUN-size lookup finds no matching records', async () => {
        registerProxyGetResponse({
            targetId: TEST_FSX_ID,
            ontapPath: 'api/storage/luns',
            body: { records: [], num_records: 0 }
        });

        await expect(
            createAndMapLunsForDiskGroups(TARGET, [diskGroup()], ['BaselineLUN1'], INITIATOR_IQN)
        ).rejects.toThrow('No LUN size found');
        expect(getCapturedProxyPostUris().some(uri => uri.includes('api/storage/volumes'))).toBe(false);
    });

    it('records an error and leaves the volume orphaned — no delete/rollback call on partial failure', async () => {
        registerProxyGetResponse({
            targetId: TEST_FSX_ID,
            ontapPath: 'api/protocols/san/igroups',
            body: { records: [{ name: 'existing-igroup' }], num_records: 1 }
        });
        registerProxyGetResponse({
            targetId: TEST_FSX_ID,
            ontapPath: 'api/network/ip/interfaces',
            body: { records: [{ ip: { address: '10.0.0.5' } }], num_records: 1 }
        });
        registerProxyGetResponse({
            targetId: TEST_FSX_ID,
            ontapPath: 'api/storage/luns',
            body: { records: [{ space: { size: 5368709120 } }], num_records: 1 }
        });
        registerProxyPostResponseSequence({
            targetId: TEST_FSX_ID,
            ontapPath: 'api/storage/luns',
            responses: [{ status: 500, body: { error: { message: 'internal error' } } }]
        });

        const result = await createAndMapLunsForDiskGroups(TARGET, [diskGroup()], ['BaselineLUN1'], INITIATOR_IQN);

        expect(result.DATADG.error).not.toBe('');
        expect(result.DATADG.luns).toEqual([]);
        // Volume create itself succeeded (default mock) but the LUN create failed permanently —
        // assert no DELETE call was made to clean up the now-orphaned volume.
        expect(getCapturedProxyDeleteUris()).toEqual([]);
    });

    it('processes multiple disk groups independently, continuing after one disk group fails', async () => {
        registerProxyGetResponse({
            targetId: TEST_FSX_ID,
            ontapPath: 'api/protocols/san/igroups',
            body: { records: [{ name: 'existing-igroup' }], num_records: 1 }
        });
        registerProxyGetResponse({
            targetId: TEST_FSX_ID,
            ontapPath: 'api/network/ip/interfaces',
            body: { records: [{ ip: { address: '10.0.0.5' } }], num_records: 1 }
        });
        registerProxyGetResponse({
            targetId: TEST_FSX_ID,
            ontapPath: 'api/storage/luns',
            body: {
                records: [
                    { name: '/vol/wlmdb_RECO_1/lun1', serial_number: 'RECO_SERIAL', space: { size: 5368709120 } }
                ],
                num_records: 1
            }
        });
        registerProxyPostResponseSequence({
            targetId: TEST_FSX_ID,
            ontapPath: 'api/storage/volumes',
            responses: [
                { status: 500, body: { error: { message: 'volume create failed' } } },
                { status: 500, body: { error: { message: 'volume create failed' } } },
                { status: 500, body: { error: { message: 'volume create failed' } } },
                { status: 500, body: { error: { message: 'volume create failed' } } },
                { status: 200, body: {} }
            ]
        });

        const result = await createAndMapLunsForDiskGroups(
            TARGET,
            [
                diskGroup({ diskGroupName: 'DATA', svmName: 'svm1', volumeNames: ['wlmdb_DATA_1'] }),
                diskGroup({ diskGroupName: 'RECO', svmName: 'svm1', volumeNames: ['wlmdb_RECO_1'] })
            ],
            ['BaselineLUN1'],
            INITIATOR_IQN
        );

        expect(result.DATA.error).not.toBe('');
        expect(result.DATA.luns).toEqual([]);
        expect(result.RECO.error).toBe('');
        expect(result.RECO.luns).toEqual(['RECO_SERIAL']);
    });
});
