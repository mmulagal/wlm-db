import { Type } from '@sinclair/typebox';
import { Static } from '@sinclair/typebox';

const VpcListResponse = Type.Object({
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
                        id: Type.String(),
                        state: Type.String(),
                        vpcId: Type.String(),
                        cidrBlock: Type.String(),
                        availabilityZone: Type.String(),
                        availableIps: Type.Number(),
                        tags: Type.Any(),
                        name: Type.Optional(Type.String()),
                    })
                )
            ),
            securityGroups: Type.Optional(
                Type.Array(
                    Type.Object({
                        id: Type.String(),
                        description: Type.String(),
                        vpcId: Type.String(),
                        ipPermissions: Type.Any(),
                    })
                )
            ),
        })
    ),
});

const IParam = Type.Object({
    accountId: Type.String(),
    credentialsId: Type.String(),
    region: Type.String(),
});

export type VpcResponseType = Static<typeof VpcListResponse>;
export type IParamType = Static<typeof IParam>;

export { VpcListResponse };
