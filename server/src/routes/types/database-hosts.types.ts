import { Static, Type } from '@fastify/type-provider-typebox';
import { BILLING, PRICING } from '../../utils/consts';
import { CredentialsIdParams } from './generic.types';

const DatabaseHostObjectParams = Type.Object({
    accountId: Type.String({ minLength: 1 })
});
type DatabaseHostObjectParamsType = Static<typeof DatabaseHostObjectParams>;

const DatabaseHostSummaryParams = Type.Composite([CredentialsIdParams, Type.Object({ databaseHostId: Type.String() })]);
type DatabaseHostSummaryParamsType = Static<typeof DatabaseHostSummaryParams>;

// Query parameter to fetch protection, performance, storage and cost details
const DatabaseHostQueryString = Type.Object({
    fields: Type.Optional(Type.String()),
    nextToken: Type.Optional(Type.String())
});

const EC2InstanceDetailsResponse = Type.Object({
    id: Type.String(),
    name: Type.Optional(Type.String()),
    ebsVolumeId: Type.String(),
    instanceType: Type.Optional(Type.String()),
    availabilityZone: Type.Optional(Type.String()),
    subnetId: Type.Optional(Type.String())
});
type EC2InstanceDetailsResponseType = Static<typeof EC2InstanceDetailsResponse>;

const ActiveDirectoryDetailsResponse = Type.Object({
    name: Type.String({ minLength: 1 }),
    address: Type.String({ minLength: 1 })
});
type ActiveDirectoryDetailsResponseType = Static<typeof ActiveDirectoryDetailsResponse>;

const TopologyResponse = Type.Object({
    awsAccount: Type.String({ minLength: 1 }),
    region: Type.String(),
    serverType: Type.String({ enum: ['Microsoft SQL Server'] }),
    serverInstallationMode: Type.String({ enum: ['Standalone', 'FCI'] }),
    fileSystemType: Type.String({ enum: ['EBS', 'FSx for ONTAP', 'FSx for Windows'] }),
    fileSystemId: Type.String(),
    fileSystemName: Type.Optional(Type.String()),
    fileSystemDeploymentMode: Type.Optional(Type.String()),
    fileSystemStatus: Type.Optional(Type.String()),
    fileSystemStorageCapacity: Type.Optional(Type.Number()),
    fileSystemThroughputCapacity: Type.Optional(Type.Number()),
    vpcId: Type.Optional(Type.String()),
    vpcName: Type.Optional(Type.String()),
    vpcCidr: Type.Optional(Type.String()),
    availabilityZones: Type.Optional(Type.Array(Type.String())),
    keyPairName: Type.Optional(Type.String()),
    ec2Details: Type.Optional(Type.Array(EC2InstanceDetailsResponse)),
    activeDirectoryDetails: Type.Optional(ActiveDirectoryDetailsResponse)
});
type TopologyResponseType = Static<typeof TopologyResponse>;

const ProtectionResponse = Type.Object({
    isAwsBackUpEnabled: Type.Boolean({ default: false }),
    isFsxOntapSnapshotsEnabled: Type.Boolean({ default: false }),
    isSqlNativeEnabled: Type.Boolean({ default: false }),
    protectedDatabases: Type.Optional(Type.Number({ description: 'Number of protected databases' }))
});
type ProtectionResponseType = Static<typeof ProtectionResponse>;

const RWPerformanceResponse = Type.Object({
    read: Type.Number({ description: 'Database server read performance for latency, IOPS or throughput' }),
    write: Type.Number({ description: 'Database server write performance for latency, IOPS or throughput' })
});
type RWPerformanceResponseType = Static<typeof RWPerformanceResponse>;

const DetailedPerformanceResponse = Type.Object({
    latency: RWPerformanceResponse,
    iops: RWPerformanceResponse,
    throughput: RWPerformanceResponse
});
type DetailedPerformanceResponseType = Static<typeof DetailedPerformanceResponse>;

const PerformanceResponse = Type.Object({
    latency: Type.Optional(Type.Number({ description: 'Database server I/O latency in milliseconds' })),
    assessment: Type.Optional(Type.String({ enum: ['High', 'Medium', 'Low'] })),
    rwMetrics: Type.Optional(DetailedPerformanceResponse)
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
    }),
    estimationType: Type.String({ enum: [BILLING, PRICING] })
});
type UsageCostResponseType = Static<typeof UsageCostResponse>;

const DatabaseServerMetadataResponse = Type.Object({
    operatingSystem: Type.String({ minLength: 1 }),
    serverEdition: Type.String({ minLength: 1 }),
    serverVersion: Type.String({ minLength: 1 }),
    clusterName: Type.Optional(Type.String({ minLength: 1 })),
    activeNode: Type.String(),
    nodeNames: Type.Array(Type.String()),
    activeConnections: Type.Number(),
    creationDate: Type.String({ minLength: 1 })
});
type DatabaseServerMetadataResponseType = Static<typeof DatabaseServerMetadataResponse>;

const UtilizationResponse = Type.Object({
    percentUsed: Type.String({ minLength: 1 }),
    used: Type.String({ minLength: 1 }),
    total: Type.String({ minLength: 1 }),
    remaining: Type.String({ minLength: 1 })
});
type UtilizationResponseType = Static<typeof UtilizationResponse>;

const ResourcesUtilizationResponse = Type.Object({
    cpu: UtilizationResponse,
    memory: UtilizationResponse,
    disk: UtilizationResponse
});
type ResourcesUtilizationResponseType = Static<typeof ResourcesUtilizationResponse>;

const DatabaseHostSummaryResponse = Type.Object({
    id: Type.String(),
    name: Type.String(),
    status: Type.String({ enum: ['Up', 'Down', 'N/A'] }),
    databaseCount: Type.Number(),
    databaseServer: Type.Optional(DatabaseServerMetadataResponse),
    topology: Type.Optional(TopologyResponse),
    protection: Type.Optional(ProtectionResponse),
    performance: Type.Optional(PerformanceResponse),
    storage: Type.Optional(StorageResponse),
    estimatedUsageCost: Type.Optional(UsageCostResponse),
    resourceUtilization: Type.Optional(ResourcesUtilizationResponse),
    errors: Type.Optional(Type.Any())
});
const DatabaseHostSummaryListResponse = Type.Object({
    count: Type.Number(),
    items: Type.Array(DatabaseHostSummaryResponse),
    nextToken: Type.Optional(Type.String())
});

type DatabaseHostSummaryResponseType = Static<typeof DatabaseHostSummaryResponse>;
type DatabaseHostSummaryListResponseType = Static<typeof DatabaseHostSummaryListResponse>;

const DatabasesResponse = Type.Object({
    name: Type.String({ minLength: 1 }),
    status: Type.String({ minLength: 1 }),
    type: Type.String({ minLength: 1 }),
    size: Type.Number(),
    protection: ProtectionResponse
});
type DatabasesResponseType = Static<typeof DatabasesResponse>;

const DatabasesListResponse = Type.Object({
    count: Type.Number(),
    nextToken: Type.Optional(Type.String()),
    items: Type.Array(DatabasesResponse)
});
type DatabasesListResponseType = Static<typeof DatabasesListResponse>;

const DriveInfoResponseBody = Type.Object({
    existingDriveInfo: Type.Array(
        Type.Object({
            driveLetter: Type.String(),
            availableSize: Type.Number(),
            isNetappDrive: Type.Boolean()
        })
    ),
    defaultDataDrive: Type.Optional(Type.String()),
    defaultLogDrive: Type.Optional(Type.String()),
    availableDriveLetters: Type.Array(Type.String()),
    fsxStorageCapacity: Type.Optional(Type.Number())
});
type DriveInfoResponseBodyType = Static<typeof DriveInfoResponseBody>;

const DatabaseHostsParamsWithRegion = Type.Object({
    accountId: Type.String(),
    credentialsId: Type.String(),
    region: Type.String()
});

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
    UsageCostResponseType,
    DatabaseHostSummaryParams,
    DatabaseHostSummaryParamsType,
    DatabasesResponse,
    DatabasesResponseType,
    DatabasesListResponse,
    DatabasesListResponseType,
    DatabaseServerMetadataResponseType,
    ActiveDirectoryDetailsResponse,
    ActiveDirectoryDetailsResponseType,
    UtilizationResponseType,
    ResourcesUtilizationResponseType,
    DetailedPerformanceResponse,
    DetailedPerformanceResponseType,
    RWPerformanceResponse,
    RWPerformanceResponseType,
    DriveInfoResponseBody,
    DriveInfoResponseBodyType,
    DatabaseHostsParamsWithRegion
};
