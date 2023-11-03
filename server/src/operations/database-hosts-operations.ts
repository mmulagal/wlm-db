import { resource } from '@prisma/client';
import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import { listResources } from '../lib/database/db';
import {
    DatabaseHostSummaryResponseType,
    DatabaseHostSummaryListResponseType,
    PerformanceResponseType,
    TopologyResponseType,
    ProtectionResponseType,
    StorageResponseType
} from '../routes/types/database-hosts.types';
import {
    DatabaseHostsQueryFields,
    HttpErrorCodes,
    RESOURCESTYPE,
    ServerState,
    SERVER_TYPE_MAPPING
} from '../utils/consts';
import getLogger from '../utils/logger';
import {
    getServerIOLatency,
    getServerState,
    getNativeSQLProtection,
    getDatabasesCount
} from './workloads/mssql/mssql-operations';
import {
    getVolumesUuids,
    getStorageDataUsingSSM,
    isAWSBackupEnabled,
    getOntapVolumesSnapshotCount
} from './aws/fsx-operations';

const logger = getLogger();

interface Topology {
    activeNodeInstanceId: string;
    activeNodeInstanceName: string;
    standbyNodeInstanceId?: string;
    standbyNodeInstanceName?: string;
    sqlDeploymentType?: string;
    fileSystemType?: string;
}

interface Metadata {
    credentialsId: string;
    activeNodeInstanceId: string;
    standbyNodeInstanceId: string;
}

type VolumeSpaceRecord = {
    uuid: string;
    name: string;
    efficiency: {
        space_savings: {
            total: number;
            total_percent: number;
        };
    };
    space: {
        size: number;
        used: number;
    };
};

type ResourceDetails = {
    id: string;
    account_id: string;
    resource_id: string;
    resource_name: string | null;
    resource_type: string;
    co_relation_id: string | null;
    cloud_provider_account_id: string | null;
    cloud_provider_name: string | null;
    region: string | null;
    metadata: unknown;
};

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
        } = metadata as unknown as Topology);

        // Fetch topology data
        topologyData = {
            region,
            serverType: SERVER_TYPE_MAPPING.get(resourceType)!,
            serverInstallationMode: sqlDeploymentType !== undefined ? sqlDeploymentType : '',
            fileSystemType: fileSystemType !== undefined ? fileSystemType : '',
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

async function getStorageData(resourceDetail: ResourceDetails): Promise<StorageResponseType> {
    logger.info('Getting storage data:', { resourceDetail });

    const { region, co_relation_id: fileSystemId, metadata } = resourceDetail;

    const { credentialsId, activeNodeInstanceId, standbyNodeInstanceId, fsxSecret } = metadata as {
        credentialsId: string;
        activeNodeInstanceId: string;
        standbyNodeInstanceId: string;
        fsxSecret: string;
    };

    const volumeUuids = await getVolumesUuids(credentialsId, region!, fileSystemId!);
    const volumeUuidList = volumeUuids.join(',');

    // DeploymentID is same as AWS CloudFormation stack name.  We retrieve
    // deploymentID from the fsxSecret, which has an additional '-fsx'
    // suffix to stack name (e.g., WLMDB-SqlFciStack-1698992271319-fsx).
    //     ONTAP tags have '_' instead of '-' in the stack name.  So we
    // tune tag accordingly with replaceAll.
    const deploymentId = fsxSecret.replace('-fsx', '').replaceAll('-', '_');

    const info = await getStorageDataUsingSSM(
        credentialsId,
        region!,
        fileSystemId!,
        fsxSecret,
        'storage/volumes',
        `uuid=${volumeUuidList}&tiering.object_tags='wlmDeploymentId=${deploymentId}'`,
        'fields=efficiency.space_savings.total,efficiency.space_savings.total_percent,space.size,space.used',
        activeNodeInstanceId,
        standbyNodeInstanceId
    );

    let totalSize = 0;
    let totalUsed = 0;
    let totalSpaceSavings = 0;
    let totalSpaceSavingsPercent = 0;
    info?.records?.forEach(({ efficiency, space }: VolumeSpaceRecord) => {
        const { size, used } = space;
        const { total, total_percent: totalPercent } = efficiency.space_savings;

        totalSize += size;
        totalUsed += used;
        totalSpaceSavings += total;
        totalSpaceSavingsPercent += totalPercent;
    });

    return {
        size: totalSize,
        used: totalUsed,
        spaceSavings: totalSpaceSavings,
        spaceSavingsPercent: totalSpaceSavingsPercent
    };
}

async function getProtectionStatus(resourceDetail: ResourceDetails): Promise<ProtectionResponseType | undefined> {
    logger.info('Get protection status', { resourceDetail });

    const { resource_id: resourceId, region, co_relation_id: fileSystemId, metadata } = resourceDetail;

    const { credentialsId, activeNodeInstanceId, standbyNodeInstanceId } = metadata as unknown as Metadata;

    try {
        const [awsBackup, ontapData, nativeSqlProtection] = await Promise.all([
            isAWSBackupEnabled(credentialsId, region!, fileSystemId!),
            getOntapVolumesSnapshotCount(
                credentialsId,
                region!,
                fileSystemId!,
                activeNodeInstanceId,
                standbyNodeInstanceId
            ),
            getNativeSQLProtection(resourceId)
        ]);

        const atleastOneVolumeHasSnapshots = ontapData?.records?.some(
            ({ snapshot_count: snapshotCount }: { snapshot_count: number }) => snapshotCount
        );

        return {
            isAwsBackUpEnabled: awsBackup,
            isFsxOntapSnapshotsEnabled: atleastOneVolumeHasSnapshots,
            isSqlNativeEnabled: Boolean(nativeSqlProtection)
        };
    } catch (error) {
        logger.error('Error while getting protection status', resourceDetail);
    }
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

    const getPerformance = fieldsValues?.includes(DatabaseHostsQueryFields.PERFORMANCE);
    const getStorageSavings = fieldsValues?.includes(DatabaseHostsQueryFields.STORAGE);
    const getProtection = fieldsValues?.includes(DatabaseHostsQueryFields.PROTECTION);

    const databaseHosts: DatabaseHostSummaryResponseType[] = [];
    try {
        await Promise.all(
            resourceDetails
                .filter(resourceDetail => resourceDetail.resource_type !== RESOURCESTYPE.FSX)
                .map(async resourceDetail => {
                    const { resource_id: resourceId, resource_name: resourceName, region, metadata } = resourceDetail;

                    const { credentialsId, activeNodeInstanceId, standbyNodeInstanceId } =
                        metadata as unknown as Metadata;

                    let serverStatus: string = ServerState.DOWN;
                    let dbCount;
                    let topologyData: TopologyResponseType;
                    let performanceData: PerformanceResponseType | undefined;
                    let storageData: StorageResponseType | undefined;
                    let protectionData: ProtectionResponseType | undefined;

                    // Using 'allSettled' instead of 'all' to avoid failing the entire response for a single host.
                    const results = await Promise.allSettled([
                        getServerState(resourceId), // Fetch server status
                        getDatabasesCount(credentialsId, region!, activeNodeInstanceId, standbyNodeInstanceId),
                        getTopology(accountId, region!, resourceId, resourceDetail), // Fetch topology data
                        ...(getPerformance ? [getServerIOLatency(resourceId)] : [Promise.resolve()]), // Fetch io latency data
                        ...(getStorageSavings ? [getStorageData(resourceDetail)] : [Promise.resolve()]), // Fetch storage savings data
                        ...(getProtection ? [getProtectionStatus(resourceDetail)] : [Promise.resolve()]) // Fetch protection status
                    ]);

                    [serverStatus, dbCount, topologyData, performanceData, storageData, protectionData] = results.map(
                        result => (result.status === 'fulfilled' ? result.value : undefined)
                    );

                    databaseHosts.push({
                        id: resourceId,
                        name: resourceName || '',
                        status: serverStatus?.toLowerCase() === 'running' ? ServerState.UP : ServerState.DOWN,
                        databaseCount: dbCount?.totalCount || 0,
                        topology: topologyData!,
                        ...(performanceData && { performance: performanceData }),
                        ...(storageData && { storage: storageData }),
                        ...(protectionData && { protection: protectionData })
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
