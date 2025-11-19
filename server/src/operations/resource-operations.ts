import { compact, isEmpty } from 'lodash-es';
import createError from 'http-errors';
import throat from 'throat';
import {
    CURRENT_SCRIPT_VERSION,
    DBCREATE_RELATIVE_PATH,
    DEMO_AWS_ACCOUNT_ID,
    HttpErrorCodes,
    RESOURCE_PREPARE_JOB_TIMEOUT_MINUTES
} from '../utils/consts';
import { IS_DEMO_FLOW, getArtifactsRegionBucketName, retryWithDelay, sqlResponseParsing } from '../utils/utils';
import { listFsxOntapCredentials } from '../lib/cloud-manager/fsx-core';
import getLogger from '../utils/logger';
import { ManageResourcesResponseType } from '../routes/types/resource.types';
import { getResources } from './database/database-operations';
import { Metadata } from '../utils/common-types';
import { COPY_SCRIPTS_TO_MANAGE_RESOURCE } from './workloads/mssql/discover-consts';
import { preSignedUrl } from '../lib/aws/s3';
import { callSsmExecution } from './aws/ssm-operations';
import { CHECK_SCRIPT_AVAILABILITY_AND_VERSION } from './workloads/mssql/ssm-script-utils';
import { createDemoResourcesPerRegion } from '../utils/demo-utils/demoDefaultUtils';

const logger = getLogger();

const { getPreSignedUrl } = preSignedUrl;

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
    } catch (error: any) {
        logger.error('getFileSystemCredentialsStatus: underlying FSx call failed', {
            accountId,
            fsxId,
            errorName: error?.name,
            errorMessage: error?.message,
            errorCode: error?.code,
            statusCode: error?.statusCode
        });
        const { statusCode } = error as unknown as { [key: string]: string };

        if (Number(statusCode) === 404) {
            return fsxObject;
        }

        const errorMessage = `Error getting file system credentials status : ${error.message}`;
        logger.error(errorMessage);
        throw createError(Number(statusCode) || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
}

async function getFileSystemsCredentialsStatus(accountId: string, fsxids: string) {
    logger.info('Getting file systems Credentials Status', { accountId, fsxids });

    const fsxIds = [...new Set(fsxids.split(','))];

    const fileSystems = await Promise.all(
        fsxIds.map(throat(10, (fsxId: string) => getFileSystemCredentialsStatus(accountId, fsxId)))
    );

    return { fileSystems };
}

async function getManagedResources(
    accountId: string,
    credentialsIds?: string,
    regions?: string,
    databaseTypes?: string,
    pageSize?: number,
    clientNextToken?: string
): Promise<ManageResourcesResponseType> {
    logger.info('Fetching managed resources for multiple parameters', {
        accountId,
        credentialsIds,
        regions,
        databaseTypes,
        pageSize,
        clientNextToken
    });

    const credentialIdsList = credentialsIds?.split(',');
    const regionsList = regions?.split(',');
    const databaseTypesList = databaseTypes?.split(',');

    const { items, nextToken, count } = await getResources({
        accountId,
        credentialsId: credentialIdsList,
        region: regionsList,
        resourceType: databaseTypesList,
        pageSize,
        nextToken: clientNextToken
    });

    return {
        items: items.map(
            ({
                resource_id: resourceId,
                credentials_id: credentialId,
                region,
                resource_type: databaseType,
                metadata
            }) => ({
                resourceId,
                instances: compact([
                    (metadata as unknown as Metadata)?.node1InstanceId,
                    (metadata as unknown as Metadata)?.node2InstanceId
                ]),
                credentialId,
                region: region || '',
                databaseType
            })
        ),
        count,
        nextToken
    };
}

async function checkScriptNeedsUpdate(accountId: string, credentialsId: string, region: string, nodeId: string) {
    logger.info('Check script version at database host', { accountId, credentialsId, region, nodeId });
    try {
        const resp = await callSsmExecution({
            credentialsId,
            region,
            commands: [CHECK_SCRIPT_AVAILABILITY_AND_VERSION],
            ec2InstanceId: nodeId,
            comment: 'Get script version',
            accountId
        });
        if (resp) {
            const { scriptVersion } = sqlResponseParsing(resp);
            if (scriptVersion === CURRENT_SCRIPT_VERSION) {
                return false;
            }
        }
        return true;
    } catch (error: any) {
        const errorMessage = `Error checking script version at database host: ${error}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

async function copyScriptsToHost(accountId: string, credentialsId: string, region: string, ec2InstanceId: string) {
    logger.info('Copy scripts to host', { accountId, credentialsId, region, ec2InstanceId });
    const bucketname = getArtifactsRegionBucketName(region);
    const dbcreateS3SignedUrl = await getPreSignedUrl(region, bucketname, DBCREATE_RELATIVE_PATH);

    try {
        // Copy scripts to the EC2 instance
        const ssmScriptsCopyResponse = await retryWithDelay(
            callSsmExecution.bind(null, {
                credentialsId,
                region,
                commands: COPY_SCRIPTS_TO_MANAGE_RESOURCE(dbcreateS3SignedUrl),
                ec2InstanceId,
                comment: 'Copy scripts to host',
                accountId,
                executionTimeout: (RESOURCE_PREPARE_JOB_TIMEOUT_MINUTES * 60).toString()
            })
        );

        logger.info(`Response for copy scripts using PowerShell for ${ec2InstanceId}: ${ssmScriptsCopyResponse}`);

        return ssmScriptsCopyResponse;
    } catch (error) {
        throw createError(`Error copying scripts to host: ${error}`);
    }
}

async function createDemoDataforRegion(accountId: string, credentialsId: string, region: string) {
    logger.info('Creating demo data for region', accountId, credentialsId, region);
    if (IS_DEMO_FLOW) {
        const response = await createDemoResourcesPerRegion(accountId, credentialsId, region, DEMO_AWS_ACCOUNT_ID);
        return response;
    }
    throw createError('API not available in non-demo mode');
}

export {
    getFileSystemsCredentialsStatus,
    getFileSystemCredentialsStatus,
    getManagedResources,
    checkScriptNeedsUpdate,
    copyScriptsToHost,
    createDemoDataforRegion
};
