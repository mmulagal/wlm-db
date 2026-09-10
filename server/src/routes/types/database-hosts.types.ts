import { Static, Type } from '@fastify/type-provider-typebox';
import { ConnectionStatus } from '@aws-sdk/client-ssm';
import { InstanceStateName } from '@aws-sdk/client-ec2';
import {
    BILLING,
    DatabaseHostsQueryFields,
    NOT_AVAILABLE,
    OFFLINE,
    ONLINE,
    PRICING,
    ServerState,
    UNKNOWN
} from '../../utils/consts';
import { CredentialsIdParams, FsxLinkReadinessResponse } from './generic.types';
import { API_DESCRIPTION, API_DESCRIPTION_EXAMPLES } from '../../utils/schema-description-consts';
import {
    DataguardDetailsResponse,
    OracleDeploymentTenacyType,
    OracleDeploymentType
} from '../../operations/workloads/oracle/common-types';
import { ORACLE_ADMIN_SCRIPT_IDS } from '../../operations/workloads/oracle/oracle-admin-scripts';
import { PGSQL_ADMIN_SCRIPT_IDS } from '../../operations/workloads/pgsql/pgsql-admin-scripts';

const allowedFields = Object.values(DatabaseHostsQueryFields);
const DatabaseHostObjectParams = Type.Object({
    accountId: Type.String({ description: API_DESCRIPTION.ACCOUNT_ID_DESC, minLength: 1 })
});
type DatabaseHostObjectParamsType = Static<typeof DatabaseHostObjectParams>;

const DatabaseHostSummaryParams = Type.Intersect([
    CredentialsIdParams,
    Type.Object({ databaseHostId: Type.String({ minLength: 1, description: API_DESCRIPTION.DATABASE_HOST_ID_DESC }) })
]);

const DatabaseHostInstanceSummaryParams = Type.Intersect([
    DatabaseHostSummaryParams,
    Type.Object({
        databaseInstanceId: Type.String({ minLength: 1, description: API_DESCRIPTION.DATABASE_INSTANCE_ID_DESC })
    })
]);

const DatabaseHostOptionalInstanceSummaryParams = Type.Intersect([
    DatabaseHostSummaryParams,
    Type.Optional(
        Type.Object({ databaseInstanceId: Type.String({ description: API_DESCRIPTION.DATABASE_INSTANCE_ID_DESC }) })
    )
]);

type DatabaseHostSummaryParamsType = Static<typeof DatabaseHostSummaryParams>;

const CreateDatabaseParams = Type.Object({
    accountId: Type.String({ description: API_DESCRIPTION.ACCOUNT_ID_DESC, minLength: 7 }),
    databaseHostId: Type.String({ minLength: 10, description: API_DESCRIPTION.DATABASE_HOST_ID_DESC }),
    credentialsId: Type.String({
        description: API_DESCRIPTION.CREDENTIALS_ID_DESC,
        format: 'uuid',
        examples: API_DESCRIPTION_EXAMPLES.CREDENTIALS_ID_EX
    }),
    region: Type.String({ description: API_DESCRIPTION.AWS_REGION_DESC })
});

const CreateDatabaseParamsV2 = Type.Object({
    accountId: Type.String({ description: API_DESCRIPTION.ACCOUNT_ID_DESC, minLength: 7 }),
    credentialsId: Type.String({
        description: API_DESCRIPTION.CREDENTIALS_ID_DESC,
        minLength: 1,
        format: 'uuid',
        examples: API_DESCRIPTION_EXAMPLES.CREDENTIALS_ID_EX
    }),
    region: Type.String({ description: API_DESCRIPTION.AWS_REGION_DESC, minLength: 1 }),
    databaseHostId: Type.String({ description: API_DESCRIPTION.DATABASE_HOST_ID_DESC, minLength: 10 }),
    databaseInstanceName: Type.String({ description: API_DESCRIPTION.DATABASE_INSTANCE_NAME_DESC })
});

// Query parameter to fetch protection, performance, storage and cost details
const DatabaseHostQueryString = Type.Object({
    fields: Type.Optional(
        Type.String({
            description: `Comma separated list of fields to include in the response. Allowed fields: ${allowedFields.join(
                ', '
            )}`,
            pattern: `^(${allowedFields.join('|')})(,(${allowedFields.join('|')}))*$`
        })
    ),
    vpcId: Type.Optional(Type.String()),
    fsxId: Type.Optional(Type.String()),
    nextToken: Type.Optional(Type.String()),
    pageSize: Type.Optional(Type.Number())
});

const GetDriveQueryString = Type.Object({
    forSandbox: Type.Optional(Type.Boolean())
});

const EC2InstanceDetailsResponse = Type.Object({
    id: Type.String(),
    name: Type.Optional(Type.String()),
    nodeStatus: Type.Optional(
        Type.String({
            enum: [
                InstanceStateName.running,
                InstanceStateName.stopped,
                InstanceStateName.pending,
                InstanceStateName.shutting_down,
                InstanceStateName.stopping,
                InstanceStateName.terminated,
                NOT_AVAILABLE
            ]
        })
    ),
    ebsVolumeId: Type.String(),
    instanceType: Type.Optional(Type.String()),
    availabilityZone: Type.Optional(Type.String()),
    subnetId: Type.Optional(Type.String()),
    status: Type.Optional(Type.String())
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
    isCRREnabled: Type.Optional(Type.Union([Type.Boolean({ default: false }), Type.String({ enum: ['N/A'] })])), // Marked as optional since CRR is not validated for PostgreSQL
    isAwsBackupEnabled: Type.Object({
        fsxn: Type.Union([Type.Boolean({ default: false }), Type.String({ enum: ['N/A'] })]),
        fsxw: Type.Boolean({ default: false }),
        ebs: Type.Boolean({ default: false })
    }),
    isFsxOntapSnapshotsEnabled: Type.Union([Type.Boolean({ default: false }), Type.String({ enum: ['N/A'] })]),
    isAppConsistentBackupEnabled: Type.Optional(
        Type.Union([Type.Boolean({ default: false }), Type.String({ enum: ['N/A'] })])
    ),
    protectedDatabases: Type.Optional(Type.Number({ description: 'Number of protected databases' }))
});
type ProtectionPerStorageTypeResponseType = Static<typeof ProtectionPerStorageTypeResponse>;

const TrendGraphResponse = Type.Array(
    Type.Optional(
        Type.Object({
            timestamp: Type.String({ description: 'Timestamp in ISO 8601 format' }),
            value: Type.Number({ description: 'Performance metric value at the given timestamp' }),
            unit: Type.String({ description: 'Unit of the performance metric, e.g., ms, IOPS, MB/s' })
        })
    )
);

const RWPerformanceResponse = Type.Object({
    read: Type.Optional(
        Type.Union([
            Type.Number({ description: 'Database server read performance for latency, IOPS or throughput' }),
            TrendGraphResponse
        ])
    ),
    write: Type.Optional(
        Type.Union([
            Type.Number({ description: 'Database server write performance for latency, IOPS or throughput' }),
            TrendGraphResponse
        ])
    )
    // The union type is added as same schema is used for mssql, pgsql and oracle but pgsql and oracle does not support trend graph now. Once they support trend graph, we can remove unused type
});

const LatencyResponse = Type.Intersect([
    RWPerformanceResponse,
    Type.Object({ serverIo: Type.Optional(Type.Number({ description: 'Database server IO performance for latency' })) })
]);

type RWPerformanceResponseType = Static<typeof RWPerformanceResponse>;

const DetailedPerformanceResponse = Type.Object({
    latency: LatencyResponse,
    iops: RWPerformanceResponse,
    throughput: RWPerformanceResponse,
    workloadType: Type.Optional(Type.String({ enum: ['Balanced', 'Read-heavy', 'Write-heavy', 'Unknown'] })), // used only for pgsql,
    cacheHitRatio: Type.Optional(Type.Number())
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
    physicalUsed: Type.Optional(Type.Number({ description: 'The physical space used, in bytes.' })),
    ssdUsed: Type.Optional(Type.Number({ description: 'The space used by performance tier, in bytes.' })),
    capacityPoolUsed: Type.Optional(Type.Number({ description: 'The capacity pool space used, in bytes.' })),
    snapshotUsed: Type.Optional(Type.Number({ description: 'The unique snapshot space used, in bytes.' })),
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
    protocol: Type.Optional(Type.Array(Type.String({ description: 'Data sharing protocol, iSCSI,SMB or both' })))
});
type StorageResponseType = Static<typeof StorageResponse>;

const StoragePerStorageTypeResponse = Type.Object({
    fsxn: Type.Optional(StorageResponse),
    fsxw: Type.Optional(StorageResponse),
    ebs: Type.Optional(StorageResponse)
});
type StoragePerStorageTypeResponseType = Static<typeof StoragePerStorageTypeResponse>;

const FsxResourceInfoResponse = Type.Optional(
    Type.Array(
        Type.Object({
            id: Type.String(),
            capacityCost: Type.Optional(Type.Number()),
            operationalCost: Type.Optional(Type.Number()),
            size: Type.Optional(Type.Number()),
            cost: Type.Optional(Type.Number())
        })
    )
);

const UsageCostPerStorageTypeResponse = Type.Optional(
    Type.Object({
        compute: Type.Number({ description: 'Compute cost in dollars' }),
        storage: Type.Object({
            fsxn: Type.Optional(Type.Number({ description: 'FSX for NetApp ONTAP Storage  cost in dollars' })),
            fsxw: Type.Optional(Type.Number({ description: 'FSX for Windows Storage cost in dollars' })),
            ebs: Type.Optional(Type.Number({ description: 'EBS Storage cost in dollars' })),
            fsxnBreakDownById: Type.Optional(FsxResourceInfoResponse)
        }),
        connectivity: Type.Number({ description: 'Connectivity cost in dollars' }),
        others: Type.Number({
            description: 'Other services like active directory, cloudwatch logging, etc costs in dollars'
        }),
        estimationType: Type.String({ enum: [BILLING, PRICING] })
    })
);
type UsageCostResponseType = Static<typeof UsageCostPerStorageTypeResponse>;

const DatabaseServerMetadataResponse = Type.Object({
    operatingSystem: Type.String({ minLength: 1 }),
    serverEdition: Type.String({ minLength: 1 }),
    serverVersion: Type.String({ minLength: 1 }),
    clusterName: Type.Optional(Type.String({ minLength: 1 })),
    activeNode: Type.String(),
    nodeNames: Type.Array(Type.String()),
    activeConnections: Type.Number(),
    creationDate: Type.String({ minLength: 1 }),
    collation: Type.Optional(Type.String({ minLength: 1 }))
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
    cpu: Type.Union([Type.Optional(TrendGraphResponse), Type.Optional(UtilizationResponse)]), // The union type is added as same schme is used for mssql, pgsql and oracle but pgsql and oracle does not support trend graph now,. Once they support trend graph, we can remove unused type
    memory: Type.Optional(UtilizationResponse),
    disk: Type.Optional(UtilizationResponse)
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
const EbsResourceInfoResponse = Type.Optional(
    Type.Array(
        Type.Object({
            id: Type.String(),
            size: Type.Number(),
            cost: Type.Number(),
            throughput: Type.Optional(Type.Number()), // Optional for gp2 volumes
            iops: Type.Optional(Type.Number()), // Optional for st1
            volumeType: Type.String()
        })
    )
);
const DatabaseHostSummaryPerStorageTypeResponse = Type.Object({
    id: Type.String(),
    name: Type.String(),
    status: Type.String({ enum: [ServerState.DOWN, ServerState.UP, NOT_AVAILABLE] }),
    databaseCount: Type.Optional(Type.Number()),
    databaseServer: Type.Optional(DatabaseServerMetadataResponse),
    topology: Type.Optional(TopologyResponse),
    protection: Type.Optional(ProtectionPerStorageTypeResponse),
    performance: Type.Optional(PerformanceResponse),
    storage: Type.Optional(StoragePerStorageTypeResponse),
    ebsResourceInfo: Type.Optional(EbsResourceInfoResponse),
    estimatedUsageCost: Type.Optional(UsageCostPerStorageTypeResponse),
    resourceUtilization: Type.Optional(ResourcesUtilizationResponse),
    sqlServerDeploymentType: Type.Optional(Type.String()),
    clusterNodeDetails: Type.Optional(
        Type.Array(
            Type.Object({
                ec2InstanceId: Type.String(),
                ec2InstancePrivateIpAddress: Type.Optional(Type.String()),
                ec2InstanceType: Type.String(),
                ec2InstanceName: Type.Optional(Type.String())
            })
        )
    ),
    errors: Type.Optional(Type.Any())
});

const DatabaseHostSummaryPerStorageTypeListResponse = Type.Object({
    count: Type.Number(),
    items: Type.Array(DatabaseHostSummaryPerStorageTypeResponse),
    nextToken: Type.Optional(Type.String())
});

type DatabaseHostSummaryPerStorageTypeResponseType = Static<typeof DatabaseHostSummaryPerStorageTypeResponse>;
type DatabaseHostSummaryPerStorageTypeListResponseType = Static<typeof DatabaseHostSummaryPerStorageTypeListResponse>;

const DatabaseLunFile = Type.Object({
    name: Type.String({ description: 'ONTAP LUN path (e.g. /vol/<vol>/<lun>)' }),
    driveLetter: Type.String({ description: 'Windows volume mount point (e.g. E:\\)' })
});

const DatabaseLuns = Type.Object({
    dataFiles: Type.Array(DatabaseLunFile),
    logFiles: Type.Array(DatabaseLunFile)
});

const DatabasesResponse = Type.Object({
    name: Type.String({ minLength: 1 }),
    databaseInstanceName: Type.Optional(
        Type.String({ description: 'SQL Server instance name this database belongs to' })
    ),
    status: Type.String({ minLength: 1 }),
    type: Type.String({ minLength: 1 }),
    size: Type.Number(),
    protection: Type.Optional(ProtectionPerStorageTypeResponse),
    luns: Type.Optional(DatabaseLuns),
    collation: Type.Optional(Type.String({ minLength: 1 })),
    created: Type.Optional(Type.String({ minLength: 1 })), // Optional for Oracle databases
    service: Type.Optional(Type.String({ minLength: 1 })), // Optional for Oracle databases
    // AOAG fields - only present when database is part of an Availability Group
    availabilityGroup: Type.Optional(Type.String({ description: 'Availability Group name this database belongs to' })),
    replicaRole: Type.Optional(
        Type.String({ description: 'Replica role: PRIMARY or SECONDARY', enum: ['PRIMARY', 'SECONDARY'] })
    ),
    synchronizationState: Type.Optional(
        Type.String({ description: 'Synchronization state: SYNCHRONIZED, SYNCHRONIZING, NOT_SYNCHRONIZED, etc.' })
    ),
    isReadableSecondary: Type.Optional(
        Type.Boolean({ description: 'Whether this secondary replica allows read operations' })
    )
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
    fileName: Type.String({ minLength: 5, maxLength: 128 }),
    volumeSize: Type.Number({ minimum: 1 }),
    drive: Type.String({ maxLength: 1 }),
    isExisting: Type.Boolean(),
    isVirtualMount: Type.Boolean()
});

const CreateDatabseRequestBody = Type.Object({
    databaseName: Type.String({ minLength: 1, maxLength: 123, pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$' }),
    dataFileConfig: FileConfig,
    logFileConfig: FileConfig,
    collation: Type.String({ minLength: 1, maxLength: 128, pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$' }),
    databaseInstanceId: Type.Optional(Type.String())
});

type FileConfigType = Static<typeof FileConfig>;

const DriveInfoResponseBody = Type.Object({
    existingDriveInfo: Type.Array(
        Type.Object({
            driveLetter: Type.String(),
            availableSize: Type.Number(),
            isNetappDrive: Type.Boolean(),
            isClusteredWithSelectedInstance: Type.Optional(Type.Boolean())
        })
    ),
    defaultDataDrive: Type.Optional(Type.String()),
    defaultLogDrive: Type.Optional(Type.String()),
    availableDriveLetters: Type.Array(Type.String()),
    fsxStorageCapacity: Type.Optional(Type.Number())
});
type DriveInfoResponseBodyType = Static<typeof DriveInfoResponseBody>;

const DatabaseHostsParamsWithRegion = Type.Object({
    accountId: Type.String({ description: API_DESCRIPTION.ACCOUNT_ID_DESC, minLength: 1 }),
    credentialsId: Type.String({
        format: 'uuid',
        description: API_DESCRIPTION.CREDENTIALS_ID_DESC,
        examples: API_DESCRIPTION_EXAMPLES.CREDENTIALS_ID_EX
    }),
    region: Type.String({ description: API_DESCRIPTION.AWS_REGION_DESC, minLength: 1 })
});

const DatabaseHostSummaryParamsWithRegion = Type.Object({
    accountId: Type.String({ minLength: 1, description: API_DESCRIPTION.ACCOUNT_ID_DESC }),
    databaseHostId: Type.String({ minLength: 1, description: API_DESCRIPTION.DATABASE_HOST_ID_DESC }),
    credentialsId: Type.String({
        format: 'uuid',
        description: API_DESCRIPTION.CREDENTIALS_ID_DESC,
        examples: API_DESCRIPTION_EXAMPLES.CREDENTIALS_ID_EX
    }),
    region: Type.String({ description: API_DESCRIPTION.AWS_REGION_DESC, minLength: 1 })
});
type DatabaseHostSummaryParamsWithRegionType = Static<typeof DatabaseHostSummaryParamsWithRegion>;

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

const DatabaseMountPointRequestQueryParamV2 = Type.Object({
    databaseName: Type.String()
});

const DatabaseHostInstanceDetailsResponse = Type.Object({
    databaseInstanceId: Type.Optional(Type.String({ description: 'Id of SQL server instance.' })),
    instanceName: Type.String({ description: 'Name of SQL server instance.' }),
    isManaged: Type.Optional(
        Type.Boolean({ description: 'Boolean to indicate if SQL server instance is managed by WFDB.' })
    ),
    instanceState: Type.Optional(
        Type.String({ description: 'State of SQL server instance.', enum: [ServerState.UP, ServerState.DOWN] })
    ),
    isDefault: Type.Optional(
        Type.Boolean({ description: 'Boolean to indicate if SQL server instance is default or not.', default: true })
    )
});

const NodeTopologyResponse = Type.Object({
    awsAccount: Type.String({ description: 'Identifer for AWS account', minLength: 1 }),
    region: Type.String({ description: 'Region for EC2 instance' }),
    vpcId: Type.Optional(Type.String({ description: 'Identifier for EC2 instance' })),
    vpcName: Type.Optional(Type.String()),
    vpcCidr: Type.Optional(Type.String()),
    keyPairName: Type.Optional(Type.String()),
    ec2Details: Type.Optional(Type.Array(EC2InstanceDetailsResponse)),
    activeDirectoryDetails: Type.Optional(ActiveDirectoryDetailsResponse),
    fqdn: Type.Optional(Type.String({ description: 'FQDN of the active node' })),
    nodeIpAddress: Type.Optional(Type.String({ description: 'IP address of the active node' })),
    windowsClusterName: Type.Optional(Type.String({ description: 'Name of the Windows cluster', minLength: 1 }))
});
type NodeTopologyResponseType = Static<typeof NodeTopologyResponse>;

const VolumeLunDetailsResponse = Type.Object({
    id: Type.Optional(Type.String({ description: 'ONTAP volume identifier' })),
    name: Type.Optional(Type.String({ description: 'ONTAP volume name' })),
    luns: Type.Optional(
        Type.Array(
            Type.Object({
                id: Type.Optional(Type.String({ description: 'LUN identifier' })),
                name: Type.Optional(Type.String({ description: 'LUN name' }))
            })
        )
    )
});

// AOAG types for database-hosts API response
const AoagReplicaResponse = Type.Object({
    replica: Type.Optional(Type.String({ description: 'Replica server name' })),
    role: Type.Optional(Type.String({ description: 'Replica role: PRIMARY or SECONDARY' })),
    availabilityMode: Type.Optional(
        Type.String({ description: 'Availability mode: SYNCHRONOUS_COMMIT or ASYNCHRONOUS_COMMIT' })
    ),
    failoverMode: Type.Optional(Type.String({ description: 'Failover mode: AUTOMATIC or MANUAL' })),
    syncHealth: Type.Optional(Type.String({ description: 'Synchronization health: HEALTHY or NOT_HEALTHY' })),
    connectedState: Type.Optional(Type.String({ description: 'Connection state: CONNECTED or DISCONNECTED' })),
    isLocalReplica: Type.Optional(Type.Boolean({ description: 'Whether this is the local replica' })),
    secondaryConnections: Type.Optional(Type.String({ description: 'Secondary connections allowed: YES, NO, or ALL' })),
    primaryConnections: Type.Optional(Type.String({ description: 'Primary connections allowed: YES, NO, or ALL' })),
    readRoutingUrl: Type.Optional(Type.String({ description: 'Read routing URL for this replica' })),
    isReadReplica: Type.Optional(Type.Number({ description: '1 if read replica, 0 otherwise' })),
    isRoutableReadReplica: Type.Optional(Type.Number({ description: '1 if routable read replica, 0 otherwise' }))
});

const AoagGroupResponse = Type.Object({
    agName: Type.Optional(Type.String({ description: 'Availability Group name' })),
    primaryReplica: Type.Optional(Type.String({ description: 'Primary replica server name' })),
    readRoutingTargets: Type.Optional(Type.String({ description: 'Read routing targets configuration' })),
    replicas: Type.Optional(Type.Array(AoagReplicaResponse))
});

const AoagDetailsResponse = Type.Object({
    serverInfo: Type.Optional(
        Type.Object({
            serverName: Type.Optional(Type.String({ description: 'SQL Server name' })),
            isHadrEnabled: Type.Optional(Type.Number({ description: '1 if HADR is enabled, 0 otherwise' }))
        })
    ),
    availabilityGroups: Type.Optional(Type.Array(AoagGroupResponse)),
    // Base deployment type indicates whether underlying AOAG nodes are Standalone or FCI
    baseDeploymentType: Type.Optional(
        Type.String({
            description: 'Underlying deployment type when AOAG: Standalone or FCI',
            enum: ['Standalone', 'FCI']
        })
    )
});

const AoagClusterNodeDetailsResponse = Type.Array(
    Type.Object({
        node: Type.Optional(Type.String({ description: 'Windows cluster node name' })),
        ip: Type.Optional(Type.String({ description: 'Windows cluster node IP address' })),
        ec2InstanceId: Type.Optional(Type.String({ description: 'Mapped EC2 instance ID for this node' })),
        ec2InstanceName: Type.Optional(Type.String({ description: 'Mapped EC2 instance Name for this node' })),
        databaseHostId: Type.Optional(
            Type.String({ description: 'WLM-DB resource ID (databaseHostId) for this replica node' })
        ),
        databaseInstanceId: Type.Optional(
            Type.String({ description: 'WLM-DB database instance ID for the AOAG instance on this replica node' })
        )
    })
);

const DatabaseInstanceTopology = Type.Object({
    serverType: Type.String({ enum: ['Microsoft SQL Server', 'ORACLE'] }),
    serverInstallationMode: Type.Union([
        Type.String({ enum: ['Standalone', 'FCI', 'HA', 'ha', 'AOAG'] }),
        OracleDeploymentType
    ]),
    fileSystemType: Type.String({ enum: ['EBS', 'FSx for ONTAP', 'FSx for Windows', NOT_AVAILABLE] }),
    fileSystemId: Type.Optional(Type.String()),
    fileSystemName: Type.Optional(Type.String()),
    fileSystemDeploymentMode: Type.Optional(Type.String()),
    fileSystemStatus: Type.Optional(
        Type.String({ enum: ['CREATING', 'AVAILABLE', 'UPDATING', 'DELETING', 'DELETED', 'FAILED'] })
    ),
    fileSystemStorageCapacity: Type.Optional(Type.Number()),
    fileSystemThroughputCapacity: Type.Optional(Type.Number()),
    availabilityZones: Type.Optional(Type.Array(Type.String())),
    fileSystemStorageType: Type.Optional(Type.String({ enum: ['SSD', 'HDD'] })),
    storageSummary: Type.Optional(
        Type.Object({
            volumes: Type.Optional(Type.Array(VolumeLunDetailsResponse)),
            totalVolumes: Type.Optional(Type.Number()),
            totalLuns: Type.Optional(Type.Number())
        })
    ),
    ...FsxLinkReadinessResponse.properties
});

type DatabaseInstanceTopologyType = Static<typeof DatabaseInstanceTopology>;

const DatabaseHostInstanceSummaryResponse = Type.Object({
    tenancy: Type.Optional(OracleDeploymentTenacyType), // Oracle specific
    isInstanceStorageAsmManaged: Type.Optional(Type.Boolean()), // Oracle specific
    platform: Type.Optional(Type.String()), // Oracle specific
    isDataGuardDeployed: Type.Optional(Type.Boolean()), // Oracle dataGuard specific
    dataguardDetails: Type.Optional(DataguardDetailsResponse), // Oracle dataGuard specific
    databaseInstanceId: Type.String(),
    databaseInstanceName: Type.String(),
    status: Type.String({ enum: [ServerState.UP, ServerState.DOWN, NOT_AVAILABLE] }),
    databaseCount: Type.Optional(Type.Number()),
    databaseServer: Type.Optional(DatabaseServerMetadataResponse),
    nodeTopology: Type.Optional(NodeTopologyResponse),
    databaseInstanceTopology: Type.Optional(DatabaseInstanceTopology),
    protection: Type.Optional(ProtectionPerStorageTypeResponse),
    performance: Type.Optional(PerformanceResponse),
    storage: Type.Optional(StoragePerStorageTypeResponse),
    resourceUtilization: Type.Optional(ResourcesUtilizationResponse),
    sqlServerDeploymentType: Type.Optional(Type.Union([Type.String(), OracleDeploymentType])),
    databases: Type.Optional(Type.Array(DatabasesResponse)),
    // AOAG instance-level details - only present for MSSQL AOAG deployments when fields includes 'aoag'
    aoagDetails: Type.Optional(AoagDetailsResponse),
    aoagClusterNodeDetails: Type.Optional(AoagClusterNodeDetailsResponse),
    errors: Type.Optional(Type.Any())
});
type DatabaseHostInstanceSummaryResponseType = Static<typeof DatabaseHostInstanceSummaryResponse>;

const DatabaseHostSummaryForMultiInstanceResponse = Type.Object({
    id: Type.String({ description: 'Identifier for the database resource' }),
    name: Type.String({ description: 'Name for the database resource' }),
    databaseHostStatus: Type.String({
        description: 'Status of database host hosting the database server.',
        enum: [ONLINE, OFFLINE, UNKNOWN]
    }),
    ssmStatus: Type.String({
        description: 'SSM connectivity status to the active EC2 instance hosting the database server.',
        enum: [ConnectionStatus.CONNECTED, ConnectionStatus.NOT_CONNECTED, NOT_AVAILABLE]
    }),
    storageAllocation: Type.Optional(
        Type.Object({
            fsxn: Type.Optional(Type.Number({ description: 'Aggregate FSxN size in bytes' })),
            fsxw: Type.Optional(Type.Number({ description: 'Aggregate FSxW size in bytes' })),
            ebs: Type.Optional(Type.Number({ description: 'Aggregate EBS size in bytes' }))
        })
    ),
    platform: Type.Optional(Type.String()), // Oracle specific
    databaseInstanceDetails: Type.Optional(Type.Array(DatabaseHostInstanceDetailsResponse)),
    nodeTopology: Type.Optional(NodeTopologyResponse),
    ebsResourceInfo: Type.Optional(EbsResourceInfoResponse),
    fsxnResourceInfo: Type.Optional(FsxResourceInfoResponse),
    fsxwResourceInfo: Type.Optional(FsxResourceInfoResponse),
    estimatedUsageCost: Type.Optional(UsageCostPerStorageTypeResponse),
    databaseInstancesSummary: Type.Optional(Type.Array(DatabaseHostInstanceSummaryResponse)),
    clusterNodeDetails: Type.Optional(
        Type.Array(
            Type.Object({
                ec2InstanceId: Type.String(),
                ec2InstancePrivateIpAddress: Type.Optional(Type.String()),
                ec2InstanceType: Type.String(),
                ec2InstanceName: Type.Optional(Type.String())
            })
        )
    ),
    errors: Type.Optional(Type.String()),
    sqlLicenseIncluded: Type.Optional(Type.Boolean())
});

const PgSqlDbHostsSummaryResponse = Type.Omit(DatabaseHostSummaryForMultiInstanceResponse, [
    'ebsResourceInfo',
    'sqlLicenseIncluded'
]);

const PgSqlDbHostSummaryListResponse = Type.Object({
    count: Type.Number(),
    items: Type.Array(PgSqlDbHostsSummaryResponse),
    nextToken: Type.Optional(Type.String())
});

const OracleDbHostsSummaryResponse = Type.Omit(DatabaseHostSummaryForMultiInstanceResponse, [
    'sqlLicenseIncluded',
    'fsxwResourceInfo'
]);

const OracleDbHostSummaryListResponse = Type.Object({
    count: Type.Number(),
    items: Type.Array(OracleDbHostsSummaryResponse),
    nextToken: Type.Optional(Type.String())
});
const DatabaseHostSummaryForMultiInstanceListResponse = Type.Object({
    count: Type.Number(),
    items: Type.Array(DatabaseHostSummaryForMultiInstanceResponse),
    nextToken: Type.Optional(Type.String())
});

type DatabaseHostSummaryForMultiInstanceResponseType = Static<typeof DatabaseHostSummaryForMultiInstanceResponse>;
type DatabaseHostSummaryForMultiInstanceListResponseType = Static<
    typeof DatabaseHostSummaryForMultiInstanceListResponse
>;

const RunPgSqlScriptBody = Type.Object({
    ec2InstanceId: Type.Optional(
        Type.String({
            minLength: 1,
            description: API_DESCRIPTION.EC2_INSTANCE_ID_DESC,
            pattern: '^i-[0-9a-f]{8,17}$'
        })
    ),
    databaseHostId: Type.Optional(Type.String({ minLength: 1, description: API_DESCRIPTION.DATABASE_HOST_ID_DESC })),
    databaseInstanceId: Type.Optional(
        Type.String({ minLength: 1, description: API_DESCRIPTION.DATABASE_INSTANCE_ID_DESC })
    ),
    scriptId: Type.String({
        enum: [...PGSQL_ADMIN_SCRIPT_IDS],
        description: 'Allowlisted PostgreSQL admin script to run via SSM on the host'
    }),
    args: Type.Optional(Type.Record(Type.String(), Type.String())),
    comment: Type.Optional(Type.String({ maxLength: 100, description: 'SSM command comment' }))
});
type RunPgSqlScriptBodyType = Static<typeof RunPgSqlScriptBody>;

const RunPgSqlScriptResponse = Type.Object({
    output: Type.String()
});
type RunPgSqlScriptResponseType = Static<typeof RunPgSqlScriptResponse>;

const RunOracleScriptBody = Type.Object({
    ec2InstanceId: Type.Optional(
        Type.String({
            minLength: 1,
            description: API_DESCRIPTION.EC2_INSTANCE_ID_DESC,
            pattern: '^i-[0-9a-f]{8,17}$'
        })
    ),
    databaseHostId: Type.Optional(Type.String({ minLength: 1, description: API_DESCRIPTION.DATABASE_HOST_ID_DESC })),
    databaseInstanceId: Type.Optional(
        Type.String({ minLength: 1, description: API_DESCRIPTION.DATABASE_INSTANCE_ID_DESC })
    ),
    scriptId: Type.String({
        enum: [...ORACLE_ADMIN_SCRIPT_IDS],
        description: 'Allowlisted Oracle admin script to run via SSM on the host'
    }),
    args: Type.Optional(Type.Record(Type.String(), Type.String())),
    comment: Type.Optional(Type.String({ maxLength: 100, description: 'SSM command comment' }))
});
type RunOracleScriptBodyType = Static<typeof RunOracleScriptBody>;

const RunOracleScriptResponse = Type.Object({
    output: Type.String()
});
type RunOracleScriptResponseType = Static<typeof RunOracleScriptResponse>;

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
    CreateDatabaseParams,
    CreateDatabaseParamsV2,
    DriveInfoResponseBody,
    DriveInfoResponseBodyType,
    FileConfigType,
    DatabaseHostsParamsWithRegion,
    DatabaseHostSummaryParamsWithRegion,
    DatabaseHostSummaryParamsWithRegionType,
    CollationInfoResponseBodyType,
    CollationInfoResponseBody,
    DatabaseMountPointRequestQueryParamV2,
    GetDriveQueryString,
    DatabaseHostSummaryForMultiInstanceResponse,
    DatabaseHostSummaryForMultiInstanceListResponse,
    DatabaseHostSummaryForMultiInstanceResponseType,
    DatabaseHostSummaryForMultiInstanceListResponseType,
    DatabaseHostInstanceSummaryResponse,
    DatabaseHostInstanceSummaryResponseType,
    DatabaseInstanceTopologyType,
    DatabaseHostInstanceSummaryParams,
    DatabaseHostOptionalInstanceSummaryParams,
    PgSqlDbHostsSummaryResponse,
    PgSqlDbHostSummaryListResponse,
    OracleDbHostSummaryListResponse,
    OracleDbHostsSummaryResponse,
    NodeTopologyResponseType,
    NodeTopologyResponse,
    RunPgSqlScriptBody,
    RunPgSqlScriptBodyType,
    RunPgSqlScriptResponse,
    RunPgSqlScriptResponseType,
    RunOracleScriptBody,
    RunOracleScriptBodyType,
    RunOracleScriptResponse,
    RunOracleScriptResponseType
};
