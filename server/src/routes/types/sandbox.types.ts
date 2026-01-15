import { Static, Type } from '@fastify/type-provider-typebox';
import { SANDBOX_LIFECYCLE_REFRESH, SANDBOX_LIFECYCLE_REBASELINE } from '../../utils/consts';
import { API_DESCRIPTION } from '../../utils/schema-description-consts';
import { DatabaseHostSummaryParams } from './database-hosts.types';

const CreateSandboxBody = Type.Object({
    source: Type.Object({
        host: Type.String(), // ec2 instance
        instance: Type.String(), // sql server instance - ideally only one would be there
        database: Type.String({ maxLength: 27, pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$' }) // database inside sql server instance
    }),
    destination: Type.Object({
        host: Type.String(), // ec2 instance
        instance: Type.String(), // sql server - ideally only one would be there
        database: Type.String({ maxLength: 27, pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$' }) // database
    }),
    mountPoints: Type.Object({
        dataDrive: Type.String({ maxLength: 1, pattern: '^[D-Z]$' }),
        logDrive: Type.String({ maxLength: 1, pattern: '^[D-Z]$' })
    }),
    tag: Type.String({ enum: ['Development', 'QA', 'Integration', 'Training', 'Analytics', 'Other'] })
});

const SandboxSavingsResponseBody = Type.Object({
    consumedStorage: Type.Number(),
    savedStorage: Type.Number(),
    sandboxSavingsPercentage: Type.Number()
});

const SandboxInfoResponse = Type.Object({
    sandboxName: Type.Optional(Type.String()),
    databaseHostName: Type.String(),
    databaseHostId: Type.String({
        description:
            'Unique identifier for database hosts managed by Workload Factory. The value for databaseHostId can be found using the GET database hosts API under Resources section in Database.'
    }),
    databaseInstanceName: Type.Optional(Type.String()),
    databaseInstanceId: Type.Optional(Type.String()),
    sourceDatabaseName: Type.Optional(Type.String()),
    sourceDatabaseHostName: Type.Optional(Type.String()),
    sourceDatabaseInstanceName: Type.Optional(Type.String()),
    createdAt: Type.Optional(Type.Number()),
    updatedAt: Type.Optional(Type.Number()),
    tag: Type.Optional(Type.String()),
    baseSnapshot: Type.Optional(Type.String()),
    error: Type.Optional(Type.Any())
});

const SandboxInfoResponseBody = Type.Object({
    count: Type.Number(),
    items: Type.Optional(Type.Array(SandboxInfoResponse)),
    nextToken: Type.Optional(Type.String())
});

const SandboxParams = Type.Intersect([
    DatabaseHostSummaryParams,
    Type.Object({
        sandboxName: Type.String({ maxLength: 27, pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$' }),
        databaseInstanceId: Type.String({ description: API_DESCRIPTION.DATABASE_INSTANCE_ID_DESC })
    })
]);

const SplitEstimatesResponse = Type.Object({
    volumes: Type.Array(
        Type.Object({
            name: Type.String(),
            splitEstimate: Type.Number()
        })
    )
});

const SandboxSnapshotsResponse = Type.Object({
    snapshots: Type.Array(
        Type.Object({
            name: Type.String(),
            created: Type.Number()
        })
    )
});

const SandboxSnapshotsQueryParams = Type.Object({
    historical: Type.Optional(Type.Boolean())
});

const SandboxLifeCycleBody = Type.Object({
    snapshot: Type.Optional(Type.String()),
    action: Type.String({ enum: [SANDBOX_LIFECYCLE_REFRESH, SANDBOX_LIFECYCLE_REBASELINE] })
});

const DatabaseMountPointResponseBody = Type.Object({
    databaseDataPath: Type.Array(Type.String()),
    databaseLogPath: Type.Array(Type.String())
});

const DatabaseMountPointRequestQueryParam = Type.Object({
    databaseName: Type.String(),
    databaseInstanceId: Type.String()
});

type SandboxSavingsResponseBodyType = Static<typeof SandboxSavingsResponseBody>;
type SandboxInfoResponseType = Static<typeof SandboxInfoResponse>;
type SandboxInfoResponseBodyType = Static<typeof SandboxInfoResponseBody>;
type DatabaseMountPointResponseType = Static<typeof DatabaseMountPointResponseBody>;

export {
    SandboxSavingsResponseBodyType,
    SandboxInfoResponseBodyType,
    SandboxInfoResponseType,
    DatabaseMountPointResponseType,
    CreateSandboxBody,
    SandboxSavingsResponseBody,
    SandboxInfoResponseBody,
    SandboxParams,
    SplitEstimatesResponse,
    SandboxSnapshotsResponse,
    SandboxSnapshotsQueryParams,
    SandboxLifeCycleBody,
    DatabaseMountPointResponseBody,
    DatabaseMountPointRequestQueryParam
};
