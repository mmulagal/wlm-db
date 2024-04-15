import { isEmpty } from 'lodash-es';
import getLogger from '../utils/logger';
import { listResources } from '../lib/database/db';
import { API_PAGE_SIZE, DEFAULT_INSTANCE_NAME, NO_SANDBOX_CREATED, RESOURCESTYPE } from '../utils/consts';
import { GET_SANDBOX_DETAILS } from './workloads/mssql/sandbox-scripts';
import { Metadata, ResourceDetails } from '../utils/common-types';
import { getActiveSqlNode } from './workloads/mssql/mssql-operations';
import { callSsmExecution } from './aws/ssm-operations';
import { sqlResponseParsing } from '../utils/utils';
import { SandboxInfoResponseType } from '../routes/types/database-hosts.types';

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
    return source.split('\\');
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
        try {
            const parsedSandboxDetails: {
                database_name: string;
                sandbox_properties: { name: string; value: string }[];
            }[] = sqlResponseParsing(sandboxDetails);

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
        API_PAGE_SIZE,
        nextToken
    );

    if (isEmpty(resourceDetails)) {
        logger.error(`No successfully deployed database hosts found for account ${accountId}.`);
        return { count: 0, items: [], nextToken: '' };
    }

    const filteredResources = resourceDetails.filter((entry: any) => entry.metadata?.sandboxCreated === true);

    try {
        let sandboxes: SandboxInfoResponseType[] = [];

        await Promise.all(
            filteredResources.map(async resourceDetail => {
                const sandboxDetails = await getSandboxDetails(accountId, credentialsId, region, resourceDetail);
                if (sandboxDetails && sandboxDetails.length) {
                    sandboxes = sandboxes.concat(sandboxDetails);
                }
            })
        );

        return {
            count: sandboxes.length,
            items: sandboxes
        };
    } catch (error) {
        const errorMessage = `Error fetching Sandboxes info. ${error}.`;
        logger.error(errorMessage);
    }
}

export { getSandboxesInfo };
