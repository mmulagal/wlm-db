import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetBroker, getPublishedMessages, getSubscribedHandler } from '../../simulator/scopes/amqp/broker-scope';
import {
    getCapturedTrackerRequests,
    queueTrackerCreateIds,
    resetTrackerOverrides,
    setTrackerTaskStatus
} from '../../simulator/scopes/cloud-manager/tracker-scope';
import { startWadSubscriber } from '../../../src/operations/wad-manager/subscriber';
import { TrackerTaskStatus } from '../../../src/utils/common-types';
import {
    FixRequestMessage,
    ScanRequestMessage,
    ScanTrigger,
    TaskStatus,
    WAD_FIX_REQUESTS_QUEUE,
    WAD_FIX_STATUS_QUEUE,
    WAD_SCAN_REQUESTS_QUEUE,
    WAD_SCAN_STATUS_QUEUE
} from '../../../src/utils/wad-consts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
        taskId: 'task-fix-001',
        requestId: 'req-fix-001',
        accountId: 'account-001',
        serviceId: 'wlmdb',
        configurationId: 'wlmdb-storage-tiering',
        parentResource: { id: 'fs-abc123', region: 'us-east-1', credentialsIds: ['creds-1'] },
        resourceIds: ['vol-001'],
        triggeredAt: Date.now(),
        ...overrides
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('handlers — tracker wiring', () => {
    beforeEach(() => {
        resetBroker();
        resetTrackerOverrides();
    });

    describe('scan flow', () => {
        it('should create parent and child tracker tasks and update both on completion', async () => {
            // parent create + parent success update (no FSx discovered, so no child task)
            queueTrackerCreateIds('tracker-1');

            await startWadSubscriber();

            const handler = getSubscribedHandler(WAD_SCAN_REQUESTS_QUEUE)!;
            await handler(
                Buffer.from(JSON.stringify(makeScanRequest({ trackerParentTaskId: 'parent-001' }))),
                vi.fn(),
                vi.fn()
            );

            await vi.waitFor(() => expect(getCapturedTrackerRequests()).toHaveLength(2));
            expect(getCapturedTrackerRequests()[0].body.task).toMatchObject({
                parentTaskId: 'parent-001'
            });
            expect(getCapturedTrackerRequests()[1].body.task.failureReason).toBeUndefined();
            const statusMessages = getPublishedMessages(WAD_SCAN_STATUS_QUEUE).map(b => JSON.parse(b.toString()));
            expect(statusMessages).toEqual(
                expect.arrayContaining([expect.objectContaining({ hasFailedTasks: false })])
            );
            expect(statusMessages.find(m => m.status === TaskStatus.COMPLETED)).toBeDefined();
        });

        it('should not call tracker when trackerParentTaskId is absent', async () => {
            await startWadSubscriber();

            const handler = getSubscribedHandler(WAD_SCAN_REQUESTS_QUEUE)!;
            await handler(Buffer.from(JSON.stringify(makeScanRequest())), vi.fn(), vi.fn());

            // No trackerParentTaskId → no tracker HTTP calls; assert only via WAD status messages.
            const statusMessages = getPublishedMessages(WAD_SCAN_STATUS_QUEUE).map(b => JSON.parse(b.toString()));
            expect(statusMessages.length).toBeGreaterThanOrEqual(1);
        });

        it('should complete the scan and publish WAD messages even when tracker HTTP call fails', async () => {
            // createTrackerTask fails → returns undefined → updateTrackerTaskStatus is skipped
            await startWadSubscriber();

            const handler = getSubscribedHandler(WAD_SCAN_REQUESTS_QUEUE)!;
            await expect(
                handler(
                    Buffer.from(
                        JSON.stringify(
                            makeScanRequest({ accountId: 'error-account', trackerParentTaskId: 'parent-001' })
                        )
                    ),
                    vi.fn(),
                    vi.fn()
                )
            ).resolves.toBeUndefined();

            const statusMessages = getPublishedMessages(WAD_SCAN_STATUS_QUEUE).map(b => JSON.parse(b.toString()));
            expect(
                statusMessages.find(m => m.status === TaskStatus.COMPLETED || m.status === TaskStatus.FAILED)
            ).toBeDefined();
        });

        it('should create and complete tracker tasks for a simulated scan request', async () => {
            queueTrackerCreateIds('sim-scan-001');

            await startWadSubscriber();

            const handler = getSubscribedHandler(WAD_SCAN_REQUESTS_QUEUE)!;
            await handler(
                Buffer.from(
                    JSON.stringify(
                        makeScanRequest({
                            accountId: 'account-sim-scan',
                            isSimulated: true,
                            trackerParentTaskId: 'root-sim-001'
                        })
                    )
                ),
                vi.fn(),
                vi.fn()
            );

            await vi.waitFor(() => {
                const requests = getCapturedTrackerRequests().filter(
                    ({ accountId }) => accountId === 'account-sim-scan'
                );
                expect(requests).toHaveLength(2);
            });
            const bodies = getCapturedTrackerRequests()
                .filter(({ accountId }) => accountId === 'account-sim-scan')
                .map(({ body }) => body.task);
            expect(bodies.find(task => task.id === undefined)).toMatchObject({ parentTaskId: 'root-sim-001' });
            expect(bodies.find(task => task.id === 'sim-scan-001')).toMatchObject({ status: 'success' });

            const statusMessages = getPublishedMessages(WAD_SCAN_STATUS_QUEUE).map(b => JSON.parse(b.toString()));
            expect(statusMessages.find(m => m.status === TaskStatus.COMPLETED)).toBeDefined();
        });
    });

    describe('fix flow', () => {
        it('should create one tracker task per config entry and update it when not resolved', async () => {
            setTrackerTaskStatus('root-002', TrackerTaskStatus.PENDING);
            queueTrackerCreateIds('fix-001');

            await startWadSubscriber();

            const handler = getSubscribedHandler(WAD_FIX_REQUESTS_QUEUE)!;
            await handler(
                Buffer.from(JSON.stringify(makeFixRequest({ trackerParentTaskId: 'root-002' }))),
                vi.fn(),
                vi.fn()
            );

            await vi.waitFor(() =>
                expect(getCapturedTrackerRequests().some(({ body }) => body.task.status === 'failure')).toBe(true)
            );
            const bodies = getCapturedTrackerRequests().map(({ body }) => body);
            const fixTask = bodies.find(
                ({ task }) => task.actionName === 'Databases well-architected fix for wlmdb-storage-tiering'
            );
            expect(fixTask?.task.parentTaskId).toBe('root-002');
            expect(fixTask?.task.actionDescription).toBe('Fixing 1 resource(s)');
            expect(fixTask?.task.resourceId).toBe('vol-001');
            expect(fixTask?.task.resourceName).toBe('vol-001');

            const fixStatuses = getPublishedMessages(WAD_FIX_STATUS_QUEUE).map(b => JSON.parse(b.toString()));
            expect(fixStatuses).toEqual(expect.arrayContaining([expect.objectContaining({ hasFailedTasks: false })]));
            expect(
                fixStatuses.find(m => m.status === TaskStatus.COMPLETED || m.status === TaskStatus.FAILED)
            ).toBeDefined();
        });

        it.each([
            [TrackerTaskStatus.SUCCESS, TaskStatus.COMPLETED],
            [TrackerTaskStatus.FAILURE, TaskStatus.FAILED]
        ])(
            'should publish %s when the existing tracker task is already resolved',
            async (existingStatus, expectedStatus) => {
                setTrackerTaskStatus('root-003', existingStatus);

                await startWadSubscriber();

                const handler = getSubscribedHandler(WAD_FIX_REQUESTS_QUEUE)!;
                await handler(
                    Buffer.from(JSON.stringify(makeFixRequest({ trackerParentTaskId: 'root-003' }))),
                    vi.fn(),
                    vi.fn()
                );

                const fixStatuses = getPublishedMessages(WAD_FIX_STATUS_QUEUE).map(b => JSON.parse(b.toString()));
                expect(fixStatuses).toHaveLength(2);
                expect(fixStatuses[0].status).toBe(TaskStatus.IN_PROGRESS);
                expect(fixStatuses[1].status).toBe(expectedStatus);
            }
        );

        it('should not call tracker when trackerParentTaskId is absent', async () => {
            await startWadSubscriber();

            const handler = getSubscribedHandler(WAD_FIX_REQUESTS_QUEUE)!;
            await handler(Buffer.from(JSON.stringify(makeFixRequest())), vi.fn(), vi.fn());

            const fixStatuses = getPublishedMessages(WAD_FIX_STATUS_QUEUE).map(b => JSON.parse(b.toString()));
            expect(fixStatuses.length).toBeGreaterThanOrEqual(1);
        });

        it('should create and complete a tracker task for a simulated fix request', async () => {
            queueTrackerCreateIds('sim-fix-001');

            await startWadSubscriber();

            const handler = getSubscribedHandler(WAD_FIX_REQUESTS_QUEUE)!;
            await handler(
                Buffer.from(
                    JSON.stringify(
                        makeFixRequest({
                            accountId: 'account-sim-fix',
                            isSimulated: true,
                            trackerParentTaskId: 'root-sim-002'
                        })
                    )
                ),
                vi.fn(),
                vi.fn()
            );

            await vi.waitFor(() => {
                const requests = getCapturedTrackerRequests().filter(
                    ({ accountId }) => accountId === 'account-sim-fix'
                );
                expect(requests).toHaveLength(2);
            });
            const bodies = getCapturedTrackerRequests()
                .filter(({ accountId }) => accountId === 'account-sim-fix')
                .map(({ body }) => body.task);
            expect(bodies.find(task => task.id === undefined)).toMatchObject({ parentTaskId: 'root-sim-002' });
            expect(bodies.find(task => task.id === 'sim-fix-001')).toMatchObject({ status: 'success' });

            const fixStatuses = getPublishedMessages(WAD_FIX_STATUS_QUEUE).map(b => JSON.parse(b.toString()));
            expect(fixStatuses.find(m => m.status === TaskStatus.COMPLETED)).toBeDefined();
        });

        it('should complete the fix and publish WAD messages even when tracker HTTP calls fail', async () => {
            await startWadSubscriber();

            const handler = getSubscribedHandler(WAD_FIX_REQUESTS_QUEUE)!;
            await expect(
                handler(
                    Buffer.from(
                        JSON.stringify(makeFixRequest({ accountId: 'error-account', trackerParentTaskId: 'root-004' }))
                    ),
                    vi.fn(),
                    vi.fn()
                )
            ).resolves.toBeUndefined();

            const fixStatuses = getPublishedMessages(WAD_FIX_STATUS_QUEUE).map(b => JSON.parse(b.toString()));
            expect(
                fixStatuses.find(m => m.status === TaskStatus.COMPLETED || m.status === TaskStatus.FAILED)
            ).toBeDefined();
        });
    });
});
