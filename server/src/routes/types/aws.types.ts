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
                        tags: Type.Optional(Type.Any()),
                        name: Type.Optional(Type.String())
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
    )
});

// AMI Request and Response
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

// KMS Keys List Request and Response
const KmsKeysListResponse = Type.Object({
    keys: Type.Array(
        Type.Object({
            id: Type.Optional(Type.String()),
            name: Type.Optional(Type.String()),
            origin: Type.Optional(Type.String())
        })
    )
});

const AdsParams = Type.Object({
    accountId: Type.String(),
    credentialsId: Type.String(),
    region: Type.String(),
    vpcId: Type.String()
});

export { AwsVpcQueryString, AwsParams, VpcListResponse, AmiResponse, AdsResponse, AdsParams, KmsKeysListResponse };
