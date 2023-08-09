import { Type } from '@sinclair/typebox';

// AWS Request Params
const AwsParams = Type.Object({
    accountId: Type.String(),
    credentialsId: Type.String(),
    region: Type.String()
});

// EC2 instance Types response
const InstanceTypes = Type.Object({
    instanceTypes: Type.Array(
        Type.Object({
            instanceType: Type.Optional(Type.String()),
            vCpus: Type.Optional(Type.Number()),
            ramInMib: Type.Optional(Type.Number()),
            iopsInMbps: Type.Optional(Type.Number())
        })
    ),
    totalRecords: Type.Optional(Type.Number())
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
            securityGroups: Type.Optional(
                Type.Array(
                    Type.Object({
                        id: Type.Optional(Type.String()),
                        description: Type.Optional(Type.String()),
                        vpcId: Type.Optional(Type.String()),
                        ipPermissions: Type.Optional(Type.Any()),
                        name: Type.Optional(Type.String()),
                        securityGroupName: Type.Optional(Type.String())
                    })
                )
            )
        })
    ),
    totalRecords: Type.Optional(Type.Number())
});

// AMI Request and Response
const OS_TYPES = Type.Union([Type.Literal('windows')]);
const DB_TYPES = Type.Union([Type.Literal('sql')]);

const AmiQueryString = Type.Object({
    osType: OS_TYPES,
    osVersion: Type.Optional(Type.String()),
    databaseType: DB_TYPES,
    databaseEdition: Type.Optional(Type.String()),
    databaseVersion: Type.Optional(Type.String())
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
            hypervisor: Type.Optional(Type.String())
        })
    ),
    totalRecords: Type.Optional(Type.Number())
});

//SNS list topics Response
const SnsResponse = Type.Object({
    topics: Type.Array(
        Type.Object({
            topicName: Type.Optional(Type.String()),
            topicArn: Type.Optional(Type.String())
        })
    ),
    totalRecords: Type.Optional(Type.Number())
});

// Active Directory Response
const AdsResponse = Type.Object({
    directories: Type.Array(
        Type.Object({
            id: Type.Optional(Type.String()),
            dnsIpAddress: Type.Optional(Type.Array(Type.String())),
            launchTime: Type.Optional(Type.Date()),
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
    ),
    totalRecords: Type.Optional(Type.Number())
});

// Regions Request Params
const AwsRegionsParams = Type.Object({
    accountId: Type.String(),
    credentialsId: Type.String()
});

// Regions supporting FSx for ONTAP response
const FSxRegionsResponse = Type.Object({
    regions: Type.Array(
        Type.Object({
            regionCode: Type.String(),
            regionName: Type.String()
        })
    ),
    totalRecords: Type.Optional(Type.Number())
});

// KMS Keys List Request and Response
const KmsKeysListResponse = Type.Object({
    keys: Type.Array(
        Type.Object({
            id: Type.Optional(Type.String()),
            name: Type.Optional(Type.String()),
            origin: Type.Optional(Type.String()),
            state: Type.Optional(Type.String()),
            expirationDate: Type.Optional(Type.String())
        })
    ),
    totalRecords: Type.Optional(Type.Number())
});

// Keypair schema
const KeyPairsSchema = Type.Object({
    id: Type.Optional(Type.String()),
    name: Type.Optional(Type.String())
});

// GET keyPairs schema
const KeyPairsResponse = Type.Object({
    keyPairs: Type.Array(KeyPairsSchema),
    totalRecords: Type.Optional(Type.Number())
});

// GET FSx filesystems request parameters
const FSxFileSystemParams = Type.Object({
    accountId: Type.String(),
    credentialsId: Type.String(),
    region: Type.String(),
    vpcId: Type.String()
});

// FSx filesystem schema
const FSxFileSystemSchema = Type.Object({
    fileSystemId: Type.String(),
    name: Type.Optional(Type.String()),
    kmsKeyId: Type.Optional(Type.String()),
    networkInterfaceIds: Type.Optional(Type.Array(Type.String())),
    subnetIds: Type.Optional(Type.Array(Type.String())),
    vpcId: Type.Optional(Type.String()),
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
    )
});

// GET FSx filesystems response
const FSxFileSystemsResponse = Type.Object({
    filesystems: Type.Array(FSxFileSystemSchema)
});

export {
    AwsVpcQueryString,
    AwsParams,
    InstanceTypes,
    AwsRegionsParams,
    VpcListResponse,
    AmiResponse,
    AmiQueryString,
    AdsResponse,
    SnsResponse,
    FSxRegionsResponse,
    FSxFileSystemParams,
    FSxFileSystemSchema,
    FSxFileSystemsResponse,
    KmsKeysListResponse,
    KeyPairsSchema,
    KeyPairsResponse
};
