import { Type, Static } from '@fastify/type-provider-typebox';
import { DatabaseHostInstanceSummaryParams } from './database-hosts.types';

const LogsAnalyzerParams = DatabaseHostInstanceSummaryParams;

const InferenceConfig = Type.Object({
    temperature: Type.Optional(Type.Number()),
    topP: Type.Optional(Type.Number()),
    maxTokens: Type.Optional(Type.Number())
});
const LogsAnalyzerBody = Type.Optional(
    Type.Object({
        inferenceConfig: Type.Optional(InferenceConfig),
        logsAnalyzerS3SignedUrl: Type.Optional(Type.String()),
        logsCountToConsider: Type.Optional(Type.Number()),
        logsAnalyzerFromTimestamp: Type.Optional(Type.Number()),
        logLevel: Type.Optional(Type.String()),
        logsWindowDuration: Type.Optional(Type.Number()),
        monitorUsage: Type.Optional(Type.Boolean())
    })
);

type LogsAnalyzerBodyType = Static<typeof LogsAnalyzerBody>;

type LogsAnalyzerParamsType = Static<typeof LogsAnalyzerParams>;
type InferenceConfigType = Static<typeof InferenceConfig>;

const RemediationRecommendationObject = Type.Object({
    error: Type.String(),
    context: Type.Optional(Type.String()),
    cause: Type.String(),
    count: Type.Number(),
    severity: Type.Optional(Type.String()),
    remediation: Type.Array(Type.String()),
    firstOccurrence: Type.Optional(Type.Number()),
    lastOccurrence: Type.Optional(Type.Number()),
    errorCode: Type.Optional(Type.String()),
    uniqueErrorKey: Type.Optional(Type.String()),
    sql: Type.Optional(Type.Array(Type.String())),
    tags: Type.Optional(Type.Array(Type.String())),
    additionalInfo: Type.Optional(
        Type.Array(
            Type.Object({
                query: Type.Optional(Type.String()),
                result: Type.Optional(Type.String()),
                error: Type.Optional(Type.String())
            })
        )
    ),
    hourlyErrorCounts: Type.Optional(
        Type.Array(
            Type.Object({
                hour: Type.Number(),
                count: Type.Number()
            })
        )
    )
});
type RemediationRecommendationObjectType = Static<typeof RemediationRecommendationObject>;

type LogsAnalyzerBody = Static<typeof LogsAnalyzerBody>;

const ReportIdentifier = Type.Object({
    id: Type.String(),
    creationTime: Type.Number()
});
const LAPRReadiness = Type.Object({
    ready: Type.Optional(Type.Boolean()),
    message: Type.Optional(Type.String())
});

const LogsAnalysisPreRequisites = Type.Object({
    items: Type.Array(
        Type.Object({
            errorMessage: Type.Optional(Type.String()),
            databaseHostId: Type.Optional(Type.String()),
            ec2InstanceId: Type.Optional(Type.String()),
            bedrockPreRequisites: Type.Optional(LAPRReadiness),
            instanceProfilePreRequisites: Type.Optional(LAPRReadiness),
            credentialsPreRequisites: Type.Optional(LAPRReadiness),
            networkingPreRequisites: Type.Optional(LAPRReadiness)
        })
    )
});

const SeverityCounts = Type.Object({
    warning: Type.Optional(Type.Number()),
    severe: Type.Optional(Type.Number()),
    critical: Type.Optional(Type.Number())
});

type SeverityCountsType = Static<typeof SeverityCounts>;

const LatestReportObject = Type.Object({
    id: Type.String(),
    databaseHostId: Type.String(),
    databaseInstanceId: Type.String(),
    latestReport: Type.Object({
        jobId: Type.String(),
        creationTime: Type.Number(),
        errorCount: Type.Number(),
        severityCounts: Type.Optional(SeverityCounts)
    })
});

const LatestReports = Type.Object({
    items: Type.Array(LatestReportObject)
});

const AnalyzePreRequisitesQuery = Type.Object({
    databaseHostId: Type.Optional(
        Type.String({
            description: 'Database Host ID of managed database hosts',
            minLength: 8,
            maxLength: 200,
            pattern: '^[a-zA-Z0-9-]{5,}(?:,[a-zA-Z0-9-]{5,}){0,4}$'
        })
    ),
    ec2InstanceId: Type.Optional(
        Type.String({
            description: 'EC2 Instance ID of unmanaged database host instances',
            minLength: 8,
            maxLength: 200,
            pattern: '^i-[0-9a-z]{8,17}(?:,i-[0-9a-z]{8,17}){0,4}$'
        })
    )
});

export {
    LogsAnalyzerParams,
    LogsAnalyzerParamsType,
    LogsAnalyzerBody,
    LogsAnalyzerBodyType,
    InferenceConfigType,
    RemediationRecommendationObject,
    ReportIdentifier,
    RemediationRecommendationObjectType,
    LogsAnalysisPreRequisites,
    LatestReports,
    AnalyzePreRequisitesQuery,
    SeverityCounts,
    SeverityCountsType
};
