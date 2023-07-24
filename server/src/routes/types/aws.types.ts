import { Type, Static } from '@sinclair/typebox';

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

const AwsParam = Type.Object({
    accountId: Type.String(),
    credentialsId: Type.String(),
    region: Type.String()
});

const AwsQueryString = Type.Object({
    fields: Type.String()
});

type VpcResponseType = Static<typeof VpcListResponse>;
type AwsParamType = Static<typeof AwsParam>;
type AwsQueryStringType = Static<typeof AwsQueryString>;

export { VpcResponseType, AwsParamType, AwsQueryStringType, AwsQueryString, AwsParam, VpcListResponse };
