import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTrackerTask, updateTrackerTaskStatus } from '../../../src/lib/cloud-manager/tracker';
import { TrackerTaskStatus } from '../../../src/utils/common-types';
import {
    getCapturedTrackerRequests,
    queueTrackerCreateIds,
    resetTrackerOverrides
} from '../../simulator/scopes/cloud-manager/tracker-scope';

const ACCOUNT_ID = 'account-tracker-test';

afterEach(() => {
    vi.restoreAllMocks();
    resetTrackerOverrides();
});

describe('tracker-operations', () => {
    describe('createTrackerTask', () => {
        it('should post the task payload and return the created id', async () => {
            queueTrackerCreateIds('tracker-task-001');

            const result = await createTrackerTask(ACCOUNT_ID, {
                parentTaskId: 'parent-001',
                status: TrackerTaskStatus.PENDING,
                actionName: 'WLM DB2 assessment scan'
            });

            expect(result).toEqual({ id: 'tracker-task-001' });
        });

        it('should always include workload: WF-Databases in the request body regardless of caller input', async () => {
            await createTrackerTask(ACCOUNT_ID, {
                parentTaskId: 'parent-001',
                status: TrackerTaskStatus.PENDING,
                actionName: 'WLM DB2 assessment scan'
            });

            expect(getCapturedTrackerRequests()[0].body.task.workload).toBe('WF-Databases');
        });

        it('should return undefined and not throw when the HTTP call fails', async () => {
            const result = await createTrackerTask('error-account', {
                parentTaskId: 'parent-001',
                status: TrackerTaskStatus.PENDING,
                actionName: 'WLM DB2 assessment scan'
            });

            expect(result).toBeUndefined();
        });

        it('should return undefined and not throw when auth fails', async () => {
            const authModule = await import('../../../src/lib/cloud-manager/auth');
            vi.spyOn(authModule, 'getWfServiceToken').mockRejectedValueOnce(new Error('token fetch failed'));

            const result = await createTrackerTask(ACCOUNT_ID, {
                parentTaskId: 'parent-001',
                status: TrackerTaskStatus.PENDING,
                actionName: 'WLM DB2 assessment scan'
            });

            expect(result).toBeUndefined();
        });
    });

    describe('updateTrackerTaskStatus', () => {
        it('should post a success status update without throwing', async () => {
            await expect(
                updateTrackerTaskStatus(ACCOUNT_ID, 'tracker-task-001', {
                    status: TrackerTaskStatus.SUCCESS
                })
            ).resolves.toBeUndefined();
        });

        it('should include empty actionName and workload in the status update body', async () => {
            await updateTrackerTaskStatus(ACCOUNT_ID, 'tracker-task-001', {
                status: TrackerTaskStatus.FAILURE,
                failureReason: ['creds-1/us-east-1: some error']
            });

            expect(getCapturedTrackerRequests()[0].body.task.actionName).toBe('');
            expect(getCapturedTrackerRequests()[0].body.task.workload).toBe('WF-Databases');
        });

        it('should post a failure status with failureReason without throwing', async () => {
            await expect(
                updateTrackerTaskStatus(ACCOUNT_ID, 'tracker-task-001', {
                    status: TrackerTaskStatus.FAILURE,
                    failureReason: ['creds-1/us-east-1: some error']
                })
            ).resolves.toBeUndefined();
        });

        it('should not throw when the HTTP call fails', async () => {
            await expect(
                updateTrackerTaskStatus('error-account', 'tracker-task-001', {
                    status: TrackerTaskStatus.SUCCESS
                })
            ).resolves.toBeUndefined();
        });
    });
});
