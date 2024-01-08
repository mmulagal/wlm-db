import { Type } from '@fastify/type-provider-typebox';


const ListJobsQueryString = Type.Object({
    parentJobId: Type.Optional(Type.String()),
    sort: Type.Optional(Type.String()),
    sortOrder: Type.Optional(Type.String()),
    initiator: Type.Optional(Type.String()),
    type: Type.Optional(Type.String()),
    status: Type.Optional(Type.String()),
    startTime: Type.Optional(Type.Number()),
    endTime: Type.Optional(Type.Number()),
    pageSize: Type.Optional(Type.Number()),
    nextToken: Type.Optional(Type.String())
});

const ListJobsResponseObject = Type.Object({
    id: Type.String(),
    name: Type.String(),
    status: Type.String(),
    description: Type.Optional(Type.String()),
    parentJobId: Type.String(),
    resourceName: Type.String(),
    type: Type.String(),
    startTime: Type.Number(),
    endTime: Type.Optional(Type.Number()),
    error: Type.Optional(Type.String())
});

const ListJobsResponse = Type.Object({
    count: Type.Number(),
    items: Type.Array(ListJobsResponseObject),
    nextToken: Type.Optional(Type.String())
});

const JobObject = Type.Object({
    id: Type.String(),
    name: Type.String(),
    status: Type.String(),
    description: Type.Optional(Type.String()),
    parentJobId: Type.String(),
    resourceName: Type.String(),
    type: Type.String(),
    startTime: Type.Number(),
    endTime: Type.Optional(Type.Number()),
    error: Type.Optional(Type.String()),
    subJobs: Type.Optional(Type.Any())
});

const JobDetailsResponse = Type.Object({
    id: Type.String(),
    name: Type.String(),
    status: Type.String(),
    description: Type.Optional(Type.String()),
    parentJobId: Type.String(),
    resourceName: Type.String(),
    type: Type.String(),
    startTime: Type.Number(),
    endTime: Type.Optional(Type.Number()),
    error: Type.Optional(Type.String()),
    subJobs: Type.Optional(Type.Array(JobObject))
});

const DeleteJobResponse = Type.Object({
    count: Type.Number()
});

const ModifyJobResponse = Type.Object({
    id: Type.String(),
    name: Type.String(),
    status: Type.String(),
    description: Type.Optional(Type.String()),
    parentJobId: Type.Optional(Type.String()),
    resourceName: Type.String(),
    type: Type.String(),
    startTime: Type.Number(),
    endTime: Type.Optional(Type.Number()),
    error: Type.Optional(Type.String()),
    subJobs: Type.Optional(Type.Any())
});

const JobsParams = Type.Object({
    accountId: Type.String({ minLength: 1 }),
    jobId: Type.String({ minLength: 1 })
});

export {
    ListJobsQueryString,
    ListJobsResponse,
    JobDetailsResponse,
    DeleteJobResponse,
    ModifyJobResponse,
    JobsParams
};
