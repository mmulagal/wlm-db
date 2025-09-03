import { Type } from '@fastify/type-provider-typebox';

const StatusParams = Type.Object({
    accountId: Type.String({ minLength: 1 })
});

const StatusResponse = Type.Object({
    isActive: Type.Boolean()
});

const VolumeObject = Type.Object({
    id: Type.String(),
    name: Type.String(),
    fsxId: Type.String(),
    ontapUuid: Type.Optional(Type.String())
});

const ListVolumesResponse = Type.Object({
    volumeCount: Type.Number(),
    nextToken: Type.Optional(Type.String()),
    volumes: Type.Array(VolumeObject)
});

const ListVolumesQueryParams = Type.Object({
    nextToken: Type.Optional(Type.String()),
    instancePagesize: Type.Optional(Type.Number()),
    fsxId: Type.Optional(Type.String())
});

export { StatusParams, StatusResponse, VolumeObject, ListVolumesResponse, ListVolumesQueryParams };
