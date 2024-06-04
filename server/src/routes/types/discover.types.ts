import { Static, Type } from '@fastify/type-provider-typebox';
import { RESOURCESTYPE, SqlServerDeploymentModel } from '../../utils/consts';
import { CredentialsIdParams } from './generic.types';

const DiscoverMsSqlQuery = Type.Object({
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
    sqlServerAuthentication: Type.Optional(
        Type.Boolean({
            description: 'Is SQL Server authentication possible for SQL Server instnace?',
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
                protocol: Type.Optional(Type.String({ description: 'Data sharing protocol, iSCSI or SMB' }))
            })
        )
    ),
    deploymentTypes: Type.Optional(
        Type.Array(
            Type.Object({
                type: Type.Optional(Type.String({ description: 'Deployment type of FSx for NetApp' })),
                zones: Type.Optional(
                    Type.Array(Type.Optional(Type.String({ description: 'Availability zones of FSx for NetApp' })))
                )
            })
        )
    )
});

const DiscoverResponseInfo = Type.Object({
    ec2InstanceId: Type.String({ description: 'AWS EC2 instance ID' }),
    ec2InstanceType: Type.String({ description: 'EC2 instance type' }),
    ec2InstanceName: Type.Optional(Type.String({ description: 'EC2 tag with key "Name".' })),
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

const ManageMsSqlResponseBody = Type.Object({
    resourceId: Type.String({ description: 'ID of the managed resource' })
});

const PrepareResourceResponseBody = {
    jobId: Type.String({ description: 'Resource preparation job ID' })
};

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
    credentials: Type.Array(DiscoverCredentials)
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

const MsSqlInstancesRequestQuery = Type.Object({
    instances: Type.String({
        description: 'Comma separated Ec2 instance ID associated with the MS SQL Server instance.'
    })
});

export {
    DiscoverMsSqlQuery,
    DiscoverMsSqlResponseBody,
    ManageMsSqlResponseBody,
    DiscoverMsSqlResponseBodyType,
    SqlServerInstanceInfoType,
    DiscoverResponseInfoType,
    DiscoverCredentialsRequestBody,
    DiscoverInstanceParams,
    DiscoverCredentialsType,
    MsSqlInstancesRequestQuery,
    DiscoverCredentialsResponse,
    PrepareResourceResponseBody
};
