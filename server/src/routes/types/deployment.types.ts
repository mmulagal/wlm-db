import { Type, Static } from '@sinclair/typebox';

const CFNetworkConfiguration = Type.Object({
    vpcId: Type.Optional(Type.String()),
    vpcCidr: Type.String(),
    privateSubnet1Id: Type.Optional(Type.String()),
    routeTable1Id: Type.Optional(Type.String()),
    availabilityZone1: Type.String(),
    privateSubnet2Id: Type.Optional(Type.String()),
    routeTable2Id: Type.Optional(Type.String()),
    availabilityZone2: Type.String()
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
    fsxUsername: Type.String(),
    fsxPassword: Type.String(),
    databaseSize: Type.Number(),
    ontapSgGroupId: Type.Array(Type.String()),
    fsxVolThroughput: Type.Number({ enum: [128, 256, 512, 1024, 2048, 4096] }),
    fsxIOPS: Type.Number(),
    encryptionKey: Type.Optional(Type.String())
});

const SQLConfiguration = Type.Object({
    sqlAmiId: Type.String(),
    serviceAccountName: Type.String(),
    serviceAccountPassword: Type.String(),
    sqlFciName: Type.String()
});

// Cloud formation template creation Request and Response
const CloudFormationTemplateRequestBody = Type.Object({
    networkConfiguration: CFNetworkConfiguration,
    ec2Configuration: EC2Configuration,
    adConfiguration: ADConfiguration,
    fsxConfiguration: FSXConfiguration,
    sqlConfiguration: SQLConfiguration,
    topicArn: Type.Optional(Type.String()),
    enableCloudWatch: Type.Optional(Type.Boolean({ default: false }))
});

const CloudFormationTemplateResponse = Type.Object({
    cloudFormationUrl: Type.String(),
    warningMessage: Type.Optional(Type.String())
});

const DeployTemplateResponse = Type.Object({
    cloudFormationStackId: Type.String()
});

const DeploymentStatusResponse = Type.Object({
    id: Type.String(),
    name: Type.String(),
    status: Type.String(),
    reason: Type.Optional(Type.String())
});

const DeploymentStatusObjectParams = Type.Object({
    accountId: Type.String({ minLength: 1 }),
    credentialsId: Type.String({ minLength: 1 }),
    region: Type.String({ minLength: 1 }),
    stackId: Type.String({ minLength: 1 })
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
type CloudFormationTemplateResponseType = Static<typeof CloudFormationTemplateResponse>;

export {
    CloudFormationTemplateRequestBody,
    CloudFormationTemplateResponse,
    CFNetworkConfigurationType,
    EC2ConfigurationType,
    ADConfigurationType,
    FSXConfigurationType,
    SQLConfigurationType,
    DeployTemplateResponse,
    CloudFormationTemplateResponseType,
    DeploymentStatusResponse,
    DeploymentStatusListResponse,
    DeploymentStatusListResponseType,
    DeploymentStatusResponseType,
    DeploymentStatusObjectParams,
    DeploymentStatusObjectParamsType
};
