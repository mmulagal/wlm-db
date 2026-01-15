import { Static, Type } from '@fastify/type-provider-typebox';
import { CredentialsIdParams } from './generic.types';
import { API_DESCRIPTION, API_DESCRIPTION_EXAMPLES } from '../../utils/schema-description-consts';

const FileSystemsCredentialsStatusRequestQuery = Type.Object({
    fsxids: Type.String()
});

const FileSystemCredentialsStatusResponse = Type.Object({
    id: Type.String(),
    isRegistered: Type.Boolean()
});

const FileSystemCredentialsStatusParams = Type.Intersect([
    CredentialsIdParams,
    Type.Object({ fileSystemId: Type.String({ minLength: 1 }) })
]);

const FileSystemsCredentialsStatusResponse = Type.Object({
    fileSystems: Type.Array(FileSystemCredentialsStatusResponse)
});

const ManageResourcesQueryString = Type.Object({
    credentialsIds: Type.Optional(
        Type.String({
            description: API_DESCRIPTION.CREDENTIALS_ID_DESC,
            examples: API_DESCRIPTION_EXAMPLES.CREDENTIALS_ID_EX
        })
    ),
    regions: Type.Optional(Type.String()),
    databaseTypes: Type.Optional(Type.String()),
    nextToken: Type.Optional(Type.String()),
    pageSize: Type.Optional(Type.Number())
});

const ManageResourcesResponse = Type.Object({
    count: Type.Number(),
    items: Type.Array(
        Type.Object({
            instances: Type.Array(Type.String()),
            resourceId: Type.String(),
            credentialId: Type.String(),
            region: Type.String(),
            databaseType: Type.String()
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
