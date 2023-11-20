import { Static, Type } from '@fastify/type-provider-typebox';

const DatabaseHostObjectParams = Type.Object({
    accountId: Type.String({ minLength: 1 })
});
type DatabaseHostObjectParamsType = Static<typeof DatabaseHostObjectParams>;

// Query parameter to fetch protection, performance, storage and cost details
const DatabaseHostQueryString = Type.Object({
    fields: Type.Optional(Type.String())
});

const EC2InstanceDetailsResponse = Type.Object({
    id: Type.String(),
    name: Type.String(),
    ebsVolumeId: Type.String()
});
type EC2InstanceDetailsResponseType = Static<typeof EC2InstanceDetailsResponse>;

const TopologyResponse = Type.Object({
    region: Type.String(),
    serverType: Type.String({ enum: ['Microsoft SQL Server'] }),
    serverInstallationMode: Type.String({ enum: ['Standalone', 'FCI'] }),
    fileSystemType: Type.String({ enum: ['EBS', 'FSx ONTAP'] }),
    fileSystemId: Type.String(),
    vpcId: Type.Optional(Type.String()),
    ec2Details: Type.Array(EC2InstanceDetailsResponse)
});
type TopologyResponseType = Static<typeof TopologyResponse>;

const ProtectionResponse = Type.Object({
    isAwsBackUpEnabled: Type.Boolean({ default: false }),
    isFsxOntapSnapshotsEnabled: Type.Boolean({ default: false }),
    isSqlNativeEnabled: Type.Boolean({ default: false })
});
type ProtectionResponseType = Static<typeof ProtectionResponse>;

const PerformanceResponse = Type.Object({
    latency: Type.Number({ description: 'Database server I/O latency in milliseconds' }),
    assessment: Type.String({ enum: ['High', 'Medium', 'Low'] })
});
type PerformanceResponseType = Static<typeof PerformanceResponse>;

const StorageResponse = Type.Object({
    size: Type.Number({ description: 'Provisioned size, in bytes' }),
    used: Type.Number({ description: 'The virtual space used before storage efficiency, in bytes.' }),
    spaceSavings: Type.Number({
        description: 'Total disk space saved in the volume due to storage efficiency, in bytes.'
    })
});
type StorageResponseType = Static<typeof StorageResponse>;

const UsageCostResponse = Type.Object({
    compute: Type.Number({ description: 'Compute cost in dollars' }),
    storage: Type.Number({ description: 'Storage  cost in dollars' }),
    connectivity: Type.Number({ description: 'Connectivity cost in dollars' }),
    others: Type.Number({
        description: 'Other services like active directory, cloudwatch logging, etc costs in dollars'
    })
});
type UsageCostResponseType = Static<typeof UsageCostResponse>;

const DatabaseHostSummaryResponse = Type.Object({
    id: Type.String(),
    name: Type.String(),
    status: Type.String({ enum: ['Up', 'Down', 'N/A'] }),
    databaseCount: Type.Number(),
    topology: Type.Optional(TopologyResponse),
    protection: Type.Optional(ProtectionResponse),
    performance: Type.Optional(PerformanceResponse),
    storage: Type.Optional(StorageResponse),
    estimatedUsageCost: Type.Optional(UsageCostResponse)
});
const DatabaseHostSummaryListResponse = Type.Object({
    count: Type.Number(),
    nextToken: Type.String(),
    items: Type.Array(DatabaseHostSummaryResponse)
});

type DatabaseHostSummaryResponseType = Static<typeof DatabaseHostSummaryResponse>;
type DatabaseHostSummaryListResponseType = Static<typeof DatabaseHostSummaryListResponse>;

export {
    DatabaseHostObjectParams,
    DatabaseHostObjectParamsType,
    DatabaseHostQueryString,
    DatabaseHostSummaryResponse,
    DatabaseHostSummaryResponseType,
    DatabaseHostSummaryListResponse,
    DatabaseHostSummaryListResponseType,
    EC2InstanceDetailsResponse,
    EC2InstanceDetailsResponseType,
    TopologyResponse,
    TopologyResponseType,
    PerformanceResponse,
    PerformanceResponseType,
    ProtectionResponse,
    ProtectionResponseType,
    StorageResponse,
    StorageResponseType,
    UsageCostResponse,
    UsageCostResponseType
};
