import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../store/storeHooks';
import styles from './Inventory.module.scss';
import InventoryCards from './InventoryCards/InventoryCards';
import InventoryTab from './InventoryTab/InventoryTab';
import InventoryTablesComponent from './InventoryTablesComponent/InventoryTablesComponent';
import { DBType, INVENTORY_ACTIONS, INVENTORY_STATUS, PROTECTION_TEXT_STATUS } from '../../utils/consts';
import { GENERAL } from '../../utils/appConstants';
import { categorizeStorageSize, formatSize, formatSizeTwoPrecision } from '../../utils/utilityFunctions';
import {
    getDiscoveredHostDeploymentV2,
    getFileSystemName,
    getOptimizationStatus,
    getProtectionText,
    sortDatabaseTableData,
    sortInstanceTableData,
    sortInventoryTableData,
    uniqueHostRow
} from './InventoryUtilsV2';
import { setFullInventoryTablesRows, setInventoryTablesRows } from '../../store/workloadFactory/inventoryV2Slice';
import store from '../../store/store';
import EngineTypeSelector from './EngineTypeSelector/EngineTypeSelector';

const InventoryV2 = () => {
    const dispatch = useDispatch();
    const {
        inventoryTableData,
        inProgressInstances,
        removeSecNodeDiscoveredList,
        allmssqlHostAssessmentLoading,
        allmssqlHostAssessmentData,
        selectedHostType,
        fullHostTableRows,
        fullInstanceTableRows,
        fullDatabaseTableRows
    } = useAppSelector(state => state.inventoryV2);
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = useAppSelector(state => state.headers);

    useEffect(() => {
        if (inventoryTableData) {
            const state = store.getState();
            const { allmssqlHostAssessmentData: allmssqlHostAssessmentDataLatest } = state.inventoryV2;
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
                    serverAllInstallationModeText: inventoryTableData[key]?.serverAllInstallationMode
                        ? inventoryTableData[key]?.serverAllInstallationMode.join(', ')
                        : inventoryTableData[key]?.serverInstallationMode
                };
                allHostTableRows.push(rowData);

                // Instance table
                if (inventoryTableData?.[key] && inventoryTableData?.[key]?.sqlServerInstances) {
                    const perHost = inventoryTableData?.[key];
                    let optimizationStatusLoading = false;
                    let optimizationStatusList: any = [];
                    const assessRow = allmssqlHostAssessmentDataLatest?.filter(
                        (perRow: any) =>
                            uniqueHostRow(perRow?.databaseHostId, perRow?.credentialId, perRow?.regionId) === key
                    );
                    if (assessRow.length > 0) {
                        optimizationStatusLoading = allmssqlHostAssessmentLoading;
                        optimizationStatusList = assessRow?.[0]?.instancesAssessment;
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
                        const optimizationStatus = getOptimizationStatus(
                            perRow?.databaseInstanceId,
                            optimizationStatusList
                        );
                        const fileSystemName = getFileSystemName(perRow);
                        if (perRow?.statusColText === INVENTORY_STATUS.MANAGED) {
                            optimizationStatusLoading = allmssqlHostAssessmentLoading;
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
                        const perRowData = {
                            ...perRow,
                            id: String(instanceUniqueId++),
                            hostRow: perHost,
                            name: perHost?.name,
                            hostType: perHost?.hostType,
                            serverInstallationMode: getDiscoveredHostDeploymentV2(perRow),
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
                            managementStatus
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
                                ec2InstanceId: perHost?.ec2InstanceId
                            };
                            allDatabaseTableRows.push(perRowData);
                        });
                    });
                }
            });

            // sort it based on action and whether it is disable or enable
            dispatch(
                setFullInventoryTablesRows({
                    hosts: sortInventoryTableData(allHostTableRows),
                    instances: sortInstanceTableData(allInstanceTableRows),
                    databases: sortDatabaseTableData(allDatabaseTableRows)
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
                        allDatabaseTableRows.filter((row: any) => row.hostType === engineType)
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
            <InventoryCards />
            <EngineTypeSelector />
            <InventoryTab />
            {/* selectedHostType is send as key  so that on remounting the component it fetches the correct data */}
            <InventoryTablesComponent key={selectedHostType} />
        </div>
    );
};

export default InventoryV2;
