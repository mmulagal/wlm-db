import { Static, Type } from '@fastify/type-provider-typebox';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';

//TODO : DELETE ME
const DeploymentJobsCountQueryString = Type.Object({
    duration: Type.Optional(Type.Number())
});

const DeploymentJobsCountResponse = Type.Object({
    success: Type.Number(),
    initializing: Type.Number(),
    failed: Type.Number()
});

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
    nextToken: Type.Optional(Type.String()),
    includeSubJobs: Type.Optional(Type.Boolean())
});

type ListJobsQueryType = Static<typeof ListJobsQueryString>;


const JobObject = Type.Object({
    id: Type.String(),
    accountId: Type.String(),
    name: Type.String(),
    status: Type.String(),
    description: Type.Optional(Type.String()),
    parentJobId: Type.Optional(Type.String()),
    resourceName: Type.String(),
    type: Type.String(),
    startTime: Type.Number(),
    endTime: Type.Optional(Type.Number()),
    error: Type.Optional(Type.String()),
    subJobs: Type.Optional(Type.Array(Type.Any()))
});

const ListJobsResponse = Type.Object({
    count: Type.Number(),
    items: Type.Array(JobObject),
    nextToken: Type.Optional(Type.String())
});

const JobDetailsResponse = Type.Object({
    id: Type.String(),
    accountId: Type.String(),
    name: Type.String(),
    status: Type.String(),
    description: Type.Optional(Type.String()),
    parentJobId: Type.Optional(Type.String()),
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

const UpdateJobRequestBody = Type.Object({
    status: Type.String({ enum: Object.values(JOBSTATUS) }),
    description: Type.Optional(Type.String()),
    endTime: Type.Optional(Type.Number()),
    error: Type.Optional(Type.String())
})

type UpdateJobRecordType = Static<typeof UpdateJobRequestBody>;

const UpdateJobResponse = Type.Object({
    id: Type.String(),
    accountId: Type.String(),
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

const CreateJobObject = Type.Object({
    accountId: Type.String(),
    name: Type.String(),
    status: Type.String({
        enum: Object.values(JOBSTATUS)
    }),
    description: Type.Optional(Type.String()),
    parentJobId: Type.Optional(Type.String()),
    resourceName: Type.String(),
    type: Type.String({
        enum: Object.values(JOBTYPE)
    }),
    startTime: Type.Number(),
    endTime: Type.Optional(Type.Number()),
    error: Type.Optional(Type.String()),
    initiator: Type.Optional(Type.String())
});

type JobRecordType = Static<typeof CreateJobObject>;

const CreateJobRequestBody = Type.Object({
    items: Type.Array(CreateJobObject)
})
const CreateJobResponse = Type.Object({
    count: Type.Number()
});

const JobsParams = Type.Object({
    accountId: Type.String({ minLength: 1 }),
    jobId: Type.String({ minLength: 1 })
});

export {
    ListJobsQueryString,
    ListJobsQueryType,
    ListJobsResponse,
    JobDetailsResponse,
    DeleteJobResponse,
    UpdateJobRecordType,
    UpdateJobRequestBody,
    UpdateJobResponse,
    CreateJobRequestBody,
    CreateJobResponse,
    CreateJobObject,
    JobRecordType,
    JobsParams,
    //TODO : DELETE ME
    DeploymentJobsCountQueryString,
    DeploymentJobsCountResponse
};
