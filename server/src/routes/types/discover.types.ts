import { Static, Type } from '@fastify/type-provider-typebox';
import { ManagedHostParams } from './generic.types';

const DiscoverMsSqlQuery = Type.Object({
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
    windowsAuthentication: Type.Boolean({
        description: 'Is Windows Authentication used for SQL Server?'
    })
});

const DiscoverResponseInfo = Type.Object({
    ec2InstanceId: Type.String({ description: 'AWS EC2 instance ID' }),
    ec2InstanceName: Type.Optional(Type.String({ description: 'EC2 tag with key "Name".' })),
    ssmState: Type.String({ description: 'SSM connection status', enum: ['connected', 'notconnected'] }),
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

const DiscoverMsSqlSummarySuccessResponse = Type.Object({
    instanceId: Type.String({ description: 'AWS EC2 instance ID' }),
    instanceName: Type.Optional(Type.String({ description: 'EC2 tab with key Name.' })),

    vpc: Type.Object({
        vpcId: Type.Optional(Type.String({ description: 'AWS VPC ID on which EC2 instance is running' })),
        vpcName: Type.Optional(Type.String({ description: 'AWS VPC name on which EC2 instance is running' })),
        cidr: Type.Optional(Type.String({ description: 'AWS VPC CIDR on which EC2 instance is running' }))
    }),

    nextToken: Type.Optional(
        Type.String({
            description: 'Pagination token for each page.  A non-empty token indicates more more results are available.'
        })
    )
});

const DiscoveryMsSqlFailureResponse = Type.Object({
    message: Type.String()
});

const DiscoverMsSqlSummaryParams = Type.Composite([ManagedHostParams, Type.Object({ instanceId: Type.String() })]);

type SqlServerInstanceInfoType = Static<typeof SqlServerInstanceInfo>;
type DiscoverResponseInfoType = Static<typeof DiscoverResponseInfo>;
type DiscoverMsSqlSummarySuccessResponseType = Static<typeof DiscoverMsSqlSummarySuccessResponse>;
type DiscoveryMsSqlFailureResponseType = Static<typeof DiscoveryMsSqlFailureResponse>;

export {
    DiscoverMsSqlQuery,
    DiscoverMsSqlResponseBody,
    SqlServerInstanceInfoType,
    DiscoverResponseInfoType,
    DiscoverMsSqlSummarySuccessResponse,
    DiscoveryMsSqlFailureResponse,
    DiscoverMsSqlSummarySuccessResponseType,
    DiscoverMsSqlSummaryParams,
    DiscoveryMsSqlFailureResponseType
};
