import { Type, Static } from '@sinclair/typebox';

// AWS Request Params
const AwsParam = Type.Object({
    accountId: Type.String(),
    credentialsId: Type.String(),
    region: Type.String()
});

// VPC list Request and Response
const AwsVpcQueryString = Type.Object({
    fields: Type.String()
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

type AmiResponseType = Static<typeof AmiResponse>;
type VpcResponseType = Static<typeof VpcListResponse>;
type AwsParamType = Static<typeof AwsParam>;
type AwsVpcQueryStringType = Static<typeof AwsVpcQueryString>;

export {
    VpcResponseType,
    AwsParamType,
    AwsVpcQueryStringType,
    AwsVpcQueryString,
    AwsParam,
    VpcListResponse,
    AmiResponse,
    AmiResponseType
};
