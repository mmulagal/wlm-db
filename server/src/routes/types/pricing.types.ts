import { Static, Type } from '@fastify/type-provider-typebox';
import {
    STANDALONE,
    FCI,
    SINGLE_AZ,
    MULTI_AZ,
    SQL_STD,
    SQL_ENT,
    SQL_WEB,
    CUSTOM,
    EBS_ROOT_VOLUME,
    DatabaseTypes,
    HA
} from '../../utils/consts';

const PricingServiceRequest = Type.Object({
    compute: Type.Object({
        regionCode: Type.String({ minLength: 1 }),
        instanceType: Type.String({ minLength: 1 }),
        sqlSoftwareType: Type.String({ enum: [SQL_STD, SQL_ENT, SQL_WEB, CUSTOM] }),
        sqlDeploymentMode: Type.String({ enum: [FCI, STANDALONE, HA] })
    }),
    fsxnStorage: Type.Optional(
        Type.Object({
            regionCode: Type.String({ minLength: 1 }),
            fsxnResourceInfo: Type.Array(
                Type.Object({
                    id: Type.Optional(Type.String({ description: 'Unique identifier for the FSx filesystem' })),
                    diskSize: Type.Optional(Type.Number({ description: 'Database "data" volume size in GiB' })),
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
            )
        })
    ),
    ebsStorage: Type.Optional(
        Type.Object({
            regionCode: Type.String({ minLength: 1 }),
            ebsResourceInfo: Type.Array(
                Type.Object({
                    id: Type.String({ description: 'Unique identifier for the EBS volume', default: EBS_ROOT_VOLUME }),
                    size: Type.Number({ description: 'Volume size in GiB' }),
                    throughput: Type.Optional(Type.Number({ description: 'Throughput is in MBps' })),
                    iops: Type.Optional(Type.Number()),
                    volumeType: Type.String({ enum: ['gp2', 'io1', 'st1', 'sc1', 'gp3', 'io2'], default: 'gp3' })
                })
            )
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
            fsxwResourceInfo: Type.Array(
                Type.Object({
                    id: Type.String({ description: 'Unique identifier for the FSx filesystem' }),
                    diskSize: Type.Optional(Type.Number({ description: 'Database "data" volume size in GiB' })),
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
        })
    ),
    osType: Type.Optional(Type.String({ enum: ['windows', 'linux'] })),
    databaseType: Type.Optional(Type.String({ enum: [DatabaseTypes.MS_SQL_SERVER, DatabaseTypes.PG_SQL] }))
});

const FsxnCostBreakdown = Type.Object({
    id: Type.Optional(Type.String()),
    capacityCost: Type.Number(),
    operationalCost: Type.Number(),
    size: Type.Optional(
        Type.Object({
            data: Type.Optional(Type.Number()),
            dataReplica: Type.Optional(Type.Number()),
            log: Type.Optional(Type.Number()),
            logReplica: Type.Optional(Type.Number()),
            tempdb: Type.Optional(Type.Number()),
            quorum: Type.Optional(Type.Number()),
            buffer: Type.Optional(Type.Number()),
            total: Type.Number()
        })
    )
});

const FsxwCostBreakdown = Type.Object({
    id: Type.String(),
    capacityCost: Type.Number(),
    operationalCost: Type.Number(),
    size: Type.Number()
});
const PricingServiceResponse = Type.Object({
    compute: Type.Number(),
    fsxnStorage: Type.Optional(
        Type.Object({
            fsxStorageCost: Type.Number(),
            fsxnCostBreakdownById: Type.Array(FsxnCostBreakdown)
        })
    ),
    vpc: Type.Optional(Type.Number()),
    ebsStorage: Type.Optional(
        Type.Object({
            ebsStorageCost: Type.Number(),
            ebsBreakdownByVolumeType: Type.Array(
                Type.Object({
                    id: Type.String(),
                    volumeType: Type.String(),
                    cost: Type.Number(),
                    size: Type.Number(),
                    iops: Type.Optional(Type.Number()),
                    throughput: Type.Optional(Type.Number())
                })
            )
        })
    ),
    fsxwStorage: Type.Optional(
        Type.Object({
            fsxwStorageCost: Type.Number(),
            fsxwCostBreakdownById: Type.Array(FsxwCostBreakdown)
        })
    ),
    total: Type.Number()
});

type FsxnCostBreakdownType = Static<typeof FsxnCostBreakdown>;
type FsxwCostBreakdownType = Static<typeof FsxwCostBreakdown>;
type PricingServiceRequestType = Static<typeof PricingServiceRequest>;
type PricingServiceResponseType = Static<typeof PricingServiceResponse>;

export {
    PricingServiceRequest,
    PricingServiceResponse,
    PricingServiceRequestType,
    PricingServiceResponseType,
    FsxnCostBreakdownType,
    FsxwCostBreakdownType
};
