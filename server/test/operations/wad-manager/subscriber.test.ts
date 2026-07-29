import { describe, it, expect, beforeEach } from 'vitest';
import { resetBroker, getPublishedMessages, getSubscribedHandler } from '../../simulator/scopes/amqp/broker-scope';
import {
    FixRequestMessage,
    ResourceOptimizationStatus,
    ScanRequestMessage,
    ScanTrigger,
    TaskStatus,
    WAD_FIX_REQUESTS_QUEUE,
    WAD_FIX_RESULTS_QUEUE,
    WAD_FIX_STATUS_QUEUE,
    WAD_SCAN_REQUESTS_QUEUE,
    WAD_SCAN_RESULTS_QUEUE,
    WAD_SCAN_STATUS_QUEUE
} from '../../../src/utils/wad-consts';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeScanRequest(overrides: Partial<ScanRequestMessage> = {}): ScanRequestMessage {
    return {
        taskId: 'task-001',
        requestId: 'req-001',
        accountId: 'account-001',
        serviceId: 'wlmdb',
        triggerMode: ScanTrigger.MANUAL,
        credentialsIds: ['creds-1'],
        regions: ['us-east-1'],
        configurationIds: ['wlmdb-storage-assessment'],
        triggeredAt: Date.now(),
        ...overrides
    };
}

function makeFixRequest(overrides: Partial<FixRequestMessage> = {}): FixRequestMessage {
    return {
        taskId: 'task-002',
        requestId: 'req-002',
        accountId: 'account-001',
        serviceId: 'wlmdb',
        configurationId: 'wlmdb-thin-provision',
        parentResource: {
            id: 'fs-0d5efc3057c4f12cb',
            region: 'us-east-1',
            credentialsIds: ['creds-1']
        },
        resourceIds: ['mssql-instance-sqlnode1'],
        triggeredAt: Date.now(),
        ...overrides
    };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('subscriber', () => {
    beforeEach(() => {
        resetBroker();
    });

    describe('startWadSubscriber', () => {
        it('subscribes to both scan and fix request queues', async () => {
            const { startWadSubscriber } = await import('../../../src/operations/wad-manager/subscriber');
            await startWadSubscriber();

            expect(getSubscribedHandler(WAD_SCAN_REQUESTS_QUEUE)).toBeDefined();
            expect(getSubscribedHandler('wad.wlmdb.fix.requests')).toBeDefined();
        });
    });

    describe('scan request handler', () => {
        it('publishes IN_PROGRESS status and acks before processing', async () => {
            const { startWadSubscriber } = await import('../../../src/operations/wad-manager/subscriber');
            await startWadSubscriber();

            const scanHandler = getSubscribedHandler(WAD_SCAN_REQUESTS_QUEUE);
            expect(scanHandler).toBeDefined();

            const req = makeScanRequest();
            const ack = vi.fn();
            const nack = vi.fn();
            await scanHandler!(Buffer.from(JSON.stringify(req)), ack, nack);

            const statusMessages = getPublishedMessages(WAD_SCAN_STATUS_QUEUE).map(buf => JSON.parse(buf.toString()));
            expect(statusMessages.length).toBeGreaterThanOrEqual(1);
            expect(statusMessages[0].taskId).toBe('task-001');
            expect(statusMessages[0].status).toBe(TaskStatus.IN_PROGRESS);

            expect(ack).toHaveBeenCalledOnce();
            expect(nack).not.toHaveBeenCalled();
        });

        it('calls nack (not ack) when message body is malformed JSON', async () => {
            const { startWadSubscriber } = await import('../../../src/operations/wad-manager/subscriber');
            await startWadSubscriber();

            const scanHandler = getSubscribedHandler(WAD_SCAN_REQUESTS_QUEUE);

            const ack = vi.fn();
            const nack = vi.fn();
            await scanHandler!(Buffer.from('not-valid-json{{{'), ack, nack);

            expect(ack).not.toHaveBeenCalled();
            expect(nack).toHaveBeenCalledOnce();
        });

        it('publishes simulated MSSQL and Oracle scan results without contacting ONTAP', async () => {
            const { startWadSubscriber } = await import('../../../src/operations/wad-manager/subscriber');
            await startWadSubscriber();

            const scanHandler = getSubscribedHandler(WAD_SCAN_REQUESTS_QUEUE);
            const req = makeScanRequest({
                isSimulated: true,
                configurationIds: ['wlmdb-thin-provision']
            });
            await scanHandler!(Buffer.from(JSON.stringify(req)), vi.fn(), vi.fn());

            const [result] = getPublishedMessages(WAD_SCAN_RESULTS_QUEUE).map(buf => JSON.parse(buf.toString()));
            const workloads = result.configurations.flatMap(
                (configuration: { resources: { resource: { metadata: { workload: string } } }[] }) =>
                    configuration.resources.map(({ resource }) => resource.metadata.workload)
            );
            const statuses = getPublishedMessages(WAD_SCAN_STATUS_QUEUE).map(buf => JSON.parse(buf.toString()));

            expect(workloads).toEqual(['mssql', 'oracle']);
            expect(statuses.at(-1).status).toBe(TaskStatus.COMPLETED);
        });

        it('uses all simulated configurations when configuration IDs are omitted', async () => {
            const { startWadSubscriber } = await import('../../../src/operations/wad-manager/subscriber');
            await startWadSubscriber();

            const scanHandler = getSubscribedHandler(WAD_SCAN_REQUESTS_QUEUE);
            const req = makeScanRequest({
                isSimulated: true,
                configurationIds: undefined
            });
            await scanHandler!(Buffer.from(JSON.stringify(req)), vi.fn(), vi.fn());

            const [result] = getPublishedMessages(WAD_SCAN_RESULTS_QUEUE).map(buf => JSON.parse(buf.toString()));

            expect(result.configurations).toHaveLength(4);
            expect(
                result.configurations.map((configuration: { configurationId: string }) => configuration.configurationId)
            ).toEqual([
                'wlmdb-thin-provision',
                'wlmdb-os-type',
                'wlmdb-block-device-space-management',
                'wlmdb-snapcenter-snapshot'
            ]);
            expect(result.configurations[0].parentResource).toMatchObject({
                region: 'us-east-1',
                credentialsIds: ['creds-1']
            });
        });
    });

    describe('fix request handler', () => {
        it('publishes successful simulated fix results without applying an ONTAP fix', async () => {
            const { startWadSubscriber } = await import('../../../src/operations/wad-manager/subscriber');
            await startWadSubscriber();

            const fixHandler = getSubscribedHandler(WAD_FIX_REQUESTS_QUEUE);
            const req = makeFixRequest({
                isSimulated: true,
                resourceIds: ['mssql-instance-sqlnode1', 'oracle-instance-ordbsdl']
            });
            await fixHandler!(Buffer.from(JSON.stringify(req)), vi.fn(), vi.fn());

            const [result] = getPublishedMessages(WAD_FIX_RESULTS_QUEUE).map(buf => JSON.parse(buf.toString()));
            const statuses = getPublishedMessages(WAD_FIX_STATUS_QUEUE).map(buf => JSON.parse(buf.toString()));

            expect(result.resourceResults).toEqual([
                { resourceId: 'mssql-instance-sqlnode1', success: true },
                { resourceId: 'oracle-instance-ordbsdl', success: true }
            ]);
            expect(statuses.at(-1).status).toBe(TaskStatus.COMPLETED);
        });

        it('publishes simulated fix results for supplied resource IDs', async () => {
            const { startWadSubscriber } = await import('../../../src/operations/wad-manager/subscriber');
            await startWadSubscriber();

            const fixHandler = getSubscribedHandler(WAD_FIX_REQUESTS_QUEUE);
            const req = makeFixRequest({ isSimulated: true, resourceIds: ['volume-002'] });
            await fixHandler!(Buffer.from(JSON.stringify(req)), vi.fn(), vi.fn());

            const [result] = getPublishedMessages(WAD_FIX_RESULTS_QUEUE).map(buf => JSON.parse(buf.toString()));

            expect(result.resourceResults).toEqual([{ resourceId: 'volume-002', success: true }]);
        });
    });

    describe('publishScanResult envelope shape', () => {
        it('publishes a WadScanResultRecord to wad.scan.results', async () => {
            const { publishScanResult } = await import('../../../src/operations/wad-manager/publishers');
            const req = makeScanRequest();

            publishScanResult({
                taskId: req.taskId,
                requestId: req.requestId,
                accountId: req.accountId,
                serviceId: 'wlmdb',
                completedAt: Date.now(),
                configurations: [
                    {
                        configurationId: req.configurationIds[0],
                        parentResource: {
                            id: 'parent-001',
                            type: 'DATABASE_INSTANCE',
                            name: 'parent-001',
                            accountId: req.accountId,
                            region: 'us-east-1',
                            credentialsIds: ['creds-1']
                        },
                        resources: [
                            {
                                resource: {
                                    id: 'res-001',
                                    type: 'DATABASE_INSTANCE',
                                    name: 'res-001'
                                },
                                status: 'NOT_OPTIMIZED' as ResourceOptimizationStatus
                            }
                        ]
                    }
                ]
            });

            const messages = getPublishedMessages(WAD_SCAN_RESULTS_QUEUE).map(buf => JSON.parse(buf.toString()));
            expect(messages).toHaveLength(1);
            expect(messages[0].taskId).toBe('task-001');
            expect(messages[0].requestId).toBe('req-001');
            expect(Array.isArray(messages[0].configurations)).toBe(true);
            expect(messages[0].configurations).toHaveLength(1);
            expect(messages[0].configurations[0].configurationId).toBe('wlmdb-storage-assessment');
            expect(messages[0].configurations[0].parentResource).toMatchObject({
                id: 'parent-001',
                region: 'us-east-1'
            });
            expect(Array.isArray(messages[0].configurations[0].resources)).toBe(true);
            expect(messages[0].configurations[0].resources).toHaveLength(1);
        });
    });
});
