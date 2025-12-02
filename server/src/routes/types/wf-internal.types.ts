import { Type } from '@fastify/type-provider-typebox';
import { AWS_REGION_KEYS } from '../../utils/consts';

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

const HomepageStatusQueryParams = Type.Object({
    credentialsIds: Type.Optional(Type.String()),
    regions: Type.Optional(
        Type.String({ pattern: `^(${AWS_REGION_KEYS.join('|')})(\\s*,\\s*(${AWS_REGION_KEYS.join('|')}))*$` })
    ),
    limit: Type.Optional(Type.Number())
});

const HomepageFocusStatusResponse = Type.Object({
    items: Type.Array(
        Type.Optional(
            Type.Object({
                description: Type.String()
            })
        )
    ),
    severity: Type.String({ enum: ['high', 'low'] }),
    totalItems: Type.Number()
});

const dataItem = Type.Object({
    value: Type.Number(),
    id: Type.String({ enum: ['mssql', 'oracle', 'pgsql'] })
});

const HomepageWidgetStatusResponse = Type.Object({
    items: Type.Array(
        Type.Object({
            data: Type.Union([Type.Number(), Type.Array(dataItem)]),
            id: Type.String({ enum: ['savings-opportunities', 'bar-chart'] })
        })
    )
});

export {
    StatusParams,
    StatusResponse,
    VolumeObject,
    ListVolumesResponse,
    ListVolumesQueryParams,
    HomepageStatusQueryParams,
    HomepageFocusStatusResponse,
    HomepageWidgetStatusResponse
};
