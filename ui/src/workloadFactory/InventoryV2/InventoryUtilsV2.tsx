import { Button, DsFlashingDotsLoader, DsTypography, Popover, TooltipInfo } from '@netapp/design-system';
import { TFunction } from 'i18next';
import { BlueXPListeners, postBlueXPMessage } from '@tlveng/wlm-ds/src/hooks/useBlueXP';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../store/notificationSlice';
import store from '../../store/store';
import {
    setManagedAssessmentHostIdsList,
    setSelectedHeaderTab,
    setUnManagedPerfInstanceIdsList,
    setUnManagedInstanceIdsList
} from '../../store/workloadFactory/inventoryV2Slice';
import { GENERAL } from '../../utils/appConstants';
import {
    ACTION_CTA,
    DATABASE_DEPLOYMENT_MODE,
    DBType,
    DEMO_MODE_PROTECTION_CRITERIA,
    DETECT_HOST_VAR,
    ERROR_ANALYZER_STATUS,
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM,
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING,
    INVENTORY_ACTIONS,
    INVENTORY_STATUS,
    JOB_MONITORING_STATUS,
    ORACLE_DATABASES_COMPONENTS,
    PARTNER_NODE,
    PREPARE_API_ENDPOINT,
    PROTECTION_TEXT_STATUS,
    REPLICA_ROLES,
    SC_JOB_INTERVAL,
    SQL_DEPLOYMENT_MODE,
    STATUS_CONST,
    STORAGE_TYPES,
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
import {
    formatOracleOptimizationBreakDown,
    getOracleCardsData
} from '../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils';
import { isAuthRequiredForInstance } from './InventoryTablesComponent/ManageInstanceWizard/DetectInstanceStep/DetectContent/DetectContentHelper';

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

/**
 * Formats offline assessment data (WAD data) to match the InventoryTableData structure.
 * This data comes from the getAllOfflineMssqlHostsAssessmentData API.
 * All data is marked with isWad: true to indicate it's offline assessment data.
 *
 * New API structure: Each item in the array is a single instance with flat structure:
 * { resourceId, databaseInstanceId, databaseInstanceName, credentialsId, region, regionName,
 *   vmName, virtualNetworkId, virtualNetworkName, clusterNodes, assessments }
 * Items are grouped by resourceId + vmName to create host entries.
 */
export const formatOfflineAssessmentToInventoryData = (offlineData: any[]): { [key: string]: InventoryTableData } => {
    const result: { [key: string]: InventoryTableData } = {};

    if (!offlineData || offlineData.length === 0) {
        return result;
    }

    // Get credential mapping from state to resolve credentialName and accountId
    const state = store.getState();
    const { credentialMapping } = state?.headers;

    // Group items by host (resourceId + vmName) since each item is now a single instance
    const hostGroups: { [key: string]: any[] } = {};

    offlineData.forEach((instanceData: any) => {
        // Use resourceId as host identifier, fallback to vmName
        const hostId = instanceData?.resourceId || `wad-${instanceData?.vmName}`;
        const credId = instanceData?.credentialId || instanceData?.credentialsId || 'wad';
        const regionId = instanceData?.regionId || instanceData?.region || 'wad';

        // Create a unique key for grouping instances by host
        const groupKey = `${hostId}_${credId}_${regionId}`;

        if (!hostGroups[groupKey]) {
            hostGroups[groupKey] = [];
        }
        hostGroups[groupKey].push(instanceData);
    });

    // Create inventory entries for each host group
    Object.keys(hostGroups).forEach((groupKey: string) => {
        const instances = hostGroups[groupKey];
        const firstInstance = instances[0]; // Use first instance for host-level data

        const hostId = firstInstance?.resourceId || `wad-${firstInstance?.vmName}`;
        const credId = firstInstance?.credentialId || firstInstance?.credentialsId || 'wad';
        const regionId = firstInstance?.regionId || firstInstance?.region || 'wad';

        // Format instances from the grouped data
        const formattedInstances: InventoryTableInstanceDatInterface[] = [];

        instances.forEach((instanceData: any) => {
            const assessments = instanceData?.assessments;

            // Build storage array from assessments.storage.fileSystems for instance level (same as host level logic)
            const instanceStorageArray: DiscoveredStorageObj[] = [];
            const instanceFileSystems =
                assessments?.storage?.fileSystems ||
                (assessments?.storageEndpoint ? [assessments?.storageEndpoint] : []);
            if (instanceFileSystems && Array.isArray(instanceFileSystems)) {
                instanceFileSystems.forEach((fsId: string) => {
                    instanceStorageArray.push({
                        id: fsId,
                        protocol: '',
                        svmId: '', // Not available in WAD assessment data
                        type: DETECT_HOST_VAR.FSXN
                    });
                });
            }

            const aoagDetails =
                assessments?.deploymentType === DATABASE_DEPLOYMENT_MODE.AOAG_CAPS
                    ? {
                          baseDeploymentType: assessments?.baseDeploymentType
                      }
                    : undefined;

            formattedInstances.push({
                databaseInstanceId: instanceData?.databaseInstanceId,
                databaseInstanceName: instanceData?.databaseInstanceName,
                databaseHostId: hostId, // Added for WAD API calls
                statusColText: INVENTORY_STATUS.UNMANAGED,
                sqlServerDeploymentType: assessments?.deploymentType,
                fsxId: assessments?.storageEndpoint,
                isDetected: false,
                isManaged: false,
                isWad: true,
                wadAssessmentData: assessments,
                storage: instanceStorageArray.length > 0 ? instanceStorageArray : undefined,
                aoagDetails
            });
        });

        // Get VM details from clusterNodes if available (new structure uses clusterNodes instead of vmNodes)
        const ec2Details: EC2DetailsInterface[] = [];
        if (
            firstInstance?.assessments?.deploymentType === DATABASE_DEPLOYMENT_MODE.AOAG_CAPS &&
            firstInstance?.clusterNodes &&
            Array.isArray(firstInstance.clusterNodes)
        ) {
            firstInstance.clusterNodes.forEach((node: any) => {
                ec2Details.push({
                    id: node?.vmInstanceId,
                    name: node?.nodeName
                });
            });
        } else if (firstInstance?.vmName || firstInstance?.vmInstanceId) {
            ec2Details.push({
                id: firstInstance?.vmInstanceId,
                name: firstInstance?.vmName
            });
        }

        // Create the inventory table data entry
        const inventoryEntry: InventoryTableData = {
            id: hostId,
            resourceId: hostId,
            name: firstInstance?.assessments?.databaseHostName || `${hostId}`,
            hostType: DBType.MSSQL, // WAD data is for MSSQL
            ec2InstanceId: firstInstance?.resourceId,
            ec2InstanceName: firstInstance?.vmName,
            totalInstance: formattedInstances.length,
            managedInstance: 0,
            vpcId: firstInstance?.virtualNetworkId,
            vpcName: firstInstance?.virtualNetworkName,
            action: '', // No actions available for WAD data
            actionDisable: true,
            isManagedHost: false,
            loading: false,
            isDetected: false,
            storageType: GENERAL.FSX_FOR_ONTAP,
            sqlServerInstances: formattedInstances,
            hasInstanceData: formattedInstances.length > 0,
            credentialId: credId !== 'wad' ? credId : undefined,
            regionId: regionId !== 'wad' ? regionId : undefined,
            credentialName: credentialMapping?.[credId]?.name,
            accountId: credentialMapping?.[credId]?.providerAccountId,
            regionName: firstInstance?.regionName,
            isWad: true, // Mark as WAD (offline assessment) data
            ec2Details: ec2Details.length > 0 ? ec2Details : undefined,
            statusColText: INVENTORY_STATUS.UNMANAGED // Hardcoded until status is available from API
        };

        result[groupKey] = inventoryEntry;
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

    const result: any = {
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
        platform: getPlatformForManagedHost(managedRow, managedRow?.hostType),
        fqdn: managedRow?.nodeTopology?.fqdn,
        windowsClusterName: managedRow?.nodeTopology?.windowsClusterName,
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

export const getInstanceStatusForMixedCase = (managedHostRow: any, engineType: string | undefined) => {
    const state = store.getState();
    const discoveredHostData =
        engineType === DBType.ORACLE
            ? state?.inventoryV2?.discoveredOracleHosts?.discoveredOracleHostData
            : state?.inventoryV2?.discoveredHosts?.discoveredHostData;
    const ec2Id = managedHostRow?.nodeTopology?.ec2Details?.[0]?.id || managedHostRow?.ec2InstanceId;

    if (ec2Id && discoveredHostData) {
        const selectedEc2 = discoveredHostData?.filter((perHost: any) => perHost?.ec2InstanceId === ec2Id);

        if (selectedEc2 && selectedEc2?.length > 0) {
            const ssmState = getDiscoverSsmState(selectedEc2[0]);
            const result =
                engineType === DBType.ORACLE
                    ? getOracleDiscoverPerInstanceStatus(selectedEc2[0], ssmState)
                    : getDiscoveredPerInstanceStatus(selectedEc2[0], ssmState);

            return result;
        }
    }
    return [];
};

const getMappedDiscoveredData = (managedHostRow: any) => {
    const state = store.getState();
    const discoveredHostData = state?.inventoryV2?.discoveredOracleHosts?.discoveredOracleHostData;
    const ec2Id = managedHostRow?.nodeTopology?.ec2Details?.[0]?.id || managedHostRow?.ec2InstanceId;

    if (ec2Id && discoveredHostData) {
        const selectedEc2 = discoveredHostData?.filter((perHost: any) => perHost?.ec2InstanceId === ec2Id);
        if (selectedEc2 && selectedEc2?.length > 0) {
            return selectedEc2[0];
        }
    }
};

export const getPlatformForManagedHost = (managedHostRow: any, engineType: string | undefined) => {
    // try to get platform from nodeTopology
    if (managedHostRow?.platform) {
        return managedHostRow.platform;
    }

    // try to get platform from discovered data
    if (engineType === DBType.ORACLE) {
        return getMappedDiscoveredData(managedHostRow)?.platform;
    }

    return undefined;
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
    if (
        row?.hostType === DBType.ORACLE &&
        row?.databaseInstancesSummary &&
        row?.databaseInstancesSummary?.[0]?.dataguardDetails?.dbUniqueName
    ) {
        installationMode = DATABASE_DEPLOYMENT_MODE.DATAGUARD;
    } else if (row?.databaseInstancesSummary && row?.databaseInstancesSummary?.length > 0) {
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
    if (row?.hostType === DBType.ORACLE && row?.databaseInstancesSummary && row?.databaseInstancesSummary?.length > 0) {
        // Loop through all database instances to check for DataGuard
        for (let i = 0; i < row?.databaseInstancesSummary?.length; i++) {
            const val = row?.databaseInstancesSummary[i];
            let perInstallationMode = '';

            // Check if this instance has DataGuard deployed
            if (val?.dataguardDetails?.dbUniqueName) {
                perInstallationMode = DATABASE_DEPLOYMENT_MODE.DATAGUARD;
            } else {
                perInstallationMode = DATABASE_DEPLOYMENT_MODE.STANDALONE;
            }

            if (perInstallationMode && !installationMode.includes(perInstallationMode)) {
                installationMode.push(perInstallationMode);
            }
        }
        return installationMode;
    }
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

const getOracleSpecificFields = (perRow: any) => {
    const targetDatabase = perRow?.databases?.find(
        (db: any) =>
            db?.type === ORACLE_DATABASES_COMPONENTS.CDB ||
            db?.type === ORACLE_DATABASES_COMPONENTS.SINGLE_TENANT_DATABASE_API_RESPONSE
    );
    return {
        instanceType:
            targetDatabase?.type === ORACLE_DATABASES_COMPONENTS.CDB
                ? ORACLE_DATABASES_COMPONENTS.MULTI_TENANT
                : ORACLE_DATABASES_COMPONENTS.SINGLE_TENANT,
        protocol:
            Array.isArray(perRow?.storage?.fsxn?.protocol) && perRow?.storage?.fsxn?.protocol.length > 0
                ? perRow?.storage?.fsxn?.protocol[0]
                : GENERAL.NOT_AVAILABLE,
        size: targetDatabase?.size ? targetDatabase?.size : GENERAL.NOT_AVAILABLE,
        platform: targetDatabase?.platform ? targetDatabase?.platform : GENERAL.NOT_AVAILABLE
    };
};

export const formatInstanceData = (row: ManagedHostsRowInterface) => {
    const isAllManaged = row?.databaseInstanceDetails?.every(perRow => !!perRow?.isManaged);

    let nonManagedStatus: any = [];
    if (!isAllManaged) {
        nonManagedStatus = getInstanceStatusForMixedCase(row, row?.hostType);
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

            let authAndDetectFields = {};
            if (row?.hostType === DBType.ORACLE) {
                const oracleAuth = statusObj?.[0]?.oracleServerAuthentication;
                const defaultAuth = statusObj?.[0]?.isDefaultAuthentication;
                const isThisInstanceManaged = isManagedRow?.[0]?.isManaged;

                authAndDetectFields = {
                    oracleServerAuthentication: oracleAuth,
                    isDefaultAuthentication: defaultAuth,
                    isInstanceStorageAsmManaged:
                        perRow?.isInstanceStorageAsmManaged ?? statusObj?.[0]?.isInstanceStorageAsmManaged,
                    asmAuthentication: statusObj?.[0]?.asmAuthentication,
                    detectOption: statusObj?.[0]?.detectOption,
                    detectOptionDisableMsg: statusObj?.[0]?.detectOptionDisableMsg
                };

                // Only apply defaults for Oracle instances that are truly missing discovery data
                if (row?.hostType === DBType.ORACLE && oracleAuth === undefined && defaultAuth === undefined) {
                    if (isThisInstanceManaged) {
                        // Managed instances don't have discovery status by design - assume authenticated
                        authAndDetectFields = {
                            ...authAndDetectFields,
                            oracleServerAuthentication: true,
                            isDefaultAuthentication: true
                        };
                    } else {
                        // Unmanaged instances should have discovery data, but if missing, be conservative
                        authAndDetectFields = {
                            ...authAndDetectFields,
                            oracleServerAuthentication: false,
                            isDefaultAuthentication: false
                        };
                    }
                }
            } else {
                authAndDetectFields = {
                    windowsAuthentication: statusObj?.[0]?.windowsAuthentication,
                    sqlServerAuthentication: statusObj?.[0]?.sqlServerAuthentication,
                    windowsDomainUserAuthentication: statusObj?.[0]?.windowsDomainUserAuthentication
                };
            }
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
                fsxId: statusObj?.[0]?.fsxId,
                fileSystemName: statusObj?.[0]?.fileSystemName,
                // Preserve Oracle deployment type and dataguard details for mixed managed/unmanaged cases
                oracleServerDeploymentType:
                    perRow?.oracleServerDeploymentType ||
                    statusObj?.[0]?.discoverInstanceData?.oracleServerDeploymentType,
                dataguardDetails: perRow?.dataguardDetails || statusObj?.[0]?.discoverInstanceData?.dataguardDetails,
                ...authAndDetectFields
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
            let authFields = {};
            let oracleSpecificFields = {};
            if (row?.hostType === DBType.ORACLE) {
                authFields = {
                    oracleServerAuthentication: statusObj?.[0]?.oracleServerAuthentication,
                    isDefaultAuthentication: statusObj?.[0]?.isDefaultAuthentication,
                    isInstanceStorageAsmManaged:
                        perRow?.isInstanceStorageAsmManaged ?? statusObj?.[0]?.isInstanceStorageAsmManaged,
                    asmAuthentication: statusObj?.[0]?.asmAuthentication
                };
                // Check for the item with type CDB/Single tenant (mostly it is 1st item but can be in the middle also)
                oracleSpecificFields = getOracleSpecificFields(perRow);
            } else {
                authFields = {
                    windowsAuthentication: statusObj?.[0]?.windowsAuthentication,
                    sqlServerAuthentication: statusObj?.[0]?.sqlServerAuthentication,
                    windowsDomainUserAuthentication: statusObj?.[0]?.windowsDomainUserAuthentication
                };
            }
            const allocatedCapacity =
                (perRow?.storage?.fsxn?.size || 0) +
                (perRow?.storage?.fsxw?.size || 0) +
                (perRow?.storage?.ebs?.size || 0);
            if (perRow) {
                let rowDataObject = {
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
                    ...authFields
                };
                if (row?.hostType === DBType.ORACLE) {
                    rowDataObject = {
                        ...rowDataObject,
                        ...oracleSpecificFields,
                        // Preserve Oracle deployment type and dataguard details for mixed managed/unmanaged cases
                        oracleServerDeploymentType:
                            perRow?.oracleServerDeploymentType ||
                            instRow?.oracleServerDeploymentType ||
                            statusObj?.[0]?.discoverInstanceData?.oracleServerDeploymentType,
                        dataguardDetails:
                            perRow?.dataguardDetails ||
                            instRow?.dataguardDetails ||
                            statusObj?.[0]?.discoverInstanceData?.dataguardDetails
                    };
                }

                return rowDataObject;
            }
            return instRow;
        });
    }

    return instanceRows;
};

export const getFsxIdsFromdiscover = (data: Array<DiscoverHostInterface>, engineType: string) => {
    const fsxIds: Array<string> = [];
    data?.forEach((instances: DiscoverHostInterface) => {
        if (engineType === DBType.MSSQL) {
            instances?.sqlServerInstances?.forEach((inst: SQLServerInstancesDiscovered) => {
                inst?.storage?.forEach((storageObj: DiscoveredStorageObj) => {
                    if (storageObj.type === DETECT_HOST_VAR.FSXN) {
                        const fsxId = storageObj?.id || '';
                        if (!fsxIds.includes(fsxId)) {
                            fsxIds.push(fsxId);
                        }
                    }
                });
            });
        } else if (engineType === DBType.ORACLE) {
            instances?.databaseInstanceDetails?.forEach((inst: OracleInstancesDiscovered) => {
                inst?.storage?.forEach((storageObj: DiscoveredStorageObj) => {
                    if (storageObj.type === DETECT_HOST_VAR.FSXN) {
                        const fsxId = storageObj?.id || '';
                        if (!fsxIds.includes(fsxId)) {
                            fsxIds.push(fsxId);
                        }
                    }
                });
            });
        }
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
            const isCurrentAoagFciOrFci = host?.sqlServerInstances?.some(
                (perSql: SQLServerInstancesDiscovered) =>
                    perSql?.sqlServerDeploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG ||
                    perSql?.sqlServerDeploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE
            );
            // To find partner node in a cluster
            let partnerNode = newDiscoveredHostData.filter((perHost: DiscoverHostInterface) => {
                const isAoagFciOrFci = perHost?.sqlServerInstances?.some(
                    (perSql: SQLServerInstancesDiscovered) =>
                        perSql?.sqlServerDeploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG ||
                        perSql?.sqlServerDeploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE
                );
                const isSameCluster = host?.nodesList?.every(
                    (val: string) =>
                        perHost?.ec2InstanceId !== host?.ec2InstanceId &&
                        perHost?.nodesList &&
                        perHost.nodesList.includes(val) &&
                        perHost?.credentialId === host?.credentialId &&
                        perHost?.regionId === host?.regionId
                );
                // checking same vpc or not
                if (isCurrentAoagFciOrFci && isAoagFciOrFci && isSameCluster && perHost?.vpc?.id === host?.vpc?.id) {
                    return perHost;
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

export const formatDiscoveredOracleInventoryData = (
    discoveredData: Array<DiscoverOracleHostInterface>,
    removeRows: Array<string> = []
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
        result = {
            ...result,
            ...{
                [uniqueHostRow(perRow.ec2InstanceId, perRow.credentialId || '', perRow.regionId || '')]:
                    formatOracleDiscoveredRows(perRow, credentialMapping, regionMapping, GENERAL.ORACLE_TYPE)
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
    regionMapping: any,
    type: string
) => {
    const totalInstanceCount = discoveredRow?.databaseInstanceDetails?.length || 0;
    const ssmState = getDiscoverSsmState(discoveredRow);
    const perInstanceStatus = getOracleDiscoverPerInstanceStatus(discoveredRow, ssmState);
    let installationMode = discoveredRow?.oracleServerDeploymentType || '';
    const installationModeList: Array<string> = [];
    if (discoveredRow?.databaseInstanceDetails) {
        for (let i = 0; i < discoveredRow?.databaseInstanceDetails?.length; i++) {
            const val = discoveredRow?.databaseInstanceDetails[i];
            let perInstallationMode = '';

            // Check if this instance has DataGuard deployed
            if (val?.dataguardDetails?.dbUniqueName) {
                perInstallationMode = DATABASE_DEPLOYMENT_MODE.DATAGUARD;
                installationMode = DATABASE_DEPLOYMENT_MODE.DATAGUARD;
            } else {
                perInstallationMode = discoveredRow?.oracleServerDeploymentType || '';
            }

            if (perInstallationMode && !installationModeList.includes(perInstallationMode)) {
                installationModeList.push(perInstallationMode);
            }
        }
    }

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
        platform: discoveredRow?.platform,
        name: getDiscoverHostname(discoveredRow, type),
        status: ssmState, // discover status will depends on ssmState only
        ssmState,
        totalInstance: totalInstanceCount,
        managedInstance: 0,
        serverInstallationMode: installationMode,
        protocol:
            discoveredRow?.databaseInstanceDetails?.[0]?.storage?.[0]?.mountDetails?.[0]?.protocol ||
            GENERAL.NOT_AVAILABLE,
        serverAllInstallationMode: installationModeList,
        vpcId: discoveredRow?.vpc?.id,
        vpcName: discoveredRow?.vpc?.name,
        vpcCidr: discoveredRow?.vpc?.cidrBlock,
        action: actionObj?.action,
        actionDisable: actionObj?.actionDisable,
        isManagedHost: false,
        loading: false,
        isInstanceStorageAsmManaged: discoveredRow?.databaseInstanceDetails?.[0]?.isInstanceStorageAsmManaged,
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
    } else if (type === GENERAL.ORACLE_TYPE && discoveredRow?.ec2HostName) {
        name = discoveredRow?.ec2HostName;
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
    const fsxCredentialStatusObj = state?.inventoryV2?.fsxCredentialStatusObj || {}; // MSSQL state
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
                        fileSystemName: fsxIdObject?.fileSystemName,
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
                        fileSystemName: fsxIdObject?.fileSystemName,
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
    const fsxCredentialStatusObj = state?.inventoryV2?.fsxCredentialStatusObjOracle || {}; // Oracle state
    if (row?.databaseInstanceDetails && row?.databaseInstanceDetails?.length > 0) {
        row?.databaseInstanceDetails?.map((perRow: OracleInstancesDiscovered) => {
            let statusObj = {};
            if (perRow?.instanceName) {
                const isDefaultAuthentication = perRow?.isDefaultAuthentication;
                const oracleServerAuthentication = perRow?.oracleServerAuthentication;
                const isInstanceStorageAsmManaged = perRow?.isInstanceStorageAsmManaged;
                const asmAuthentication = perRow?.asmAuthentication;
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

                // Include oracleServerDeploymentType from host row for deployment model display
                const discoverInstanceData = {
                    ...perRow,
                    oracleServerDeploymentType: row?.oracleServerDeploymentType
                };

                if (
                    ssmState !== INVENTORY_STATUS.ONLINE ||
                    (!isDefaultAuthentication && !oracleServerAuthentication) ||
                    fsxCredentialValidationFailed ||
                    !storageTypeCheck
                ) {
                    const detectOptionObj = getDetectOptionForInstance(
                        perRow,
                        row?.ssmState,
                        fsxIdObject?.id,
                        fsxCredentialStatusObj,
                        GENERAL.ORACLE_TYPE
                    );
                    statusObj = {
                        ...detectOptionObj,
                        discoverInstanceData,
                        name: perRow.instanceName,
                        status: INVENTORY_STATUS.UNDETECTED,
                        storageType: perRow?.storage,
                        fsxId: fsxIdObject?.id,
                        fileSystemName: fsxIdObject?.fileSystemName,
                        isFsxRegistered: !fsxCredentialValidationFailed,
                        isDefaultAuthentication,
                        oracleServerAuthentication,
                        isInstanceStorageAsmManaged,
                        asmAuthentication
                    };
                } else {
                    statusObj = {
                        discoverInstanceData,
                        name: perRow.instanceName,
                        status: INVENTORY_STATUS.UNMANAGED,
                        storageType: perRow?.storage,
                        fsxId: fsxIdObject?.id,
                        fileSystemName: fsxIdObject?.fileSystemName,
                        isFsxRegistered: !fsxCredentialValidationFailed,
                        isDefaultAuthentication,
                        oracleServerAuthentication,
                        isInstanceStorageAsmManaged,
                        asmAuthentication
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
    const fsxCredentialStatusObj = state?.inventoryV2?.fsxCredentialStatusObjPgsql || {}; // PostgreSQL state
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
                        fileSystemName: fsxIdObject?.fileSystemName,
                        isFsxRegistered: !fsxCredentialValidationFailed
                    };
                } else {
                    statusObj = {
                        name: perRow.pgsqlServerInstanceName,
                        status: INVENTORY_STATUS.UNMANAGED,
                        storageType: perRow?.storage,
                        fsxId: fsxIdObject?.id,
                        fileSystemName: fsxIdObject?.fileSystemName,
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
    if (type === GENERAL.ORACLE_TYPE) {
        if (perRow?.isDefaultAuthentication) {
            auth = true;
        } else {
            auth = perRow?.oracleServerAuthentication;
        }
    }
    const isSqlRunning = state === DETECT_HOST_VAR.RUNNING || state === STATUS_CONST.OPEN;
    if (ssmState?.toLowerCase() !== INVENTORY_STATUS.SSM_CONNECTED) {
        detectOption = DETECT_HOST_VAR.HIDE;
        detectOptionDisableMsg = GENERAL.SSM_CONNECTION_DOWN;
    } else if (!isSqlRunning) {
        detectOption = DETECT_HOST_VAR.DISABLE;
        detectOptionDisableMsg = GENERAL.SQL_SERVER_NOT_RUNNING;
    } else if (!hasStorageTypes) {
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
            fileSystemName: statusObj?.[0]?.fileSystemName,
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
            fileSystemName: statusObj?.[0]?.fileSystemName,
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
            // Mapping the instanceType to constant variable to show in the UX required format
            instanceType:
                perRow?.instanceType === ORACLE_DATABASES_COMPONENTS.MULTI_TENANT_API_RESPONSE
                    ? ORACLE_DATABASES_COMPONENTS.MULTI_TENANT
                    : ORACLE_DATABASES_COMPONENTS.SINGLE_TENANT, // Oracle tenancy type from discovery
            protocol: perRow?.storage?.[0]?.mountDetails?.[0]?.protocol, // Oracle Protocol from storage details
            databaseCount: perRow?.databaseCount,
            statusColText: statusObj ? statusObj?.[0]?.status : INVENTORY_STATUS.UNDETECTED,
            fileSystemType: getDiscoverFileSystemType(perRow),
            storage: perRow?.storage,
            fsxId: statusObj?.[0]?.fsxId,
            fileSystemName: statusObj?.[0]?.fileSystemName,
            isFsxRegistered: statusObj?.[0]?.isFsxRegistered,
            oracleServerAuthentication: perRow?.oracleServerAuthentication,
            isDefaultAuthentication: perRow?.isDefaultAuthentication,
            isInstanceStorageAsmManaged: perRow?.isInstanceStorageAsmManaged,
            asmAuthentication: perRow?.asmAuthentication,
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

export const sortAnalyzedResourceData = (data: Array<InventoryTableData>) => {
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

    const result = data.slice().sort((a, b) => {
        const weightA =
            (databasesWeights[(a?.hostType || '').toLowerCase()] || 0) +
            (statusWeights[(a?.status || '').toLowerCase()] || 0);

        const weightB =
            (databasesWeights[(b?.hostType || '').toLowerCase()] || 0) +
            (statusWeights[(b?.status || '').toLowerCase()] || 0);

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
            (databaseHostsData[key]?.action === INVENTORY_ACTIONS.MANAGE &&
                databaseHostsData[key]?.ssmState === STATUS_CONST.ONLINE) ||
            databaseHostsData[key]?.isDetected
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
        inventoryRow?.ec2Details?.length > 1
        // !instanceRow?.data?.clusterNodeDetails // Excluding bcz for AOAG it will have full cluster list
    ) {
        instanceId = inventoryRow?.ec2Details?.[0]?.id || '';
        ec2Details = inventoryRow?.ec2Details;
    } else if (instanceRow?.data?.nodeTopology?.ec2Details && instanceRow?.data?.nodeTopology?.ec2Details?.length > 0) {
        instanceId = instanceRow?.data?.nodeTopology?.ec2Details?.[0]?.id || '';
        ec2Details.push(instanceRow?.data?.nodeTopology?.ec2Details?.[0]);
    }

    // Excluding bcz for AOAG it will have full cluster list. So will rely on mapped EC2Details above.
    // if (instanceRow?.data?.clusterNodeDetails) {
    //     if (instanceId) {
    //         const partnerNode = instanceRow?.data?.clusterNodeDetails?.filter(
    //             perInst => perInst?.ec2InstanceId !== instanceId
    //         );
    //         if (partnerNode && partnerNode?.length > 0) {
    //             ec2Details.push({
    //                 id: partnerNode[0]?.ec2InstanceId,
    //                 name: partnerNode[0]?.ec2InstanceName,
    //                 instanceType: partnerNode[0]?.ec2InstanceType
    //             });
    //         }
    //     } else {
    //         const node1 = instanceRow?.data?.clusterNodeDetails?.[0];
    //         const node2 = instanceRow?.data?.clusterNodeDetails?.[1];
    //         if (node1) {
    //             ec2Details.push({
    //                 id: node1?.ec2InstanceId,
    //                 name: node1?.ec2InstanceName,
    //                 instanceType: node1?.ec2InstanceType
    //             });
    //         }
    //         if (node2) {
    //             ec2Details.push({
    //                 id: node2?.ec2InstanceId,
    //                 name: node2?.ec2InstanceName,
    //                 instanceType: node2?.ec2InstanceType
    //             });
    //         }
    //     }
    // }
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
            const deploymentType =
                perRow?.sqlServerDeploymentType ||
                perRow?.oracleServerDeploymentType ||
                perRow?.pgsqlServerDeploymentType ||
                '';
            if (deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG) {
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
                fileSystemName: perRow?.databaseInstanceTopology?.fileSystemName || instRow?.fileSystemName,
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
                nonManagedStatus = getInstanceStatusForMixedCase(instanceData, existingInstanceRow?.hostType);
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
                // Add authentication fields based on hostType
                let authFields = {};
                if (existingInstanceRow?.hostType === DBType.ORACLE) {
                    // Use nullish coalescing to preserve explicit false values but provide defaults for undefined/null
                    const oracleAuth =
                        instRow?.oracleServerAuthentication ?? statusObj?.[0]?.oracleServerAuthentication;
                    const defaultAuth = instRow?.isDefaultAuthentication ?? statusObj?.[0]?.isDefaultAuthentication;
                    authFields = {
                        oracleServerAuthentication: oracleAuth,
                        isDefaultAuthentication: defaultAuth,
                        isInstanceStorageAsmManaged:
                            instRow?.isInstanceStorageAsmManaged ?? statusObj?.[0]?.isInstanceStorageAsmManaged,
                        asmAuthentication: instRow?.asmAuthentication ?? statusObj?.[0]?.asmAuthentication
                    };
                } else {
                    authFields = {
                        windowsAuthentication: instRow?.windowsAuthentication || statusObj?.[0]?.windowsAuthentication,
                        sqlServerAuthentication:
                            instRow?.sqlServerAuthentication || statusObj?.[0]?.sqlServerAuthentication,
                        windowsDomainUserAuthentication:
                            instRow?.windowsDomainUserAuthentication || statusObj?.[0]?.windowsDomainUserAuthentication
                    };
                }
                return {
                    ...instRow,
                    databaseCount: perRow?.databaseCount,
                    fileSystemType: perRow?.databaseInstanceTopology?.fileSystemType || instRow?.fileSystemType,
                    fsxId: perRow?.databaseInstanceTopology?.fileSystemId || instRow?.fsxId,
                    fileSystemName: perRow?.databaseInstanceTopology?.fileSystemName || instRow?.fileSystemName,
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
                    // Preserve Oracle deployment type and dataguard details for mixed managed/unmanaged cases
                    oracleServerDeploymentType:
                        instRow?.oracleServerDeploymentType ||
                        statusObj?.[0]?.discoverInstanceData?.oracleServerDeploymentType,
                    dataguardDetails:
                        instRow?.dataguardDetails || statusObj?.[0]?.discoverInstanceData?.dataguardDetails,
                    isFsxRegistered: instRow?.isFsxRegistered || statusObj?.[0]?.isFsxRegistered,
                    ...authFields
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
                nonManagedStatus = getInstanceStatusForMixedCase(existingInstanceRow, existingInstanceRow?.hostType);
                // to call data for mixed case. use in statusColText for unmanaged case
            }
            instanceRows = instanceRows?.map((instRow: InventoryTableInstanceDatInterface) => {
                if (instRow?.statusColText !== INVENTORY_STATUS.MANAGED) {
                    const statusObj = nonManagedStatus?.filter(
                        (per: StatusObjInterface) =>
                            per?.name?.toLowerCase() === instRow?.databaseInstanceName?.toLowerCase()
                    );
                    // Add authentication fields based on hostType
                    let authFields = {};
                    if (existingInstanceRow?.hostType === DBType.ORACLE) {
                        const oracleAuth =
                            statusObj?.[0]?.oracleServerAuthentication ?? instRow?.oracleServerAuthentication;
                        const defaultAuth = statusObj?.[0]?.isDefaultAuthentication ?? instRow?.isDefaultAuthentication;

                        authFields = {
                            oracleServerAuthentication: oracleAuth,
                            isDefaultAuthentication: defaultAuth,
                            isInstanceStorageAsmManaged:
                                statusObj?.[0]?.isInstanceStorageAsmManaged ?? instRow?.isInstanceStorageAsmManaged,
                            asmAuthentication: statusObj?.[0]?.asmAuthentication ?? instRow?.asmAuthentication
                        };

                        // If authentication fields are still undefined for Oracle in mixed case, provide reasonable defaults
                        if (oracleAuth === undefined && defaultAuth === undefined) {
                            // For mixed case, if the instance is managed, assume it's authenticated
                            if (instRow?.statusColText === INVENTORY_STATUS.MANAGED) {
                                authFields = {
                                    ...authFields,
                                    oracleServerAuthentication: true,
                                    isDefaultAuthentication: true
                                };
                            } else {
                                // For unmanaged instances in mixed case, be conservative
                                authFields = {
                                    ...authFields,
                                    oracleServerAuthentication: false,
                                    isDefaultAuthentication: false
                                };
                            }
                        }
                    } else {
                        authFields = {
                            windowsAuthentication: statusObj?.[0]?.windowsAuthentication,
                            sqlServerAuthentication: statusObj?.[0]?.sqlServerAuthentication,
                            windowsDomainUserAuthentication: statusObj?.[0]?.windowsDomainUserAuthentication
                        };
                    }
                    if (statusObj && statusObj?.length > 0) {
                        return {
                            ...statusObj?.[0]?.discoverInstanceData,
                            ...instRow,
                            sqlServerDeploymentType:
                                instRow?.sqlServerDeploymentType ||
                                statusObj?.[0]?.discoverInstanceData?.sqlServerDeploymentType,
                            // Preserve Oracle deployment type and dataguard details for mixed managed/unmanaged cases
                            oracleServerDeploymentType:
                                instRow?.oracleServerDeploymentType ||
                                statusObj?.[0]?.discoverInstanceData?.oracleServerDeploymentType,
                            dataguardDetails:
                                instRow?.dataguardDetails || statusObj?.[0]?.discoverInstanceData?.dataguardDetails,
                            statusColText:
                                isManagedHost && statusObj?.[0]?.status
                                    ? statusObj?.[0]?.status
                                    : instRow?.statusColText,
                            fsxId: statusObj?.[0]?.fsxId || instRow?.fsxId,
                            fileSystemName: statusObj?.[0]?.fileSystemName || instRow?.fileSystemName,
                            isFsxRegistered: statusObj?.[0]?.isFsxRegistered,
                            ...authFields
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

export const getExploreSavingsRowsMssql = (inventoryTableData: { [key: string]: InventoryTableData }) => {
    // If ES row is disabled than it should come in inventory but not in explore savings table
    const nonFsxnStorageList: Array<InventoryTableData> = [];
    const state = store.getState();
    const { removeSecNodeDiscoveredList } = state.inventoryV2;
    Object.keys(inventoryTableData).map((key: string) => {
        const item = inventoryTableData[key];
        if (removeSecNodeDiscoveredList.includes(key)) {
            return;
        }

        // EBS rows are only supported for MSSQL hosts. Other DB types are not supported. This will restrict EBS calls for other DB types.
        if (item?.hostType !== DBType.MSSQL) {
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

export const getDiscoveredHostDeploymentAtHostLevel = (row: any, t: TFunction) => {
    const installationMode: Array<string> = [];
    if (row?.hostType === DBType.ORACLE && row?.sqlServerInstances && row?.sqlServerInstances?.length > 0) {
        // Loop through all database instances to check for DataGuard
        for (let i = 0; i < row?.sqlServerInstances?.length; i++) {
            const val = row?.sqlServerInstances[i];
            let perInstallationMode = '';

            // Check if this instance has DataGuard deployed
            if (val?.dataguardDetails?.dbUniqueName) {
                perInstallationMode = DATABASE_DEPLOYMENT_MODE.DATAGUARD;
            } else {
                perInstallationMode = DATABASE_DEPLOYMENT_MODE.STANDALONE;
            }

            if (perInstallationMode && !installationMode.includes(perInstallationMode)) {
                installationMode.push(perInstallationMode);
            }
        }
        return installationMode;
    }
    if (row?.sqlServerInstances && row?.sqlServerInstances?.length > 0) {
        for (let i = 0; i < row?.sqlServerInstances?.length; i++) {
            const val = row?.sqlServerInstances[i];
            let perInstallationMode = '';
            if (val?.sqlServerDeploymentType) {
                perInstallationMode = val?.sqlServerDeploymentType;
            } else if (val?.databaseInstanceTopology?.serverInstallationMode) {
                perInstallationMode = val?.databaseInstanceTopology?.serverInstallationMode;
            }

            if (perInstallationMode?.toLowerCase() === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE) {
                perInstallationMode = t('databases.general.failover-cluster-instances');
            } else if (
                perInstallationMode?.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG &&
                val?.aoagDetails?.baseDeploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE
            ) {
                perInstallationMode = `(${t('databases.general.aoag')}) ${t(
                    'databases.general.failover-cluster-instances'
                )}`;
            } else if (
                perInstallationMode?.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG &&
                val?.aoagDetails?.baseDeploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE
            ) {
                perInstallationMode = `(${t('databases.general.aoag')}) ${t('databases.general.standalone')}`;
            } else if (perInstallationMode?.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG) {
                perInstallationMode = t('databases.general.aoag');
            } else if (perInstallationMode?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
                perInstallationMode = t('databases.general.standalone');
            } else if (perInstallationMode?.toLowerCase() === SQL_DEPLOYMENT_MODE.HA) {
                perInstallationMode = t('databases.general.high-availability');
            }
            if (!installationMode.includes(perInstallationMode)) {
                installationMode.push(perInstallationMode);
            }
        }
        return installationMode;
    }
    return [];
};

export const getDiscoveredHostDeploymentV2 = (host: any, t: TFunction) => {
    // This will get deployment type in case of unmanaged hosts
    const deploymentType =
        host?.sqlServerDeploymentType || host?.oracleServerDeploymentType || host?.pgsqlServerDeploymentType || '';
    let type = '';
    if (host?.dataguardDetails?.dbUniqueName) {
        type = DATABASE_DEPLOYMENT_MODE.DATAGUARD;
    } else if (
        deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG &&
        host?.aoagDetails?.baseDeploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE
    ) {
        type = `(${t('databases.general.aoag')}) ${t('databases.general.failover-cluster-instances')}`;
    } else if (
        deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG &&
        host?.aoagDetails?.baseDeploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE
    ) {
        type = `(${t('databases.general.aoag')}) ${t('databases.general.standalone')}`;
    } else if (deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG) {
        type = t('databases.general.aoag');
    } else if (deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE) {
        type = t('databases.general.failover-cluster-instances');
    } else if (deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
        type = t('databases.general.standalone');
    } else if (deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.HA) {
        type = t('databases.general.high-availability');
    } else {
        type = deploymentType;
    }
    return type;
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

export const getFileSystemName = (data: any) =>
    data?.fileSystemName && data.fileSystemName !== GENERAL.NOT_AVAILABLE ? data.fileSystemName : '';

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

/**
 * Determines the optimization status for WAD (offline assessment) data.
 * Calculates the number of optimization issues from the assessment cards data.
 * WAD excluded configurations (defined in WAD_EXCLUDED_CONFIGS_MSSQL) are not counted.
 *
 * @param wadAssessmentData - The WAD assessment data object containing lastAssessmentTimestamp and other assessment info
 * @returns A string indicating the optimization status:
 *          - "X issue(s)" if there are optimization issues
 *          - "Well-Architected" if fully optimized
 *          - "In Progress" if assessment is still running
 *          - Empty string if no assessment data available
 */
export const getWadOptimizationStatus = (wadAssessmentData: any) => {
    let optimizationStatus = '';
    if (wadAssessmentData && wadAssessmentData?.lastAssessmentTimestamp) {
        // Ensure isWad flag is set for WAD assessment data so that WAD excluded configs are properly filtered
        const assessmentDataWithWadFlag = { ...wadAssessmentData, isWad: true };
        const { cardsData } = getCardsData(assessmentDataWithWadFlag, {});
        const optBreakDown = formatOptimizationBreakDown(cardsData, assessmentDataWithWadFlag);
        optimizationStatus =
            optBreakDown?.total?.notOptimized !== 0
                ? optBreakDown?.total?.notOptimized === 1
                    ? `${optBreakDown?.total?.notOptimized} issue`
                    : `${optBreakDown?.total?.notOptimized} issues`
                : ACTION_CTA.WELL_ARCHITECTED;
    } else if (wadAssessmentData && !wadAssessmentData?.lastAssessmentTimestamp) {
        optimizationStatus = INVENTORY_STATUS.IN_PROGRESS;
    }
    return optimizationStatus;
};

export const getOptimizationStatus = (
    databaseInstanceId: string,
    optimizationStatusList: Array<HostAssessmentResponseInterface>,
    hostType: string
) => {
    if (!optimizationStatusList) {
        return '';
    }
    const instanceRow = optimizationStatusList?.find(per => per?.databaseInstanceId === databaseInstanceId);
    let optimizationStatus = '';
    if (instanceRow && instanceRow?.assessments && instanceRow?.assessments?.lastAssessmentTimestamp) {
        if (hostType === DBType.ORACLE) {
            const { cardsData } = getOracleCardsData(instanceRow?.assessments, {});
            const optBreakDown = formatOracleOptimizationBreakDown(cardsData);
            optimizationStatus =
                optBreakDown?.total?.notOptimized !== 0
                    ? optBreakDown?.total?.notOptimized === 1
                        ? `${optBreakDown?.total?.notOptimized} issue`
                        : `${optBreakDown?.total?.notOptimized} issues`
                    : ACTION_CTA.WELL_ARCHITECTED;
        } else {
            const { cardsData } = getCardsData(instanceRow?.assessments, {});
            const optBreakDown = formatOptimizationBreakDown(cardsData, instanceRow?.assessments);
            optimizationStatus =
                optBreakDown?.total?.notOptimized !== 0
                    ? optBreakDown?.total?.notOptimized === 1
                        ? `${optBreakDown?.total?.notOptimized} issue`
                        : `${optBreakDown?.total?.notOptimized} issues`
                    : ACTION_CTA.WELL_ARCHITECTED;
        }
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

export const addInstanceIdToGetInstance = (rowData: any, dispatch: any) => {
    const state = store.getState();
    const { unManagedInstanceIdsList, mssqlInstancesData } = state.inventoryV2;

    const uniqueHostId = uniqueHostRow(rowData?.ec2InstanceId, rowData?.credentialId, rowData?.regionId);

    // Skip if no ec2InstanceId
    if (!rowData?.ec2InstanceId) {
        return;
    }

    // Check if we already have instance data for this host
    const instanceData = mssqlInstancesData?.[uniqueHostId];
    const hasCompleteData = instanceData && !instanceData.loading && instanceData.data;

    // Skip if we already have complete data OR if request is currently in progress
    if (hasCompleteData || (unManagedInstanceIdsList.includes(uniqueHostId) && instanceData?.loading)) {
        return;
    }

    const instanceList = [];
    instanceList.push(uniqueHostId);

    const partnerData = rowData?.ec2Details?.filter((perRow: any) => perRow?.id !== rowData?.ec2InstanceId);
    if (partnerData && partnerData?.length > 0) {
        const partnerHostId = uniqueHostRow(partnerData?.[0]?.id, rowData?.credentialId, rowData?.regionId);
        const partnerData2 = mssqlInstancesData?.[partnerHostId];
        const hasPartnerData = partnerData2 && !partnerData2.loading && partnerData2.data;

        // Only add partner if we don't have its data yet
        if (!hasPartnerData) {
            instanceList.push(partnerHostId);
        }
    }

    const updatedList = [...new Set([...unManagedInstanceIdsList, ...instanceList])];
    dispatch(setUnManagedInstanceIdsList(updatedList));
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
            {!instanceList && !rowData?.loading && !rowData?.instanceNameListText && GENERAL.NOT_AVAILABLE}
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
                    const path = store.getState().auth.isWorkloadFactory
                        ? FORM_TO_WLF_NAVIGATE_JOB_MONITORING
                        : FORM_TO_WLF_NAVIGATE_BLUEXP_JM;

                    postBlueXPMessage({
                        type: BlueXPListeners.navigate,
                        payload: { pathname: path, replace: true }
                    });
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

export const manageActionCol = (translation: TFunction, engineType: string, rowData?: any) => {
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
        colText = engineType === DBType.ORACLE ? ACTION_CTA.REGISTER_DATABASE : ACTION_CTA.MANAGE_INSTANCES;
    }

    if (rowData?.status === INVENTORY_STATUS.OFFLINE) {
        disableMsg = GENERAL.HOST_DOWN;
    } else if (rowData?.ssmState === INVENTORY_STATUS.OFFLINE) {
        disableMsg = GENERAL.SSM_DOWN;
    } else if (rowData?.status?.toLowerCase() === INVENTORY_STATUS.DOWN) {
        disableMsg =
            engineType === DBType.ORACLE
                ? translation('databases.register-flow.oracle-server-instance-down')
                : translation('databases.register-flow.sql-server-instance-down');
    } else if (rowData?.hostType === GENERAL.POSTGRESQL_TYPE) {
        disableMsg = GENERAL.PGSQL_CTA_NA;
    } else if (rowData?.detectOption === DETECT_HOST_VAR.DISABLE || rowData?.detectOption === DETECT_HOST_VAR.HIDE) {
        disableMsg = rowData?.detectOptionDisableMsg;
    } else if (
        rowData?.statusColText === INVENTORY_STATUS.UNMANAGED &&
        rowData.fileSystemType !== GENERAL.FSX_FOR_ONTAP &&
        !rowData?.fsxId
    ) {
        disableMsg =
            engineType === DBType.ORACLE ? GENERAL.FSXN_MANAGE_SUPPORTED_ORACLE : GENERAL.FSXN_MANAGE_SUPPORTED;
    } else if (
        rowData?.serverInstallationMode === GENERAL.AOAG &&
        rowData?.statusColText === INVENTORY_STATUS.UNMANAGED
    ) {
        disableMsg = GENERAL.AOAG_MANAGE_DISABLE;
    } else if (rowData?.isWad && (!rowData?.credentialId || !rowData?.regionId)) {
        // WAD (offline assessment) rows without credentials cannot be registered
        disableMsg = translation('databases.wad.register-disabled-no-credentials');
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
        disableMsg = translation('databases.register-flow.non-mssql-assessment-na');
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
        accountID: store.getState().auth.orgId,
        actualAccountId: store.getState().auth.accountId,
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
    getDiscoverHostResult: any,
    actualAccountId: string
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
                    workspaceID,
                    actualAccountId
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
                        const accountID = store.getState().auth.orgId;
                        const actualAccountId = store.getState().auth.accountId;
                        const hostName = fqdn;
                        const agentID = state.selectedAgent[0]?.id;
                        const workspaceID = state?.workSpaceData?.id;
                        try {
                            const discoverCount = await getDiscoverResult(
                                accountID,
                                hostName,
                                agentID,
                                workspaceID,
                                getDiscoverHostResult,
                                actualAccountId
                            );

                            if (discoverCount > 0) {
                                const dirRes = await listAllDirectories({
                                    accountID,
                                    hostID: subJob?.data?.host,
                                    agentID,
                                    workspaceID,
                                    actualAccountId
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
                                            workspaceID,
                                            actualAccountId
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
        organizationId: state?.workSpaceData?.id
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
                accountID: store.getState().auth.orgId,
                actualAccountID: store.getState().auth.accountId,
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
                        (rowData?.sqlServerDeploymentType ?? rowData?.instanceRow?.sqlServerDeploymentType) ===
                        SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE_CAPS,
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
                            addHostResponse?.error?.data?.errorMessage ||
                            errorMapping(addHostResponse?.error?.message, rowData),
                        showTooltipInfo: true,
                        tooltipText:
                            addHostResponse?.error?.data?.errorMessage ||
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

    // For WAD (offline assessment) data, return the optimizationStatus directly if it has a value
    if (rowData?.isWad && cellData) {
        return { displayValue: cellData, disableMsg: '', isDisabled: false };
    }

    const getDisableMessage = () => {
        if (rowData?.hostType === GENERAL.POSTGRESQL_TYPE) {
            return t('databases.register-flow.non-mssql-assessment-na');
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

export const calculateDbBannerCounts = (instanceTableRows: any, type: string) => {
    const result = {
        registeredRows: 0,
        notRegisteredRows: 0,
        wellArchitectedRows: 0,
        notOptimizedRows: 0,
        activatedRows: 0,
        notActivatedRows: 0
    };
    instanceTableRows?.map((item: any) => {
        if (item?.managementStatus === INVENTORY_STATUS.REGISTERED) {
            result.registeredRows += 1;
            if (item?.optimizationStatus === ACTION_CTA.WELL_ARCHITECTED) {
                result.wellArchitectedRows += 1;
            } else {
                result.notOptimizedRows += 1;
            }
            if (type === DBType.MSSQL || type === DBType.ORACLE) {
                if (item?.logAnalyzer?.status === ERROR_ANALYZER_STATUS.ACTIVE) {
                    result.activatedRows += 1;
                } else {
                    result.notActivatedRows += 1;
                }
            }
        } else {
            result.notRegisteredRows += 1;
        }
    });
    return result;
};

/**
 * Enriches Oracle instances with DataGuard replica flags
 * Adds isReplica, hasReplicas, replicasCount, and replicasList to each Oracle instance
 *
 * @param allInstanceTableRows - The instance table rows to enrich
 * @param dataguardRows - Array of DataGuard configurations from groupDataGuardConfigurations
 * @returns Enriched instance table rows with DataGuard flags
 */
export const enrichInstancesWithDataGuardFlags = (allInstanceTableRows: any[], dataguardRows: any[]): any[] => {
    if (!dataguardRows || dataguardRows.length === 0) {
        return allInstanceTableRows;
    }

    return allInstanceTableRows.map((instance: any) => {
        // Skip non-Oracle instances
        if (instance.hostType !== DBType.ORACLE) {
            return instance;
        }

        let isReplica = false;
        let hasReplicas = false;
        let replicasCount = 0;
        let replicasList: any[] = [];
        let connectedInstances: any[] = [];

        // Check all DataGuard configurations
        dataguardRows.forEach((dgConfig: any) => {
            // Check if this instance is a standby (replica)
            if (dgConfig.standby && dgConfig.standby.length > 0) {
                const isStandby = dgConfig.standby.some(
                    (standby: any) =>
                        standby.databaseInstanceName === instance.databaseInstanceName &&
                        standby.credentialId === instance.credentialId &&
                        standby.regionId === instance.regionId &&
                        standby.ec2InstanceId === instance.ec2InstanceId
                );
                if (isStandby) {
                    isReplica = true;
                    // Build connectedInstances list: primary + all other standbys (excluding self)
                    if (dgConfig.primary) {
                        connectedInstances.push(dgConfig.primary);
                    }
                    dgConfig.standby.forEach((standby: any) => {
                        // Exclude self from connected instances
                        if (
                            !(
                                standby.databaseInstanceName === instance.databaseInstanceName &&
                                standby.credentialId === instance.credentialId &&
                                standby.regionId === instance.regionId &&
                                standby.ec2InstanceId === instance.ec2InstanceId
                            )
                        ) {
                            connectedInstances.push(standby);
                        }
                    });
                }
            }

            // Check if this instance is a primary with standbys
            if (
                dgConfig.primary &&
                dgConfig.primary.databaseInstanceName === instance.databaseInstanceName &&
                dgConfig.primary.credentialId === instance.credentialId &&
                dgConfig.primary.regionId === instance.regionId &&
                dgConfig.primary.ec2InstanceId === instance.ec2InstanceId &&
                dgConfig.standby &&
                dgConfig.standby.length > 0
            ) {
                hasReplicas = true;
                replicasCount = dgConfig.standby.length;
                replicasList = dgConfig.standby;
                // For primary, connectedInstances is the same as replicasList (all standbys)
                connectedInstances = [...dgConfig.standby];
            }
        });

        return {
            ...instance,
            isReplica,
            hasReplicas,
            replicasCount,
            replicasList,
            connectedInstances
        };
    });
};

/**
 * Groups Oracle DataGuard configurations from inventory data
 * Groups instances by their DataGuard associatedHosts EC2 instances and dbName
 *
 * @param inventoryTableData - The inventory table data object
 * @param allInstanceTableRows - Enriched instance table rows with all computed fields
 * @returns Array of DataGuard configurations, making it easier to search by EC2 instance IDs
 *
 * Example output:
 * [
 *   {
 *     configKey: "dg2_i-xxx0_i-xxx1_credid_regionid",
 *     dbName: "dg2",
 *     ec2InstanceCluster: ["i-xxx0", "i-xxx1"],
 *     primary: { instanceName: "oracle-primary", ec2InstanceId: "i-xxx0", ... },
 *     standby: [{ instanceName: "oracle-standby", ec2InstanceId: "i-xxx1", ... }],
 *     credentialId: "...",
 *     regionId: "..."
 *   },
 *   {
 *     configKey: "dg1_i-xxx0_i-xxx1_credid_regionid",
 *     dbName: "dg1",
 *     ec2InstanceCluster: ["i-xxx0", "i-xxx1"],
 *     primary: { instanceName: "pdbnas1", ec2InstanceId: "i-xxx0", ... },
 *     standby: [{ instanceName: "pdbnas1s", ec2InstanceId: "i-xxx1", ... }],
 *     credentialId: "...",
 *     regionId: "..."
 *   }
 * ]
 */
export const groupDataGuardConfigurations = (inventoryTableData: any, allInstanceTableRows: any[] = []) => {
    const dataGuardGroups: Record<string, any> = {};
    const processedInstances = new Set<string>(); // Track processed instances to avoid duplicates

    // Iterate through all hosts in inventory
    Object.values(inventoryTableData || {}).forEach((host: any) => {
        // Only process Oracle hosts
        if (host?.hostType !== DBType.ORACLE) {
            return;
        }

        const { sqlServerInstances = [], ec2InstanceId, credentialId, regionId, name: hostName } = host;

        // Process each SQL Server instance (Oracle instance)
        sqlServerInstances.forEach((instance: any) => {
            if (
                isAuthRequiredForInstance(instance, DBType.ORACLE) &&
                instance?.statusColText !== INVENTORY_STATUS.MANAGED
            ) {
                return;
            }
            const { dataguardDetails, databaseInstanceName } = instance;

            // Only process DataGuard-enabled instances
            if (
                !dataguardDetails ||
                !dataguardDetails.associatedHosts ||
                dataguardDetails.associatedHosts.length === 0
            ) {
                return;
            }

            const { dbName, isPrimaryNode, associatedHosts } = dataguardDetails;

            // Skip if essential data is missing
            if (!dbName || !databaseInstanceName) {
                return;
            }

            // Create unique instance identifier to prevent duplicate processing
            const instanceId = `${ec2InstanceId}_${databaseInstanceName}_${credentialId}_${regionId}`;
            if (processedInstances.has(instanceId)) {
                return;
            }
            processedInstances.add(instanceId);

            // Extract and sort EC2 instance IDs from associatedHosts to create a consistent cluster identifier
            const ec2InstanceIds = associatedHosts
                .map((host: any) => host.ec2InstanceId)
                .filter((id: string) => id) // Remove undefined/null values
                .sort(); // Sort to ensure consistent key regardless of order

            // Skip if no valid EC2 instance IDs found
            if (ec2InstanceIds.length === 0) {
                return;
            }

            // Create unique key: dbName_sortedEc2Ids_credId_regionId
            // This ensures all instances with the same dbName and EC2 cluster are grouped together
            const ec2ClusterKey = ec2InstanceIds.join('_');
            const configKey = `${dbName}_${ec2ClusterKey}_${credentialId}_${regionId}`;

            // Initialize the group if it doesn't exist
            if (!dataGuardGroups[configKey]) {
                dataGuardGroups[configKey] = {
                    configKey, // Include the key in the object for easier reference
                    dbName,
                    ec2InstanceCluster: ec2InstanceIds,
                    primary: null,
                    standby: [],
                    credentialId,
                    regionId,
                    associatedHosts // Keep full associatedHosts info for reference
                };
            }

            // Find enriched instance data from allInstanceTableRows
            // Match by databaseInstanceName, credentialId, regionId, and ec2InstanceId
            const enrichedInstance = allInstanceTableRows.find(
                (row: any) =>
                    row.databaseInstanceName === databaseInstanceName &&
                    row.credentialId === credentialId &&
                    row.regionId === regionId &&
                    row.ec2InstanceId === ec2InstanceId
            );

            // Use enriched instance data if available, otherwise fallback to basic instance data
            const instanceData = enrichedInstance || {
                ...instance,
                ec2InstanceId,
                credentialId,
                regionId,
                hostName,
                hostStatus: host.status,
                ssmState: host.ssmState,
                platform: host.platform,
                resourceId: host.resourceId
            };

            // Classify as primary or standby based on isPrimaryNode flag
            if (isPrimaryNode) {
                // Only set primary if not already set (should only be one primary per config)
                if (!dataGuardGroups[configKey].primary) {
                    dataGuardGroups[configKey].primary = instanceData;
                }
                // Multiple primary instances found for DataGuard config - skip duplicates
            } else {
                // Add to standby list
                dataGuardGroups[configKey].standby.push(instanceData);
            }
        });
    });

    // Convert object to array and filter out groups without a primary
    // A DataGuard configuration without a primary is incomplete and should not be returned
    return Object.values(dataGuardGroups).filter((group: any) => group.primary !== null);
};

/**
 * Filters storage objects to return only FSx for NetApp ONTAP (FSXN) type storage
 *
 * @param data - Object containing a storage array with various storage types
 * @returns Array of FSXN storage objects, or empty array if no storage data exists
 *
 * Example output:
 * [
 *   {
 *     type: "FSXN",
 *     fileSystemId: "fs-xxx",
 *     fileSystemName: "my-fsxn-filesystem",
 *     ...
 *   }
 * ]
 */
export const getFsxList = (data: any) => {
    if (!data?.storage || !Array.isArray(data.storage)) {
        return [];
    }
    // Filter to return only FSXN type storage objects
    return data.storage.filter((storageItem: any) => storageItem?.type === STORAGE_TYPES.FSXN);
};

/**
 * Groups MSSQL AOAG (Always On Availability Group) databases by cluster, AG name, and database name
 * Groups databases from AOAG configurations by their cluster EC2 instances, availability group name,
 * and database name - matching primary and secondary replicas of the SAME database
 *
 * @param inventoryTableData - The inventory table data object
 * @param allDatabaseTableRows - Database table rows to search for AOAG databases
 * @returns Array of AOAG configurations grouped by cluster, AG name, and database name
 *
 * Example output:
 * [
 *   {
 *     configKey: "ProdAOAG_RetailBanking_i-xxx1_i-xxx2_credid_regionid",
 *     agName: "ProdAOAG",
 *     dbName: "RetailBanking",
 *     ec2InstanceCluster: ["i-xxx1", "i-xxx2"],
 *     primary: { name: "RetailBanking", replicaRole: "PRIMARY", hostName: "prd-sql-crm-ag1", ... },
 *     standby: [
 *       { name: "RetailBanking", replicaRole: "SECONDARY", hostName: "prd-sql-crm-ag2", ... }
 *     ],
 *     credentialId: "...",
 *     regionId: "..."
 *   },
 *   {
 *     configKey: "ProdAOAG_MFGSales_i-xxx1_i-xxx2_credid_regionid",
 *     agName: "ProdAOAG",
 *     dbName: "MFGSales",
 *     ec2InstanceCluster: ["i-xxx1", "i-xxx2"],
 *     primary: { name: "MFGSales", replicaRole: "PRIMARY", hostName: "prd-sql-crm-ag1", ... },
 *     standby: [
 *       { name: "MFGSales", replicaRole: "SECONDARY", hostName: "prd-sql-crm-ag2", ... }
 *     ],
 *     credentialId: "...",
 *     regionId: "..."
 *   }
 * ]
 */
export const groupAOAGConfigurations = (inventoryTableData: any, allDatabaseTableRows: any[] = []) => {
    const aoagConfigMap: { [key: string]: any } = {};

    if (!inventoryTableData) {
        return [];
    }

    // Iterate through inventory to find AOAG instances
    Object.keys(inventoryTableData).forEach((hostKey: string) => {
        const hostData = inventoryTableData[hostKey];

        // Only process MSSQL hosts
        if (hostData?.hostType !== DBType.MSSQL) {
            return;
        }

        // Process each SQL Server instance
        hostData?.sqlServerInstances?.forEach((instance: any) => {
            // Only process AOAG deployments
            if (
                (instance?.sqlServerDeploymentType !== DATABASE_DEPLOYMENT_MODE.AOAG_CAPS &&
                    instance?.sqlServerDeploymentType !== DATABASE_DEPLOYMENT_MODE.AOAG) ||
                !instance?.aoagDetails ||
                !instance?.aoagClusterNodeDetails
            ) {
                return;
            }

            const { aoagDetails } = instance;
            const clusterNodes = instance.aoagClusterNodeDetails;

            // Extract EC2 instance IDs from cluster nodes
            const ec2InstanceIds = clusterNodes
                .map((node: any) => node?.ec2InstanceId)
                .filter(Boolean)
                .sort();

            if (ec2InstanceIds.length === 0) {
                return;
            }

            // Process each availability group
            aoagDetails?.availabilityGroups?.forEach((ag: any) => {
                const agName = ag?.agName;
                if (!agName) {
                    return;
                }

                // Create a unique key for this AOAG configuration
                const configKey = `${agName}_${ec2InstanceIds.join('_')}_${hostData.credentialId}_${hostData.regionId}`;

                // Skip if already processed
                if (aoagConfigMap[configKey]) {
                    return;
                }

                // Find all databases belonging to this availability group
                // Only search hosts whose EC2 instance IDs are part of this AOAG cluster
                const agDatabases: any[] = [];
                const seenDatabases = new Set<string>();

                // Search through all instances across MSSQL hosts in the same cluster
                Object.keys(inventoryTableData).forEach((searchKey: string) => {
                    const searchHost = inventoryTableData[searchKey];

                    // Only process MSSQL hosts with same credential and region,
                    // AND whose EC2 instance ID is part of this AOAG cluster
                    if (
                        searchHost?.hostType !== DBType.MSSQL ||
                        searchHost?.credentialId !== hostData.credentialId ||
                        searchHost?.regionId !== hostData.regionId ||
                        !ec2InstanceIds.includes(searchHost?.ec2InstanceId)
                    ) {
                        return;
                    }

                    // Search through instances
                    searchHost?.sqlServerInstances?.forEach((searchInstance: any) => {
                        // Only process AOAG instances
                        if (
                            searchInstance?.sqlServerDeploymentType !== DATABASE_DEPLOYMENT_MODE.AOAG_CAPS &&
                            searchInstance?.sqlServerDeploymentType !== DATABASE_DEPLOYMENT_MODE.AOAG
                        ) {
                            return;
                        }

                        // Collect databases from this instance that belong to the AG
                        searchInstance?.databases?.forEach((db: any) => {
                            if (db?.availabilityGroup === agName) {
                                // Create unique key to avoid duplicate database entries from the same instance
                                const uniqueKey = `${searchHost?.ec2InstanceId}_${searchInstance?.databaseInstanceId}_${db?.name}`;

                                // Only add if we haven't seen this exact database on this instance before
                                if (!seenDatabases.has(uniqueKey)) {
                                    seenDatabases.add(uniqueKey);
                                    agDatabases.push({
                                        ...db,
                                        hostName: searchHost?.name,
                                        ec2InstanceId: searchHost?.ec2InstanceId,
                                        databaseInstanceId: searchInstance?.databaseInstanceId,
                                        databaseInstanceName: searchInstance?.databaseInstanceName,
                                        credentialId: searchHost?.credentialId,
                                        regionId: searchHost?.regionId
                                    });
                                }
                            }
                        });
                    });
                });

                // Group databases by name to match primary/secondary pairs for the same database
                const databasesByName: { [dbName: string]: any[] } = {};
                agDatabases.forEach((db: any) => {
                    const dbName = db?.name;
                    if (dbName) {
                        if (!databasesByName[dbName]) {
                            databasesByName[dbName] = [];
                        }
                        databasesByName[dbName].push(db);
                    }
                });

                // Create a config entry for each unique database name in the AG
                Object.keys(databasesByName).forEach((dbName: string) => {
                    const dbsForName = databasesByName[dbName];
                    const primaryDatabase = dbsForName.find((db: any) => db?.replicaRole === REPLICA_ROLES.PRIMARY);
                    const standbyDatabases = dbsForName.filter(
                        (db: any) => db?.replicaRole === REPLICA_ROLES.SECONDARY
                    );

                    // Create unique key including database name
                    const dbConfigKey = `${agName}_${dbName}_${ec2InstanceIds.join('_')}_${hostData.credentialId}_${
                        hostData.regionId
                    }`;

                    // Skip if already processed
                    if (aoagConfigMap[dbConfigKey]) {
                        return;
                    }

                    // Store the AOAG configuration for this database
                    aoagConfigMap[dbConfigKey] = {
                        configKey: dbConfigKey,
                        agName,
                        dbName,
                        ec2InstanceCluster: ec2InstanceIds,
                        primary: primaryDatabase || null,
                        standby: standbyDatabases,
                        credentialId: hostData.credentialId,
                        regionId: hostData.regionId
                    };
                });
            });
        });
    });

    return Object.values(aoagConfigMap);
};

/**
 * Enriches database rows with AOAG replica flags
 * Adds isReplica, isPrimary, hasReplicas, replicasCount, and replicasList to each AOAG database
 *
 * @param allDatabaseTableRows - The database table rows to enrich
 * @param aoagRows - Array of AOAG configurations from groupAOAGConfigurations
 * @returns Enriched database table rows with AOAG flags
 */
export const enrichDatabasesWithAOAGFlags = (allDatabaseTableRows: any[], aoagRows: any[]): any[] => {
    if (!aoagRows || aoagRows.length === 0) {
        return allDatabaseTableRows;
    }

    // Create a lookup map for database rows by unique key
    const dbRowLookup: { [key: string]: any } = {};
    allDatabaseTableRows.forEach((dbRow: any) => {
        const key = `${dbRow.ec2InstanceId}_${dbRow.databaseInstanceId}_${dbRow.name}`;
        dbRowLookup[key] = dbRow;
    });

    // Create a lookup map for AOAG info
    const aoagLookup: { [key: string]: any } = {};

    aoagRows.forEach((aoagConfig: any) => {
        const { agName, primary, standby, ec2InstanceCluster } = aoagConfig;

        // Add primary database info
        if (primary) {
            const primaryKey = `${primary.ec2InstanceId}_${primary.databaseInstanceId}_${primary.name}`;

            // Build replicasList with full database row objects
            const replicasList = standby.map((s: any) => {
                const standbyKey = `${s.ec2InstanceId}_${s.databaseInstanceId}_${s.name}`;
                const standbyDbRow = dbRowLookup[standbyKey];
                // Return the full database row if found, otherwise return minimal info
                return (
                    standbyDbRow || {
                        name: s.name,
                        hostName: s.hostName,
                        ec2InstanceId: s.ec2InstanceId,
                        synchronizationState: s.synchronizationState,
                        databaseInstanceId: s.databaseInstanceId,
                        databaseInstanceName: s.databaseInstanceName
                    }
                );
            });

            aoagLookup[primaryKey] = {
                isPrimary: true,
                isReplica: false,
                hasReplicas: standby.length > 0,
                replicasCount: standby.length,
                replicasList,
                agName,
                ec2InstanceCluster
            };
        }

        // Add standby database info
        standby.forEach((standbyDb: any) => {
            const standbyKey = `${standbyDb.ec2InstanceId}_${standbyDb.databaseInstanceId}_${standbyDb.name}`;

            // Build primaryDatabase with full database row object
            let primaryDatabaseFull = null;
            if (primary) {
                const primaryKey = `${primary.ec2InstanceId}_${primary.databaseInstanceId}_${primary.name}`;
                const primaryDbRow = dbRowLookup[primaryKey];
                primaryDatabaseFull = primaryDbRow || {
                    name: primary.name,
                    hostName: primary.hostName,
                    ec2InstanceId: primary.ec2InstanceId,
                    synchronizationState: primary.synchronizationState,
                    databaseInstanceId: primary.databaseInstanceId,
                    databaseInstanceName: primary.databaseInstanceName
                };
            }

            aoagLookup[standbyKey] = {
                isPrimary: false,
                isReplica: true,
                hasReplicas: false,
                replicasCount: 0,
                replicasList: [],
                primaryDatabase: primaryDatabaseFull,
                agName,
                ec2InstanceCluster
            };
        });
    });

    // Enrich database rows with AOAG flags
    return allDatabaseTableRows.map((dbRow: any) => {
        const lookupKey = `${dbRow.ec2InstanceId}_${dbRow.databaseInstanceId}_${dbRow.name}`;
        const aoagInfo = aoagLookup[lookupKey];

        if (aoagInfo) {
            return {
                ...dbRow,
                ...aoagInfo
            };
        }

        return dbRow;
    });
};

/**
 * Determines if a database instance should be disabled for management actions
 * Checks multiple conditions including host type, authentication status, deployment mode,
 * file system type, and instance status to decide if the manage action should be disabled
 *
 * @param rowData - The database instance row data containing status, type, and configuration details
 * @param selectedHostType - The type of database host (MSSQL, ORACLE, POSTGRESQL)
 * @param t - Translation function for internationalized error messages
 * @returns Object with isDisabled flag and corresponding errorMessage
 *
 * Conditions checked:
 * - PostgreSQL instances (not supported for bulk management)
 * - Already managed instances
 * - Unauthenticated instances
 * - AOAG (Always On Availability Groups) deployments
 * - Non-FSxN storage without FSx ID
 * - Offline host status
 * - Offline SSM state
 * - Down instance status
 */
const disableManageCheck = (rowData: any, selectedHostType: string, t: TFunction) => {
    let errorMessage = '';
    let isDisabled = false;
    if (rowData?.hostType === DBType.POSTGRESQL) {
        isDisabled = true;
        errorMessage = t('databases.register-flow.no-bulk-cta');
    } else if (rowData?.statusColText === INVENTORY_STATUS.MANAGED) {
        isDisabled = true;
        errorMessage = t('databases.register-flow.already-managed-instance');
    } else if (rowData?.statusColText === INVENTORY_STATUS.UNDETECTED) {
        isDisabled = true;
        errorMessage = t('databases.register-flow.not-authenticated-instance');
    } else if (rowData?.serverInstallationMode === DATABASE_DEPLOYMENT_MODE.AOAG) {
        isDisabled = true;
        errorMessage = t('databases.register-flow.aoag-manage-disable');
    } else if (rowData.fileSystemType !== STORAGE_TYPES.FSX_FOR_ONTAP && !rowData?.fsxId) {
        isDisabled = true;
        errorMessage =
            rowData?.hostType === DBType.ORACLE
                ? t('databases.register-flow.fsxn-manage-supported-oracle')
                : t('databases.register-flow.fsxn-manage-supported');
    } else if (rowData?.status === INVENTORY_STATUS.OFFLINE) {
        isDisabled = true;
        errorMessage = t('databases.register-flow.host-down');
    } else if (rowData?.ssmState === INVENTORY_STATUS.OFFLINE) {
        isDisabled = true;
        errorMessage = t('databases.register-flow.ssm-down');
    } else if (rowData?.status?.toLowerCase() === INVENTORY_STATUS.DOWN) {
        isDisabled = true;
        errorMessage =
            selectedHostType === DBType.ORACLE
                ? t('databases.register-flow.oracle-server-instance-down')
                : t('databases.register-flow.sql-server-instance-down');
    }
    return { isDisabled, errorMessage };
};

/**
 * Normalizes instance status values for consistent filtering and display
 * Maps various raw status values to standardized status strings
 *
 * @param rowData - Optional row data object containing status information
 * @returns Normalized status string (ONLINE, OFFLINE) or original status value
 *
 * Status mappings:
 * - "running" (lowercase) or "Up" (case-sensitive) → ONLINE
 * - "stopped" or "Down" (case-sensitive) → OFFLINE
 * - Other values → returned as-is
 */
const setStatusForFilter = (rowData?: any) => {
    if (
        rowData?.status?.toLowerCase() === INVENTORY_STATUS.RUNNING_LOWER ||
        rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP
    ) {
        return INVENTORY_STATUS.ONLINE;
    }
    if (rowData?.status === INVENTORY_STATUS.STOPPED || rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN) {
        return INVENTORY_STATUS.OFFLINE;
    }
    return rowData?.status;
};

/**
 * Enriches database instance row data with computed properties for table display and interactions
 * This function augments raw instance data with UI-specific properties including management state,
 * optimization status, protection status, and normalized status values
 *
 * @param row - The database instance row data to enrich
 * @param t - Translation function for internationalized messages
 * @param instanceProtection - Cache object containing SnapCenter protection status for instances
 * @param isDemoMode - Boolean indicating if the application is running in demo mode
 * @returns Enriched row object with additional computed properties
 *
 * Computed properties added:
 * - isProtected: Boolean indicating if instance has SnapCenter protection configured
 * - statusAccessor: Normalized status string for consistent filtering (ONLINE/OFFLINE)
 * - optimizationStatus: Well-architected assessment status display value
 * - optimizationDisableMsg: Message explaining why optimization actions are disabled (if applicable)
 * - cellProps.isDisabled: Boolean indicating if management actions should be disabled
 * - cellProps.selectionProps: Tooltip configuration showing why selection is disabled
 *
 * Protection status logic:
 * - Demo mode: Uses DEMO_MODE_PROTECTION_CRITERIA to determine protection status
 * - Normal mode: Checks instanceProtection cache with multiple key patterns (FQDN, short name, instance variants)
 */
export const instanceExtraDataUpdate = (row: any, t: TFunction, instanceProtection: any, isDemoMode: any) => {
    const { isDisabled, errorMessage } = disableManageCheck(row, row?.hostType, t);
    const optimizationData = getOptimizationStatusData(row, t);
    let optimizationStatus;
    let optimizationDisableMsg;
    let optimizationIsDisabled;
    if (typeof optimizationData === 'object' && optimizationData !== null && 'displayValue' in optimizationData) {
        optimizationStatus = optimizationData.displayValue;
        optimizationDisableMsg = optimizationData.disableMsg;
        optimizationIsDisabled = optimizationData.isDisabled;
    } else {
        optimizationStatus = optimizationData;
        optimizationDisableMsg = '';
        optimizationIsDisabled = false;
    }
    // Compute protection from cache
    const hostFqdn = (row?.hostRow?.fqdn || row?.hostRow?.name || row?.name || '').toLowerCase();
    const hostShort = hostFqdn.split('.')[0];
    let isProtected = false;

    if (isDemoMode) {
        // Demo mode: Specific instances should show "Edit Protection" based on mock data
        const hostName = (row?.hostRow?.name || row?.name || '').toLowerCase();
        const instanceName = (row?.databaseInstanceName || '').toLowerCase();

        // Check against demo mode criteria from constants
        isProtected = DEMO_MODE_PROTECTION_CRITERIA.instances.some(
            criteria => criteria.hostName === hostName && criteria.instanceNames.includes(instanceName)
        );
    } else {
        // Normal mode: Use SnapCenter cache
        const instName = (row?.databaseInstanceName || '').toLowerCase();
        const possibleKeys = [
            `${hostFqdn}::${instName}`,
            `${hostShort}::${instName}`,
            // Named instance full form host\\instance
            `${hostFqdn}::${hostShort}\\${instName}`,
            `${hostShort}::${hostShort}\\${instName}`,
            // Default instance MSSQLSERVER variants
            `${hostFqdn}::${hostShort}`,
            `${hostShort}::${hostShort}`
        ];
        isProtected = possibleKeys.some(k => instanceProtection?.[k]?.protected === true);
    }

    return {
        ...row,
        isProtected,
        statusAccessor: setStatusForFilter(row),
        optimizationStatus,
        optimizationDisableMsg,
        cellProps: {
            ...row.cellProps,
            isDisabled,
            selectionProps: {
                title: errorMessage,
                titleProps: {
                    placement: 'bottom'
                }
            }
        }
    };
};

export const determineProtectionStatusMssql = (
    isDemoMode: boolean | undefined,
    rowData: any,
    databaseProtection: any
) => {
    // Determine protection status
    let isProtected = false;

    if (isDemoMode) {
        // Demo mode: Specific databases should show "Edit Protection" based on mock data
        const hostName = (rowData?.hostRow?.name || rowData?.hostName || '').toLowerCase();
        const dbName = (rowData?.name || '').toLowerCase();

        // Check against demo mode criteria from constants
        isProtected = DEMO_MODE_PROTECTION_CRITERIA.databases.some(
            criteria => criteria.hostName === hostName && criteria.databaseNames.includes(dbName)
        );
    } else {
        // Normal mode: Use SnapCenter cache first, fall back to status text
        const hostFqdn = (rowData?.hostRow?.fqdn || rowData?.hostName || '').toLowerCase();
        const hostShort = hostFqdn.split('.')[0];
        const instanceShort = (rowData?.databaseInstanceName || '').toLowerCase();
        const dbName = (rowData?.name || '').toLowerCase();
        const possibleKeys = [
            `${hostFqdn}::${instanceShort}::${dbName}`,
            `${hostShort}::${instanceShort}::${dbName}`,
            `${hostFqdn}::mssqlserver::${dbName}`,
            `${hostShort}::mssqlserver::${dbName}`
        ];
        const isProtectedCache = possibleKeys.some(k => databaseProtection?.[k]?.protected === true);
        const statusVal = (rowData?.protectionStatus || rowData?.status || '').toLowerCase();
        isProtected = isProtectedCache || statusVal === 'protected';
    }
    return isProtected;
};

// Function to check if protect option should be disabled
export const isProtectDisabled = (rowData: any): boolean =>
    rowData?.hostType !== GENERAL.MICROSOFT_SQL_SERVER_TYPE ||
    !rowData?.instanceRow?.fsxId ||
    !rowData?.hostRow?.nodeIpAddress ||
    rowData?.status !== 'ONLINE';

export const mssqlDatabaseMenuOptions = (t: TFunction, isProtected: boolean, rowData: any) => {
    let disableOption = false;
    let disableMessage = '';

    if (rowData?.hostType === GENERAL.POSTGRESQL_TYPE) {
        disableOption = true;
        disableMessage = GENERAL.COMING_SOON;
    } else if (rowData?.type === GENERAL.SYSTEM_DATABASE) {
        disableOption = true;
        disableMessage = 'Create sandbox option is not available for system database.';
    }
    return [
        {
            id: 'createSandbox',
            displayName: t('databases.instance-table.menu-options.create-sandbox'),
            disabled: disableOption,
            infoText: disableMessage
        },
        {
            id: isProtected ? 'editProtection' : 'protect',
            displayName: isProtected
                ? t('databases.instance-table.menu-options.edit-protection')
                : t('databases.instance-table.menu-options.protect'),
            disabled: isProtectDisabled(rowData)
        },
        ...(isProtected
            ? [
                  {
                      id: 'viewProtectionDetails',
                      displayName: t('databases.instance-table.menu-options.view-protection-details'),
                      disabled: false
                  }
              ]
            : [])
    ];
};

/**
 * Extracts availability group names from aoagDetails
 * @param perRow - Row data containing aoagDetails
 * @returns Array of availability group names, or empty array if aoagDetails is not available
 */
export const getAvailabilityGroupListForAoag = (perRow: any): string[] => {
    if (!perRow?.aoagDetails?.availabilityGroups) {
        return [];
    }

    return perRow?.aoagDetails?.availabilityGroups.map((ag: any) => ag.agName);
};

/**
 * Calculates the total replica count per database for AOAG setups
 * @param perRow - Row data containing aoagDetails and deployment type
 * @param perDatabase - Database object containing availabilityGroup and replicaRole
 * @returns Number of replicas (replicas.length - 1) for PRIMARY databases in AOAG, or 0 otherwise
 */
export const getAoagTotalReplicaCountPerDatabase = (perRow: any, perDatabase: any): number => {
    // Check if it is AOAG setup - if not, return 0
    if (perRow?.sqlServerDeploymentType?.toLowerCase() !== SQL_DEPLOYMENT_MODE.AOAG) {
        return 0;
    }

    const availabilityGroup = perDatabase?.availabilityGroup;

    // If no availabilityGroup and replicaRole is not PRIMARY, return 0
    if (!availabilityGroup && perDatabase?.replicaRole !== REPLICA_ROLES.PRIMARY) {
        return 0;
    }

    // If availabilityGroup exists and replicaRole is PRIMARY
    if (availabilityGroup && perDatabase?.replicaRole === REPLICA_ROLES.PRIMARY) {
        const availabilityGroups = perRow?.aoagDetails?.availabilityGroups || [];

        // Find the AG object with matching agName
        const matchingAg = availabilityGroups.find((ag: any) => ag?.agName === availabilityGroup);

        if (!matchingAg) {
            return 0;
        }

        const replicasLength = matchingAg?.replicas?.length || 0;

        // If replicas list is 0, return 0, else return replicas.length - 1
        return replicasLength === 0 ? 0 : replicasLength - 1;
    }

    return 0;
};
