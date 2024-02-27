import { compact, isEmpty } from 'lodash-es';
import createError from 'http-errors';
import throat from 'throat';
import { HttpErrorCodes, RESOURCESTYPE } from '../utils/consts';
import { listFsxOntapCredentials } from '../lib/cloud-manager/fsx-core';
import getLogger from '../utils/logger';
import { ManageResourcesResponseType } from '../routes/types/resource.types';
import { getResources } from './database/database-operations';
import { Metadata } from '../utils/common-types';

const logger = getLogger();

async function getFileSystemCredentialsStatus(accountId: string, fsxId: string) {
    logger.info('Getting single file system Credentials Status', { accountId, fsxId });

    const fsxObject = {
        id: fsxId,
        isRegistered: false
    };

    try {
        const { credentials } = await listFsxOntapCredentials(accountId, fsxId);

        fsxObject.isRegistered = !isEmpty(credentials);

        return fsxObject;
    } catch (error) {
        const { statusCode } = error as unknown as { [key: string]: string };

        if (Number(statusCode) === 404) {
            return fsxObject;
        }

        const errorMessage = 'Error getting file system credentials status';
        logger.error(errorMessage);
        throw createError(Number(statusCode) || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
}

async function getFileSystemsCredentialsStatus(accountId: string, fsxids: string) {
    logger.info('Getting file systems Credentials Status', { accountId, fsxids });

    const fsxIds = fsxids.split(',');

    const fileSystems = await Promise.all(
        fsxIds.map(throat(10, (fsxId: string) => getFileSystemCredentialsStatus(accountId, fsxId)))
    );

    return { fileSystems };
}

async function getManagedResources(
    accountId: string,
    credentialsId: string,
    region: string,
    pageSize?: number,
    clientNextToken?: string
): Promise<ManageResourcesResponseType> {
    logger.info('Fetching managed resources for account', {
        accountId,
        credentialsId,
        region,
        pageSize,
        clientNextToken
    });

    const { items, nextToken, count } = await getResources(
        accountId,
        undefined,
        credentialsId,
        region,
        RESOURCESTYPE.MSSQL,
        pageSize,
        clientNextToken
    );

    return {
        items: items.map(({ resource_id: resourceId, metadata }) => ({
            resourceId,
            instances: compact([
                (metadata as unknown as Metadata)?.node1InstanceId,
                (metadata as unknown as Metadata)?.node2InstanceId
            ])
        })),
        count,
        nextToken
    };
}

export { getFileSystemsCredentialsStatus, getFileSystemCredentialsStatus, getManagedResources };
