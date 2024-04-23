import { Static, Type } from '@fastify/type-provider-typebox';
import { CredentialsIdParams } from './generic.types';

const StorageSavingsRequestParams = Type.Composite([
    CredentialsIdParams,
    Type.Object({
        instanceId: Type.String()
    })
]);

const StorageMetrics = Type.Object({
    capacity: Type.Number(),
    iops: Type.Number(),
    throughput: Type.Number(),
    snapshots: Type.Number(),
    total: Type.Number()
});
const StorageSavingsResponse = Type.Object({
    ebs: StorageMetrics,

    fsx: StorageMetrics
});

type StorageSavingsResponseType = Static<typeof StorageSavingsResponse>;

export { StorageSavingsRequestParams, StorageSavingsResponse, StorageSavingsResponseType };
