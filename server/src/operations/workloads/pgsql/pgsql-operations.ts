import createError from 'http-errors';
import { isArray, isEmpty } from 'lodash-es';
import { ConnectionStatus } from '@aws-sdk/client-ssm';
import { generateHash, IS_DEMO_FLOW, parsePgSqlInstanceInfo, sqlResponseParsing } from '../../../utils/utils';
import { callSsmExecution } from '../../aws/ssm-operations';
import getLogger from '../../../utils/logger';
import {
    DatabaseHostsQueryFields,
    HttpErrorCodes,
    ServerState,
    STORAGE_PROTOCOLS,
    PGSQL_DATABASE_INSTANCE_INDEX_MAPPING,
    MSSQL_DATABASE_TYPES,
    ONLINE,
    OFFLINE,
    PGSQL_SYSTEM_DATABASES,
    PGSQL_DEFAULT_INSTANCE_NAME,
    DatabaseTypes
} from '../../../utils/consts';
import { DatabaseInstance, Metadata, PgSqlInstanceDetails, ResourceDetails } from '../../../utils/common-types';
import { listResources } from '../../../lib/database/db';
import { DatabaseHostInstanceSummaryResponseType } from '../../../routes/types/database-hosts.types';
import { DATABASES_COUNT, LIST_DATABASES, PERFORMANCE_METRICS } from './queries';
import { getPgSqlProtection, getPgSqlStorageSavings, getPgsqlInstanceData } from './pgsql-ssm-script-utils';
import { getDatabaseInstanceTopology } from '../../../utils/sql-utils';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from './const';
import { loadPgSqlAdminScript } from './pgsql-admin-scripts';
import { isFsxnAwsBackupEnabled } from '../../aws/fsx-operations';

const logger = getLogger();

const IN_PRODUCTION = 'in production';
const PGSQL_ADMIN_SCRIPT_MARKER = '#pgsql admin script';
const SHELL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

type PgSqlScriptTarget = {
    ec2InstanceId?: string;
    databaseHostId?: string;
    databaseInstanceId?: string;
};

function shellSingleQuote(value: string): string {
    const quote = String.fromCharCode(39);
    const escaped = `${quote}\\${quote}${quote}`;
    return `${quote}${value.split(quote).join(escaped)}${quote}`;
}

function buildAdminScript(scriptBody: string, args?: Record<string, string>): string {
    const exports: string[] = [];
    for (const [key, value] of Object.entries(args ?? {})) {
        if (!SHELL_IDENTIFIER.test(key)) {
            throw createError(HttpErrorCodes.BAD_REQUEST, `Invalid script arg name: ${key}`);
        }
        exports.push(`export ${key}=${shellSingleQuote(value)}`);
    }
    const prelude = exports.length > 0 ? `${exports.join('\n')}\n` : '';
    return `${PGSQL_ADMIN_SCRIPT_MARKER}\n${prelude}${scriptBody}`;
}

async function getPgSqlInstanceDetails(
    accountId: string,
    credentialsId: string,
    region: string,
    node1InstanceId: string,
    node2InstanceId?: string
) {
    logger.info('Getting PGSQL instance details', {
        accountId,
        credentialsId,
        region,
        node1InstanceId,
        node2InstanceId
    });
    const instanceInfo = (await getPgSqlInstanceInfo(accountId, credentialsId, region, [node1InstanceId])) || '';
    const { dbInstanceId, dbClusterState } = parsePgSqlInstanceInfo(instanceInfo);
    const instanceDetails = {
        databaseInstanceId: dbInstanceId,
        instanceName: PGSQL_DEFAULT_INSTANCE_NAME,
        instanceState: dbClusterState === IN_PRODUCTION ? ServerState.UP : ServerState.DOWN, // in production state: The database cluster is fully operational and running. This is the normal state when the PostgreSQL server is up and accepting connections
        isDefault: true
    };
    return {
        isSSMConnected: true,
        activeNodeInstanceId: node1InstanceId,
        standbyNodeInstanceId: node2InstanceId,
        instanceName: PGSQL_DEFAULT_INSTANCE_NAME, // PGSQL instances have no instance name, defaulting to postgresql
        ssmConnectionStatus: ConnectionStatus.CONNECTED,
        instancesDetails: [instanceDetails]
    };
}

async function getPgSqlInstanceInfo(accountId: string, credentialsId: string, region: string, nodeIds: string[]) {
    logger.info('Fetching pg sql instance info', { accountId, nodeIds });
    const commands = [getPgsqlInstanceData];
    const comment = 'pgsql instance info';
    let response;
    try {
        for await (const nodeId of nodeIds) {
            logger.info('Fetching PGSQL instance GUID', nodeId);
            response = await callSsmExecution({
                credentialsId,
                region,
                commands,
                ec2InstanceId: nodeId,
                comment,
                accountId,
                documentName: SSM_RUN_SHELL_SCRIPT_DOC,
                documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            });
            if (response) {
                return response;
            }
        }

        if (!response) {
            const errorMessage = `Error fetching instance info from nodes: ${nodeIds.join(', ')}`;
            logger.error(errorMessage);
            throw createError(errorMessage);
        }
    } catch (err) {
        const errorMessage = `Error fetching pgsql instance id:,
            ${err},
            ${credentialsId},
            ${region}`;
        throw createError(errorMessage);
    }
}

async function getPgSqlDatabaseCount(
    accountId: string,
    credentialsId: string,
    region: string,
    node1InstanceId: string
) {
    logger.info('Fetching pg sql database count', { accountId, credentialsId, region, node1InstanceId });

    try {
        const command = DATABASES_COUNT;
        const comment = 'pgsql databases count';
        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: [command],
            ec2InstanceId: node1InstanceId,
            comment,
            accountId,
            cacheData: true,
            documentName: SSM_RUN_SHELL_SCRIPT_DOC,
            documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        });
        if (response) {
            return response;
        }
        const errorMessage = `Error fetching database count from nodes: ${node1InstanceId}`;
        throw createError(errorMessage);
    } catch (err) {
        const errorMessage = `Error fetching pgsql database count: ${err}, ${credentialsId}, ${region}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

function getPgSqlResourceId(node1InstanceId: string, node2InstanceId?: string) {
    logger.info('Get MS SQL resource ID:', { node1InstanceId, node2InstanceId });
    return node2InstanceId ? generateHash(node1InstanceId + node2InstanceId) : generateHash(node1InstanceId);
}

async function getPgSqlStorageSavingsVolumeData(
    accountId: string,
    credentialsId: string,
    region: string,
    node1InstanceId: string,
    fsxNId: string
) {
    logger.info('Fetching storage savings volume data', { accountId, credentialsId, region, node1InstanceId, fsxNId });
    let response;
    try {
        const endpoint =
            'storage/volumes?fields=efficiency.space_savings.total,efficiency.space_savings.total_percent,space.size,space.used';
        const commands = getPgSqlStorageSavings(fsxNId, region, endpoint);
        const comment = 'pgsql storage savings';
        response = await callSsmExecution({
            credentialsId,
            region,
            commands: [commands],
            ec2InstanceId: node1InstanceId,
            comment,
            accountId,
            cacheData: true,
            documentName: SSM_RUN_SHELL_SCRIPT_DOC,
            documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        });
        const {
            records: [volSavingsData]
        } = JSON.parse(response!) || {};
        const {
            efficiency: { space_savings: spaceSavings },
            space
        } = volSavingsData;
        const instanceStorageSavingsInfo = {
            fsxn: {
                spaceSavings: spaceSavings.total,
                spaceSavingsPercentage: spaceSavings.total_percent,
                size: space.size,
                used: space.used,
                protocol: [STORAGE_PROTOCOLS.NFS]
            }
        };
        logger.debug('Instance Storage Savings Data:', instanceStorageSavingsInfo);
        return instanceStorageSavingsInfo;
    } catch (err) {
        const errorMessage = `Error fetching storage savings volume data:,
            ${err},
            ${credentialsId},
            ${region}`;
        logger.error(errorMessage);
    }
}

async function getPgSqlDatabaseInstancesSummary(
    accountId: string,
    credentialsId: string,
    activeNodeInstanceId: string,
    region: string,
    databaseInstances: DatabaseInstance[],
    fields?: string,
    resourceDetails?: ResourceDetails,
    standbyNodeInstanceId?: string
) {
    logger.info('Fetching summary of PGSQL database instance', {
        accountId,
        credentialsId,
        activeNodeInstanceId,
        region,
        databaseInstancesLength: databaseInstances.length,
        fields,
        resourceId: resourceDetails?.resource_id,
        standbyNodeInstanceId
    });

    let fieldsValues: Array<string> = [];

    if (fields) {
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    }

    const getStorageSavings = fieldsValues?.includes(DatabaseHostsQueryFields.STORAGE.toLowerCase());
    const getDbCount = fieldsValues?.includes(DatabaseHostsQueryFields.DB_COUNT.toLowerCase());
    const getDatabasesWithoutProtection = fieldsValues?.includes(DatabaseHostsQueryFields.DATABASES.toLowerCase());
    const getDatabasesWithProtection = fieldsValues?.includes(
        DatabaseHostsQueryFields.DATABASES_WITH_PROTECTION.toLowerCase()
    );
    const shouldQueryDatabaseTopology = fieldsValues?.includes(
        DatabaseHostsQueryFields.DATABASE_INSTANCE_TOPOLOGY.toLowerCase()
    );
    const getPerformanceMetrics = fieldsValues?.includes(DatabaseHostsQueryFields.PERFORMANCE.toLowerCase());
    const getProtectionStatus = fieldsValues?.includes(DatabaseHostsQueryFields.PROTECTION.toLowerCase());

    const sqlDeploymentType = databaseInstances[0].database_deployment_type;
    let storageData: any;
    let databasesCount: any;
    let databases: any;
    let performanceData: any;
    let databaseInstancetopologyData: any;
    let protectionData: any;
    const errormessages: { [index: string]: string } = {};
    try {
        [storageData, databaseInstancetopologyData, databasesCount, databases, performanceData, protectionData] =
            await Promise.all(
                [
                    ...(getStorageSavings
                        ? [
                              Promise.all(
                                  databaseInstances.map(dbInstance =>
                                      getPgSqlStorageSavingsVolumeData(
                                          accountId,
                                          credentialsId,
                                          region,
                                          activeNodeInstanceId,
                                          dbInstance.fsxn_ids
                                      )
                                  )
                              )
                          ]
                        : [Promise.resolve()]), // Fetch storage savings data
                    ...(shouldQueryDatabaseTopology
                        ? [
                              getDatabaseInstanceTopology(
                                  accountId,
                                  credentialsId,
                                  region,
                                  activeNodeInstanceId,
                                  databaseInstances[0]
                              )
                          ]
                        : [Promise.resolve()]),
                    ...(getDbCount
                        ? [getPgSqlDatabaseCount(accountId, credentialsId, region, activeNodeInstanceId)]
                        : [Promise.resolve()]),
                    ...(getDatabasesWithoutProtection || getDatabasesWithProtection
                        ? [getPgSqlDatabasesList(accountId, credentialsId, region, activeNodeInstanceId)]
                        : [Promise.resolve()]),
                    ...(getPerformanceMetrics
                        ? [getPgSqlPerformaceMetrics(accountId, credentialsId, region, activeNodeInstanceId)]
                        : [Promise.resolve()]),
                    ...(getProtectionStatus || getDatabasesWithProtection
                        ? [
                              getPgSqlProtectionStatus(
                                  accountId,
                                  credentialsId,
                                  region,
                                  activeNodeInstanceId,
                                  databaseInstances[0].fsxn_ids
                              )
                          ]
                        : [Promise.resolve()])
                ].map((p, index) =>
                    p.catch(error => {
                        if (PGSQL_DATABASE_INSTANCE_INDEX_MAPPING[index]) {
                            errormessages[PGSQL_DATABASE_INSTANCE_INDEX_MAPPING[index]] = JSON.stringify(error);
                        }
                        logger.error(`Error while fetching data: ${error}.`);
                    })
                )
            );
    } catch (error) {
        logger.error(`Error while fetching PGSQL database instance summary ${accountId}, ${error}`);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Error while fetching PGSQL database instance summary ${accountId}, ${error}`
        );
    }

    return databaseInstances.map((databaseInstance: DatabaseInstance, index) => {
        const { database_instance_id: databaseInstanceId } = databaseInstance;

        const databaseInstanceDetails: DatabaseHostInstanceSummaryResponseType = {
            databaseInstanceId,
            databaseInstanceName: PGSQL_DEFAULT_INSTANCE_NAME,
            status: '',
            databaseCount: 0
        };

        databaseInstanceDetails.status = ServerState.UP;

        const [instanceDbCount] = databasesCount?.[index] ?? [];
        if (getDbCount && instanceDbCount) {
            databaseInstanceDetails.databaseCount = instanceDbCount || 0;
        }
        if (databases) {
            if (databases) {
                databaseInstanceDetails.databases = getDatabasesWithProtection
                    ? databases.map((db: any) => ({
                          ...db,
                          protection: protectionData
                      }))
                    : databases;
            }
        }
        if (getPerformanceMetrics && performanceData) {
            databaseInstanceDetails.performance = getPerformanceMetrics
                ? { assessment: performanceData?.assessment, rwMetrics: performanceData! }
                : {};
        }
        if (shouldQueryDatabaseTopology && databaseInstancetopologyData) {
            databaseInstanceDetails.databaseInstanceTopology = databaseInstancetopologyData;
        }
        databaseInstanceDetails.sqlServerDeploymentType = sqlDeploymentType;
        databaseInstanceDetails.storage = storageData?.[index];

        if (getProtectionStatus && protectionData) {
            databaseInstanceDetails.protection = protectionData;
        }

        if (!isEmpty(errormessages)) {
            databaseInstanceDetails.errors = errormessages;
        }

        return databaseInstanceDetails;
    });
}

function getPgSqlDatabaseInstancesDetails(
    credentialsId: string,
    region: string,
    instancesManaged: DatabaseInstance[],
    resourceId: string,
    instanceDetails?: PgSqlInstanceDetails[] | undefined
) {
    logger.info('Getting pgsql database Instances details for resource', {
        credentialsId,
        region,
        instancesManagedLength: instancesManaged.length,
        resourceId,
        pgsqlInstanceDetailsLength: instanceDetails?.length
    });

    const managedInstancesName = instancesManaged.map((item: DatabaseInstance) => ({
        instanceName: item.database_instance_name,
        isDefault: item.is_default,
        instanceState: ServerState.DOWN,
        isManaged: true,
        databaseInstanceId: item.database_instance_id
    }));

    const existingInstanceIDs = new Set(instanceDetails?.map(({ databaseInstanceId }) => databaseInstanceId));
    const updatedInstanceDetails = [
        ...(instanceDetails ?? []).map(instance => ({
            ...instance,
            isManaged: managedInstancesName.some(managed => managed.databaseInstanceId === instance.databaseInstanceId)
        })),
        ...managedInstancesName.filter(({ databaseInstanceId }) => !existingInstanceIDs.has(databaseInstanceId))
    ];
    return updatedInstanceDetails;
}

async function getPgSqlDatabasesList(
    accountId: string,
    credentialsId: string,
    region: string,
    node1InstanceId: string
) {
    logger.info('Fetching pgsql databases list', { accountId, credentialsId, region, node1InstanceId });

    try {
        const command = LIST_DATABASES;
        const comment = 'pgsql database list';
        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: [command],
            ec2InstanceId: node1InstanceId,
            comment,
            accountId,
            cacheData: true,
            shouldReadFromCloudWatchLogs: true,
            documentName: SSM_RUN_SHELL_SCRIPT_DOC,
            documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        });
        if (response) {
            const parsedResponse = sqlResponseParsing(response);
            if (!isArray(parsedResponse)) {
                throw createError('Error parsing pgsql database list', parsedResponse);
            }
            const databases = parsedResponse.map(
                ({
                    name,
                    size,
                    status,
                    collation = ''
                }: {
                    name: string;
                    size: number;
                    status: string;
                    collation: string;
                }) => ({
                    name,
                    size,
                    status: status.toLowerCase() === 'active' ? ONLINE : OFFLINE,
                    collation,
                    type: PGSQL_SYSTEM_DATABASES.includes(name?.toLowerCase())
                        ? MSSQL_DATABASE_TYPES.SYSTEM
                        : MSSQL_DATABASE_TYPES.USER
                })
            );
            return databases;
        }
        const errorMessage = `Error fetching pgsql database list from nodes: ${node1InstanceId}`;
        throw createError(errorMessage);
    } catch (err) {
        const errorMessage = `Error fetching pgsql database list: ${err}, ${credentialsId}, ${region}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

async function getPgSqlPerformaceMetrics(
    accountId: string,
    credentialsId: string,
    region: string,
    node1InstanceId: string
) {
    logger.info('Fetching pgsql performance metricies', { accountId, credentialsId, region, node1InstanceId });

    try {
        const command = PERFORMANCE_METRICS;
        const comment = 'pgsql performance metrics';
        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: [command],
            ec2InstanceId: node1InstanceId,
            comment,
            accountId,
            cacheData: true,
            documentName: SSM_RUN_SHELL_SCRIPT_DOC,
            documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        });
        if (response) {
            const parsedResponse = sqlResponseParsing(response);

            if (parsedResponse) {
                const {
                    assessment,
                    read_latency: read,
                    write_latency: write,
                    server_io_latency: serverIo,
                    read_iops: readIops,
                    write_iops: writeIops,
                    read_throughput: readThroughput,
                    write_throughput: writeThroughput,
                    cache_hit_ratio: cacheHitRatio,
                    workload_type: workloadType
                } = parsedResponse;
                return {
                    assessment,
                    latency: {
                        read,
                        write,
                        serverIo
                    },
                    iops: { read: readIops, write: writeIops },
                    throughput: {
                        read: readThroughput,
                        write: writeThroughput
                    },
                    cacheHitRatio,
                    workloadType
                };
            }
        }
        const errorMessage = `Error fetching pgsql performance metricies from nodes: ${node1InstanceId}, ${response}`;
        throw createError(errorMessage);
    } catch (err) {
        const errorMessage = `Error fetching pgsql performance metricies: ${err}, ${credentialsId}, ${region}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

async function getPgSqlProtectionStatus(
    accountId: string,
    credentialsId: string,
    region: string,
    node1InstanceId: string,
    fsxId: string
) {
    logger.info('Fetching pgsql protection', { accountId, credentialsId, region, node1InstanceId, fsxId });
    const command = getPgSqlProtection(fsxId, region);
    const comment = 'pgsql protection data';
    const response = await callSsmExecution({
        credentialsId,
        region,
        commands: [command],
        ec2InstanceId: node1InstanceId,
        comment,
        accountId,
        cacheData: true,
        documentName: SSM_RUN_SHELL_SCRIPT_DOC,
        documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
    });
    if (response) {
        const parsedResponse = sqlResponseParsing(response);
        if (!isEmpty(parsedResponse?.error)) {
            throw parsedResponse.error;
        }
        if (!parsedResponse?.records || !parsedResponse.records.length) {
            logger.warn(
                `No records found for pgsql protection status for fsxId: ${fsxId}, region: ${region}, credentialsId: ${credentialsId}`
            );
            return {
                isAwsBackupEnabled: { fsxn: false },
                isFsxOntapSnapshotsEnabled: false
            };
        }

        const { records } = parsedResponse as {
            records: Array<{ snapshot_count?: number; uuid?: string }>;
        };
        const volumeUuids = records.map(record => record.uuid).filter((uuid): uuid is string => Boolean(uuid));
        const backupStatus = await isFsxnAwsBackupEnabled(credentialsId, region, fsxId, volumeUuids);
        const volumeUuidsInBackups = backupStatus?.volumeUuidsInBackups || [];
        const fsxnBackup = IS_DEMO_FLOW
            ? volumeUuids.length > 0
            : volumeUuids.length > 0 && volumeUuids.every(uuid => volumeUuidsInBackups.includes(uuid));
        return {
            isAwsBackupEnabled: { fsxn: fsxnBackup },
            isFsxOntapSnapshotsEnabled: records.every(record => (record.snapshot_count ?? 0) > 0)
        };
    }
}

async function resolvePgSqlScriptTarget(
    accountId: string,
    credentialsId: string,
    region: string,
    { ec2InstanceId, databaseHostId, databaseInstanceId }: PgSqlScriptTarget
): Promise<string> {
    if (databaseInstanceId && isEmpty(databaseHostId)) {
        const errorMessage = 'databaseInstanceId requires databaseHostId for a registered PostgreSQL host';
        logger.error(errorMessage, { accountId, databaseInstanceId });
        throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
    }
    if (databaseHostId) {
        const resources = await listResources({
            accountId,
            resourceId: databaseHostId,
            credentialIds: credentialsId,
            region,
            resourceType: DatabaseTypes.PG_SQL,
            includeDatabaseInstances: Boolean(databaseInstanceId),
            selectKeys: ['metadata', 'resource_id', 'resource_type']
        });
        if (isEmpty(resources)) {
            const errorMessage = `PostgreSQL host ${databaseHostId} not found`;
            logger.error(errorMessage, { accountId, credentialsId, region, databaseHostId });
            throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
        }
        const resource = resources[0] as ResourceDetails;
        if (databaseInstanceId) {
            const match = resource.database_instances?.find(
                instance => instance.database_instance_id === databaseInstanceId
            );
            if (!match) {
                const errorMessage = `databaseInstanceId ${databaseInstanceId} not found on host ${databaseHostId}`;
                logger.error(errorMessage, { accountId, databaseHostId, databaseInstanceId });
                throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
            }
        }
        const { node1InstanceId, node2InstanceId } = (resource.metadata || {}) as Metadata;
        if (isEmpty(node1InstanceId)) {
            const errorMessage = `No EC2 node registered on PostgreSQL host ${databaseHostId}`;
            logger.error(errorMessage, { accountId, databaseHostId });
            throw createError(HttpErrorCodes.FAILED_DEPENDENCY, errorMessage);
        }
        if (ec2InstanceId && ec2InstanceId !== node1InstanceId && ec2InstanceId !== node2InstanceId) {
            const errorMessage = 'ec2InstanceId does not belong to the given databaseHostId';
            logger.error(errorMessage, { accountId, databaseHostId, ec2InstanceId, node1InstanceId, node2InstanceId });
            throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
        }
        return ec2InstanceId || node1InstanceId;
    }
    if (ec2InstanceId) {
        return ec2InstanceId;
    }
    const errorMessage = 'Provide ec2InstanceId for an unregistered host or databaseHostId for a registered host';
    logger.error(errorMessage, { accountId });
    throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
}

async function runPgSqlAdminScript(
    accountId: string,
    credentialsId: string,
    region: string,
    target: PgSqlScriptTarget,
    scriptId: string,
    args?: Record<string, string>,
    comment?: string
) {
    const { body: scriptBody, mutating } = loadPgSqlAdminScript(accountId, scriptId, args);
    const { databaseHostId, databaseInstanceId } = target;
    const ec2InstanceId = await resolvePgSqlScriptTarget(accountId, credentialsId, region, target);
    logger.info('Running pgsql admin script', {
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        databaseHostId,
        databaseInstanceId,
        scriptId,
        mutating,
        comment,
        argKeys: Object.keys(args ?? {})
    });
    const identityArgs = {
        REGION: region,
        ...(databaseHostId && { DATABASE_HOST_ID: databaseHostId }),
        ...(databaseInstanceId && { DATABASE_INSTANCE_ID: databaseInstanceId })
    };
    const fullScript = buildAdminScript(scriptBody, { ...(args ?? {}), ...identityArgs });
    const output = await callSsmExecution({
        credentialsId,
        region,
        commands: [fullScript],
        ec2InstanceId,
        comment: comment || 'pgsql admin script',
        accountId,
        documentName: SSM_RUN_SHELL_SCRIPT_DOC,
        documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
    });
    return { output: output ?? '' };
}

export {
    getPgSqlInstanceDetails,
    getPgSqlResourceId,
    getPgSqlInstanceInfo,
    getPgSqlStorageSavingsVolumeData,
    getPgSqlDatabaseCount,
    getPgSqlDatabaseInstancesSummary,
    getPgSqlDatabaseInstancesDetails,
    getPgSqlDatabasesList,
    getPgSqlPerformaceMetrics,
    getPgSqlProtectionStatus,
    runPgSqlAdminScript
};
