import { resource } from '@prisma/client';
import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import { listResources } from '../lib/database/db';
import {
    DatabaseHostSummaryResponseType,
    DatabaseHostSummaryListResponseType,
    PerformanceResponseType,
    TopologyResponseType
} from '../routes/types/database-hosts.types';
import {
    DatabaseHostsQueryFields,
    FileSystemTypes,
    HttpErrorCodes,
    RESOURCESTYPE,
    ServerState,
    SERVER_TYPE_MAPPING,
    SqlServerDeploymentModel
} from '../utils/consts';
import getLogger from '../utils/logger';
import { getServerIOLatency, getServerState } from './workloads/mssql/mssql-operations';

const logger = getLogger();

async function getTopology(
    accountId: string,
    region: string,
    resourceId: string,
    resourceData: resource
): Promise<TopologyResponseType> {
    logger.info('Fetching topology data', accountId, region, resourceId, resourceData);

    if (isEmpty(resourceData)) {
        throw createError(
            HttpErrorCodes.NOT_FOUND,
            `No data found for resource ${resourceId} in account ${accountId}.`
        );
    }

    const { resource_type: resourceType, co_relation_id: fileSystemId, metadata } = resourceData;

    let topologyData: TopologyResponseType = {
        region,
        serverType: resourceType,
        serverInstallationMode: '',
        fileSystemId: fileSystemId!,
        fileSystemType: '',
        ec2Details: []
    };

    let activeNodeInstanceId: string;
    let standbyNodeInstanceId;
    let activeNodeInstanceName: string;
    let standbyNodeInstanceName;
    let sqlDeploymentType;
    let fileSystemType;
    if (!isEmpty(metadata)) {
        ({
            activeNodeInstanceId,
            activeNodeInstanceName,
            standbyNodeInstanceId,
            standbyNodeInstanceName,
            sqlDeploymentType,
            fileSystemType
        } = metadata as {
            activeNodeInstanceId: string;
            activeNodeInstanceName: string;
            standbyNodeInstanceId?: string;
            standbyNodeInstanceName?: string;
            sqlDeploymentType?: string;
            fileSystemType?: string;
            fsxId: string;
        });

        // Fetch topology data
        topologyData = {
            region,
            serverType: SERVER_TYPE_MAPPING.get(resourceType)!,
            serverInstallationMode:
                sqlDeploymentType !== undefined
                    ? sqlDeploymentType
                    : standbyNodeInstanceId
                    ? SqlServerDeploymentModel.SQL_FCI_SHORT
                    : SqlServerDeploymentModel.SQL_STANDALONE_SHORT,
            fileSystemType:
                fileSystemType !== undefined
                    ? fileSystemType
                    : fileSystemId
                    ? FileSystemTypes.FSXONTAP
                    : FileSystemTypes.EBS,
            fileSystemId: fileSystemId!,
            ec2Details: [{ id: activeNodeInstanceId!, name: activeNodeInstanceName!, ebsVolumeId: '' }]
        };
        if (standbyNodeInstanceId) {
            topologyData.ec2Details.push({
                id: standbyNodeInstanceId!,
                name: standbyNodeInstanceName!,
                ebsVolumeId: ''
            });
        }
    }
    return topologyData;
}

async function getDatabaseHostsSummary(
    accountId: string,
    fields?: string
): Promise<DatabaseHostSummaryListResponseType> {
    logger.info('Fetching all database hosts deployed in account ', accountId, fields);

    const resourceDetails = await listResources(accountId);

    if (isEmpty(resourceDetails)) {
        throw createError(HttpErrorCodes.NOT_FOUND, `No database hosts found for account ${accountId}.`);
    }

    let fieldsValues: Array<string> = [];

    if (fields) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    }

    const databaseHosts: DatabaseHostSummaryResponseType[] = [];
    try {
        await Promise.all(
            resourceDetails
                .filter(resourceDetail => resourceDetail.resource_type !== RESOURCESTYPE.FSX)
                .map(async resourceDetail => {
                    const { resource_id: resourceId, resource_name: resourceName, region } = resourceDetail;

                    // Fetch server status
                    let serverStatus = 'N/A';
                    try {
                        serverStatus = await getServerState(resourceId);
                        serverStatus = serverStatus.toLowerCase() === 'running' ? ServerState.UP : ServerState.DOWN;
                    } catch (error) {
                        logger.error('Error while fetching status for resource ', accountId, resourceId, error);
                    }

                    // Fetch topology data
                    let topologyData: TopologyResponseType;
                    try {
                        topologyData = await getTopology(accountId, region!, resourceId, resourceDetail);
                    } catch (error) {
                        logger.error('Error while fetching topology data for resource ', accountId, resourceId, error);
                    }

                    // Fetch io latency data
                    let performanceData: PerformanceResponseType;
                    if (fieldsValues?.includes(DatabaseHostsQueryFields.PERFORMANCE)) {
                        try {
                            performanceData = await getServerIOLatency(resourceId);
                        } catch (error) {
                            logger.error('Error while fetching io latency for resource ', accountId, resourceId, error);
                        }
                    }

                    databaseHosts.push({
                        id: resourceId,
                        name: resourceName || '',
                        status: serverStatus,
                        topology: topologyData!,
                        performance: performanceData!
                    });
                })
        );
    } catch (error) {
        logger.error(`Error while fetching database hosts details ${accountId}, ${error}`);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Error while fetching database hosts details ${accountId}, ${error}`
        );
    }

    logger.debug('Database hosts details', databaseHosts);

    return { count: databaseHosts.length, items: databaseHosts, nextToken: '' };
}

export default getDatabaseHostsSummary;
