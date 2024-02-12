import { Static, Type } from '@fastify/type-provider-typebox';

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
    fsxDeploymentMode: Type.String({ enum: ['SINGLE_AZ_1', 'MULTI_AZ_1'] }),
    fsxFileSystemId: Type.Optional(Type.String()),
    fsxUsername: Type.String(),
    fsxPassword: Type.String(),
    databaseSize: Type.Number(),
    ontapSgGroupId: Type.Array(Type.String()),
    fsxVolThroughput: Type.Number({ enum: [128, 256, 512, 1024, 2048, 4096] }),
    fsxIOPS: Type.Number(),
    encryptionKey: Type.Optional(Type.String())
});

const SQLConfiguration = Type.Object({
    sqlDeploymentMode: Type.String({ enum: ['standalone', 'fci'] }),
    sqlAmiId: Type.String(),
    serviceAccountName: Type.String(),
    serviceAccountPassword: Type.String(),
    sqlServerName: Type.String(),
    sqlAmiName: Type.String()
});

// Cloud formation template creation Request and Response
const CloudFormationTemplateRequestBody = Type.Object({
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
    )
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

const MissingPermissions = Type.Object({
    missingStatements: Type.Optional(Type.Array(Type.String())),
    blockedByOrganisation: Type.Optional(Type.Array(Type.String())),
    blockedByPermissionBoundary: Type.Optional(Type.Array(Type.String()))
});

const CloudFormationDeploymentResponse = Type.Object({
    cloudFormationUrl: Type.Optional(Type.String()),
    cloudFormationStackId: Type.Optional(Type.String()),
    missingPermissions: MissingPermissions
});

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
    accountId: Type.String({ minLength: 1 }),
    credentialsId: Type.String({ minLength: 1 }),
    region: Type.String({ minLength: 1 }),
    stackName: Type.String({ minLength: 1 })
});

const DeploymentSummaryQueryString = Type.Object({
    statuses: Type.Optional(Type.String()),
    nextToken: Type.Optional(Type.String())
});

const DeploymentJobsSummaryResponse = Type.Object({
    id: Type.String(),
    deploymentId: Type.String(),
    deploymentName: Type.String(),
    name: Type.Optional(Type.String()),
    status: Type.String(),
    metadata: Type.Object({
        region: Type.Optional(Type.String()),
        serverType: Type.Optional(Type.String()),
        serverInstallationMode: Type.Optional(Type.String()),
        fileSystemType: Type.Optional(Type.String())
    })
});

const DeploymentSummaryListResponse = Type.Object({
    count: Type.Number(),
    items: Type.Array(DeploymentJobsSummaryResponse),
    nextToken: Type.Optional(Type.String())
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
    DeploymentSummaryQueryString,
    DeploymentSummaryListResponse,
    CloudFormationTemplateHeader
};
