import { faker } from '@faker-js/faker';
import nock from 'nock';
import { WORKLOAD_FACTORY_ENDPOINT } from '../../../../src/utils/consts';
import { TrackerTaskStatus } from '../../../../src/utils/common-types';

const TRACKER_TASKS_PATH = /^\/accounts\/([^/]+)\/tracker\/v1\/tasks$/;
const TRACKER_TASK_BY_ID_PATH = /^\/accounts\/([^/]+)\/tracker\/v1\/tasks\/([^/]+)$/;
const ERROR_ACCOUNT_ID = 'error-account';

type TrackerRequest = {
    accountId: string;
    body: { task: Record<string, unknown> };
};

const createIds: string[] = [];
const taskStatuses = new Map<string, TrackerTaskStatus>();
const capturedRequests: TrackerRequest[] = [];

function queueTrackerCreateIds(...ids: string[]): void {
    createIds.push(...ids);
}

function setTrackerTaskStatus(taskId: string, status: TrackerTaskStatus): void {
    taskStatuses.set(taskId, status);
}

function getCapturedTrackerRequests(): TrackerRequest[] {
    return capturedRequests;
}

function resetTrackerOverrides(): void {
    createIds.length = 0;
    taskStatuses.clear();
    capturedRequests.length = 0;
}

function parseTrackerRequestBody(body: unknown): { task: Record<string, unknown> } {
    const requestBody = typeof body === 'string' ? JSON.parse(body) : body;
    return requestBody as { task: Record<string, unknown> };
}

nock(`${WORKLOAD_FACTORY_ENDPOINT}`, {
    allowUnmocked: process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator'
})
    .persist(true)
    .get(TRACKER_TASK_BY_ID_PATH)
    .reply(uri => {
        const match = TRACKER_TASK_BY_ID_PATH.exec(uri);
        const [, accountId, taskId] = match!;
        return accountId === ERROR_ACCOUNT_ID
            ? [500, { errorMessage: 'Internal server error' }]
            : [200, { id: taskId, status: taskStatuses.get(taskId) ?? TrackerTaskStatus.PENDING }];
    })
    .post(TRACKER_TASKS_PATH)
    .reply((uri, body) => {
        const match = TRACKER_TASKS_PATH.exec(uri);
        const [, accountId] = match!;
        const requestBody = parseTrackerRequestBody(body);
        capturedRequests.push({ accountId, body: requestBody });

        if (accountId === ERROR_ACCOUNT_ID) {
            return [500, { errorMessage: 'Internal server error' }];
        }
        return requestBody.task.id ? [200, {}] : [200, { id: createIds.shift() ?? faker.string.uuid() }];
    });

export {
    getCapturedTrackerRequests,
    queueTrackerCreateIds,
    resetTrackerOverrides,
    setTrackerTaskStatus,
    type TrackerRequest
};
