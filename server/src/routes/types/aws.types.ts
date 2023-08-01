import { Type } from '@sinclair/typebox';

// AWS Request Params
const AwsParams = Type.Object({
    accountId: Type.String(),
    credentialsId: Type.String(),
    region: Type.String()
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
                        tags: Type.Optional(Type.Object({ Key: Type.String(), Value: Type.String() })),
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
                        name: Type.Optional(Type.String())
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
    )
});

const SnsResponse = Type.Object({
    Topics: Type.Array(
        Type.Object({
            TopicArn: Type.Optional(Type.String())
        })
    )
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
                    availabilityZones: Type.Optional(Type.Array(Type.String()))
                })
            )
        })
    )
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
    )
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
    keyPairs: Type.Array(KeyPairsSchema)
});

export {
    AwsVpcQueryString,
    AwsParams,
    AwsRegionsParams,
    VpcListResponse,
    AmiResponse,
    AmiQueryString,
    AdsResponse,
    SnsResponse,
    FSxRegionsResponse,
    KmsKeysListResponse,
    KeyPairsSchema,
    KeyPairsResponse
};
