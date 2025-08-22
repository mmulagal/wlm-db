import createError from 'http-errors';
import { isEmpty, omit } from 'lodash-es';
import { ConnectionStatus } from '@aws-sdk/client-ssm';
import {
    DatabaseHostsQueryFields,
    DatabaseTypes,
    HttpErrorCodes,
    OFFLINE,
    ONLINE,
    ORACLE_DATABASE_INSTANCE_INDEX_MAPPING,
    ORACLE_INSTANCE_STATE,
    ServerState
} from '../../../utils/consts';
import getLogger from '../../../utils/logger';
import { callSsmExecution, getSSMConnectionStatus } from '../../aws/ssm-operations';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from './consts';
import { isDemo, parseMultipleCommandResponse, sqlResponseParsing } from '../../../utils/utils';
import {
    DatabaseHostInstanceSummaryResponseType,
    NodeTopologyResponseType
} from '../../../routes/types/database-hosts.types';
import { DatabaseInstance, Metadata, OracleInstanceDetails, ResourceDetails } from '../../../utils/common-types';
import {
    GET_ORACLE_SERVER_DETAILS,
    getOracleInstanceData,
    getOracleProtectionData,
    ORACLE_PERFORMANCE_METRICS
} from './oracle-ssm-script-utils';
import getDatabaseInstanceTopology from '../../../utils/sql-utils';
import { isFsxnAwsBackupEnabled } from '../../aws/fsx-operations';
import {
    fetchOracleDatabasesCount,
    fetchOracleDatabasesDetails,
    getMappedOntapDataVolumeForInstance,
    getStorageDetailsForRegisteredInstances
} from './oracle-discover-scripts';
import { getSqlInstanceUtilizationAndPerformance } from '../../aws/cloud-watch-operations';
import { listResources } from '../../../lib/database/db';
import { createDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import { AssessmentCategories } from '../../../utils/continous-optimization-consts';
import { OracleInstanceMountpointResponse } from './common-types';
import { getPaginatedDatabaseInstances } from '../../database/database-operations';
import { getStorageData, getNodeTopology } from '../../database-hosts-util';

const logger = getLogger();

async function getOracleInstanceDetails(
    accountId: string,
    credentialId: string,
    region: string,
    node1InstanceId: string,
    options: { fetchServerDetails?: boolean; oracleSid?: string } = { fetchServerDetails: false, oracleSid: '' }
) {
    logger.info('Fetching Oracle instance details', { accountId, credentialId, region, node1InstanceId });
    const { fetchServerDetails = false, oracleSid = '' } = options;
    const ssmResponse = await getOracleInstanceInfo(accountId, credentialId, region, [node1InstanceId], {
        fetchServerDetails,
        oracleSid
    });
    const [parsedResponse, activeNodeDetails] = parseMultipleCommandResponse(ssmResponse || '[]');

    const instanceDetails = [];
    for (const dbInstance of parsedResponse) {
        const {
            instance_details: { instance_id: instanceId, instance_name: instanceName, instance_state: instanceState }
        } = dbInstance;
        instanceDetails.push({
            databaseInstanceId: instanceId,
            instanceName,
            instanceState,
            isDefault: false,
            isManaged: false
        });
    }

    return {
        isSSMConnected: true,
        instanceName: 'oracle',
        activeNodeInstanceId: node1InstanceId,
        standbyNodeInstanceId: undefined,
        ssmConnectionStatus: ConnectionStatus.CONNECTED,
        instancesDetails: instanceDetails,
        activeNodeDetails
    };
}

async function getOracleInstanceInfo(
    accountId: string,
    credentialsId: string,
    region: string,
    nodeIds: string[],
    options: { fetchServerDetails?: boolean; oracleSid?: string } = { fetchServerDetails: false, oracleSid: '' }
) {
    logger.info('Fetching oracle instance info', { accountId, nodeIds });
    const { fetchServerDetails = false, oracleSid = '' } = options;
    const commands = [getOracleInstanceData(nodeIds[0])];
    if (fetchServerDetails) {
        commands.push(GET_ORACLE_SERVER_DETAILS(oracleSid, nodeIds[0]));
    }
    const comment = 'oracle instance info';
    let response;
    try {
        for await (const nodeId of nodeIds) {
            response = await callSsmExecution(
                credentialsId,
                region,
                commands,
                nodeId,
                comment,
                accountId,
                undefined,
                undefined,
                undefined,
                SSM_RUN_SHELL_SCRIPT_DOC,
                SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            );
            if (response) {
                return response;
            }
        }
    } catch (err) {
        const errorMessage = `Error fetching oracle instance info:,
            ${err},
            ${credentialsId},
            ${region}`;
        throw createError(errorMessage);
    }
}

async function getOracleDatabaseInstancesDetails(
    credentialsId: string,
    region: string,
    instancesManaged: DatabaseInstance[],
    resourceId: string,
    instanceDetails?: OracleInstanceDetails[] | undefined
) {
    logger.info('Getting oracle database Instances details for resource', {
        credentialsId,
        region,
        instancesManaged,
        resourceId
    });

    const managedInstancesName = instancesManaged.map((item: DatabaseInstance) => ({
        instanceName: item.database_instance_name,
        isDefault: item.is_default,
        instanceState: isDemo() ? ServerState.UP : ServerState.DOWN,
        isManaged: true,
        databaseInstanceId: item.database_instance_id
    }));

    const existingInstanceIDs = new Set(instanceDetails?.map(({ instanceName }) => instanceName));
    const updatedInstanceDetails = [
        ...(instanceDetails ?? []).map(({ instanceName, instanceState, isDefault }) => {
            const managedInstance = managedInstancesName.find(
                ({ instanceName: managedInstanceName }) => managedInstanceName === instanceName
            );
            const isManaged = Boolean(managedInstance);
            const updatedInstanceState =
                instanceState === ORACLE_INSTANCE_STATE.OPEN ? ServerState.UP : ServerState.DOWN;
            const databaseInstanceId = managedInstance?.databaseInstanceId;
            return {
                instanceName,
                instanceState: updatedInstanceState,
                isDefault,
                databaseInstanceId,
                ...(managedInstancesName.length > 0 && { isManaged })
            };
        }),
        ...managedInstancesName.filter(({ databaseInstanceId }) => !existingInstanceIDs.has(databaseInstanceId))
    ];
    return updatedInstanceDetails;
}

async function getOraclePerformanceMetrics(
    accountId: string,
    credentialsId: string,
    region: string,
    node1InstanceId: string,
    dbInstanceSid: string
) {
    logger.info('Fetching oracle db performance metrics', { accountId, credentialsId, region, node1InstanceId });

    try {
        const command = ORACLE_PERFORMANCE_METRICS(node1InstanceId, dbInstanceSid);
        const comment = 'oracle performance metrics';
        const response = await callSsmExecution(
            credentialsId,
            region,
            [command],
            node1InstanceId,
            comment,
            accountId,
            undefined,
            undefined,
            undefined,
            SSM_RUN_SHELL_SCRIPT_DOC,
            SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        );
        if (response) {
            const parsedResponse = sqlResponseParsing(response);

            if (parsedResponse) {
                const {
                    assessment,
                    READ_LATENCY: read,
                    WRITE_LATENCY: write,
                    SERVER_IO_LATENCY: serverIo,
                    READ_IOPS: readIops,
                    WRITE_IOPS: writeIops,
                    READ_THROUGHPUT: readThroughput,
                    WRITE_THROUGHPUT: writeThroughput
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
                    }
                };
            }
        }
        const errorMessage = `Error fetching oracle performance metrics from nodes: ${node1InstanceId}, ${response}`;
        throw createError(errorMessage);
    } catch (err) {
        const errorMessage = `Error fetching oracle performance metrics: ${err}, ${credentialsId}, ${region}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

async function getOracleProtectionStatus(
    accountId: string,
    credentialsId: string,
    region: string,
    node1InstanceId: string,
    fsxnId: string,
    dbInstanceSid: string,
    mountIp?: string,
    junctionPath?: string,
    protocol?: string
) {
    logger.info('Fetching Oracle db protection status', { accountId, credentialsId, region, node1InstanceId });

    try {
        if (mountIp === undefined || junctionPath === undefined || protocol === undefined) {
            throw createError(
                HttpErrorCodes.BAD_REQUEST,
                `Missing mountIp, junctionPath or protocol for fsxnId: ${fsxnId}, ${credentialsId}, ${region}`
            );
        }
        const command = getOracleProtectionData(
            fsxnId,
            region,
            mountIp,
            junctionPath,
            protocol,
            dbInstanceSid,
            node1InstanceId
        );
        const comment = 'oracle protection status';
        const response = await callSsmExecution(
            credentialsId,
            region,
            [command],
            node1InstanceId,
            comment,
            accountId,
            undefined,
            undefined,
            undefined,
            SSM_RUN_SHELL_SCRIPT_DOC,
            SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        );
        if (response) {
            const parsedResponse = sqlResponseParsing(response);
            const { ontapProtectionDetails, isNativeProtectionEnabled, error } = parsedResponse;
            if (error) {
                throw error;
            }
            const records = ontapProtectionDetails?.records[0];
            const { snapshot_count: snapshotCount, uuid } = records;
            const backupStatus = await isFsxnAwsBackupEnabled(credentialsId, region, fsxnId, [uuid]);
            const volumeUuidsInBackups = backupStatus?.volumeUuidsInBackups || [];
            const fsxnBackup = volumeUuidsInBackups.includes(uuid);
            return {
                isSqlNativeBackupEnabled: isNativeProtectionEnabled === 'true',
                isAwsBackupEnabled: { fsxn: fsxnBackup },
                isFsxOntapSnapshotsEnabled: snapshotCount > 0
            };
        }
    } catch (err) {
        const errorMessage = `Error fetching oracle protection status: ${err}, ${credentialsId}, ${region}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

async function getOracleDatabaseCount(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    databaseInstanceSid: string
) {
    logger.info('Fetching Oracle database count', { accountId, credentialsId, region, ec2InstanceId });

    try {
        const command = fetchOracleDatabasesCount(ec2InstanceId, databaseInstanceSid);
        const comment = 'oracle database count';
        const response = await callSsmExecution(
            credentialsId,
            region,
            [command],
            ec2InstanceId,
            comment,
            accountId,
            undefined,
            undefined,
            undefined,
            SSM_RUN_SHELL_SCRIPT_DOC,
            SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        );

        if (response) {
            const parsedResponse = sqlResponseParsing(response);
            const { databases_count: databasesCount } = parsedResponse;
            return databasesCount;
        }
        const errorMessage = `Error fetching Oracle database count from host: ${ec2InstanceId}, ${response}`;
        throw createError(errorMessage);
    } catch (err) {
        const errorMessage = `Error fetching Oracle database count: ${err}, ${credentialsId}, ${region}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

async function getOracleDatabasesList(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    databaseInstanceSid: string
) {
    logger.info('Fetching Oracle databases list', {
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        databaseInstanceSid
    });

    try {
        const command = fetchOracleDatabasesDetails(ec2InstanceId, databaseInstanceSid);
        const comment = 'oracle database list';
        const response = await callSsmExecution(
            credentialsId,
            region,
            [command],
            ec2InstanceId,
            comment,
            accountId,
            undefined,
            undefined,
            undefined,
            SSM_RUN_SHELL_SCRIPT_DOC,
            SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        );

        if (response) {
            const parsedResponse = sqlResponseParsing(response);
            const {
                database_details: databaseDetails,
                is_cdb: isCDB,
                pdbs_status: pdbsStatus,
                pdbs_size: pdbsSize,
                root_db_size: rootDbSize
            } = parsedResponse;

            const databases = [];

            // If there are no PDBs, it's a single tenant database
            databases.push({
                name: databaseDetails?.name,
                size: rootDbSize,
                status: databaseDetails?.status?.toLowerCase() === 'online' ? ONLINE : OFFLINE,
                type: isCDB === 'YES' ? 'CDB' : 'Single tenant'
            });

            if (isCDB === 'YES') {
                for (const pdb of pdbsStatus) {
                    const pdbName = pdb.pdb_name;
                    const status = pdb.status?.toLowerCase() || 'offline';
                    const pdbSize = pdbsSize[pdbName] || 0; // Default to 0 if size is not found
                    databases.push({
                        name: pdbName,
                        size: pdbSize,
                        status: status === 'online' ? ONLINE : OFFLINE,
                        type: 'PDB'
                    });
                }
            }
            return databases;
        }
        const errorMessage = `Error fetching Oracle databases list from host: ${ec2InstanceId}, ${response}`;
        throw createError(errorMessage);
    } catch (err) {
        const errorMessage = `Error fetching Oracle databases list: ${err}, ${credentialsId}, ${region}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

async function getRegisteredOracleInstanceStorageDetails(
    accountId: string,
    credentialsId: string,
    region: string,
    node1InstanceId: string,
    fsxnId: string,
    dbInstanceSid: string
) {
    logger.info('Fetching registered oracle instance storage details', {
        accountId,
        credentialsId,
        region,
        node1InstanceId
    });

    try {
        const command = getStorageDetailsForRegisteredInstances(node1InstanceId, dbInstanceSid);
        const comment = 'Get oracle instance storage details';
        const response = await callSsmExecution(
            credentialsId,
            region,
            [command],
            node1InstanceId,
            comment,
            accountId,
            undefined,
            undefined,
            undefined,
            SSM_RUN_SHELL_SCRIPT_DOC,
            SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        );
        if (response) {
            const parsedResponse = sqlResponseParsing(response);
            const { storage_details: instanceStorageDetails } = parsedResponse;
            const flattenedInstanceStorageDetails: [] = instanceStorageDetails.flat();
            if (isEmpty(flattenedInstanceStorageDetails)) {
                throw createError(
                    HttpErrorCodes.NOT_FOUND,
                    `No storage details found for fsxnId: ${fsxnId}, ${credentialsId}, ${region}`
                );
            }

            const storageDetails = flattenedInstanceStorageDetails[flattenedInstanceStorageDetails.length - 1];

            const { mountIP: mountIp, mountPoint, protocol } = storageDetails;

            return {
                mountIp,
                mountPoint,
                protocol
            };
        }
    } catch (err) {
        const errorMessage = `Error fetching oracle storage details: ${err}, ${credentialsId}, ${region}`;
        logger.error(errorMessage);
    }
}

async function getOracleDatabaseInstancesSummary(
    accountId: string,
    credentialsId: string,
    activeNodeInstanceId: string,
    region: string,
    databaseInstances: DatabaseInstance[],
    fields?: string,
    resourceDetails?: ResourceDetails,
    standbyNodeInstanceId?: string
) {
    logger.info('Fetching summary of Oracle database instances', {
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

    const getDatabasesWithProtection = fieldsValues?.includes(
        DatabaseHostsQueryFields.DATABASES_WITH_PROTECTION.toLowerCase()
    );
    const shouldQueryDatabaseTopology = fieldsValues?.includes(
        DatabaseHostsQueryFields.DATABASE_INSTANCE_TOPOLOGY.toLowerCase()
    );
    const getPerformanceMetrics = fieldsValues?.includes(DatabaseHostsQueryFields.PERFORMANCE.toLowerCase());
    const getProtectionStatus = fieldsValues?.includes(DatabaseHostsQueryFields.PROTECTION.toLowerCase());
    const getDatabasesWithoutProtection = fieldsValues?.includes(DatabaseHostsQueryFields.DATABASES.toLowerCase());
    const getDbCount = fieldsValues?.includes(DatabaseHostsQueryFields.DB_COUNT.toLowerCase());
    const getStorage = fieldsValues?.includes(DatabaseHostsQueryFields.STORAGE.toLowerCase());
    const getDbNodeTopology = fieldsValues?.includes(DatabaseHostsQueryFields.NODE_TOPOLOGY.toLowerCase());

    // Run for all instances
    const results = await Promise.all(
        databaseInstances.map(async databaseInstance => {
            let performanceData: any;
            let databaseInstancetopologyData: any;
            let protectionData: any;
            let databasesCount: any;
            let databases: any;
            let resourceTrendsData: any;
            let storage: any;
            let nodeTopology: any;
            const errormessages: { [index: string]: string } = {};
            const dbInstanceSid = databaseInstance.database_instance_name; // In Oracle database instance name is same as sid
            const metadata = databaseInstance?.metadata as
                | { mountPointDetails?: { mountIp?: string; mountPoint?: string; protocol?: string } }
                | undefined;

            const demoMountPointDetails = {
                mountIp: '10.0.0.0',
                mountPoint: '/oradata',
                protocol: 'iSCSI'
            };
            let mountPointDetails = isDemo() ? demoMountPointDetails : metadata?.mountPointDetails;

            // Get the storage & mount point details for registered Oracle database instances
            if (!mountPointDetails && (getProtectionStatus || getDatabasesWithProtection)) {
                mountPointDetails = await getRegisteredOracleInstanceStorageDetails(
                    accountId,
                    credentialsId,
                    region,
                    activeNodeInstanceId,
                    databaseInstance.fsxn_ids,
                    dbInstanceSid
                );
            }

            let { mountIp, mountPoint, protocol } = mountPointDetails || {};
            if (protocol === 'iSCSI') {
                mountPoint = encodeURIComponent(mountPoint!); // mount point in case of iscsi is serial number of lun, it can have special characters (like ], [ ) which needs to be encoded
            }

            try {
                [
                    databaseInstancetopologyData,
                    performanceData,
                    protectionData,
                    databasesCount,
                    databases,
                    resourceTrendsData,
                    storage,
                    nodeTopology
                ] = await Promise.all(
                    [
                        ...(shouldQueryDatabaseTopology
                            ? [
                                  getDatabaseInstanceTopology(
                                      accountId,
                                      credentialsId,
                                      region,
                                      activeNodeInstanceId,
                                      databaseInstance,
                                      DatabaseTypes.ORACLE
                                  )
                              ]
                            : [Promise.resolve()]),
                        ...(getPerformanceMetrics
                            ? [
                                  getOraclePerformanceMetrics(
                                      accountId,
                                      credentialsId,
                                      region,
                                      activeNodeInstanceId,
                                      dbInstanceSid
                                  )
                              ]
                            : [Promise.resolve()]),
                        ...(getProtectionStatus || getDatabasesWithProtection
                            ? [
                                  getOracleProtectionStatus(
                                      accountId,
                                      credentialsId,
                                      region,
                                      activeNodeInstanceId,
                                      databaseInstance.fsxn_ids,
                                      dbInstanceSid,
                                      mountIp,
                                      mountPoint,
                                      protocol
                                  )
                              ]
                            : [Promise.resolve()]),
                        ...(getDbCount
                            ? [
                                  getOracleDatabaseCount(
                                      accountId,
                                      credentialsId,
                                      region,
                                      activeNodeInstanceId,
                                      dbInstanceSid
                                  )
                              ]
                            : [Promise.resolve()]),
                        ...(getDatabasesWithoutProtection || getDatabasesWithProtection
                            ? [
                                  getOracleDatabasesList(
                                      accountId,
                                      credentialsId,
                                      region,
                                      activeNodeInstanceId,
                                      dbInstanceSid
                                  )
                              ]
                            : [Promise.resolve()]),
                        ...(getPerformanceMetrics
                            ? [
                                  getSqlInstanceUtilizationAndPerformance(
                                      accountId,
                                      region,
                                      credentialsId,
                                      activeNodeInstanceId,
                                      [dbInstanceSid],
                                      DatabaseTypes.ORACLE
                                  )
                              ]
                            : [Promise.resolve()]),
                        ...(getStorage
                            ? [getStorageData(databaseInstance.resource, databaseInstance)]
                            : [Promise.resolve()]),
                        ...(getDbNodeTopology
                            ? [
                                  getNodeTopology(
                                      accountId,
                                      region,
                                      resourceDetails?.resource_id || databaseInstance?.resource?.resource_id,
                                      databaseInstance?.resource,
                                      activeNodeInstanceId,
                                      standbyNodeInstanceId
                                  )
                              ]
                            : [Promise.resolve()])
                    ].map((p, index) =>
                        p.catch(error => {
                            if (ORACLE_DATABASE_INSTANCE_INDEX_MAPPING[index]) {
                                errormessages[ORACLE_DATABASE_INSTANCE_INDEX_MAPPING[index]] = JSON.stringify(error);
                            }
                            logger.error(`Error while fetching data: ${error}.`);
                        })
                    )
                );
            } catch (error) {
                logger.error(`Error while fetching Oracle database instance summary ${accountId}, ${error}`);
                throw createError(
                    HttpErrorCodes.INTERNAL_SERVER_ERROR,
                    `Error while fetching Oracle database instance summary ${accountId}, ${error}`
                );
            }

            const { database_instance_id: databaseInstanceId, database_instance_name: databaseInstanceName } =
                databaseInstance;

            const databaseInstanceDetails: DatabaseHostInstanceSummaryResponseType = {
                databaseInstanceId,
                databaseInstanceName,
                status: ''
            };

            databaseInstanceDetails.status = ServerState.UP;

            if (getPerformanceMetrics && performanceData) {
                databaseInstanceDetails.performance = getPerformanceMetrics
                    ? { assessment: performanceData?.assessment, rwMetrics: performanceData! }
                    : {};
            }
            if (shouldQueryDatabaseTopology && databaseInstancetopologyData) {
                databaseInstanceDetails.databaseInstanceTopology = databaseInstancetopologyData;
            }
            databaseInstanceDetails.sqlServerDeploymentType = 'Standalone';

            if (getProtectionStatus && protectionData) {
                databaseInstanceDetails.protection = protectionData;
            }
            if (!isEmpty(errormessages)) {
                databaseInstanceDetails.errors = errormessages;
            }

            if (getDatabasesWithoutProtection || getDatabasesWithProtection) {
                databaseInstanceDetails.databases = databases;
            }
            if (getDbCount) {
                databaseInstanceDetails.databaseCount = databasesCount;
            }

            if (resourceTrendsData?.[dbInstanceSid] && getPerformanceMetrics) {
                const instanceResourceTrendsData = resourceTrendsData?.[dbInstanceSid] || {};
                databaseInstanceDetails.performance = {
                    rwMetrics: {
                        latency: {
                            read: instanceResourceTrendsData.readLatency,
                            write: instanceResourceTrendsData.writeLatency
                        },
                        iops: {
                            read: instanceResourceTrendsData.readIops,
                            write: instanceResourceTrendsData.writeIops
                        },
                        throughput: {
                            read: instanceResourceTrendsData.readThroughput,
                            write: instanceResourceTrendsData.writeThroughput
                        }
                    }
                };
            }

            if (getStorage && storage) {
                databaseInstanceDetails.storage = storage;
            }

            if (getDbNodeTopology && nodeTopology) {
                databaseInstanceDetails.nodeTopology = omit(nodeTopology, [
                    'activeDirectoryDetails'
                ]) as NodeTopologyResponseType;
            }

            return databaseInstanceDetails;
        })
    );

    return results;
}

async function getOracleDatabaseHostInstanceSummary(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    fields?: string
): Promise<DatabaseHostInstanceSummaryResponseType> {
    logger.info('Fetching details about a database host instance ', accountId, databaseHostId, databaseInstanceId);

    const instanceResult = await getPaginatedDatabaseInstances(accountId, {
        resourceId: databaseHostId,
        credentialsId,
        databaseInstanceId,
        region,
        shouldIncludeResource: true
    });
    const [databaseInstance] = instanceResult.items as DatabaseInstance[];
    const resourceDetails = databaseInstance.resource;
    const activeNodeInstanceId = (resourceDetails?.metadata as Metadata)?.node1InstanceId;
    let databaseInstanceSummary: DatabaseHostInstanceSummaryResponseType;
    try {
        const connectionStatus = await getSSMConnectionStatus(credentialsId, region!, activeNodeInstanceId, accountId);
        if (connectionStatus.Status !== ConnectionStatus.CONNECTED) {
            const errorMessage = `SSM connection is not available for node ${activeNodeInstanceId} in account ${accountId}.`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }
        const { activeNodeDetails } = await getOracleInstanceDetails(
            accountId,
            credentialsId,
            region,
            activeNodeInstanceId,
            { fetchServerDetails: true, oracleSid: databaseInstance.database_instance_name }
        );
        [databaseInstanceSummary] = await getOracleDatabaseInstancesSummary(
            accountId,
            credentialsId,
            activeNodeInstanceId,
            region,
            [databaseInstance],
            fields,
            resourceDetails
        );
        databaseInstanceSummary.databaseServer = {
            operatingSystem:
                activeNodeDetails?.prettyName ?? `${activeNodeDetails?.name} ${activeNodeDetails?.version}`,
            serverEdition: `Oracle ${activeNodeDetails?.serverEdition}`,
            serverVersion: activeNodeDetails?.serverVersion,
            activeNode: activeNodeDetails?.activeNode,
            nodeNames: [activeNodeDetails?.nodeNames],
            activeConnections: activeNodeDetails?.activeConnections,
            creationDate: activeNodeDetails?.creationDate
        };
        return {
            tenancy: (resourceDetails?.metadata as Metadata)?.oracleDeploymentType,
            ...databaseInstanceSummary
        };
    } catch (error) {
        const errorMessage = `Error while fetching database host instance details for host ${databaseHostId} and instance ${databaseInstanceId} in account ${accountId}, ${error}`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `${errorMessage}`);
    }
}

async function getOracleDatabaseMappedVolumes(
    accountId: string,
    credentialsId: string,
    region: string,
    resourceId: string,
    databaseInstanceId?: string,
    resourceDetail?: ResourceDetails
) {
    logger.info('Fetch mapped volume data for oracle DBs', { accountId, credentialsId, region, resourceId });
    try {
        if (!resourceDetail?.database_instances?.length) {
            [resourceDetail] = await listResources({
                accountId,
                resourceId,
                credentialIds: credentialsId,
                region,
                resourceType: DatabaseTypes.ORACLE,
                includeDatabaseInstances: true
            });
            if (!resourceDetail) {
                const errorMessage = `No database host by id ${resourceId} for ${accountId} is found.`;
                logger.error(errorMessage);
                throw Error(errorMessage);
            }
        }

        const databaseInstances = databaseInstanceId
            ? resourceDetail.database_instances?.filter(di => di.database_instance_id === databaseInstanceId)
            : resourceDetail.database_instances;
        if (!databaseInstances || databaseInstances.length === 0) {
            const errorMessage = `No database instances found for resource ${resourceId} in account ${accountId}.`;
            logger.error(errorMessage);
            throw Error(errorMessage);
        }

        const fsxnIds = resourceDetail.database_instances?.flatMap(di => (di.fsxn_ids ? di.fsxn_ids.split(',') : []));
        const fsxnToDatabaseInstancesMap = new Map<string, DatabaseInstance[]>();
        fsxnIds?.forEach(fsxnId => {
            const matchingInstances = databaseInstances.filter(di =>
                di.fsxn_ids?.replace(/\s+/g, '').split(',').includes(fsxnId)
            );
            if (matchingInstances.length > 0) {
                fsxnToDatabaseInstancesMap.set(fsxnId, matchingInstances);
            }
        });

        const { node1InstanceId = '' } = (resourceDetail?.metadata as Metadata) || {};

        if (!node1InstanceId) {
            const errorMessage = `No EC2 instance id found for resource ${resourceId} in account ${accountId}.`;
            logger.error(errorMessage);
            throw Error(errorMessage);
        }
        if (fsxnToDatabaseInstancesMap.size === 0) {
            const errorMessage = `No FSxN found for resource ${resourceId} in account ${accountId}.`;
            logger.error(errorMessage);
            throw Error(errorMessage);
        }

        const [mappedVolRes] = await Promise.all(
            Array.from(fsxnToDatabaseInstancesMap.entries()).map(async ([fsxId, mappedDatabaseInstances]) => {
                try {
                    const oracleSids = mappedDatabaseInstances.map(di => di.database_instance_id);
                    const mappedVolCommand = getMappedOntapDataVolumeForInstance(
                        node1InstanceId,
                        oracleSids,
                        fsxId,
                        region
                    );
                    const ssmResponse = await callSsmExecution(
                        credentialsId,
                        region,
                        [mappedVolCommand],
                        node1InstanceId,
                        'Get mapped volume details for Oracle db',
                        accountId,
                        undefined,
                        undefined,
                        undefined,
                        SSM_RUN_SHELL_SCRIPT_DOC,
                        SSM_RUN_SHELL_SCRIPT_DOC_VERSION
                    );
                    const parsedMappedVolRes: OracleInstanceMountpointResponse = sqlResponseParsing(ssmResponse);
                    const instanceToFsxnMap = new Map<string, Map<string, OracleInstanceMountpointResponse>>();
                    mappedDatabaseInstances.forEach(instance => {
                        const instanceId = instance.database_instance_id;
                        if (!instanceToFsxnMap.has(instanceId)) {
                            instanceToFsxnMap.set(instanceId, new Map<string, OracleInstanceMountpointResponse>());
                        }
                        instanceToFsxnMap.get(instanceId)!.set(fsxId, parsedMappedVolRes);
                    });
                    return instanceToFsxnMap;
                } catch (error) {
                    logger.error(`Error processing fsxnId ${fsxId}:`, error);
                }
            })
        );

        if (!mappedVolRes || mappedVolRes.size === 0) {
            const errorMessage = `No mapped volume data found for resource ${resourceId},  in account ${accountId}.`;
            logger.error(errorMessage);
            throw Error(errorMessage);
        }

        Array.from(mappedVolRes.keys()).forEach(async oracleSid => {
            const res = Object.fromEntries(mappedVolRes.get(oracleSid)?.entries() ?? []);
            createDatabaseInstanceConfigData([
                {
                    account_id: accountId,
                    credentials_id: credentialsId,
                    region,
                    resource_id: resourceId,
                    database_instance_id: oracleSid,
                    creation_time: new Date(),
                    last_updated: new Date(),
                    config_data_type: AssessmentCategories.MAPPED_ONTAP_VOLUMES,
                    config_data: res
                }
            ]);
        });
        return mappedVolRes;
    } catch (err) {
        const errorMessage = `Error fetching oracle instance mapped volume information ${credentialsId},${region}, ${err}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

export {
    getOracleInstanceDetails,
    getOracleDatabaseInstancesSummary,
    getOracleDatabaseInstancesDetails,
    getOraclePerformanceMetrics,
    getOracleProtectionStatus,
    getOracleDatabaseMappedVolumes,
    getOracleDatabaseHostInstanceSummary
};
