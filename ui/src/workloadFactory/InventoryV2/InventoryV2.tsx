import { useEffect } from 'react';
import { useAppSelector } from '../../store/storeHooks';
import styles from './Inventory.module.scss';
import InventoryCards from './InventoryCards/InventoryCards';
import InventoryTab from './InventoryTab/InventoryTab';
import InventoryTablesComponent from './InventoryTablesComponent/InventoryTablesComponent';
import { INVENTORY_ACTIONS, INVENTORY_STATUS, PROTECTION_TEXT_STATUS } from '../../utils/consts';
import { GENERAL } from '../../utils/appConstants';
import { categorizeStorageSize, formatSize, formatSizeTwoPrecision } from '../../utils/utilityFunctions';
import {
    getDiscoveredHostDeploymentV2,
    getOptimizationStatus,
    getProtectionText,
    sortInstanceTableData,
    sortInventoryTableData,
    uniqueHostRow
} from './InventoryUtilsV2';
import { useDispatch } from 'react-redux';
import { setInventoryTablesRows } from '../../store/workloadFactory/inventoryV2Slice';

const InventoryV2 = () => {
    const dispatch = useDispatch();
    const {
        inventoryTableData,
        inProgressInstances,
        removeSecNodeDiscoveredList,
        allmssqlHostAssessmentLoading,
        allmssqlHostAssessmentData
    } = useAppSelector(state => state.inventoryV2);
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = useAppSelector(state => state.headers);

    useEffect(() => {
        if (inventoryTableData) {
            let hostTableRows: any = [];
            let instanceTableRows: any = [];
            let hostUniqueId: number = 0;
            let instanceUniqueId: number = 0;
            let databaseTableRows: any = [];
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
                let instanceList: any = [];
                let instanceNameList: any = [];
                let vpcIdAndNameText = '';
                const allocatedCapacity = inventoryTableData[key]?.allocatedCapacity || '';
                inventoryTableData[key]?.ec2Details?.map((row: any) => {
                    if (row?.name) {
                        instanceNameList.push(row?.name);
                    }
                    if (row?.name && row?.id) {
                        instanceList.push(row?.name + ' | ID: ' + row?.id);
                    } else if (row?.id) {
                        instanceList.push(GENERAL.NOT_AVAILABLE + ' | ID: ' + row?.id);
                    }
                });
                if (inventoryTableData[key]?.vpcId && inventoryTableData[key]?.vpcName) {
                    vpcIdAndNameText = inventoryTableData[key]?.vpcName + ' | ID: ' + inventoryTableData[key]?.vpcId;
                } else if (inventoryTableData[key]?.vpcId) {
                    vpcIdAndNameText = GENERAL.NOT_AVAILABLE + ' | ID: ' + inventoryTableData[key]?.vpcId;
                } else {
                    vpcIdAndNameText = GENERAL.NOT_AVAILABLE + ' | ID: ' + GENERAL.NOT_AVAILABLE;
                }
                const rowData = {
                    ...inventoryTableData[key],
                    id: String(hostUniqueId++),
                    sqlServerInstancesText:
                        inventoryTableData[key]?.totalInstance !== 0
                            ? inventoryTableData[key]?.managedInstance +
                              ' out of ' +
                              inventoryTableData[key]?.totalInstance
                            : '',
                    instanceListText: instanceList.join(','),
                    instanceNameListText: instanceNameList.join(', '),
                    vpcIdAndNameText: vpcIdAndNameText,
                    allocatedCapacityText: allocatedCapacity ? formatSizeTwoPrecision(allocatedCapacity) : '',
                    nameForSorting: inventoryTableData[key]?.name?.toLowerCase()
                };
                hostTableRows.push(rowData);

                // Instance table
                if (inventoryTableData?.[key] && inventoryTableData?.[key]?.sqlServerInstances) {
                    let perHost = inventoryTableData?.[key];
                    let optimizationStatusLoading = false;
                    let optimizationStatusList: any = [];
                    let assessRow = allmssqlHostAssessmentData?.filter(
                        (perRow: any) =>
                            uniqueHostRow(perRow?.databaseHostId, perRow?.credentialId, perRow?.regionId) === key
                    );
                    if (assessRow.length > 0) {
                        optimizationStatusLoading = allmssqlHostAssessmentLoading;
                        optimizationStatusList = assessRow?.[0]?.instancesAssessment;
                    }
                    let perInstanceData: any = [];
                    inventoryTableData?.[key]?.sqlServerInstances?.map((perRow: any) => {
                        if (
                            perRow?.fileSystemType === GENERAL.EBS ||
                            perRow?.fileSystemType === GENERAL.FSX_FOR_WINDOWS
                        ) {
                            return;
                        }
                        let protectionText = getProtectionText(perRow);
                        let optimizationStatus = getOptimizationStatus(
                            perRow?.databaseInstanceId,
                            optimizationStatusList
                        );
                        if (perRow?.statusColText === INVENTORY_STATUS.MANAGED) {
                            optimizationStatusLoading = allmssqlHostAssessmentLoading;
                        }
                        let perRowData = {
                            ...perRow,
                            id: String(instanceUniqueId++),
                            hostRow: perHost,
                            name: perHost?.name,
                            hostType: perHost?.hostType,
                            serverInstallationMode: getDiscoveredHostDeploymentV2(perRow),
                            loading: inventoryTableData?.[key]?.loading,
                            subLoading: perRow?.loading,
                            optimizationStatusLoading: optimizationStatusLoading,
                            optimizationStatus: optimizationStatus,
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
                            ec2InstanceId: perHost?.ec2InstanceId
                        };
                        perInstanceData.push(perRowData);
                    });
                    instanceTableRows = [...instanceTableRows, ...(perInstanceData || [])];
                }

                // Database table
                if (inventoryTableData?.[key] && inventoryTableData?.[key]?.sqlServerInstances) {
                    let perHost = inventoryTableData?.[key];
                    inventoryTableData?.[key]?.sqlServerInstances?.map((perRow: any) => {
                        if (
                            perRow?.fileSystemType === GENERAL.EBS ||
                            perRow?.fileSystemType === GENERAL.FSX_FOR_WINDOWS ||
                            !perRow?.databases
                        ) {
                            return;
                        }
                        perRow?.databases?.map((perDatabase: any) => {
                            let protectionText = getProtectionText({
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
                            let perRowData = {
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
                            databaseTableRows.push(perRowData);
                        });
                    });
                }
            });

            // sort it based on action and whether it is disable or enable
            dispatch(
                setInventoryTablesRows({
                    hosts: sortInventoryTableData(hostTableRows),
                    instances: sortInstanceTableData(instanceTableRows),
                    databases: databaseTableRows
                })
            );
        } else {
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

    return (
        <div className={styles.inventory}>
            <InventoryCards />
            <InventoryTab />
            <InventoryTablesComponent />
        </div>
    );
};

export default InventoryV2;
