import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    promoteVolumeEfficiency,
    getOntapVolumeEfficiency,
    getOntapExportPolicyRules,
    createOntapExportPolicy,
    createOntapIgroup,
    getOntapIscsiInterfaceIp
} from '../../../src/operations/continuous-optimization/ontap-operations';
import {
    registerProxyGetResponse,
    registerProxyPostResponseSequence,
    resetProxyOverrides,
    getCapturedProxyGetUris,
    getCapturedProxyPostUris,
    getCapturedProxyPostBodies
} from '../../simulator/scopes/cloud-manager/proxy-forwarder-scope';
import { ACCOUNT_ID, DEFAULT_AWS_REGION } from '../../utils/consts';

const TEST_FSX_ID = 'fs-0test1234567890ab';
const MANAGEMENT_DNS_NAME = `management.${TEST_FSX_ID}.fsx.${DEFAULT_AWS_REGION}.amazonaws.com`;
const BASE = { accountId: ACCOUNT_ID, targetId: TEST_FSX_ID, endpoint: MANAGEMENT_DNS_NAME };

describe('ONTAP operations', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        resetProxyOverrides();
    });

    describe('promoteVolumeEfficiency', () => {
        it('should POST the private-CLI promote request and poll the returned job', async () => {
            const JOB_UUID = 'd1e2f3a4-5678-90ab-cdef-123456789abc';
            registerProxyPostResponseSequence({
                targetId: TEST_FSX_ID,
                ontapPath: 'api/private/cli/volume/efficiency/promote',
                responses: [{ body: { job: { uuid: JOB_UUID } } }]
            });
            registerProxyGetResponse({
                targetId: TEST_FSX_ID,
                ontapPath: `api/cluster/jobs/${JOB_UUID}`,
                body: { uuid: JOB_UUID, state: 'success' }
            });

            await expect(promoteVolumeEfficiency(BASE, 'svm1', 'vol1')).resolves.toBeUndefined();

            expect(getCapturedProxyPostUris().some(uri => uri.includes('private/cli/volume/efficiency/promote'))).toBe(
                true
            );
            expect(getCapturedProxyPostUris().some(uri => uri.includes('privilege_level=advanced'))).toBe(true);
            expect(getCapturedProxyPostBodies().at(-1)).toEqual({ vserver: 'svm1', volume: 'vol1' });
        });

        it('should resolve without polling when the promote response has no job uuid', async () => {
            registerProxyPostResponseSequence({
                targetId: TEST_FSX_ID,
                ontapPath: 'api/private/cli/volume/efficiency/promote',
                responses: [{ body: {} }]
            });

            await expect(promoteVolumeEfficiency(BASE, 'svm1', 'vol1')).resolves.toBeUndefined();
            expect(getCapturedProxyGetUris().some(uri => uri.includes('api/cluster/jobs/'))).toBe(false);
        });
    });

    describe('getOntapVolumeEfficiency', () => {
        it('should fetch the volume efficiency state by svm/name', async () => {
            registerProxyGetResponse({
                targetId: TEST_FSX_ID,
                ontapPath: 'api/storage/volumes',
                body: { num_records: 1, records: [{ name: 'vol1', efficiency: { dedupe: 'inline' } }] }
            });

            const record = await getOntapVolumeEfficiency(BASE, 'svm1', 'vol1');

            expect(record).toEqual({ name: 'vol1', efficiency: { dedupe: 'inline' } });
        });

        it('should return undefined when no matching volume is found', async () => {
            registerProxyGetResponse({
                targetId: TEST_FSX_ID,
                ontapPath: 'api/storage/volumes',
                body: { num_records: 0, records: [] }
            });

            const record = await getOntapVolumeEfficiency(BASE, 'svm1', 'vol1');

            expect(record).toBeUndefined();
        });
    });

    describe('getOntapExportPolicyRules', () => {
        it('should fetch an export policy and return its rules', async () => {
            registerProxyGetResponse({
                targetId: TEST_FSX_ID,
                ontapPath: 'api/protocols/nfs/export-policies',
                body: { num_records: 1, records: [{ rules: [{ clients: [{ match: '10.0.0.1' }] }] }] }
            });

            const rules = await getOntapExportPolicyRules(BASE, 'svm1', 'default');

            expect(rules).toEqual([{ clients: [{ match: '10.0.0.1' }] }]);
        });

        it('should return an empty array when the policy has no rules', async () => {
            registerProxyGetResponse({
                targetId: TEST_FSX_ID,
                ontapPath: 'api/protocols/nfs/export-policies',
                body: { num_records: 0, records: [] }
            });

            const rules = await getOntapExportPolicyRules(BASE, 'svm1', 'missing-policy');

            expect(rules).toEqual([]);
        });
    });

    describe('createOntapExportPolicy', () => {
        it('should POST the export policy and poll the returned job before resolving', async () => {
            const JOB_UUID = 'e1f2a3b4-5678-90ab-cdef-123456789abc';
            registerProxyPostResponseSequence({
                targetId: TEST_FSX_ID,
                ontapPath: 'api/protocols/nfs/export-policies',
                responses: [{ body: { job: { uuid: JOB_UUID } } }]
            });
            registerProxyGetResponse({
                targetId: TEST_FSX_ID,
                ontapPath: `api/cluster/jobs/${JOB_UUID}`,
                body: { uuid: JOB_UUID, state: 'success' }
            });
            const body = { name: 'wlmdb_export_policy_1', svm: { name: 'svm1' }, rules: [] };

            await expect(createOntapExportPolicy(BASE, body)).resolves.toBeUndefined();

            expect(getCapturedProxyPostUris().some(uri => uri.includes('protocols/nfs/export-policies'))).toBe(true);
            expect(getCapturedProxyPostBodies().at(-1)).toEqual(body);
        });
    });

    describe('createOntapIgroup', () => {
        it('should POST the igroup body to the igroups endpoint', async () => {
            const body = {
                svm: { name: 'svm1' },
                name: 'iqn.1998-01.com.oracle:host1',
                protocol: 'iscsi',
                initiators: [{ name: 'iqn.1998-01.com.oracle:host1' }],
                os_type: 'linux'
            };

            await expect(createOntapIgroup(BASE, body)).resolves.toBeUndefined();

            expect(getCapturedProxyPostUris().some(uri => uri.includes('protocols/san/igroups'))).toBe(true);
            expect(getCapturedProxyPostBodies().at(-1)).toEqual(body);
        });
    });

    describe('getOntapIscsiInterfaceIp', () => {
        it('should fetch the iSCSI data-interface IP for an SVM, passing the wildcard services filter through', async () => {
            registerProxyGetResponse({
                targetId: TEST_FSX_ID,
                ontapPath: 'api/network/ip/interfaces',
                body: { num_records: 1, records: [{ ip: { address: '10.10.10.10' } }] }
            });

            const ip = await getOntapIscsiInterfaceIp(BASE, 'svm1');

            expect(ip).toBe('10.10.10.10');
            expect(getCapturedProxyGetUris().some(uri => uri.includes('services=*iscsi*'))).toBe(true);
        });

        it('should return undefined when no matching interface is found', async () => {
            registerProxyGetResponse({
                targetId: TEST_FSX_ID,
                ontapPath: 'api/network/ip/interfaces',
                body: { num_records: 0, records: [] }
            });

            const ip = await getOntapIscsiInterfaceIp(BASE, 'svm1');

            expect(ip).toBeUndefined();
        });
    });
});
