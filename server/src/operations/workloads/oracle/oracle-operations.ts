import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import { ConnectionStatus } from '@aws-sdk/client-ssm';
import {
    DatabaseHostsQueryFields,
    HttpErrorCodes,
    OFFLINE,
    ONLINE,
    ORACLE_DATABASE_INSTANCE_INDEX_MAPPING,
    ORACLE_INSTANCE_STATE,
    ServerState
} from '../../../utils/consts';
import getLogger from '../../../utils/logger';
import { callSsmExecution } from '../../aws/ssm-operations';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from './consts';
import { sqlResponseParsing } from '../../../utils/utils';
import { DatabaseHostInstanceSummaryResponseType } from '../../../routes/types/database-hosts.types';
import { DatabaseInstance, OracleInstanceDetails, ResourceDetails } from '../../../utils/common-types';
import { getOracleInstanceData, getOracleProtectionData, ORACLE_PERFORMANCE_METRICS } from './oracle-ssm-script-utils';
import getDatabaseInstanceTopology from '../../../utils/sql-utils';
import { isFsxnAwsBackupEnabled } from '../../aws/fsx-operations';
import {
    fetchOracleDatabasesCount,
    fetchOracleDatabasesDetails,
    getStorageDetailsForRegisteredInstances
} from './oracle-discover-scripts';

const logger = getLogger();

async function getOracleInstanceDetails(
    accountId: string,
    credentialId: string,
    region: string,
    node1InstanceId: string
) {
    logger.info('Fetching Oracle instance details', { accountId, credentialId, region, node1InstanceId });
    const ssmResponse = await getOracleInstanceInfo(accountId, credentialId, region, [node1InstanceId]);
    const parsedResponse = sqlResponseParsing(ssmResponse || '[]');

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
        instancesDetails: instanceDetails
    };
}

async function getOracleInstanceInfo(accountId: string, credentialsId: string, region: string, nodeIds: string[]) {
    logger.info('Fetching oracle instance info', { accountId, nodeIds });
    const commands = [getOracleInstanceData(nodeIds[0])];
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
        instanceState: ServerState.DOWN,
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

    // Run for all instances
    const results = await Promise.all(
        databaseInstances.map(async databaseInstance => {
            let performanceData: any;
            let databaseInstancetopologyData: any;
            let protectionData: any;
            let databasesCount: any;
            let databases: any;
            const errormessages: { [index: string]: string } = {};
            const dbInstanceSid = databaseInstance.database_instance_name; // In Oracle database instance name is same as sid
            const metadata = databaseInstance?.metadata as
                | { mountPointDetails?: { mountIp?: string; mountPoint?: string; protocol?: string } }
                | undefined;
            let mountPointDetails = metadata?.mountPointDetails;

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
                [databaseInstancetopologyData, performanceData, protectionData, databasesCount, databases] =
                    await Promise.all(
                        [
                            ...(shouldQueryDatabaseTopology
                                ? [
                                      getDatabaseInstanceTopology(
                                          accountId,
                                          credentialsId,
                                          region,
                                          activeNodeInstanceId,
                                          databaseInstance
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
                                : [Promise.resolve()])
                        ].map((p, index) =>
                            p.catch(error => {
                                if (ORACLE_DATABASE_INSTANCE_INDEX_MAPPING[index]) {
                                    errormessages[ORACLE_DATABASE_INSTANCE_INDEX_MAPPING[index]] =
                                        JSON.stringify(error);
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

            return databaseInstanceDetails;
        })
    );

    return results;
}

export {
    getOracleInstanceDetails,
    getOracleDatabaseInstancesSummary,
    getOracleDatabaseInstancesDetails,
    getOraclePerformanceMetrics,
    getOracleProtectionStatus
};
