import { Static, Type } from '@sinclair/typebox';

export const AdsResponse = Type.Object({
    directories: Type.Array(Type.Object({
        directoryId: Type.String(),
        dnsIpAddress: Type.Optional(Type.Array(Type.String())),
        launchTime: Type.Optional(Type.Date()),
        domainName: Type.Optional(Type.String()),
        shortName: Type.Optional(Type.String()),
        ssoEnabled: Type.Optional(Type.Boolean()),
        status: Type.Optional(Type.String()),
        type: Type.Optional(Type.String()),
        vpcSettings: Type.Optional(Type.Object({
            vpcId: Type.Optional(Type.String()),
            subnetIds: Type.Optional(Type.Array(Type.String())),
            availabilityZones: Type.Optional(Type.Array(Type.String())),
        }))
    })),
});

export const AdsParams = Type.Object({
    accountId: Type.String(),
    credentialsId: Type.String(),
    region: Type.String(),
    vpcId: Type.String(),
});

export type AdsResponseType = Static<typeof AdsResponse>;
export type AdsParamsType = Static<typeof AdsParams>;
