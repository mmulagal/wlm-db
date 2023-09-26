import { Static, Type } from '@fastify/type-provider-typebox';
import { STANDALONE, FCI, SINGLE_AZ, MULTI_AZ } from '../../utils/consts';

const PricingServiceRequest = Type.Object({
    compute: Type.Object({
        regionCode: Type.String(),
        instanceType: Type.String(),
        sqlSoftwareType: Type.String(),
        sqlDeploymentMode: Type.String({ enum: [FCI, STANDALONE] })
    }),
    storage: Type.Optional(
        Type.Object({
            regionCode: Type.String(),
            diskSize: Type.Number({ description: 'Size is in GiB' }),
            throughput: Type.Optional(Type.Number({ description: 'Throughput is in MBps' })),
            iops: Type.Optional(Type.Number()),
            deploymentOption: Type.Optional(Type.String({ enum: [SINGLE_AZ, MULTI_AZ] }))
        })
    ),
    vpc: Type.Optional(
        Type.Object({
            regionCode: Type.String()
        })
    )
});

const PricingServiceResponse = Type.Object({
    storage: Type.Object({
        capacity: Type.Number(),
        throughput: Type.Number()
    }),
    compute: Type.Number(),
    vpc: Type.Optional(Type.Number()),
    total: Type.Number()
});

type PricingServiceRequestType = Static<typeof PricingServiceRequest>;
type PricingServiceResponseType = Static<typeof PricingServiceResponse>;

export { PricingServiceRequest, PricingServiceResponse, PricingServiceRequestType, PricingServiceResponseType };
