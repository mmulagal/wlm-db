import { Static, Type } from '@fastify/type-provider-typebox';
import { RESOURCESTYPE } from '../../utils/consts';
import { API_DESCRIPTION } from '../../utils/schema-description-consts';
import { CredentialsIdParams } from './generic.types';

const RegisterInstanceParams = Type.Composite([
    CredentialsIdParams,
    Type.Object({
        instanceId: Type.String({ description: 'AWS EC2 instance ID' })
    })
]);

const ManageReadinessObject = Type.Object({
    missingSqlPermissions: Type.Array(Type.String({ description: 'Missing SQL permissions' })),
    missingModules: Type.Array(Type.String({ description: 'Missing powershell modules' }))
});

const BulkManageMsSqlRequestBody = Type.Object({
    credentialsId: Type.String({
        description: API_DESCRIPTION.CREDENTIALS_ID_DESC,
        examples: ['123e4567-e89b-12d3-a456-426614174000']
    }),
    region: Type.String({ description: API_DESCRIPTION.AWS_REGION_DESC }),
    ec2InstanceId: Type.String({ description: API_DESCRIPTION.EC2_INSTANCE_ID_DESC }),
    databaseInstanceNames: Type.Array(Type.String({ description: API_DESCRIPTION.SQL_DATABASE_INSTANCES_DESC })),
    databaseHostId: Type.Optional(Type.String({ description: API_DESCRIPTION.DATABASE_HOST_ID_DESC })),
    modulesToInstall: Type.Optional(
        Type.Array(
            Type.Union(
                [
                    Type.Literal('Powershell 7'),
                    Type.Literal('AWS.Tools.SimpleSystemsManagement'),
                    Type.Literal('AWS.Tools.FSx'),
                    Type.Literal('NetApp.ONTAP'),
                    Type.Literal('AWS.Tools.CloudWatch'),
                    Type.Literal('AWS.Tools.BedrockRuntime')
                ],
                { description: 'List of modules to install' }
            )
        )
    )
});

const MultiInstanceManageMsSqlRequestBody = Type.Object({
    items: Type.Array(BulkManageMsSqlRequestBody)
});

const BulkRegisterOracleRequestBody = Type.Object({
    credentialsId: Type.String({
        description: API_DESCRIPTION.CREDENTIALS_ID_DESC,
        examples: ['123e4567-e89b-12d3-a456-426614174000']
    }),
    region: Type.String({ description: API_DESCRIPTION.AWS_REGION_DESC }),
    ec2InstanceId: Type.String({ description: API_DESCRIPTION.EC2_INSTANCE_ID_DESC }),
    databaseInstanceNames: Type.Array(Type.String({ description: API_DESCRIPTION.ORACLE_DATABASE_INSTANCES_DESC })),
    databaseHostId: Type.Optional(Type.String({ description: API_DESCRIPTION.DATABASE_HOST_ID_DESC }))
});

const MultiInstanceRegisterOracleRequestBody = Type.Object({
    items: Type.Array(BulkRegisterOracleRequestBody)
});

type MultiInstanceManageMsSqlRequestBodyType = Static<typeof BulkManageMsSqlRequestBody>;

const MultiInstanceManageResponseBody = Type.Array(
    Type.Object({
        resourceId: Type.Optional(Type.String({ description: API_DESCRIPTION.DATABASE_HOST_ID_DESC })),
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

const JobBasedManageResponseBody = Type.Object({
    jobId: Type.String({ description: 'Job ID for the management operation' })
});

const RegisterCredentials = Type.Object({
    resourceId: Type.String({
        minLength: 1,
        examples: ['MSSQLSERVER', 'fs-01234aa85e38bdfbe'],
        description:
            'For types MSSQL and WINDOWS_USER, this is the sql instannce name. For FSX, this is the file system ID.'
    }),
    resourceType: Type.String({
        enum: [RESOURCESTYPE.FSX, RESOURCESTYPE.MSSQL, RESOURCESTYPE.WINDOWS_USER, RESOURCESTYPE.ORACLE]
    }),
    username: Type.String({
        minLength: 1,
        description: 'Username for the resource. For windows domain user, use DOMAIN\\username format.',
        examples: ['WLM\\wfuser', 'sqluser', 'fsxadmin']
    }),
    password: Type.String({ minLength: 1 })
});

const RegisterCredentialsRequestBody = Type.Object({
    credentials: Type.Array(RegisterCredentials),
    clusterNodesIpAddress: Type.Optional(
        Type.Array(
            Type.String({
                description:
                    'Private IP addresses of nodes in a clustered deployment that would help us find out the EC2 instance IDs',
                format: 'ipv4'
            })
        )
    ),
    checkManageReadiness: Type.Optional(
        Type.Boolean({
            description: 'Check if the instance is ready for management. Default is false.',
            default: false
        })
    )
});

const SingleInstanceRegisterCredentialsRequestBody = Type.Object({
    ec2InstanceId: Type.String({
        description: 'AWS EC2 instance ID',
        examples: ['i-01234aa85e38bdfbe']
    }),
    region: Type.String({
        description: 'AWS region',
        examples: ['us-east-1', 'us-west-2']
    }),
    credentialsId: Type.String({
        description: 'Credentials ID',
        examples: ['123e4567-e89b-12d3-a456-426614174000']
    }),
    credentials: Type.Array(RegisterCredentials),
    clusterNodesIpAddress: Type.Optional(
        Type.Array(
            Type.String({
                description:
                    'Private IP addresses of nodes in a clustered deployment that would help us find out the EC2 instance IDs',
                format: 'ipv4'
            })
        )
    ),
    checkManageReadiness: Type.Optional(
        Type.Boolean({
            description: 'Check if the instance is ready for management. Default is false.',
            default: false
        })
    )
});

type SingleInstanceRegisterCredentialsRequestBodyType = Static<typeof SingleInstanceRegisterCredentialsRequestBody>;

const BulkRegisterCredentialsRequestBody = Type.Object({
    items: Type.Array(SingleInstanceRegisterCredentialsRequestBody)
});

type BulkRegisterCredentialsRequestBodyType = Static<typeof BulkRegisterCredentialsRequestBody>;

const SingleRegisterCredentialsResponse = Type.Object({
    resourceId: Type.Optional(Type.String()),
    resourceType: Type.Optional(Type.String()),
    databaseCount: Type.Optional(Type.String()),
    databaseServerEdition: Type.Optional(Type.String()),
    databaseServerError: Type.Optional(Type.String()),
    fsxnError: Type.Optional(Type.String()),
    requiredModuleError: Type.Optional(Type.String()),
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

const RegisterCredentialsResponse = Type.Object({
    items: Type.Array(
        Type.Object({
            ec2InstanceId: Type.String(),
            credentialsId: Type.String({ description: 'Workload factory credentials ID' }),
            region: Type.String({ description: 'AWS region' }),
            errorMessage: Type.Optional(
                Type.String({ description: 'Error details, if any, of a failed credentials registration.' })
            ),
            registerDetails: Type.Array(SingleRegisterCredentialsResponse)
        })
    )
});

type RegisterCredentialsResponseType = Static<typeof RegisterCredentialsResponse>;

type SingleRegisterCredentialsResponseType = Static<typeof SingleRegisterCredentialsResponse>;

type RegisterCredentialsType = Static<typeof RegisterCredentials>;

export {
    PrepareResourceResponseBody,
    MultiInstanceManageResponseBody,
    MultiInstanceManageMsSqlRequestBody,
    MultiInstanceManageMsSqlRequestBodyType,
    MultiInstanceManageResponseBodyType,
    MultiHostManageResponseBody,
    JobBasedManageResponseBody,
    BulkRegisterCredentialsRequestBody,
    BulkRegisterCredentialsRequestBodyType,
    RegisterCredentialsResponse,
    SingleInstanceRegisterCredentialsRequestBodyType,
    RegisterCredentialsResponseType,
    SingleRegisterCredentialsResponseType,
    RegisterCredentialsType,
    RegisterInstanceParams,
    SingleInstanceRegisterCredentialsRequestBody,
    SingleRegisterCredentialsResponse,
    RegisterCredentialsRequestBody,
    MultiInstanceRegisterOracleRequestBody
};
