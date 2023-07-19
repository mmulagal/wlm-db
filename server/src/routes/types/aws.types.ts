import { Type } from '@sinclair/typebox';
import { Static } from '@sinclair/typebox';

const VpcListResponse = Type.Object({
    vpcs: Type.Array(Type.Object({
        id: Type.String(),
        state: Type.String(),
        cidrBlock: Type.String(),
        tags: Type.Any(),
        isDefault: Type.String(),
        subnets: Type.Array(Type.Object({
            id: Type.String(),
            state: Type.String(),
            vpcId: Type.String(),
            cidrBlock: Type.String(),
            availabilityZone: Type.String(),
            availableIps: Type.String(),
            tags: Type.Any()
        })),
        securityGroups: Type.Array(Type.Object({
            id: Type.String(),
            description: Type.String(),
            vpcId: Type.String(),
            ipPermissions: Type.Any()
        }))
    })),
});

export type VpcResponseType = Static<typeof VpcListResponse>;

export { VpcListResponse };