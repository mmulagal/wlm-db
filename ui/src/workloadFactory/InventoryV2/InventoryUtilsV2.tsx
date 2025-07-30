import { Button, DsFlashingDotsLoader, DsTypography, Popover, TooltipInfo } from '@netapp/design-system';
import { TFunction } from 'i18next';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../store/notificationSlice';
import store from '../../store/store';
import {
    setFsxCredentialStatus,
    setManagedAssessmentHostIdsList,
    setSelectedHeaderTab,
    setUnManagedPerfInstanceIdsList
} from '../../store/workloadFactory/inventoryV2Slice';
import { GENERAL } from '../../utils/appConstants';
import {
    ACTION_CTA,
    AUTHENTICATION_TYPE,
    DBType,
    DETECT_HOST_VAR,
    INVENTORY_ACTIONS,
    INVENTORY_STATUS,
    JOB_MONITORING_STATUS,
    PARTNER_NODE,
    PREPARE_API_ENDPOINT,
    PROTECTION_TEXT_STATUS,
    SC_JOB_INTERVAL,
    SQL_DEPLOYMENT_MODE,
    STATUS_CONST,
    WLF_TABS
} from '../../utils/consts';
import {
    DatabaseInstanceDetailsInterface,
    DatabaseInstancesSummaryInterface,
    DiscoverHostInterface,
    DiscoverOracleHostInterface,
    DiscoverPgsqlHostInterface,
    DiscoveredStorageObj,
    EC2DetailsInterface,
    EstimatedUsageCostInterface,
    InstanceActions,
    InstancesHostsRowInterface,
    InstancesObjectInterface,
    InventoryTableData,
    InventoryTableInstanceDatInterface,
    ManagedHostsRowInterface,
    OracleInstancesDiscovered,
    PgsqlInstancesDiscovered,
    SQLServerInstancesDiscovered,
    StatusObjInterface
} from '../../utils/types/inventoryV2Types';
import {
    formatFractionalNumber,
    formatSizeOnePrecision,
    formatSizeTwoPrecision,
    getAzType,
    getPgsqlAzType
} from '../../utils/utilityFunctions';
import { ReactComponent as TooltipIcon } from '../../assets/tooltipGrey.svg';
import { ReactComponent as CopyIcon } from '../../assets/ic_copy.svg';

import EstimatedCostPopover from './EstimatedCostPopover/EstimatedCostPopover';
import { formatOptimizationBreakDown, getCardsData } from '../GetWell/GetWellUtils';
import { HostAssessmentResponseInterface } from '../../utils/types/getWellTypes';
import CopyToClipboardCommon from '../../common/CopyToClipboard/copyToClipboard';
import {
    completeProtectionStep1,
    completeProtectionStep2,
    resetProtectionProcess,
    startProtectionStep1
} from '../../store/workloadFactory/snapcenterSlice';
import { setActionsDisabled, setDialogErrorWithTooltip } from '../../store/workloadFactory/dialogComponentSlice';

export const uniqueHostRow = (id: string, cred: string, region: string) => `${id}_${cred}_${region}`;

export const formatInventoryTableData = (managedData: { [key: string]: ManagedHostsRowInterface } | null) => {
    let result = {};
    if (!managedData) {
        return result;
    }
    const state = store.getState();
    const { credentialMapping, regionMapping } = state?.headers;
    Object.keys(managedData).map((key: string) => {
        const awsKeys = key.split('_');
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
    const { removeSecNodeDiscoveredList } = state.inventoryV2;
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
    const managedInstanceCount = managedInstancesCount(managedRow);
    const totalInstanceCount = managedRow?.databaseInstanceDetails?.length || 0;
    const ssmState = getSsmState(managedRow);
    const allocatedCapacity = getAllocatedCapacity(managedRow);

    const result = {
        hostType: managedRow?.hostType,
        id: managedRow?.id,
        ec2InstanceId: managedRow?.nodeTopology?.ec2Details?.[0]?.id,
        ec2InstanceName: managedRow?.nodeTopology?.ec2Details?.[0]?.name,
        resourceId: managedRow?.id,
        name: managedRow?.name,
        status: getNodeStatus(managedRow),
        ssmState,
        totalInstance: totalInstanceCount,
        managedInstance: managedInstanceCount,
        serverInstallationMode: getInstallationMode(managedRow),
        serverAllInstallationMode: getAllInstallationMode(managedRow),
        vpcId: managedRow?.nodeTopology?.vpcId,
        vpcName: managedRow?.nodeTopology?.vpcName,
        vpcCidr: managedRow?.nodeTopology?.vpcCidr,
        fqdn: managedRow?.nodeTopology?.fqdn,
        nodeIpAddress: managedRow?.nodeTopology?.nodeIpAddress,
        action: ssmState === INVENTORY_STATUS.ONLINE && totalInstanceCount > 0 ? INVENTORY_ACTIONS.MANAGE : '', // This is default for managed rows,
        actionDisable: totalInstanceCount === managedInstanceCount,
        isManagedHost: true,
        loading: managedRow?.loading,
        fullManagedInstanceLoading: managedRow?.loading, // This loading is specific to database-hosts api if loaded fully for a host or not
        ec2Details: managedRow?.nodeTopology?.ec2Details,
        estimatedUsageCost: managedRow?.estimatedUsageCost,
        totalCost: getTotalCost(managedRow?.estimatedUsageCost || {}),
        allocatedCapacity,
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
    const state = store.getState();
    const discoveredHostData = state?.inventoryV2?.discoveredHosts?.discoveredHostData;
    const ec2Id = managedHostRow?.nodeTopology?.ec2Details?.[0]?.id || managedHostRow?.ec2InstanceId;
    if (ec2Id && discoveredHostData) {
        const selectedEc2 = discoveredHostData?.filter((perHost: any) => perHost?.ec2InstanceId === ec2Id);
        if (selectedEc2 && selectedEc2?.length > 0) {
            const ssmState = getDiscoverSsmState(selectedEc2[0]);
            return getDiscoveredPerInstanceStatus(selectedEc2[0], ssmState);
        }
    }
    return [];
};

export const getNodeStatus = (row: ManagedHostsRowInterface) => {
    if (row?.databaseHostStatus && row?.databaseHostStatus !== INVENTORY_STATUS.NOT_AVAILABLE) {
        if (row?.databaseHostStatus?.toLowerCase() === INVENTORY_STATUS.HOST_ONLINE) {
            return INVENTORY_STATUS.ONLINE;
        }
        return INVENTORY_STATUS.OFFLINE;
    }
    return INVENTORY_STATUS.UNKNOWN;
};

export const getSsmState = (row: ManagedHostsRowInterface) => {
    if (row?.ssmStatus && row?.ssmStatus !== INVENTORY_STATUS.NOT_AVAILABLE) {
        if (
            row?.ssmStatus?.toLowerCase() === INVENTORY_STATUS.SSM_CONNECTED ||
            row?.ssmStatus?.toLowerCase() === INVENTORY_STATUS.SSM_ONLINE
        ) {
            return INVENTORY_STATUS.ONLINE;
        }
        return INVENTORY_STATUS.OFFLINE;
    }
    return INVENTORY_STATUS.UNKNOWN;
};

export const managedInstancesCount = (row: ManagedHostsRowInterface) => {
    if (row?.databaseInstanceDetails && row?.databaseInstanceDetails?.length > 0) {
        const managedRows = row?.databaseInstanceDetails?.filter(per => per?.isManaged);
        return managedRows?.length;
    }
    return '';
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
        } else if (installationMode?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
            installationMode = GENERAL.STANDALONE;
        }
        return installationMode;
    }
    return '';
};

export const getAllInstallationMode = (row: ManagedHostsRowInterface | undefined) => {
    const installationMode: Array<string> = [];
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
    }
    return '';
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
    }
    return 0;
};

export const getAllocatedCapacity = (row: ManagedHostsRowInterface | undefined) => {
    let fsxnCapacity = 0;
    let fsxwCapacity = 0;
    let ebsCapacity = 0;
    const uniqueFsxnId: Array<string> = [];
    const uniqueFsxwId: Array<string> = [];
    const uniqueVolId: Array<string> = [];
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

    const allocatedCapacity = fsxnCapacity + fsxwCapacity + ebsCapacity;
    return allocatedCapacity;
};

export const getStorageSavingsText = (val: DatabaseInstancesSummaryInterface) => {
    let storagePercent = 0;
    let storageSavingsText: string = '';
    let fsxType: string = '';
    const fileSystemType = val?.databaseInstanceTopology?.fileSystemType || '';
    if (fileSystemType.includes(GENERAL.FSX_FOR_ONTAP)) {
        fsxType = 'fsxn';
    } else if (fileSystemType.includes(GENERAL.FSX_FOR_WINDOWS)) {
        fsxType = 'fsxw';
    } else if (fileSystemType.includes(GENERAL.EBS)) {
        fsxType = 'ebs';
    }

    if (fsxType) {
        const fsxTypeValue = val?.storage?.[fsxType] || {};
        storagePercent = fsxTypeValue ? (Number(fsxTypeValue?.spaceSavings) / Number(fsxTypeValue?.used)) * 100 : 0;
        if (val?.storage?.[fsxType]?.spaceSavings && val?.storage?.[fsxType]?.used) {
            storageSavingsText = `${formatFractionalNumber(storagePercent, 2)}% (${formatSizeOnePrecision(
                Number(fsxTypeValue?.spaceSavings)
            )})`;
        } else if (val?.storage?.[fsxType]?.spaceSavings === 0) {
            storageSavingsText = '0%';
        } else {
            storageSavingsText = '';
        }
    }
    return storageSavingsText;
};

export const formatInstanceData = (row: ManagedHostsRowInterface) => {
    const isAllManaged = row?.databaseInstanceDetails?.every(perRow => !!perRow?.isManaged);

    let nonManagedStatus: any = [];
    if (!isAllManaged) {
        nonManagedStatus = getInstanceStatusForMixedCase(row);
        // to call data for mixed case. use in statusColText for unmanaged case
    }

    let instanceRows;
    if (row?.databaseInstanceDetails) {
        instanceRows = row?.databaseInstanceDetails?.map(perRow => {
            const isManagedRow = row?.databaseInstanceDetails?.filter(
                per => per?.instanceName?.toLowerCase() === perRow?.instanceName?.toLowerCase()
            );
            const statusObj = nonManagedStatus?.filter(
                (per: StatusObjInterface) => per?.name?.toLowerCase() === perRow?.instanceName?.toLowerCase()
            );
            return {
                ...perRow,
                databaseInstanceId: perRow?.databaseInstanceId,
                databaseInstanceName: perRow?.instanceName,
                status: perRow?.instanceState,
                manageReadiness: statusObj?.[0]?.manageReadiness,
                statusColText: isManagedRow?.[0]?.isManaged
                    ? INVENTORY_STATUS.MANAGED
                    : statusObj?.[0]?.status || INVENTORY_STATUS.UNDETECTED,
                isFsxRegistered: statusObj?.[0]?.isFsxRegistered,
                windowsAuthentication: statusObj?.[0]?.windowsAuthentication,
                sqlServerAuthentication: statusObj?.[0]?.sqlServerAuthentication,
                windowsDomainUserAuthentication: statusObj?.[0]?.windowsDomainUserAuthentication
            };
        });
    }
    if (row?.databaseInstancesSummary && row?.databaseInstancesSummary?.length > 0) {
        instanceRows = instanceRows?.map(instRow => {
            const perRow = row?.databaseInstancesSummary?.find(
                per => per?.databaseInstanceName?.toLowerCase() === instRow?.databaseInstanceName?.toLowerCase()
            );
            const isManagedRow = row?.databaseInstanceDetails?.filter(
                per => per?.instanceName?.toLowerCase() === perRow?.databaseInstanceName?.toLowerCase()
            );
            const statusObj = nonManagedStatus?.filter(
                (per: StatusObjInterface) => per?.name?.toLowerCase() === perRow?.databaseInstanceName?.toLowerCase()
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
                    fileSystemName: perRow?.databaseInstanceTopology?.fileSystemName
                        ? perRow?.databaseInstanceTopology?.fileSystemName
                        : GENERAL.NOT_AVAILABLE,
                    protection: perRow?.protection,
                    performance: perRow?.performance,
                    storage: perRow?.storage,
                    storageSavingsText: getStorageSavingsText(perRow || {}),
                    allocatedCapacity,
                    allocatedCapacityText: allocatedCapacity ? formatSizeTwoPrecision(allocatedCapacity) : '',
                    manageReadiness: statusObj?.[0]?.manageReadiness,
                    isFsxRegistered: statusObj?.[0]?.isFsxRegistered,
                    windowsAuthentication: statusObj?.[0]?.windowsAuthentication,
                    sqlServerAuthentication: statusObj?.[0]?.sqlServerAuthentication,
                    windowsDomainUserAuthentication: statusObj?.[0]?.windowsDomainUserAuthentication
                };
            }
            return instRow;
        });
    }

    return instanceRows;
};

export const getFsxIdsFromdiscover = (data: Array<DiscoverHostInterface>) => {
    const fsxIds: Array<string> = [];
    data?.map((instances: DiscoverHostInterface) => {
        instances?.sqlServerInstances?.map((inst: SQLServerInstancesDiscovered) => {
            inst?.storage?.map((storageObj: DiscoveredStorageObj) => {
                if (storageObj.type === DETECT_HOST_VAR.FSXN) {
                    const fsxId = storageObj?.id || '';
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
    const testedNodes: string[] = [];

    newDiscoveredHostData.map((host: DiscoverHostInterface) => {
        if (host?.nodesList) {
            if (testedNodes.includes(host?.ec2InstanceId || '')) {
                return;
            }
            // To find partner node in a cluster
            let partnerNode = newDiscoveredHostData.filter((perHost: DiscoverHostInterface) => {
                const isSameCluster = host?.nodesList?.every(
                    (val: string) =>
                        perHost?.ec2InstanceId !== host?.ec2InstanceId &&
                        perHost?.nodesList &&
                        perHost.nodesList.includes(val) &&
                        perHost?.credentialId === host?.credentialId &&
                        perHost?.regionId === host?.regionId
                );
                // checking same vpc or not
                if (isSameCluster && perHost?.vpc?.id === host?.vpc?.id) {
                    return perHost;
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

                const bothNodes = [host, partnerNode];
                const ec2Details: Array<{ id: string; name: string }> = [];
                bothNodes?.forEach((perNode: DiscoverHostInterface) => {
                    if (perNode?.ec2InstanceId) {
                        ec2Details.push({
                            id: perNode?.ec2InstanceId || '',
                            name: perNode?.ec2InstanceName || ''
                        });
                    }
                });

                const updatedHost = {
                    ...host,
                    ec2Details
                };
                if (partnerNode) {
                    partnerNode = {
                        ...partnerNode,
                        ec2Details
                    };
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
                    if (updatedHost?.ec2InstanceId) {
                        removeRows.push(
                            uniqueHostRow(
                                updatedHost?.ec2InstanceId,
                                updatedHost?.credentialId || '',
                                updatedHost?.regionId || ''
                            )
                        );
                    }
                } else {
                    const combinedData = combineClusterData(updatedHost, partnerNode, removeRows);
                    if (combinedData) {
                        clusterDiscoveredHost[
                            uniqueHostRow(
                                combinedData?.key,
                                updatedHost?.credentialId || '',
                                updatedHost?.regionId || ''
                            )
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
                }
            }
        }
    });
};

export const getPrimaryPgsqlNode = (
    newDiscoveredPgsqlHostData: Array<DiscoverPgsqlHostInterface>,
    discoveredPgsqlHostData: Array<DiscoverHostInterface>,
    removeRows: Array<string>,
    managedHostsList: string[],
    clusterDiscoveredHost: any,
    isDemoMode: boolean | undefined
) => {
    const testedNodes: string[] = [];

    discoveredPgsqlHostData?.map((host: any) => {
        const perHostNodesList: any = [];
        perHostNodesList.push(host?.ec2InstanceId);
        if (host?.pgsqlServerInstances) {
            host?.pgsqlServerInstances?.map((perSql: any) => {
                if (perSql?.primaryNode) {
                    perHostNodesList.push(perSql?.primaryNode?.ec2InstanceId);
                }
                perSql?.nodes?.map((pernode: any) => {
                    perHostNodesList.push(pernode?.ec2InstanceId);
                });
            });
        }
        host = { ...host, nodesList: perHostNodesList };
        newDiscoveredPgsqlHostData.push(host);
    });

    newDiscoveredPgsqlHostData?.map((host: DiscoverPgsqlHostInterface) => {
        if (host?.nodesList) {
            if (testedNodes.includes(host?.ec2InstanceId || '')) {
                return;
            }
            // To find partner node in a cluster
            let partnerNode = newDiscoveredPgsqlHostData?.filter((perHost: DiscoverHostInterface) => {
                const isSameCluster = host?.nodesList?.filter(
                    (val: string) =>
                        perHost?.ec2InstanceId !== host?.ec2InstanceId &&
                        perHost?.nodesList &&
                        perHost.nodesList.includes(val) &&
                        perHost?.credentialId === host?.credentialId &&
                        perHost?.regionId === host?.regionId
                );
                // checking same vpc or not
                if (isSameCluster && isSameCluster.length > 0 && perHost?.vpc?.id === host?.vpc?.id) {
                    return perHost;
                }
            });

            if (partnerNode && !isDemoMode) {
                partnerNode = [host, ...partnerNode];
                const ec2Details: Array<{ id: string; name: string }> = [];
                partnerNode?.map((perPartnerNode: DiscoverHostInterface) => {
                    ec2Details.push({
                        id: perPartnerNode?.ec2InstanceId || '',
                        name: perPartnerNode?.ec2InstanceName || ''
                    });
                });

                partnerNode = partnerNode?.map((perPartnerNode: DiscoverHostInterface) => ({
                    ...perPartnerNode,
                    ec2Details
                }));

                let anyManagedNode = false;
                partnerNode?.map((perPartnerNode: DiscoverHostInterface) => {
                    testedNodes.push(perPartnerNode?.ec2InstanceId);
                    if (managedHostsList.includes(perPartnerNode?.ec2InstanceId)) {
                        anyManagedNode = true;
                    }
                });

                if (anyManagedNode) {
                    partnerNode?.map((perPN: DiscoverHostInterface) => {
                        if (perPN?.ec2InstanceId) {
                            removeRows.push(
                                uniqueHostRow(perPN?.ec2InstanceId, perPN?.credentialId || '', perPN?.regionId || '')
                            );
                        }
                    });
                } else {
                    const combinedData: any = combinePgsqlClusterData(partnerNode, removeRows);
                    if (combinedData) {
                        clusterDiscoveredHost[
                            uniqueHostRow(combinedData?.key, host?.credentialId || '', host?.regionId || '')
                        ] = combinedData?.data;
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
                }
            }
        }
    });
};

export const combineClusterData = (
    node: DiscoverHostInterface,
    partner: DiscoverHostInterface,
    removeRows: Array<string>
) => {
    let result = null;
    const key = `${node?.ec2InstanceId || ''},${partner?.ec2InstanceId || ''}`;
    const sqlServerInstancesList: Array<SQLServerInstancesDiscovered> = [];
    const uniqueSqlServerList: Array<string> = [];
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
                key,
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
                key,
                sqlServerInstances: sqlServerInstancesList
            }
        };
    }
    return result;
};

export const combinePgsqlClusterData = (allNodes: Array<DiscoverPgsqlHostInterface>, removeRows: Array<string>) => {
    let result = null;
    const key = allNodes?.map(perPartner => perPartner.ec2InstanceId).join(',') || '';
    const pgsqlInstanceList: Array<PgsqlInstancesDiscovered> = [];
    const uniqueSqlServerList: Array<string> = [];
    let primaryNode: string = '';

    primaryNode =
        allNodes?.find((node: DiscoverPgsqlHostInterface) =>
            node?.pgsqlServerInstances?.some((perRow: PgsqlInstancesDiscovered) => perRow?.isPrimary)
        )?.ec2InstanceId || '';
    if (!primaryNode) {
        primaryNode =
            allNodes?.find((node: DiscoverPgsqlHostInterface) =>
                node?.pgsqlServerInstances?.some(
                    (perRow: PgsqlInstancesDiscovered) => perRow?.pgsqlServerState === 'running'
                )
            )?.ec2InstanceId || '';
    }

    allNodes?.map((node: DiscoverPgsqlHostInterface) => {
        node?.pgsqlServerInstances?.map((perRow: PgsqlInstancesDiscovered) => {
            if (uniqueSqlServerList.includes(perRow?.pgsqlServerInstanceName!)) {
                uniqueSqlServerList.push(perRow?.pgsqlServerInstanceName!);
                pgsqlInstanceList.push(perRow);
            } else {
                uniqueSqlServerList.push(perRow?.pgsqlServerInstanceName!);
                pgsqlInstanceList.push(perRow);
            }
        });
    });

    allNodes?.map((node: DiscoverPgsqlHostInterface) => {
        if (primaryNode === node?.ec2InstanceId) {
            result = {
                key: primaryNode,
                data: {
                    ...node,
                    key,
                    sqlServerInstances: pgsqlInstanceList
                }
            };
        } else if (node?.ec2InstanceId) {
            removeRows.push(uniqueHostRow(node?.ec2InstanceId, node?.credentialId || '', node?.regionId || ''));
        }
    });
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
        const partnerInstance = partner?.sqlServerInstances?.filter(
            (perPartnerRow: any) => perPartnerRow?.sqlServerInstance === perRow?.sqlServerInstance
        );
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
    const state = store.getState();
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
                            regionMapping,
                            GENERAL.MICROSOFT_SQL_SERVER_TYPE
                        )
                }
            };
        } else {
            result = {
                ...result,
                ...{
                    [uniqueHostRow(perRow.ec2InstanceId, perRow.credentialId || '', perRow.regionId || '')]:
                        formatDiscoveredRows(
                            perRow,
                            credentialMapping,
                            regionMapping,
                            GENERAL.MICROSOFT_SQL_SERVER_TYPE
                        )
                }
            };
        }
    });
    return result;
};

export const formatDiscoveredPgsqlInventoryData = (
    discoveredData: Array<DiscoverPgsqlHostInterface>,
    removeRows: Array<string>,
    clusterDiscoveredHost: any
) => {
    let result = {};
    if (!discoveredData) {
        return result;
    }
    const state = store.getState();
    const { credentialMapping, regionMapping } = state?.headers;
    discoveredData?.map((perRow: DiscoverPgsqlHostInterface) => {
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
                        formatPgsqlDiscoveredRows(
                            clusterDiscoveredHost[
                                uniqueHostRow(perRow.ec2InstanceId, perRow.credentialId || '', perRow.regionId || '')
                            ],
                            credentialMapping,
                            regionMapping,
                            GENERAL.POSTGRESQL_TYPE
                        )
                }
            };
        } else {
            result = {
                ...result,
                ...{
                    [uniqueHostRow(perRow.ec2InstanceId, perRow.credentialId || '', perRow.regionId || '')]:
                        formatPgsqlDiscoveredRows(perRow, credentialMapping, regionMapping, GENERAL.POSTGRESQL_TYPE)
                }
            };
        }
    });
    return result;
};

export const formatDiscoveredOracleInventoryData = (discoveredData: Array<DiscoverOracleHostInterface>) => {
    let result = {};
    if (!discoveredData) {
        return result;
    }
    const state = store.getState();
    const { credentialMapping, regionMapping } = state?.headers;
    discoveredData?.map((perRow: DiscoverHostInterface) => {
        result = {
            ...result,
            ...{
                [uniqueHostRow(perRow.ec2InstanceId, perRow.credentialId || '', perRow.regionId || '')]:
                    formatOracleDiscoveredRows(perRow, credentialMapping, regionMapping)
            }
        };
    });
    return result;
};

export const formatDiscoveredRows = (
    discoveredRow: DiscoverHostInterface,
    credentialMapping: any,
    regionMapping: any,
    type: string
) => {
    const totalInstanceCount = discoveredRow?.sqlServerInstances?.length || 0;
    const ssmState = getDiscoverSsmState(discoveredRow);
    const perInstanceStatus = getDiscoveredPerInstanceStatus(discoveredRow, ssmState);
    const installationMode = getDiscoverInstallationMode(discoveredRow, type);
    const actionObj = getDiscoveredActions(perInstanceStatus, installationMode);
    const ec2Details = [
        {
            id: discoveredRow?.ec2InstanceId,
            name: discoveredRow?.ec2InstanceName
        }
    ];
    const result = {
        id: discoveredRow?.ec2InstanceId,
        ec2InstanceId: discoveredRow?.ec2InstanceId,
        ec2InstanceName: discoveredRow?.ec2InstanceName,
        resourceId: '',
        discoveredRowKey: discoveredRow?.key,
        name: getDiscoverHostname(discoveredRow, type),
        status: ssmState, // discover status will depends on ssmState only
        ssmState,
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
        ec2Details: discoveredRow?.ec2Details || ec2Details,
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

export const formatPgsqlDiscoveredRows = (
    discoveredRow: DiscoverPgsqlHostInterface,
    credentialMapping: any,
    regionMapping: any,
    type: string
) => {
    const totalInstanceCount = discoveredRow?.pgsqlServerInstances?.length || 0;
    const ssmState = getDiscoverSsmState(discoveredRow);
    const perInstanceStatus = getPgsqlPerInstanceStatus(discoveredRow, ssmState);
    const installationMode = getDiscoverInstallationMode(discoveredRow, type);
    const actionObj = getDiscoveredActions(perInstanceStatus, installationMode);
    const ec2Details = [
        {
            id: discoveredRow?.ec2InstanceId,
            name: discoveredRow?.ec2InstanceName
        }
    ];
    const result = {
        id: discoveredRow?.ec2InstanceId,
        ec2InstanceId: discoveredRow?.ec2InstanceId,
        ec2InstanceName: discoveredRow?.ec2InstanceName,
        resourceId: '',
        discoveredRowKey: discoveredRow?.key,
        name: getDiscoverHostname(discoveredRow, type),
        status: ssmState, // discover status will depends on ssmState only
        ssmState,
        totalInstance: totalInstanceCount,
        managedInstance: 0,
        serverInstallationMode: installationMode,
        serverAllInstallationMode: [installationMode],
        vpcId: discoveredRow?.vpc?.id,
        vpcName: discoveredRow?.vpc?.name,
        vpcCidr: discoveredRow?.vpc?.cidrBlock,
        action: actionObj?.action,
        actionDisable: actionObj?.actionDisable,
        isManagedHost: false,
        loading: false,
        storageType: actionObj?.storageType,
        isDetected: actionObj?.isDetected,
        ec2Details: discoveredRow?.ec2Details || ec2Details,
        hostType: GENERAL.POSTGRESQL_TYPE,
        // **** Below values will get from Instances API *****
        // estimatedUsageCost: {}, // Initially it will be blank
        // totalCost: '',
        // allocatedCapacity: '',
        sqlServerInstances: formatPgsqlDiscoverInstanceData(discoveredRow, perInstanceStatus),
        credentialId: discoveredRow?.credentialId,
        regionId: discoveredRow?.regionId,
        credentialName: credentialMapping?.[discoveredRow?.credentialId || GENERAL.NOT_AVAILABLE]?.name,
        accountId: credentialMapping?.[discoveredRow?.credentialId || GENERAL.NOT_AVAILABLE]?.providerAccountId,
        regionName: regionMapping?.[discoveredRow?.regionId || GENERAL.NOT_AVAILABLE]?.regionName
    };
    return result;
};

export const formatOracleDiscoveredRows = (
    discoveredRow: DiscoverOracleHostInterface,
    credentialMapping: any,
    regionMapping: any
) => {
    const totalInstanceCount = discoveredRow?.databaseInstanceDetails?.length || 0;
    const ssmState = getDiscoverSsmState(discoveredRow);
    const perInstanceStatus = getOracleDiscoverPerInstanceStatus(discoveredRow, ssmState);
    const installationMode = discoveredRow?.oracleServerDeploymentType || '';
    const actionObj = getDiscoveredActions(perInstanceStatus, installationMode);
    const ec2Details = [
        {
            id: discoveredRow?.ec2InstanceId,
            name: discoveredRow?.ec2InstanceName
        }
    ];
    const result = {
        id: discoveredRow?.ec2InstanceId,
        ec2InstanceId: discoveredRow?.ec2InstanceId,
        ec2InstanceName: discoveredRow?.ec2InstanceName,
        name: discoveredRow?.ec2InstanceName,
        status: ssmState, // discover status will depends on ssmState only
        ssmState,
        totalInstance: totalInstanceCount,
        managedInstance: 0,
        serverInstallationMode: installationMode,
        serverAllInstallationMode: [installationMode],
        vpcId: discoveredRow?.vpc?.id,
        vpcName: discoveredRow?.vpc?.name,
        vpcCidr: discoveredRow?.vpc?.cidrBlock,
        action: actionObj?.action,
        actionDisable: actionObj?.actionDisable,
        isManagedHost: false,
        loading: false,
        storageType: actionObj?.storageType,
        isDetected: actionObj?.isDetected,
        ec2Details,
        hostType: GENERAL.ORACLE_TYPE,
        // **** Below values will get from Instances API *****
        // estimatedUsageCost: {}, // Initially it will be blank
        // totalCost: '',
        // allocatedCapacity: '',
        sqlServerInstances: formatOracleDiscoverInstanceData(discoveredRow, perInstanceStatus),
        credentialId: discoveredRow?.credentialId,
        regionId: discoveredRow?.regionId,
        credentialName: credentialMapping?.[discoveredRow?.credentialId || GENERAL.NOT_AVAILABLE]?.name,
        accountId: credentialMapping?.[discoveredRow?.credentialId || GENERAL.NOT_AVAILABLE]?.providerAccountId,
        regionName: regionMapping?.[discoveredRow?.regionId || GENERAL.NOT_AVAILABLE]?.regionName
    };
    return result;
};

export const getDiscoverHostname = (discoveredRow: DiscoverHostInterface, type: string) => {
    let name: string = '';
    if (type === GENERAL.MICROSOFT_SQL_SERVER_TYPE && discoveredRow?.sqlServerInstances) {
        for (let i = 0; i < discoveredRow?.sqlServerInstances?.length; i++) {
            const val = discoveredRow?.sqlServerInstances[i];
            // For Failover or AOAG cluster, we will take sqlServerName as name
            if (
                val?.sqlServerName &&
                (val?.sqlServerDeploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE ||
                    val?.sqlServerDeploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG)
            ) {
                name = val?.sqlServerName;
                break;
            } else if (!name && val?.sqlServerName) {
                // For other instances, we will take sqlServerInstance as name but still check for FCI or AOAG name
                name = val?.sqlServerName;
            }
        }
    } else if (type === GENERAL.POSTGRESQL_TYPE && discoveredRow?.pgsqlServerInstances) {
        for (let i = 0; i < discoveredRow?.pgsqlServerInstances?.length; i++) {
            const val = discoveredRow?.pgsqlServerInstances[i];
            if (val?.pgsqlServerName) {
                name = val?.pgsqlServerName;
                break;
            }
        }
    } else if (type === GENERAL.ORACLE_TYPE && discoveredRow?.ec2InstanceName) {
        name = discoveredRow?.ec2InstanceName;
    }
    return name;
};

export const getDiscoverSsmState = (row: DiscoverHostInterface) => {
    if (row?.ssmState && row?.ssmState !== INVENTORY_STATUS.NOT_AVAILABLE) {
        if (row?.ssmState?.toLowerCase() === INVENTORY_STATUS.SSM_CONNECTED) {
            return INVENTORY_STATUS.ONLINE;
        }
        return INVENTORY_STATUS.OFFLINE;
    }
    return INVENTORY_STATUS.OFFLINE;
};

export const getDiscoverInstallationMode = (row: any, type: string) => {
    let installationMode = '';
    if (type === GENERAL.MICROSOFT_SQL_SERVER_TYPE && row?.sqlServerInstances && row?.sqlServerInstances?.length > 0) {
        for (let i = 0; i < row?.sqlServerInstances?.length; i++) {
            const val = row?.sqlServerInstances[i];
            if (val?.sqlServerDeploymentType) {
                installationMode = val?.sqlServerDeploymentType;
                break;
            }
        }
    } else if (type === GENERAL.POSTGRESQL_TYPE && row?.pgsqlServerInstances && row?.pgsqlServerInstances?.length > 0) {
        for (let i = 0; i < row?.pgsqlServerInstances?.length; i++) {
            const val = row?.pgsqlServerInstances[i];
            if (val?.pgsqlServerDeploymentType) {
                installationMode = val?.pgsqlServerDeploymentType;
                break;
            }
        }
    } else if (type === GENERAL.ORACLE_TYPE && row?.oracleServerDeploymentType) {
        installationMode = row?.oracleServerDeploymentType;
    }

    if (installationMode?.toLowerCase() === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE) {
        installationMode = GENERAL.FAILOVER_CLUSTER_INSTANCES;
    } else if (installationMode?.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG) {
        installationMode = GENERAL.AOAG;
    } else if (installationMode.toLowerCase() === SQL_DEPLOYMENT_MODE.HA) {
        installationMode = GENERAL.HA;
    } else if (installationMode.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
        installationMode = GENERAL.STANDALONE;
    }
    return installationMode;
};

export const getAllDiscoverInstallationMode = (row: DiscoverHostInterface) => {
    const installationMode: Array<string> = [];
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
    }
    return [];
};

export const getDiscoveredPerInstanceStatus = (row: DiscoverHostInterface, ssmState: string) => {
    let result: Array<StatusObjInterface> = [];
    const state = store.getState();
    const fsxCredentialStatusObj = state?.inventoryV2?.fsxCredentialStatusObj;
    if (row?.sqlServerInstances && row?.sqlServerInstances?.length > 0) {
        row?.sqlServerInstances?.map((perRow: SQLServerInstancesDiscovered) => {
            let statusObj = {};
            if (perRow?.sqlServerInstance) {
                const isWindowAuthentication = perRow?.windowsAuthentication;
                const isSqlAuthentication = perRow?.sqlServerAuthentication;
                const isWindowsDomainAuthentication = perRow?.windowsDomainUserAuthentication;
                let fsxCredentialValidationFailed;
                let storageTypeCheck;
                const fsxIdObject = perRow?.storage?.find(
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
                    (!isWindowAuthentication && !isSqlAuthentication && !isWindowsDomainAuthentication) ||
                    fsxCredentialValidationFailed ||
                    !storageTypeCheck
                ) {
                    const detectOptionObj = getDetectOptionForInstance(
                        perRow,
                        row?.ssmState,
                        fsxIdObject?.id,
                        fsxCredentialStatusObj,
                        GENERAL.MICROSOFT_SQL_SERVER_TYPE
                    );
                    statusObj = {
                        ...detectOptionObj,
                        discoverInstanceData: perRow,
                        name: perRow.sqlServerInstance,
                        status: INVENTORY_STATUS.UNDETECTED,
                        storageType: perRow?.storage,
                        fsxId: fsxIdObject?.id,
                        isFsxRegistered: !fsxCredentialValidationFailed,
                        manageReadiness: perRow?.manageReadiness,
                        windowsAuthentication: isWindowAuthentication,
                        sqlServerAuthentication: isSqlAuthentication,
                        windowsDomainUserAuthentication: isWindowsDomainAuthentication
                    };
                } else {
                    statusObj = {
                        discoverInstanceData: perRow,
                        name: perRow.sqlServerInstance,
                        status: INVENTORY_STATUS.UNMANAGED,
                        storageType: perRow?.storage,
                        fsxId: fsxIdObject?.id,
                        isFsxRegistered: !fsxCredentialValidationFailed,
                        manageReadiness: perRow?.manageReadiness,
                        windowsAuthentication: isWindowAuthentication,
                        sqlServerAuthentication: isSqlAuthentication,
                        windowsDomainUserAuthentication: isWindowsDomainAuthentication
                    };
                }
                result = [...result, ...[statusObj]];
            }
        });
    }
    return result;
};

export const getOracleDiscoverPerInstanceStatus = (row: DiscoverOracleHostInterface, ssmState: string) => {
    let result: Array<StatusObjInterface> = [];
    const state = store.getState();
    const fsxCredentialStatusObj = state?.inventoryV2?.fsxCredentialStatusObj;
    if (row?.databaseInstanceDetails && row?.databaseInstanceDetails?.length > 0) {
        row?.databaseInstanceDetails?.map((perRow: OracleInstancesDiscovered) => {
            let statusObj = {};
            if (perRow?.instanceName) {
                let fsxCredentialValidationFailed;
                let storageTypeCheck;
                const fsxIdObject = perRow?.storage?.find(
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

                if (ssmState !== INVENTORY_STATUS.ONLINE || fsxCredentialValidationFailed || !storageTypeCheck) {
                    const detectOptionObj = getDetectOptionForInstance(
                        perRow,
                        row?.ssmState,
                        fsxIdObject?.id,
                        fsxCredentialStatusObj,
                        GENERAL.ORACLE_TYPE
                    );
                    statusObj = {
                        ...detectOptionObj,
                        name: perRow.instanceName,
                        status: INVENTORY_STATUS.UNDETECTED,
                        storageType: perRow?.storage,
                        fsxId: fsxIdObject?.id,
                        isFsxRegistered: !fsxCredentialValidationFailed
                    };
                } else {
                    statusObj = {
                        name: perRow.instanceName,
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

export const getPgsqlPerInstanceStatus = (row: DiscoverPgsqlHostInterface, ssmState: string) => {
    let result: Array<StatusObjInterface> = [];
    const state = store.getState();
    const fsxCredentialStatusObj = state?.inventoryV2?.fsxCredentialStatusObj;
    if (row?.pgsqlServerInstances && row?.pgsqlServerInstances?.length > 0) {
        row?.pgsqlServerInstances?.map((perRow: PgsqlInstancesDiscovered) => {
            let statusObj = {};
            if (perRow?.pgsqlServerInstanceName) {
                const isdefaultAuth = perRow?.defaultAuth;
                let fsxCredentialValidationFailed;
                let storageTypeCheck;
                const fsxIdObject = perRow?.storage?.find(
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
                    !isdefaultAuth ||
                    fsxCredentialValidationFailed ||
                    !storageTypeCheck
                ) {
                    const detectOptionObj = getDetectOptionForInstance(
                        perRow,
                        row?.ssmState,
                        fsxIdObject?.id,
                        fsxCredentialStatusObj,
                        GENERAL.POSTGRESQL_TYPE
                    );
                    statusObj = {
                        ...detectOptionObj,
                        name: perRow.pgsqlServerInstanceName,
                        status: INVENTORY_STATUS.UNDETECTED,
                        storageType: perRow?.storage,
                        fsxId: fsxIdObject?.id,
                        isFsxRegistered: !fsxCredentialValidationFailed
                    };
                } else {
                    statusObj = {
                        name: perRow.pgsqlServerInstanceName,
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
    perRow: any,
    ssmState: string | undefined,
    fsxId: string | undefined,
    fsxCredentialStatusObj: any,
    type: string
) => {
    let hasStorageTypes = false;
    if (perRow?.storage && perRow?.storage?.length > 0) {
        hasStorageTypes = true;
    }
    let detectOption = DETECT_HOST_VAR.DISABLE;
    let detectOptionDisableMsg = '';
    let state = '';
    if (type === GENERAL.POSTGRESQL_TYPE) {
        state = perRow?.pgsqlServerState;
    } else if (type === GENERAL.ORACLE_TYPE) {
        state = perRow?.instanceState;
    } else {
        state = perRow?.sqlServerState;
    }
    let auth =
        perRow?.windowsAuthentication || perRow?.sqlServerAuthentication || perRow?.windowsDomainUserAuthentication;
    if (type === GENERAL.POSTGRESQL_TYPE) {
        auth = perRow?.defaultAuth;
    }
    const isSqlRunning = state === DETECT_HOST_VAR.RUNNING || state === STATUS_CONST.OPEN;
    if (ssmState?.toLowerCase() !== INVENTORY_STATUS.SSM_CONNECTED) {
        detectOption = DETECT_HOST_VAR.HIDE;
        detectOptionDisableMsg = GENERAL.SSM_CONNECTION_DOWN;
    } else if (!isSqlRunning) {
        detectOption = DETECT_HOST_VAR.DISABLE;
        detectOptionDisableMsg = GENERAL.SQL_SERVER_NOT_RUNNING;
    } else if (!hasStorageTypes && auth) {
        detectOption = DETECT_HOST_VAR.DISABLE;
        detectOptionDisableMsg = GENERAL.STORAGE_NOT_PRESENT;
    } else if ((fsxId && fsxId in fsxCredentialStatusObj) || !fsxId) {
        detectOption = DETECT_HOST_VAR.SHOW;
    }
    return {
        detectOption,
        detectOptionDisableMsg
    };
};

export const getDiscoveredActions = (row: Array<StatusObjInterface>, installationMode: string | null) => {
    let action = '';
    let actionDisable = false;
    const undetected = row?.filter((per: StatusObjInterface) => per?.status === INVENTORY_STATUS.UNDETECTED);
    const unmanaged = row?.filter((per: StatusObjInterface) => per?.status === INVENTORY_STATUS.UNMANAGED);
    const isStorage = row?.find((per: StatusObjInterface) => {
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
        actionDisable = !!(undetected?.length > 0 && unmanaged?.length === 0);
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
        action,
        actionDisable,
        storageType,
        isDetected: unmanaged?.length > 0
    };
};

export const getDiscoverFileSystemType = (row: SQLServerInstancesDiscovered | PgsqlInstancesDiscovered) => {
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
    const instanceRows = row?.sqlServerInstances?.map((perRow: SQLServerInstancesDiscovered) => {
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
            windowsDomainUserAuthentication: perRow?.windowsDomainUserAuthentication,
            detectOption: statusObj?.[0]?.detectOption,
            detectOptionDisableMsg: statusObj?.[0]?.detectOptionDisableMsg,
            manageReadiness: perRow?.manageReadiness
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

export const formatPgsqlDiscoverInstanceData = (
    row: DiscoverPgsqlHostInterface,
    perInstanceStatus: Array<StatusObjInterface>
) => {
    const instanceRows = row?.pgsqlServerInstances?.map((perRow: PgsqlInstancesDiscovered) => {
        const statusObj = perInstanceStatus?.filter(
            (per: StatusObjInterface) => per?.name === perRow?.pgsqlServerInstanceName
        );
        return {
            ...perRow,
            databaseInstanceId: perRow?.pgsqlServerInstanceId,
            databaseInstanceName: perRow?.pgsqlServerInstanceName,
            status: perRow?.pgsqlServerState,
            // databaseCount: 0,
            databaseCount: perRow?.databaseCount,
            statusColText: statusObj ? statusObj?.[0]?.status : INVENTORY_STATUS.UNDETECTED,
            fileSystemDeploymentMode: getPgsqlAzType(perRow),
            fileSystemType: getDiscoverFileSystemType(perRow),
            storage: perRow?.storage,
            fsxId: statusObj?.[0]?.fsxId,
            isFsxRegistered: statusObj?.[0]?.isFsxRegistered,
            isDefaultAuth: perRow?.defaultAuth,
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

export const formatOracleDiscoverInstanceData = (
    row: DiscoverOracleHostInterface,
    perInstanceStatus: Array<StatusObjInterface>
) => {
    const instanceRows = row?.databaseInstanceDetails?.map((perRow: OracleInstancesDiscovered) => {
        const statusObj = perInstanceStatus?.filter((per: StatusObjInterface) => per?.name === perRow?.instanceName);
        const instanceStatus =
            perRow?.instanceState === STATUS_CONST.OPEN
                ? INVENTORY_STATUS.CASE_SENSITIVE_UP
                : INVENTORY_STATUS.CASE_SENSITIVE_DOWN;
        return {
            ...perRow,
            databaseInstanceId: perRow?.instanceId,
            databaseInstanceName: perRow?.instanceName,
            status: instanceStatus,
            databaseCount: perRow?.databaseCount,
            statusColText: statusObj ? statusObj?.[0]?.status : INVENTORY_STATUS.UNDETECTED,
            fileSystemType: getDiscoverFileSystemType(perRow),
            storage: perRow?.storage,
            fsxId: statusObj?.[0]?.fsxId,
            isFsxRegistered: statusObj?.[0]?.isFsxRegistered,
            defaultAuth: perRow?.defaultAuth,
            detectOption: statusObj?.[0]?.detectOption,
            detectOptionDisableMsg: statusObj?.[0]?.detectOptionDisableMsg,
            oracleServerDeploymentType: row?.oracleServerDeploymentType
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
        [DBType.MSSQL.toLowerCase()]: 30000,
        [DBType.ORACLE.toLowerCase()]: 20000,
        [DBType.POSTGRESQL.toLowerCase()]: 10000
    };

    const statusWeights: any = {
        [INVENTORY_STATUS.CASE_SENSITIVE_UP.toLowerCase()]: 3000,
        [INVENTORY_STATUS.RUNNING.toLowerCase()]: 3000,
        [INVENTORY_STATUS.CASE_SENSITIVE_DOWN.toLowerCase()]: 2000,
        [INVENTORY_STATUS.STOPPED.toLowerCase()]: 2000,
        [INVENTORY_STATUS.UNKNOWN.toLowerCase()]: 1000,

        '': 0
    };

    const isManagedWeights: any = {
        [INVENTORY_STATUS.MANAGED.toLowerCase()]: 300,
        [INVENTORY_STATUS.UNMANAGED.toLowerCase()]: 200,
        [INVENTORY_STATUS.IN_PROGRESS.toLowerCase()]: 200,
        [INVENTORY_STATUS.UNDETECTED.toLowerCase()]: 100,
        '': 0
    };

    const result = data.slice().sort((a, b) => {
        const weightA =
            (databasesWeights[(a?.hostType || '').toLowerCase()] || 0) +
            (statusWeights[(a?.status || '').toLowerCase()] || 0) +
            (isManagedWeights[(a?.statusColText || '').toLowerCase()] || 0);

        const weightB =
            (databasesWeights[(b?.hostType || '').toLowerCase()] || 0) +
            (statusWeights[(b?.status || '').toLowerCase()] || 0) +
            (isManagedWeights[(b?.statusColText || '').toLowerCase()] || 0);

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
    const instanceList: Array<string> = [];
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
    const instanceList: Array<string> = [];
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
            (databaseHostsData[key]?.action === INVENTORY_ACTIONS.MANAGE &&
                databaseHostsData[key]?.ssmState === STATUS_CONST.ONLINE) ||
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

export const getUnmanagedPgsqlHostInstances = (
    databaseHostsData: { [key: string]: InventoryTableData },
    runningPgsqlInstanceListRef: Array<string>
) => {
    const instanceList: Array<string> = [];
    Object.keys(databaseHostsData).map((key: string) => {
        if (
            runningPgsqlInstanceListRef.includes(
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
            databaseHostsData[key]?.action === INVENTORY_ACTIONS.MANAGE &&
            // !databaseHostsData[key]?.actionDisable &&
            databaseHostsData[key]?.ssmState === STATUS_CONST.ONLINE
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

export const getUnmanagedOracleHostInstances = (
    databaseHostsData: { [key: string]: InventoryTableData },
    runningOracleInstanceListRef: Array<string>
) => {
    const instanceList: Array<string> = [];
    Object.keys(databaseHostsData).forEach((key: string) => {
        if (
            runningOracleInstanceListRef.includes(
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
            databaseHostsData[key]?.action === INVENTORY_ACTIONS.MANAGE &&
            databaseHostsData[key]?.ssmState === STATUS_CONST.ONLINE
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
                const currInst = inventoryTableData[inst];
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
                allocatedCapacity,
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
            const ec2Details = getEc2DetailsForUnmanagedHost(instanceRow, inventoryRow);
            const mergedCost = mergeEstimatedCost(instanceRow, partnerInstanceData);
            const allocatedCapacity = getMergedAllocatedCapacity([instanceRow?.data, partnerInstanceData?.data]);
            const ebsResourceInfo = mergeEbsResourceInfo(instanceRow, partnerInstanceData);
            result = {
                ...inventoryRow,
                name: inventoryRow?.name || instanceRow?.data?.name,
                isManagedHost: instanceRow?.isManagedHost,
                loading: instanceRow?.loading,
                ec2Details: ec2Details?.length > 0 ? ec2Details : inventoryRow?.ec2Details,
                estimatedUsageCost: mergedCost,
                totalCost: getTotalCost(mergedCost || {}),
                allocatedCapacity,
                allocatedCapacityText: allocatedCapacity ? formatSizeTwoPrecision(allocatedCapacity) : '',
                hasInstanceData: true,
                sqlLicenseIncluded: instanceRow?.data?.sqlLicenseIncluded,
                sqlServerInstances: updateSqlServerInstancesForBothNodes(
                    instanceRow?.data,
                    partnerInstanceData?.data,
                    inventoryRow
                ),
                // For explore savings
                ebsResourceInfo,
                clusterNodeDetails: instanceRow?.data?.clusterNodeDetails
            };
        } else {
            const allocatedCapacity = getMergedAllocatedCapacity([instanceRow?.data]);
            const ec2Details = getEc2DetailsForUnmanagedHost(instanceRow, inventoryRow);
            result = {
                ...inventoryRow,
                name: inventoryRow?.name || instanceRow?.data?.name,
                isManagedHost: instanceRow?.isManagedHost,
                loading: instanceRow?.loading,
                ec2Details: ec2Details?.length > 0 ? ec2Details : inventoryRow?.ec2Details,
                estimatedUsageCost: instanceRow?.data?.estimatedUsageCost,
                totalCost: getTotalCost(instanceRow?.data?.estimatedUsageCost || {}),
                allocatedCapacity,
                allocatedCapacityText: allocatedCapacity ? formatSizeTwoPrecision(allocatedCapacity) : '',
                hasInstanceData: false,
                sqlLicenseIncluded: instanceRow?.data?.sqlLicenseIncluded,
                sqlServerInstances: updateSqlServerInstancesForUnmanaged(
                    instanceRow?.data,
                    inventoryRow,
                    instanceRow?.isManagedHost
                ),
                // For explore savings
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
    const updatedState = store.getState();
    const { mssqlInstancesData }: any = updatedState?.inventoryV2;
    return mssqlInstancesData?.[partnerInstanceId];
};

export const mergeEstimatedCost = (instanceData: any, partnerInstanceData: any) => {
    let fsxnCost = 0;
    let fsxwCost = 0;
    const uniqueFsxnId: Array<string> = [];
    const uniqueFsxwId: Array<string> = [];
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
    const estimatedUsageCost = {
        compute:
            (instanceData?.data?.estimatedUsageCost?.compute || 0) +
            (partnerInstanceData?.data?.estimatedUsageCost?.compute || 0),
        storage: {
            fsxw:
                fsxwCost ||
                (instanceData?.data?.estimatedUsageCost?.storage?.fsxw || 0) +
                    (partnerInstanceData?.data?.estimatedUsageCost?.storage?.fsxw || 0),
            fsxn:
                fsxnCost ||
                (instanceData?.data?.estimatedUsageCost?.storage?.fsxn || 0) +
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
    const instanceEbsData = instanceRow?.data?.ebsResourceInfo || [];
    const partnerInstanceEbsData = partnerInstanceData?.data?.ebsResourceInfo || [];
    return [...instanceEbsData, ...partnerInstanceEbsData];
};

export const getMergedAllocatedCapacity = (nodeList: Array<ManagedHostsRowInterface | undefined>) => {
    let fsxnCapacity = 0;
    let fsxwCapacity = 0;
    let ebsCapacity = 0;
    const uniqueFsxnId: Array<string> = [];
    const uniqueFsxwId: Array<string> = [];
    const uniqueVolId: Array<string> = [];
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

    const allocatedCapacity = fsxnCapacity + fsxwCapacity + ebsCapacity;
    return allocatedCapacity;
};

export const getEc2DetailsForUnmanagedHost = (
    instanceRow: InstancesObjectInterface,
    inventoryRow: InventoryTableData
) => {
    let ec2Details: Array<EC2DetailsInterface> = [];
    let instanceId = '';
    if (inventoryRow?.hostType === DBType.POSTGRESQL) {
        instanceId = inventoryRow?.ec2InstanceId || '';
        ec2Details.push({
            id: inventoryRow?.ec2InstanceId || '',
            name: inventoryRow?.ec2InstanceName || '',
            instanceType: inventoryRow?.hostType || ''
        });
    } else if (
        inventoryRow?.ec2Details &&
        inventoryRow?.ec2Details?.length > 1 &&
        !instanceRow?.data?.clusterNodeDetails
    ) {
        instanceId = inventoryRow?.ec2Details?.[0]?.id || '';
        ec2Details = inventoryRow?.ec2Details;
    } else if (instanceRow?.data?.nodeTopology?.ec2Details && instanceRow?.data?.nodeTopology?.ec2Details?.length > 0) {
        instanceId = instanceRow?.data?.nodeTopology?.ec2Details?.[0]?.id || '';
        ec2Details.push(instanceRow?.data?.nodeTopology?.ec2Details?.[0]);
    }
    if (instanceRow?.data?.clusterNodeDetails) {
        if (instanceId) {
            const partnerNode = instanceRow?.data?.clusterNodeDetails?.filter(
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
            const node1 = instanceRow?.data?.clusterNodeDetails?.[0];
            const node2 = instanceRow?.data?.clusterNodeDetails?.[1];
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
                (per: DatabaseInstancesSummaryInterface) =>
                    (per?.databaseInstanceName ?? '').toLowerCase() ===
                    (instRow?.databaseInstanceName ?? '').toLowerCase()
            );
            const perRowNodeStatus = instanceData?.databaseInstanceDetails?.find(
                (per: DatabaseInstanceDetailsInterface) =>
                    (per?.instanceName ?? '').toLowerCase() === (instRow?.databaseInstanceName ?? '').toLowerCase()
            );
            const perRowPartner = partnerData?.databaseInstancesSummary?.find(
                (per: DatabaseInstancesSummaryInterface) =>
                    (per?.databaseInstanceName ?? '').toLowerCase() ===
                    (instRow?.databaseInstanceName ?? '').toLowerCase()
            );
            const perRowPartnerStatus = partnerData?.databaseInstanceDetails?.find(
                (per: DatabaseInstanceDetailsInterface) =>
                    (per?.instanceName ?? '').toLowerCase() === (instRow?.databaseInstanceName ?? '').toLowerCase()
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
                allocatedCapacity,
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
            const isAllManaged = instanceData?.databaseInstanceDetails?.every(perRow => !!perRow?.isManaged);
            if (!isAllManaged) {
                nonManagedStatus = getInstanceStatusForMixedCase(instanceData);
                // to call data for mixed case. use in statusColText for unmanaged case
            }
        }
        instanceRows = instanceRows?.map((instRow: InventoryTableInstanceDatInterface) => {
            if (instRow?.statusColText !== INVENTORY_STATUS.MANAGED) {
                const perRow = instanceData?.databaseInstancesSummary?.find(
                    (per: DatabaseInstancesSummaryInterface) =>
                        (per?.databaseInstanceName ?? '').toLowerCase() ===
                        (instRow?.databaseInstanceName ?? '').toLowerCase()
                );
                const statusObj = nonManagedStatus?.filter(
                    (per: StatusObjInterface) =>
                        per?.name?.toLowerCase() === instRow?.databaseInstanceName?.toLowerCase()
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
                    allocatedCapacity,
                    allocatedCapacityText: allocatedCapacity ? formatSizeTwoPrecision(allocatedCapacity) : '',
                    databaseServer: instRow?.databaseServer || perRow?.databaseServer,
                    statusColText:
                        isManagedHost && statusObj?.[0]?.status ? statusObj?.[0]?.status : instRow?.statusColText,
                    fileSystemDeploymentMode:
                        instRow?.fileSystemDeploymentMode ||
                        getAzType(perRow?.databaseInstanceTopology?.fileSystemDeploymentMode),
                    sqlServerDeploymentType: instRow?.sqlServerDeploymentType || perRow?.sqlServerDeploymentType,
                    isFsxRegistered: instRow?.isFsxRegistered || statusObj?.[0]?.isFsxRegistered,
                    windowsAuthentication: instRow?.windowsAuthentication || statusObj?.[0]?.windowsAuthentication,
                    sqlServerAuthentication:
                        instRow?.sqlServerAuthentication || statusObj?.[0]?.sqlServerAuthentication,
                    windowsDomainUserAuthentication:
                        instRow?.windowsDomainUserAuthentication || statusObj?.[0]?.windowsDomainUserAuthentication
                };
            }
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
        });
    } else if (instanceRows && instanceRows?.length > 0) {
        // To check if manage/unmanage/undetected mixed case
        let nonManagedStatus: any = [];
        if (isManagedHost) {
            const isAllManaged = instanceRows?.every(perRow => perRow?.statusColText === INVENTORY_STATUS.MANAGED);
            if (!isAllManaged) {
                nonManagedStatus = getInstanceStatusForMixedCase(existingInstanceRow);
                // to call data for mixed case. use in statusColText for unmanaged case
            }
            instanceRows = instanceRows?.map((instRow: InventoryTableInstanceDatInterface) => {
                if (instRow?.statusColText !== INVENTORY_STATUS.MANAGED) {
                    const statusObj = nonManagedStatus?.filter(
                        (per: StatusObjInterface) =>
                            per?.name?.toLowerCase() === instRow?.databaseInstanceName?.toLowerCase()
                    );
                    if (statusObj && statusObj?.length > 0) {
                        return {
                            ...statusObj?.[0]?.discoverInstanceData,
                            ...instRow,
                            sqlServerDeploymentType:
                                instRow?.sqlServerDeploymentType ||
                                statusObj?.[0]?.discoverInstanceData?.sqlServerDeploymentType,
                            statusColText:
                                isManagedHost && statusObj?.[0]?.status
                                    ? statusObj?.[0]?.status
                                    : instRow?.statusColText,
                            fsxId: statusObj?.[0]?.fsxId || instRow?.fsxId,
                            isFsxRegistered: statusObj?.[0]?.isFsxRegistered,
                            windowsAuthentication: statusObj?.[0]?.windowsAuthentication,
                            sqlServerAuthentication: statusObj?.[0]?.sqlServerAuthentication,
                            windowsDomainUserAuthentication: statusObj?.[0]?.windowsDomainUserAuthentication
                        };
                    }
                    return {
                        ...instRow
                    };
                }
                return {
                    ...instRow
                };
            });
        }
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
    // perfMssqlInstancesData - This is used for MSSQL as we get MSSQL protection and perf data seperately
    // pgsqlInstancesData - This is used for PGSQL as we get PGSQL protection and perf data together with cost
    // Will handle oracle also
    const { perfMssqlInstancesData, pgsqlInstancesData, oracleInstancesData } = updatedState.inventoryV2;
    const uniqueInstanceId = uniqueHostRow(instanceId, credentialId, regionId);
    const uniquePartnerId = uniqueHostRow(partnerId || '', credentialId, regionId);
    let perfData1: any = null;
    let perfData2: any = null;
    let perfData: any = null;
    if (perfMssqlInstancesData?.[uniqueInstanceId] && partnerId && perfMssqlInstancesData?.[uniquePartnerId]) {
        perfData1 = perfMssqlInstancesData?.[uniqueInstanceId];
        perfData2 = perfMssqlInstancesData?.[uniquePartnerId];
    } else if (perfMssqlInstancesData?.[uniqueInstanceId]) {
        perfData = perfMssqlInstancesData?.[uniqueInstanceId];
    } else if (pgsqlInstancesData?.[uniqueInstanceId] && partnerId && pgsqlInstancesData?.[uniquePartnerId]) {
        perfData1 = pgsqlInstancesData?.[uniqueInstanceId];
        perfData2 = pgsqlInstancesData?.[uniquePartnerId];
    } else if (pgsqlInstancesData?.[uniqueInstanceId]) {
        perfData = pgsqlInstancesData?.[uniqueInstanceId];
    } else if (oracleInstancesData?.[uniqueInstanceId]) {
        perfData = oracleInstancesData?.[uniqueInstanceId];
    }
    if (perfData1 && partnerId && perfData2) {
        const perRow1 = perfData1?.data?.databaseInstancesSummary?.find(
            (per: DatabaseInstancesSummaryInterface) =>
                (per?.databaseInstanceName ?? '').toLowerCase() === (instRow?.databaseInstanceName ?? '').toLowerCase()
        );
        const perRow2 = perfData2?.data?.databaseInstancesSummary?.find(
            (per: DatabaseInstancesSummaryInterface) =>
                (per?.databaseInstanceName ?? '').toLowerCase() === (instRow?.databaseInstanceName ?? '').toLowerCase()
        );
        if (perRow1 || perRow2) {
            return {
                loading: false,
                protection: perRow1?.protection || perRow2?.protection,
                performance: perRow1?.performance || perRow2?.performance
            };
        }
        if (perfData1?.loading || perfData2?.loading) {
            return {
                loading: true,
                protection: null,
                performance: null
            };
        }
        return {
            loading: false,
            protection: null,
            performance: null
        };
    }
    if (perfData) {
        if (perfData?.loading) {
            return {
                loading: true,
                protection: null,
                performance: null
            };
        }
        if (perfData?.data?.databaseInstancesSummary && perfData?.data?.databaseInstancesSummary?.length > 0) {
            const perRow = perfData?.data?.databaseInstancesSummary?.find(
                (per: DatabaseInstancesSummaryInterface) =>
                    (per?.databaseInstanceName ?? '').toLowerCase() ===
                    (instRow?.databaseInstanceName ?? '').toLowerCase()
            );
            return {
                loading: false,
                protection: perRow?.protection,
                performance: perRow?.performance
            };
        }
        return {
            loading: false,
            protection: null,
            performance: null
        };
    }
};

export const getExploreSavingsRows = (inventoryTableData: { [key: string]: InventoryTableData }) => {
    // If ES row is disabled than it should come in inventory but not in explore savings table
    const nonFsxnStorageList: Array<InventoryTableData> = [];
    const state = store.getState();
    const { removeSecNodeDiscoveredList } = state.inventoryV2;
    Object.keys(inventoryTableData).map((key: string) => {
        const item = inventoryTableData[key];
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
    const updatedState = store.getState();
    const { inventoryTableData }: any = updatedState?.inventoryV2;

    let targettedHostIdVal = inventoryTableData?.[
        uniqueHostRow(hostData?.resourceId, hostData?.credentialId, hostData?.regionId)
    ]
        ? hostData?.resourceId
        : inventoryTableData?.[uniqueHostRow(hostData?.ec2InstanceId, hostData?.credentialId, hostData?.regionId)]
        ? hostData?.ec2InstanceId
        : '';
    if (!targettedHostIdVal) {
        Object.keys(inventoryTableData).map((perObj: any) => {
            const item = inventoryTableData[perObj];
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
            resourceId: inventoryTableData[targettedHostId]?.resourceId || resourceId,
            sqlServerInstances: inventoryTableData[targettedHostId].sqlServerInstances.map((instanceItem: any) => {
                const instanceInRes = responseData.find(
                    (item: any) => item?.databaseInstanceName === instanceItem?.databaseInstanceName
                );
                if (instanceInRes?.databaseInstanceName) {
                    return {
                        ...instanceItem,
                        resourceId,
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
    const updatedState = store.getState();
    const { inventoryTableData }: any = updatedState?.inventoryV2;
    const updatedInventoryTableData = { ...inventoryTableData };

    response?.map((hostData: any) => {
        const successFullInstances: any = [];
        const failedInstances = [];
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
                const item = inventoryTableData[perObj];
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
    const {
        detectManageUserName,
        detectManagePassword,
        detectWindowsAuthentication,
        detectOntapUsername,
        detectOntapPassword,
        authenticationType
    } = state.inventoryV2;

    // Checks if the respective authentication fields are present
    const isSqlAuthValid = () => !!(detectManageUserName && detectManagePassword);
    const isWindowsAuthValid = () => !!(detectWindowsAuthentication?.username && detectWindowsAuthentication?.password);
    const isFsxAuthValid = () => !!(detectOntapUsername && detectOntapPassword);

    // Check when neither SQL Server nor Windows Domain User is authenticated and FsxId is not registered
    if (
        !entryData?.sqlServerAuthentication &&
        !entryData?.windowsAuthentication &&
        !entryData?.windowsDomainUserAuthentication &&
        entryData?.fsxId &&
        !entryData?.isFsxRegistered
    ) {
        // Based on authentication type is SQL Server or Windows, check if the respective fields are valid
        if (authenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION) {
            return isSqlAuthValid() && isFsxAuthValid();
        }
        if (authenticationType === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION) {
            return isWindowsAuthValid() && isFsxAuthValid();
        }
        return false;
    }
    // Check if SQL Server fields are valid when SQL Server Authentication is selected
    if (
        !entryData?.sqlServerAuthentication &&
        !entryData?.windowsAuthentication &&
        !entryData?.windowsDomainUserAuthentication &&
        authenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
    ) {
        return isSqlAuthValid();
    }
    // Check if Windows fields are valid when Windows Authentication is selected
    if (
        !entryData?.windowsAuthentication &&
        !entryData?.sqlServerAuthentication &&
        !entryData?.windowsDomainUserAuthentication &&
        authenticationType === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION
    ) {
        return isWindowsAuthValid();
    }
    if (entryData?.fsxId && !entryData?.isFsxRegistered) {
        if (detectOntapUsername && detectOntapPassword) {
            return true;
        }
        return false;
    }
};

export const getDiscoveredHostDeploymentV2 = (host: any) => {
    // This will get deployment type in case of unmanaged hosts
    const deploymentType =
        host?.sqlServerDeploymentType || host?.oracleServerDeploymentType || host?.pgsqlServerDeploymentType || '';
    let type = '';

    if (deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG) {
        type = GENERAL.AOAG;
    } else if (deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE) {
        type = GENERAL.FAILOVER_CLUSTER_INSTANCES;
    } else if (deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
        type = GENERAL.STANDALONE;
    } else if (deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.HA) {
        type = GENERAL.HA;
    } else {
        type = deploymentType;
    }
    return type;
};

export const saveFsxInCredRegisteredObj = (fsxId: string, dispatch: any) => {
    const state = store.getState();
    const { fsxCredentialStatusObj, detectOntapUsername, detectOntapPassword } = state?.inventoryV2;
    if (detectOntapUsername && detectOntapPassword && fsxId) {
        dispatch(
            setFsxCredentialStatus({
                ...fsxCredentialStatusObj,
                [fsxId]: true
            })
        );
        return true;
    }
    return false;
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
    } else if (successfullInstances.length === 0) {
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
};

export const getPartnerInstanceId = (instanceRow: InstancesHostsRowInterface, instanceId: string) => {
    let partnerInstanceId: string = '';
    if (instanceRow?.clusterNodeDetails) {
        if (instanceId) {
            const partnerNode = instanceRow?.clusterNodeDetails?.filter(
                perInst => perInst?.ec2InstanceId !== instanceId
            );
            if (partnerNode && partnerNode?.length > 0) {
                partnerInstanceId = partnerNode[0]?.ec2InstanceId || '';
            }
        }
    }
    return partnerInstanceId;
};

export const isAwsBackupEnabledText = (val: any, fsxType: string) => {
    const awsProtection = val?.protection?.isAwsBackupEnabled;
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
    } else if (
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

    return protectionText;
};

export const getFileSystemName = (data: any) => data?.fileSystemName && data.fileSystemName !== GENERAL.NOT_AVAILABLE ? data.fileSystemName : '';

export const getProtectionText = (data: any) => {
    let protectionText = '';
    let fsxType = '';
    const fileSystemType = data?.fileSystemType || '';
    if (fileSystemType.includes(GENERAL.FSX_FOR_ONTAP)) {
        fsxType = 'fsxn';
    } else if (fileSystemType.includes(GENERAL.FSX_FOR_WINDOWS)) {
        fsxType = 'fsxw';
    } else if (fileSystemType.includes(GENERAL.EBS)) {
        fsxType = 'ebs';
    }

    const awsBackupEnabled = isAwsBackupEnabledText(data, fsxType);
    const fsxOntapEnabled = data?.protection?.isFsxOntapSnapshotsEnabled;
    const sqlNativeEnabled = data?.protection?.isSqlNativeEnabled;

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
    } else if (
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

    return protectionText;
};

export const getOptimizationStatus = (
    databaseInstanceId: string,
    optimizationStatusList: Array<HostAssessmentResponseInterface>
) => {
    if (!optimizationStatusList) {
        return '';
    }
    const instanceRow = optimizationStatusList?.find(per => per?.databaseInstanceId === databaseInstanceId);
    let optimizationStatus = '';
    if (instanceRow && instanceRow?.assessments && instanceRow?.assessments?.lastAssessmentTimestamp) {
        const { cardsData } = getCardsData(instanceRow?.assessments, {});
        const optBreakDown = formatOptimizationBreakDown(cardsData);
        optimizationStatus =
            optBreakDown?.total?.notOptimized !== 0
                ? optBreakDown?.total?.notOptimized === 1
                    ? `${optBreakDown?.total?.notOptimized} issues`
                    : `${optBreakDown?.total?.notOptimized} issues`
                : ACTION_CTA.WELL_ARCHITECTED;
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
    const { unManagedPerfInstanceIdsList } = state.inventoryV2;
    if (
        !unManagedPerfInstanceIdsList.includes(
            uniqueHostRow(rowData?.ec2InstanceId, rowData?.credentialId, rowData?.regionId)
        )
    ) {
        // If this has unmanaged rows or not ?
        const unmanagedRows = rowData?.sqlServerInstances?.filter(
            (per: any) => per?.statusColText === INVENTORY_STATUS.UNMANAGED
        );
        if (unmanagedRows && unmanagedRows?.length > 0 && rowData?.ec2InstanceId) {
            const instanceList = [];
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
        const managedRows = rowData?.sqlServerInstances?.filter(
            (per: any) => per?.statusColText === INVENTORY_STATUS.MANAGED
        );
        if (managedRows && managedRows?.length > 0 && rowData?.resourceId) {
            dispatch(setManagedAssessmentHostIdsList([...managedAssessmentIdsList, rowData?.resourceId]));
        }
    }
};

export const checkForAnyAOAG = (rowData: any) =>
    // If any instance have AOAG than ES is disabled for it
    rowData?.sqlServerInstances?.some(
        (item: any) => item?.sqlServerDeploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG
    );

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
    const storageType: Array<string> = [];
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

export const renderVpcText = (cellData: any, rowData: any, styles: any) => (
    <div className={styles.ec2Container}>
        <div className={styles.ssmOffline}>
            <Popover
                popoverClass=""
                children={
                    <>
                        {rowData?.vpcIdAndNameText && (
                            <div className={styles.tooltipContainer}>
                                <DsTypography variant="Regular_14">{rowData?.vpcIdAndNameText}</DsTypography>
                                <Popover
                                    popoverClass={styles['copy-popover']}
                                    children="Copied"
                                    container={
                                        <CopyToClipboardCommon
                                            value={rowData?.vpcIdAndNameText}
                                            iconProvided={<CopyIcon fill="#A7A7A7" />}
                                        />
                                    }
                                />
                            </div>
                        )}
                    </>
                }
                trigger="hover"
                delayHide={200}
                interactive
                isAppendedToBody={false}
                container={<TooltipIcon />}
            />
        </div>
        <DsTypography variant="Regular_13" className={`${styles.colText}`}>
            {cellData || GENERAL.NOT_AVAILABLE}
        </DsTypography>
    </div>
);

export const renderInstanceListText = (cellData: any, rowData: any, styles: any) => {
    const instanceList: any = cellData ? cellData.split(',') : null;
    return (
        <>
            <div className={styles.ec2Container}>
                <div className={styles.ssmOffline}>
                    <Popover
                        popoverClass=""
                        children={
                            <>
                                {instanceList && instanceList[0] && (
                                    <div className={styles.tooltipContainer}>
                                        <DsTypography variant="Regular_14">{instanceList[0]}</DsTypography>
                                        <Popover
                                            popoverClass={styles['copy-popover']}
                                            children="Copied"
                                            container={
                                                <CopyToClipboardCommon
                                                    value={instanceList[0]}
                                                    iconProvided={<CopyIcon fill="#A7A7A7" />}
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
                                                children="Copied"
                                                container={
                                                    <CopyToClipboardCommon
                                                        value={instanceList[1]}
                                                        iconProvided={<CopyIcon fill="#A7A7A7" />}
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
                        interactive
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
            {initialMsg[3]}
        </div>
    );
    dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.INFO, message: prepareHostMsg }));
};

export const renderUnmanagedAZ = (cellData: string, rowData: any, styles: any) => {
    let azList = '';
    let deploymentType = '';

    for (const instance of rowData?.sqlServerInstances || []) {
        for (const deployment of instance?.deploymentTypes || []) {
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

export const renderCellData = (cellData: any, rowData: any, styles: any) => (
    <>
        {cellData && (
            <DsTypography variant="Regular_13" className={styles.colText} title={cellData}>
                {cellData}
            </DsTypography>
        )}
        {!cellData && rowData?.loading && <DsFlashingDotsLoader />}
        {!cellData && cellData !== 0 && !rowData?.loading && GENERAL.NOT_AVAILABLE}
    </>
);

export const renderEstimatedCost = (cellData: any, rowData: any, styles: any) => {
    const costData = rowData?.estimatedUsageCost;
    const totalCost = +rowData?.totalCost;
    return (
        <>
            {costData && !rowData?.loading && (
                <div className={styles.cost}>
                    <TooltipInfo className={styles.tooltipClass} onVisibleChange={function noRefCheck() {}}>
                        {EstimatedCostPopover({ ...costData, totalCost })}
                    </TooltipInfo>
                    <DsTypography variant="Regular_14">{`$${formatFractionalNumber(totalCost, 2)}`}</DsTypography>
                </div>
            )}
            {rowData?.loading && <DsFlashingDotsLoader />}
            {!costData && !rowData?.loading && GENERAL.NOT_AVAILABLE}
        </>
    );
};

export const renderAllocatedCapacity = (cellData: any, rowData: any) => (
    <>
        {!rowData?.loading && (cellData || cellData === 0 ? cellData : GENERAL.NOT_AVAILABLE)}
        {rowData?.loading && <DsFlashingDotsLoader />}
    </>
);

export const handleBulkPrepareCall = (response: any, dispatch: any, styles: any, prepareHostApi: any) => {
    let triggeredPrepare = false;
    response?.map((resource: any) => {
        const errorList = resource?.hostErrorMessage?.split('\n');
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

export const manageActionCol = (translation: TFunction, rowData?: any) => {
    let colText = '';
    let disableMsg = '';
    if (
        rowData?.statusColText === INVENTORY_STATUS.MANAGED ||
        rowData?.managementStatus === INVENTORY_STATUS.IN_PROGRESS
    ) {
        if (rowData?.optimizationStatus === ACTION_CTA.WELL_ARCHITECTED) {
            colText = ACTION_CTA.WELL_ARCHITECTED;
        } else {
            colText = ACTION_CTA.FIX_ISSUES;
        }
    } else {
        colText = ACTION_CTA.MANAGE_INSTANCES;
    }

    if (rowData?.status === INVENTORY_STATUS.OFFLINE) {
        disableMsg = GENERAL.HOST_DOWN;
    } else if (rowData?.ssmState === INVENTORY_STATUS.OFFLINE) {
        disableMsg = GENERAL.SSM_DOWN;
    } else if (rowData?.status?.toLowerCase() === INVENTORY_STATUS.DOWN) {
        disableMsg = GENERAL.SQL_SERVER_INSTANCE_DOWN;
    } else if (rowData?.hostType === GENERAL.POSTGRESQL_TYPE || rowData?.hostType === GENERAL.ORACLE_TYPE) {
        disableMsg = GENERAL.PGSQL_CTA_NA;
    } else if (rowData?.detectOption === DETECT_HOST_VAR.DISABLE || rowData?.detectOption === DETECT_HOST_VAR.HIDE) {
        disableMsg = rowData?.detectOptionDisableMsg;
    } else if (
        rowData?.statusColText === INVENTORY_STATUS.UNMANAGED &&
        rowData.fileSystemType !== GENERAL.FSX_FOR_ONTAP &&
        !rowData?.fsxId
    ) {
        disableMsg = GENERAL.FSXN_MANAGE_SUPPORTED;
    } else if (
        rowData?.serverInstallationMode === GENERAL.AOAG &&
        rowData?.statusColText === INVENTORY_STATUS.UNMANAGED
    ) {
        disableMsg = GENERAL.AOAG_MANAGE_DISABLE;
    }

    if (colText === ACTION_CTA.FIX_ISSUES || colText === ACTION_CTA.WELL_ARCHITECTED) {
        disableMsg = fixIssueDisableMsg(rowData, translation);
    }
    return {
        colText,
        disableMsg
    };
};

export const fixIssueDisableMsg = (rowData: any, translation: TFunction) => {
    let disableMsg = '';
    if (rowData?.hostType === DBType.POSTGRESQL) {
        disableMsg = GENERAL.NON_MSSQL_ASSESSMENT_NA;
        return disableMsg;
    }
    if (rowData?.hostType === DBType.ORACLE) {
        disableMsg = translation('databases.general.coming-soon');
        return disableMsg;
    }
    if (
        rowData?.status === INVENTORY_STATUS.OFFLINE ||
        rowData?.ssmState === INVENTORY_STATUS.OFFLINE ||
        rowData?.status?.toLowerCase() === INVENTORY_STATUS.DOWN ||
        rowData?.status === INVENTORY_STATUS.STOPPED
    ) {
        disableMsg = GENERAL.ONLINE_INSTANCE_ASSESS;
        return disableMsg;
    }
    if (
        (rowData?.statusColText === INVENTORY_STATUS.UNMANAGED ||
            rowData?.statusColText === INVENTORY_STATUS.UNDETECTED) &&
        (!rowData.fileSystemType || rowData?.fileSystemType?.toLowerCase() === GENERAL.NOT_AVAILABLE)
    ) {
        disableMsg = GENERAL.ASSESSMENT_STORAGE_TYPE_UNKNOWN;
        return disableMsg;
    }
    if (
        (rowData?.statusColText === INVENTORY_STATUS.UNMANAGED ||
            rowData?.statusColText === INVENTORY_STATUS.UNDETECTED) &&
        (rowData.fileSystemType === GENERAL.EBS || rowData.fileSystemType === GENERAL.FSX_FOR_WINDOWS)
    ) {
        disableMsg = GENERAL.FSXN_OPTIMIZE_SUPPORTED;
        return disableMsg;
    }
    if (
        rowData?.serverInstallationMode === GENERAL.AOAG &&
        rowData.fileSystemType &&
        rowData.fileSystemType.includes(GENERAL.FSX_FOR_ONTAP)
    ) {
        if (rowData?.statusColText === INVENTORY_STATUS.UNMANAGED) {
            disableMsg = GENERAL.ASSESSMENT_AOAG_DETECTED;
            return disableMsg;
        }
        if (rowData?.statusColText === INVENTORY_STATUS.UNDETECTED) {
            disableMsg = GENERAL.ASSESSMENT_AOAG_UNDETECTED;
            return disableMsg;
        }
    }
    if (rowData.fileSystemType && rowData.fileSystemType.includes(GENERAL.FSX_FOR_ONTAP)) {
        if (
            rowData?.statusColText === INVENTORY_STATUS.UNMANAGED ||
            rowData?.statusColText === INVENTORY_STATUS.IN_PROGRESS
        ) {
            disableMsg = GENERAL.ASSESSMENT_FOR_MANAGE;
            return disableMsg;
        }
        if (rowData?.statusColText === INVENTORY_STATUS.UNDETECTED) {
            disableMsg = GENERAL.ASSESSMENT_FOR_UNDETECTED_FSXN;
            return disableMsg;
        }
    }
    return disableMsg;
};

const callDeleteHost = async (
    addHostJobScApi: any,
    dispatch: any,
    translation: any,
    hostId: string,
    deleteHostSc: any
) => {
    const state: any = store.getState().snapCenter;
    const deleteHostRes = await deleteHostSc({
        accountID: store.getState().auth.accountId,
        hostId,
        agentID: state.selectedAgent[0]?.id,
        workspaceID: state?.workSpaceData?.id
    });

    // Here job starts
    if (deleteHostRes?.data?.jobId) {
        const { jobId } = deleteHostRes.data;

        await deleteHostJobPolling(addHostJobScApi, jobId, dispatch, translation);
    }
};

const errorMsgCall = (dispatch: any, errorMsg: string, errorMsgTooltip: string) => {
    dispatch(setActionsDisabled(false));
    dispatch(
        setDialogErrorWithTooltip({
            showDialogError: true,
            errorMessage: errorMsg,
            showTooltipInfo: true,
            tooltipText: errorMsgTooltip
        })
    );
};

export const getDiscoverResult = (
    accountID: string,
    hostName: string,
    agentID: string,
    workspaceID: string,
    getDiscoverHostResult: any
): Promise<number> =>
    new Promise(resolve => {
        let retries = 0;
        const maxRetries = 15;
        const interval = 10000;

        const check = async () => {
            try {
                const result = await getDiscoverHostResult({
                    accountID,
                    hostName,
                    agentID,
                    workspaceID
                });

                if (result?.error) {
                    clearInterval(intervalId);
                    resolve(0);
                    return;
                }

                const totalCount = result?.totalCount ?? result?.data?.totalCount ?? 0;

                if (totalCount > 0) {
                    clearInterval(intervalId);
                    resolve(totalCount);
                } else {
                    retries++;
                    if (retries >= maxRetries) {
                        clearInterval(intervalId);
                        resolve(0);
                    }
                }
            } catch {
                clearInterval(intervalId);
                resolve(0);
            }
        };

        // 👇 Call immediately
        check();

        // 👇 Then setup polling
        const intervalId = setInterval(check, interval);
    });

export const addHostJobPolling = async (
    addHostJobScApi: any,
    jobId: string,
    dispatch: any,
    dialogKey: string,
    translation: any,
    deleteHostSc: any,
    listAllDirectories: any,
    configureDirectory: any,
    getDiscoverHostResult: any,
    fqdn: string
) => {
    let step1Done = false;
    const firstStepName = 'Validate Host';
    const secondStepName = 'Package Installation';
    let hasCalledDeleteHost = false;
    let isProcessing = false;
    const jobInterval = setInterval(async () => {
        if (isProcessing) return;
        isProcessing = true;
        try {
            const jobRes = await addHostJobScApi({
                accountID: store.getState().auth.accountId,
                jobID: jobId
            });
            const status = jobRes?.data?.status;
            if (status === JOB_MONITORING_STATUS.FAILED) {
                let errorMsg = '';
                if (jobRes?.data?.subJobs) {
                    jobRes.data.subJobs.forEach((subJob: { name?: string }) => {
                        if (subJob?.name?.includes(firstStepName) && status === JOB_MONITORING_STATUS.FAILED) {
                            errorMsg = translation('databases.inventory.validate-host-failed');
                        } else if (subJob?.name?.includes(secondStepName) && status === JOB_MONITORING_STATUS.FAILED) {
                            errorMsg = translation('databases.inventory.package-installation-failed');
                        }
                    });
                }
                if (errorMsg) {
                    dispatch(
                        setDialogErrorWithTooltip({
                            showDialogError: true,
                            errorMessage: errorMsg,
                            showTooltipInfo: true,
                            tooltipText: errorMsg
                        })
                    );
                }
                clearInterval(jobInterval);
            } else {
                let errorMsg = '';
                let errorMsgTooltip = '';
                const subJobs = jobRes?.data?.subJobs || [];

                for (const subJob of subJobs) {
                    if (subJob?.name?.includes(firstStepName) && subJob?.status === JOB_MONITORING_STATUS.FAILED) {
                        errorMsg = translation('databases.inventory.validate-host-failed');
                        errorMsgTooltip = subJob?.error || translation('databases.inventory.validate-host-failed');
                        dispatch(resetProtectionProcess(dialogKey));

                        errorMsgCall(dispatch, errorMsg, errorMsgTooltip);
                        clearInterval(jobInterval);
                        return;
                    }
                    if (
                        subJob?.name?.includes(firstStepName) &&
                        subJob?.status === JOB_MONITORING_STATUS.COMPLETED &&
                        !step1Done
                    ) {
                        dispatch(completeProtectionStep1(dialogKey));
                        step1Done = true;
                    }
                    if (
                        !hasCalledDeleteHost &&
                        subJob?.name?.includes(secondStepName) &&
                        subJob?.status === JOB_MONITORING_STATUS.FAILED
                    ) {
                        hasCalledDeleteHost = true;
                        // calling delete host api to remove the stale entry
                        await callDeleteHost(addHostJobScApi, dispatch, translation, subJob?.data?.host, deleteHostSc);

                        errorMsg = translation('databases.inventory.package-installation-failed');
                        errorMsgTooltip =
                            subJob?.error || translation('databases.inventory.package-installation-failed');
                        dispatch(resetProtectionProcess(dialogKey));

                        errorMsgCall(dispatch, errorMsg, errorMsgTooltip);
                        clearInterval(jobInterval);
                        return;
                    }
                    if (
                        subJob?.name?.includes(secondStepName) &&
                        subJob?.status === JOB_MONITORING_STATUS.COMPLETED &&
                        step1Done
                    ) {
                        const state: any = store.getState().snapCenter;
                        const accountID = store.getState().auth.accountId;
                        const hostName = fqdn;
                        const agentID = state.selectedAgent[0]?.id;
                        const workspaceID = state?.workSpaceData?.id;
                        try {
                            const discoverCount = await getDiscoverResult(
                                accountID,
                                hostName,
                                agentID,
                                workspaceID,
                                getDiscoverHostResult
                            );

                            if (discoverCount > 0) {
                                const dirRes = await listAllDirectories({
                                    accountID,
                                    hostID: subJob?.data?.host,
                                    agentID,
                                    workspaceID
                                });
                                if (dirRes?.error) {
                                    dispatch(
                                        addNotification({
                                            notificationType: NOTIFICATION_TYPES.ERROR,
                                            message: dirRes?.error?.data || 'Failed to fetch directories'
                                        })
                                    );
                                } else {
                                    const diskList = dirRes?.diskInfos || dirRes?.data?.diskInfos || [];
                                    if (diskList && diskList?.length > 0) {
                                        const payload = {
                                            logbackupFolder: diskList?.[0]?.path || ''
                                        };
                                        await configureDirectory({
                                            accountID,
                                            hostID: subJob?.data?.host,
                                            payload,
                                            agentID,
                                            workspaceID
                                        });
                                    }
                                }
                            }

                            dispatch(completeProtectionStep2(dialogKey));
                        } catch {
                            dispatch(completeProtectionStep2(dialogKey));
                        } finally {
                            clearInterval(jobInterval);
                        }
                    }
                }
            }
        } catch (error) {
            clearInterval(jobInterval);
        } finally {
            isProcessing = false;
        }
    }, SC_JOB_INTERVAL);
};

export const deleteHostJobPolling = (
    addHostJobScApi: any,
    jobId: string,
    dispatch: any,
    translation: any
): Promise<'SUCCESS' | 'FAILED'> =>
    new Promise(resolve => {
        const jobInterval = setInterval(() => {
            addHostJobScApi({
                accountID: store.getState().auth.accountId,
                jobID: jobId
            })
                .then((jobRes: any) => {
                    const status = jobRes?.data?.status;

                    if (status === JOB_MONITORING_STATUS.FAILED) {
                        clearInterval(jobInterval);
                        dispatch(
                            addNotification({
                                notificationType: NOTIFICATION_TYPES.ERROR,
                                message: jobRes?.data?.error || translation('databases.inventory.delete-host-failed')
                            })
                        );
                        resolve('FAILED');
                    } else if (status === JOB_MONITORING_STATUS.COMPLETED) {
                        clearInterval(jobInterval);
                        resolve('SUCCESS');
                    }
                    // else still polling
                })
                .catch(() => {
                    clearInterval(jobInterval);
                    resolve('FAILED');
                });
        }, SC_JOB_INTERVAL);
    });

const errorMapping = (error: string, rowData: any) => {
    if (error.includes("Cannot read properties of undefined (reading 'includes')")) {
        return `The host ${rowData.name} already exists.`;
    }
    return error;
};

// Function to handle Add host
export const addHostHandlerSc = async (
    rowData: any,
    dispatch: any,
    generateCredentialID: any,
    addHostScApi: any,
    addHostJobScApi: any,
    translation: any,
    deleteHostSc: any,
    listAllDirectories: any,
    configureDirectory: any,
    getDiscoverHostResult: any
) => {
    dispatch(setActionsDisabled(true));
    dispatch(
        startProtectionStep1(
            `${rowData.databaseInstanceName}_${rowData.name}_${rowData.credentialId}_${rowData.regionId}`
        )
    );
    const dialogKey = `${rowData.databaseInstanceName}_${rowData.name}_${rowData.credentialId}_${rowData.regionId}`;
    const state: any = store.getState().snapCenter;
    const payload = {
        connectorId: state.selectedAgent[0]?.id,
        ec2InstanceIds: [rowData.ec2InstanceId],
        sqlInstanceName: rowData.databaseInstanceName,
        resourceId: rowData.resourceId,
        workspaceId: state?.workSpaceData?.id
    };
    try {
        const credIdResponse = await generateCredentialID({
            credentialID: rowData.credentialId,
            regionID: rowData.regionId,
            payload
        });
        if (credIdResponse?.data?.credentialsId) {
            // Do something with the credentialsId
            const addHostResponse = await addHostScApi({
                accountID: store.getState().auth.accountId,
                payload: {
                    workloadType: 'SQL',
                    hostName: rowData?.hostRow?.nodeIpAddress,
                    credentialsId: credIdResponse?.data?.credentialsId,
                    connectorId: state.selectedAgent[0]?.id,
                    pluginPort: 8145,
                    installPath: 'C:\\Program Files\\NetApp\\SnapCenter',
                    usegMSA: false,
                    useManualInstall: false,
                    addHostsInCluster:
                        rowData?.sqlServerDeploymentType === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE_CAPS,
                    skipPreInstallChecks: false,
                    hostOSType: 'Windows'
                },
                agentID: state.selectedAgent[0]?.id,
                workspaceID: state?.workSpaceData?.id
            });
            if (addHostResponse?.data?.jobId) {
                // Getting job id
                const { jobId } = addHostResponse.data;
                const fqdn = rowData?.hostRow?.fqdn;
                addHostJobPolling(
                    addHostJobScApi,
                    jobId,
                    dispatch,
                    dialogKey,
                    translation,
                    deleteHostSc,
                    listAllDirectories,
                    configureDirectory,
                    getDiscoverHostResult,
                    fqdn
                );
            } else {
                dispatch(resetProtectionProcess(dialogKey));
                dispatch(setActionsDisabled(false));
                dispatch(
                    setDialogErrorWithTooltip({
                        showDialogError: true,
                        errorMessage:
                            addHostResponse?.data?.errorMessage ||
                            errorMapping(addHostResponse?.error?.message, rowData),
                        showTooltipInfo: true,
                        tooltipText:
                            addHostResponse?.data?.errorMessage ||
                            errorMapping(addHostResponse?.error?.message, rowData)
                    })
                );
            }
        } else {
            dispatch(resetProtectionProcess(dialogKey));
            dispatch(setActionsDisabled(false));
        }
    } catch (error) {
        dispatch(resetProtectionProcess(dialogKey));
        dispatch(setActionsDisabled(false));
    }
};

// Helper function to get the computed display value and disable message for Well-architected status
export const getOptimizationStatusData = (rowData: any, t: any) => {
    let disableMsg = '';
    const cellData = rowData.optimizationStatus;

    const getDisableMessage = () => {
        if (rowData?.hostType === GENERAL.POSTGRESQL_TYPE || rowData?.hostType === GENERAL.ORACLE_TYPE) {
            return GENERAL.NON_MSSQL_ASSESSMENT_NA;
        }
        if (
            rowData?.status === INVENTORY_STATUS.OFFLINE ||
            rowData?.ssmState === INVENTORY_STATUS.OFFLINE ||
            rowData?.status?.toLowerCase() === INVENTORY_STATUS.DOWN ||
            rowData?.status === INVENTORY_STATUS.STOPPED
        ) {
            return GENERAL.ONLINE_INSTANCE_ASSESS;
        }

        if (
            (rowData?.statusColText === INVENTORY_STATUS.UNMANAGED ||
                rowData?.statusColText === INVENTORY_STATUS.UNDETECTED) &&
            (!rowData.fileSystemType || rowData?.fileSystemType?.toLowerCase() === GENERAL.NOT_AVAILABLE)
        ) {
            return GENERAL.ASSESSMENT_STORAGE_TYPE_UNKNOWN;
        }

        if (
            (rowData?.statusColText === INVENTORY_STATUS.UNMANAGED ||
                rowData?.statusColText === INVENTORY_STATUS.UNDETECTED) &&
            (rowData.fileSystemType === GENERAL.EBS || rowData.fileSystemType === GENERAL.FSX_FOR_WINDOWS)
        ) {
            return GENERAL.FSXN_OPTIMIZE_SUPPORTED;
        }

        if (
            rowData?.serverInstallationMode === GENERAL.AOAG &&
            rowData.fileSystemType &&
            rowData.fileSystemType.includes(GENERAL.FSX_FOR_ONTAP)
        ) {
            if (rowData?.statusColText === INVENTORY_STATUS.UNMANAGED) {
                return GENERAL.ASSESSMENT_AOAG_DETECTED;
            }
            if (rowData?.statusColText === INVENTORY_STATUS.UNDETECTED) {
                return GENERAL.ASSESSMENT_AOAG_UNDETECTED;
            }
        }

        if (rowData.fileSystemType && rowData.fileSystemType.includes(GENERAL.FSX_FOR_ONTAP)) {
            if (
                rowData?.statusColText === INVENTORY_STATUS.UNMANAGED ||
                rowData?.statusColText === INVENTORY_STATUS.IN_PROGRESS
            ) {
                return GENERAL.ASSESSMENT_FOR_MANAGE;
            }
            if (rowData?.statusColText === INVENTORY_STATUS.UNDETECTED) {
                return GENERAL.ASSESSMENT_FOR_UNDETECTED_FSXN;
            }
        }

        if ((!cellData && !rowData?.optimizationStatusLoading) || cellData === INVENTORY_STATUS.IN_PROGRESS) {
            return t('databases.well-architect.assessment-in-progress');
        }
        return '';
    };

    disableMsg = getDisableMessage();

    if (disableMsg) {
        return { displayValue: 'Not analyzed', disableMsg, isDisabled: true };
    }
    return { displayValue: cellData || GENERAL.NOT_AVAILABLE, disableMsg: '', isDisabled: false };
};

export const getDeregisterContent = (rowData: any, t: TFunction) => {
    if (rowData?.hostType === DBType.MSSQL) {
        return t('databases.deregister-flow.mssql');
    }
    if (rowData?.hostType === DBType.ORACLE) {
        return t('databases.deregister-flow.oracle');
    }
    return t('databases.deregister-flow.mssql');
};
