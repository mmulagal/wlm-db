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
        inferenceConfig: InferenceConfig
    })
);

type LogsAnalyzerParamsType = Static<typeof LogsAnalyzerParams>;
type InferenceConfigType = Static<typeof InferenceConfig>;

export { LogsAnalyzerParams, LogsAnalyzerParamsType, LogsAnalyzerBody, InferenceConfigType };
