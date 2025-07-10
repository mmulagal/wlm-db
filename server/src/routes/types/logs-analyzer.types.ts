import { Type, Static } from '@fastify/type-provider-typebox';
import { DatabaseHostInstanceSummaryParams } from './database-hosts.types';

const LogsAnalyzerParams = DatabaseHostInstanceSummaryParams;

const InferenceConfig = Type.Object({
    temperature: Type.Number(),
    topP: Type.Number(),
    maxTokens: Type.Number()
});
const LogsAnalyzerBody = Type.Optional(
    Type.Object({
        inferenceConfig: Type.Optional(InferenceConfig),
        logsAnalyzerS3SignedUrl: Type.Optional(Type.String()),
        logsCountToConsider: Type.Optional(Type.Number()),
        logsAnalyzerFromTimestamp: Type.Optional(Type.Number())
    })
);

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
    sql: Type.Optional(Type.String()),
    additionalInfo: Type.Optional(Type.Any()),
    hourlyErrorCounts: Type.Optional(
        Type.Array(
            Type.Object({
                hour: Type.Number(),
                count: Type.Number()
            })
        )
    )
});
type LogsAnalyzerBody = Static<typeof LogsAnalyzerBody>;

const ReportIdentifier = Type.Object({
    id: Type.String(),
    creationTime: Type.Number()
});

export {
    LogsAnalyzerParams,
    LogsAnalyzerParamsType,
    LogsAnalyzerBody,
    InferenceConfigType,
    RemediationRecommendationObject,
    ReportIdentifier
};
