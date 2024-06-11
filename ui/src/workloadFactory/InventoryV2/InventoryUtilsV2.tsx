import store from '../../store/store';
import { GENERAL } from '../../utils/appConstants';
import { DETECT_HOST_VAR, FSX_DEPLOYMENT_MODE } from '../../utils/consts';
import {
    DatabaseInstancesSummaryInterface,
    DiscoverHostInterface,
    DiscoveredStorageObj,
    EstimatedUsageCostInterface,
    InventoryTableData,
    ManagedHostsRowInterface,
    SQLServerInstancesDiscovered,
    StatusObjInterface
} from '../../utils/types/inventoryV2Types';
import { formatFractionalNumber, formatSizeOnePrecision } from '../../utils/utilityFunctions';

export const formatInventoryTableData = (managedData: { [key: string]: ManagedHostsRowInterface } | null) => {
    let result = {};
    if (!managedData) {
        return result;
    }
    Object.keys(managedData).map((key: string) => {
        result = { ...result, ...{ [key]: formatManagedRows(managedData[key]) } };
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
    Object.keys(data).map((key: string) => {
        if (data[key]?.action === 'Manage' || (data[key]?.action === 'Explore savings' && !data[key]?.actionDisable)) {
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

export const formatManagedRows = (managedRow: ManagedHostsRowInterface) => {
    let managedInstanceCount = managedInstancesCount(managedRow);
    let totalInstanceCount = managedRow?.databaseInstanceDetails?.length;
    let ssmState = getSsmState(managedRow);
    const result = {
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
        vpcId: managedRow?.nodeTopology?.vpcId,
        vpcName: managedRow?.nodeTopology?.vpcName,
        vpcCidr: managedRow?.nodeTopology?.vpcCidr,
        action: ssmState === 'Online' ? 'Manage' : '', // This is default for managed rows,
        actionDisable: totalInstanceCount === managedInstanceCount,
        ec2Details: managedRow?.nodeTopology?.ec2Details,
        estimatedUsageCost: managedRow?.estimatedUsageCost,
        totalCost: getTotalCost(managedRow?.estimatedUsageCost || {}),
        allocatedCapacity: getAllocatedCapacity(managedRow),
        sqlServerInstances: formatInstanceData(managedRow)
    };
    return result;
};

export const getNodeStatus = (row: ManagedHostsRowInterface) => {
    if (row?.nodeStatus && row?.nodeStatus !== 'N/A') {
        if (row?.nodeStatus === 'running') {
            return 'Online';
        } else {
            return 'Offline';
        }
    } else {
        return 'Unknown';
    }
};

export const getSsmState = (row: ManagedHostsRowInterface) => {
    if (row?.ssmStatus && row?.ssmStatus !== 'N/A') {
        if (row?.ssmStatus?.toLowerCase() === 'connected') {
            return 'Online';
        } else {
            return 'Offline';
        }
    } else {
        return 'Offline';
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

export const getInstallationMode = (row: ManagedHostsRowInterface) => {
    let installationMode = '';
    if (row?.databaseInstancesSummary && row?.databaseInstancesSummary?.length > 0) {
        for (let i = 0; i < row?.databaseInstancesSummary?.length; i++) {
            const val = row?.databaseInstancesSummary[i];
            if (val?.databseInstanceTopology?.serverInstallationMode) {
                installationMode = val?.databseInstanceTopology?.serverInstallationMode;
                break;
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

export const getAllocatedCapacity = (row: ManagedHostsRowInterface) => {
    let allocatedCapacity = 0;
    if (row?.databaseInstancesSummary && row?.databaseInstancesSummary?.length > 0) {
        row?.databaseInstancesSummary?.map(perRow => {
            allocatedCapacity +=
                (perRow?.storage?.fsxn?.size || 0) +
                (perRow?.storage?.fsxw?.size || 0) +
                (perRow?.storage?.ebs?.size || 0);
        });
        return allocatedCapacity;
    } else {
        return 0;
    }
};

export const getFileSystemDeploymentMode = (val: string | undefined) => {
    return val === FSX_DEPLOYMENT_MODE.SINGLE_AZ_1
        ? GENERAL.SINGLE_AZ
        : val === FSX_DEPLOYMENT_MODE.MULTI_AZ_1
        ? GENERAL.MULTI_AZ
        : val;
};

export const getStorageSavingsText = (val: DatabaseInstancesSummaryInterface) => {
    let storagePercent = 0;
    let storageSavingsText: string = '';
    let fsxType: string = '';
    let fileSystemType = val?.databseInstanceTopology?.fileSystemType || '';
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
        storageSavingsText =
            (val?.storage?.[fsxType]?.spaceSavings &&
                val?.storage?.[fsxType]?.used &&
                formatFractionalNumber(storagePercent, 2) +
                    '% (' +
                    formatSizeOnePrecision(Number(fsxTypeValue?.spaceSavings)) +
                    ')') ||
            '';
    }
    return storageSavingsText;
};

export const formatInstanceData = (row: ManagedHostsRowInterface) => {
    let instanceRows = row?.databaseInstancesSummary?.map(perRow => {
        const isManagedRow = row?.databaseInstanceDetails?.filter(
            per => per?.instanceName === perRow?.databaseInstanceName
        );
        return {
            ...perRow,
            databaseInstanceName: perRow?.databaseInstanceName,
            statusColText: isManagedRow?.[0]?.isManaged ? 'Managed' : 'Unmanaged',
            fileSystemDeploymentMode: getFileSystemDeploymentMode(
                perRow?.databseInstanceTopology?.fileSystemDeploymentMode
            ),
            fileSystemType: perRow?.databseInstanceTopology?.fileSystemType,
            storageSavingsText: getStorageSavingsText(perRow),
            allocatedCapacity:
                (perRow?.storage?.fsxn?.size || 0) +
                (perRow?.storage?.fsxw?.size || 0) +
                (perRow?.storage?.ebs?.size || 0)
        };
    });
    return instanceRows;
};

export const getFsxIdsFromdiscover = (data: Array<DiscoverHostInterface>) => {
    let fsxIds: Array<string> = [];
    data?.map((instances: DiscoverHostInterface) => {
        instances?.sqlServerInstances?.map((inst: SQLServerInstancesDiscovered) => {
            inst?.storage?.map((storageObj: DiscoveredStorageObj) => {
                if (storageObj.type === DETECT_HOST_VAR.FSXN) {
                    fsxIds.push(storageObj.id || '');
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
    clusterDiscoveredHost: any
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
                        perHost.nodesList.includes(val)
                    );
                });
                if (isSameCluster && isSameCluster.length > 0) {
                    return perHost;
                } else {
                    return;
                }
            })?.[0];

            if (partnerNode) {
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
                        removeRows.push(partnerNode?.ec2InstanceId);
                    }
                    if (host?.ec2InstanceId) {
                        removeRows.push(host?.ec2InstanceId);
                    }
                    return;
                } else {
                    let combinedData = combineClusterData(host, partnerNode, removeRows);
                    if (combinedData) {
                        clusterDiscoveredHost[combinedData?.key] = combinedData?.data;
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
                        removeRows.push(host?.ec2InstanceId);
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
            removeRows.push(partner?.ec2InstanceId);
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
            removeRows.push(node?.ec2InstanceId);
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
    discoveredData?.map((perRow: DiscoverHostInterface) => {
        if (removeRows.includes(perRow.ec2InstanceId)) {
            return;
        }
        if (clusterDiscoveredHost?.[perRow.ec2InstanceId]) {
            result = {
                ...result,
                ...{ [perRow.ec2InstanceId]: formatDiscoveredRows(clusterDiscoveredHost[perRow.ec2InstanceId]) }
            };
        } else {
            result = { ...result, ...{ [perRow.ec2InstanceId]: formatDiscoveredRows(perRow) } };
        }
    });
    return result;
};

export const formatDiscoveredRows = (discoveredRow: DiscoverHostInterface) => {
    let totalInstanceCount = discoveredRow?.sqlServerInstances?.length || 0;
    let ssmState = getDiscoverSsmState(discoveredRow);
    let perInstanceStatus = getDiscoveredPerInstanceStatus(discoveredRow, ssmState);
    let actionObj = getDiscoveredActions(perInstanceStatus);
    const result = {
        id: discoveredRow?.ec2InstanceId,
        ec2InstanceId: discoveredRow?.ec2InstanceId,
        ec2InstanceName: discoveredRow?.ec2InstanceName,
        resourceId: discoveredRow?.key,
        name: getDiscoverHostname(discoveredRow),
        status: 'Online', // discover APIs will be Online only
        ssmState: ssmState,
        totalInstance: totalInstanceCount,
        managedInstance: 0,
        serverInstallationMode: getDiscoverInstallationMode(discoveredRow),
        vpcId: discoveredRow?.vpc?.id,
        vpcName: discoveredRow?.vpc?.name,
        vpcCidr: discoveredRow?.vpc?.cidrBlock,
        action: actionObj?.action,
        actionDisable: actionObj?.actionDisable,

        // Below values will get from Instances API
        // ec2Details: discoveredRow?.ec2Details, // ToDo - will add in discovery only
        // estimatedUsageCost: {}, // Initially it will be blank
        // totalCost: '',
        // allocatedCapacity: '',
        sqlServerInstances: formatDiscoverInstanceData(discoveredRow, perInstanceStatus)
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
    if (row?.ssmState && row?.ssmState !== 'N/A') {
        if (row?.ssmState?.toLowerCase() === 'connected') {
            return 'Online';
        } else {
            return 'Offline';
        }
    } else {
        return 'Offline';
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
        if (installationMode === 'FCI') {
            installationMode = GENERAL.FAILOVER_CLUSTER_INSTANCES;
        } else if (installationMode === 'AOAG') {
            installationMode = GENERAL.AOAG;
        }
        return installationMode;
    } else {
        return '';
    }
};

export const getDiscoveredPerInstanceStatus = (row: DiscoverHostInterface, ssmState: string) => {
    let result: any[] = [];
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
                    ssmState !== 'Online' ||
                    (!isWindowAuthentication && !isSqlAuthentication) ||
                    fsxCredentialValidationFailed ||
                    !storageTypeCheck
                ) {
                    statusObj = { name: perRow.sqlServerInstance, status: 'Undetected', storageType: perRow?.storage };
                } else {
                    statusObj = { name: perRow.sqlServerInstance, status: 'Unmanaged', storageType: perRow?.storage };
                }
                result = [...result, ...[statusObj]];
            }
        });
    }
    return result;
};

export const getDiscoveredActions = (row: Array<StatusObjInterface>) => {
    let action = '';
    let actionDisable = false;
    let undetected = row?.filter((per: StatusObjInterface) => per?.status === 'Undetected');
    let unmanaged = row?.filter((per: StatusObjInterface) => per?.status === 'Unmanaged');
    let isStorage = row?.find((per: StatusObjInterface) => {
        if (per?.storageType && per?.storageType?.length > 0) {
            return per;
        }
    });
    let isFsxn = false;
    row?.map((per: StatusObjInterface) => {
        if (per?.storageType && per?.storageType?.length > 0) {
            per?.storageType?.map((item: any) => {
                if (item.type === DETECT_HOST_VAR.FSXN) {
                    isFsxn = true;
                }
            });
        }
    });
    if (!isFsxn && isStorage) {
        action = 'Explore savings';
        actionDisable = undetected?.length > 0 && unmanaged?.length === 0 ? true : false;
    } else {
        actionDisable = false;
        if ((undetected?.length > 0 && unmanaged?.length > 0) || (undetected?.length === 0 && unmanaged?.length > 0)) {
            action = 'Manage';
        } else {
            action = '';
        }
    }
    return {
        action: action,
        actionDisable: actionDisable
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
            databaseInstanceName: perRow?.sqlServerInstance,
            statusColText: statusObj ? statusObj?.[0]?.status : 'Undetected',
            fileSystemDeploymentMode: getFileSystemDeploymentMode(perRow?.deploymentTypes?.[0]?.type || ''),
            fileSystemType: getDiscoverFileSystemType(perRow)
            // storageSavingsText: getStorageSavingsText(perRow),
            // allocatedCapacity:
            //     (perRow?.storage?.fsxn?.size || 0) +
            //     (perRow?.storage?.fsxw?.size || 0) +
            //     (perRow?.storage?.ebs?.size || 0)
        };
    });
    return instanceRows;
};
