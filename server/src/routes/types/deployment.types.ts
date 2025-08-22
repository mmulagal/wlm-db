import { Static, Type } from '@fastify/type-provider-typebox';
import { API_DESCRIPTION, API_DESCRIPTION_EXAMPLES } from '../../utils/schema-description-consts';

const CFNetworkConfiguration = Type.Object({
    vpcId: Type.String(),
    vpcCidr: Type.String(),
    privateSubnet1Id: Type.String(),
    routeTable1Id: Type.String(),
    availabilityZone1: Type.String(),
    privateSubnet2Id: Type.Optional(Type.String()),
    routeTable2Id: Type.Optional(Type.String()),
    availabilityZone2: Type.Optional(Type.String())
});

const EC2Configuration = Type.Object({
    workloadInstanceType: Type.String(),
    keyPairName: Type.String()
});

const ADConfiguration = Type.Object({
    adScenarioType: Type.String({ enum: ['AWS_MANAGED_AD', 'USER_MANAGED_AD'] }),
    domainUsername: Type.String(),
    domainPassword: Type.String(),
    domainDnsname: Type.String(),
    dnsIpaddress: Type.String(),
    securityGroupId: Type.Optional(Type.String())
});

const FSXConfiguration = Type.Object({
    fsxFileSystemId: Type.Optional(Type.String()),
    fsxDeploymentMode: Type.String({ enum: ['SINGLE_AZ_1', 'MULTI_AZ_1', 'SINGLE_AZ_2', 'MULTI_AZ_2'] }),
    fsxUsername: Type.String(),
    fsxPassword: Type.String(),
    databaseSize: Type.Number(),
    fsxVolThroughput: Type.Number({ enum: [128, 256, 512, 1024, 2048, 4096, 384, 768, 1536, 3072, 4608, 6144] }),
    fsxIOPS: Type.Number(),
    ontapSgGroupId: Type.Array(Type.String()),
    encryptionKey: Type.Optional(Type.String()),
    snapshotPolicy: Type.String({ enum: ['none', 'daily_weekretention'], default: 'daily_weekretention' })
});

const SQLConfiguration = Type.Object({
    sqlDeploymentMode: Type.String({ enum: ['standalone', 'fci', 'ha'] }),
    sqlAmiId: Type.String(),
    serviceAccountName: Type.String(),
    serviceAccountPassword: Type.String(),
    sqlServerName: Type.String(),
    sqlAmiName: Type.String(),
    sqlCollation: Type.String(),
    isCustomAmi: Type.Optional(Type.Boolean({ default: false })),
    sqlVersion: Type.Optional(Type.String({ enum: ['postgresql15', 'postgresql16'] }))
});

const PgSqlConfiguration = Type.Pick(SQLConfiguration, [
    'sqlDeploymentMode',
    'sqlServerName',
    'sqlVersion',
    'serviceAccountPassword'
]);

const PgSqlCloudFormationTemplateRequestBody = Type.Object({
    networkConfiguration: CFNetworkConfiguration,
    ec2Configuration: EC2Configuration,
    fsxConfiguration: FSXConfiguration,
    sqlConfiguration: PgSqlConfiguration,
    topicArn: Type.Optional(Type.String()),
    enableCloudWatch: Type.Optional(Type.Boolean({ default: true })),
    tags: Type.Optional(
        Type.Array(
            Type.Object({
                key: Type.String(),
                value: Type.String()
            })
        )
    ),
    credentialsId: Type.Optional(Type.String()),
    region: Type.Optional(Type.String())
});

const CloudFormationTemplateHeader = Type.Object({
    'triggered-from': Type.String({
        enum: ['wizard-advanced', 'wizard-quick', 'chatbot', 'rest-api'],
        default: 'rest-api'
    })
});

// Cloud formation template, yaml and cli creation
const CloudFormationStaticTemplateRequestBody = Type.Object({
    networkConfiguration: CFNetworkConfiguration,
    ec2Configuration: EC2Configuration,
    adConfiguration: ADConfiguration,
    fsxConfiguration: FSXConfiguration,
    sqlConfiguration: SQLConfiguration,
    topicArn: Type.Optional(Type.String()),
    enableCloudWatch: Type.Optional(Type.Boolean({ default: true })),
    tags: Type.Optional(
        Type.Array(
            Type.Object({
                key: Type.String(),
                value: Type.String()
            })
        )
    ),
    credentialsId: Type.Optional(Type.String()),
    region: Type.Optional(Type.String())
});

// Cloud formation template creation Request and Response
const CloudFormationTemplateRequestBody = Type.Omit(CloudFormationStaticTemplateRequestBody, [
    'credentialsId',
    'region'
]);

// PgSql Cloud formation template, yaml and cli creation
const PgSqlCloudFormationStaticTemplateRequestBody = Type.Object({
    networkConfiguration: CFNetworkConfiguration,
    ec2Configuration: EC2Configuration,
    fsxConfiguration: FSXConfiguration,
    sqlConfiguration: SQLConfiguration,
    topicArn: Type.Optional(Type.String()),
    enableCloudWatch: Type.Optional(Type.Boolean({ default: true })),
    tags: Type.Optional(
        Type.Array(
            Type.Object({
                key: Type.String(),
                value: Type.String()
            })
        )
    ),
    credentialsId: Type.Optional(Type.String()),
    region: Type.Optional(Type.String())
});

const MissingPermission = Type.Object({
    service: Type.String(),
    action: Type.String(),
    reason: Type.String()
});

const MissingPermissions = Type.Object({
    implicitlyDenied: Type.Optional(Type.Array(MissingPermission)),
    explicitlyDenied: Type.Optional(Type.Array(MissingPermission))
});

const CloudFormationDeploymentResponse = Type.Object({
    cloudFormationUrl: Type.Optional(Type.String()),
    cloudFormationStackId: Type.Optional(Type.String()),
    missingPermissions: Type.Optional(MissingPermissions)
});

const PgSqlCloudFormationDeploymentResponse = Type.Any();

const CloudFormationStaticTemplateResponse = Type.Object({
    url: Type.String(),
    template: Type.String(),
    cliCommand: Type.String()
});

const DeployTemplateResponse = Type.Object({
    cloudFormationStackId: Type.String()
});

const DeploymentStatusResponse = Type.Object({
    deploymentId: Type.String(),
    deploymentName: Type.String(),
    deploymentStatus: Type.String(),
    deploymentFailureReason: Type.Optional(Type.String())
});

const DeploymentStatusObjectParams = Type.Object({
    accountId: Type.String({ description: API_DESCRIPTION.ACCOUNT_ID_DESC, minLength: 1 }),
    credentialsId: Type.String({
        description: API_DESCRIPTION.CREDENTIALS_ID_DESC,
        minLength: 1,
        format: 'uuid',
        examples: API_DESCRIPTION_EXAMPLES.CREDENTIALS_ID_EX
    }),
    region: Type.String({ description: API_DESCRIPTION.AWS_REGION_DESC, minLength: 1 }),
    stackName: Type.String({ minLength: 1 })
});

const FSxAvailableRegion = Type.Object({
    regionCode: Type.String({ description: API_DESCRIPTION.AWS_REGION_CODE_DESC }),
    regionName: Type.String({ description: API_DESCRIPTION.AWS_REGION_NAME_DESC })
});

const FsxAvailableRegionsForThroughputListResponse = Type.Object({
    regions: Type.Array(FSxAvailableRegion)
});

const CollationListResponse = Type.Object({
    collationList: Type.Array(
        Type.Object({
            name: Type.String(),
            description: Type.Optional(Type.String())
        })
    ),
    defaultCollation: Type.String()
});

const CollationListQueryString = Type.Object({
    version: Type.Number()
});

const TerraformSetupRequestBody = Type.Object({
    networkConfiguration: CFNetworkConfiguration,
    ec2Configuration: EC2Configuration,
    adConfiguration: ADConfiguration,
    fsxConfiguration: FSXConfiguration,
    sqlConfiguration: SQLConfiguration,
    topicArn: Type.Optional(Type.String()),
    enableCloudWatch: Type.Optional(Type.Boolean({ default: true })),
    tags: Type.Optional(
        Type.Array(
            Type.Object({
                key: Type.String(),
                value: Type.String()
            })
        )
    ),
    credentialsId: Type.Optional(Type.String()),
    region: Type.Optional(Type.String())
});

const TerraformSetupResponse = Type.Object({
    url: Type.String(),
    template: Type.String()
});

type DeploymentStatusObjectParamsType = Static<typeof DeploymentStatusObjectParams>;

const DeploymentStatusListResponse = Type.Array(DeploymentStatusResponse);
type DeploymentStatusResponseType = Static<typeof DeploymentStatusResponse>;
type DeploymentStatusListResponseType = Static<typeof DeploymentStatusListResponse>;

type CFNetworkConfigurationType = Static<typeof CFNetworkConfiguration>;
type EC2ConfigurationType = Static<typeof EC2Configuration>;
type ADConfigurationType = Static<typeof ADConfiguration>;
type FSXConfigurationType = Static<typeof FSXConfiguration>;
type SQLConfigurationType = Static<typeof SQLConfiguration>;
type CloudFormationStaticTemplateResponseType = Static<typeof CloudFormationStaticTemplateResponse>;
type CloudFormationDeploymentResponseType = Static<typeof CloudFormationDeploymentResponse>;
type PgSqlConfigurationType = Static<typeof PgSqlConfiguration> & { sqlAmiId?: string };
type TerraformSetupResponseType = Static<typeof TerraformSetupResponse>;

export {
    CloudFormationTemplateRequestBody,
    CFNetworkConfigurationType,
    EC2ConfigurationType,
    ADConfigurationType,
    FSXConfigurationType,
    SQLConfigurationType,
    DeployTemplateResponse,
    CloudFormationDeploymentResponseType,
    DeploymentStatusResponse,
    DeploymentStatusListResponse,
    DeploymentStatusListResponseType,
    DeploymentStatusResponseType,
    DeploymentStatusObjectParams,
    DeploymentStatusObjectParamsType,
    CloudFormationStaticTemplateResponse,
    CloudFormationStaticTemplateResponseType,
    CloudFormationStaticTemplateRequestBody,
    CloudFormationDeploymentResponse,
    CloudFormationTemplateHeader,
    MissingPermission,
    FsxAvailableRegionsForThroughputListResponse,
    CollationListResponse,
    CollationListQueryString,
    PgSqlCloudFormationTemplateRequestBody,
    PgSqlCloudFormationDeploymentResponse,
    PgSqlConfiguration,
    PgSqlConfigurationType,
    TerraformSetupResponse,
    TerraformSetupResponseType,
    TerraformSetupRequestBody,
    PgSqlCloudFormationStaticTemplateRequestBody
};
