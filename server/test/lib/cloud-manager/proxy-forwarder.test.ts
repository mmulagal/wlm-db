import { callProxyForwarder } from '../../../src/lib/cloud-manager/proxy-forwarder';
import { ACCOUNT_ID } from '../../utils/consts';

describe('Proxy forwarder lib', () => {
    const endpoint = 'management.fs-test.fsx.us-east-1.amazonaws.com';

    it('Forwards a GET to an ONTAP REST path and returns parsed JSON', async () => {
        const response = await callProxyForwarder<{ num_records: number; records: unknown[] }>({
            accountId: ACCOUNT_ID,
            targetId: 'fs-test',
            ontapPath: 'api/storage/volumes',
            endpoint
        });
        expect(response.num_records).toBeDefined();
        expect(Array.isArray(response.records)).toBe(true);
    });

    it('Forwards a POST with a body and returns parsed JSON', async () => {
        const response = await callProxyForwarder<{ job: { uuid: string } }>({
            accountId: ACCOUNT_ID,
            targetId: 'fs-test',
            ontapPath: '/api/storage/volumes',
            endpoint,
            method: 'POST',
            body: { name: 'vol1', svm: { name: 'svm1' } }
        });
        expect(response.job?.uuid).toBeDefined();
    });

    it('Rejects when the proxy-forwarder returns an error, surfacing the upstream status and message', async () => {
        await expect(
            callProxyForwarder({
                accountId: ACCOUNT_ID,
                targetId: 'error-target',
                ontapPath: 'api/cluster',
                endpoint
            })
        ).rejects.toThrow(/status 500.*Internal server error/);
    });
});
