import { Type } from '@sinclair/typebox';

const HealthResponse = Type.String();

const AboutResponse = Type.Object({
    version: Type.String(),
    nodeVersion: Type.String(),
    mode: Type.Optional(Type.String()),
    build: Type.Optional(Type.String()),
    git: Type.Optional(Type.String())
});

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

export {
    HealthResponse, AboutResponse, VpcListResponse
}