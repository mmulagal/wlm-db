import { Static, Type } from '@fastify/type-provider-typebox';
import { BILLING, PRICING } from '../../utils/consts';
import { CredentialsIdParams } from './generic.types';

const DatabaseHostObjectParams = Type.Object({
    accountId: Type.String({ minLength: 1 })
});
type DatabaseHostObjectParamsType = Static<typeof DatabaseHostObjectParams>;

const DatabaseHostSummaryParams = Type.Composite([CredentialsIdParams, Type.Object({ databaseHostId: Type.String() })]);
type DatabaseHostSummaryParamsType = Static<typeof DatabaseHostSummaryParams>;

const CreateDatabaseParams = Type.Object({
    accountId: Type.String({ minLength: 7 }),
    databaseHostId: Type.String({ minLength: 10 }),
    credentialsId: Type.String(),
    region: Type.String()
});

// Query parameter to fetch protection, performance, storage and cost details
const DatabaseHostQueryString = Type.Object({
    fields: Type.Optional(Type.String()),
    vpcId: Type.Optional(Type.String()),
    fsxId: Type.Optional(Type.String()),
    nextToken: Type.Optional(Type.String()),
    pageSize: Type.Optional(Type.Number())
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

const ProtectionPerStorageTypeResponse = Type.Object({
    isSqlNativeEnabled: Type.Boolean({ default: false }),
    isAwsBackupEnabled: Type.Object({
        fsxn: Type.Boolean({ default: false }),
        fsxw: Type.Boolean({ default: false }),
        ebs: Type.Boolean({ default: false })
    }),
    isFsxOntapSnapshotsEnabled: Type.Boolean({ default: false }),
    protectedDatabases: Type.Optional(Type.Number({ description: 'Number of protected databases' }))
});
type ProtectionPerStorageTypeResponseType = Static<typeof ProtectionPerStorageTypeResponse>;

const RWPerformanceResponse = Type.Object({
    read: Type.Number({ description: 'Database server read performance for latency, IOPS or throughput' }),
    write: Type.Number({ description: 'Database server write performance for latency, IOPS or throughput' })
});

const LatencyResponse = Type.Composite([
    RWPerformanceResponse,
    Type.Object({ serverIo: Type.Number({ description: 'Database server IO performance for latency' }) })
]);

type RWPerformanceResponseType = Static<typeof RWPerformanceResponse>;

const DetailedPerformanceResponse = Type.Object({
    latency: LatencyResponse,
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
    used: Type.Optional(Type.Number({ description: 'The virtual space used before storage efficiency, in bytes.' })),
    spaceSavings: Type.Optional(
        Type.Number({
            description: 'Total disk space saved in the volume due to storage efficiency, in bytes.'
        })
    ),
    spaceSavingsPercentage: Type.Optional(
        Type.Number({
            description: 'Total disk space saved in the volume due to storage efficiency, in percentage.'
        })
    ),
    protocol: Type.Optional(Type.String({ description: 'Data sharing protocol, iSCSI or SMB' }))
});
type StorageResponseType = Static<typeof StorageResponse>;

const StoragePerStorageTypeResponse = Type.Object({
    fsxn: Type.Optional(StorageResponse),
    fsxw: Type.Optional(StorageResponse),
    ebs: Type.Optional(StorageResponse)
});
type StoragePerStorageTypeResponseType = Static<typeof StoragePerStorageTypeResponse>;

const UsageCostPerStorageTypeResponse = Type.Object({
    compute: Type.Number({ description: 'Compute cost in dollars' }),
    storage: Type.Object({
        fsxn: Type.Number({ description: 'FSX for NetApp ONTAP Storage  cost in dollars' }),
        fsxw: Type.Optional(Type.Number({ description: 'FSX for Windows Storage cost in dollars' })),
        ebs: Type.Optional(Type.Number({ description: 'EBS Storage cost in dollars' }))
    }),
    connectivity: Type.Number({ description: 'Connectivity cost in dollars' }),
    others: Type.Number({
        description: 'Other services like active directory, cloudwatch logging, etc costs in dollars'
    }),
    estimationType: Type.String({ enum: [BILLING, PRICING] })
});
type UsageCostResponseType = Static<typeof UsageCostPerStorageTypeResponse>;

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
    remaining: Type.String({ minLength: 1 }),
    error: Type.Optional(Type.String())
});
type UtilizationResponseType = Static<typeof UtilizationResponse>;

const ResourcesUtilizationResponse = Type.Object({
    cpu: UtilizationResponse,
    memory: UtilizationResponse,
    disk: UtilizationResponse
});
type ResourcesUtilizationResponseType = Static<typeof ResourcesUtilizationResponse>;

// const DatabaseHostSummaryResponse = Type.Object({
//     id: Type.String(),
//     name: Type.String(),
//     status: Type.String({ enum: ['Up', 'Down', 'N/A'] }),
//     databaseCount: Type.Optional(Type.Number()),
//     databaseServer: Type.Optional(DatabaseServerMetadataResponse),
//     topology: Type.Optional(TopologyResponse),
//     protection: Type.Optional(ProtectionResponse),
//     performance: Type.Optional(PerformanceResponse),
//     storage: Type.Optional(StorageResponse),
//     estimatedUsageCost: Type.Optional(UsageCostPerStorageTypeResponse),
//     resourceUtilization: Type.Optional(ResourcesUtilizationResponse),
//     errors: Type.Optional(Type.Any())
// });
// const DatabaseHostSummaryListResponse = Type.Object({
//     count: Type.Number(),
//     items: Type.Array(DatabaseHostSummaryResponse),
//     nextToken: Type.Optional(Type.String())
// });

// type DatabaseHostSummaryResponseType = Static<typeof DatabaseHostSummaryResponse>;
// type DatabaseHostSummaryListResponseType = Static<typeof DatabaseHostSummaryListResponse>;
const EbsResourceInfoResponse = Type.Array(
    Type.Object({
        id: Type.String(),
        size: Type.Number(),
        cost: Type.Number(),
        throughput: Type.Optional(Type.Number()), // Optional for gp2 volumes
        iops: Type.Optional(Type.Number()), // Optional for st1
        volumeType: Type.String()
    })
);
const DatabaseHostSummaryPerStorageTypeResponse = Type.Object({
    id: Type.String(),
    name: Type.String(),
    status: Type.String({ enum: ['Up', 'Down', 'N/A'] }),
    databaseCount: Type.Optional(Type.Number()),
    databaseServer: Type.Optional(DatabaseServerMetadataResponse),
    topology: Type.Optional(TopologyResponse),
    protection: Type.Optional(ProtectionPerStorageTypeResponse),
    performance: Type.Optional(PerformanceResponse),
    storage: Type.Optional(StoragePerStorageTypeResponse),
    ebsResourceInfo: Type.Optional(EbsResourceInfoResponse),
    estimatedUsageCost: Type.Optional(UsageCostPerStorageTypeResponse),
    resourceUtilization: Type.Optional(ResourcesUtilizationResponse),
    errors: Type.Optional(Type.Any())
});
const DatabaseHostSummaryPerStorageTypeListResponse = Type.Object({
    count: Type.Number(),
    items: Type.Array(DatabaseHostSummaryPerStorageTypeResponse),
    nextToken: Type.Optional(Type.String())
});

type DatabaseHostSummaryPerStorageTypeResponseType = Static<typeof DatabaseHostSummaryPerStorageTypeResponse>;
type DatabaseHostSummaryPerStorageTypeListResponseType = Static<typeof DatabaseHostSummaryPerStorageTypeListResponse>;

const DatabasesResponse = Type.Object({
    name: Type.String({ minLength: 1 }),
    status: Type.String({ minLength: 1 }),
    type: Type.String({ minLength: 1 }),
    size: Type.Number(),
    protection: ProtectionPerStorageTypeResponse
});
type DatabasesResponseType = Static<typeof DatabasesResponse>;

const DatabasesListResponse = Type.Object({
    count: Type.Number(),
    nextToken: Type.Optional(Type.String()),
    items: Type.Array(DatabasesResponse)
});
type DatabasesListResponseType = Static<typeof DatabasesListResponse>;

// Cloud formation template creation Request and Response

const FileConfig = Type.Object({
    fileName: Type.String({ minLength: 5 }),
    volumeSize: Type.Number({ minimum: 1 }),
    drive: Type.String({ maxLength: 1 }),
    isExisting: Type.Boolean()
});

const CreateDatabseRequestBody = Type.Object({
    databaseName: Type.String({ minLength: 1, maxLength: 123 }),
    dataFileConfig: FileConfig,
    logFileConfig: FileConfig,
    collation: Type.String()
});

const DatabasesCreateResponse = Type.Object({
    jobId: Type.String()
});

type DatabaseCreateResponseType = Static<typeof DatabasesCreateResponse>;
type FileConfigType = Static<typeof FileConfig>;

const DriveInfoResponseBody = Type.Object({
    existingDriveInfo: Type.Array(
        Type.Object({
            driveLetter: Type.String(),
            availableSize: Type.Number(),
            isNetappDrive: Type.Boolean(),
            isDriveClustered: Type.Optional(Type.Boolean())
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

const DatabaseHostSummaryParamsWithRegion = Type.Object({
    accountId: Type.String({ minLength: 1 }),
    databaseHostId: Type.String({ minLength: 1 }),
    credentialsId: Type.String(),
    region: Type.String()
});
type DatabaseHostSummaryParamsWithRegionType = Static<typeof DatabaseHostSummaryParamsWithRegion>;

const CloneDatabaseHostBody = Type.Object({
    source: Type.Object({
        host: Type.String(), // ec2 instance
        instance: Type.String(), // sql server instance - ideally only one would be there
        database: Type.String() // database inside sql server instance
    }),
    destination: Type.Object({
        host: Type.String(), // ec2 instance
        instance: Type.String(), // sql server - ideally only one would be there
        database: Type.String() // database
    }),
    tag: Type.String({ enum: ['Development', 'QA', 'Integration', 'Training', 'Analytics', 'Other'] })
});
type CloneDatabaseHostBodyType = Static<typeof CloneDatabaseHostBody>;
const CollationInfoResponseBody = Type.Object({
    collationList: Type.Array(
        Type.Object({
            name: Type.String(),
            description: Type.Optional(Type.String())
        })
    ),
    defaultCollation: Type.String()
});
type CollationInfoResponseBodyType = Static<typeof CollationInfoResponseBody>;

const SandboxSavingsResponseBody = Type.Object({
    consumedStorage: Type.Number(),
    savedStorage: Type.Number(),
    sandboxSavingsPercentage: Type.Number()
});

type SandboxSavingsResponseBodyType = Static<typeof SandboxSavingsResponseBody>;
const SandboxInfoResponse = Type.Object({
    sandboxName: Type.Optional(Type.String()),
    databaseHostName: Type.String(),
    databaseHostId: Type.String(),
    databaseInstanceName: Type.String(),
    sourceDatabaseName: Type.Optional(Type.String()),
    sourceDatabaseHostName: Type.Optional(Type.String()),
    sourceDatabaseInstanceName: Type.Optional(Type.String()),
    createdAt: Type.Optional(Type.Number()),
    updatedAt: Type.Optional(Type.Number()),
    tag: Type.Optional(Type.String()),
    error: Type.Optional(Type.Any())
});

const SandboxInfoResponseBody = Type.Object({
    count: Type.Number(),
    items: Type.Optional(Type.Array(SandboxInfoResponse)),
    nextToken: Type.Optional(Type.String())
});
type SandboxInfoResponseBodyType = Static<typeof SandboxInfoResponseBody>;
type SandboxInfoResponseType = Static<typeof SandboxInfoResponse>;

const SandboxConnectionStringParams = Type.Composite([
    DatabaseHostSummaryParams,
    Type.Object({ sandboxName: Type.String() })
]);

export {
    DatabaseHostObjectParams,
    DatabaseHostObjectParamsType,
    DatabaseHostQueryString,
    // DatabaseHostSummaryResponse,
    // DatabaseHostSummaryResponseType,
    // DatabaseHostSummaryListResponse,
    // DatabaseHostSummaryListResponseType,
    DatabaseHostSummaryPerStorageTypeResponse,
    DatabaseHostSummaryPerStorageTypeResponseType,
    DatabaseHostSummaryPerStorageTypeListResponse,
    DatabaseHostSummaryPerStorageTypeListResponseType,
    EC2InstanceDetailsResponse,
    EC2InstanceDetailsResponseType,
    TopologyResponse,
    TopologyResponseType,
    PerformanceResponse,
    PerformanceResponseType,
    ProtectionPerStorageTypeResponse,
    ProtectionPerStorageTypeResponseType,
    StorageResponse,
    StorageResponseType,
    StoragePerStorageTypeResponse,
    StoragePerStorageTypeResponseType,
    UsageCostPerStorageTypeResponse,
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
    CreateDatabseRequestBody,
    DatabasesCreateResponse,
    DatabaseCreateResponseType,
    CreateDatabaseParams,
    DriveInfoResponseBody,
    DriveInfoResponseBodyType,
    FileConfigType,
    DatabaseHostsParamsWithRegion,
    DatabaseHostSummaryParamsWithRegion,
    DatabaseHostSummaryParamsWithRegionType,
    CloneDatabaseHostBody,
    CloneDatabaseHostBodyType,
    CollationInfoResponseBodyType,
    CollationInfoResponseBody,
    SandboxSavingsResponseBody,
    SandboxSavingsResponseBodyType,
    SandboxInfoResponse,
    SandboxInfoResponseType,
    SandboxInfoResponseBody,
    SandboxInfoResponseBodyType,
    SandboxConnectionStringParams
};
