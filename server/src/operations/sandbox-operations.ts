import { ConnectionStatus } from '@aws-sdk/client-ssm';
import throat from 'throat';
import { groupBy, isEmpty } from 'lodash-es';
import createError from 'http-errors';
import getLogger from '../utils/logger';
import { listResources, updateResourceMetaData } from '../lib/database/db';
import {
    DEFAULT_INSTANCE_NAME,
    HttpErrorCodes,
    NO_SANDBOX_CREATED,
    RESOURCESTYPE,
    SANDBOX_API_SIZE
} from '../utils/consts';
import { GET_SANDBOX_DETAILS } from './workloads/mssql/sandbox-scripts';
import { Metadata, ResourceDetails } from '../utils/common-types';
import { getActiveSqlNode } from './workloads/mssql/mssql-operations';
import { callSsmExecution, getSSMConnectionStatus } from './aws/ssm-operations';
import { sqlResponseParsing } from '../utils/utils';
import { SandboxInfoResponseType } from '../routes/types/database-hosts.types';
import { restGetUtilForOntap } from './workloads/mssql/ssm-script-utils';
import { getResources } from './database/database-operations';

const logger = getLogger();

interface SandboxObject {
    sandbox_properties: { name: string; value: string }[];
}

function getProperty(item: SandboxObject, propertyName: string) {
    const property = item.sandbox_properties.find((prop: { name: string }) => prop.name === propertyName);
    return property ? property.value : 'N/A';
}

function getSourceDetails(obj: SandboxObject) {
    const source = getProperty(obj, 'source');
    return source.split('|');
}

async function getSandboxDetails(
    accountId: string,
    credentialsId: string,
    region: string,
    resourceDetails: ResourceDetails
) {
    logger.info('Get sandbox details of host:', resourceDetails.resource_id, accountId, credentialsId, region);
    const { metadata, resource_id: resourceId } = resourceDetails;
    const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;

    const { isSSMConnected, activeNodeInstanceId } = await getActiveSqlNode(
        credentialsId,
        region!,
        node1InstanceId,
        node2InstanceId,
        resourceId
    );

    const errorResponse = (errorMessage: any) => [
        {
            databaseHostName: resourceDetails.resource_name!,
            databaseHostId: resourceDetails.resource_id!,
            databaseInstanceName: DEFAULT_INSTANCE_NAME,
            error: errorMessage
        }
    ];

    if (!isSSMConnected && activeNodeInstanceId === undefined) {
        const errorMessage = `Unable to get sandbox details for host ${resourceDetails.resource_id} in account ${accountId} due to SSM connection issues.`;
        logger.error(errorMessage);
        return errorResponse(errorMessage);
    }

    const command = [GET_SANDBOX_DETAILS(['"."'])];
    const response = await callSsmExecution(credentialsId, region, command, activeNodeInstanceId!);
    if (response) {
        let parsedResponse;
        try {
            parsedResponse = sqlResponseParsing(response);
        } catch (error) {
            return errorResponse(error);
        }
        if (parsedResponse?.Error) {
            const errorMessage = `Error fetching sandbox details for host: ${resourceId},${parsedResponse.Instance},${accountId}${parsedResponse?.Error}.`;
            logger.error(errorMessage);
            return errorResponse(errorMessage);
        }
        const sandboxDetails = parsedResponse.Output;

        if (sandboxDetails === NO_SANDBOX_CREATED) {
            const errorMessage = `No sandboxes created for the instance:${parsedResponse.Instance} ,${resourceId},${accountId}.`;
            logger.error(errorMessage);
            return errorResponse(errorMessage);
        }

        const finalSandboxDetails: string = Array.isArray(sandboxDetails) ? sandboxDetails.join('') : sandboxDetails;

        try {
            const parsedSandboxDetails: {
                database_name: string;
                sandbox_properties: { name: string; value: string }[];
            }[] = sqlResponseParsing(finalSandboxDetails);

            const sandboxInfo: SandboxInfoResponseType[] = [];

            parsedSandboxDetails.forEach(item => {
                const sources = getSourceDetails(item);

                const databaseObject = {
                    sandboxName: item.database_name,
                    databaseHostName: resourceDetails.resource_name!,
                    databaseHostId: resourceDetails.resource_id!,
                    databaseInstanceName: DEFAULT_INSTANCE_NAME,
                    sourceDatabaseHostName: sources[0],
                    sourceDatabaseInstanceName: sources[1],
                    sourceDatabaseName: sources[2],
                    creationTime: getProperty(item, 'initialCreationDate'),
                    tag: getProperty(item, 'tag')
                };

                sandboxInfo.push(databaseObject);
            });

            return sandboxInfo;
        } catch (error) {
            return errorResponse(error);
        }
    }
}

async function getSandboxesInfo(accountId: string, credentialsId: string, region: string, nextToken?: string) {
    logger.info('Get Sandboxes Info', accountId, credentialsId, region, nextToken);
    const resourceDetails = await listResources(
        accountId,
        undefined,
        credentialsId,
        region,
        RESOURCESTYPE.MSSQL,
        undefined,
        process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator' ? undefined : { sandboxCreated: true },
        SANDBOX_API_SIZE,
        nextToken
    );

    if (isEmpty(resourceDetails)) {
        logger.error(`No successfully deployed database hosts found for account ${accountId}.`);
        return { count: 0, items: [], nextToken: '' };
    }

    try {
        let sandboxes: SandboxInfoResponseType[] = [];

        await Promise.all(
            resourceDetails.map(async resourceDetail => {
                const sandboxDetails = await getSandboxDetails(accountId, credentialsId, region, resourceDetail);
                if (sandboxDetails && sandboxDetails.length) {
                    sandboxes = sandboxes.concat(sandboxDetails);
                }
            })
        );

        return {
            count: sandboxes.length,
            items: sandboxes,
            nextToken:
                resourceDetails?.length === SANDBOX_API_SIZE
                    ? resourceDetails[resourceDetails.length - 1].id
                    : undefined
        };
    } catch (error) {
        const errorMessage = `Error fetching Sandboxes info. ${error}.`;
        logger.error(errorMessage);
    }
}

async function getSandboxSavings(accountId: string, credentialsId: string, region: string) {
    try {
        logger.info('Get sandbox savings', { accountId, credentialsId, region });

        const savingsData = {
            consumedStorage: 0,
            savedStorage: 0,
            sandboxSavingsPercentage: 0
        };

        const resourceDetails = await listResources(
            accountId,
            undefined,
            credentialsId,
            region,
            RESOURCESTYPE.MSSQL,
            undefined,
            process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator'
                ? undefined
                : {
                      sandboxCreated: true
                  }
        );

        if (isEmpty(resourceDetails)) {
            logger.error(`No successfully deployed database hosts found for account ${accountId}.`);
            return savingsData;
        }

        const fsxGroups = groupBy(resourceDetails, 'co_relation_id'); // { fsxId: Array<resource> }

        await Promise.all(
            Object.keys(fsxGroups).map(
                throat(10, async fsxId => {
                    for (const resourceDetail of fsxGroups[fsxId]) {
                        const { metadata } = resourceDetail;
                        const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;

                        try {
                            const [ssmStatus1, ssmStatus2] = await Promise.all([
                                getSSMConnectionStatus(credentialsId, region, node1InstanceId),
                                node2InstanceId
                                    ? getSSMConnectionStatus(credentialsId, region, node1InstanceId)
                                    : Promise.resolve({ Status: ConnectionStatus.NOT_CONNECTED })
                            ]);

                            if (
                                ssmStatus1.Status === ConnectionStatus.CONNECTED ||
                                ssmStatus2.Status === ConnectionStatus.CONNECTED
                            ) {
                                // DEMO FSX ID AND REGION
                                if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
                                    fsxId = 'test-fsx';
                                    region = 'us-east-1';
                                }

                                const command = [
                                    restGetUtilForOntap(
                                        fsxId,
                                        region,
                                        '/storage/volumes',
                                        'tiering.object_tags="cloned_by=netapp_wlmdb"',
                                        'fields=space.used_by_afs,space.physical_used,clone.split_estimate'
                                    )
                                ];

                                const response = await callSsmExecution(
                                    credentialsId,
                                    region,
                                    command,
                                    (ssmStatus1.Status === ConnectionStatus.CONNECTED
                                        ? node1InstanceId
                                        : node2InstanceId) as string,
                                    accountId
                                );

                                const cleanResponse = response?.replaceAll('\r\n', '');
                                const jsonResponse = JSON.parse(cleanResponse!);

                                jsonResponse?.records?.forEach(
                                    (record: {
                                        clone?: { split_estimate: number };
                                        space: { physical_used: number; used_by_afs: number };
                                    }) => {
                                        const {
                                            clone: { split_estimate: splitEstimate } = { split_estimate: 0 },
                                            space: { physical_used: physicalUsed }
                                        } = record;
                                        savingsData.consumedStorage += physicalUsed;
                                        savingsData.savedStorage += splitEstimate;
                                        savingsData.sandboxSavingsPercentage =
                                            (savingsData.savedStorage * 100) /
                                            (savingsData.consumedStorage + savingsData.savedStorage);
                                    }
                                );
                                break;
                            }
                        } catch (e) {
                            logger.error(`Falied to fetch storage saving for fsx: ${fsxId}`, e);
                        }
                    }
                })
            )
        );

        return savingsData;
    } catch (e) {
        logger.error('Error while fetching storage savings', e);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Error while fetching storage savings ${accountId}, ${e}`
        );
    }
}

async function updateMetadataForSanboxTesting(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string
) {
    logger.info('Updating metadata for sandbox testing', accountId, credentialsId, region, databaseHostId);
    const {
        items: [resourceDetail]
    } = await getResources(accountId, databaseHostId);

    if (isEmpty(resourceDetail)) {
        const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, `${errorMessage}`);
    }
    const { metadata } = resourceDetail;

    const newMetadata = metadata as unknown as Metadata;

    newMetadata.sandboxCreated = true;
    newMetadata.updatedManually = true;
    try {
        await updateResourceMetaData(accountId, databaseHostId, newMetadata);
        return 'metadata updated succesfully';
    } catch (error) {
        return error;
    }
}

async function revertMetadataForSanboxTesting(accountId: string, credentialsId: string, region: string) {
    const resourceDetails = await listResources(
        accountId,
        undefined,
        credentialsId,
        region,
        RESOURCESTYPE.MSSQL,
        undefined,
        { updatedManually: true }
    );

    if (isEmpty(resourceDetails)) {
        logger.error(`No manually updated resources ${accountId}.`);
        return 'No manually updated resources';
    }

    await Promise.all(
        resourceDetails.map(async resourceDetail => {
            const { resource_id: resourceId, metadata } = resourceDetail;
            const newMetadata = metadata as unknown as Metadata;
            try {
                delete newMetadata.sandboxCreated;
                delete newMetadata.updatedManually;
                await updateResourceMetaData(accountId, resourceId, newMetadata);
            } catch (error) {
                logger.error('Failed to update meatadata', resourceId);
            }
        })
    );

    return 'Revereted manually updated metadatas';
}

export { getSandboxesInfo, getSandboxSavings, updateMetadataForSanboxTesting, revertMetadataForSanboxTesting };
