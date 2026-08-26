import { createTrackerTask, updateTrackerTaskStatus } from '../../lib/cloud-manager/tracker';
import { TaskCreate, TaskUpdateParams, TrackerTaskStatus } from '../../utils/common-types';

async function trackSubtask<T>(
    accountId: string,
    parentTaskId: string,
    task: Omit<TaskCreate, 'parentTaskId' | 'status'>,
    run: () => Promise<T>,
    isSimulated = false
): Promise<T> {
    const subtask = await createTrackerTask(
        accountId,
        {
            ...task,
            parentTaskId,
            status: TrackerTaskStatus.PENDING
        },
        isSimulated
    );
    let status: TaskUpdateParams['status'] = TrackerTaskStatus.SUCCESS;
    let failureReason: string[] | undefined;
    try {
        return await run();
    } catch (error) {
        status = TrackerTaskStatus.FAILURE;
        failureReason = [error instanceof Error ? error.message : String(error)];
        throw error;
    } finally {
        updateTrackerTaskStatus(
            accountId,
            subtask?.id ?? '',
            {
                status,
                ...(failureReason && { failureReason })
            },
            isSimulated
        );
    }
}

export { trackSubtask };
