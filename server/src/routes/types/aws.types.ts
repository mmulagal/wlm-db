import { Type, Static } from '@fastify/type-provider-typebox';
import { API_DESCRIPTION, API_DESCRIPTION_EXAMPLES } from '../../utils/schema-description-consts';

// AWS request parameters
const AwsParams = Type.Object({
    accountId: Type.String({ description: API_DESCRIPTION.ACCOUNT_ID_DESC }),
    credentialsId: Type.String({
        description: API_DESCRIPTION.CREDENTIALS_ID_DESC,
        format: 'uuid',
        examples: API_DESCRIPTION_EXAMPLES.CREDENTIALS_ID_EX
    })
});

// AWS request parameters wth region
const AwsParamsWithRegion = Type.Composite([
    AwsParams,
    Type.Object({ region: Type.String({ description: API_DESCRIPTION.AWS_REGION_DESC }) })
]);

// EC2 instance Types response
const InstanceTypes = Type.Object({
    instanceTypes: Type.Array(
        Type.Object({
            instanceType: Type.Optional(Type.String()),
            vCpus: Type.Optional(Type.Number()),
            ramInMib: Type.Optional(Type.Number()),
            iopsInMbps: Type.Optional(Type.Number()),
            architecture: Type.Optional(Type.Array(Type.String()))
        })
    )
});

// VPC Security Group Response
const VcpSecurityGroupParams = Type.Composite([AwsParamsWithRegion, Type.Object({ vpcId: Type.String() })]);

const VpcSecurityGroup = Type.Array(
    Type.Object({
        id: Type.Optional(Type.String()),
        description: Type.Optional(Type.String()),
        vpcId: Type.Optional(Type.String()),
        ipPermissions: Type.Optional(Type.Any()),
        name: Type.Optional(Type.String()),
        securityGroupName: Type.Optional(Type.String())
    })
);

const VpcSecurityGroupsResponse = Type.Object({
    securityGroups: VpcSecurityGroup
});

// VPC list Request and Response
const AwsVpcQueryString = Type.Object({
    fields: Type.Optional(Type.String())
});

const VpcListResponse = Type.Object({
    vpcs: Type.Array(
        Type.Object({
            id: Type.Optional(Type.String()),
            state: Type.Optional(Type.String()),
            cidrBlock: Type.Optional(Type.Any()),
            tags: Type.Optional(Type.Any()),
            isDefault: Type.Optional(Type.Boolean()),
            name: Type.Optional(Type.String()),
            subnets: Type.Optional(
                Type.Array(
                    Type.Object({
                        id: Type.Optional(Type.String()),
                        state: Type.Optional(Type.String()),
                        vpcId: Type.Optional(Type.String()),
                        cidrBlock: Type.Optional(Type.String()),
                        availabilityZone: Type.Optional(Type.String()),
                        availableIps: Type.Optional(Type.Number()),
                        tags: Type.Optional(
                            Type.Array(
                                Type.Object({ Key: Type.Optional(Type.String()), Value: Type.Optional(Type.String()) })
                            )
                        ),
                        name: Type.Optional(Type.String()),
                        routeTableId: Type.Optional(Type.String())
                    })
                )
            ),
            securityGroups: Type.Optional(VpcSecurityGroup)
        })
    )
});

// AMI Request and Response
const OS_TYPES = Type.Union([Type.Literal('windows')]);
const DB_TYPES = Type.Union([Type.Literal('sql')]);

const AmiQueryString = Type.Object({
    osType: Type.Optional(OS_TYPES),
    osVersion: Type.Optional(Type.String()),
    databaseType: Type.Optional(DB_TYPES),
    databaseEdition: Type.Optional(Type.String()),
    databaseVersion: Type.Optional(Type.String()),
    customAmi: Type.Optional(Type.Boolean())
});

const AmiResponse = Type.Object({
    amis: Type.Array(
        Type.Object({
            name: Type.Optional(Type.String()),
            description: Type.Optional(Type.String()),
            architecture: Type.Optional(Type.String()),
            imageId: Type.Optional(Type.String()),
            imageLocation: Type.Optional(Type.String()),
            public: Type.Optional(Type.Boolean()),
            platform: Type.Optional(Type.String()),
            platformDetails: Type.Optional(Type.String()),
            state: Type.Optional(Type.String()),
            hypervisor: Type.Optional(Type.String()),
            ebsVolumeSize: Type.Optional(Type.Number())
        })
    )
});

// SNS list topics Response
const SnsResponse = Type.Object({
    topics: Type.Array(
        Type.Object({
            topicName: Type.Optional(Type.String()),
            topicArn: Type.Optional(Type.String())
        })
    )
});

// Active Directory Response
const AdsResponse = Type.Object({
    directories: Type.Array(
        Type.Object({
            id: Type.Optional(Type.String()),
            dnsIpAddress: Type.Optional(Type.Array(Type.String())),
            launchTime: Type.Optional(Type.Number()),
            domainName: Type.Optional(Type.String()),
            shortName: Type.Optional(Type.String()),
            ssoEnabled: Type.Optional(Type.Boolean()),
            status: Type.Optional(Type.String()),
            type: Type.Optional(Type.String()),
            vpcSettings: Type.Optional(
                Type.Object({
                    vpcId: Type.Optional(Type.String()),
                    subnetIds: Type.Optional(Type.Array(Type.String())),
                    availabilityZones: Type.Optional(Type.Array(Type.String())),
                    securityGroupId: Type.Optional(Type.String())
                })
            )
        })
    )
});

// Regions supporting FSx for ONTAP response
const FSxAvailableRegion = Type.Object({
    regionCode: Type.String({ description: API_DESCRIPTION.AWS_REGION_CODE_DESC }),
    regionName: Type.String({ description: API_DESCRIPTION.AWS_REGION_NAME_DESC }),
    bedrockAvailable: Type.Optional(Type.Boolean({ description: API_DESCRIPTION.BEDROCK_SUPPORTED_DESC }))
});

const FSxRegionsResponse = Type.Object({
    regions: Type.Array(FSxAvailableRegion)
});

// KMS Keys List Request and Response
const KmsKeysListResponse = Type.Object({
    keys: Type.Array(
        Type.Object({
            id: Type.Optional(Type.String()),
            arn: Type.Optional(Type.String()),
            name: Type.Optional(Type.String()),
            origin: Type.Optional(Type.String()),
            state: Type.Optional(Type.String()),
            expirationDate: Type.Optional(Type.String()),
            isDefault: Type.Optional(Type.Boolean()),
            formattedDate: Type.Optional(Type.String())
        })
    )
});

// Keypair schema
const KeyPairsSchema = Type.Object({
    id: Type.Optional(Type.String()),
    name: Type.Optional(Type.String())
});

// GET keyPairs schema
const KeyPairsResponse = Type.Object({
    keyPairs: Type.Array(KeyPairsSchema)
});

// GET FSx filesystems request parameters
const FSxFileSystemParams = Type.Composite([AwsParamsWithRegion, Type.Object({ vpcId: Type.String() })]);

// FSx filesystem schema
const FSxFileSystemSchema = Type.Object({
    fileSystemId: Type.String(),
    name: Type.Optional(Type.String()),
    kmsKeyId: Type.Optional(Type.String()),
    lifecycle: Type.String({
        enum: ['AVAILABLE', 'CREATING', 'DELETING', 'FAILED', 'MISCONFIGURED', 'MISCONFIGURED_UNAVAILABLE', 'UPDATING']
    }),
    networkInterfaceIds: Type.Optional(Type.Array(Type.String())),
    subnetIds: Type.Optional(Type.Array(Type.String())),
    vpcId: Type.Optional(Type.String()),
    securityGroups: Type.Optional(Type.Array(Type.String())),
    ontapConfiguration: Type.Optional(
        Type.Object({
            deploymentType: Type.Optional(Type.String()),
            endpointIpAddressRange: Type.Optional(Type.String()),
            fsxAdminPassword: Type.Optional(Type.String()),
            preferredSubnetId: Type.Optional(Type.String()),
            routeTableIds: Type.Optional(Type.Array(Type.String())),
            throughputCapacity: Type.Optional(Type.Number()),
            diskIopsConfiguration: Type.Optional(
                Type.Object({
                    iops: Type.Optional(Type.Number()),
                    mode: Type.Optional(Type.String())
                })
            ),
            endpoints: Type.Optional(
                Type.Object({
                    intercluster: Type.Optional(
                        Type.Object({
                            dnsName: Type.Optional(Type.String()),
                            ipAddresses: Type.Optional(Type.Array(Type.String()))
                        })
                    ),
                    management: Type.Optional(
                        Type.Object({
                            dnsName: Type.Optional(Type.String()),
                            ipAddresses: Type.Optional(Type.Array(Type.String()))
                        })
                    )
                })
            )
        })
    ),
    volumes: Type.Optional(
        Type.Array(
            Type.Object({
                volumeId: Type.Optional(Type.String()),
                volumeType: Type.Optional(Type.String()),
                securityStyle: Type.Optional(Type.String()),
                sizeInMegabytes: Type.Optional(Type.Number()),
                storageEfficiencyEnabled: Type.Optional(Type.Boolean()),
                storageVirtualMachineId: Type.Optional(Type.String()),
                ontapVolumeType: Type.Optional(Type.String())
            })
        )
    ),
    storageVirtualMachines: Type.Optional(
        Type.Array(
            Type.Object({
                storageVirtualMachineId: Type.Optional(Type.String()),
                storageVirtualMachineName: Type.Optional(Type.String()),
                resourceARN: Type.Optional(Type.String()),
                lifeCycle: Type.Optional(Type.String()),
                subtype: Type.Optional(Type.String()),
                creationTime: Type.Optional(Type.Any()),
                uuid: Type.Optional(Type.String())
            })
        )
    )
});

// GET FSx filesystems response
const FSxFileSystemsResponse = Type.Object({
    filesystems: Type.Array(FSxFileSystemSchema)
});

type FSxRegionsResponseType = Static<typeof FSxRegionsResponse>;
type FSxAvailableRegionType = Static<typeof FSxAvailableRegion>;

const IncludeBedrockStatusQueryParam = Type.Object({
    includeBedrockStatus: Type.Optional(Type.Boolean({ default: false }))
});

export {
    AwsVpcQueryString,
    AwsParams,
    AwsParamsWithRegion,
    InstanceTypes,
    VpcListResponse,
    AmiResponse,
    AmiQueryString,
    AdsResponse,
    SnsResponse,
    FSxRegionsResponse,
    FSxRegionsResponseType,
    FSxAvailableRegionType,
    FSxFileSystemParams,
    FSxFileSystemSchema,
    FSxFileSystemsResponse,
    KmsKeysListResponse,
    KeyPairsSchema,
    KeyPairsResponse,
    VcpSecurityGroupParams,
    VpcSecurityGroupsResponse,
    IncludeBedrockStatusQueryParam
};
