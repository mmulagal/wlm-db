import { Static, Type } from '@fastify/type-provider-typebox';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';

const JobsGenericParams = Type.Object({
    accountId: Type.String(),
    credentialsId: Type.String(),
    region: Type.String()
});

const JobSummaryQueryString = Type.Object({
    startTime: Type.Optional(Type.Number()),
    endTime: Type.Optional(Type.Number())
});

const JobSummaryResponse = Type.Object({
    inProgress: Type.Number(),
    completed: Type.Number(),
    failed: Type.Number()
});

type JobSummaryResponseType = Static<typeof JobSummaryResponse>;

const JobSummaryByTimeRecord = Type.Object({
    endTime: Type.Number(),
    completed: Type.Optional(Type.Number()),
    failed: Type.Optional(Type.Number())
});

const JobSummaryByTimeResponse = Type.Array(Type.Optional(JobSummaryByTimeRecord));

type JobSummaryByTimeRecordType = Static<typeof JobSummaryByTimeRecord>;

const ListJobsQueryString = Type.Object({
    parentJobId: Type.Optional(Type.String()),
    sort: Type.Optional(Type.String()),
    sortOrder: Type.Optional(Type.String()),
    initiator: Type.Optional(Type.String()),
    type: Type.Optional(Type.String()),
    status: Type.Optional(Type.String()),
    startTime: Type.Optional(Type.Number()),
    endTime: Type.Optional(Type.Number()),
    limit: Type.Optional(Type.Number()),
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
});

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
    name: Type.String(),
    credentialsId: Type.String(),
    region: Type.String(),
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
});
const CreateJobResponse = Type.Object({
    count: Type.Number()
});

const JobsParams = Type.Composite([JobsGenericParams, Type.Object({ jobId: Type.String({ minLength: 1 }) })]);

export {
    JobsGenericParams,
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
    JobSummaryQueryString,
    JobSummaryResponse,
    JobSummaryResponseType,
    JobSummaryByTimeResponse,
    JobSummaryByTimeRecordType
};
