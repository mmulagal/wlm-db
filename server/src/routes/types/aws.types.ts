import { Static, Type } from '@sinclair/typebox';

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

const AdsResponse = Type.Object({
    directories: Type.Array(Type.Object({
        directoryId: Type.Optional(Type.String()),
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

const AdsParams = Type.Object({
    accountId: Type.String(),
    credentialsId: Type.String(),
    region: Type.String(),
    vpcId: Type.String(),
});

type VpcResponseType = Static<typeof VpcListResponse>;
type AwsParamType = Static<typeof AwsParam>;
type AwsQueryStringType = Static<typeof AwsQueryString>;
type AdsResponseType = Static<typeof AdsResponse>;
type AdsParamsType = Static<typeof AdsParams>;

export { VpcResponseType, AwsParamType, AwsQueryStringType, AwsQueryString, AwsParam, VpcListResponse, 
    AdsResponse, AdsParams, AdsResponseType, AdsParamsType };
