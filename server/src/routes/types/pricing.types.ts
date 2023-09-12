import { Static, Type } from '@fastify/type-provider-typebox';

const PricingServiceRequest = Type.Object({
    compute: Type.Object({
        regionCode: Type.String(),
        instanceType: Type.String(),
        sqlSoftwareType: Type.String()
    }),
    storage: Type.Object({
        regionCode: Type.String(),
        diskSize: Type.String(),
        throughput: Type.Optional(Type.String()),
        iops: Type.Optional(Type.Number()),
        deploymentOption: Type.Optional(Type.String())
    }),
    connectivity: Type.Object({
        createNewVpc: Type.Boolean()
    })
});

const PricingServiceResponse = Type.Object({
    storage: Type.Object({
        storageCapacity: Type.Number(),
        throughput: Type.Number()
    }),
    compute: Type.Number(),
    connectivity: Type.Optional(Type.Number()),
    total: Type.Number()
});

type PricingServiceRequestType = Static<typeof PricingServiceRequest>;
type PricingServiceResponseType = Static<typeof PricingServiceResponse>;

export { PricingServiceRequest, PricingServiceResponse, PricingServiceRequestType, PricingServiceResponseType };
