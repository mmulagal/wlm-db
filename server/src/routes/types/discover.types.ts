import { Static, Type } from '@fastify/type-provider-typebox';
import { DatabaseHostsQueryFields, PGSQL_DEFAULT_INSTANCE_NAME, SqlServerDeploymentModel } from '../../utils/consts';
import { CredentialsIdParams } from './generic.types';

const allowedFields = Object.values(DatabaseHostsQueryFields);

const DiscoverQuery = Type.Object({
    pageSize: Type.Number({
        description: 'Number of EC2 instances to discover per call of the API.',
        minimum: 5,
        default: 50
    }),
    nextToken: Type.Optional(
        Type.String({
            description:
                'The token returned from a previous paginated request. Pagination continues from the next items returned by the previous request.'
        })
    )
});

const ManageReadinessObject = Type.Object({
    missingSqlPermissions: Type.Array(Type.String({ description: 'Missing SQL permissions' })),
    missingModules: Type.Array(Type.String({ description: 'Missing powershell modules' }))
});

// AOAG types
const AoagReplica = Type.Object({
    replica: Type.Optional(Type.String()),
    role: Type.Optional(Type.String()),
    availabilityMode: Type.Optional(Type.String()),
    failoverMode: Type.Optional(Type.String()),
    syncHealth: Type.Optional(Type.String()),
    connectedState: Type.Optional(Type.String()),
    isLocalReplica: Type.Optional(Type.Boolean()),
    secondaryConnections: Type.Optional(Type.String()),
    primaryConnections: Type.Optional(Type.String()),
    readRoutingUrl: Type.Optional(Type.String()),
    isReadReplica: Type.Optional(Type.Number()),
    isRoutableReadReplica: Type.Optional(Type.Number())
});

const AoagGroup = Type.Object({
    agName: Type.Optional(Type.String()),
    primaryReplica: Type.Optional(Type.String()),
    readRoutingTargets: Type.Optional(Type.String()),
    replicas: Type.Optional(Type.Array(AoagReplica))
});

const AoagDetails = Type.Object({
    serverInfo: Type.Optional(
        Type.Object({
            serverName: Type.Optional(Type.String()),
            isHadrEnabled: Type.Optional(Type.Number())
        })
    ),
    availabilityGroups: Type.Optional(Type.Array(AoagGroup)),
    // Base deployment type indicates whether underlying AOAG nodes are Standalone or FCI
    baseDeploymentType: Type.Optional(
        Type.String({
            description: 'Underlying deployment type when AOAG: Standalone or FCI',
            enum: ['Standalone', 'FCI']
        })
    )
});

const SqlServerInstanceInfo = Type.Object({
    sqlServerEdition: Type.Optional(Type.String({ description: 'MS SQL Server edition' })),
    sqlServerEngineEdition: Type.Optional(
        Type.Number({ description: 'Database Engine edition of the instance of SQL Server installed on the server.' })
    ),
    sqlServerInstance: Type.String({ description: 'MS SQL Server instance name' }),
    sqlServerState: Type.String({
        // Reference: https://learn.microsoft.com/en-us/dotnet/api/system.serviceprocess.servicecontrollerstatus?view=dotnet-plat-ext-8.0
        description: `State of MS SQL Server instance.<br>
        <ul>
        <li>ContinuePending - The service continue is pending.
        <li>Paused - The service is paused.
        <li>PausePending - The service pause is pending.
        <li>Running - The service is running. 
        <li>StartPending - The service is starting.
        <li>Stopped - The service is not running.
        <li>StopPending - The service is stopping.
        </ul>
        `,
        enum: ['ContinuePending', 'Paused', 'PausePending', 'Running', 'StartPending', 'Stopped', 'StopPending']
    }),
    sqlServerVersion: Type.String({ description: 'MS SQL Server version' }),
    sqlServerProductYear: Type.Number({ description: 'Year of SQL Server' }),
    sqlServerName: Type.Optional(
        Type.String({
            description: 'Name of SQL Server. For a clustered instance, this is the name of the virtual server.'
        })
    ),
    serverGuid: Type.Optional(Type.String({ description: 'SQL Server service broker ID' })),
    isDefaultInstance: Type.Boolean({ description: 'Is this default SQL Server instance' }),
    failureInfo: Type.Optional(Type.String({ description: 'Instance specific failure details, if any.' })),
    sqlServerNodes: Type.Optional(
        Type.Array(
            Type.String({
                description:
                    'Name of SQL Server nodes. FCI clusters will have a pair of nodes and standalone will have only one node.'
            })
        )
    ),
    windowsClusterNodes: Type.Optional(
        Type.Array(
            Type.Object({
                Address: Type.Optional(
                    Type.String({
                        description: 'Windows Cluster node IP address.'
                    })
                ),
                Node: Type.Optional(
                    Type.String({
                        description: 'Windows cluster node name.'
                    })
                )
            })
        )
    ),

    windowsClusterName: Type.Optional(Type.String({ description: 'Name of Windows cluster.' })),
    nodeIps: Type.Optional(Type.Array(Type.String({ description: 'IP addresses of the SQL Server nodes, if any.' }))),
    sqlServerDeploymentType: Type.Optional(
        Type.String({
            description: 'SQL Server deployment architecture.',
            enum: [
                SqlServerDeploymentModel.SQL_STANDALONE_SHORT,
                SqlServerDeploymentModel.SQL_AOAG_SHORT,
                SqlServerDeploymentModel.SQL_FCI_SHORT
            ]
        })
    ),
    // Accept structured AOAG object (normal path) or string fallback if parsing failed
    aoagDetails: Type.Optional(
        Type.Union([AoagDetails, Type.String({ description: 'Fallback: raw AOAG JSON string if parsing failed' })])
    ),
    // Mapping of AOAG nodes to EC2 instance IDs for easy UI correlation
    aoagClusterNodeDetails: Type.Optional(
        Type.Array(
            Type.Object({
                node: Type.Optional(Type.String({ description: 'Windows cluster node name' })),
                ip: Type.Optional(Type.String({ description: 'Windows cluster node IP' })),
                ec2InstanceId: Type.Optional(Type.String({ description: 'Mapped EC2 instance ID for this node' })),
                ec2InstanceName: Type.Optional(Type.String({ description: 'Mapped EC2 instance Name for this node' }))
            })
        )
    ),
    databaseCount: Type.Optional(Type.Number({ description: 'Number of databases in the SQL Server instance.' })),
    windowsAuthentication: Type.Boolean({
        description: 'Is Windows authentication possible for SQL Server?'
    }),
    windowsOsVersion: Type.String({
        description: 'Windows operating system version installed on the database host instance.'
    }),
    sqlServerAuthentication: Type.Optional(
        Type.Boolean({
            description: 'Is SQL Server authentication possible for SQL Server instance?',
            default: false
        })
    ),
    windowsDomainUserAuthentication: Type.Boolean({
        description: 'Is Windows domain user authentication possible for SQL Server?'
    }),
    storage: Type.Optional(
        Type.Array(
            Type.Object({
                type: Type.String({ description: 'Underlying storage types of the SQL Server instance' }),
                id: Type.String({ description: 'ID of the storage' }),
                svmId: Type.Optional(
                    Type.String({ description: 'ID of Storage Virtual Machine, if underlying storage is FSx ONTAP' })
                ),
                protocol: Type.Optional(Type.String({ description: 'Data sharing protocol, iSCSI or SMB' })),
                fileSystemStorageType: Type.Optional(
                    Type.String({ description: 'File system storage type, SSD or HDD' })
                )
            })
        )
    ),
    deploymentTypes: Type.Optional(
        Type.Array(
            Type.Object({
                type: Type.Optional(Type.String({ description: 'Deployment type of FSxN, FSxW or EBS' })),
                zones: Type.Optional(
                    Type.Array(Type.Optional(Type.String({ description: 'Availability zones of FSxN, FSxW or EBS' })))
                ),
                storageType: Type.Optional(Type.String({ description: 'Storage type of database host' }))
            })
        )
    ),
    manageReadiness: Type.Optional(
        Type.Object({
            missingSqlCmd: Type.Boolean({
                description: 'Is SQLCMD missing on the database host instance?'
            }),
            assessment: ManageReadinessObject,
            remediation: ManageReadinessObject,
            dbcreation: ManageReadinessObject,
            sandbox: ManageReadinessObject
            // logsanalyzer: Type.Optional(ManageReadinessObject)
        })
    )
});

const DiscoverResponseInfo = Type.Object({
    ec2InstanceId: Type.String({ description: 'AWS EC2 instance ID' }),
    ec2InstanceType: Type.String({ description: 'EC2 instance type' }),
    ec2InstanceName: Type.Optional(Type.String({ description: 'EC2 tag with key "Name".' })),
    ec2HostName: Type.Optional(Type.String({ description: 'EC2 private DNS name' })),
    ec2UsageOperation: Type.Optional(Type.String({ description: 'EC2 usage operation details' })),
    ssmState: Type.String({ description: 'SSM connection status', enum: ['connected', 'notconnected'] }),
    vpc: Type.Optional(
        Type.Object({
            id: Type.Optional(Type.String({ description: 'VPC ID' })),
            name: Type.Optional(Type.String({ description: 'VPC tag with key "Name".' })),
            cidrBlock: Type.Optional(Type.String({ description: 'VPC CIDR block' }))
        })
    ),
    platform: Type.Optional(Type.String()),
    sqlServerInstances: Type.Optional(Type.Array(SqlServerInstanceInfo))
});

const DiscoverMsSqlResponseBody = Type.Object({
    count: Type.Number({ description: 'Number of discovered items' }),
    items: Type.Array(DiscoverResponseInfo),
    nextToken: Type.Optional(
        Type.String({
            description: 'Pagination token for each page.  A non-empty token indicates more more results are available.'
        })
    )
});

type DiscoverMsSqlResponseBodyType = Static<typeof DiscoverMsSqlResponseBody>;
type SqlServerInstanceInfoType = Static<typeof SqlServerInstanceInfo>;
type DiscoverResponseInfoType = Static<typeof DiscoverResponseInfo>;

const DiscoverInstanceParams = Type.Intersect([
    CredentialsIdParams,
    Type.Object({
        instanceId: Type.String({ description: 'AWS EC2 instance ID' })
    })
]);

const SqlInstancesRequestQuery = Type.Object({
    instances: Type.String({
        description: 'Comma separated Ec2 instance ID associated with the MS SQL Server instance.'
    }),
    fields: Type.Optional(
        Type.String({
            description: `Comma separated list of fields to include in the response. Allowed fields: ${allowedFields.join(
                ', '
            )}`,
            pattern: `^(${allowedFields.join('|')})(,(${allowedFields.join('|')}))*$`
        })
    )
});

const pgSqlServerNode = Type.Object({
    ec2InstanceName: Type.Optional(Type.String({ description: 'Primary node name' })),
    ec2InstanceId: Type.String({ description: 'Primary node ID' }),
    ec2InstancePrivateIpAddress: Type.String({ description: 'Primary node IP address' }),
    ec2InstanceType: Type.String({ description: 'Primary node type' }),
    ec2UsageOperation: Type.Optional(Type.String({ description: 'EC2 usage operation details' }))
});

const pgSqlServerInstance = Type.Object({
    pgsqlServerInstanceName: Type.Optional(
        Type.String({ description: 'PostgreSQL instance name', default: PGSQL_DEFAULT_INSTANCE_NAME })
    ),
    pgsqlServerState: Type.Optional(
        Type.String({
            description: 'PostgreSQL server state',
            enum: ['running', 'stopped']
        })
    ),
    pgsqlServerVersion: Type.Optional(Type.String({ description: 'PostgreSQL version' })),
    pgsqlServerName: Type.Optional(Type.String({ description: 'PostgreSQL server name' })),
    pgsqlServerDeploymentType: Type.Optional(
        Type.String({
            description: 'PostgreSQL deployment architecture.',
            enum: ['standalone', 'ha']
        })
    ),
    pgsqlServerInstanceId: Type.Optional(Type.String({ description: 'PostgreSQL instance ID' })),
    databaseCount: Type.Optional(Type.Number({ description: 'Number of databases in the PostgreSQL instance.' })),
    isPrimary: Type.Optional(Type.Boolean({ description: 'Is this primary PostgreSQL instance' })),
    nodes: Type.Optional(Type.Array(pgSqlServerNode)),
    primaryNode: Type.Optional(pgSqlServerNode),
    defaultAuth: Type.Optional(Type.Boolean()),
    storage: Type.Optional(
        Type.Array(
            Type.Object({
                type: Type.String({ description: 'Underlying storage types of the PostgreSQL instance' }),
                id: Type.String({ description: 'ID of the storage' }),
                svmId: Type.Optional(
                    Type.String({
                        description: 'ID of Storage Virtual Machine, if underlying storage is FSx ONTAP'
                    })
                ),
                protocol: Type.Optional(Type.String({ description: 'Data sharing protocol, iSCSI or SMB' })),
                fileSystemStorageType: Type.Optional(
                    Type.String({ description: 'File system storage type, SSD or HDD' })
                ),
                deploymentType: Type.Optional(Type.String({ description: 'Deployment type of storage' })),
                zones: Type.Optional(
                    Type.Array(Type.Optional(Type.String({ description: 'Availability zones of storage' })))
                ),
                nfsMountPoint: Type.Optional(Type.String({ description: 'Mount point of storage' }))
            })
        )
    ),
    error: Type.Optional(Type.String({ description: 'Error details, if any.' }))
});

const DiscoverPgSqlResponseInfo = Type.Intersect([
    Type.Omit(DiscoverResponseInfo, ['sqlServerInstances']),
    Type.Object({
        pgsqlServerInstances: Type.Optional(Type.Array(pgSqlServerInstance)),
        error: Type.Optional(Type.String({ description: 'Error details, if any.' }))
    })
]);

const DiscoverPgSqlResponseBody = Type.Object({
    count: Type.Number({ description: 'Number of discovered items' }),
    items: Type.Array(DiscoverPgSqlResponseInfo),
    nextToken: Type.Optional(
        Type.String({
            description: 'Pagination token for each page.  A non-empty token indicates more more results are available.'
        })
    )
});

const OracleDataguardDetails = Type.Object({
    dbUniqueName: Type.Optional(Type.String({ description: 'Database unique name' })),
    dbName: Type.Optional(Type.String({ description: 'Database name' })),
    associatedHosts: Type.Optional(
        Type.Array(
            Type.Object({
                serviceName: Type.Optional(Type.String({ description: 'Data Guard service name' })),
                hostIp: Type.Optional(Type.String({ description: 'Data Guard host IP address' })),
                ec2InstanceId: Type.Optional(Type.String({ description: 'Data Guard host EC2 instance ID' })),
                listenerPort: Type.Optional(Type.String({ description: 'Data Guard listen port' })),
                sidName: Type.Optional(Type.String({ description: 'Data Guard SID name' }))
            })
        )
    ),
    isPrimaryNode: Type.Optional(
        Type.Boolean({
            description: 'Is this primary Oracle instance'
        })
    )
});

const OracleDatabaseInstance = Type.Object({
    instanceName: Type.String({ description: 'Oracle instance name' }),
    instanceId: Type.String({ description: 'Oracle instance ID' }),
    instanceState: Type.String({
        description: 'Oracle instance state',
        enum: ['STARTED', 'MOUNTED', 'OPEN', 'OPEN MIGRATE']
    }),
    version: Type.String({ description: 'Oracle instance version' }),
    instanceType: Type.String({
        description: 'database type',
        enum: ['SINGLE_TENANT', 'MULTI_TENANT']
    }),
    databaseCount: Type.Number({ description: 'Number of databases in the Oracle instance.' }),
    databaseDetails: Type.Object({
        databaseName: Type.Optional(Type.String({ description: 'Oracle database name' })),
        databaseId: Type.Optional(Type.String({ description: 'Oracle database ID' })),
        openMode: Type.Optional(
            Type.String({
                description: 'database open mode',
                enum: ['READ WRITE', 'READ', 'MOUNTED']
            })
        ),
        error: Type.Optional(Type.String({ description: 'Error details, if any.' }))
    }),
    pluggableDatabases: Type.Optional(
        Type.Array(
            Type.Object({
                pdbName: Type.String({ description: 'Oracle pluggable database name' }),
                pdbId: Type.String({ description: 'Oracle pluggable database ID' }),
                pdbStatus: Type.String({
                    enum: [
                        'NEW',
                        'NORMAL',
                        'UNPLUGGED',
                        'RELOCATED',
                        'RELOCATING',
                        'REFRESHING',
                        'UNDEFINED',
                        'UNUSABLE'
                    ],
                    description: 'Oracle pluggable database status'
                })
            })
        )
    ),
    isInstanceStorageAsmManaged: Type.Optional(
        Type.Boolean({
            description: 'true if instance storage is managed through ASM'
        })
    ),
    oracleServerAuthentication: Type.Boolean({
        description: 'Is Oracle server authentication possible for Oracle instance?'
    }),
    isDefaultAuthentication: Type.Boolean({
        description: 'Is default / OS auth possible for Oracle instance?'
    }),
    asmAuthentication: Type.Optional(
        Type.Boolean({
            description: 'Is ASM auth possible for Oracle instance?'
        })
    ),
    storage: Type.Optional(
        Type.Array(
            Type.Object({
                type: Type.String({ description: 'Underlying storage types of the Oracle instance' }),
                id: Type.String({ description: 'ID of the storage' }),
                svmId: Type.Optional(
                    Type.String({
                        description: 'ID of Storage Virtual Machine, if underlying storage is FSx ONTAP'
                    })
                ),
                fileSystemStorageType: Type.Optional(
                    Type.String({ description: 'File system storage type, SSD or HDD' })
                ),
                fileSystemName: Type.Optional(Type.String({ description: 'File system name' })),
                deploymentType: Type.Optional(Type.String({ description: 'Deployment type of storage' })),
                zones: Type.Optional(
                    Type.Array(Type.Optional(Type.String({ description: 'Availability zones of storage' })))
                ),
                mountDetails: Type.Optional(
                    Type.Array(
                        Type.Object({
                            mountPoint: Type.String({ description: 'mount point info' }),
                            protocol: Type.String({
                                description: 'Data sharing protocol, NFS or iSCSI'
                            }),
                            mountIp: Type.String({ description: 'mount ip info' })
                        })
                    )
                )
            })
        )
    ),
    manageReadiness: Type.Optional(
        Type.Object({
            assessment: Type.Optional(ManageReadinessObject),
            remediation: Type.Optional(ManageReadinessObject)
        })
    ),
    isDataGuardDeployed: Type.Optional(
        Type.Boolean({
            description: 'Is Data Guard deployed for Oracle instance?'
        })
    ),
    dataguardDetails: Type.Optional(OracleDataguardDetails)
});

const DiscoverOracleResponseInfo = Type.Intersect([
    Type.Omit(DiscoverResponseInfo, ['sqlServerInstances']),
    Type.Object({
        oracleServerDeploymentType: Type.Optional(
            Type.String({
                description: 'Oracle deployment architecture.',
                enum: ['Standalone', 'HA']
            })
        ),
        databaseInstanceDetails: Type.Optional(Type.Array(OracleDatabaseInstance)),
        error: Type.Optional(Type.String({ description: 'Error details, if any.' }))
    })
]);

const DiscoverOracleResponseBody = Type.Object({
    count: Type.Number({ description: 'Number of discovered items' }),
    items: Type.Array(DiscoverOracleResponseInfo),
    nextToken: Type.Optional(
        Type.String({
            description: 'Pagination token for each page.  A non-empty token indicates more more results are available.'
        })
    )
});

type DiscoverPgSqlResponseBodyType = Static<typeof DiscoverPgSqlResponseBody>;
type DiscoverPgSqlResponseType = Static<typeof DiscoverPgSqlResponseInfo>;
type PgSqlServerInstaceType = Static<typeof pgSqlServerInstance>;
type pgsqlNodeDetailsType = Static<typeof pgSqlServerNode>;
type DiscoverOracleInstanceType = Static<typeof OracleDatabaseInstance>;
type DiscoverOracleResponseBodyType = Static<typeof DiscoverOracleResponseBody>;
type DiscoverOracleResponseType = Static<typeof DiscoverOracleResponseInfo>;
type OracleDataguardDetailsType = Static<typeof OracleDataguardDetails>;

export {
    DiscoverQuery,
    DiscoverMsSqlResponseBody,
    DiscoverMsSqlResponseBodyType,
    SqlServerInstanceInfoType,
    DiscoverResponseInfoType,
    DiscoverInstanceParams,
    SqlInstancesRequestQuery,
    DiscoverPgSqlResponseBody,
    DiscoverPgSqlResponseBodyType,
    DiscoverPgSqlResponseType,
    PgSqlServerInstaceType,
    pgsqlNodeDetailsType,
    DiscoverOracleResponseBody,
    DiscoverOracleInstanceType,
    DiscoverOracleResponseBodyType,
    DiscoverOracleResponseType,
    OracleDataguardDetailsType
};
