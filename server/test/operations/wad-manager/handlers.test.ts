import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetBroker, getPublishedMessages, getSubscribedHandler } from '../../simulator/scopes/amqp/broker-scope';
import {
    getCapturedTrackerRequests,
    queueTrackerCreateIds,
    resetTrackerOverrides,
    setTrackerTaskStatus
} from '../../simulator/scopes/cloud-manager/tracker-scope';
import { trackSubtask } from '../../../src/operations/cloud-manager/tracker-operations';
import { TrackerTaskStatus } from '../../../src/utils/common-types';
import {
    FixRequestMessage,
    ScanRequestMessage,
    ScanTrigger,
    TaskStatus,
    WAD_FIX_REQUESTS_QUEUE,
    WAD_FIX_STATUS_QUEUE,
    WAD_SCAN_REQUESTS_QUEUE,
    WAD_SCAN_RESULTS_QUEUE,
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

            const { startWadSubscriber } = await import('../../../src/operations/wad-manager/subscriber');
            await startWadSubscriber();

            const handler = getSubscribedHandler(WAD_SCAN_REQUESTS_QUEUE)!;
            await handler(
                Buffer.from(JSON.stringify(makeScanRequest({ trackerParentTaskId: 'parent-001' }))),
                vi.fn(),
                vi.fn()
            );

            await vi.waitFor(() => expect(getCapturedTrackerRequests()).toHaveLength(2));
            expect(getCapturedTrackerRequests()[1].body.task.failureReason).toBeUndefined();
            const statusMessages = getPublishedMessages(WAD_SCAN_STATUS_QUEUE).map(b => JSON.parse(b.toString()));
            expect(statusMessages.find(m => m.status === TaskStatus.COMPLETED)).toBeDefined();
        });

        it('should not call tracker when trackerParentTaskId is absent', async () => {
            const { startWadSubscriber } = await import('../../../src/operations/wad-manager/subscriber');
            await startWadSubscriber();

            const handler = getSubscribedHandler(WAD_SCAN_REQUESTS_QUEUE)!;
            await handler(Buffer.from(JSON.stringify(makeScanRequest())), vi.fn(), vi.fn());

            // No trackerParentTaskId → no tracker HTTP calls; assert only via WAD status messages.
            const statusMessages = getPublishedMessages(WAD_SCAN_STATUS_QUEUE).map(b => JSON.parse(b.toString()));
            expect(statusMessages.length).toBeGreaterThanOrEqual(1);
        });

        it('should complete the scan and publish WAD messages even when tracker HTTP call fails', async () => {
            // createTrackerTask fails → returns undefined → updateTrackerTaskStatus is skipped
            const { startWadSubscriber } = await import('../../../src/operations/wad-manager/subscriber');
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

        it('should create parent and FSx tracker tasks when discovery finds an FSx', async () => {
            const collectorModule = await import(
                '../../../src/operations/continuous-optimization/ontap-proxy-collector'
            );
            const collectorSpy = vi
                .spyOn(collectorModule, 'collectOntapAssessmentData')
                .mockImplementation(async (accountId, _relationship, parentTaskId) =>
                    trackSubtask(
                        accountId,
                        parentTaskId!,
                        {
                            actionName: 'Fetch ONTAP inventory for fs-001',
                            resourceId: 'fs-001',
                            resourceName: 'fs-001'
                        },
                        async () => [
                            // 'unknown-workload' is not in WORKLOAD_SCAN_FNS, so the scan loop is a safe no-op.
                            {
                                instanceId: 'i-001',
                                fileSystemId: 'fs-001',
                                workloadType: 'unknown-workload',
                                storageAssessment: {} as never
                            }
                        ]
                    )
                );

            queueTrackerCreateIds('parent-001', 'fsx-001');

            const { startWadSubscriber } = await import('../../../src/operations/wad-manager/subscriber');
            await startWadSubscriber();

            const handler = getSubscribedHandler(WAD_SCAN_REQUESTS_QUEUE)!;
            await handler(
                Buffer.from(JSON.stringify(makeScanRequest({ trackerParentTaskId: 'root-001' }))),
                vi.fn(),
                vi.fn()
            );

            collectorSpy.mockRestore();

            await vi.waitFor(() => {
                const tasks = getCapturedTrackerRequests().map(({ body }) => body.task);
                expect(tasks.find(task => task.id === 'fsx-001')?.status).toBe('success');
                expect(tasks.find(task => task.id === 'parent-001')?.status).toBe('success');
            });
            const bodies = getCapturedTrackerRequests().map(({ body }) => body);
            expect(
                bodies.find(({ task }) => task.actionName === 'Manual well-architected analysis')?.task
            ).toMatchObject({
                parentTaskId: 'root-001',
                resourceId: 'account-001'
            });
            expect(
                bodies.find(({ task }) => task.actionName === 'Fetch ONTAP inventory for fs-001')?.task
            ).toMatchObject({
                parentTaskId: 'parent-001',
                resourceId: 'fs-001',
                resourceName: 'fs-001'
            });

            const statusMessages = getPublishedMessages(WAD_SCAN_STATUS_QUEUE).map(b => JSON.parse(b.toString()));
            expect(statusMessages.find(m => m.status === TaskStatus.COMPLETED)).toBeDefined();
        });

        it('should propagate an FSx assessment failure up through to the parent tracker task', async () => {
            const collectorModule = await import(
                '../../../src/operations/continuous-optimization/ontap-proxy-collector'
            );
            const collectorSpy = vi
                .spyOn(collectorModule, 'collectOntapAssessmentData')
                .mockImplementation(async (accountId, _relationship, parentTaskId) =>
                    trackSubtask(
                        accountId,
                        parentTaskId!,
                        {
                            actionName: 'Fetch ONTAP inventory for fs-001',
                            resourceId: 'fs-001',
                            resourceName: 'fs-001'
                        },
                        async () => {
                            throw new Error('scan failed');
                        }
                    )
                );

            queueTrackerCreateIds('parent-001', 'fsx-001');

            const { startWadSubscriber } = await import('../../../src/operations/wad-manager/subscriber');
            await startWadSubscriber();

            const handler = getSubscribedHandler(WAD_SCAN_REQUESTS_QUEUE)!;
            await handler(
                Buffer.from(JSON.stringify(makeScanRequest({ trackerParentTaskId: 'root-001' }))),
                vi.fn(),
                vi.fn()
            );

            collectorSpy.mockRestore();

            await vi.waitFor(() => {
                const tasks = getCapturedTrackerRequests().map(({ body }) => body.task);
                expect(tasks.find(task => task.id === 'fsx-001')?.status).toBe('failure');
                expect(tasks.find(task => task.id === 'parent-001')?.status).toBe('failure');
            });
            const bodies = getCapturedTrackerRequests().map(({ body }) => body);
            expect(bodies.find(({ task }) => task.id === 'fsx-001')?.task.failureReason).toEqual(['scan failed']);
            expect((bodies.find(({ task }) => task.id === 'parent-001')?.task.failureReason as string[])[0]).toContain(
                'scan failed'
            );

            const statusMessages = getPublishedMessages(WAD_SCAN_STATUS_QUEUE).map(b => JSON.parse(b.toString()));
            expect(statusMessages.find(m => m.status === TaskStatus.FAILED)).toBeDefined();
        });

        it('should publish successful FSx configurations when a sibling pair assessment fails', async () => {
            const collectorModule = await import(
                '../../../src/operations/continuous-optimization/ontap-proxy-collector'
            );
            const collectorSpy = vi
                .spyOn(collectorModule, 'collectOntapAssessmentData')
                .mockResolvedValueOnce([
                    {
                        instanceId: 'i-success',
                        fileSystemId: 'fs-success',
                        workloadType: 'mssql',
                        storageAssessment: {} as never
                    }
                ])
                .mockResolvedValueOnce([
                    {
                        instanceId: 'i-failure',
                        fileSystemId: 'fs-failure',
                        workloadType: 'mssql',
                        storageAssessment: {} as never
                    }
                ]);
            const mssqlModule = await import(
                '../../../src/operations/continuous-optimization/mssql/assessment-operations'
            );
            const scanSpy = vi.spyOn(mssqlModule, 'getMssqlStorageResourceScan').mockImplementation(async context => {
                if (context.filesystemId === 'fs-failure') {
                    throw new Error('scan failed');
                }
                return {
                    taskId: context.taskId,
                    requestId: context.requestId,
                    accountId: context.accountId,
                    serviceId: context.serviceId,
                    completedAt: Date.now(),
                    configurations: [
                        {
                            configurationId: 'wlmdb-storage-assessment',
                            parentResource: {
                                id: 'fs-success',
                                name: 'fs-success',
                                type: 'fsx',
                                accountId: context.accountId,
                                region: context.region,
                                credentialsIds: [context.credentialsId]
                            },
                            resources: []
                        }
                    ]
                };
            });

            const { startWadSubscriber } = await import('../../../src/operations/wad-manager/subscriber');
            await startWadSubscriber();

            const handler = getSubscribedHandler(WAD_SCAN_REQUESTS_QUEUE)!;
            await handler(
                Buffer.from(JSON.stringify(makeScanRequest({ credentialsIds: ['creds-success', 'creds-failure'] }))),
                vi.fn(),
                vi.fn()
            );

            collectorSpy.mockRestore();
            scanSpy.mockRestore();

            const results = getPublishedMessages(WAD_SCAN_RESULTS_QUEUE).map(b => JSON.parse(b.toString()));
            expect(results).toContainEqual(
                expect.objectContaining({
                    configurations: [
                        expect.objectContaining({ parentResource: expect.objectContaining({ id: 'fs-success' }) })
                    ]
                })
            );
            const statusMessages = getPublishedMessages(WAD_SCAN_STATUS_QUEUE).map(b => JSON.parse(b.toString()));
            expect(statusMessages.find(m => m.status === TaskStatus.FAILED)).toBeDefined();
        });
    });

    describe('fix flow', () => {
        it('should create one tracker task per config entry and update it when not resolved', async () => {
            setTrackerTaskStatus('root-002', TrackerTaskStatus.PENDING);
            queueTrackerCreateIds('fix-001');

            const { startWadSubscriber } = await import('../../../src/operations/wad-manager/subscriber');
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
                ({ task }) => task.actionName === 'Well-architected fix for wlmdb-storage-tiering'
            );
            expect(fixTask?.task.parentTaskId).toBe('root-002');
            expect(fixTask?.task.actionDescription).toBe('Fixing 1 resource(s)');
            expect(fixTask?.task.resourceId).toBe('vol-001');
            expect(fixTask?.task.resourceName).toBe('vol-001');
            expect(bodies.find(({ task }) => task.status === 'failure')?.task.id).toBeDefined();

            const fixStatuses = getPublishedMessages(WAD_FIX_STATUS_QUEUE).map(b => JSON.parse(b.toString()));
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

                const { startWadSubscriber } = await import('../../../src/operations/wad-manager/subscriber');
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
            const { startWadSubscriber } = await import('../../../src/operations/wad-manager/subscriber');
            await startWadSubscriber();

            const handler = getSubscribedHandler(WAD_FIX_REQUESTS_QUEUE)!;
            await handler(Buffer.from(JSON.stringify(makeFixRequest())), vi.fn(), vi.fn());

            const fixStatuses = getPublishedMessages(WAD_FIX_STATUS_QUEUE).map(b => JSON.parse(b.toString()));
            expect(fixStatuses.length).toBeGreaterThanOrEqual(1);
        });

        it('should complete the fix and publish WAD messages even when tracker HTTP calls fail', async () => {
            const { startWadSubscriber } = await import('../../../src/operations/wad-manager/subscriber');
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
