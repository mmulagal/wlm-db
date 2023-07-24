import { Type } from '@sinclair/typebox';
import { Static } from '@sinclair/typebox';

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

export const AwsParams = Type.Object({
    accountId: Type.String(),
    credentialsId: Type.String(),
    region: Type.String(),
});

export const AwsQueryString = Type.Object({
    fields: Type.String(),
});

export const FSxRegionsResponse = Type.Object({
    regions: Type.Array(
        Type.Object({
            regionName: Type.String(),
            descriptiveRegionName: Type.String()
        })
    )
});

export type VpcResponseType = Static<typeof VpcListResponse>;
export type AwsParamsType = Static<typeof AwsParams>;
export type AwsQueryStringType = Static<typeof AwsQueryString>;
export type FSxRegionsResponseType = Static<typeof FSxRegionsResponse>;
