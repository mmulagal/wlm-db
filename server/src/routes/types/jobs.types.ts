import { Static, Type } from '@fastify/type-provider-typebox';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import {
    CredentialsIdRegionQueryParams,
    CredentialsIdRegionParams,
    RegionDetails,
    AccountIdParams
} from './generic.types';

const JobSummaryQueryString = Type.Intersect([
    CredentialsIdRegionQueryParams,
    Type.Object({
        startTime: Type.Optional(Type.Number()),
        endTime: Type.Optional(Type.Number())
    })
]);

type JobSummaryQueryType = Static<typeof JobSummaryQueryString>;

const JobSummaryResponse = Type.Object({
    inProgress: Type.Number(),
    completed: Type.Number(),
    failed: Type.Number(),
    warning: Type.Number()
});

type JobSummaryResponseType = Static<typeof JobSummaryResponse>;

const JobSummaryByTimeRecord = Type.Object({
    endTime: Type.Number(),
    completed: Type.Optional(Type.Number()),
    failed: Type.Optional(Type.Number()),
    warning: Type.Optional(Type.Number())
});

const JobSummaryByTimeResponse = Type.Array(Type.Optional(JobSummaryByTimeRecord));

type JobSummaryByTimeRecordType = Static<typeof JobSummaryByTimeRecord>;

const ListJobsQueryString = Type.Intersect([
    CredentialsIdRegionQueryParams,
    Type.Object({
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
        includeSubJobs: Type.Optional(Type.Boolean()),
        resourceName: Type.Optional(Type.String())
    })
]);

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
    subJobs: Type.Optional(Type.Array(Type.Any())),
    metadata: Type.Optional(Type.Any())
});

const ListJobsResponse = Type.Object({
    count: Type.Number(),
    items: Type.Array(Type.Intersect([CredentialsIdRegionParams, JobObject])),
    nextToken: Type.Optional(Type.String())
});

const JobDetailsResponse = Type.Object({
    id: Type.String(),
    accountId: Type.String(),
    credentialsId: Type.Optional(Type.String()),
    region: Type.Optional(RegionDetails),
    name: Type.String(),
    status: Type.String(),
    description: Type.Optional(Type.String()),
    parentJobId: Type.Optional(Type.String()),
    resourceName: Type.String(),
    type: Type.String(),
    startTime: Type.Number(),
    endTime: Type.Optional(Type.Number()),
    error: Type.Optional(Type.String()),
    subJobs: Type.Optional(Type.Array(Type.Intersect([CredentialsIdRegionParams, JobObject]))),
    metadata: Type.Optional(Type.Any())
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
    initiator: Type.Optional(Type.String()),
    metadata: Type.Optional(Type.Any())
});
type JobRecordType = Static<typeof CreateJobObject>;

const CreateJobRequestBody = Type.Intersect([
    CredentialsIdRegionQueryParams,
    Type.Object({ items: Type.Array(CreateJobObject) })
]);
const CreateJobResponse = Type.Object({
    count: Type.Number()
});
const JobsParams = Type.Object({ accountId: Type.String({ minLength: 1 }), jobId: Type.String({ minLength: 1 }) });
const JobsParamsWriter = Type.Intersect([AccountIdParams, Type.Object({ jobId: Type.String({ minLength: 1 }) })]);

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
    JobsParamsWriter,
    JobSummaryQueryString,
    JobSummaryResponse,
    JobSummaryResponseType,
    JobSummaryByTimeResponse,
    JobSummaryByTimeRecordType,
    JobSummaryQueryType
};
