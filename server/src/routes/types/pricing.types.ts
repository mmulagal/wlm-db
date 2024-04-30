import { Static, Type } from '@fastify/type-provider-typebox';
import { STANDALONE, FCI, SINGLE_AZ, MULTI_AZ, SQL_STD, SQL_ENT, SQL_WEB, NONE } from '../../utils/consts';

const PricingServiceRequest = Type.Object({
    compute: Type.Object({
        regionCode: Type.String({ minLength: 1 }),
        instanceType: Type.String({ minLength: 1 }),
        sqlSoftwareType: Type.String({ enum: [SQL_STD, SQL_ENT, SQL_WEB, NONE] }),
        sqlDeploymentMode: Type.String({ enum: [FCI, STANDALONE] })
    }),
    fsxnStorage: Type.Optional(
        Type.Object({
            regionCode: Type.String({ minLength: 1 }),
            diskSize: Type.Number({ description: 'Database "data" volume size in GiB' }),
            throughput: Type.Optional(Type.Number({ description: 'Throughput is in MBps' })),
            iops: Type.Optional(Type.Number()),
            deploymentOption: Type.Optional(Type.String({ enum: [SINGLE_AZ, MULTI_AZ] })),
            storageCapacity: Type.Optional(
                Type.Number({
                    description:
                        'The total FSxN storage capacity in GB. "storageCapacity" and "diskSize" are mutually exclusive'
                })
            )
        })
    ),
    ebsStorage: Type.Optional(
        Type.Object({
            regionCode: Type.String({ minLength: 1 }),
            size: Type.Number({ description: 'Volume size in GiB' }),
            throughput: Type.Optional(Type.Number({ description: 'Throughput is in MBps' })),
            iops: Type.Optional(Type.Number()),
            volumeType: Type.String(Type.String({ enum: ['gp2', 'io1', 'st1', 'sc1', 'gp3', 'io2'] }))
        })
    ),
    vpc: Type.Optional(
        Type.Object({
            regionCode: Type.String({ minLength: 1 })
        })
    ),
    fsxwStorage: Type.Optional(
        Type.Object({
            regionCode: Type.String({ minLength: 1 }),
            diskSize: Type.Number({ description: 'Database "data" volume size in GiB' }),
            throughput: Type.Number({ description: 'Throughput is in MBps' }),
            iops: Type.Number(),
            deploymentOption: Type.String({ enum: ['Single-AZ', 'Multi-AZ'] }),
            storageCapacity: Type.Number({
                description:
                    'The total FSxN storage capacity in GB. "storageCapacity" and "diskSize" are mutually exclusive'
            }),
            storageType: Type.String({ enum: ['HDD', 'SSD'] })
        })
    )
});

const PricingServiceResponse = Type.Object({
    compute: Type.Number(),
    fsxnStorage: Type.Optional(
        Type.Object({
            capacityCost: Type.Number(),
            operationalCost: Type.Number(),
            size: Type.Optional(
                Type.Object(
                    {
                        data: Type.Number(),
                        log: Type.Number(),
                        tempdb: Type.Number(),
                        quorum: Type.Optional(Type.Number()),
                        buffer: Type.Optional(Type.Number()),
                        total: Type.Number()
                    },
                    {
                        description: 'All the sizes are in GiB'
                    }
                )
            )
        })
    ),
    vpc: Type.Optional(Type.Number()),
    ebsStorage: Type.Optional(
        Type.Object({
            ebsStorageCost: Type.Number(),
            size: Type.Number()
        })
    ),
    fsxwStorage: Type.Optional(
        Type.Object({
            capacityCost: Type.Number(),
            operationalCost: Type.Number(),
            size: Type.Number()
        })
    ),
    total: Type.Number()
});

type PricingServiceRequestType = Static<typeof PricingServiceRequest>;
type PricingServiceResponseType = Static<typeof PricingServiceResponse>;

export { PricingServiceRequest, PricingServiceResponse, PricingServiceRequestType, PricingServiceResponseType };
