import { Button, DsFlashingDotsLoader, DsTypography, Popover, TooltipInfo } from '@netapp/design-system';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../store/notificationSlice';
import store from '../../store/store';
import {
    setFsxCredentialStatus,
    setInProgressInstances,
    setInventoryTableData,
    setManagedAssessmentHostIdsList,
    setSelectedHeaderTab,
    setSelectedRowsForManage,
    setUnManagedPerfInstanceIdsList
} from '../../store/workloadFactory/inventoryV2Slice';
import { GENERAL } from '../../utils/appConstants';
import {
    DBType,
    DETECT_HOST_VAR,
    INVENTORY_ACTIONS,
    INVENTORY_STATUS,
    PARTNER_NODE,
    PREPARE_API_ENDPOINT,
    PROTECTION_TEXT_STATUS,
    SQL_DEPLOYMENT_MODE,
    WLF_TABS
} from '../../utils/consts';
import {
    DatabaseInstanceDetailsInterface,
    DatabaseInstancesSummaryInterface,
    DiscoverHostInterface,
    DiscoveredStorageObj,
    EC2DetailsInterface,
    EstimatedUsageCostInterface,
    InstanceActions,
    InstancesHostsRowInterface,
    InstancesObjectInterface,
    InventoryTableData,
    InventoryTableInstanceDatInterface,
    ManagedHostsRowInterface,
    SQLServerInstancesDiscovered,
    StatusObjInterface
} from '../../utils/types/inventoryV2Types';
import {
    formatFractionalNumber,
    formatSizeOnePrecision,
    formatSizeTwoPrecision,
    getAzType
} from '../../utils/utilityFunctions';
import { ReactComponent as TooltipIcon } from '../../assets/tooltipGrey.svg';
import { ReactComponent as CopyIcon } from '../../assets/ic_copy.svg';

import EstimatedCostPopover from './EstimatedCostPopover/EstimatedCostPopover';
import { formatOptimizationBreakDown, getCardsData } from '../GetWell/GetWellUtils';
import { HostAssessmentResponseInterface } from '../../utils/types/getWellTypes';
import CopyToClipboardCommon from '../../common/CopyToClipboard/copyToClipboard';

export const uniqueHostRow = (id: string, cred: string, region: string) => {
    return id + '_' + cred + '_' + region;
};

export const formatInventoryTableData = (managedData: { [key: string]: ManagedHostsRowInterface } | null) => {
    let result = {};
    if (!managedData) {
        return result;
    }
    let state = store.getState();
    const { credentialMapping, regionMapping } = state?.headers;
    Object.keys(managedData).map((key: string) => {
        let awsKeys = key.split('_');
        result = {
            ...result,
            ...{ [key]: formatManagedRows(managedData[key], awsKeys, credentialMapping, regionMapping) }
        };
    });
    return result;
};

export const getInventoryDataCount = (data: { [key: string]: InventoryTableData } | null) => {
    let result;
    if (!data) {
        return result;
    }

    let detectedHostCount = 0;
    let undetectedHostCount = 0;
    let managedInst = 0;
    let totalInstance = 0;
    const state = store.getState();
    const removeSecNodeDiscoveredList = state.inventoryV2.removeSecNodeDiscoveredList;
    Object.keys(data).map((key: string) => {
        if (removeSecNodeDiscoveredList.includes(key)) {
            return;
        }
        if (
            data[key]?.action === INVENTORY_ACTIONS.MANAGE ||
            (data[key]?.action === INVENTORY_ACTIONS.EXPLORE_SAVINGS && data[key]?.isDetected)
        ) {
            detectedHostCount += 1;
        } else {
            undetectedHostCount += 1;
        }
        managedInst += data[key]?.managedInstance || 0;
        totalInstance += data[key]?.totalInstance || 0;
    });
    result = {
        detectedHost: detectedHostCount,
        undetectedHost: undetectedHostCount,
        managedInstance: managedInst,
        unmanagedInstance: totalInstance - managedInst
    };
    return result;
};

export const formatManagedRows = (
    managedRow: ManagedHostsRowInterface,
    keys: Array<string>,
    credentialMapping: any,
    regionMapping: any
) => {
    let managedInstanceCount = managedInstancesCount(managedRow);
    let totalInstanceCount = managedRow?.databaseInstanceDetails?.length || 0;
    let ssmState = getSsmState(managedRow);
    let allocatedCapacity = getAllocatedCapacity(managedRow);

    const result = {
        hostType: managedRow?.hostType,
        id: managedRow?.id,
        ec2InstanceId: managedRow?.nodeTopology?.ec2Details?.[0]?.id,
        ec2InstanceName: managedRow?.nodeTopology?.ec2Details?.[0]?.name,
        resourceId: managedRow?.id,
        name: managedRow?.name,
        status: getNodeStatus(managedRow),
        ssmState: ssmState,
        totalInstance: totalInstanceCount,
        managedInstance: managedInstanceCount,
        serverInstallationMode: getInstallationMode(managedRow),
        serverAllInstallationMode: getAllInstallationMode(managedRow),
        vpcId: managedRow?.nodeTopology?.vpcId,
        vpcName: managedRow?.nodeTopology?.vpcName,
        vpcCidr: managedRow?.nodeTopology?.vpcCidr,
        action: ssmState === INVENTORY_STATUS.ONLINE && totalInstanceCount > 0 ? INVENTORY_ACTIONS.MANAGE : '', // This is default for managed rows,
        actionDisable: totalInstanceCount === managedInstanceCount,
        isManagedHost: true,
        loading: managedRow?.loading,
        fullManagedInstanceLoading: managedRow?.loading, // This loading is specific to database-hosts api if loaded fully for a host or not
        ec2Details: managedRow?.nodeTopology?.ec2Details,
        estimatedUsageCost: managedRow?.estimatedUsageCost,
        totalCost: getTotalCost(managedRow?.estimatedUsageCost || {}),
        allocatedCapacity: allocatedCapacity,
        allocatedCapacityText: allocatedCapacity ? formatSizeTwoPrecision(allocatedCapacity) : '',
        storageType: GENERAL.FSX_FOR_ONTAP,
        isDetected: true,
        sqlServerInstances: formatInstanceData(managedRow),
        credentialId: keys?.[1],
        regionId: keys?.[2],
        credentialName: credentialMapping?.[keys?.[1]]?.name,
        accountId: credentialMapping?.[keys?.[1]]?.providerAccountId,
        regionName: regionMapping?.[keys?.[2]]?.regionName
    };
    return result;
};

export const getInstanceStatusForMixedCase = (managedHostRow: any) => {
    let state = store.getState();
    const discoveredHostData = state?.inventoryV2?.discoveredHosts?.discoveredHostData;
    const ec2Id = managedHostRow?.nodeTopology?.ec2Details?.[0]?.id;
    if (ec2Id && discoveredHostData) {
        let selectedEc2 = discoveredHostData?.filter((perHost: any) => perHost?.ec2InstanceId === ec2Id);
        if (selectedEc2 && selectedEc2?.length > 0) {
            let ssmState = getDiscoverSsmState(selectedEc2[0]);
            return getDiscoveredPerInstanceStatus(selectedEc2[0], ssmState);
        }
    }
    return [];
};

export const getNodeStatus = (row: ManagedHostsRowInterface) => {
    if (row?.databaseHostStatus && row?.databaseHostStatus !== INVENTORY_STATUS.NOT_AVAILABLE) {
        if (row?.databaseHostStatus?.toLowerCase() === INVENTORY_STATUS.HOST_ONLINE) {
            return INVENTORY_STATUS.ONLINE;
        } else {
            return INVENTORY_STATUS.OFFLINE;
        }
    } else {
        return INVENTORY_STATUS.UNKNOWN;
    }
};

export const getSsmState = (row: ManagedHostsRowInterface) => {
    if (row?.ssmStatus && row?.ssmStatus !== INVENTORY_STATUS.NOT_AVAILABLE) {
        if (
            row?.ssmStatus?.toLowerCase() === INVENTORY_STATUS.SSM_CONNECTED ||
            row?.ssmStatus?.toLowerCase() === INVENTORY_STATUS.SSM_ONLINE
        ) {
            return INVENTORY_STATUS.ONLINE;
        } else {
            return INVENTORY_STATUS.OFFLINE;
        }
    } else {
        return INVENTORY_STATUS.UNKNOWN;
    }
};

export const managedInstancesCount = (row: ManagedHostsRowInterface) => {
    if (row?.databaseInstanceDetails && row?.databaseInstanceDetails?.length > 0) {
        let managedRows = row?.databaseInstanceDetails?.filter(per => per?.isManaged);
        return managedRows?.length;
    } else {
        return '';
    }
};

export const getInstallationMode = (row: ManagedHostsRowInterface | undefined) => {
    let installationMode = '';
    if (row?.databaseInstancesSummary && row?.databaseInstancesSummary?.length > 0) {
        for (let i = 0; i < row?.databaseInstancesSummary?.length; i++) {
            const val = row?.databaseInstancesSummary[i];
            if (val?.sqlServerDeploymentType) {
                installationMode = val?.sqlServerDeploymentType;
                break;
            } else if (val?.databaseInstanceTopology?.serverInstallationMode) {
                installationMode = val?.databaseInstanceTopology?.serverInstallationMode;
                break;
            }
        }
        if (installationMode?.toLowerCase() === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE) {
            installationMode = GENERAL.FAILOVER_CLUSTER_INSTANCES;
        } else if (installationMode?.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG) {
            installationMode = GENERAL.AOAG;
        } else if (installationMode?.toLowerCase() === SQL_DEPLOYMENT_MODE.HA) {
            installationMode = GENERAL.HA;
        }
        return installationMode;
    } else {
        return '';
    }
};

export const getAllInstallationMode = (row: ManagedHostsRowInterface | undefined) => {
    let installationMode: Array<string> = [];
    if (row?.databaseInstancesSummary && row?.databaseInstancesSummary?.length > 0) {
        for (let i = 0; i < row?.databaseInstancesSummary?.length; i++) {
            const val = row?.databaseInstancesSummary[i];
            let perInstallationMode = '';
            if (val?.sqlServerDeploymentType) {
                perInstallationMode = val?.sqlServerDeploymentType;
            } else if (val?.databaseInstanceTopology?.serverInstallationMode) {
                perInstallationMode = val?.databaseInstanceTopology?.serverInstallationMode;
            }

            if (perInstallationMode?.toLowerCase() === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE) {
                perInstallationMode = GENERAL.FAILOVER_CLUSTER_INSTANCES;
            } else if (perInstallationMode?.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG) {
                perInstallationMode = GENERAL.AOAG;
            } else if (perInstallationMode?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
                perInstallationMode = GENERAL.STANDALONE;
            } else if (perInstallationMode?.toLowerCase() === SQL_DEPLOYMENT_MODE.HA) {
                perInstallationMode = GENERAL.HA;
            }
            if (!installationMode.includes(perInstallationMode)) {
                installationMode.push(perInstallationMode);
            }
        }
        return installationMode;
    } else {
        return '';
    }
};

export const getTotalCost = (estimatedUsageCost: EstimatedUsageCostInterface) => {
    if (estimatedUsageCost) {
        return (
            (estimatedUsageCost?.compute || 0) +
            (estimatedUsageCost?.storage?.fsxn || 0) +
            (estimatedUsageCost?.storage?.fsxw || 0) +
            (estimatedUsageCost?.storage?.ebs || 0) +
            (estimatedUsageCost?.connectivity || 0) +
            (estimatedUsageCost?.others || 0)
        ).toString();
    } else {
        return 0;
    }
};

export const getAllocatedCapacity = (row: ManagedHostsRowInterface | undefined) => {
    let fsxnCapacity = 0;
    let fsxwCapacity = 0;
    let ebsCapacity = 0;
    let uniqueFsxnId: Array<String> = [];
    let uniqueFsxwId: Array<String> = [];
    let uniqueVolId: Array<String> = [];
    row?.fsxnResourceInfo?.map((perFsx: any) => {
        if (!uniqueFsxnId.includes(perFsx?.id)) {
            fsxnCapacity += perFsx?.size || 0;
            uniqueFsxnId.push(perFsx?.id);
        }
    });

    row?.fsxwResourceInfo?.map((perFsxw: any) => {
        if (!uniqueFsxwId.includes(perFsxw?.id)) {
            fsxwCapacity += perFsxw?.size || 0;
            uniqueFsxwId.push(perFsxw?.id);
        }
    });

    row?.ebsResourceInfo?.map((perVol: any) => {
        if (perVol?.id && !perVol?.id?.toLowerCase().includes('root_volume') && !uniqueVolId.includes(perVol?.id)) {
            ebsCapacity += perVol?.size || 0;
            uniqueVolId.push(perVol?.id);
        }
    });

    let allocatedCapacity = fsxnCapacity + fsxwCapacity + ebsCapacity;
    return allocatedCapacity;
};

export const getStorageSavingsText = (val: DatabaseInstancesSummaryInterface) => {
    let storagePercent = 0;
    let storageSavingsText: string = '';
    let fsxType: string = '';
    let fileSystemType = val?.databaseInstanceTopology?.fileSystemType || '';
    if (fileSystemType.includes(GENERAL.FSX_FOR_ONTAP)) {
        fsxType = 'fsxn';
    } else if (fileSystemType.includes(GENERAL.FSX_FOR_WINDOWS)) {
        fsxType = 'fsxw';
    } else if (fileSystemType.includes(GENERAL.EBS)) {
        fsxType = 'ebs';
    }

    if (fsxType) {
        let fsxTypeValue = val?.storage?.[fsxType] || {};
        storagePercent = fsxTypeValue ? (Number(fsxTypeValue?.spaceSavings) / Number(fsxTypeValue?.used)) * 100 : 0;
        if (val?.storage?.[fsxType]?.spaceSavings && val?.storage?.[fsxType]?.used) {
            storageSavingsText =
                formatFractionalNumber(storagePercent, 2) +
                '% (' +
                formatSizeOnePrecision(Number(fsxTypeValue?.spaceSavings)) +
                ')';
        } else if (val?.storage?.[fsxType]?.spaceSavings === 0) {
            storageSavingsText = '0%';
        } else {
            storageSavingsText = '';
        }
    }
    return storageSavingsText;
};

export const formatInstanceData = (row: ManagedHostsRowInterface) => {
    const isAllManaged = row?.databaseInstanceDetails?.every(perRow => {
        return perRow?.isManaged ? true : false;
    });

    let nonManagedStatus: any = [];
    if (!isAllManaged) {
        nonManagedStatus = getInstanceStatusForMixedCase(row);
        // to call data for mixed case. use in statusColText for unmanaged case
    }

    let instanceRows;
    if (row?.databaseInstanceDetails) {
        instanceRows = row?.databaseInstanceDetails?.map(perRow => {
            const isManagedRow = row?.databaseInstanceDetails?.filter(
                per => per?.instanceName === perRow?.instanceName
            );
            const statusObj = nonManagedStatus?.filter((per: StatusObjInterface) => per?.name === perRow?.instanceName);
            return {
                ...perRow,
                databaseInstanceId: perRow?.databaseInstanceId,
                databaseInstanceName: perRow?.instanceName,
                status: perRow?.instanceState,
                statusColText: isManagedRow?.[0]?.isManaged
                    ? INVENTORY_STATUS.MANAGED
                    : statusObj?.[0]?.status || INVENTORY_STATUS.UNDETECTED
            };
        });
    }
    if (row?.databaseInstancesSummary && row?.databaseInstancesSummary?.length > 0) {
        instanceRows = instanceRows?.map(instRow => {
            const perRow = row?.databaseInstancesSummary?.find(
                per => per?.databaseInstanceName === instRow?.databaseInstanceName
            );
            const isManagedRow = row?.databaseInstanceDetails?.filter(
                per => per?.instanceName === perRow?.databaseInstanceName
            );
            const statusObj = nonManagedStatus?.filter(
                (per: StatusObjInterface) => per?.name === perRow?.databaseInstanceName
            );
            const allocatedCapacity =
                (perRow?.storage?.fsxn?.size || 0) +
                (perRow?.storage?.fsxw?.size || 0) +
                (perRow?.storage?.ebs?.size || 0);
            if (perRow) {
                return {
                    ...perRow,
                    databaseInstanceId: perRow?.databaseInstanceId || instRow?.databaseInstanceId,
                    databaseInstanceName: instRow?.databaseInstanceName,
                    status: perRow?.status,
                    databaseCount: perRow?.databaseCount,
                    statusColText: isManagedRow?.[0]?.isManaged
                        ? INVENTORY_STATUS.MANAGED
                        : statusObj?.[0]?.status || INVENTORY_STATUS.UNDETECTED,
                    fileSystemDeploymentMode: getAzType(perRow?.databaseInstanceTopology?.fileSystemDeploymentMode),
                    fileSystemType: perRow?.databaseInstanceTopology?.fileSystemType,
                    fsxId: perRow?.databaseInstanceTopology?.fileSystemId,
                    protection: perRow?.protection,
                    performance: perRow?.performance,
                    storage: perRow?.storage,
                    storageSavingsText: getStorageSavingsText(perRow || {}),
                    allocatedCapacity: allocatedCapacity,
                    allocatedCapacityText: allocatedCapacity ? formatSizeTwoPrecision(allocatedCapacity) : ''
                };
            } else {
                return instRow;
            }
        });
    }

    return instanceRows;
};

export const getFsxIdsFromdiscover = (data: Array<DiscoverHostInterface>) => {
    let fsxIds: Array<string> = [];
    data?.map((instances: DiscoverHostInterface) => {
        instances?.sqlServerInstances?.map((inst: SQLServerInstancesDiscovered) => {
            inst?.storage?.map((storageObj: DiscoveredStorageObj) => {
                if (storageObj.type === DETECT_HOST_VAR.FSXN) {
                    let fsxId = storageObj?.id || '';
                    if (!fsxIds.includes(fsxId)) {
                        fsxIds.push(fsxId);
                    }
                }
            });
        });
    });
    return fsxIds;
};

// This function is used to find nodes available in managed or unmanaged tab. In that case Partner node will be added in removeRows list.
export const getPrimaryClusterNode = (
    newDiscoveredHostData: Array<DiscoverHostInterface>,
    removeRows: Array<string>,
    managedHostsList: string[],
    clusterDiscoveredHost: any,
    isDemoMode: boolean | undefined
) => {
    let testedNodes: string[] = [];

    newDiscoveredHostData.map((host: DiscoverHostInterface) => {
        if (host?.nodesList) {
            if (testedNodes.includes(host?.ec2InstanceId || '')) {
                return;
            }
            // To find partner node in a cluster
            const partnerNode = newDiscoveredHostData.filter((perHost: DiscoverHostInterface) => {
                const isSameCluster = host?.nodesList?.filter((val: string) => {
                    return (
                        perHost?.ec2InstanceId !== host?.ec2InstanceId &&
                        perHost?.nodesList &&
                        perHost.nodesList.includes(val) &&
                        perHost?.credentialId === host?.credentialId &&
                        perHost?.regionId === host?.regionId
                    );
                });
                // checking same vpc or not
                if (isSameCluster && isSameCluster.length > 0 && perHost?.vpc?.id === host?.vpc?.id) {
                    return perHost;
                } else {
                    return;
                }
            })?.[0];

            if (partnerNode && !isDemoMode) {
                let isManagedNode1;
                let isManagedNode2;
                if (host?.ec2InstanceId) {
                    testedNodes.push(host?.ec2InstanceId);
                    isManagedNode1 = managedHostsList.includes(host?.ec2InstanceId);
                }
                if (partnerNode?.ec2InstanceId) {
                    testedNodes.push(partnerNode?.ec2InstanceId);
                    isManagedNode2 = managedHostsList.includes(partnerNode?.ec2InstanceId);
                }
                // To check if node or partner node is already in managed host. Ignore other node if is already available in Managed host.

                if (isManagedNode1 || isManagedNode2) {
                    if (partnerNode?.ec2InstanceId) {
                        removeRows.push(
                            uniqueHostRow(
                                partnerNode?.ec2InstanceId,
                                partnerNode?.credentialId || '',
                                partnerNode?.regionId || ''
                            )
                        );
                    }
                    if (host?.ec2InstanceId) {
                        removeRows.push(
                            uniqueHostRow(host?.ec2InstanceId, host?.credentialId || '', host?.regionId || '')
                        );
                    }
                    return;
                } else {
                    let combinedData = combineClusterData(host, partnerNode, removeRows);
                    if (combinedData) {
                        clusterDiscoveredHost[
                            uniqueHostRow(combinedData?.key, host?.credentialId || '', host?.regionId || '')
                        ] = combinedData?.data;
                        // clusterDiscoveredHost = {...clusterDiscoveredHost, [combinedData?.key] : combinedData?.data};
                    }
                }
            } else {
                let isManagedNode1;
                if (host?.ec2InstanceId) {
                    testedNodes.push(host?.ec2InstanceId);
                    isManagedNode1 = managedHostsList.includes(host?.ec2InstanceId);
                }
                // To check if node is already in managed host. Ignore other node if is already available in Managed host.

                if (isManagedNode1) {
                    if (host?.ec2InstanceId) {
                        removeRows.push(
                            uniqueHostRow(host?.ec2InstanceId, host?.credentialId || '', host?.regionId || '')
                        );
                    }
                    return;
                }
            }
        }
    });
    return;
};

export const combineClusterData = (
    node: DiscoverHostInterface,
    partner: DiscoverHostInterface,
    removeRows: Array<string>
) => {
    let result = null;
    let key = (node?.ec2InstanceId || '') + ',' + (partner?.ec2InstanceId || '');
    let sqlServerInstancesList: Array<SQLServerInstancesDiscovered> = [];
    let uniqueSqlServerList: Array<string> = [];
    let primaryNode: string = '';
    node?.sqlServerInstances?.map((perRow: SQLServerInstancesDiscovered) => {
        primaryNode = findingRunningInstance(
            uniqueSqlServerList,
            sqlServerInstancesList,
            perRow,
            node,
            partner,
            primaryNode
        );
    });
    partner?.sqlServerInstances?.map((perRow: SQLServerInstancesDiscovered) => {
        primaryNode = findingRunningInstance(
            uniqueSqlServerList,
            sqlServerInstancesList,
            perRow,
            partner,
            node,
            primaryNode
        );
    });
    if (primaryNode === node?.ec2InstanceId) {
        if (partner?.ec2InstanceId) {
            removeRows.push(
                uniqueHostRow(partner?.ec2InstanceId, partner?.credentialId || '', partner?.regionId || '')
            );
        }
        result = {
            key: primaryNode,
            data: {
                ...node,
                key: key,
                sqlServerInstances: sqlServerInstancesList
            }
        };
    } else {
        if (node?.ec2InstanceId) {
            removeRows.push(uniqueHostRow(node?.ec2InstanceId, node?.credentialId || '', node?.regionId || ''));
        }
        result = {
            key: primaryNode,
            data: {
                ...partner,
                key: key,
                sqlServerInstances: sqlServerInstancesList
            }
        };
    }
    return result;
};

export const findingRunningInstance = (
    uniqueSqlServerList: Array<string>,
    sqlServerInstancesList: Array<SQLServerInstancesDiscovered>,
    perRow: SQLServerInstancesDiscovered,
    node: DiscoverHostInterface,
    partner: DiscoverHostInterface,
    primaryNode: string
) => {
    if (uniqueSqlServerList.includes(perRow?.sqlServerInstance!)) {
        return primaryNode;
    }
    if (perRow?.sqlServerState?.toLowerCase() === 'running') {
        uniqueSqlServerList.push(perRow?.sqlServerInstance!);
        sqlServerInstancesList.push(perRow);
        if (!primaryNode) {
            primaryNode = node?.ec2InstanceId || '';
        }
    } else {
        let partnerInstance = partner?.sqlServerInstances?.filter((perPartnerRow: any) => {
            return perPartnerRow?.sqlServerInstance === perRow?.sqlServerInstance;
        });
        if (partnerInstance && partnerInstance?.length > 0) {
            uniqueSqlServerList.push(partnerInstance[0]?.sqlServerInstance!);
            sqlServerInstancesList.push(partnerInstance[0]);
            if (!primaryNode) {
                primaryNode = partner?.ec2InstanceId || '';
            }
        } else {
            uniqueSqlServerList.push(perRow?.sqlServerInstance!);
            sqlServerInstancesList.push(perRow);
            if (!primaryNode) {
                primaryNode = node?.ec2InstanceId || '';
            }
        }
    }
    return primaryNode;
};

export const formatDiscoveredInventoryData = (
    discoveredData: Array<DiscoverHostInterface>,
    removeRows: Array<string>,
    clusterDiscoveredHost: any
) => {
    let result = {};
    if (!discoveredData) {
        return result;
    }
    let state = store.getState();
    const { credentialMapping, regionMapping } = state?.headers;
    discoveredData?.map((perRow: DiscoverHostInterface) => {
        if (
            removeRows.includes(uniqueHostRow(perRow.ec2InstanceId, perRow.credentialId || '', perRow.regionId || ''))
        ) {
            return;
        }
        if (
            clusterDiscoveredHost?.[
                uniqueHostRow(perRow.ec2InstanceId, perRow.credentialId || '', perRow.regionId || '')
            ]
        ) {
            result = {
                ...result,
                ...{
                    [uniqueHostRow(perRow.ec2InstanceId, perRow.credentialId || '', perRow.regionId || '')]:
                        formatDiscoveredRows(
                            clusterDiscoveredHost[
                                uniqueHostRow(perRow.ec2InstanceId, perRow.credentialId || '', perRow.regionId || '')
                            ],
                            credentialMapping,
                            regionMapping
                        )
                }
            };
        } else {
            result = {
                ...result,
                ...{
                    [uniqueHostRow(perRow.ec2InstanceId, perRow.credentialId || '', perRow.regionId || '')]:
                        formatDiscoveredRows(perRow, credentialMapping, regionMapping)
                }
            };
        }
    });
    return result;
};

export const formatDiscoveredRows = (
    discoveredRow: DiscoverHostInterface,
    credentialMapping: any,
    regionMapping: any
) => {
    let totalInstanceCount = discoveredRow?.sqlServerInstances?.length || 0;
    let ssmState = getDiscoverSsmState(discoveredRow);
    let perInstanceStatus = getDiscoveredPerInstanceStatus(discoveredRow, ssmState);
    let installationMode = getDiscoverInstallationMode(discoveredRow);
    let actionObj = getDiscoveredActions(perInstanceStatus, installationMode);
    let ec2Details = [
        {
            id: discoveredRow?.ec2InstanceId,
            name: discoveredRow?.ec2InstanceName
        }
    ];
    const result = {
        id: discoveredRow?.ec2InstanceId,
        ec2InstanceId: discoveredRow?.ec2InstanceId,
        ec2InstanceName: discoveredRow?.ec2InstanceName,
        resourceId: discoveredRow?.key,
        name: getDiscoverHostname(discoveredRow),
        status: ssmState, // discover status will depends on ssmState only
        ssmState: ssmState,
        totalInstance: totalInstanceCount,
        managedInstance: 0,
        serverInstallationMode: installationMode,
        serverAllInstallationMode: getAllDiscoverInstallationMode(discoveredRow),
        vpcId: discoveredRow?.vpc?.id,
        vpcName: discoveredRow?.vpc?.name,
        vpcCidr: discoveredRow?.vpc?.cidrBlock,
        action: actionObj?.action,
        actionDisable: actionObj?.actionDisable,
        isManagedHost: false,
        loading: false,
        storageType: actionObj?.storageType,
        isDetected: actionObj?.isDetected,
        ec2Details: ec2Details,
        hostType: GENERAL.MICROSOFT_SQL_SERVER_TYPE,
        // **** Below values will get from Instances API *****
        // estimatedUsageCost: {}, // Initially it will be blank
        // totalCost: '',
        // allocatedCapacity: '',
        sqlServerInstances: formatDiscoverInstanceData(discoveredRow, perInstanceStatus),
        credentialId: discoveredRow?.credentialId,
        regionId: discoveredRow?.regionId,
        credentialName: credentialMapping?.[discoveredRow?.credentialId || GENERAL.NOT_AVAILABLE]?.name,
        accountId: credentialMapping?.[discoveredRow?.credentialId || GENERAL.NOT_AVAILABLE]?.providerAccountId,
        regionName: regionMapping?.[discoveredRow?.regionId || GENERAL.NOT_AVAILABLE]?.regionName
    };
    return result;
};

export const getDiscoverHostname = (discoveredRow: DiscoverHostInterface) => {
    let name = '';
    if (discoveredRow?.sqlServerInstances) {
        for (let i = 0; i < discoveredRow?.sqlServerInstances?.length; i++) {
            const val = discoveredRow?.sqlServerInstances[i];
            if (val?.sqlServerName) {
                name = val?.sqlServerName;
                break;
            }
        }
    }
    return name;
};

export const getDiscoverSsmState = (row: DiscoverHostInterface) => {
    if (row?.ssmState && row?.ssmState !== INVENTORY_STATUS.NOT_AVAILABLE) {
        if (row?.ssmState?.toLowerCase() === INVENTORY_STATUS.SSM_CONNECTED) {
            return INVENTORY_STATUS.ONLINE;
        } else {
            return INVENTORY_STATUS.OFFLINE;
        }
    } else {
        return INVENTORY_STATUS.OFFLINE;
    }
};

export const getDiscoverInstallationMode = (row: DiscoverHostInterface) => {
    let installationMode = '';
    if (row?.sqlServerInstances && row?.sqlServerInstances?.length > 0) {
        for (let i = 0; i < row?.sqlServerInstances?.length; i++) {
            const val = row?.sqlServerInstances[i];
            if (val?.sqlServerDeploymentType) {
                installationMode = val?.sqlServerDeploymentType;
                break;
            }
        }
        if (installationMode?.toLowerCase() === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE) {
            installationMode = GENERAL.FAILOVER_CLUSTER_INSTANCES;
        } else if (installationMode?.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG) {
            installationMode = GENERAL.AOAG;
        } else if (installationMode.toLowerCase() === SQL_DEPLOYMENT_MODE.HA) {
            installationMode = GENERAL.HA;
        }
        return installationMode;
    } else {
        return '';
    }
};

export const getAllDiscoverInstallationMode = (row: DiscoverHostInterface) => {
    let installationMode: Array<string> = [];
    if (row?.sqlServerInstances && row?.sqlServerInstances?.length > 0) {
        for (let i = 0; i < row?.sqlServerInstances?.length; i++) {
            const val = row?.sqlServerInstances[i];
            let perInstallationMode = val?.sqlServerDeploymentType?.toLowerCase();
            if (perInstallationMode === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE) {
                perInstallationMode = GENERAL.FAILOVER_CLUSTER_INSTANCES;
            } else if (perInstallationMode === SQL_DEPLOYMENT_MODE.AOAG) {
                perInstallationMode = GENERAL.AOAG;
            } else if (perInstallationMode === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
                perInstallationMode = GENERAL.STANDALONE;
            } else if (perInstallationMode === SQL_DEPLOYMENT_MODE.HA) {
                perInstallationMode = GENERAL.HA;
            }
            if (perInstallationMode && !installationMode.includes(perInstallationMode)) {
                installationMode.push(perInstallationMode);
            }
        }
        return installationMode;
    } else {
        return [];
    }
};

export const getDiscoveredPerInstanceStatus = (row: DiscoverHostInterface, ssmState: string) => {
    let result: Array<StatusObjInterface> = [];
    let state = store.getState();
    const fsxCredentialStatusObj = state?.inventoryV2?.fsxCredentialStatusObj;
    if (row?.sqlServerInstances && row?.sqlServerInstances?.length > 0) {
        row?.sqlServerInstances?.map((perRow: SQLServerInstancesDiscovered) => {
            let statusObj = {};
            if (perRow?.sqlServerInstance) {
                const isWindowAuthentication = perRow?.windowsAuthentication;
                const isSqlAuthentication = perRow?.sqlServerAuthentication;
                let fsxCredentialValidationFailed;
                let storageTypeCheck;
                let fsxIdObject = perRow?.storage?.find(
                    (item: DiscoveredStorageObj) => item.type === DETECT_HOST_VAR.FSXN
                );
                if (perRow?.storage && perRow?.storage?.length > 0) {
                    fsxCredentialValidationFailed = perRow?.storage?.find(
                        (item: DiscoveredStorageObj) =>
                            item.type === DETECT_HOST_VAR.FSXN && !fsxCredentialStatusObj?.[item.id!]
                    );
                    storageTypeCheck = perRow?.storage?.find(
                        (item: DiscoveredStorageObj) =>
                            item.type === DETECT_HOST_VAR.FSXN ||
                            item.type === DETECT_HOST_VAR.FSXW ||
                            item.type === DETECT_HOST_VAR.EBS
                    );
                }

                if (
                    ssmState !== INVENTORY_STATUS.ONLINE ||
                    (!isWindowAuthentication && !isSqlAuthentication) ||
                    fsxCredentialValidationFailed ||
                    !storageTypeCheck
                ) {
                    let detectOptionObj = getDetectOptionForInstance(
                        perRow,
                        row?.ssmState,
                        fsxIdObject?.id,
                        fsxCredentialStatusObj
                    );
                    statusObj = {
                        ...detectOptionObj,
                        name: perRow.sqlServerInstance,
                        status: INVENTORY_STATUS.UNDETECTED,
                        storageType: perRow?.storage,
                        fsxId: fsxIdObject?.id,
                        isFsxRegistered: !fsxCredentialValidationFailed
                    };
                } else {
                    statusObj = {
                        name: perRow.sqlServerInstance,
                        status: INVENTORY_STATUS.UNMANAGED,
                        storageType: perRow?.storage,
                        fsxId: fsxIdObject?.id,
                        isFsxRegistered: !fsxCredentialValidationFailed
                    };
                }
                result = [...result, ...[statusObj]];
            }
        });
    }
    return result;
};

export const getDetectOptionForInstance = (
    perRow: SQLServerInstancesDiscovered,
    ssmState: string | undefined,
    fsxId: string | undefined,
    fsxCredentialStatusObj: any
) => {
    let hasStorageTypes = false;
    if (perRow?.storage && perRow?.storage?.length > 0) {
        hasStorageTypes = true;
    }
    let detectOption = DETECT_HOST_VAR.DISABLE;
    let detectOptionDisableMsg = '';
    let isSqlRunning = perRow?.sqlServerState === DETECT_HOST_VAR.RUNNING;
    if (ssmState?.toLowerCase() !== INVENTORY_STATUS.SSM_CONNECTED) {
        detectOption = DETECT_HOST_VAR.HIDE;
        detectOptionDisableMsg = GENERAL.SSM_CONNECTION_DOWN;
    } else if (!isSqlRunning) {
        detectOption = DETECT_HOST_VAR.DISABLE;
        detectOptionDisableMsg = GENERAL.SQL_SERVER_NOT_RUNNING;
    } else if (!hasStorageTypes && (perRow?.windowsAuthentication || perRow?.sqlServerAuthentication)) {
        detectOption = DETECT_HOST_VAR.DISABLE;
        detectOptionDisableMsg = GENERAL.STORAGE_NOT_PRESENT;
    } else if ((fsxId && fsxId in fsxCredentialStatusObj) || !fsxId) {
        detectOption = DETECT_HOST_VAR.SHOW;
    }
    return {
        detectOption: detectOption,
        detectOptionDisableMsg: detectOptionDisableMsg
    };
};

export const getDiscoveredActions = (row: Array<StatusObjInterface>, installationMode: string | null) => {
    let action = '';
    let actionDisable = false;
    let undetected = row?.filter((per: StatusObjInterface) => per?.status === INVENTORY_STATUS.UNDETECTED);
    let unmanaged = row?.filter((per: StatusObjInterface) => per?.status === INVENTORY_STATUS.UNMANAGED);
    let isStorage = row?.find((per: StatusObjInterface) => {
        if (per?.storageType && per?.storageType?.length > 0) {
            return per;
        }
    });
    let isFsxn = false;
    let isFsxw = false;
    let isEbs = false;
    row?.map((per: StatusObjInterface) => {
        if (per?.storageType && per?.storageType?.length > 0) {
            per?.storageType?.map((item: any) => {
                if (item.type === DETECT_HOST_VAR.FSXN) {
                    isFsxn = true;
                }
                if (item.type === DETECT_HOST_VAR.FSXW) {
                    isFsxw = true;
                }
                if (item.type === DETECT_HOST_VAR.EBS) {
                    isEbs = true;
                }
            });
        }
    });
    if (!isFsxn && isStorage) {
        action = INVENTORY_ACTIONS.EXPLORE_SAVINGS;
        actionDisable = undetected?.length > 0 && unmanaged?.length === 0 ? true : false;
    } else {
        action = INVENTORY_ACTIONS.MANAGE;
        if ((undetected?.length > 0 && unmanaged?.length > 0) || (undetected?.length === 0 && unmanaged?.length > 0)) {
            if (installationMode && installationMode === GENERAL.AOAG) {
                // For AOAG currently we cant manage host
                actionDisable = true;
            } else {
                actionDisable = false;
            }
        } else {
            actionDisable = true;
        }
    }
    let storageType = '';
    if (isFsxn) {
        storageType = GENERAL.FSX_FOR_ONTAP;
    } else if (isFsxw) {
        storageType = GENERAL.FSX_FOR_WINDOWS;
    } else if (isEbs) {
        storageType = GENERAL.EBS;
    }
    return {
        action: action,
        actionDisable: actionDisable,
        storageType: storageType,
        isDetected: unmanaged?.length > 0 ? true : false
    };
};

export const getDiscoverFileSystemType = (row: SQLServerInstancesDiscovered) => {
    const typeList: string[] = [];
    row?.storage?.map((storageObj: any) => {
        if (storageObj.type === DETECT_HOST_VAR.FSXN && !typeList.includes(GENERAL.FSX_FOR_ONTAP)) {
            typeList.push(GENERAL.FSX_FOR_ONTAP);
        }
        if (storageObj.type === DETECT_HOST_VAR.EBS && !typeList.includes(GENERAL.EBS)) {
            typeList.push(GENERAL.EBS);
        }
        if (storageObj.type === DETECT_HOST_VAR.FSXW && !typeList.includes(GENERAL.FSX_FOR_WINDOWS)) {
            typeList.push(GENERAL.FSX_FOR_WINDOWS);
        }
    });
    return typeList.join(', ');
};

export const formatDiscoverInstanceData = (
    row: DiscoverHostInterface,
    perInstanceStatus: Array<StatusObjInterface>
) => {
    let instanceRows = row?.sqlServerInstances?.map((perRow: SQLServerInstancesDiscovered) => {
        const statusObj = perInstanceStatus?.filter(
            (per: StatusObjInterface) => per?.name === perRow?.sqlServerInstance
        );
        return {
            ...perRow,
            databaseInstanceId: perRow?.serverGuid,
            databaseInstanceName: perRow?.sqlServerInstance,
            status: perRow?.sqlServerState,
            // databaseCount: 0,
            databaseCount: perRow?.databaseCount,
            statusColText: statusObj ? statusObj?.[0]?.status : INVENTORY_STATUS.UNDETECTED,
            fileSystemDeploymentMode: getAzType(perRow?.deploymentTypes?.[0]?.type || ''),
            fileSystemType: getDiscoverFileSystemType(perRow),
            storage: perRow?.storage,
            fsxId: statusObj?.[0]?.fsxId,
            isFsxRegistered: statusObj?.[0]?.isFsxRegistered,
            sqlServerAuthentication: perRow?.sqlServerAuthentication,
            windowsAuthentication: perRow?.windowsAuthentication,
            detectOption: statusObj?.[0]?.detectOption,
            detectOptionDisableMsg: statusObj?.[0]?.detectOptionDisableMsg
            // protection: {},
            // performance: {},
            // storageSavingsText: '',
            // allocatedCapacity:
            //     (perRow?.storage?.fsxn?.size || 0) +
            //     (perRow?.storage?.fsxw?.size || 0) +
            //     (perRow?.storage?.ebs?.size || 0)
        };
    });
    return instanceRows;
};

export const sortInventoryTableData = (data: Array<InventoryTableData>) => {
    if (!data || data.length < 2) {
        return data;
    }

    const databasesWeights: any = {
        [DBType.MSSQL]: 30000,
        [DBType.ORACLE]: 20000,
        [DBType.POSTGRESQL]: 10000
    };

    const statusWeights: any = {
        [INVENTORY_STATUS.ONLINE]: 3000,
        [INVENTORY_STATUS.OFFLINE]: 2000,
        [INVENTORY_STATUS.UNKNOWN]: 1000,
        '': 0
    };

    const actionWeights: any = {
        [GENERAL.FSX_FOR_ONTAP]: 30,
        [GENERAL.EBS]: 20,
        [GENERAL.FSX_FOR_WINDOWS]: 10,
        '': 0
    };

    const isDetectedWeights: any = {
        true: 300,
        false: 10,
        '': 0
    };

    const result = data.slice().sort((a, b) => {
        let aManageWeight = 0;
        if (a?.totalInstance !== 0 && a?.totalInstance === a?.managedInstance) {
            aManageWeight = 5;
        }
        let bManageWeight = 0;
        if (b?.totalInstance !== 0 && b?.totalInstance === b?.managedInstance) {
            bManageWeight = 5;
        }
        const weightA =
            databasesWeights[a?.hostType || ''] +
            statusWeights[a.status || ''] +
            actionWeights[a?.storageType || ''] +
            aManageWeight +
            isDetectedWeights[a?.isDetected?.toString() || ''];
        const weightB =
            databasesWeights[b?.hostType || ''] +
            statusWeights[b.status || ''] +
            actionWeights[b?.storageType || ''] +
            bManageWeight +
            isDetectedWeights[b?.isDetected?.toString() || ''];

        return weightB - weightA;
    });

    return result;
};

export const sortInstanceTableData = (data: Array<InventoryTableData>) => {
    if (!data || data.length < 2) {
        return data;
    }

    const databasesWeights: any = {
        [DBType.MSSQL]: 30000,
        [DBType.ORACLE]: 20000,
        [DBType.POSTGRESQL]: 10000
    };

    const statusWeights: any = {
        [INVENTORY_STATUS.CASE_SENSITIVE_UP]: 3000,
        [INVENTORY_STATUS.RUNNING]: 3000,
        [INVENTORY_STATUS.CASE_SENSITIVE_DOWN]: 2000,
        [INVENTORY_STATUS.STOPPED]: 2000,
        [INVENTORY_STATUS.UNKNOWN]: 1000,
        '': 0
    };

    const isManagedWeights: any = {
        [INVENTORY_STATUS.MANAGED]: 300,
        [INVENTORY_STATUS.UNMANAGED]: 200,
        [INVENTORY_STATUS.IN_PROGRESS]: 200,
        [INVENTORY_STATUS.UNDETECTED]: 100,
        '': 0
    };

    const result = data.slice().sort((a, b) => {
        const weightA =
            databasesWeights[a?.hostType || ''] +
            statusWeights[a.status || ''] +
            isManagedWeights[a?.statusColText || ''];
        const weightB =
            databasesWeights[b?.hostType || ''] +
            statusWeights[b.status || ''] +
            isManagedWeights[b?.statusColText || ''];

        return weightB - weightA;
    });

    return result;
};

export const sortDatabaseTableData = (data: Array<InventoryTableData>) => {
    if (!data || data.length < 2) {
        return data;
    }
    // Sorting based on database type and status
    const databasesWeights: any = {
        [DBType.MSSQL]: 30000,
        [DBType.ORACLE]: 20000,
        [DBType.POSTGRESQL]: 10000
    };

    const statusWeights: any = {
        ONLINE: 3000,
        OFFLINE: 2000,
        UNKNOWN: 1000
    };

    const result = data.slice().sort((a, b) => {
        const weightA = databasesWeights[a?.hostType || ''] + statusWeights[a.status || ''];

        const weightB = databasesWeights[b?.hostType || ''] + statusWeights[b.status || ''];

        return weightB - weightA;
    });

    return result;
};

export const getMhUnmanagedInstances = (
    databaseHostsData: { [key: string]: InventoryTableData },
    runningInstanceList: Array<string>
) => {
    let instanceList: Array<string> = [];
    let updatedState = store.getState();
    let { headerSelectedCred, headerSelectedRegion }: any = updatedState?.headers;
    Object.keys(databaseHostsData).map((key: string) => {
        if (
            runningInstanceList.includes(
                uniqueHostRow(
                    databaseHostsData[key]?.ec2InstanceId || '',
                    databaseHostsData[key]?.credentialId || '',
                    databaseHostsData[key]?.regionId || ''
                )
            )
        ) {
            return;
        }
        if (databaseHostsData[key]?.action === INVENTORY_ACTIONS.MANAGE && !databaseHostsData[key]?.actionDisable) {
            instanceList.push(
                uniqueHostRow(
                    databaseHostsData[key]?.ec2InstanceId || '',
                    databaseHostsData[key]?.credentialId || '',
                    databaseHostsData[key]?.regionId || ''
                )
            );
        }
    });
    return instanceList;
};

export const getUnmanagedHostInstances = (
    databaseHostsData: { [key: string]: InventoryTableData },
    runningInstanceList: Array<string>
) => {
    let instanceList: Array<string> = [];
    Object.keys(databaseHostsData).map((key: string) => {
        if (
            runningInstanceList.includes(
                uniqueHostRow(
                    databaseHostsData[key]?.ec2InstanceId || '',
                    databaseHostsData[key]?.credentialId || '',
                    databaseHostsData[key]?.regionId || ''
                )
            )
        ) {
            return;
        }
        if (
            (databaseHostsData[key]?.action === INVENTORY_ACTIONS.MANAGE && !databaseHostsData[key]?.actionDisable) ||
            (databaseHostsData[key]?.action === INVENTORY_ACTIONS.EXPLORE_SAVINGS && databaseHostsData[key]?.isDetected)
        ) {
            instanceList.push(
                uniqueHostRow(
                    databaseHostsData[key]?.ec2InstanceId || '',
                    databaseHostsData[key]?.credentialId || '',
                    databaseHostsData[key]?.regionId || ''
                )
            );
        }
    });
    return instanceList;
};

export const updateInstancesApiResponse = (
    mssqlInstancesData: { [key: string]: InstancesObjectInterface },
    inventoryTableData: { [key: string]: InventoryTableData }
) => {
    let result = inventoryTableData;
    Object.keys(mssqlInstancesData).map((key: string) => {
        if (inventoryTableData?.[key]) {
            const newData = updateInventoryDatawithInstancesRes(inventoryTableData[key], mssqlInstancesData[key]);
            result = {
                ...result,
                [key]: newData
            };
        } else {
            let inventoryRow;
            let resourceId = '';
            Object.keys(inventoryTableData).map((inst: string) => {
                let currInst = inventoryTableData[inst];
                if (
                    currInst?.ec2InstanceId &&
                    currInst?.credentialId &&
                    currInst?.regionId &&
                    uniqueHostRow(currInst?.ec2InstanceId, currInst?.credentialId, currInst?.regionId) === key
                ) {
                    inventoryRow = inventoryTableData[inst];
                    resourceId = inst;
                }
            });
            if (inventoryRow) {
                const newData = updateInventoryDatawithInstancesRes(inventoryRow, mssqlInstancesData[key]);
                result = {
                    ...result,
                    [resourceId]: newData
                };
            }
        }
    });
    return result;
};

export const updateInventoryDatawithInstancesRes = (
    inventoryRow: InventoryTableData,
    instanceRow: InstancesObjectInterface
) => {
    let result = {};
    // Need to check if really required
    // if (inventoryRow?.hasInstanceData) {
    //     return {
    //         ...inventoryRow,
    //         loading: false
    //     };
    // }
    if (instanceRow?.loading) {
        result = {
            ...inventoryRow,
            isManagedHost: instanceRow?.isManagedHost,
            loading: instanceRow?.loading
        };
    } else if (instanceRow?.isManagedHost) {
        result = {
            ...inventoryRow,
            isManagedHost: instanceRow?.isManagedHost,
            loading: instanceRow?.loading,
            hasInstanceData: true,
            estimatedUsageCost: instanceRow?.data?.estimatedUsageCost,
            totalCost: getTotalCost(instanceRow?.data?.estimatedUsageCost || {}),
            sqlLicenseIncluded: instanceRow?.data?.sqlLicenseIncluded,
            serverInstallationMode: !inventoryRow?.serverInstallationMode
                ? getInstallationMode(instanceRow?.data)
                : inventoryRow?.serverInstallationMode,
            serverAllInstallationMode: !inventoryRow?.serverAllInstallationMode
                ? getAllInstallationMode(instanceRow?.data)
                : inventoryRow?.serverAllInstallationMode,
            sqlServerInstances: updateSqlServerInstancesForUnmanaged(
                instanceRow?.data,
                inventoryRow,
                instanceRow?.isManagedHost
            )
        };
        if (instanceRow) {
            const allocatedCapacity = getMergedAllocatedCapacity([instanceRow?.data]);
            result = {
                ...result,
                allocatedCapacity: allocatedCapacity,
                allocatedCapacityText: allocatedCapacity ? formatSizeTwoPrecision(allocatedCapacity) : ''
            };
        }
    } else if (!instanceRow?.isManagedHost) {
        let partnerInstanceId = '';
        let partnerInstanceData: any = null;
        if (instanceRow?.data && inventoryRow?.ec2InstanceId) {
            partnerInstanceId = getPartnerInstanceId(instanceRow?.data, inventoryRow?.ec2InstanceId);
        }
        if (partnerInstanceId) {
            partnerInstanceData = partnerNodeInstanceData(partnerInstanceId);
        }

        if (partnerInstanceData && partnerInstanceData?.loading) {
            result = {
                ...inventoryRow,
                isManagedHost: partnerInstanceData?.isManagedHost,
                loading: partnerInstanceData?.loading
            };
        } else if (partnerInstanceData && !partnerInstanceData?.loading) {
            const ec2Details = getEc2DetailsForUnmanagedHost(instanceRow);
            let mergedCost = mergeEstimatedCost(instanceRow, partnerInstanceData);
            let allocatedCapacity = getMergedAllocatedCapacity([instanceRow?.data, partnerInstanceData?.data]);
            let ebsResourceInfo = mergeEbsResourceInfo(instanceRow, partnerInstanceData);
            result = {
                ...inventoryRow,
                name: inventoryRow?.name || instanceRow?.data?.name,
                isManagedHost: instanceRow?.isManagedHost,
                loading: instanceRow?.loading,
                ec2Details: ec2Details?.length > 0 ? ec2Details : inventoryRow?.ec2Details,
                estimatedUsageCost: mergedCost,
                totalCost: getTotalCost(mergedCost || {}),
                allocatedCapacity: allocatedCapacity,
                allocatedCapacityText: allocatedCapacity ? formatSizeTwoPrecision(allocatedCapacity) : '',
                hasInstanceData: true,
                sqlLicenseIncluded: instanceRow?.data?.sqlLicenseIncluded,
                sqlServerInstances: updateSqlServerInstancesForBothNodes(
                    instanceRow?.data,
                    partnerInstanceData?.data,
                    inventoryRow
                ),
                //For explore savings
                ebsResourceInfo: ebsResourceInfo,
                clusterNodeDetails: instanceRow?.data?.clusterNodeDetails
            };
        } else {
            const allocatedCapacity = getMergedAllocatedCapacity([instanceRow?.data]);
            const ec2Details = getEc2DetailsForUnmanagedHost(instanceRow);
            result = {
                ...inventoryRow,
                name: inventoryRow?.name || instanceRow?.data?.name,
                isManagedHost: instanceRow?.isManagedHost,
                loading: instanceRow?.loading,
                ec2Details: ec2Details?.length > 0 ? ec2Details : inventoryRow?.ec2Details,
                estimatedUsageCost: instanceRow?.data?.estimatedUsageCost,
                totalCost: getTotalCost(instanceRow?.data?.estimatedUsageCost || {}),
                allocatedCapacity: allocatedCapacity,
                allocatedCapacityText: allocatedCapacity ? formatSizeTwoPrecision(allocatedCapacity) : '',
                hasInstanceData: false,
                sqlLicenseIncluded: instanceRow?.data?.sqlLicenseIncluded,
                sqlServerInstances: updateSqlServerInstancesForUnmanaged(
                    instanceRow?.data,
                    inventoryRow,
                    instanceRow?.isManagedHost
                ),
                //For explore savings
                ebsResourceInfo: instanceRow?.data?.ebsResourceInfo,
                clusterNodeDetails: instanceRow?.data?.clusterNodeDetails
            };
        }
    } else {
        result = {
            ...inventoryRow
        };
    }
    return result;
};

export const partnerNodeInstanceData = (partnerInstanceId: string) => {
    let updatedState = store.getState();
    let { mssqlInstancesData }: any = updatedState?.inventoryV2;
    return mssqlInstancesData?.[partnerInstanceId];
};

export const mergeEstimatedCost = (instanceData: any, partnerInstanceData: any) => {
    let fsxnCost = 0;
    let fsxwCost = 0;
    let uniqueFsxnId: Array<String> = [];
    let uniqueFsxwId: Array<String> = [];
    instanceData?.data?.fsxnResourceInfo?.map((perFsx: any) => {
        if (!uniqueFsxnId.includes(perFsx?.id)) {
            fsxnCost += perFsx?.capacityCost;
            fsxnCost += perFsx?.operationalCost;
            uniqueFsxnId.push(perFsx?.id);
        }
    });
    partnerInstanceData?.data?.fsxnResourceInfo?.map((perFsx: any) => {
        if (!uniqueFsxnId.includes(perFsx?.id)) {
            fsxnCost += perFsx?.capacityCost;
            fsxnCost += perFsx?.operationalCost;
            uniqueFsxnId.push(perFsx?.id);
        }
    });

    instanceData?.data?.fsxwResourceInfo?.map((perFsxw: any) => {
        if (!uniqueFsxwId.includes(perFsxw?.id)) {
            fsxwCost += perFsxw?.capacityCost;
            fsxwCost += perFsxw?.operationalCost;
            uniqueFsxwId.push(perFsxw?.id);
        }
    });
    partnerInstanceData?.data?.fsxwResourceInfo?.map((perFsxw: any) => {
        if (!uniqueFsxwId.includes(perFsxw?.id)) {
            fsxwCost += perFsxw?.capacityCost;
            fsxwCost += perFsxw?.operationalCost;
            uniqueFsxwId.push(perFsxw?.id);
        }
    });
    let estimatedUsageCost = {
        compute:
            (instanceData?.data?.estimatedUsageCost?.compute || 0) +
            (partnerInstanceData?.data?.estimatedUsageCost?.compute || 0),
        storage: {
            fsxw: fsxwCost
                ? fsxwCost
                : (instanceData?.data?.estimatedUsageCost?.storage?.fsxw || 0) +
                  (partnerInstanceData?.data?.estimatedUsageCost?.storage?.fsxw || 0),
            fsxn: fsxnCost
                ? fsxnCost
                : (instanceData?.data?.estimatedUsageCost?.storage?.fsxn || 0) +
                  (partnerInstanceData?.data?.estimatedUsageCost?.storage?.fsxn || 0),
            ebs:
                (instanceData?.data?.estimatedUsageCost?.storage?.ebs || 0) +
                (partnerInstanceData?.data?.estimatedUsageCost?.storage?.ebs || 0)
        },
        connectivity:
            (instanceData?.data?.estimatedUsageCost?.connectivity || 0) +
            (partnerInstanceData?.data?.estimatedUsageCost?.connectivity || 0),
        others:
            (instanceData?.data?.estimatedUsageCost?.others || 0) +
            (partnerInstanceData?.data?.estimatedUsageCost?.others || 0),
        estimationType:
            instanceData?.data?.estimatedUsageCost?.estimationType ||
            partnerInstanceData?.data?.estimatedUsageCost?.estimationType
    };
    return estimatedUsageCost;
};

export const mergeEbsResourceInfo = (instanceRow: any, partnerInstanceData: any) => {
    let instanceEbsData = instanceRow?.data?.ebsResourceInfo || [];
    let partnerInstanceEbsData = partnerInstanceData?.data?.ebsResourceInfo || [];
    return [...instanceEbsData, ...partnerInstanceEbsData];
};

export const getMergedAllocatedCapacity = (nodeList: Array<ManagedHostsRowInterface | undefined>) => {
    let fsxnCapacity = 0;
    let fsxwCapacity = 0;
    let ebsCapacity = 0;
    let uniqueFsxnId: Array<String> = [];
    let uniqueFsxwId: Array<String> = [];
    let uniqueVolId: Array<String> = [];
    nodeList?.map(node => {
        node?.fsxnResourceInfo?.map((perFsx: any) => {
            if (!uniqueFsxnId.includes(perFsx?.id)) {
                fsxnCapacity += perFsx?.size;
                uniqueFsxnId.push(perFsx?.id);
            }
        });
    });

    nodeList?.map(node => {
        node?.fsxwResourceInfo?.map((perFsxw: any) => {
            if (!uniqueFsxwId.includes(perFsxw?.id)) {
                fsxwCapacity += perFsxw?.size;
                uniqueFsxwId.push(perFsxw?.id);
            }
        });
    });

    nodeList?.map(node => {
        node?.ebsResourceInfo?.map((perVol: any) => {
            if (perVol?.id && !perVol?.id?.toLowerCase().includes('root_volume') && !uniqueVolId.includes(perVol?.id)) {
                ebsCapacity += perVol?.size;
                uniqueVolId.push(perVol?.id);
            }
        });
    });

    let allocatedCapacity = fsxnCapacity + fsxwCapacity + ebsCapacity;
    return allocatedCapacity;
};

export const getEc2DetailsForUnmanagedHost = (instanceRow: InstancesObjectInterface) => {
    const ec2Details: Array<EC2DetailsInterface> = [];
    let instanceId = '';
    if (instanceRow?.data?.nodeTopology?.ec2Details && instanceRow?.data?.nodeTopology?.ec2Details?.length > 0) {
        instanceId = instanceRow?.data?.nodeTopology?.ec2Details?.[0]?.id || '';
        ec2Details.push(instanceRow?.data?.nodeTopology?.ec2Details?.[0]);
    }
    if (instanceRow?.data?.clusterNodeDetails) {
        if (instanceId) {
            let partnerNode = instanceRow?.data?.clusterNodeDetails?.filter(
                perInst => perInst?.ec2InstanceId !== instanceId
            );
            if (partnerNode && partnerNode?.length > 0) {
                ec2Details.push({
                    id: partnerNode[0]?.ec2InstanceId,
                    name: partnerNode[0]?.ec2InstanceName,
                    instanceType: partnerNode[0]?.ec2InstanceType
                });
            }
        } else {
            let node1 = instanceRow?.data?.clusterNodeDetails?.[0];
            let node2 = instanceRow?.data?.clusterNodeDetails?.[1];
            if (node1) {
                ec2Details.push({
                    id: node1?.ec2InstanceId,
                    name: node1?.ec2InstanceName,
                    instanceType: node1?.ec2InstanceType
                });
            }
            if (node2) {
                ec2Details.push({
                    id: node2?.ec2InstanceId,
                    name: node2?.ec2InstanceName,
                    instanceType: node2?.ec2InstanceType
                });
            }
        }
    }
    return ec2Details;
};

export const updateSqlServerInstancesForBothNodes = (
    instanceData: InstancesHostsRowInterface | undefined,
    partnerData: InstancesHostsRowInterface | undefined,
    existingInstanceRow: InventoryTableData
) => {
    let instanceRows;
    if (existingInstanceRow) {
        instanceRows = existingInstanceRow?.sqlServerInstances;
    }
    if (instanceData?.databaseInstancesSummary && instanceData?.databaseInstancesSummary?.length > 0) {
        instanceRows = instanceRows?.map((instRow: InventoryTableInstanceDatInterface) => {
            const perRowNode = instanceData?.databaseInstancesSummary?.find(
                (per: DatabaseInstancesSummaryInterface) => per?.databaseInstanceName === instRow?.databaseInstanceName
            );
            const perRowNodeStatus = instanceData?.databaseInstanceDetails?.find(
                (per: DatabaseInstanceDetailsInterface) => per?.instanceName === instRow?.databaseInstanceName
            );
            const perRowPartner = partnerData?.databaseInstancesSummary?.find(
                (per: DatabaseInstancesSummaryInterface) => per?.databaseInstanceName === instRow?.databaseInstanceName
            );
            const perRowPartnerStatus = partnerData?.databaseInstanceDetails?.find(
                (per: DatabaseInstanceDetailsInterface) => per?.instanceName === instRow?.databaseInstanceName
            );
            let perRow: any;
            if (
                perRowNodeStatus?.instanceState &&
                perRowNodeStatus?.instanceState?.toLowerCase() === INVENTORY_STATUS.UP
            ) {
                perRow = perRowNode;
            } else if (
                perRowPartnerStatus?.instanceState &&
                perRowPartnerStatus?.instanceState?.toLowerCase() === INVENTORY_STATUS.UP
            ) {
                perRow = perRowPartner;
            } else {
                perRow = perRowNode;
            }
            let allocatedCapacity = 0;
            if (getDiscoveredHostDeploymentV2(perRow) === GENERAL.AOAG) {
                allocatedCapacity =
                    (perRowNode?.storage?.fsxn?.size || 0) +
                    (perRowNode?.storage?.fsxw?.size || 0) +
                    (perRowNode?.storage?.ebs?.size || 0) +
                    (perRowPartner?.storage?.fsxn?.size || 0) +
                    (perRowPartner?.storage?.fsxw?.size || 0) +
                    (perRowPartner?.storage?.ebs?.size || 0);
            } else {
                allocatedCapacity =
                    (perRow?.storage?.fsxn?.size || 0) +
                    (perRow?.storage?.fsxw?.size || 0) +
                    (perRow?.storage?.ebs?.size || 0);
            }
            const perfData = getPerfUnmanagedData(
                existingInstanceRow?.ec2InstanceId || '',
                existingInstanceRow?.credentialId || '',
                existingInstanceRow?.regionId || '',
                instRow,
                partnerData?.id
            );
            return {
                ...instRow,
                loading: perfData?.loading,
                fileSystemType: perRow?.databaseInstanceTopology?.fileSystemType || instRow?.fileSystemType,
                fsxId: perRow?.databaseInstanceTopology?.fileSystemId || instRow?.fsxId,
                protection: perfData?.protection || instRow?.protection || perRow?.protection,
                performance: perfData?.performance || instRow?.performance || perRow?.performance,
                storage: instRow?.storage || perRow?.storage,
                storageSavingsText: getStorageSavingsText(perRow || {}),
                allocatedCapacity: allocatedCapacity,
                allocatedCapacityText: allocatedCapacity ? formatSizeTwoPrecision(allocatedCapacity) : '',
                databaseServer: perRow?.databaseServer,
                fileSystemDeploymentMode:
                    instRow?.fileSystemDeploymentMode ||
                    getAzType(perRow?.databaseInstanceTopology?.fileSystemDeploymentMode)
            };
        });
    }
    return instanceRows;
};

export const updateSqlServerInstancesForUnmanaged = (
    instanceData: InstancesHostsRowInterface | undefined,
    existingInstanceRow: InventoryTableData,
    isManagedHost: boolean | undefined
) => {
    let instanceRows;
    if (existingInstanceRow) {
        instanceRows = existingInstanceRow?.sqlServerInstances;
    }
    if (instanceData?.databaseInstancesSummary && instanceData?.databaseInstancesSummary?.length > 0) {
        // To check if manage/unmanage/undetected mixed case
        let nonManagedStatus: any = [];
        if (isManagedHost) {
            const isAllManaged = instanceData?.databaseInstanceDetails?.every(perRow => {
                return perRow?.isManaged ? true : false;
            });
            if (!isAllManaged) {
                nonManagedStatus = getInstanceStatusForMixedCase(instanceData);
                // to call data for mixed case. use in statusColText for unmanaged case
            }
        }
        instanceRows = instanceRows?.map((instRow: InventoryTableInstanceDatInterface) => {
            if (instRow?.statusColText !== INVENTORY_STATUS.MANAGED) {
                const perRow = instanceData?.databaseInstancesSummary?.find(
                    (per: DatabaseInstancesSummaryInterface) =>
                        per?.databaseInstanceName === instRow?.databaseInstanceName
                );
                const statusObj = nonManagedStatus?.filter(
                    (per: StatusObjInterface) => per?.name === instRow?.databaseInstanceName
                );
                const allocatedCapacity = instRow?.allocatedCapacity
                    ? instRow?.allocatedCapacity
                    : (perRow?.storage?.fsxn?.size || 0) +
                      (perRow?.storage?.fsxw?.size || 0) +
                      (perRow?.storage?.ebs?.size || 0);
                const perfData = getPerfUnmanagedData(
                    existingInstanceRow?.ec2InstanceId || '',
                    existingInstanceRow?.credentialId || '',
                    existingInstanceRow?.regionId || '',
                    instRow
                );
                return {
                    ...instRow,
                    databaseCount: perRow?.databaseCount,
                    fileSystemType: perRow?.databaseInstanceTopology?.fileSystemType || instRow?.fileSystemType,
                    fsxId: perRow?.databaseInstanceTopology?.fileSystemId || instRow?.fsxId,
                    loading: perfData?.loading,
                    protection: instRow?.protection || perfData?.protection,
                    performance: instRow?.performance || perfData?.performance,
                    storage: instRow?.storage || perRow?.storage,
                    storageSavingsText: getStorageSavingsText(perRow || {}),
                    allocatedCapacity: allocatedCapacity,
                    allocatedCapacityText: allocatedCapacity ? formatSizeTwoPrecision(allocatedCapacity) : '',
                    databaseServer: instRow?.databaseServer || perRow?.databaseServer,
                    statusColText:
                        isManagedHost && statusObj?.[0]?.status ? statusObj?.[0]?.status : instRow?.statusColText,
                    fileSystemDeploymentMode:
                        instRow?.fileSystemDeploymentMode ||
                        getAzType(perRow?.databaseInstanceTopology?.fileSystemDeploymentMode),
                    sqlServerDeploymentType: instRow?.sqlServerDeploymentType || perRow?.sqlServerDeploymentType
                };
            } else {
                const perfData = getPerfUnmanagedData(
                    existingInstanceRow?.ec2InstanceId || '',
                    existingInstanceRow?.credentialId || '',
                    existingInstanceRow?.regionId || '',
                    instRow
                );
                return {
                    ...instRow,
                    loading: false,
                    protection: instRow?.protection || perfData?.protection,
                    performance: instRow?.performance || perfData?.performance
                };
            }
        });
    }
    return instanceRows;
};

export const getPerfUnmanagedData = (
    instanceId: string,
    credentialId: string,
    regionId: string,
    instRow: any,
    partnerId?: string
) => {
    const updatedState = store.getState();
    const perfMssqlInstancesData = updatedState.inventoryV2.perfMssqlInstancesData;
    let uniqueInstanceId = uniqueHostRow(instanceId, credentialId, regionId);
    let uniquePartnerId = uniqueHostRow(partnerId || '', credentialId, regionId);
    if (perfMssqlInstancesData?.[uniqueInstanceId] && partnerId && perfMssqlInstancesData?.[uniquePartnerId]) {
        let perfData1 = perfMssqlInstancesData?.[uniqueInstanceId];
        let perfData2 = perfMssqlInstancesData?.[uniquePartnerId];
        const perRow1 = perfData1?.data?.databaseInstancesSummary?.find(
            (per: DatabaseInstancesSummaryInterface) => per?.databaseInstanceName === instRow?.databaseInstanceName
        );
        const perRow2 = perfData2?.data?.databaseInstancesSummary?.find(
            (per: DatabaseInstancesSummaryInterface) => per?.databaseInstanceName === instRow?.databaseInstanceName
        );
        if (perRow1 || perRow2) {
            return {
                loading: false,
                protection: perRow1?.protection || perRow2?.protection,
                performance: perRow1?.performance || perRow2?.performance
            };
        } else if (perfData1?.loading || perfData2?.loading) {
            return {
                loading: true,
                protection: null,
                performance: null
            };
        } else {
            return {
                loading: false,
                protection: null,
                performance: null
            };
        }
    } else if (perfMssqlInstancesData?.[uniqueInstanceId]) {
        let perfData = perfMssqlInstancesData?.[uniqueInstanceId];
        if (perfData?.loading) {
            return {
                loading: true,
                protection: null,
                performance: null
            };
        } else if (perfData?.data?.databaseInstancesSummary && perfData?.data?.databaseInstancesSummary?.length > 0) {
            const perRow = perfData?.data?.databaseInstancesSummary?.find(
                (per: DatabaseInstancesSummaryInterface) => per?.databaseInstanceName === instRow?.databaseInstanceName
            );
            return {
                loading: false,
                protection: perRow?.protection,
                performance: perRow?.performance
            };
        } else {
            return {
                loading: false,
                protection: null,
                performance: null
            };
        }
    }
};

export const getExploreSavingsRows = (inventoryTableData: { [key: string]: InventoryTableData }) => {
    // If ES row is disabled than it should come in inventory but not in explore savings table
    let nonFsxnStorageList: Array<InventoryTableData> = [];
    const state = store.getState();
    const removeSecNodeDiscoveredList = state.inventoryV2.removeSecNodeDiscoveredList;
    Object.keys(inventoryTableData).map((key: string) => {
        let item = inventoryTableData[key];
        if (removeSecNodeDiscoveredList.includes(key)) {
            return;
        }
        if (item?.action === INVENTORY_ACTIONS.EXPLORE_SAVINGS) {
            if (!checkForMixedStorageType(item)) {
                if (item?.storageType === GENERAL.FSX_FOR_WINDOWS) {
                    if (checkForAnySSD(item) && !checkForAnyAOAG(item)) {
                        nonFsxnStorageList.push(item);
                    }
                } else {
                    nonFsxnStorageList.push(item);
                }
            }
        }
    });
    return nonFsxnStorageList;
};

export const updateInstanceStatus = (
    action: InstanceActions,
    hostData: any,
    instanceData: any,
    responseData?: any,
    resourceId?: any
) => {
    let updatedState = store.getState();
    let { inventoryTableData }: any = updatedState?.inventoryV2;

    let targettedHostIdVal = inventoryTableData?.[
        uniqueHostRow(hostData?.resourceId, hostData?.credentialId, hostData?.regionId)
    ]
        ? hostData?.resourceId
        : inventoryTableData?.[uniqueHostRow(hostData?.ec2InstanceId, hostData?.credentialId, hostData?.regionId)]
        ? hostData?.ec2InstanceId
        : '';
    if (!targettedHostIdVal) {
        Object.keys(inventoryTableData).map((perObj: any) => {
            let item = inventoryTableData[perObj];
            if (
                item?.ec2InstanceId === hostData?.ec2InstanceId &&
                item?.credentialId === hostData?.credentialId &&
                item?.regionId === hostData?.regionId
            ) {
                targettedHostIdVal = item?.resourceId || item?.ec2InstanceId;
            }
        });
    }

    const targettedHostId = uniqueHostRow(targettedHostIdVal, hostData?.credentialId, hostData?.regionId);

    const updatedInventoryTableData = { ...inventoryTableData };
    if (action === 'unmanage') {
        updatedInventoryTableData[targettedHostId] = {
            ...inventoryTableData[targettedHostId],
            managedInstance: inventoryTableData[targettedHostId].managedInstance - 1,
            actionDisable: inventoryTableData[targettedHostId].actionDisable
                ? false
                : inventoryTableData[targettedHostId].actionDisable,
            sqlServerInstances: inventoryTableData[targettedHostId].sqlServerInstances.map((instanceItem: any) => {
                if (instanceItem?.databaseInstanceName === instanceData?.databaseInstanceName) {
                    return { ...instanceItem, statusColText: INVENTORY_STATUS.UNMANAGED };
                }
                return instanceItem;
            })
        };
    }
    if (action === 'manage') {
        updatedInventoryTableData[targettedHostId] = {
            ...inventoryTableData[targettedHostId],
            managedInstance: inventoryTableData[targettedHostId].managedInstance + responseData?.length || 0,
            action: INVENTORY_ACTIONS.MANAGE,
            actionDisable:
                inventoryTableData[targettedHostId].totalInstance ===
                    inventoryTableData[targettedHostId].managedInstance + responseData?.length || 0,
            resourceId,
            sqlServerInstances: inventoryTableData[targettedHostId].sqlServerInstances.map((instanceItem: any) => {
                const instanceInRes = responseData.find(
                    (item: any) => item?.databaseInstanceName === instanceItem?.databaseInstanceName
                );
                if (instanceInRes?.databaseInstanceName) {
                    return {
                        ...instanceItem,
                        databaseInstanceId: instanceInRes.databaseInstanceGuid,
                        statusColText: INVENTORY_STATUS.MANAGED
                    };
                }
                return instanceItem;
            })
        };
    }
    if (action === 'detect') {
        updatedInventoryTableData[targettedHostId] = {
            ...inventoryTableData[targettedHostId],
            action:
                inventoryTableData[targettedHostId]?.storageType === GENERAL.EBS ||
                inventoryTableData[targettedHostId]?.storageType === GENERAL.FSX_FOR_WINDOWS
                    ? INVENTORY_ACTIONS.EXPLORE_SAVINGS
                    : INVENTORY_ACTIONS.MANAGE,
            actionDisable: false,
            hasInstanceData: false,
            sqlServerInstances: inventoryTableData[targettedHostId].sqlServerInstances.map((instanceItem: any) => {
                if (instanceItem?.databaseInstanceName === instanceData?.databaseInstanceName) {
                    return { ...instanceItem, statusColText: INVENTORY_STATUS.UNMANAGED };
                }
                return instanceItem;
            })
        };
    }
    return updatedInventoryTableData;
};

export const updateInstanceBulkStatus = (action: InstanceActions, response: any) => {
    let updatedState = store.getState();
    let { inventoryTableData }: any = updatedState?.inventoryV2;
    const updatedInventoryTableData = { ...inventoryTableData };

    response?.map((hostData: any) => {
        let successFullInstances: any = [];
        let failedInstances = [];
        hostData?.instances?.map((item: any) => {
            if (item.status === NOTIFICATION_TYPES.SUCCESS) {
                successFullInstances.push(item);
            } else {
                failedInstances.push(item);
            }
        });
        let targettedHostIdVal = inventoryTableData?.[
            uniqueHostRow(hostData?.resourceId, hostData?.credentialsId, hostData?.region)
        ]
            ? hostData?.resourceId
            : inventoryTableData?.[uniqueHostRow(hostData?.ec2InstanceId, hostData?.credentialsId, hostData?.region)]
            ? hostData?.ec2InstanceId
            : '';
        if (!targettedHostIdVal) {
            Object.keys(inventoryTableData).map((perObj: any) => {
                let item = inventoryTableData[perObj];
                if (
                    item?.ec2InstanceId === hostData?.ec2InstanceId &&
                    item?.credentialId === hostData?.credentialsId &&
                    item?.regionId === hostData?.region
                ) {
                    targettedHostIdVal = item?.resourceId || item?.ec2InstanceId;
                }
            });
        }

        const targettedHostId = uniqueHostRow(targettedHostIdVal, hostData?.credentialsId, hostData?.region);

        if (action === 'manage') {
            updatedInventoryTableData[targettedHostId] = {
                ...inventoryTableData[targettedHostId],
                managedInstance:
                    inventoryTableData[targettedHostId]?.managedInstance + successFullInstances?.length || 0,
                action: INVENTORY_ACTIONS.MANAGE,
                actionDisable:
                    inventoryTableData[targettedHostId]?.totalInstance ===
                        inventoryTableData[targettedHostId]?.managedInstance + successFullInstances?.length || 0,
                sqlServerInstances: inventoryTableData[targettedHostId]?.sqlServerInstances.map((instanceItem: any) => {
                    const instanceInRes = successFullInstances.find(
                        (item: any) => item?.databaseInstanceName === instanceItem?.databaseInstanceName
                    );
                    if (instanceInRes?.databaseInstanceName) {
                        return {
                            ...instanceItem,
                            databaseInstanceId: instanceInRes.databaseInstanceGuid,
                            statusColText: INVENTORY_STATUS.MANAGED
                        };
                    }
                    return instanceItem;
                })
            };
        }
    });

    return updatedInventoryTableData;
};

export const detectFieldsValidation = (entryData: any) => {
    const state = store.getState();
    const { detectManageUserName, detectManagePassword, detectOntapUsername, detectOntapPassword } = state.inventoryV2;
    if (
        !entryData?.sqlServerAuthentication &&
        !entryData?.windowsAuthentication &&
        entryData?.fsxId &&
        !entryData?.isFsxRegistered
    ) {
        if (detectManageUserName && detectManagePassword && detectOntapUsername && detectOntapPassword) {
            return true;
        } else {
            return false;
        }
    } else if (!entryData?.sqlServerAuthentication && !entryData?.windowsAuthentication) {
        if (detectManageUserName && detectManagePassword) {
            return true;
        } else {
            return false;
        }
    } else if (entryData?.fsxId && !entryData?.isFsxRegistered) {
        if (detectOntapUsername && detectOntapPassword) {
            return true;
        } else {
            return false;
        }
    }
};

export const getDiscoveredHostDeploymentV2 = (host: any) => {
    // This will get deployment type in case of unmanaged hosts
    const sqlServerDeploymentType = host?.sqlServerDeploymentType || '';
    let type = '';

    if (sqlServerDeploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG) {
        type = GENERAL.AOAG;
    } else if (sqlServerDeploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE) {
        type = GENERAL.FAILOVER_CLUSTER_INSTANCES;
    } else if (sqlServerDeploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
        type = GENERAL.STANDALONE;
    } else if (sqlServerDeploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.HA) {
        type = GENERAL.HA;
    } else {
        type = sqlServerDeploymentType;
    }
    return type;
};

export const saveFsxInCredRegisteredObj = (fsxId: string, dispatch: any) => {
    let state = store.getState();
    const { fsxCredentialStatusObj, detectOntapUsername, detectOntapPassword } = state?.inventoryV2;
    if (detectOntapUsername && detectOntapPassword && fsxId) {
        dispatch(
            setFsxCredentialStatus({
                ...fsxCredentialStatusObj,
                [fsxId]: true
            })
        );
        return true;
    } else {
        return false;
    }
};

export const handleManageTriggerNotification = (instancesToManage: any, dispatch: any, styles: any) => {
    if (instancesToManage.length === 1) {
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: (
                    <div className={styles.notification}>
                        {GENERAL.INSTANCE_MANAGE_REQUEST[0]}
                        <span className={styles.bold}>{instancesToManage[0]}</span>
                        {GENERAL.INSTANCE_MANAGE_REQUEST[1]}
                    </div>
                )
            })
        );
    } else {
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: (
                    <div className={styles.notification}>
                        {GENERAL.MULTI_INSTANCE_MANAGE_REQUEST[0]}
                        <span className={styles.bold}>{instancesToManage.length}</span>
                        {GENERAL.MULTI_INSTANCE_MANAGE_REQUEST[1]}
                    </div>
                )
            })
        );
    }
};

export const handleManageNotification = (
    instancesToManage: any,
    successfullInstances: any,
    additionalError: any = '',
    isDetected: any,
    dispatch: any,
    styles: any
) => {
    if (instancesToManage.length === 1) {
        if (successfullInstances.length === 1) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.SUCCESS,
                    message: (
                        <div className={styles.notification}>
                            {GENERAL.MANAGE_INSTANCE_SUCCESS_MSG[0]}
                            <span className={styles.bold}>{instancesToManage[0]}</span>
                            {GENERAL.MANAGE_INSTANCE_SUCCESS_MSG[1]}
                        </div>
                    )
                })
            );
        } else {
            const msgObj = isDetected ? GENERAL.DETECT_MANAGE_INSTANCE_FAILED_MSG : GENERAL.MANAGE_INSTANCE_FAILED_MSG;
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: (
                        <div className={styles.notification}>
                            {msgObj[0]}
                            <span className={styles.bold}>{instancesToManage[0]}</span>
                            {msgObj[1]}
                            {additionalError}
                        </div>
                    )
                })
            );
        }
    } else {
        if (successfullInstances.length === 0) {
            const msgObj = isDetected
                ? GENERAL.MULTIPLE_INSTANCE_DETECT_MANAGE_FAILED
                : GENERAL.MULTIPLE_INSTANCE_MANAGE_FAILED;
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: (
                        <div className={styles.notification}>
                            {msgObj[0]}
                            <span className={styles.bold}>{instancesToManage.length}</span>
                            {msgObj[1]}
                            {additionalError}
                        </div>
                    )
                })
            );
        } else if (successfullInstances.length < instancesToManage.length) {
            const msgObj = isDetected
                ? GENERAL.MULTIPLE_INSTANCE_DETECT_MANAGE_PARTIAL_SUCCESS
                : GENERAL.MULTIPLE_INSTANCE_MANAGE_PARTIAL_SUCCESS;
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.INFO,
                    message: `${successfullInstances.length}${msgObj[0]}${instancesToManage.length}${msgObj[1]}`
                })
            );
        } else {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.SUCCESS,
                    message: (
                        <div className={styles.notification}>
                            <span className={styles.bold}>{instancesToManage.length}</span>
                            {GENERAL.MUTLI_INSTANCE_MANAGE_SUCCESS[0]}
                        </div>
                    )
                })
            );
        }
    }
};

export const getPartnerInstanceId = (instanceRow: InstancesHostsRowInterface, instanceId: string) => {
    let partnerInstanceId: string = '';
    if (instanceRow?.clusterNodeDetails) {
        if (instanceId) {
            let partnerNode = instanceRow?.clusterNodeDetails?.filter(perInst => perInst?.ec2InstanceId !== instanceId);
            if (partnerNode && partnerNode?.length > 0) {
                partnerInstanceId = partnerNode[0]?.ec2InstanceId || '';
            }
        }
    }
    return partnerInstanceId;
};

export const isAwsBackupEnabledText = (val: any, fsxType: string) => {
    let awsProtection = val?.protection?.isAwsBackupEnabled;
    let protectionText: any = '';
    if (fsxType) {
        if (awsProtection?.[fsxType] && String(awsProtection?.[fsxType])?.toLowerCase() !== GENERAL.NOT_AVAILABLE) {
            protectionText = true;
        } else if (String(awsProtection?.[fsxType])?.toLowerCase() === GENERAL.NOT_AVAILABLE) {
            protectionText = GENERAL.NOT_AVAILABLE;
        } else if (!awsProtection?.[fsxType]) {
            protectionText = false;
        } else {
            protectionText = GENERAL.NOT_AVAILABLE;
        }
    } else {
        if (
            (awsProtection?.fsxn && String(awsProtection?.fsxn)?.toLowerCase() !== GENERAL.NOT_AVAILABLE) ||
            (awsProtection?.fsxw && String(awsProtection?.fsxw)?.toLowerCase() !== GENERAL.NOT_AVAILABLE) ||
            (awsProtection?.ebs && String(awsProtection?.ebs)?.toLowerCase() !== GENERAL.NOT_AVAILABLE)
        ) {
            protectionText = true;
        } else if (
            String(awsProtection?.fsxn)?.toLowerCase() === GENERAL.NOT_AVAILABLE ||
            String(awsProtection?.fsxw)?.toLowerCase() === GENERAL.NOT_AVAILABLE ||
            String(awsProtection?.ebs)?.toLowerCase() === GENERAL.NOT_AVAILABLE
        ) {
            protectionText = GENERAL.NOT_AVAILABLE;
        } else if (awsProtection) {
            protectionText = false;
        } else {
            protectionText = GENERAL.NOT_AVAILABLE;
        }
    }

    return protectionText;
};

export const getProtectionText = (data: any) => {
    let protectionText = '';
    let fsxType = '';
    let fileSystemType = data?.fileSystemType || '';
    if (fileSystemType.includes(GENERAL.FSX_FOR_ONTAP)) {
        fsxType = 'fsxn';
    } else if (fileSystemType.includes(GENERAL.FSX_FOR_WINDOWS)) {
        fsxType = 'fsxw';
    } else if (fileSystemType.includes(GENERAL.EBS)) {
        fsxType = 'ebs';
    }

    let awsBackupEnabled = isAwsBackupEnabledText(data, fsxType);
    let fsxOntapEnabled = data?.protection?.isFsxOntapSnapshotsEnabled;
    let sqlNativeEnabled = data?.protection?.isSqlNativeEnabled;

    if (fsxType === 'ebs' || fsxType === 'fsxw') {
        if (
            (awsBackupEnabled && String(awsBackupEnabled)?.toLowerCase() !== GENERAL.NOT_AVAILABLE) ||
            (sqlNativeEnabled && String(sqlNativeEnabled)?.toLowerCase() !== GENERAL.NOT_AVAILABLE)
        ) {
            protectionText = PROTECTION_TEXT_STATUS.YES;
        } else if (
            String(awsBackupEnabled)?.toLowerCase() === GENERAL.NOT_AVAILABLE ||
            String(sqlNativeEnabled)?.toLowerCase() === GENERAL.NOT_AVAILABLE
        ) {
            protectionText = '';
        } else if (data?.protection) {
            protectionText = PROTECTION_TEXT_STATUS.NO;
        } else {
            protectionText = '';
        }
    } else {
        if (
            (awsBackupEnabled && String(awsBackupEnabled)?.toLowerCase() !== GENERAL.NOT_AVAILABLE) ||
            (fsxOntapEnabled && String(fsxOntapEnabled)?.toLowerCase() !== GENERAL.NOT_AVAILABLE) ||
            (sqlNativeEnabled && String(sqlNativeEnabled)?.toLowerCase() !== GENERAL.NOT_AVAILABLE)
        ) {
            protectionText = PROTECTION_TEXT_STATUS.YES;
        } else if (
            String(awsBackupEnabled)?.toLowerCase() === GENERAL.NOT_AVAILABLE ||
            String(fsxOntapEnabled)?.toLowerCase() === GENERAL.NOT_AVAILABLE ||
            String(sqlNativeEnabled)?.toLowerCase() === GENERAL.NOT_AVAILABLE
        ) {
            protectionText = '';
        } else if (data?.protection) {
            protectionText = PROTECTION_TEXT_STATUS.NO;
        } else {
            protectionText = '';
        }
    }

    return protectionText;
};

export const getOptimizationStatus = (
    databaseInstanceId: string,
    optimizationStatusList: Array<HostAssessmentResponseInterface>
) => {
    if (!optimizationStatusList) {
        return '';
    }
    let instanceRow = optimizationStatusList?.find(per => per?.databaseInstanceId === databaseInstanceId);
    let optimizationStatus = '';
    if (instanceRow && instanceRow?.assessments && instanceRow?.assessments?.lastAssessmentTimestamp) {
        let { cardsData, formatOntapConfigList, formatOsConfigList } = getCardsData(instanceRow?.assessments, {});
        let optBreakDown = formatOptimizationBreakDown(cardsData);
        optimizationStatus =
            optBreakDown?.total?.notOptimized !== 0
                ? optBreakDown?.total?.notOptimized === 1
                    ? optBreakDown?.total?.notOptimized + ' issues'
                    : optBreakDown?.total?.notOptimized + ' issues'
                : 'Well architected';
    } else if (instanceRow?.error && instanceRow?.error.includes(' No storage assessment data found')) {
        optimizationStatus = INVENTORY_STATUS.IN_PROGRESS;
    } else if (instanceRow?.assessments && !instanceRow?.assessments?.lastAssessmentTimestamp) {
        optimizationStatus = INVENTORY_STATUS.IN_PROGRESS;
    }
    return optimizationStatus;
};

export const getPartnerNodeEc2InstanceId = (error: string) => {
    const pattern = new RegExp(`\\b${PARTNER_NODE}\\b\\s*((?:\\w|-)+)`);
    const match = pattern.exec(error);

    if (match && match[1]) {
        return match[1];
    }

    return null;
};

export const addInstanceIdToGetPerf = (rowData: any, dispatch: any) => {
    // First check if this is already opened or closed. If this data is already available or not.
    const state = store.getState();
    const unManagedPerfInstanceIdsList = state.inventoryV2.unManagedPerfInstanceIdsList;
    if (
        !unManagedPerfInstanceIdsList.includes(
            uniqueHostRow(rowData?.ec2InstanceId, rowData?.credentialId, rowData?.regionId)
        )
    ) {
        // If this has unmanaged rows or not ?
        let unmanagedRows = rowData?.sqlServerInstances?.filter(
            (per: any) => per?.statusColText === INVENTORY_STATUS.UNMANAGED
        );
        if (unmanagedRows && unmanagedRows?.length > 0 && rowData?.ec2InstanceId) {
            let instanceList = [];
            instanceList.push(uniqueHostRow(rowData?.ec2InstanceId, rowData?.credentialId, rowData?.regionId));
            const partnerData = rowData?.ec2Details?.filter((perRow: any) => perRow?.id !== rowData?.ec2InstanceId);
            if (partnerData && partnerData?.length > 0) {
                instanceList.push(uniqueHostRow(partnerData?.[0]?.id, rowData?.credentialId, rowData?.regionId));
            }
            dispatch(setUnManagedPerfInstanceIdsList([...unManagedPerfInstanceIdsList, ...instanceList]));
        }
        // This has to be called even if any row is becoming unmanaged row or managed row
    }
};

export const addInstanceIdToGetAssessment = (rowData: any, dispatch: any) => {
    // First check if this is already opened or closed. If this data is already available or not.
    const state = store.getState();
    const managedAssessmentIdsList = state.inventoryV2.managedAssessmentHostIdsList;
    if (!managedAssessmentIdsList.includes(rowData?.resourceId)) {
        // If this has unmanaged rows or not ?
        let managedRows = rowData?.sqlServerInstances?.filter(
            (per: any) => per?.statusColText === INVENTORY_STATUS.MANAGED
        );
        if (managedRows && managedRows?.length > 0 && rowData?.resourceId) {
            dispatch(setManagedAssessmentHostIdsList([...managedAssessmentIdsList, rowData?.resourceId]));
        }
    }
};

export const checkForAnyAOAG = (rowData: any) => {
    // If any instance have AOAG than ES is disabled for it
    return rowData?.sqlServerInstances?.some((item: any) => {
        return item?.sqlServerDeploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG;
    });
};

export const checkForAnySSD = (rowData: any) => {
    for (const item of rowData?.sqlServerInstances || []) {
        for (const perStorage of item?.storage || []) {
            if (perStorage?.type === DETECT_HOST_VAR.FSXW && perStorage?.fileSystemStorageType === 'SSD') {
                return true;
            }
        }
    }
    return false;
};

export const checkForMixedStorageType = (rowData: any) => {
    let storageType: Array<String> = [];
    for (const item of rowData?.sqlServerInstances || []) {
        if (item?.fileSystemType && !storageType.includes(item?.fileSystemType)) {
            storageType.push(item?.fileSystemType);
        }
    }
    if (storageType.length > 1) {
        return true;
    }
    return false;
};

export const renderVpcText = (cellData: any, rowData: any, styles: any) => {
    return (
        <>
            <div className={styles.ec2Container}>
                <div className={styles.ssmOffline}>
                    <Popover
                        popoverClass={''}
                        children={
                            <>
                                {rowData?.vpcIdAndNameText && (
                                    <div className={styles.tooltipContainer}>
                                        <DsTypography variant="Regular_14">{rowData?.vpcIdAndNameText}</DsTypography>
                                        <Popover
                                            popoverClass={styles['copy-popover']}
                                            children={'Copied'}
                                            container={
                                                <CopyToClipboardCommon
                                                    value={rowData?.vpcIdAndNameText}
                                                    iconProvided={<CopyIcon fill={'#A7A7A7'}></CopyIcon>}
                                                />
                                            }
                                        />
                                    </div>
                                )}
                            </>
                        }
                        trigger="hover"
                        delayHide={200}
                        interactive={true}
                        isAppendedToBody={false}
                        container={<TooltipIcon />}
                    />
                </div>
                <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                    {cellData || GENERAL.NOT_AVAILABLE}
                </DsTypography>
            </div>
        </>
    );
};

export const renderInstanceListText = (cellData: any, rowData: any, styles: any) => {
    let instanceList: any = cellData ? cellData.split(',') : null;
    return (
        <>
            <div className={styles.ec2Container}>
                <div className={styles.ssmOffline}>
                    <Popover
                        popoverClass={''}
                        children={
                            <>
                                {instanceList && instanceList[0] && (
                                    <div className={styles.tooltipContainer}>
                                        <DsTypography variant="Regular_14">{instanceList[0]}</DsTypography>
                                        <Popover
                                            popoverClass={styles['copy-popover']}
                                            children={'Copied'}
                                            container={
                                                <CopyToClipboardCommon
                                                    value={instanceList[0]}
                                                    iconProvided={<CopyIcon fill={'#A7A7A7'}></CopyIcon>}
                                                />
                                            }
                                        />
                                    </div>
                                )}
                                {instanceList && instanceList[1] && (
                                    <>
                                        <div className={styles.ec2Separator} />
                                        <div className={styles.tooltipContainer}>
                                            <DsTypography variant="Regular_14">{instanceList[1]}</DsTypography>
                                            <Popover
                                                popoverClass={styles['copy-popover']}
                                                children={'Copied'}
                                                container={
                                                    <CopyToClipboardCommon
                                                        value={instanceList[1]}
                                                        iconProvided={<CopyIcon fill={'#A7A7A7'}></CopyIcon>}
                                                    />
                                                }
                                            />
                                        </div>
                                    </>
                                )}
                            </>
                        }
                        trigger="hover"
                        delayHide={200}
                        interactive={true}
                        isAppendedToBody={false}
                        container={<TooltipIcon />}
                    />
                </div>
                <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                    {rowData?.instanceNameListText || GENERAL.NOT_AVAILABLE}
                </DsTypography>
            </div>

            {!instanceList && rowData?.loading && <DsFlashingDotsLoader />}
            {!instanceList && !rowData?.loading && GENERAL.NOT_AVAILABLE}
        </>
    );
};

export const installModuleNotification = (styles: any, dispatch: any, initialMsg: any, hostname?: string) => {
    const prepareHostMsg = (
        <div className={styles.notification}>
            {initialMsg[0]}
            {hostname && <span className={styles.bold}>{hostname}</span>}
            {initialMsg[1]}
            {
                <>
                    <Button
                        Component="button"
                        variant="text"
                        onClick={() => {
                            dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                            dispatch(clearNotifications());
                        }}
                    >
                        {initialMsg[2]}
                    </Button>
                </>
            }
            {initialMsg[3]}
        </div>
    );
    dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.INFO, message: prepareHostMsg }));
};

export const renderUnmanagedAZ = (cellData: string, rowData: any, styles: any) => {
    let azList = '';
    let deploymentType = '';

    for (let instance of rowData?.sqlServerInstances || []) {
        for (let deployment of instance?.deploymentTypes || []) {
            if (deployment?.zones) {
                azList = deployment.zones.join(',');
            }
            if (deployment?.type) {
                deploymentType = deployment.type;
            }
            if (azList || deploymentType) {
                break;
            }
        }
        if (azList || deploymentType) {
            break;
        }
    }

    return (
        <>
            {deploymentType && (
                <div className={styles.azColText}>
                    <TooltipInfo onVisibleChange={function noRefCheck() {}}>{azList}</TooltipInfo>
                    <DsTypography variant="Regular_14">{getAzType(deploymentType)}</DsTypography>
                </div>
            )}
            {!deploymentType && GENERAL.NOT_AVAILABLE}
        </>
    );
};

export const renderCellData = (cellData: any, rowData: any, styles: any) => {
    return (
        <>
            {cellData && (
                <DsTypography variant="Regular_13" className={styles.colText}>
                    {cellData}
                </DsTypography>
            )}
            {!cellData && rowData?.loading && <DsFlashingDotsLoader />}
            {!cellData && cellData !== 0 && !rowData?.loading && GENERAL.NOT_AVAILABLE}
        </>
    );
};

export const renderEstimatedCost = (cellData: any, rowData: any, styles: any) => {
    const costData = rowData?.estimatedUsageCost;
    const totalCost = +rowData?.totalCost;
    return (
        <>
            {costData && !rowData?.loading && (
                <div className={styles.cost}>
                    <TooltipInfo className={styles.tooltipClass} onVisibleChange={function noRefCheck() {}}>
                        {EstimatedCostPopover({ ...costData, totalCost: totalCost })}
                    </TooltipInfo>
                    <DsTypography variant="Regular_14">{`$${formatFractionalNumber(totalCost, 2)}`}</DsTypography>
                </div>
            )}
            {rowData?.loading && <DsFlashingDotsLoader />}
            {!costData && !rowData?.loading && GENERAL.NOT_AVAILABLE}
        </>
    );
};

export const renderAllocatedCapacity = (cellData: any, rowData: any) => {
    return (
        <>
            {!rowData?.loading && (cellData || cellData === 0 ? cellData : GENERAL.NOT_AVAILABLE)}
            {rowData?.loading && <DsFlashingDotsLoader />}
        </>
    );
};

export const handleManageInstances = (
    rowData: any,
    instances: any,
    dispatch: any,
    styles: any,
    manageBulkInstanceApi: any,
    prepareHostApi: any,
    isDetected?: boolean | undefined
) => {
    const updatedState = store.getState();
    const { inProgressInstances } = updatedState.inventoryV2;
    const { isDemoMode } = updatedState.auth;
    const inProgressIds = instances.map((instance: any) =>
        uniqueHostRow(`${rowData?.ec2InstanceId}_${instance}`, rowData?.credentialId, rowData?.regionId)
    );
    dispatch(setInProgressInstances(new Set([...Array.from(inProgressInstances), ...inProgressIds])));
    handleManageTriggerNotification(instances, dispatch, styles);
    let payloadItem: any = {
        ec2InstanceId: rowData?.ec2InstanceId,
        databaseInstanceNames: instances,
        credentialsId: rowData?.credentialId,
        region: rowData?.regionId
    };
    if (rowData?.resourceId && isDemoMode) {
        payloadItem.databaseHostId = rowData.resourceId;
    }

    let payload = {
        items: [payloadItem]
    };

    manageBulkInstanceApi({
        payload
    }).then((res: any) => {
        const updatedState = store.getState();
        const { inProgressInstances } = updatedState?.inventoryV2;
        let updatedInProgressInstances = new Set([...inProgressInstances]);
        inProgressIds.map((inProgressId: any) => {
            updatedInProgressInstances.delete(inProgressId);
        });
        dispatch(setInProgressInstances(updatedInProgressInstances));

        if (res?.data) {
            let successFullInstances: any = [];
            let failedInstances: any = [];
            res?.data?.hosts?.map((resource: any) => {
                resource?.instances.map((item: any) => {
                    if (item.status === NOTIFICATION_TYPES.SUCCESS) {
                        successFullInstances.push(item);
                    } else {
                        failedInstances.push(item);
                    }
                });
            });

            if (successFullInstances.length > 0) {
                handleManageNotification(instances, successFullInstances, '', isDetected, dispatch, styles);
                const updatedInventoryTableData = updateInstanceStatus(
                    'manage',
                    rowData,
                    instances,
                    successFullInstances,
                    res?.data?.hosts?.[0]?.resourceId
                );
                dispatch(setInventoryTableData(updatedInventoryTableData));
            } else {
                // handle prepare API
                let errorList = res?.data?.hosts?.[0]?.hostErrorMessage?.split('\n');
                let prepareApiRequired = false;
                let sourceNodePrepareRequired = false;
                let partnerNodeEc2Id;
                errorList?.map((errorItem: any) => {
                    if (errorItem.includes(PREPARE_API_ENDPOINT)) {
                        prepareApiRequired = true;
                        if (errorItem.includes(PARTNER_NODE)) {
                            partnerNodeEc2Id = getPartnerNodeEc2InstanceId(errorItem);
                        } else {
                            sourceNodePrepareRequired = true;
                        }
                    }
                });
                if (prepareApiRequired) {
                    if (sourceNodePrepareRequired) {
                        prepareHostApi({
                            credentialId: rowData?.credentialId,
                            regionId: rowData?.regionId,
                            instanceId: rowData?.ec2InstanceId
                        }).then((prepareRes: any) => {
                            if (prepareRes && !prepareRes?.error) {
                                const msgObj =
                                    instances.length === 1
                                        ? isDetected
                                            ? GENERAL.PREPARE_DETECTED_INSTANCE_INFO
                                            : GENERAL.PREPARE_INSTANCE_INFO
                                        : isDetected
                                        ? GENERAL.PREPARE_DETECTED_INSTANCES_INFO
                                        : GENERAL.PREPARE_INSTANCES_INFO;
                                installModuleNotification(
                                    styles,
                                    dispatch,
                                    msgObj,
                                    instances.length === 1 ? instances[0] : ''
                                );
                            } else {
                                handleManageNotification(instances, [], '', isDetected, dispatch, styles);
                            }
                        });
                    }
                    if (partnerNodeEc2Id) {
                        prepareHostApi({
                            credentialId: rowData?.credentialId,
                            regionId: rowData?.regionId,
                            instanceId: partnerNodeEc2Id
                        }).then((prepareRes: any) => {
                            if (prepareRes && !prepareRes?.error) {
                                const msgObj =
                                    instances.length === 1
                                        ? isDetected
                                            ? GENERAL.PREPARE_DETECTED_INSTANCE_INFO
                                            : GENERAL.PREPARE_INSTANCE_INFO
                                        : isDetected
                                        ? GENERAL.PREPARE_DETECTED_INSTANCES_INFO
                                        : GENERAL.PREPARE_INSTANCES_INFO;
                                installModuleNotification(
                                    styles,
                                    dispatch,
                                    msgObj,
                                    instances.length === 1 ? instances[0] : ''
                                );
                            } else {
                                handleManageNotification(instances, [], '', isDetected, dispatch, styles);
                            }
                        });
                    }
                } else {
                    let otherErrorList: any = null;
                    res?.data?.hosts?.[0]?.instances?.map((item: any) => {
                        otherErrorList = item?.errorMessage?.split('\n') || otherErrorList;
                    });
                    handleManageNotification(instances, [], otherErrorList[0], isDetected, dispatch, styles);
                }
            }
        } else if (res?.error) {
            handleManageNotification(instances, [], '', isDetected, dispatch, styles);
        }
    });
};

export const handleManageInstancesBulk = (
    selectedRowsForManage: any,
    dispatch: any,
    styles: any,
    manageBulkInstanceApi: any,
    prepareHostApi: any,
    isDetected?: boolean | undefined
) => {
    const updatedState = store.getState();
    const { inProgressInstances } = updatedState.inventoryV2;
    const { isDemoMode } = updatedState.auth;
    const inProgressIds = selectedRowsForManage.map((instance: any) =>
        uniqueHostRow(
            `${instance?.ec2InstanceId}_${instance?.databaseInstanceName}`,
            instance?.credentialId,
            instance?.regionId
        )
    );
    dispatch(setInProgressInstances(new Set([...Array.from(inProgressInstances), ...inProgressIds])));
    let instancesList = selectedRowsForManage.map((instance: any) => instance?.databaseInstanceName);
    handleManageTriggerNotification(instancesList, dispatch, styles);

    let payloadList: any = [];
    let hostInstanceMapping: any = {};
    let resourceInstanceMapping: any = {};
    selectedRowsForManage?.map((rowData: any) => {
        let uniqueRow = uniqueHostRow(rowData?.ec2InstanceId, rowData?.credentialId, rowData?.regionId);
        if (hostInstanceMapping?.[uniqueRow]) {
            hostInstanceMapping[uniqueRow].push(rowData?.databaseInstanceName);
        } else {
            hostInstanceMapping[uniqueRow] = [rowData?.databaseInstanceName];
        }
        resourceInstanceMapping[uniqueRow] = rowData?.resourceId;
    });

    Object.keys(hostInstanceMapping).map((key: any) => {
        let itemArray: any = key.split('_');
        let perItem: any = {
            ec2InstanceId: itemArray[0],
            credentialsId: itemArray[1],
            region: itemArray[2],
            databaseInstanceNames: hostInstanceMapping[key]
        };
        if (resourceInstanceMapping?.[key] && isDemoMode) {
            perItem.databaseHostId = resourceInstanceMapping[key];
        }
        payloadList.push(perItem);
    });

    let payload = {
        items: payloadList
    };

    manageBulkInstanceApi({
        payload
    }).then((res: any) => {
        const updatedState = store.getState();
        const { inProgressInstances } = updatedState?.inventoryV2;
        let updatedInProgressInstances = new Set([...inProgressInstances]);
        inProgressIds.map((inProgressId: any) => {
            updatedInProgressInstances.delete(inProgressId);
        });
        dispatch(setInProgressInstances(updatedInProgressInstances));
        if (res?.data) {
            let successFullInstances: any = [];
            let failedInstances: any = [];
            res?.data?.hosts?.map((resource: any) => {
                resource?.instances.map((item: any) => {
                    if (item.status === NOTIFICATION_TYPES.SUCCESS) {
                        successFullInstances.push(item);
                    } else {
                        failedInstances.push(item);
                    }
                });
            });
            if (successFullInstances?.length) {
                handleManageNotification(instancesList, successFullInstances, '', isDetected, dispatch, styles);
            }

            const updatedInventoryTableData = updateInstanceBulkStatus('manage', res?.data?.hosts);
            dispatch(setInventoryTableData(updatedInventoryTableData));

            let triggeredPrepare = handleBulkPrepareCall(res?.data?.hosts, dispatch, styles, prepareHostApi);
            if (triggeredPrepare) {
                const msgObj = GENERAL.PREPARE_BULK_INSTANCES_INFO;
                installModuleNotification(styles, dispatch, msgObj);
            } else if (!successFullInstances?.length && failedInstances?.length) {
                handleManageNotification(instancesList, successFullInstances, '', isDetected, dispatch, styles);
            }

            dispatch(setSelectedRowsForManage([]));
        } else {
            dispatch(setSelectedRowsForManage([]));
        }
    });
};

export const handleBulkPrepareCall = (response: any, dispatch: any, styles: any, prepareHostApi: any) => {
    let triggeredPrepare = false;
    response?.map((resource: any) => {
        let errorList = resource?.hostErrorMessage?.split('\n');
        let prepareApiRequired = false;
        let sourceNodePrepareRequired = false;
        let partnerNodeEc2Id;
        errorList?.map((errorItem: any) => {
            if (errorItem.includes(PREPARE_API_ENDPOINT)) {
                prepareApiRequired = true;
                if (errorItem.includes(PARTNER_NODE)) {
                    partnerNodeEc2Id = getPartnerNodeEc2InstanceId(errorItem);
                } else {
                    sourceNodePrepareRequired = true;
                }
            }
        });

        if (prepareApiRequired) {
            if (sourceNodePrepareRequired) {
                triggeredPrepare = true;
                prepareHostApi({
                    credentialId: resource?.credentialsId,
                    regionId: resource?.region,
                    instanceId: resource?.ec2InstanceId
                }).then((prepareRes: any) => {
                    if (prepareRes && !prepareRes?.error) {
                        triggeredPrepare = true;
                    }
                });
            }
            if (partnerNodeEc2Id) {
                triggeredPrepare = true;
                prepareHostApi({
                    credentialId: resource?.credentialsId,
                    regionId: resource?.region,
                    instanceId: partnerNodeEc2Id
                }).then((prepareRes: any) => {
                    if (prepareRes && !prepareRes?.error) {
                        triggeredPrepare = true;
                    }
                });
            }
        }
    });

    return triggeredPrepare;
};
