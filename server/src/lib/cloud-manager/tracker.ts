import { HEADERS, TIMELINE_SERVICE_NAME, WORKLOAD_FACTORY_ENDPOINT } from '../../utils/consts';
import { gotInstanceForInternalRequest } from '../../utils/got';
import getLogger from '../../utils/logger';
import { TaskCreate, TaskUpdateParams, TrackerTaskStatus } from '../../utils/common-types';
import { getWfServiceToken } from './auth';

const logger = getLogger();

async function getTrackerTask(
    accountId: string,
    taskId: string,
    isSimulated: boolean = false
): Promise<{ id: string; status: TrackerTaskStatus } | undefined> {
    logger.info('Fetching tracker task', { accountId, taskId });
    try {
        const { token } = await getWfServiceToken();
        return await gotInstanceForInternalRequest
            .get(`accounts/${accountId}/tracker/v1/tasks/${taskId}`, {
                prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
                headers: {
                    [HEADERS.AUTHORIZATION]: token,
                    ...(isSimulated && { [HEADERS.SIMULATOR]: 'true' })
                }
            })
            .json<{ id: string; status: TrackerTaskStatus }>();
    } catch (error: unknown) {
        logger.error('tracker: failed to fetch task', { accountId, taskId, error });
    }
}

async function createTrackerTask(
    accountId: string,
    task: TaskCreate,
    isSimulated: boolean = false
): Promise<{ id: string } | undefined> {
    logger.info('Creating tracker task', { accountId, actionName: task.actionName, resourceId: task.resourceId });
    try {
        const { token } = await getWfServiceToken();
        return await gotInstanceForInternalRequest
            .post(`accounts/${accountId}/tracker/v1/tasks`, {
                prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
                json: { task: { ...task, workload: TIMELINE_SERVICE_NAME } },
                headers: { [HEADERS.AUTHORIZATION]: token, ...(isSimulated && { [HEADERS.SIMULATOR]: 'true' }) }
            })
            .json<{ id: string }>();
    } catch (error: unknown) {
        logger.error('tracker: failed to create task — continuing without tracker context', { accountId, task, error });
    }
}

async function updateTrackerTaskStatus(
    accountId: string,
    taskId: string,
    params: TaskUpdateParams,
    isSimulated: boolean = false
): Promise<void> {
    logger.info('Updating tracker task status', { accountId, taskId, status: params.status });

    try {
        const { token } = await getWfServiceToken();
        await gotInstanceForInternalRequest
            .post(`accounts/${accountId}/tracker/v1/tasks`, {
                prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
                json: { task: { id: taskId, ...params, actionName: '', workload: TIMELINE_SERVICE_NAME } },
                headers: {
                    [HEADERS.AUTHORIZATION]: token,
                    ...(isSimulated && { [HEADERS.SIMULATOR]: 'true' })
                }
            })
            .json();
    } catch (error: unknown) {
        logger.error('tracker: failed to update task status', { accountId, taskId, status: params.status, error });
    }
}

export { getTrackerTask, createTrackerTask, updateTrackerTaskStatus };
