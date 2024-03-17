import { Static, Type } from '@fastify/type-provider-typebox';
import { RESOURCESTYPE } from '../../utils/consts';
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
    sqlServerEdition: Type.Number({ description: 'MS SQL Server edition' }),
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
    sqlServerName: Type.Optional(
        Type.String({
            description: 'Name of SQL Server. For a clustered instance, this is the name of the virtual server.'
        })
    ),
    sqlServerNodes: Type.Optional(
        Type.Array(
            Type.String({
                description:
                    'Name of SQL Server nodes. FCI clusters will have a pair of nodes and standalone will have only one node.'
            })
        )
    ),
    windowsAuthentication: Type.Boolean({
        description: 'Is Windows authentication used for SQL Server?'
    }),
    sqlAuthentication: Type.Optional(
        Type.Boolean({
            description: 'Is SQL Server authentication possible for SQL Server?',
            default: false
        })
    ),
    storage: Type.Optional(
        Type.Array(
            Type.Object({
                type: Type.String({ description: 'Underlying storage types of the SQL Server instance' }),
                id: Type.String()
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

type DiscoverCredentialsType = Static<typeof DiscoverCredentials>;

const DiscoverInstanceParams = Type.Composite([
    CredentialsIdParams,
    Type.Object({
        instanceId: Type.String()
    })
]);

export {
    DiscoverMsSqlQuery,
    DiscoverMsSqlResponseBody,
    SqlServerInstanceInfoType,
    DiscoverResponseInfoType,
    DiscoverCredentialsRequestBody,
    DiscoverInstanceParams,
    DiscoverCredentialsType
};
