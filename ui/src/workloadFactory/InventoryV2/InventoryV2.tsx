import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../store/storeHooks';
import styles from './Inventory.module.scss';
import InventoryTab from './InventoryTab/InventoryTab';
import InventoryTablesComponent from './InventoryTablesComponent/InventoryTablesComponent';
import {
    DBType,
    ERROR_ANALYZER_STATUS,
    INVENTORY_ACTIONS,
    INVENTORY_STATUS,
    ORACLE_DATABASES_COMPONENTS,
    PROTECTION_TEXT_STATUS
} from '../../utils/consts';
import { GENERAL } from '../../utils/appConstants';
import { categorizeStorageSize, formatSize, formatSizeTwoPrecision } from '../../utils/utilityFunctions';
import {
    enrichInstancesWithDataGuardFlags,
    enrichDatabasesWithAOAGFlags,
    getDiscoveredHostDeploymentV2,
    getFileSystemName,
    getFsxList,
    getOptimizationStatus,
    getProtectionText,
    groupDataGuardConfigurations,
    groupAOAGConfigurations,
    sortDatabaseTableData,
    sortInstanceTableData,
    sortInventoryTableData,
    uniqueHostRow,
    getDiscoveredHostDeploymentAtHostLevel,
    getAvailabilityGroupListForAoag,
    getAoagTotalReplicaCountPerDatabase
} from './InventoryUtilsV2';
import { setFullInventoryTablesRows, setInventoryTablesRows } from '../../store/workloadFactory/inventoryV2Slice';
import store from '../../store/store';

import MSSQLBanner from './InventoryBanners/MSSQLBanner/MSSQLBanner';
import PGSQLBanner from './InventoryBanners/PGSQLBanner/PGSQLBanner';
import OracleBanner from './InventoryBanners/MSSQLBanner/OracleBanner';
import EngineTypeSelector from '../../common/EngineTypeSelector/EngineTypeSelector';

const InventoryV2 = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const {
        inventoryTableData,
        inProgressInstances,
        removeSecNodeDiscoveredList,
        allmssqlHostAssessmentLoading,
        allOracleHostAssessmentLoading,
        allmssqlHostAssessmentData,
        allOracleHostAssessmentData,
        allLogAnalysisData,
        allLogAnalysisLoading,
        allLogAnalysisOracleLoading,
        selectedHostType,
        fullHostTableRows,
        fullInstanceTableRows,
        fullDatabaseTableRows,
        isManagedHostListLoading,
        fsxCredentialStatusLoading,
        fsxCredentialStatusLoadingOracle
    } = useAppSelector(state => state.inventoryV2);
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { databaseHostsLoading: pgsqlDatabaseHostsLoading, fullHostDataLoading: pgsqlFullHostDataLoading } =
        useAppSelector(state => state.inventoryV2.getPgSqlDatabaseHosts);
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList, multiDataLoading } = useAppSelector(
        state => state.headers
    );
    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(
            databaseHostsLoading ||
                isDiscoverInProgress ||
                fullHostDataLoading ||
                isManagedHostListLoading ||
                fsxCredentialStatusLoading ||
                fsxCredentialStatusLoadingOracle ||
                pgsqlDatabaseHostsLoading ||
                pgsqlFullHostDataLoading ||
                multiDataLoading
        );
    }, [
        databaseHostsLoading,
        isDiscoverInProgress,
        fullHostDataLoading,
        isManagedHostListLoading,
        fsxCredentialStatusLoading,
        fsxCredentialStatusLoadingOracle,
        pgsqlDatabaseHostsLoading,
        pgsqlFullHostDataLoading,
        multiDataLoading
    ]);

    useEffect(() => {
        if (inventoryTableData) {
            const state = store.getState();
            const {
                allmssqlHostAssessmentData: allmssqlHostAssessmentDataLatest,
                allOracleHostAssessmentData: allOracleHostAssessmentDataLatest,
                allLogAnalysisData: allLogAnalysisDataLatest
            } = state.inventoryV2;
            const allHostTableRows: any = [];
            let allInstanceTableRows: any = [];
            let hostUniqueId: number = 0;
            let instanceUniqueId: number = 0;
            const allDatabaseTableRows: any = [];
            Object.keys(inventoryTableData).map((key: string) => {
                if (removeSecNodeDiscoveredList.includes(key)) {
                    return;
                }
                if (inventoryTableData[key]?.action === INVENTORY_ACTIONS.EXPLORE_SAVINGS) {
                    return;
                }
                if (
                    !headerSelectedMultiCredIdsList.includes(inventoryTableData[key]?.credentialId) ||
                    !headerSelectedMultiRegionIdsList.includes(inventoryTableData[key]?.regionId)
                ) {
                    return;
                }
                const instanceList: any = [];
                const instanceNameList: any = [];
                let vpcIdAndNameText = '';
                const allocatedCapacity = inventoryTableData[key]?.allocatedCapacity || '';
                inventoryTableData[key]?.ec2Details?.map((row: any) => {
                    if (row?.name) {
                        instanceNameList.push(row?.name);
                    }
                    if (row?.name && row?.id) {
                        instanceList.push(`${row?.name} | ID: ${row?.id}`);
                    } else if (row?.id) {
                        instanceList.push(`${GENERAL.NOT_AVAILABLE} | ID: ${row?.id}`);
                    }
                });
                if (inventoryTableData[key]?.vpcId && inventoryTableData[key]?.vpcName) {
                    vpcIdAndNameText = `${inventoryTableData[key]?.vpcName} | ID: ${inventoryTableData[key]?.vpcId}`;
                } else if (inventoryTableData[key]?.vpcId) {
                    vpcIdAndNameText = `${GENERAL.NOT_AVAILABLE} | ID: ${inventoryTableData[key]?.vpcId}`;
                } else {
                    vpcIdAndNameText = `${GENERAL.NOT_AVAILABLE} | ID: ${GENERAL.NOT_AVAILABLE}`;
                }
                const serverAllInstallationModeList = getDiscoveredHostDeploymentAtHostLevel(
                    inventoryTableData[key],
                    t
                );

                const rowData = {
                    ...inventoryTableData[key],
                    id: String(hostUniqueId++),
                    sqlServerInstancesText:
                        inventoryTableData[key]?.totalInstance !== 0
                            ? `${inventoryTableData[key]?.managedInstance} out of ${inventoryTableData[key]?.totalInstance}`
                            : '',
                    instanceListText: instanceList.join(','),
                    instanceNameListText: instanceNameList.join(', '),
                    vpcIdAndNameText,
                    allocatedCapacityText: allocatedCapacity ? formatSizeTwoPrecision(allocatedCapacity) : '',
                    nameForSorting: inventoryTableData[key]?.name?.toLowerCase(),
                    serverAllInstallationModeText: serverAllInstallationModeList
                        ? serverAllInstallationModeList.join(', ')
                        : inventoryTableData[key]?.serverInstallationMode
                };
                if (inventoryTableData[key]?.hostType === DBType.ORACLE) {
                    rowData.platform = inventoryTableData[key]?.platform || GENERAL.NOT_AVAILABLE;
                }
                allHostTableRows.push(rowData);

                // Instance table
                if (inventoryTableData?.[key] && inventoryTableData?.[key]?.sqlServerInstances) {
                    const perHost = inventoryTableData?.[key];
                    let optimizationStatusLoading = false;
                    let optimizationStatusList: any = [];
                    if (inventoryTableData?.[key]?.hostType === DBType.MSSQL) {
                        const assessRow = allmssqlHostAssessmentDataLatest?.filter(
                            (perRow: any) =>
                                uniqueHostRow(perRow?.databaseHostId, perRow?.credentialId, perRow?.regionId) === key
                        );
                        if (assessRow.length > 0) {
                            optimizationStatusLoading = allmssqlHostAssessmentLoading;
                            optimizationStatusList = assessRow?.[0]?.instancesAssessment;
                        }
                    } else if (inventoryTableData?.[key]?.hostType === DBType.ORACLE) {
                        const assessRow = allOracleHostAssessmentDataLatest?.filter(
                            (perRow: any) =>
                                uniqueHostRow(perRow?.databaseHostId, perRow?.credentialId, perRow?.regionId) === key
                        );
                        if (assessRow.length > 0) {
                            optimizationStatusLoading = allOracleHostAssessmentLoading;
                            optimizationStatusList = assessRow?.[0]?.instancesAssessment;
                        }
                    }

                    const perInstanceData: any = [];
                    inventoryTableData?.[key]?.sqlServerInstances?.map((perRow: any) => {
                        if (
                            perRow?.fileSystemType === GENERAL.EBS ||
                            perRow?.fileSystemType === GENERAL.FSX_FOR_WINDOWS
                        ) {
                            return;
                        }
                        const protectionText = getProtectionText(perRow);
                        let optimizationStatus = '';
                        optimizationStatus = getOptimizationStatus(
                            perRow?.databaseInstanceId,
                            optimizationStatusList,
                            inventoryTableData?.[key]?.hostType || ''
                        );

                        const fileSystemName = getFileSystemName(perRow);

                        const fsxList = getFsxList(perRow);

                        // assessment loading for mssql and oracle
                        if (
                            perRow?.statusColText === INVENTORY_STATUS.MANAGED &&
                            inventoryTableData?.[key]?.hostType === DBType.MSSQL
                        ) {
                            optimizationStatusLoading = allmssqlHostAssessmentLoading;
                        } else if (
                            perRow?.statusColText === INVENTORY_STATUS.MANAGED &&
                            inventoryTableData?.[key]?.hostType === DBType.ORACLE
                        ) {
                            optimizationStatusLoading = allOracleHostAssessmentLoading;
                        }

                        const managementStatus = inProgressInstances.has(
                            uniqueHostRow(
                                `${perHost?.ec2InstanceId}_${perRow.databaseInstanceName}`,
                                perHost?.credentialId || '',
                                perHost?.regionId || ''
                            )
                        )
                            ? INVENTORY_STATUS.IN_PROGRESS
                            : perRow.statusColText === INVENTORY_STATUS.MANAGED
                            ? INVENTORY_STATUS.REGISTERED
                            : INVENTORY_STATUS.NOT_REGISTERED;

                        let logAnalyzerRow = allLogAnalysisDataLatest?.find(
                            (perLa: any) =>
                                uniqueHostRow(
                                    perLa?.databaseHostId,
                                    perLa?.credentialId || '',
                                    perLa?.regionId || ''
                                ) === key && perLa?.databaseInstanceId === perRow?.databaseInstanceId
                        );
                        if (!logAnalyzerRow) {
                            logAnalyzerRow = allLogAnalysisDataLatest?.find(
                                (perLa: any) =>
                                    perLa?.databaseHostId === perRow?.resourceId &&
                                    perLa?.credentialId === inventoryTableData?.[key]?.credentialId &&
                                    perLa?.regionId === inventoryTableData?.[key]?.regionId &&
                                    perLa?.databaseInstanceId === perRow?.databaseInstanceId
                            );
                        }
                        const logAnalyzerStatus = logAnalyzerRow?.status || ERROR_ANALYZER_STATUS.NOT_ACTIVE;
                        let logAnalysisLoading = false;
                        if (inventoryTableData?.[key]?.hostType === DBType.ORACLE) {
                            logAnalysisLoading = allLogAnalysisOracleLoading;
                        } else {
                            logAnalysisLoading = allLogAnalysisLoading;
                        }

                        const availabilityGroupList = getAvailabilityGroupListForAoag(perRow);
                        const perRowData = {
                            ...perRow,
                            logAnalyzer: {
                                loading: logAnalysisLoading,
                                errorCount: logAnalyzerRow?.latestReport?.errorCount || 0,
                                status: logAnalyzerStatus,
                                lastScan: logAnalyzerRow?.latestReport?.creationTime || '',
                                severityCounts: {
                                    important: logAnalyzerRow?.latestReport?.severityCounts?.important || 0,
                                    critical: logAnalyzerRow?.latestReport?.severityCounts?.critical || 0,
                                    severe: logAnalyzerRow?.latestReport?.severityCounts?.severe || 0
                                }
                            },
                            id: String(instanceUniqueId++),
                            hostRow: perHost,
                            name: perHost?.name,
                            hostType: perHost?.hostType,
                            fsxList,
                            serverInstallationMode: getDiscoveredHostDeploymentV2(perRow, t),
                            loading: inventoryTableData?.[key]?.loading,
                            fullManagedInstanceLoading: inventoryTableData?.[key]?.fullManagedInstanceLoading,
                            subLoading: perRow?.loading,
                            optimizationStatusLoading,
                            optimizationStatus,
                            protectionText:
                                protectionText === PROTECTION_TEXT_STATUS.YES
                                    ? GENERAL.PROTECTED
                                    : protectionText === PROTECTION_TEXT_STATUS.NO
                                    ? GENERAL.NOT_PROTECTED
                                    : '',
                            performance: {
                                ...perRow.performance,
                                assessment: perRow.performance?.assessment || ''
                            },
                            allocatedCapacityText: perRow?.allocatedCapacity
                                ? formatSizeTwoPrecision(perRow?.allocatedCapacity)
                                : '',
                            statusColText: inProgressInstances.has(
                                uniqueHostRow(
                                    `${perHost?.ec2InstanceId}_${perRow.databaseInstanceName}`,
                                    perHost?.credentialId || '',
                                    perHost?.regionId || ''
                                )
                            )
                                ? INVENTORY_STATUS.IN_PROGRESS
                                : perRow.statusColText,
                            credentialId: perHost?.credentialId,
                            regionId: perHost?.regionId,
                            credentialName: perHost?.credentialName,
                            accountId: perHost?.accountId,
                            regionName: perHost?.regionName,
                            resourceId: perHost?.resourceId,
                            ec2InstanceId: perHost?.ec2InstanceId,
                            fileSystemName,
                            availabilityGroupList,
                            managementStatus,
                            ...(perHost?.hostType === DBType.ORACLE && {
                                protocol: perHost?.sqlServerInstances?.[0]?.protocol || GENERAL.NOT_AVAILABLE,
                                sizeRange: perRow?.databases?.[0]?.size
                                    ? categorizeStorageSize(formatSize(perRow?.databases?.[0]?.size))
                                    : GENERAL.NOT_AVAILABLE,
                                'Database size': perRow?.databases?.[0]?.size
                                    ? formatSize(perRow?.databases?.[0]?.size)
                                    : GENERAL.NOT_AVAILABLE
                            })
                        };
                        perInstanceData.push(perRowData);
                    });
                    allInstanceTableRows = [...allInstanceTableRows, ...(perInstanceData || [])];
                }

                // Database table
                if (inventoryTableData?.[key] && inventoryTableData?.[key]?.sqlServerInstances) {
                    const perHost = inventoryTableData?.[key];
                    inventoryTableData?.[key]?.sqlServerInstances?.map((perRow: any) => {
                        if (
                            perRow?.fileSystemType === GENERAL.EBS ||
                            perRow?.fileSystemType === GENERAL.FSX_FOR_WINDOWS ||
                            !perRow?.databases
                        ) {
                            return;
                        }
                        const serverInstallationMode = getDiscoveredHostDeploymentV2(perRow, t);
                        perRow?.databases?.map((perDatabase: any) => {
                            const protectionText = getProtectionText({
                                ...perDatabase,
                                fileSystemType: perRow?.fileSystemType
                            });
                            let protectionVal = '';
                            if (protectionText === PROTECTION_TEXT_STATUS.YES) {
                                protectionVal = GENERAL.PROTECTED;
                            } else if (protectionText === PROTECTION_TEXT_STATUS.NO) {
                                protectionVal = GENERAL.NOT_PROTECTED;
                            } else {
                                protectionVal = GENERAL.NOT_AVAILABLE;
                            }
                            const totalReplicaCount = getAoagTotalReplicaCountPerDatabase(perRow, perDatabase);
                            const perRowData = {
                                ...perDatabase,
                                isProtected: protectionVal,
                                hostRow: perHost,
                                instanceRow: perRow,
                                hostName: perHost?.name,
                                hostType: perHost?.hostType,
                                databaseInstanceId: perRow?.databaseInstanceId,
                                databaseInstanceName: perRow?.databaseInstanceName,
                                credentialId: perHost?.credentialId,
                                regionId: perHost?.regionId,
                                credentialName: perHost?.credentialName,
                                accountId: perHost?.accountId,
                                regionName: perHost?.regionName,
                                sizeRange: categorizeStorageSize(formatSize(perDatabase?.size)),
                                'Database size': formatSize(perDatabase?.size),
                                resourceId: perHost?.resourceId,
                                ec2InstanceId: perHost?.ec2InstanceId,
                                serverInstallationMode,
                                totalReplicaCount
                            };
                            // Only add Oracle PDB databases or all non-Oracle databases
                            if (
                                perHost?.hostType !== DBType.ORACLE ||
                                perRowData.type === ORACLE_DATABASES_COMPONENTS.PDB
                            ) {
                                allDatabaseTableRows.push(perRowData);
                            }
                        });
                    });
                }
            });

            const dataguardRows = groupDataGuardConfigurations(inventoryTableData, allInstanceTableRows);

            // Add isReplica and hasReplicas flags to Oracle instances based on DataGuard configurations
            allInstanceTableRows = enrichInstancesWithDataGuardFlags(allInstanceTableRows, dataguardRows);

            // Group AOAG configurations for MSSQL and enrich database rows with AOAG flags
            const aoagRows = groupAOAGConfigurations(inventoryTableData, allDatabaseTableRows);
            const enrichedDatabaseRows = enrichDatabasesWithAOAGFlags(allDatabaseTableRows, aoagRows);

            dispatch(
                setFullInventoryTablesRows({
                    hosts: sortInventoryTableData(allHostTableRows),
                    instances: sortInstanceTableData(allInstanceTableRows),
                    databases: sortDatabaseTableData(enrichedDatabaseRows)
                })
            );

            // Save filtered data for default selectedHostType (MSSQL)
            const engineType = selectedHostType || DBType.MSSQL;
            dispatch(
                setInventoryTablesRows({
                    hosts: sortInventoryTableData(allHostTableRows.filter((row: any) => row.hostType === engineType)),
                    instances: sortInstanceTableData(
                        allInstanceTableRows.filter((row: any) => row.hostType === engineType)
                    ),
                    databases: sortDatabaseTableData(
                        enrichedDatabaseRows.filter((row: any) => row.hostType === engineType)
                    )
                })
            );
        } else {
            dispatch(
                setFullInventoryTablesRows({
                    hosts: [],
                    instances: [],
                    databases: []
                })
            );

            dispatch(
                setInventoryTablesRows({
                    hosts: [],
                    instances: [],
                    databases: []
                })
            );
        }
    }, [
        inventoryTableData,
        inProgressInstances,
        allmssqlHostAssessmentLoading,
        allmssqlHostAssessmentData,
        allOracleHostAssessmentLoading,
        allOracleHostAssessmentData,
        allLogAnalysisData,
        allLogAnalysisLoading,
        headerSelectedMultiCredIdsList,
        headerSelectedMultiRegionIdsList
    ]);

    // When selectedHostType changes, update filtered rows
    useEffect(() => {
        dispatch(
            setInventoryTablesRows({
                hosts: sortInventoryTableData(fullHostTableRows.filter(row => row.hostType === selectedHostType)),
                instances: sortInstanceTableData(
                    fullInstanceTableRows.filter(row => row.hostType === selectedHostType)
                ),
                databases: sortDatabaseTableData(fullDatabaseTableRows.filter(row => row.hostType === selectedHostType))
            })
        );
    }, [selectedHostType, fullHostTableRows, fullInstanceTableRows, fullDatabaseTableRows]);

    return (
        <div className={styles.inventory}>
            <EngineTypeSelector />
            <div className={styles.banner}>
                {selectedHostType === DBType.MSSQL && <MSSQLBanner loading={loading} />}
                {selectedHostType === DBType.POSTGRESQL && <PGSQLBanner loading={loading} />}
                {selectedHostType === DBType.ORACLE && <OracleBanner loading={loading} />}
            </div>

            <InventoryTab />
            {/* selectedHostType is send as key  so that on remounting the component it fetches the correct data */}
            <InventoryTablesComponent key={selectedHostType} />
        </div>
    );
};

export default InventoryV2;
