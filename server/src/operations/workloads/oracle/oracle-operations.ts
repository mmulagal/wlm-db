import createError from 'http-errors';
import { compact, isEmpty, omit, uniq } from 'lodash-es';
import { ConnectionStatus } from '@aws-sdk/client-ssm';
import {
    DatabaseHostsQueryFields,
    DatabaseTypes,
    HttpErrorCodes,
    OFFLINE,
    ONLINE,
    ORACLE_DATABASE_INSTANCE_INDEX_MAPPING,
    ORACLE_INSTANCE_STATE,
    ServerState,
    STORAGE_PROTOCOLS
} from '../../../utils/consts';
import getLogger from '../../../utils/logger';
import { callSsmExecution, getSSMConnectionStatus } from '../../aws/ssm-operations';
import {
    CDB,
    ORACLE_DEFAULT_PDB,
    ORACLE_DEPLOYMENT_ARCHITECTURE,
    OracleDeploymentTenacy,
    PDB,
    SSM_RUN_SHELL_SCRIPT_DOC,
    SSM_RUN_SHELL_SCRIPT_DOC_VERSION
} from './consts';
import {
    parseMultipleCommandResponse,
    sqlResponseParsing,
    IS_DEMO_FLOW,
    summarizeFirstLevel
} from '../../../utils/utils';
import {
    DatabaseHostInstanceSummaryResponseType,
    DatabasesResponseType,
    NodeTopologyResponseType
} from '../../../routes/types/database-hosts.types';
import {
    DatabaseInstance,
    DatabaseInstanceMetadata,
    Metadata,
    OracleInstanceDetails,
    ResourceDetails
} from '../../../utils/common-types';
import {
    GET_ORACLE_SERVER_DETAILS,
    getOracleInstanceData,
    getOracleProtectionData,
    ORACLE_PERFORMANCE_METRICS,
    oracleStorageInfoFromOntap
} from './oracle-ssm-script-utils';
import { getDatabaseInstanceTopology, parseMappedVolumeData } from '../../../utils/sql-utils';
import { isFsxnAwsBackupEnabled } from '../../aws/fsx-operations';
import {
    fetchOracleDatabasesCount,
    fetchOracleDatabasesDetails,
    getMappedOntapDataVolumeForInstance,
    getStorageDetailsForRegisteredInstances
} from './oracle-discover-scripts';
import { getSqlInstanceUtilizationAndPerformance } from '../../aws/cloud-watch-operations';
import { listResources } from '../../../lib/database/db';
import {
    createDatabaseInstanceConfigData,
    listDatabaseInstanceConfigData
} from '../../../lib/database/database-instance-config';
import { AssessmentCategories } from '../../../utils/continous-optimization-consts';
import { MountPointDetails, OracleInstanceMountpointResponse } from './common-types';
import { getPaginatedDatabaseInstances } from '../../database/database-operations';
import { getNodeTopology, getStorageData } from '../../database-hosts-util';
import { PDB_DETAILS } from '../../../utils/demo-utils/demoMockdata';

const YES = 'YES';
const NO = 'NO';
const logger = getLogger();

type ontapStorageSummary = {
    size: number;
    used: number;
    physicalUsed: number;
    ssdUsed: number;
    capacityPoolUsed: number;
    snapshotUsed: number;
};

async function getOracleInstanceDetails(
    accountId: string,
    credentialId: string,
    region: string,
    node1InstanceId: string,
    options: { fetchServerDetails?: boolean; oracleSids?: string[] } = { fetchServerDetails: false, oracleSids: [] }
) {
    logger.info('Fetching Oracle instance details', { accountId, credentialId, region, node1InstanceId });
    const { fetchServerDetails = false, oracleSids = [] } = options;
    const ssmResponse = await getOracleInstanceInfo(accountId, credentialId, region, [node1InstanceId], {
        fetchServerDetails,
        oracleSids
    });
    let [parsedResponse, activeNodeDetails] = parseMultipleCommandResponse(ssmResponse || '[]');

    if (IS_DEMO_FLOW && fetchServerDetails) {
        activeNodeDetails = Object.fromEntries(oracleSids.map(sid => [sid, activeNodeDetails]));
    }

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
    options: { fetchServerDetails?: boolean; oracleSids: string[] } = { fetchServerDetails: false, oracleSids: [] }
) {
    logger.info('Fetching oracle instance info', { accountId, nodeIds });
    const { fetchServerDetails = false, oracleSids } = options;
    const commands = [getOracleInstanceData(nodeIds[0])];
    if (fetchServerDetails) {
        commands.push(GET_ORACLE_SERVER_DETAILS(oracleSids, nodeIds[0]));
    }
    const comment = 'oracle instance info';
    let response;
    try {
        for await (const nodeId of nodeIds) {
            response = await callSsmExecution({
                credentialsId,
                region,
                commands,
                ec2InstanceId: nodeId,
                comment,
                accountId,
                documentName: SSM_RUN_SHELL_SCRIPT_DOC,
                documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION,
                cacheData: true
            });
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

function getOracleDatabaseInstancesDetails(
    credentialsId: string,
    region: string,
    instancesManaged: DatabaseInstance[],
    resourceId: string,
    instanceDetails?: OracleInstanceDetails[] | undefined
) {
    logger.info('Getting oracle database Instances details for resource', {
        credentialsId,
        region,
        instancesManaged: instancesManaged?.length ?? 0,
        resourceId
    });

    const managedInstancesName = instancesManaged.map((item: DatabaseInstance) => ({
        instanceName: item.database_instance_name,
        isDefault: item.is_default,
        instanceState: IS_DEMO_FLOW ? ServerState.UP : ServerState.DOWN,
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
        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: [command],
            ec2InstanceId: node1InstanceId,
            comment,
            accountId,
            documentName: SSM_RUN_SHELL_SCRIPT_DOC,
            documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        });
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
        const errorMessage = `Error fetching oracle performance metrics: ${err}, ${credentialsId}, ${region}. If default auth is not enabled on the instance, performance metrics will not be available unless instance is registered.`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

async function parseProtectionDetails(credentialsId: string, region: string, fsxnId: string, protectionDetails: any) {
    const { ontapProtectionDetails, isNativeProtectionEnabled, error } = protectionDetails;
    if (error) {
        throw error;
    }
    const records = ontapProtectionDetails?.records[0];
    const { snapshot_count: snapshotCount, uuid } = records;
    const backupStatus = await isFsxnAwsBackupEnabled(credentialsId, region, fsxnId, [uuid]);
    const volumeUuidsInBackups = backupStatus?.volumeUuidsInBackups || [];
    const fsxnBackup = IS_DEMO_FLOW ? true : volumeUuidsInBackups.includes(uuid);
    return {
        isSqlNativeBackupEnabled: IS_DEMO_FLOW ? true : isNativeProtectionEnabled === 'true', // TODO: why is this string?
        isAwsBackupEnabled: { fsxn: fsxnBackup },
        isFsxOntapSnapshotsEnabled: IS_DEMO_FLOW ? true : snapshotCount > 0
    };
}

async function getOracleProtectionStatus(
    accountId: string,
    credentialsId: string,
    region: string,
    node1InstanceId: string,
    fsxnId: string,
    dbInstanceSid: string,
    mountPointDetails: MountPointDetails[][],
    isCDB: string = NO,
    pdbNames: string[] = []
) {
    logger.info('Fetching Oracle db protection status', { accountId, credentialsId, region, node1InstanceId });

    try {
        if (isEmpty(mountPointDetails) || (isCDB === YES && mountPointDetails?.length !== pdbNames?.length)) {
            throw createError(
                HttpErrorCodes.BAD_REQUEST,
                `Missing mountpoints for: ${fsxnId}, ${credentialsId}, ${region}`
            );
        }

        const commands = [];
        if (isCDB === YES && pdbNames?.length > 0) {
            mountPointDetails?.forEach(mountPointDetail => {
                const [{ mountIP, mountPoint, protocol }] = mountPointDetail;
                if (!mountIP || !mountPoint || !protocol) {
                    throw createError(
                        HttpErrorCodes.BAD_REQUEST,
                        `Missing mountIp, junctionPath or protocol for fsxnId: ${fsxnId}, ${credentialsId}, ${region}`
                    );
                }
                commands.push(
                    getOracleProtectionData(
                        fsxnId,
                        region,
                        mountIP,
                        mountPoint,
                        protocol,
                        dbInstanceSid,
                        node1InstanceId
                    )
                );
            });
        } else {
            const [[{ mountIP, mountPoint, protocol }]] = mountPointDetails;
            commands.push(
                getOracleProtectionData(
                    fsxnId,
                    region,
                    mountIP!,
                    mountPoint!,
                    protocol!,
                    dbInstanceSid,
                    node1InstanceId
                )
            );
        }

        const comment = 'oracle protection status';
        const response = await callSsmExecution({
            credentialsId,
            region,
            commands,
            ec2InstanceId: node1InstanceId,
            comment,
            accountId,
            documentName: SSM_RUN_SHELL_SCRIPT_DOC,
            documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        });
        if (response) {
            const protectionResponse: any = {};
            const parsedResponse = parseMultipleCommandResponse(response);

            if (isCDB === YES) {
                let commonIsSqlNativeBackupEnabled = false;
                let commonIsFsxOntapSnapshotsEnabled = false;
                let commonIsAwsBackupEnabled = false;
                const parsedDetailsPromises = parsedResponse.map(protectionDetail =>
                    parseProtectionDetails(credentialsId, region, fsxnId, protectionDetail)
                );
                const allParsedDetails = await Promise.all(parsedDetailsPromises);
                allParsedDetails?.forEach((parsedDetails, idx) => {
                    protectionResponse[pdbNames[idx]] = parsedDetails;
                    commonIsAwsBackupEnabled = parsedDetails.isAwsBackupEnabled.fsxn || commonIsAwsBackupEnabled;
                    commonIsSqlNativeBackupEnabled =
                        parsedDetails.isSqlNativeBackupEnabled || commonIsSqlNativeBackupEnabled;
                    commonIsFsxOntapSnapshotsEnabled =
                        parsedDetails.isFsxOntapSnapshotsEnabled || commonIsFsxOntapSnapshotsEnabled;
                });
                protectionResponse[dbInstanceSid] = {
                    isSqlNativeBackupEnabled: commonIsSqlNativeBackupEnabled,
                    isAwsBackupEnabled: { fsxn: commonIsAwsBackupEnabled },
                    isFsxOntapSnapshotsEnabled: commonIsFsxOntapSnapshotsEnabled
                };
            } else {
                protectionResponse[dbInstanceSid] = await parseProtectionDetails(
                    credentialsId,
                    region,
                    fsxnId,
                    parsedResponse[parsedResponse.length - 1]
                );
            }
            return protectionResponse;
        }
    } catch (err) {
        const errorMessage = `Error fetching oracle protection status: ${err}, ${credentialsId}, ${region}. If default auth is not enabled on the instance, protection status will not be available unless instance is registered.`;
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
        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: [command],
            ec2InstanceId,
            comment,
            accountId,
            documentName: SSM_RUN_SHELL_SCRIPT_DOC,
            documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        });

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
        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: [command],
            ec2InstanceId,
            comment,
            accountId,
            documentName: SSM_RUN_SHELL_SCRIPT_DOC,
            documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        });

        if (response) {
            const parsedResponse = sqlResponseParsing(response);
            const {
                database_details: databaseDetails,
                is_cdb: isCDB,
                pdbs_status: pdbsStatus,
                pdbs_size: pdbsSize,
                root_db_size: rootDbSize,
                service_name: serviceName
            } = parsedResponse;

            if (parsedResponse?.error) {
                throw Error(parsedResponse.error);
            }

            const databases = [];

            // If there are no PDBs, it's a single tenant database
            databases.push({
                name: databaseDetails?.name,
                size: rootDbSize,
                status: databaseDetails?.status?.toUpperCase() === ONLINE ? ONLINE : OFFLINE,
                type: isCDB === YES ? CDB : ORACLE_DEPLOYMENT_ARCHITECTURE.SINGLE_TENANT
            });

            if (isCDB === YES) {
                for (const pdb of pdbsStatus) {
                    const pdbName = pdb.pdb_name;
                    const status = pdb.status?.toUpperCase() || OFFLINE;
                    const pdbSize = pdbsSize[pdbName] || 0; // Default to 0 if size is not found
                    if (pdbName !== ORACLE_DEFAULT_PDB) {
                        databases.push({
                            name: pdbName,
                            size: pdbSize,
                            status: status === ONLINE ? ONLINE : OFFLINE,
                            created: pdb.creation_time,
                            type: PDB,
                            service: isEmpty(serviceName) ? 'n/a' : serviceName
                        });
                    }
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
        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: [command],
            ec2InstanceId: node1InstanceId,
            comment,
            accountId,
            documentName: SSM_RUN_SHELL_SCRIPT_DOC,
            documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        });
        if (response) {
            const parsedResponse = sqlResponseParsing(response);
            const { storage_details: mountPointDetails, is_cdb: isCDB, pdb_names: pdbNames } = parsedResponse;
            if (isEmpty(mountPointDetails?.flat())) {
                throw createError(
                    HttpErrorCodes.NOT_FOUND,
                    `No storage details found for fsxnId: ${fsxnId}, ${credentialsId}, ${region}`
                );
            }

            return {
                mountPointDetails,
                isCDB,
                pdbNames
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
    standbyNodeInstanceId?: string,
    getOracleHostSummary?: boolean
) {
    logger.info('Fetching summary of Oracle database instances', {
        accountId,
        credentialsId,
        activeNodeInstanceId,
        region,
        databaseInstances: summarizeFirstLevel(databaseInstances),
        fields,
        resourceDetails,
        standbyNodeInstanceId,
        getOracleHostSummary
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

    // Run getOracleStorageInfoFromOntap concurrently with databaseInstances.map
    const [storageInfoFromOntap, hostInfo, results] = await Promise.all([
        getStorage ? getOracleStorageInfoFromOntap(activeNodeInstanceId, databaseInstances) : Promise.resolve(),
        getOracleInstanceDetails(accountId, credentialsId, region, activeNodeInstanceId, {
            fetchServerDetails: true,
            oracleSids: databaseInstances.map(db => db.database_instance_id)
        }),
        Promise.all(
            databaseInstances.map(async databaseInstance => {
                let performanceData: any;
                let databaseInstancetopologyData: any;
                let protectionData: any;
                let databasesCount: any;
                let databases: any;
                let resourceTrendsData: any;
                let storage: any;
                let nodeTopology: any;
                let isASMManaged: boolean = false;
                const errormessages: { [index: string]: string } = {};
                const dbInstanceSid = databaseInstance.database_instance_name; // In Oracle database instance name is same as sid
                const metadata = databaseInstance?.metadata as
                    | { mountPointDetails?: { mountIp?: string; mountPoint?: string; protocol?: string } }
                    | undefined;

                const demoMountPointDetails = [
                    [
                        {
                            mountIP: '10.0.0.0',
                            mountPoint: '/oradata',
                            protocol: 'iSCSI'
                        }
                    ]
                ];
                let mountPointDetails = IS_DEMO_FLOW ? demoMountPointDetails : metadata?.mountPointDetails;
                databaseInstance.storage_type = resourceDetails?.storage_type;
                let isCDB = NO;
                let pdbNames: string[] = [];

                // Get the storage & mount point details for registered Oracle database instances
                if (!mountPointDetails && (getProtectionStatus || getDatabasesWithProtection || IS_DEMO_FLOW)) {
                    const storageDetails = await getRegisteredOracleInstanceStorageDetails(
                        accountId,
                        credentialsId,
                        region,
                        activeNodeInstanceId,
                        databaseInstance.fsxn_ids,
                        dbInstanceSid
                    );
                    if (storageDetails) {
                        mountPointDetails = storageDetails.mountPointDetails;
                        isCDB = storageDetails.isCDB;
                        pdbNames = storageDetails.pdbNames;
                        isASMManaged =
                            storageDetails?.mountPointDetails?.some((m: MountPointDetails) => m.isAsmManaged) ?? false;
                    }
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
                                          mountPointDetails as MountPointDetails[][],
                                          isCDB,
                                          pdbNames
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
                                          [dbInstanceSid]
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
                                    errormessages[ORACLE_DATABASE_INSTANCE_INDEX_MAPPING[index]] =
                                        JSON.stringify(error);
                                }
                                logger.error(`Error while fetching data: ${error}.`);
                            })
                        )
                    );
                    if (IS_DEMO_FLOW && databases?.length && databaseInstance?.metadata) {
                        databases?.forEach((database: DatabasesResponseType) => {
                            database.type =
                                (databaseInstance?.metadata as DatabaseInstanceMetadata)?.oracleDeploymentType ===
                                OracleDeploymentTenacy.MULTI_TENANT
                                    ? CDB
                                    : ORACLE_DEPLOYMENT_ARCHITECTURE.SINGLE_TENANT;
                            if (database.type !== ORACLE_DEPLOYMENT_ARCHITECTURE.SINGLE_TENANT) {
                                databases.push(PDB_DETAILS);
                            }
                        });
                    }
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
                    databaseInstanceDetails.performance = {
                        assessment: performanceData?.assessment,
                        rwMetrics: performanceData!
                    };
                }
                if (shouldQueryDatabaseTopology && databaseInstancetopologyData) {
                    databaseInstanceDetails.databaseInstanceTopology = databaseInstancetopologyData;
                }
                databaseInstanceDetails.sqlServerDeploymentType = 'Standalone';

                if (getProtectionStatus && protectionData) {
                    databaseInstanceDetails.protection = protectionData[dbInstanceSid];
                }
                if (!isEmpty(errormessages)) {
                    databaseInstanceDetails.errors = errormessages;
                }

                if (getDatabasesWithoutProtection || getDatabasesWithProtection) {
                    if (getDatabasesWithProtection) {
                        databases?.forEach((database: DatabasesResponseType) => {
                            if (database.type === CDB) {
                                database.protection = protectionData?.[dbInstanceSid];
                            } else {
                                database.protection = protectionData?.[database?.name] || {
                                    isSqlNativeBackupEnabled: false,
                                    isAwsBackupEnabled: { fsxn: false },
                                    isFsxOntapSnapshotsEnabled: false
                                };
                            }
                        });
                    }
                    databaseInstanceDetails.databases = databases;
                }
                if (getDbCount) {
                    databaseInstanceDetails.databaseCount = databasesCount;
                }

                if (resourceTrendsData?.[dbInstanceSid] && getPerformanceMetrics) {
                    const instanceResourceTrendsData = resourceTrendsData?.[dbInstanceSid] || {};
                    databaseInstanceDetails.performance = {
                        assessment: performanceData?.assessment,
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

                    databaseInstanceDetails.resourceUtilization = {
                        cpu: resourceTrendsData?.[dbInstanceSid].cpuUsed
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
                databaseInstanceDetails.isInstanceStorageAsmManaged = isASMManaged;
                return databaseInstanceDetails;
            })
        )
    ]);

    if (getStorage && storageInfoFromOntap) {
        results?.forEach(result => {
            const { storage_protocol: storageProtocol } =
                databaseInstances.find(db => db.database_instance_id === result.databaseInstanceId) || {};
            result.storage = {
                ...result?.storage,
                ...{
                    fsxn: {
                        ...(IS_DEMO_FLOW
                            ? storageInfoFromOntap.demoOracleSid
                            : storageInfoFromOntap[result.databaseInstanceId]),
                        protocol: storageProtocol?.split(',') ?? []
                    }
                }
            };
        });
    }
    if (hostInfo && !isEmpty(hostInfo)) {
        const { activeNodeDetails } = hostInfo;
        results?.forEach(result => {
            if (result.databaseInstanceId && Object.keys(activeNodeDetails).includes(result.databaseInstanceId)) {
                const nodeDetails = activeNodeDetails[result.databaseInstanceId];
                if (nodeDetails) {
                    if (getOracleHostSummary) {
                        result.databaseServer = {
                            operatingSystem: nodeDetails?.prettyName ?? `${nodeDetails?.name} ${nodeDetails?.version}`,
                            serverEdition: `Oracle ${nodeDetails?.serverEdition}`,
                            serverVersion: nodeDetails?.serverVersion,
                            activeNode: nodeDetails?.activeNode,
                            nodeNames: [nodeDetails?.nodeNames],
                            activeConnections: nodeDetails?.activeConnections,
                            creationDate: nodeDetails?.creationDate
                        };
                    } else {
                        result.platform = nodeDetails?.prettyName ?? `${nodeDetails?.name} ${nodeDetails?.version}`;
                    }
                    result.isInstanceStorageAsmManaged = nodeDetails?.isASMManaged === 'true';
                }
            }
        });
    }

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
    if (isEmpty(instanceResult?.items)) {
        const errorMessage = `No database instance found for host ${databaseHostId} and instance ${databaseInstanceId} in account ${accountId}.`;
        logger.warn(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

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
        [databaseInstanceSummary] = await getOracleDatabaseInstancesSummary(
            accountId,
            credentialsId,
            activeNodeInstanceId,
            region,
            [databaseInstance],
            fields,
            resourceDetails,
            undefined,
            true
        );
        let tenancy = (databaseInstance?.metadata as DatabaseInstanceMetadata)?.oracleDeploymentType;
        if (databaseInstanceSummary?.databases) {
            const isCDB = databaseInstanceSummary.databases.some(db => db.type === 'CDB' || db.type === 'PDB');
            tenancy = isCDB ? OracleDeploymentTenacy.MULTI_TENANT : OracleDeploymentTenacy.SINGLE_TENANT;
        }
        return {
            tenancy,
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
                    const ssmResponse = await callSsmExecution({
                        credentialsId,
                        region,
                        commands: [mappedVolCommand],
                        ec2InstanceId: node1InstanceId,
                        comment: 'Get mapped volume details for Oracle db',
                        accountId,
                        executionTimeout: '300', // the more the # of pdbs in the setup the longer it takes to fetch the details
                        documentName: SSM_RUN_SHELL_SCRIPT_DOC,
                        documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
                    });
                    let parsedMappedVolRes: OracleInstanceMountpointResponse = sqlResponseParsing(ssmResponse);
                    const instanceToFsxnMap = new Map<string, Map<string, OracleInstanceMountpointResponse>>();
                    mappedDatabaseInstances.forEach(instance => {
                        const instanceId = instance.database_instance_id;
                        if (!instanceToFsxnMap.has(instanceId)) {
                            instanceToFsxnMap.set(instanceId, new Map<string, OracleInstanceMountpointResponse>());
                        }
                        if (IS_DEMO_FLOW) {
                            parsedMappedVolRes = {
                                ...parsedMappedVolRes,
                                protocol: instance.storage_protocol,
                                isASMManaged: instance.storage_protocol === STORAGE_PROTOCOLS.ISCSI
                            } as OracleInstanceMountpointResponse;
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

async function getOracleStorageInfoFromOntap(activeNodeInstanceId: string, instanceDetails: DatabaseInstance[]) {
    const ssmComment = 'Get Oracle storage data from ONTAP';
    logger.info(ssmComment, ':', { activeNodeInstanceId, instancesLength: instanceDetails.length });

    try {
        const [
            {
                account_id: accountId,
                credentials_id: credentialsId,
                region,
                resource: { resource_id: resourceId }
            }
        ] = instanceDetails;

        const configList = (await listDatabaseInstanceConfigData({
            accountId,
            credentialsId,
            region,
            resourceId,
            databaseInstanceIds: instanceDetails.map(di => di.database_instance_id),
            configDataType: AssessmentCategories.MAPPED_ONTAP_VOLUMES
        })) || [{}];
        const fsxIds = uniq(compact(instanceDetails.map(di => di.fsxn_ids)));
        const mappedVolumesByFsxId = fsxIds.map(fsxId => {
            const matchingConfigData = configList
                .map(cd => cd.config_data)
                .find(cd => Object.keys(cd as any).includes(fsxId));

            if (!matchingConfigData) {
                logger.warn(`No matching config data found for FSx ID ${fsxId}`);
                return null;
            }

            return parseMappedVolumeData(matchingConfigData, fsxId, DatabaseTypes.ORACLE);
        });

        const mappedByInstances = instanceDetails.map(instance => {
            const mappedVolumesPerInstance = mappedVolumesByFsxId
                .flatMap(mv => mv?.combinedOntapVolumes?.filter(cv => cv.instance === instance.database_instance_id))
                .map(v => v.id);
            return { name: instance.database_instance_id, fsxId: instance.fsxn_ids, volumes: mappedVolumesPerInstance };
        });

        const fields = [
            'space.size',
            'space.used',
            'space.physical_used',
            'space.performance_tier_footprint',
            'space.capacity_tier_footprint',
            'space.snapshot.used'
        ];
        const command = oracleStorageInfoFromOntap({
            region,
            apiEndpoint: 'storage/volumes',
            apiQueryFields: `fields=${fields.join(',')}`,
            instances: mappedByInstances
        });

        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: [command],
            ec2InstanceId: activeNodeInstanceId,
            comment: ssmComment,
            accountId,
            cacheData: true,
            shouldReadFromCloudWatchLogs: true,
            documentName: SSM_RUN_SHELL_SCRIPT_DOC,
            documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        });

        const parsedResponse = sqlResponseParsing(response);
        if (!parsedResponse || isEmpty(parsedResponse)) {
            const errorMessage = `No storage data found from ONTAP for Oracle instances: with ${credentialsId}, ${region}`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
        }

        const instancesResponse: Record<string, ontapStorageSummary> = {};
        Object.entries(parsedResponse).forEach(([instanceName, value]) => {
            const records = (value as { records?: any[] }).records ?? [];
            const storageSummary = records.reduce(
                (acc, { space }) => ({
                    size: (acc.size || 0) + Number(space.size || 0),
                    used: (acc.used || 0) + Number(space.used || 0),
                    physicalUsed: (acc.physicalUsed || 0) + Number(space.physical_used || 0),
                    ssdUsed: (acc.ssdUsed || 0) + Number(space.performance_tier_footprint || 0),
                    capacityPoolUsed: (acc.capacityPoolUsed || 0) + Number(space.capacity_tier_footprint || 0),
                    snapshotUsed: (acc.snapshotUsed || 0) + Number(space.snapshot.used || 0)
                }),
                {} as ontapStorageSummary
            );
            instancesResponse[instanceName] = storageSummary;
        });
        logger.debug('SSM response for Oracle storage data from ONTAP', { instancesResponse });
        return instancesResponse;
    } catch (error) {
        logger.error('Failed executing SSM script to get storage data from ONTAP', { error });
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
