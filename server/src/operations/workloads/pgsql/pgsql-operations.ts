import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import { generateHash, sqlResponseParsing } from '../../../utils/utils';
import { executeBashSsmCommand } from '../../aws/ssm-operations';
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
    PGSQL_SYSTEM_DATABASES
} from '../../../utils/consts';
import { DatabaseInstance, PgSqlInstanceDetails, ResourceDetails } from '../../../utils/common-types';
import { DatabaseHostInstanceSummaryResponseType } from '../../../routes/types/database-hosts.types';
import { DATABASES_COUNT, LIST_DATABASES, PERFORMANCE_METRICS } from './queries';
import { getPgSqlStorageSavings, getPgsqlInstanceData } from './pgsql-ssm-script-utils';
import getDatabaseInstanceTopology from '../utilities/sql-utils';

const logger = getLogger();

async function getPgSqlInstanceInfo(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceName: string,
    nodeIds: string[],
    fsxDataVolumeName: string
) {
    logger.info('Fetching pg sql instance info', { accountId, nodeIds, instanceName, fsxDataVolumeName });
    const commands = [getPgsqlInstanceData(fsxDataVolumeName)];
    let response;
    try {
        for (const nodeId of nodeIds) {
            logger.info('Fetching PGSQL instance GUID', nodeId);
            response = await executeBashSsmCommand(credentialsId, region, commands, nodeId, accountId);
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
            ${region},
            ${instanceName},`;
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
        const response = await executeBashSsmCommand(credentialsId, region, [command], node1InstanceId, accountId);
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
        response = await executeBashSsmCommand(credentialsId, region, [commands], node1InstanceId);
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
        databaseInstances,
        fields,
        resourceDetails,
        standbyNodeInstanceId
    });

    let fieldsValues: Array<string> = [];

    if (fields) {
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    }

    const getStorageSavings = fieldsValues?.includes(DatabaseHostsQueryFields.STORAGE.toLocaleLowerCase());
    const getDbCount = fieldsValues?.includes(DatabaseHostsQueryFields.DB_COUNT.toLocaleLowerCase());
    const getDatabasesWithoutProtection = fieldsValues?.includes(
        DatabaseHostsQueryFields.DATABASES.toLocaleLowerCase()
    );
    const shouldQueryDatabaseTopology = fieldsValues?.includes(
        DatabaseHostsQueryFields.DATABASE_INSTANCE_TOPOLOGY.toLocaleLowerCase()
    );
    const getPerformanceMetrics = fieldsValues?.includes(DatabaseHostsQueryFields.PERFORMANCE.toLocaleLowerCase());
    const sqlDeploymentType = databaseInstances[0].database_deployment_type;
    let storageData: any;
    let databasesCount: any;
    let databases: any;
    let performanceData: any;
    let databaseInstancetopologyData: any;
    const errormessages: { [index: string]: string } = {};
    try {
        [storageData, databaseInstancetopologyData, databasesCount, databases, performanceData] = await Promise.all(
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
                ...(getDatabasesWithoutProtection
                    ? [getPgSqlDatabasesList(accountId, credentialsId, region, activeNodeInstanceId)]
                    : [Promise.resolve()]),
                ...(getPerformanceMetrics
                    ? [getPgSqlPerformaceMetrics(accountId, credentialsId, region, activeNodeInstanceId)]
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
            databaseInstanceName: 'postgresql',
            status: '',
            databaseCount: 0
        };

        databaseInstanceDetails.status = ServerState.UP;

        const [instanceDbCount] = databasesCount?.[index] ?? [];
        if (getDbCount && instanceDbCount) {
            databaseInstanceDetails.databaseCount = instanceDbCount || 0;
        }
        if (getDatabasesWithoutProtection && databases) {
            databaseInstanceDetails.databases = databases || 0;
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

        if (!isEmpty(errormessages)) {
            databaseInstanceDetails.errors = errormessages;
        }

        return databaseInstanceDetails;
    });
}

async function getPgSqlDatabaseInstancesDetails(
    credentialsId: string,
    region: string,
    instancesManaged: DatabaseInstance[],
    resourceId: string,
    instanceDetails?: PgSqlInstanceDetails[] | undefined
) {
    logger.info('Getting pgsql database Instances details for resource', {
        credentialsId,
        region,
        instancesManaged,
        resourceId,
        instanceDetails
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
        ...(instanceDetails ?? []),
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
        const response = await executeBashSsmCommand(credentialsId, region, [command], node1InstanceId, accountId);
        if (response) {
            const parsedResponse = sqlResponseParsing(response);
            const databases = parsedResponse.map(
                (database: { name: string; size: number; status: string; collation: string }) => ({
                    name: database.name,
                    size: database.size,
                    status: database.status.toLowerCase() === 'active' ? ONLINE : OFFLINE,
                    collation: database.collation ?? '',
                    type: PGSQL_SYSTEM_DATABASES.includes(database?.name?.toLowerCase())
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
        const response = await executeBashSsmCommand(credentialsId, region, [command], node1InstanceId, accountId);
        if (response) {
            const parsedResponse = sqlResponseParsing(response);

            if (parsedResponse && !(typeof parsedResponse === 'string' && parsedResponse?.includes('error'))) {
                const performanceResponse = {
                    assessment: parsedResponse.assessment,
                    latency: {
                        read: parsedResponse.READ_LATENCY,
                        write: parsedResponse.WRITE_LATENCY,
                        serverIo: parsedResponse.SERVER_IO_LATENCY
                    },
                    iops: { read: parsedResponse.READ_IOPS, write: parsedResponse.WRITE_IOPS },
                    throughput: {
                        read: parsedResponse.READ_THROUGHPUT,
                        write: parsedResponse.WRITE_THROUGHPUT
                    }
                };
                return performanceResponse;
            }
        }
        const errorMessage = `Error fetching pgsql performance metricies from nodes: ${node1InstanceId}`;
        throw createError(errorMessage);
    } catch (err) {
        const errorMessage = `Error fetching pgsql performance metricies: ${err}, ${credentialsId}, ${region}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

export {
    getPgSqlResourceId,
    getPgSqlInstanceInfo,
    getPgSqlStorageSavingsVolumeData,
    getPgSqlDatabaseCount,
    getPgSqlDatabaseInstancesSummary,
    getPgSqlDatabaseInstancesDetails,
    getPgSqlDatabasesList,
    getPgSqlPerformaceMetrics
};
