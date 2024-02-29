import { Static, Type } from '@fastify/type-provider-typebox';
import { CredentialsIdParams } from './generic.types';

const FileSystemsCredentialsStatusRequestQuery = Type.Object({
    fsxids: Type.String()
});

const FileSystemCredentialsStatusResponse = Type.Object({
    id: Type.String(),
    isRegistered: Type.Boolean()
});

const FileSystemCredentialsStatusParams = Type.Composite([
    CredentialsIdParams,
    Type.Object({ fileSystemId: Type.String({ minLength: 1 }) })
]);

const FileSystemsCredentialsStatusResponse = Type.Object({
    fileSystems: Type.Array(FileSystemCredentialsStatusResponse)
});

const ManageResourcesQueryString = Type.Object({
    nextToken: Type.Optional(Type.String()),
    pageSize: Type.Optional(Type.Number())
});

const ManageResourcesResponse = Type.Object({
    count: Type.Number(),
    items: Type.Array(
        Type.Object({
            instances: Type.Array(Type.String()),
            resourceId: Type.String()
        })
    ),
    nextToken: Type.Optional(Type.String())
});

type ManageResourcesResponseType = Static<typeof ManageResourcesResponse>;

export {
    FileSystemsCredentialsStatusRequestQuery,
    FileSystemsCredentialsStatusResponse,
    FileSystemCredentialsStatusResponse,
    FileSystemCredentialsStatusParams,
    ManageResourcesQueryString,
    ManageResourcesResponse,
    ManageResourcesResponseType
};
