import { RouteTags } from '../../utils/consts';
import { CredentialsIdParams } from '../types/generic.types';
import {
    FileSystemsCredentialsStatusRequestQuery,
    FileSystemsCredentialsStatusResponse,
    FileSystemCredentialsStatusParams,
    FileSystemCredentialsStatusResponse,
    ManageResourcesQueryString,
    ManageResourcesResponse
} from '../types/resource.types';

const FileSystemsCredentialsStatusSchema = {
    tags: [RouteTags.RESOURCE],
    summary: 'File Systems Credentials Status',
    description:
        'File Systems Credentials Status, specifically whether or not if a FSxN is registered with fsx-core service',
    params: CredentialsIdParams,
    querystring: FileSystemsCredentialsStatusRequestQuery,
    response: {
        200: FileSystemsCredentialsStatusResponse
    }
};

const FileSystemCredentialsStatusSchema = {
    tags: [RouteTags.RESOURCE],
    summary: 'Single File System Credentials Status',
    description:
        'Single File System Credentials Status, specifically whether or not if a FSxN is registered with fsx-core service',
    params: FileSystemCredentialsStatusParams,
    response: {
        200: FileSystemCredentialsStatusResponse
    }
};

const GetManagedResourcesSchema = {
    tags: [RouteTags.RESOURCE],
    params: CredentialsIdParams,
    querystring: ManageResourcesQueryString,
    summary: 'List managed resources',
    description: 'List managed resources for the given account and region',
    response: {
        200: ManageResourcesResponse
    }
};

export { FileSystemsCredentialsStatusSchema, FileSystemCredentialsStatusSchema, GetManagedResourcesSchema };
