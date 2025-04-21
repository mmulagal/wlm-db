import { Static, Type } from '@fastify/type-provider-typebox';
import { PGSQL_DEFAULT_INSTANCE_NAME, RESOURCESTYPE, SqlServerDeploymentModel } from '../../utils/consts';
import { CredentialsIdParams, AccountIdCredentialsIdParams } from './generic.types';

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
    missingSqlPermissions: Type.Optional(Type.Array(Type.String({ description: 'Missing SQL permissions' })))
});

const DiscoverResponseInfo = Type.Object({
    ec2InstanceId: Type.String({ description: 'AWS EC2 instance ID' }),
    ec2InstanceType: Type.String({ description: 'EC2 instance type' }),
    ec2InstanceName: Type.Optional(Type.String({ description: 'EC2 tag with key "Name".' })),
    ec2UsageOperation: Type.Optional(Type.String({ description: 'EC2 usage operation details' })),
    ssmState: Type.String({ description: 'SSM connection status', enum: ['connected', 'notconnected'] }),
    vpc: Type.Optional(
        Type.Object({
            id: Type.Optional(Type.String({ description: 'VPC ID' })),
            name: Type.Optional(Type.String({ description: 'VPC tag with key "Name".' })),
            cidrBlock: Type.Optional(Type.String({ description: 'VPC CIDR block' }))
        })
    ),
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

const MultiInstanceUnmanageResponseBody = Type.Object({
    resourceId: Type.String({ description: 'Workload Factory resource ID.' }),
    items: Type.Array(
        Type.Object({
            databaseInstanceId: Type.String({ description: 'SQL Server database instance ID.' }),
            status: Type.String({ description: 'Status of database instance unmanage operation.' }),
            errorMessage: Type.Optional(Type.String({ description: 'Error details, if any, of a failed unmanage.' }))
        })
    )
});

const BulkManageMsSqlRequestBody = Type.Object({
    credentialsId: Type.String({ description: 'Credentials ID' }),
    region: Type.String({ description: 'AWS region' }),
    ec2InstanceId: Type.String({ description: 'EC2 instance Id' }),
    databaseInstanceNames: Type.Array(Type.String({ description: 'List of MS SQL database instances' })),
    databaseHostId: Type.Optional(Type.String({ description: 'Database host ID' }))
});
const MultiInstanceManageMsSqlRequestBody = Type.Object({
    items: Type.Array(BulkManageMsSqlRequestBody)
});

type MultiInstanceManageMsSqlRequestBodyType = Static<typeof BulkManageMsSqlRequestBody>;
const MultiInstanceManageResponseBody = Type.Array(
    Type.Object({
        resourceId: Type.Optional(Type.String({ description: 'Workload Factory resource ID.' })),
        ec2InstanceId: Type.String({ description: 'AWS EC2 instance ID' }),
        region: Type.String({ description: 'AWS region' }),
        credentialsId: Type.String({ description: 'Credentials ID' }),
        hostErrorMessage: Type.Optional(
            Type.String({ description: 'Error details, if any, of a failed host management.' })
        ),
        instances: Type.Array(
            Type.Object({
                databaseInstanceName: Type.String({ description: 'SQL Server database instance name.' }),
                databaseInstanceGuid: Type.Optional(Type.String({ description: 'SQL Server database instance GUID.' })),
                status: Type.Optional(Type.String({ description: 'Status of database instance unmanage operation.' })),
                errorMessage: Type.Optional(
                    Type.String({ description: 'Error details, if any, of a failed database instance management.' })
                )
            })
        )
    })
);

const MultiHostManageResponseBody = Type.Object({ hosts: MultiInstanceManageResponseBody });

type MultiInstanceManageResponseBodyType = Static<typeof MultiInstanceManageResponseBody>;

const PrepareResourceResponseBody = Type.Object({
    jobId: Type.String({ description: 'Resource preparation job ID' })
});

type DiscoverMsSqlResponseBodyType = Static<typeof DiscoverMsSqlResponseBody>;
type SqlServerInstanceInfoType = Static<typeof SqlServerInstanceInfo>;
type DiscoverResponseInfoType = Static<typeof DiscoverResponseInfo>;

const DiscoverCredentials = Type.Object({
    resourceId: Type.String({ minLength: 1, description: 'SQL server instance id or FSxN file-system id' }),
    resourceType: Type.String({ enum: [RESOURCESTYPE.FSX, RESOURCESTYPE.MSSQL] }),
    username: Type.String({ minLength: 1 }),
    password: Type.String({ minLength: 1 })
});

const DiscoverCredentialsRequestBody = Type.Object({
    credentials: Type.Array(DiscoverCredentials),
    clusterNodesIpAddress: Type.Optional(
        Type.Array(Type.String({ description: 'Private ips of nodes in a clustered deployment' }))
    )
});

const DiscoverCredentialsResponse = Type.Object({
    databaseCount: Type.Optional(Type.String()),
    sqlServerEdition: Type.Optional(Type.String()),
    sqlServerError: Type.Optional(Type.String()),
    fsxnError: Type.Optional(Type.String())
});

type DiscoverCredentialsType = Static<typeof DiscoverCredentials>;

const DiscoverInstanceParams = Type.Composite([
    CredentialsIdParams,
    Type.Object({
        instanceId: Type.String({ description: 'AWS EC2 instance ID' })
    })
]);

const UnmanageInstanceParams = Type.Composite([
    AccountIdCredentialsIdParams,
    Type.Object({
        resourceId: Type.String({ description: 'Workload Factory resource ID.', minLength: 1 })
    })
]);

const DatabaseInstanceQueryString = Type.Object({
    databaseInstanceIds: Type.Optional(
        Type.String({ description: 'Comma separated list of MS SQL Server instance IDs.' })
    )
});

const SqlInstancesRequestQuery = Type.Object({
    instances: Type.String({
        description: 'Comma separated Ec2 instance ID associated with the MS SQL Server instance.'
    }),
    fields: Type.Optional(Type.String())
});

const pgSqlServerNode = Type.Object({
    ec2InstanceName: Type.Optional(Type.String({ description: 'Primary node name' })),
    ec2InstanceId: Type.String({ description: 'Primary node ID' }),
    ec2InstancePrivateIpAddress: Type.String({ description: 'Primary node IP address' }),
    ec2InstanceType: Type.String({ description: 'Primary node type' }),
    ec2UsageOperation: Type.Optional(Type.String({ description: 'EC2 usage operation details' }))
});

const DiscoverPgSqlResponseInfo = Type.Intersect([
    Type.Omit(DiscoverResponseInfo, ['sqlServerInstances']),
    Type.Object({
        pgsqlServerInstance: Type.Optional(
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

const oracleDatabaseInstance = Type.Object({
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
        databaseName: Type.String({ description: 'Oracle database name' }),
        databaseId: Type.String({ description: 'Oracle database ID' }),
        openMode: Type.String({
            description: 'database open mode',
            enum: ['READ WRITE', 'READ', 'MOUNTED']
        })
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
    )
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
        databaseInstanceDetails: Type.Optional(Type.Array(oracleDatabaseInstance)),
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
type pgsqlNodeDetailsType = Static<typeof pgSqlServerNode>;
type DiscoverOracleInstanceType = Static<typeof oracleDatabaseInstance>;
type DiscoverOracleResponseBodyType = Static<typeof DiscoverOracleResponseBody>;
type DiscoverOracleResponseType = Static<typeof DiscoverOracleResponseInfo>;

export {
    DiscoverQuery,
    DiscoverMsSqlResponseBody,
    DiscoverMsSqlResponseBodyType,
    SqlServerInstanceInfoType,
    DiscoverResponseInfoType,
    DiscoverCredentialsRequestBody,
    DiscoverInstanceParams,
    DiscoverCredentialsType,
    SqlInstancesRequestQuery,
    DiscoverCredentialsResponse,
    PrepareResourceResponseBody,
    UnmanageInstanceParams,
    MultiInstanceUnmanageResponseBody,
    MultiInstanceManageResponseBody,
    DatabaseInstanceQueryString,
    MultiInstanceManageMsSqlRequestBody,
    MultiInstanceManageMsSqlRequestBodyType,
    MultiInstanceManageResponseBodyType,
    DiscoverPgSqlResponseBody,
    DiscoverPgSqlResponseBodyType,
    DiscoverPgSqlResponseType,
    pgsqlNodeDetailsType,
    MultiHostManageResponseBody,
    DiscoverOracleResponseBody,
    DiscoverOracleInstanceType,
    DiscoverOracleResponseBodyType,
    DiscoverOracleResponseType
};
