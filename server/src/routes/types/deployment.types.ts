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
    adScenarioType: Type.String({ enum: ['AWS_MANAGED_AD', 'MICROSOFT_AD_ON_EC2'] }),
    domainUsername: Type.String(),
    domainPassword: Type.String(),
    domainDnsname: Type.String(),
    dnsIpaddress: Type.String(),
    securityGroupId: Type.String()
});

const FSXConfiguration = Type.Object({
    fsxFileSystemId: Type.Optional(Type.String()),
    fsxUsername: Type.String(),
    fsxPassword: Type.String(),
    databaseSize: Type.Number(),
    ontapSgGroupId: Type.String(),
    fsxVolThroughput: Type.Number({ enum: [128, 256, 512, 1024, 2048, 3072, 4096] }),
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
    topicArn: Type.Optional(Type.String())
});

const CloudFormationTemplateResponse = Type.Object({
    cloudFormationUrl: Type.String(),
    warningMessage: Type.Optional(Type.String())
});

const DeployTemplateResponse = Type.Object({
    cloudFormationStackId: Type.String()
});

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
    CloudFormationTemplateResponseType
};
