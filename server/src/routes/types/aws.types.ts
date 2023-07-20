import { Type } from '@sinclair/typebox';
import { Static } from '@sinclair/typebox';

// AWS Request Params
export const AwsParam = Type.Object({
    accountId: Type.String(),
    credentialsId: Type.String(),
    region: Type.String(),
});

// VPC list Response
export const VpcListResponse = Type.Object({
    vpcs: Type.Array(
        Type.Object({
            id: Type.Optional(Type.String()),
            state: Type.Optional(Type.String()),
            cidrBlock: Type.Optional(Type.Any()),
            tags: Type.Optional(Type.Any()),
            isDefault: Type.Optional(Type.Boolean()),
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
                        name: Type.Optional(Type.String()),
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
                    })
                )
            ),
        })
    ),
});

// AMI Response 
export const AmiResponse = Type.Object({
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
})

export const AwsQueryString = Type.Object({
    fields: Type.String(),
});

export type VpcResponseType = Static<typeof VpcListResponse>;
export type AwsParamType = Static<typeof AwsParam>;
export type AwsQueryStringType = Static<typeof AwsQueryString>;
export type AmiResponseType = Static<typeof AmiResponse>;
