import { Static, Type } from '@fastify/type-provider-typebox';
import { RouteTags } from '../../utils/consts';

const LogsAnalyzerParams = Type.Object({
    accountId: Type.String({ minLength: 7 }),
    databaseHostId: Type.String({
        minLength: 10,
        description:
            'Unique identifier for database hosts managed by Workload Factory. The value for databaseHostId can be found using the GET database hosts API under Resources section in Database.'
    }),
    databaseInstanceId: Type.String({
        description:
            'Unique identifier for a database instance managed by Workload Factory. The value for databaseInstanceId can be found using the GET database hosts API under Resources section in Database.'
    }),
    credentialsId: Type.String({ format: 'uuid' }),
    region: Type.String()
});

const LogsAnalyzerSchema = {
    tags: [RouteTags.LOGS_ANALYSIS],
    params: LogsAnalyzerParams,
    summary: 'Trigger logs analysis for a specific database instance in a remote database host machine',
    response: {
        200: Type.Object({
            jobId: Type.String()
        })
    }
};

const LogsAnalyzerResponse = Type.Object({
    message: Type.String()
});
type LogsAnalyzerResponseType = Static<typeof LogsAnalyzerResponse>;

export { LogsAnalyzerSchema, LogsAnalyzerResponse, LogsAnalyzerResponseType };
