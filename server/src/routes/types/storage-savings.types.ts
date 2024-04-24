import { Static, Type } from '@fastify/type-provider-typebox';
import { CredentialsIdParams } from './generic.types';

const StorageSavingsRequestParams = Type.Composite([
    CredentialsIdParams,
    Type.Object({
        instanceId: Type.String()
    })
]);

const StorageSavingsRequestBody = Type.Object({
    snapshotFrequency: Type.String(),
    clonedCopiesCount: Type.Number(),
    cloneRefreshFrequency: Type.String(),
    monthlyChangeRatePercentage: Type.Number()
});

const StorageMetrics = Type.Object({
    capacity: Type.Number(),
    iops: Type.Number(),
    throughput: Type.Number(),
    snapshots: Type.Number(),
    total: Type.Number()
});

const SizeUnitObject = Type.Object({
    size: Type.Number(),
    unit: Type.String()
});
const StorageSavingsResponse = Type.Object({
    ebs: StorageMetrics,
    fsx: StorageMetrics,
    fsxCalculation: Type.Object({
        deploymentType: Type.String(),
        numberOfVolumes: Type.Number(),
        throughput: Type.Number(),
        totalStorageCapacity: SizeUnitObject,
        percentageSsd: Type.Number(),
        savings: Type.Number(),
        effectiveCapacity: SizeUnitObject,
        ssdTierReqCapacity: SizeUnitObject,
        capacityPoolTier: SizeUnitObject,
        ssdIop: Type.Number(),
        throughputCapacity: Type.Number(),
        useCase: Type.String(),
        regionName: Type.String(),
        monthlySnapshotCapacity: SizeUnitObject
    })
});

type StorageSavingsResponseType = Static<typeof StorageSavingsResponse>;
type StorageSavingsRequestBodyType = Static<typeof StorageSavingsRequestBody>;
export {
    StorageSavingsRequestParams,
    StorageSavingsRequestBody,
    StorageSavingsRequestBodyType,
    StorageSavingsResponse,
    StorageSavingsResponseType
};
